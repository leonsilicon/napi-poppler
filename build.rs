fn main() {
    napi_build::setup();
    let target = std::env::var("TARGET").unwrap();
    if target.contains("apple") {
        println!("cargo:rustc-link-lib=c++");
    } else if target.contains("linux") {
        println!("cargo:rustc-link-lib=stdc++");
    } else if target.contains("windows") {
        // The static GLib/Poppler pkg-config metadata omits these Windows
        // system import libraries when consumed by the Rust bindings.
        for library in ["advapi32", "ole32", "shell32", "user32"] {
            println!("cargo:rustc-link-lib=dylib={library}");
        }
    }
}
