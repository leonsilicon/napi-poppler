# Native dependency build

The Poppler port is copied from microsoft/vcpkg at baseline
`e456309491fd875487bf02b8a0dca76c1b1b00cc` (Poppler 26.04.0).
The overlay enables `ENABLE_UTILS` and stages the twelve utilities used by
node-poppler. `relocatable-data.patch` lets each child process select its
packaged encoding data through `NAPI_POPPLER_DATADIR`, independently of the
build prefix. The poppler-data overlay pins and verifies version 0.4.12.
Other patches and build settings come from the pinned vcpkg port.
`static-cairo.patch` makes the utilities link Cairo's complete static
dependency graph, including Pixman and platform frameworks.

All library dependencies use vcpkg's static triplets. `SYSTEM_DEPS_LINK=static`
and target-specific pkg-config directories in `.cargo/config.toml` make
poppler-rs and GLib link only to that pinned installation. `build.rs` adds
the host's standard C++ runtime. Release CI audits the addon and each utility
to reject dependencies on external Poppler, GLib, Cairo, or codec libraries.
