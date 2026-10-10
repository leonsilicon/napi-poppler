use napi::bindgen_prelude::{AsyncTask, Buffer};
use napi::{Env, Error, Result, Task};
use napi_derive::napi;
use std::io::{Read, Write};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

fn io_error(error: std::io::Error) -> Error {
    Error::from_reason(error.to_string())
}

fn command(program: &str, args: &[String], pipe_input: bool) -> Command {
    let mut cmd = Command::new(program);
    if let Some(bin_dir) = std::path::Path::new(program).parent() {
        let data = bin_dir.join("../share/poppler");
        if data.is_dir() {
            cmd.env("NAPI_POPPLER_DATADIR", data);
        }
        let fonts = bin_dir.join("../share/fonts.conf");
        if fonts.is_file() && std::env::var_os("FONTCONFIG_FILE").is_none() {
            cmd.env("FONTCONFIG_FILE", fonts);
        }
    }
    cmd.args(args)
        .stdin(if pipe_input {
            Stdio::piped()
        } else {
            Stdio::null()
        })
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        // CREATE_NO_WINDOW: match node-poppler's windowsHide option.
        cmd.creation_flags(0x08000000);
    }
    cmd
}

#[napi(object)]
pub struct ProcessOutput {
    pub stdout: Buffer,
    pub stderr: Buffer,
    pub code: Option<u32>,
}

// The worker only holds the child lock for try_wait, never a blocking wait.
// Cancellation can therefore kill immediately, even if the worker pool is busy.
struct ProcessState {
    child: Mutex<Child>,
    cancelled: AtomicBool,
}

impl Drop for ProcessState {
    fn drop(&mut self) {
        if let Ok(child) = self.child.get_mut() {
            let _ = child.kill();
            let _ = child.wait();
        }
    }
}

#[napi]
pub struct NativeProcess {
    state: Arc<ProcessState>,
    started: bool,
    pid: u32,
}

#[napi]
impl NativeProcess {
    #[napi(constructor)]
    pub fn new(program: String, args: Vec<String>, pipe_input: bool) -> Result<Self> {
        let child = command(&program, &args, pipe_input)
            .spawn()
            .map_err(io_error)?;
        let pid = child.id();
        Ok(Self {
            state: Arc::new(ProcessState {
                child: Mutex::new(child),
                cancelled: AtomicBool::new(false),
            }),
            started: false,
            pid,
        })
    }

    #[napi(getter)]
    pub fn pid(&self) -> u32 {
        self.pid
    }

    #[napi]
    pub fn cancel(&self) {
        self.state.cancelled.store(true, Ordering::Release);
        if let Ok(mut child) = self.state.child.lock() {
            let _ = child.kill();
        }
    }

    #[napi(ts_return_type = "Promise<ProcessOutput>")]
    pub fn run(&mut self, input: Option<Buffer>) -> Result<AsyncTask<ProcessTask>> {
        if self.started {
            return Err(Error::from_reason("Process already started"));
        }
        self.started = true;
        Ok(AsyncTask::new(ProcessTask {
            state: self.state.clone(),
            input: input.map(|data| data.to_vec()),
        }))
    }
}

pub struct ProcessTask {
    state: Arc<ProcessState>,
    input: Option<Vec<u8>>,
}

fn read_output(mut stream: impl Read) -> std::io::Result<Vec<u8>> {
    let mut data = Vec::new();
    stream.read_to_end(&mut data)?;
    Ok(data)
}

impl Task for ProcessTask {
    type Output = (Vec<u8>, Vec<u8>, Option<u32>);
    type JsValue = ProcessOutput;

