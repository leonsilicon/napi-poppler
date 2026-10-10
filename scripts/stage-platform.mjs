import { cpSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { NapiCli } from "@napi-rs/cli";
import { root } from "./package-utils.mjs";

export const triplets = {
  "darwin-arm64": "arm64-osx",
  "linux-arm64-gnu": "arm64-linux",
  "linux-x64-gnu": "x64-linux",
  "win32-x64-msvc": "x64-windows-static-md",
};
const suffix = process.argv[2];
if (!triplets[suffix]) throw new Error(`Unknown platform: ${suffix}`);
await new NapiCli().createNpmDirs({ cwd: root });
const target = resolve(root, "npm", suffix);
const prefix = resolve(root, ".native/vcpkg/installed", triplets[suffix]);
const filename = `napi-poppler.${suffix}.node`;
cpSync(resolve(root, "binding", filename), resolve(target, filename));
cpSync(resolve(root, "binding/bin"), resolve(target, "bin"), { recursive: true });
cpSync(resolve(root, "binding/share"), resolve(target, "share"), { recursive: true });
const licenses = resolve(root, "platform-licenses");
mkdirSync(licenses, { recursive: true });
for (const port of readdirSync(resolve(prefix, "share"))) {
  try {
    cpSync(resolve(prefix, "share", port, "copyright"), resolve(licenses, `${port}.txt`));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}
cpSync(resolve(root, "licenses"), licenses, { recursive: true });
for (const name of ["LICENSE", "THIRD_PARTY_NOTICES.md"])
  cpSync(resolve(root, name), resolve(licenses, name));
cpSync(licenses, resolve(target, "licenses"), { recursive: true });
const path = resolve(target, "package.json");
const manifest = JSON.parse(readFileSync(path, "utf8"));
manifest.files = [
  filename,
  ...["bin", "licenses", "share"].flatMap((dir) =>
    readdirSync(resolve(target, dir)).map((name) => `${dir}/${name}`),
  ),
];
writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
