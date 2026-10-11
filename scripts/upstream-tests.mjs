import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { applyPatch } from "diff";
import { execaSync } from "execa";
import { root } from "./package-utils.mjs";
import { adaptUpstreamToEsm } from "./upstream-esm.mjs";

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
  // Only ESM module loading and mocking may change. Assertions, test
  // conditions, and fixtures remain protected by this reviewed translation.
  assert.equal(patched, adaptUpstreamToEsm(original));
  const generated = resolve(root, ".upstream-tests");
  rmSync(generated, { recursive: true, force: true });
  mkdirSync(resolve(generated, "src"), { recursive: true });
  mkdirSync(resolve(generated, "test"), { recursive: true });
  cpSync(resolve(pristine, "fixtures"), resolve(generated, "test/fixtures"), { recursive: true });
  writeFileSync(resolve(generated, "test/index.test.js"), patched);
  // Test the real compatibility facade and adapter from either the checkout
  // or an npm tarball installed with --ignore-scripts in a clean directory.
  const facade = readFileSync(resolve(packageRoot, "compat/index.js"), "utf8").replace(
    '"../dist/helpers.js"',
    JSON.stringify(pathToFileURL(resolve(packageRoot, "dist/helpers.js")).href),
  );
  writeFileSync(resolve(generated, "src/index.js"), facade);
  cpSync(resolve(packageRoot, "compat/options"), resolve(generated, "src/options"), {
    recursive: true,
  });
  writeFileSync(
    resolve(generated, "src/process.js"),
    `export * from ${JSON.stringify(pathToFileURL(resolve(packageRoot, "compat/process.js")).href)};\n`,
  );
  const config = {
    rootDir: resolve(root),
    roots: [resolve(generated, "test")],
    testMatch: ["**/*.test.js"],
    transform: {},
    injectGlobals: false,
    testEnvironment: "node",
    testTimeout: 60000,
  };
  // A config file avoids shell escaping JSON and Windows path separators.
  writeFileSync(resolve(generated, "jest.config.json"), JSON.stringify(config));
  execaSync(
    process.execPath,
    [
      "--experimental-vm-modules",
      resolve(root, "node_modules/jest/bin/jest.js"),
      "--runInBand",
      "--config",
      ".upstream-tests/jest.config.json",
    ],
    {
      cwd: root,
      stdio: "inherit",
      env,
    },
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  runUpstreamTests();
