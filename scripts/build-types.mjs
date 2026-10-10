import { cpSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { execaSync } from "execa";
import { root } from "./package-utils.mjs";

execaSync("vp", ["exec", "tsc", "--project", "tsconfig.compat.json"], {
  cwd: root,
  stdio: "inherit",
});
for (const name of readdirSync(resolve(root, ".types"))) {
  if (name === "options" || name.endsWith(".d.cts"))
    cpSync(resolve(root, ".types", name), resolve(root, "compat", name), { recursive: true });
}
