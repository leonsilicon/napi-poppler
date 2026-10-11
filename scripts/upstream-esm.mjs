// Translate module loading and mocking only. Assertions, conditions, and
// fixtures remain those of the pinned upstream suite.
export function adaptUpstreamToEsm(original) {
  return original
    .replace(
      /const\s+(\{[^;]*?\})\s*=\s*(?:require)\("([^"]+)"\);/gsu,
      (_match, bindings, name) => {
        if (bindings.includes(":"))
          return `const ${bindings} = await import(${JSON.stringify(name === "../src/index" ? "../src/index.js" : name)});`;
        return `import ${bindings} from ${JSON.stringify(name === "../src/index" ? "../src/index.js" : name === "node:child_process" ? "../src/process.js" : name)};`;
      },
    )
    .replace(/jest\.requireActual\("node:child_process"\)/gu, 'await import("../src/process.js")')
    .replace(/jest\.requireActual\("node:process"\)/gu, 'await import("node:process")')
    .replace(/jest\.doMock\("node:child_process"/gu, 'jest.unstable_mockModule("../src/process.js"')
    .replace(/jest\.doMock\("node:process"/gu, 'jest.unstable_mockModule("node:process"')
    .replace(/(?:require)\("node:child_process"\);/gu, 'await import("../src/process.js");')
    .replace(/(?:require)\("node-poppler-win32"\)/gu, "bundledPath()")
    .replace(
      'it("Throws an Error if the binary path is not found", () => {',
      'it("Throws an Error if the binary path is not found", async () => {',
    )
    .replaceAll(
      "jest.resetModules();",
      'jest.resetModules();\n\t\t\tjest.unstable_unmockModule("node:process");\n\t\t\tjest.unstable_unmockModule("../src/process.js");',
    )
    .replaceAll("__dirname", 'fileURLToPath(new URL(".", import.meta.url))')
    .replace(
      '"use strict";',
      'import { fileURLToPath } from "node:url";\nimport { bundledPath } from "../src/process.js";',
    );
}
