import { createBuildCommand, NapiCli } from "@napi-rs/cli";
import { root } from "./package-utils.mjs";
import { cpSync, existsSync, readdirSync, rmSync } from "node:fs";
import { resolve } from "node:path";
const options = createBuildCommand([
  "--platform",
  "--release",
  "--output-dir",
  "binding",
  "--no-js",
  "--dts",
  "index.d.ts",
  ...process.argv.slice(2),
]).getOptions();
const { task } = await new NapiCli().build({ ...options, cwd: root });
await task;
const triplets = {
  "darwin-arm64": "arm64-osx",
  "linux-arm64": "arm64-linux",
  "linux-x64": "x64-linux",
  "win32-x64": "x64-windows-static-md",
};
const triplet = triplets[`${process.platform}-${process.arch}`];
const tools = resolve(root, ".native/vcpkg/installed", triplet, "tools/poppler");
if (!existsSync(tools)) throw new Error("Build bundled Poppler utilities first: vp run build:deps");
rmSync(resolve(root, "binding/bin"), { recursive: true, force: true });
rmSync(resolve(root, "binding/share"), { recursive: true, force: true });
cpSync(tools, resolve(root, "binding/bin"), { recursive: true });
for (const name of readdirSync(resolve(root, "binding/bin"))) {
  if (name.toLowerCase().endsWith(".pdb")) rmSync(resolve(root, "binding/bin", name));
}
cpSync(
  resolve(root, ".native/vcpkg/installed", triplet, "share/poppler"),
  resolve(root, "binding/share/poppler"),
  { recursive: true },
);
cpSync(resolve(root, "native/fonts.conf"), resolve(root, "binding/share/fonts.conf"));
