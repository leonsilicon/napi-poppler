import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// Load synchronously so Node's CommonJS loader can consume this ESM graph.
// Node does not support importing .node addons through ESM import statements.
function loadBinding() {
  if (process.env.NAPI_RS_NATIVE_LIBRARY_PATH)
    return loadAddon(resolve(process.env.NAPI_RS_NATIVE_LIBRARY_PATH));
  const targets = {
    "darwin-arm64": "darwin-arm64",
    "linux-arm64": "linux-arm64-gnu",
    "linux-x64": "linux-x64-gnu",
    "win32-x64": "win32-x64-msvc",
  };
  const suffix = targets[`${process.platform}-${process.arch}`];
  if (!suffix)
    throw new Error(`Unsupported Poppler platform: ${process.platform}-${process.arch}`);
  const filename = `napi-poppler.${suffix}.node`;
  const local = fileURLToPath(new URL(filename, import.meta.url));
  if (existsSync(local)) return loadAddon(local);
  try {
    const manifestPath = fileURLToPath(
      import.meta.resolve(`@leonsilicon/napi-poppler-${suffix}/package.json`),
    );
    if (
      process.env.NAPI_RS_ENFORCE_VERSION_CHECK &&
      process.env.NAPI_RS_ENFORCE_VERSION_CHECK !== "0"
    ) {
      const actual = JSON.parse(readFileSync(manifestPath, "utf8")).version;
      const expected = JSON.parse(
        readFileSync(new URL("../package.json", import.meta.url), "utf8"),
      ).version;
      if (actual !== expected)
        throw new Error(
          `Native binding package version mismatch, expected ${expected} but got ${actual}`,
        );
    }
    return loadAddon(join(dirname(manifestPath), filename));
  } catch (cause) {
    throw new Error(
      "Cannot load bundled Poppler native binding; install with npm optional dependencies enabled.",
      { cause },
    );
  }
}

function loadAddon(filename) {
  const nativeModule = { exports: {} };
  process.dlopen(nativeModule, filename);
  return nativeModule.exports;
}

const native = loadBinding();
export const { NativeProcess, inspectDocument, libraryVersion, runSync } = native;
