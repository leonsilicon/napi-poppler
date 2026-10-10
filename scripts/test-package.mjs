import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  const installed = resolve(directory, "node_modules/napi-poppler");
  assert.deepEqual(
    JSON.parse(readFileSync(resolve(installed, "package.json"), "utf8")).dependencies ?? {},
    {},
  );
  const env = {
    ...process.env,
    LD_LIBRARY_PATH: "",
    DYLD_LIBRARY_PATH: "",
    NAPI_RS_NATIVE_LIBRARY_PATH: "",
  };
  runUpstreamTests(installed, env);
  const fixture = resolve(root, "tests/upstream/fixtures/pdf_1.3_NHS_Constitution.pdf");
  const consumer = `import Poppler, { type PdfToTextOptions, type PopplerExtraOptions } from "napi-poppler";
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
  const typeFiles = ["consumer.mts", "consumer.cts"].map((name) => {
    const path = resolve(directory, name);
    writeFileSync(path, consumer);
    return path;
  });
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
      ...typeFiles,
    ],
    { cwd: root, stdio: "inherit" },
  );
  for (const esm of [true, false]) {
    // No PATH means neither system Poppler nor build tools can be discovered.
    const code = `${esm ? 'import Poppler, { Poppler as Named } from "napi-poppler";' : 'const { default: Poppler, Poppler: Named } = require("napi-poppler");'}
      if (Poppler !== Named) throw Error("Mismatched exports");
      const poppler = new Poppler();
      poppler.pdfInfo(${JSON.stringify(fixture)}, { printAsJson: true }).then(info => {
        if (info.pages !== "16") throw Error("Invalid PDF metadata");
        if (!poppler.path.includes("napi-poppler-${suffix}")) throw Error("System utilities were used");
      });
      poppler.pdfToText(Buffer.from(${JSON.stringify(cjkPdf().toString("base64"))}, "base64")).then(text => {
        if (text !== "日本") throw Error("Packaged CMap data was not loaded");
      });`;
    execaSync(process.execPath, [...(esm ? ["--input-type=module"] : []), "-e", code], {
      cwd: directory,
      stdio: "inherit",
      env: { ...env, PATH: "" },
    });
  }
} finally {
  rmSync(directory, { recursive: true, force: true });
}
