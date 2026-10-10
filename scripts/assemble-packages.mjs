import { chmodSync, cpSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { NapiCli } from "@napi-rs/cli";
import { execaSync } from "execa";
import { root } from "./package-utils.mjs";

const artifacts = resolve(root, process.argv[2] ?? "artifacts");
const directories = readdirSync(artifacts).filter((name) => name.startsWith("native-"));
for (const name of ["index.cjs", "index.d.cts"]) {
  const expected = readFileSync(resolve(artifacts, directories[0], "binding", name));
  for (const directory of directories) {
    if (!expected.equals(readFileSync(resolve(artifacts, directory, "binding", name))))
      throw new Error(`${name} differs on ${directory}`);
  }
  cpSync(resolve(artifacts, directories[0], "binding", name), resolve(root, "binding", name));
}
const napi = new NapiCli();
await napi.createNpmDirs({ cwd: root });
await napi.artifacts({ cwd: root, outputDir: artifacts, npmDir: "npm" });
for (const directory of directories) {
  const suffix = directory.slice("native-".length);
  const target = resolve(root, "npm", suffix);
  cpSync(resolve(artifacts, directory, "binding/bin"), resolve(target, "bin"), { recursive: true });
  // GitHub ZIP artifacts reset file modes to 0644; restore executable bits
  // before creating npm tarballs for macOS and Linux.
  for (const name of readdirSync(resolve(target, "bin")))
    chmodSync(resolve(target, "bin", name), 0o755);
  cpSync(resolve(artifacts, directory, "binding/share"), resolve(target, "share"), {
    recursive: true,
  });
  cpSync(resolve(artifacts, directory, "platform-licenses"), resolve(target, "licenses"), {
    recursive: true,
  });
  const path = resolve(target, "package.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  manifest.files = [
    `napi-poppler.${suffix}.node`,
    ...["bin", "licenses", "share"].flatMap((dir) =>
      readdirSync(resolve(target, dir)).map((name) => `${dir}/${name}`),
    ),
  ];
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`);
}
await napi.prePublish({
  cwd: root,
  skipOptionalPublish: true,
  ghRelease: false,
  rootPublisher: "npm",
});
execaSync("vp", ["run", "build:js"], { cwd: root, stdio: "inherit" });
