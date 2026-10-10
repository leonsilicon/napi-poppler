import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { applyPatch } from "diff";
import { execaSync } from "execa";
import { root } from "./package-utils.mjs";

export function runUpstreamTests(packageRoot = root, env = process.env) {
  const pristine = resolve(root, "tests/upstream");
  const manifest = JSON.parse(readFileSync(resolve(pristine, "manifest.json"), "utf8"));
  for (const [file, hash] of Object.entries(manifest.files)) {
    assert.equal(
      createHash("sha256")
        .update(readFileSync(resolve(pristine, file)))
        .digest("hex"),
      hash,
      `Upstream fixture changed: ${file}`,
    );
  }
  const original = readFileSync(resolve(pristine, "index.test.cjs"), "utf8");
  const patched = applyPatch(
    original,
    readFileSync(resolve(root, "patches/upstream-tests.diff"), "utf8"),
  );
  assert.ok(patched, "Upstream adaptation patch must apply cleanly");
  // Only the subject and process mock seam may change. No assertions, test
  // conditions, or fixtures may be altered, removed, skipped, or replaced.
  assert.equal(
    patched,
    original
      .replaceAll('"../src/index"', '"../src/index.cjs"')
      .replace(
        /(require|jest\.requireActual|jest\.doMock)\("node:child_process"/gu,
        '$1("../src/process.cjs"',
      ),
  );
  const generated = resolve(root, ".upstream-tests");
  rmSync(generated, { recursive: true, force: true });
  mkdirSync(resolve(generated, "src"), { recursive: true });
  mkdirSync(resolve(generated, "test"), { recursive: true });
  cpSync(resolve(pristine, "fixtures"), resolve(generated, "test/fixtures"), { recursive: true });
  writeFileSync(resolve(generated, "test/index.test.cjs"), patched);
  // Test the real compatibility facade and adapter from either the checkout
  // or an npm tarball installed with --ignore-scripts in a clean directory.
  const facade = readFileSync(resolve(packageRoot, "compat/index.cjs"), "utf8").replace(
    'require("../dist/helpers.cjs")',
    `require(${JSON.stringify(resolve(packageRoot, "dist/helpers.cjs"))})`,
  );
  writeFileSync(resolve(generated, "src/index.cjs"), facade);
  cpSync(resolve(packageRoot, "compat/options"), resolve(generated, "src/options"), {
    recursive: true,
  });
  writeFileSync(
    resolve(generated, "src/process.cjs"),
    `module.exports = require(${JSON.stringify(resolve(packageRoot, "compat/process.cjs"))});\n`,
  );
  const config = {
    rootDir: root,
    testMatch: ["<rootDir>/.upstream-tests/test/*.test.cjs"],
    injectGlobals: false,
    testEnvironment: "node",
    testTimeout: 60000,
  };
  execaSync("vp", ["exec", "jest", "--runInBand", "--config", JSON.stringify(config)], {
    cwd: root,
    stdio: "inherit",
    env,
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  runUpstreamTests();
