# Third-party notices

This project is GPL-3.0-or-later. The platform packages contain statically
linked Poppler utilities and a napi-rs addon linked to Poppler's GLib API via
poppler-rs. Poppler is GPL-2.0-or-later; poppler-rs and napi-rs are MIT.

The compatibility facade, option definitions, and upstream fixtures/tests
are adapted from [node-poppler](https://github.com/Fdawgs/node-poppler),
copyright Frazer Smith, under MIT. Its complete license is in
`compat/LICENSE` and `tests/upstream/LICENSE`.

JavaScript helpers camelcase (MIT), ice-barrage (MIT), and semver (ISC) are
bundled in `dist/helpers.cjs`. Each platform package includes a `licenses/`
directory containing the license notices provided by vcpkg for its native
dependencies, including GLib, Cairo, Fontconfig, FreeType, libpng,
libjpeg-turbo, OpenJPEG, TIFF, zlib, and their dependencies.
Poppler's encoding data (poppler-data 0.4.12) is bundled under its included
GPL-2.0 and Adobe BSD notices. The MIT license for vcpkg's copied build recipes
is in `native/ports/LICENSE`.

Pinned, checksum-verified build recipes are in `vcpkg-configuration.json`
and `native/ports/poppler`. Rust dependency versions are in `Cargo.lock`.
Source for the addon and utilities can be rebuilt using the instructions
in README.md. Consumers can relink the Rust addon against modified native
dependencies by rebuilding it from source.
