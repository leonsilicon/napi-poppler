import { cpSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import { execaSync } from "execa";
import { root } from "./package-utils.mjs";

rmSync(resolve(root, ".types"), { recursive: true, force: true });
execaSync("vp", ["exec", "tsc", "--project", "tsconfig.compat.json"], {
  cwd: root,
  stdio: "inherit",
});
for (const name of readdirSync(resolve(root, ".types"))) {
  if (name === "options" || name.endsWith(".d.ts"))
    cpSync(resolve(root, ".types", name), resolve(root, "compat", name), { recursive: true });
}
