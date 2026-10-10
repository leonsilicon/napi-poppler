import { execaSync } from "execa";
import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export const root = fileURLToPath(new URL("../", import.meta.url));
export function packageFiles(directory, prefix) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const name = `${prefix}/${entry.name}`;
    return entry.isDirectory() ? packageFiles(resolve(directory, entry.name), name) : [name];
  });
}
export function npm(args, cwd = root, capture = false) {
  return execaSync("npm", args, {
    cwd,
    stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
  }).stdout;
}
