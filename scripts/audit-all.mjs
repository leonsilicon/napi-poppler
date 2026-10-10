import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { execaSync } from "execa";
import { root } from "./package-utils.mjs";

const suffix = process.argv[2];
const binaries = [
  resolve(root, "binding", `napi-poppler.${suffix}.node`),
  ...readdirSync(resolve(root, "binding/bin")).map((name) => resolve(root, "binding/bin", name)),
];
for (const binary of binaries)
  execaSync(process.execPath, [resolve(root, "scripts/audit-linkage.mjs"), binary], {
    cwd: root,
    stdio: "inherit",
  });