    fn compute(&mut self) -> Result<Self::Output> {
        let mut child = self
            .state
            .child
            .lock()
            .map_err(|_| Error::from_reason("Process lock poisoned"))?;
        // Drain both pipes concurrently, including while writing large PDFs.
        // A sequential write/read/wait would deadlock on pipe capacity.
        let stdout = child.stdout.take().expect("stdout was piped");
        let stderr = child.stderr.take().expect("stderr was piped");
        let stdout_reader = thread::spawn(move || read_output(stdout));
        let stderr_reader = thread::spawn(move || read_output(stderr));
        let stdin = child.stdin.take();
        drop(child);
        let writer = stdin.map(|mut stdin| {
            let input = self.input.take().unwrap_or_default();
            thread::spawn(move || {
                // A tool may close stdin early after an invalid input or -v.
                let _ = stdin.write_all(&input);
            })
        });
        let status = loop {
            let mut child = self
                .state
                .child
                .lock()
                .map_err(|_| Error::from_reason("Process lock poisoned"))?;
            if self.state.cancelled.load(Ordering::Acquire) {
                let _ = child.kill();
            }
            match child.try_wait() {
                Ok(Some(status)) => break Ok(status),
                Ok(None) => {
                    drop(child);
                    thread::sleep(Duration::from_millis(2));
                }
                Err(error) => {
                    let _ = child.kill();
                    let _ = child.wait();
                    break Err(error);
                }
            }
        };
        if let Some(writer) = writer {
            let _ = writer.join();
        }
        let stdout = stdout_reader
            .join()
            .map_err(|_| Error::from_reason("stdout reader panicked"))?;
        let stderr = stderr_reader
            .join()
            .map_err(|_| Error::from_reason("stderr reader panicked"))?;
        let status = status.map_err(io_error)?;
        Ok((
            stdout.map_err(io_error)?,
            stderr.map_err(io_error)?,
            status.code().map(|n| n as u32),
        ))
    }

    fn resolve(
        &mut self,
        _env: Env,
        (stdout, stderr, code): Self::Output,
    ) -> Result<Self::JsValue> {
        Ok(ProcessOutput {
            stdout: stdout.into(),
            stderr: stderr.into(),
            code,
        })
    }
}

#[napi]
pub fn run_sync(program: String, args: Vec<String>) -> Result<ProcessOutput> {
    let output = command(&program, &args, false).output().map_err(io_error)?;
    Ok(ProcessOutput {
        stdout: output.stdout.into(),
        stderr: output.stderr.into(),
        code: output.status.code().map(|n| n as u32),
    })
}

#[napi]
pub fn library_version() -> String {
    poppler::version()
        .map(|version| version.to_string())
        .unwrap_or_default()
}

#[napi(object)]
pub struct DocumentInfo {
    pub pages: i32,
    pub title: Option<String>,
    pub text: String,
}

pub struct InspectTask {
    bytes: Vec<u8>,
    password: Option<String>,
}

impl Task for InspectTask {
    type Output = DocumentInfo;
    type JsValue = DocumentInfo;

    fn compute(&mut self) -> Result<Self::Output> {
        // poppler-rs's !Send/!Sync GLib objects are created, used, and dropped
        // entirely on this worker. Only owned Rust data reaches JavaScript.
        let bytes = glib::Bytes::from_owned(std::mem::take(&mut self.bytes));
        let document = poppler::Document::from_bytes(&bytes, self.password.as_deref())
            .map_err(|error| Error::from_reason(error.to_string()))?;
        let pages = document.n_pages();
        let text = (0..pages)
            .filter_map(|index| document.page(index))
            .filter_map(|page| page.text())
            .map(|text| text.to_string())
            .collect::<Vec<_>>()
            .join("\n");
        Ok(DocumentInfo {
            pages,
            title: document.title().map(|title| title.to_string()),
            text,
        })
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output)
    }
}

#[napi(ts_return_type = "Promise<DocumentInfo>")]
pub fn inspect_document(bytes: Buffer, password: Option<String>) -> AsyncTask<InspectTask> {
    AsyncTask::new(InspectTask {
        bytes: bytes.to_vec(),
        password,
    })
}
