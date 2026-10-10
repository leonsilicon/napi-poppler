import { readFileSync, mkdtempSync, cpSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { afterEach, describe, expect, it } from "vite-plus/test";
import Poppler, { Poppler as NamedPoppler, type PdfToTextOptions } from "../src/index.ts";
import { inspectDocument, libraryVersion, NativeProcess } from "../binding/index.cjs";
import { cjkPdf } from "./fixtures.mjs";

const require = createRequire(import.meta.url);
const { spawn } = require("../compat/process.cjs");
const fixture = resolve(import.meta.dirname, "upstream/fixtures/pdf_1.3_NHS_Constitution.pdf");
const folders: string[] = [];

afterEach(() => {
  for (const folder of folders.splice(0)) rmSync(folder, { recursive: true, force: true });
});

describe("native backend and distribution", () => {
  it("preserves the constructor, types, and all 12 methods", () => {
    expect(Poppler).toBe(NamedPoppler);
    const poppler: Poppler = new Poppler();
    expect(Object.getOwnPropertyNames(Poppler.prototype).sort()).toEqual(
      [
        "constructor",
        "path",
        "pdfAttach",
        "pdfDetach",
        "pdfFonts",
        "pdfImages",
        "pdfInfo",
        "pdfSeparate",
        "pdfToCairo",
        "pdfToHtml",
        "pdfToPpm",
        "pdfToPs",
        "pdfToText",
        "pdfUnite",
      ].sort(),
    );
    expect(poppler.path).toContain("binding");
    const options: PdfToTextOptions = { firstPageToConvert: 1, lastPageToConvert: 1 };
    expect(options.firstPageToConvert).toBe(1);
  });

  it("uses real poppler-rs on workers and copies input before scheduling", async () => {
    expect(libraryVersion()).toMatch(/^\d+\.\d+\.\d+$/u);
    const bytes = readFileSync(fixture);
    const result = inspectDocument(bytes);
    bytes.fill(0);
    const info = await result;
    expect(info.pages).toBe(16);
    expect(info.text).toContain("The NHS Constitution");
    await expect(inspectDocument(Buffer.from("not a PDF"))).rejects.toThrow();
  });

  it("retains binary stdout as a Latin-1 string, as node-poppler does", async () => {
    const output = await new Poppler().pdfToCairo(readFileSync(fixture), undefined, {
      pngFile: true,
      singleFile: true,
      firstPageToConvert: 1,
      lastPageToConvert: 1,
      resolutionXYAxis: 30,
    });
    expect(Buffer.from(output, "latin1").subarray(0, 8)).toEqual(
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    );
  });

  it("drains stdout and stderr while piping multi-megabyte input without deadlocking", async () => {
    const input = Buffer.alloc(2 * 1024 * 1024, 0xff);
    const code =
      "process.stderr.write(Buffer.alloc(1024 * 1024, 0xfe)); process.stdin.pipe(process.stdout)";
    const processes = Array.from(
      { length: 8 },
      () => new NativeProcess(process.execPath, ["-e", code], true),
    );
    const results = await Promise.all(processes.map((child) => child.run(input)));
    for (const result of results) {
      expect(result.code).toBe(0);
      expect(result.stdout.equals(input)).toBe(true);
      expect(result.stderr.equals(Buffer.alloc(1024 * 1024, 0xfe))).toBe(true);
    }
  });

  it("kills and reaps a cancelled native child", async () => {
    const child = new NativeProcess(process.execPath, ["-e", "setInterval(() => {}, 1000)"], false);
    const result = child.run();
    child.cancel();
    await result;
    expect(() => process.kill(child.pid, 0)).toThrow();
  });

  it("rejects an invalid executable without hanging streams", async () => {
    const { once } = await import("node:events");
    const child = spawn(resolve(tmpdir(), "napi-poppler-nonexistent"), [], {});
    await expect(once(child, "close")).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("supports Unicode and spaces in file paths", async () => {
    const folder = mkdtempSync(resolve(tmpdir(), "napi-poppler-"));
    folders.push(folder);
    const path = resolve(folder, "测试 document.pdf");
    cpSync(fixture, path);
    await expect(new Poppler().pdfInfo(path, { printAsJson: true })).resolves.toMatchObject({
      pages: "16",
    });
  });

  it("decodes CJK PDFs using the packaged encoding data", async () => {
    await expect(new Poppler().pdfToText(cjkPdf())).resolves.toBe("日本");
    await expect(
      new Poppler().pdfToText(fixture, undefined, { listEncodingOptions: true }),
    ).resolves.toContain("Shift-JIS");
  });
});
