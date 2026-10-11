# @leonsilicon/napi-poppler

Node-API package with the public API of
[node-poppler 11.0.0](https://www.npmjs.com/package/node-poppler), built with
[napi-rs](https://napi.rs/) and
[poppler-rs](https://crates.io/crates/poppler-rs).
Platform packages bundle Poppler and its native dependencies. Consumers
need Node.js 22+, with npm optional dependencies enabled; no system Poppler,
Rust, compiler, or installation scripts are required.
Poppler encoding data is included for CJK PDFs and legacy encodings.

```sh
npm install @leonsilicon/napi-poppler
```

```ts
import { Poppler } from "@leonsilicon/napi-poppler";

const poppler = new Poppler();
const text = await poppler.pdfToText("document.pdf", undefined, {
  firstPageToConvert: 1,
  lastPageToConvert: 2,
});
const info = await poppler.pdfInfo("document.pdf", { printAsJson: true });
await poppler.pdfToCairo("document.pdf", "page", {
  pngFile: true,
  firstPageToConvert: 1,
  lastPageToConvert: 1,
});
```

The public API is ESM-only. Use `import { Poppler }` or `import Poppler`;
the package also exports the same option types as node-poppler.
On Node.js 22.12+ (or newer major versions), the CommonJS loader can also
load the same synchronous ESM entry. No separate CommonJS API bundle is
shipped. Version 0.2.1 fixes the import-only export map from 0.2.0 and migrates
the compatibility facade, helpers, and native loader to ESM imports.

## Compatibility

Replace imports of `node-poppler` with `@leonsilicon/napi-poppler`. The constructor,
`path` getter, argument order, option names and types, promise results,
option-version checks, errors, and `extras.signal` cancellation follow
node-poppler 11.0.0. All twelve methods are included:

| Method        | Operation                                    |
| ------------- | -------------------------------------------- |
| `pdfAttach`   | Add an attachment                            |
| `pdfDetach`   | List or extract attachments                  |
| `pdfFonts`    | List fonts                                   |
| `pdfImages`   | Extract images                               |
| `pdfInfo`     | Read metadata, optionally as JSON            |
| `pdfSeparate` | Split pages into individual PDFs             |
| `pdfToCairo`  | Render PNG, JPEG, TIFF, PDF, PS, EPS, or SVG |
| `pdfToHtml`   | Convert to HTML                              |
| `pdfToPpm`    | Render images with the Splash backend        |
| `pdfToPs`     | Convert to PostScript                        |
| `pdfToText`   | Extract text, layout, or bounding boxes      |
| `pdfUnite`    | Merge PDFs                                   |

File inputs accept paths and Node `Buffer`s wherever node-poppler accepts
them. Binary stdout is returned as a Latin-1 string, including PNG and PDF
output from `pdfToCairo`; use `Buffer.from(result, "binary")` to recover bytes.
This intentionally preserves node-poppler's API.

The default constructor uses bundled utilities. An explicit binary directory
(`new Poppler("/custom/poppler/bin")`) is honored. Output details and option
availability can vary with the selected Poppler version, as with node-poppler.
The pinned bundled version is Poppler 26.04.0; options introduced later reject
with the upstream version-check error. Formats and fallback fonts depend on
the document and available operating-system fonts.

## Architecture

The compatibility facade and option definitions derive from node-poppler
under MIT. A napi-rs backend owns process creation, concurrent stdin/stdout/
stderr handling, cancellation, and reaping. The bundled utilities preserve
Poppler's CLI output and behavior, including HTML conversion, PostScript,
attachments, splitting, and merging, which poppler-rs's GLib API does not
fully expose. This package still launches subprocesses for the compatible
`Poppler` API; it is not an in-process replacement for every CLI operation.

The addon also links poppler-rs for native PDF inspection. GLib documents
are created, used, and released entirely on a worker; no `unsafe Send` or
`unsafe Sync` implementations are used. Rust tasks return owned data.
JavaScript helpers are bundled, with no JavaScript runtime dependencies.

## Platforms

| Platform    | Architecture | Optional package                            |
| ----------- | ------------ | ------------------------------------------- |
| macOS       | ARM64        | `@leonsilicon/napi-poppler-darwin-arm64`    |
| Linux glibc | ARM64        | `@leonsilicon/napi-poppler-linux-arm64-gnu` |
| Linux glibc | x64          | `@leonsilicon/napi-poppler-linux-x64-gnu`   |
| Windows     | x64          | `@leonsilicon/napi-poppler-win32-x64-msvc`  |

GitHub Actions builds and tests each target natively. Linux uses the standard
system C/C++ runtime (Ubuntu 22.04 for x64, Ubuntu 24.04 for ARM64); Windows
uses the standard MSVC runtime. macOS builds target macOS 11+ on Apple Silicon. Intel macOS, musl, Windows
ARM64, 32-bit platforms, and browsers are not configured.

## Development and validation

Install Vite+, Rust 1.92+, a C++ compiler, Git, Python 3, and the native build
prerequisites. Linux: `autoconf autoconf-archive automake libtool pkg-config ninja-build`.
macOS: Xcode command-line tools and Homebrew
`autoconf autoconf-archive automake libtool pkg-config ninja`. Windows: Visual Studio C++ tools.
vcpkg provisions CMake/Meson and pins/checksums the remaining dependencies.

```sh
vp install
vp run build:deps
vp run build
vp check
vp test
vp run test:upstream
cargo fmt --check
cargo clippy --release -- -D warnings
node scripts/audit-all.mjs darwin-arm64 # substitute your platform suffix
node scripts/stage-platform.mjs darwin-arm64
vp run test:package darwin-arm64
```

The first native build takes several minutes. Subsequent runs use vcpkg's
binary cache. `native/ports/poppler` enables/stages the utilities from the
pinned vcpkg port; `.cargo/config.toml` forces static linking against those
dependencies. CI audits every executable and the addon for external libraries.

The [entire upstream Jest suite](tests/upstream/README.md) is pinned at
node-poppler 11.0.0, commit `43a97d7c5e8cf3c06189fd889989c16bdb9f7e1a`.
Hashes protect all fixtures and tests. The reviewed adaptation changes only
module loading and the process mock seam for ESM; every assertion and version condition
is retained. The suite runs again against clean packed npm installations,
with ESM checks that remove PATH and type-check both ESM and CommonJS consumers.
Additional tests cover native inspection, input ownership, large concurrent pipes, cancellation,
missing executables, binary output, and Unicode paths.

## Releases

CI uploads platform artifacts and complete npm tarballs on main and PRs.
Publishing happens only on a `v<version>` tag matching both package.json and
Cargo.toml. Platform packages publish before the main package, using npm
trusted publishing with GitHub OIDC through the `npm` environment.

Before the first automated release, create all five npm packages with an
authorized initial publication, then register their trusted publishers:

```sh
npm login
vp run setup:trusted-publishing --dry-run
vp run setup:trusted-publishing
```

The publisher configuration is in `.github/npm-trusted-publisher.json`.
No release tag or npm publication is needed for local development and CI.

## License

GPL-3.0-or-later. See [LICENSE](LICENSE) and
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Platform packages contain
the license notices for their bundled native dependencies.
