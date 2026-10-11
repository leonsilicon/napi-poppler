import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { execaSync } from "execa";
import { npm, root } from "./package-utils.mjs";
import { runUpstreamTests } from "./upstream-tests.mjs";
import { cjkPdf } from "../tests/fixtures.mjs";

const suffix =
  process.argv[2] ??
  (process.platform === "linux"
    ? `linux-${process.arch}-gnu`
    : process.platform === "win32"
      ? `win32-${process.arch}-msvc`
      : `darwin-${process.arch}`);
const directory = mkdtempSync(resolve(tmpdir(), "napi-poppler-install-"));
try {
  const pack = (cwd) =>
    resolve(
      directory,
      JSON.parse(
        npm(["pack", "--ignore-scripts", "--json", "--pack-destination", directory], cwd, true),
      )[0].filename,
    );
  const platformPackage = pack(resolve(root, "npm", suffix));
  const rootPackage = pack(root);
  writeFileSync(resolve(directory, "package.json"), '{"private":true,"type":"module"}');
  npm(
    ["install", "--ignore-scripts", "--no-audit", "--no-fund", rootPackage, platformPackage],
    directory,
  );
  const installed = resolve(directory, "node_modules/@leonsilicon/napi-poppler");
  const manifest = JSON.parse(readFileSync(resolve(installed, "package.json"), "utf8"));
  assert.deepEqual(manifest.dependencies ?? {}, {});
  assert.deepEqual(manifest.exports["."], {
    import: { types: "./dist/index.d.ts", default: "./dist/index.js" },
  });
  for (const name of ["index.cjs", "index.d.cts"])
    assert.equal(existsSync(resolve(installed, "dist", name)), false, `${name} must not ship`);
  const env = {
    ...process.env,
    LD_LIBRARY_PATH: "",
    DYLD_LIBRARY_PATH: "",
    NAPI_RS_NATIVE_LIBRARY_PATH: "",
  };
  runUpstreamTests(installed, env);
  const fixture = resolve(root, "tests/upstream/fixtures/pdf_1.3_NHS_Constitution.pdf");
  const consumer = `import Poppler, { type PdfToTextOptions, type PopplerExtraOptions } from "@leonsilicon/napi-poppler";
    const poppler: Poppler = new Poppler();
    const options: PdfToTextOptions = { maintainLayout: true, removeHyphens: "soft" };
    const extras: PopplerExtraOptions = { signal: new AbortController().signal };
    const text: Promise<string> = poppler.pdfToText("input.pdf", undefined, options, extras);
    const info: Promise<string | Record<string, string>> = poppler.pdfInfo("input.pdf", { printAsJson: true });
    poppler.pdfAttach("input.pdf", "file.txt", "attached.pdf");
    poppler.pdfDetach("input.pdf", { listEmbedded: true });
    poppler.pdfFonts(Buffer.alloc(0));
    poppler.pdfImages("input.pdf", "image");
    poppler.pdfSeparate("input.pdf", "page-%d.pdf");
    poppler.pdfToCairo("input.pdf", undefined, { singleFile: true, pngFile: true });
    poppler.pdfToHtml(Buffer.alloc(0), "output.html");
    poppler.pdfToPpm("input.pdf", "image");
    poppler.pdfToPs("input.pdf");
    poppler.pdfUnite(["first.pdf", "second.pdf"], "output.pdf");
    void text; void info;`;
  const typeFile = resolve(directory, "consumer.mts");
  writeFileSync(typeFile, consumer);
  execaSync(
    "vp",
    [
      "exec",
      "tsc",
      "--ignoreConfig",
      "--noEmit",
      "--strict",
      "--module",
      "nodenext",
      "--target",
      "esnext",
      "--typeRoots",
      resolve(root, "node_modules/@types"),
      "--types",
      "node",
      typeFile,
    ],
    { cwd: root, stdio: "inherit" },
  );
  // No PATH means neither system Poppler nor build tools can be discovered.
  const code = `import Poppler, { Poppler as Named } from "@leonsilicon/napi-poppler";
    import assert from "node:assert/strict";
    import { createRequire } from "node:module";
    const require = createRequire(import.meta.url);
    assert.throws(() => require("@leonsilicon/napi-poppler"), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
    assert.throws(() => require("@leonsilicon/napi-poppler/dist/index.js"), { code: "ERR_PACKAGE_PATH_NOT_EXPORTED" });
    assert.equal(Poppler, Named);
    const poppler = new Poppler();
    const info = await poppler.pdfInfo(${JSON.stringify(fixture)}, { printAsJson: true });
    assert.equal(info.pages, "16");
    assert.ok(poppler.path.includes("napi-poppler-${suffix}"), "System utilities were used");
    const text = await poppler.pdfToText(Buffer.from(${JSON.stringify(cjkPdf().toString("base64"))}, "base64"));
    assert.equal(text, "日本", "Packaged CMap data was not loaded");`;
  execaSync(process.execPath, ["--input-type=module", "-e", code], {
    cwd: directory,
    stdio: "inherit",
    env: { ...env, PATH: "" },
  });
} finally {
  rmSync(directory, { recursive: true, force: true });
}
