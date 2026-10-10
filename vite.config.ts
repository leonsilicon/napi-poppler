import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: { "*": "vp check --fix" },
  test: { include: ["tests/*.test.ts"], testTimeout: 30000 },
  pack: [
    {
      entry: ["src/index.ts"],
      format: ["esm", "cjs"],
      fixedExtension: false,
      deps: { neverBundle: [/compat\/index\.cjs$/] },
      dts: { tsgo: {} },
      exports: false,
    },
    {
      entry: ["src/helpers.ts"],
      format: "cjs",
      fixedExtension: false,
      deps: { alwaysBundle: [/.*/], onlyBundle: false, onlyImport: [] },
      dts: { tsgo: {} },
      exports: false,
    },
    {
      entry: ["scripts/publish-release.mjs"],
      outDir: ".ci",
      format: "esm",
      fixedExtension: false,
      deps: { alwaysBundle: [/.*/], onlyBundle: false, onlyImport: [] },
      dts: false,
      exports: false,
    },
  ],
  lint: {
    ignorePatterns: [
      "binding/**",
      "compat/index.cjs",
      "compat/options/**",
      "tests/upstream/**",
      ".upstream-tests/**",
      ".native/**",
      "dist/**",
      "npm/**",
      "artifacts/**",
      "target/**",
    ],
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {
    ignorePatterns: [
      "binding/**",
      "compat/index.cjs",
      "compat/options/**",
      "tests/upstream/**",
      ".upstream-tests/**",
      ".native/**",
      "dist/**",
      "npm/**",
      "artifacts/**",
      "target/**",
    ],
  },
});
