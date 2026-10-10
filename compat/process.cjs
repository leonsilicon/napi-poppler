"use strict";

// A narrow process adapter for the upstream facade. Production execution goes
// through napi-rs; keeping this seam separate also preserves upstream's mocks.
const { EventEmitter } = require("node:events");
const { existsSync } = require("node:fs");
const { dirname, join } = require("node:path");
const { platform, arch } = require("node:process");
const { PassThrough, Writable } = require("node:stream");
const { promisify } = require("node:util");
const native = require("../binding/index.cjs");

function bundledPath() {
  const suffix =
    platform === "linux"
      ? `linux-${arch}-gnu`
      : platform === "win32"
        ? `win32-${arch}-msvc`
        : `darwin-${arch}`;
  const local = join(__dirname, "../binding/bin");
  if (existsSync(join(local, platform === "win32" ? "pdfinfo.exe" : "pdfinfo"))) return local;
  try {
    return join(dirname(require.resolve(`napi-poppler-${suffix}/package.json`)), "bin");
  } catch {
    throw new Error(
      "Bundled Poppler utilities are missing. Build the native dependencies with vp run build:deps and vp run build, or install with npm optional dependencies enabled.",
    );
  }
}

function spawnError(error, program, args) {
  const code = /os error (?:2|3)\)/u.test(error.message) ? "ENOENT" : "EACCES";
  return Object.assign(new Error(`spawn ${program} ${code}`), {
    code,
    errno: code === "ENOENT" ? -2 : -13,
    syscall: `spawn ${program}`,
    path: program,
    spawnargs: args,
  });
}

function spawnSync(program, args) {
  if ((program === "which" || program === "where") && args[0] === "pdfinfo") {
    try {
      return {
        stdout: Buffer.from(
          join(bundledPath(), platform === "win32" ? "pdfinfo.exe" : "pdfinfo") + "\n",
        ),
        stderr: Buffer.alloc(0),
        status: 0,
      };
    } catch {
      return { stdout: Buffer.alloc(0), stderr: Buffer.alloc(0), status: 1 };
    }
  }
  try {
    const result = native.runSync(program, args.map(String));
    return { ...result, status: result.code };
  } catch (error) {
    return {
      stdout: Buffer.alloc(0),
      stderr: Buffer.alloc(0),
      status: null,
      error: spawnError(error, program, args),
    };
  }
}

function spawn(program, args, options = {}) {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.stdin = null;
  const pipeInput = options.stdio?.[0] === "pipe";
  let handle;
  let done = false;
  let aborted = false;
  const signal = options.signal;
  const finish = (result, error) => {
    if (done) return;
    done = true;
    signal?.removeEventListener("abort", abort);
    if (error && !aborted) child.emit("error", error);
    child.stdout.end(result?.stdout);
    child.stderr.end(result?.stderr);
    child.emit("close", result?.code ?? null);
  };
  const abort = () => {
    if (done || aborted) return;
    aborted = true;
    handle?.cancel();
    const error = Object.assign(new Error("The operation was aborted", { cause: signal?.reason }), {
      name: "AbortError",
      code: "ABORT_ERR",
    });
    child.emit("error", error);
  };
  const run = (input) => {
    if (!handle) return;
    handle.run(input).then(
      (result) => finish(result),
      (error) => finish(undefined, error),
    );
  };
  try {
    // Node coerces positional undefined/number values to strings too.
    handle = new native.NativeProcess(program, args.map(String), pipeInput);
    child.pid = handle.pid;
    child.kill = () => {
      handle.cancel();
      return true;
    };
    if (pipeInput) {
      const chunks = [];
      child.stdin = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(Buffer.from(chunk));
          callback();
        },
        final(callback) {
          run(Buffer.concat(chunks));
          callback();
        },
      });
    } else queueMicrotask(() => run());
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) queueMicrotask(abort);
  } catch (error) {
    queueMicrotask(() => finish(undefined, spawnError(error, program, args)));
  }
  return child;
}

async function execute(program, args, options = {}) {
  const { once } = require("node:events");
  const { buffer } = require("node:stream/consumers");
  const child = spawn(program, args, options);
  const [out, err, [code]] = await Promise.all([
    buffer(child.stdout),
    buffer(child.stderr),
    once(child, "close"),
  ]);
  const stdout = out.toString(),
    stderr = err.toString();
  if (code !== 0) {
    throw Object.assign(new Error(`Command failed: ${program} ${args.join(" ")}\n${stderr}`), {
      code,
      killed: false,
      signal: null,
      cmd: `${program} ${args.join(" ")}`,
      stdout,
      stderr,
    });
  }
  return { stdout, stderr };
}

function execFile(program, args, options, callback) {
  execute(program, args, options).then(
    ({ stdout, stderr }) => callback(null, stdout, stderr),
    (error) => callback(error, error.stdout ?? "", error.stderr ?? ""),
  );
}
execFile[promisify.custom] = execute;
module.exports = { spawn, spawnSync, execFile, bundledPath };
