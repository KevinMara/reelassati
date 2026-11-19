import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
const [file] = process.argv.slice(2);
if (!file) throw Error("Supply cargo metadata for the pinned WASM build");
const metadata = JSON.parse(await fs.readFile(file, "utf8")),
  nodes = new Map(metadata.resolve.nodes.map(n => [n.id, n])),
  packages = new Map(metadata.packages.map(p => [p.id, p]));
const used = new Set(),
  visit = id => {
    if (used.has(id)) return;
    used.add(id);
    for (const dep of nodes.get(id)?.deps ?? [])
      if (dep.dep_kinds.some(k => k.kind !== "dev")) visit(dep.pkg);
  };
visit(metadata.resolve.root);
const output = "public/vendor/native-graphics/licenses/dependencies";
await fs.mkdir(output, { recursive: true });
const index = [];
const remoteCache = new Map();
for (const id of [...used].sort()) {
  const p = packages.get(id);
  if (p.name === "reel-native-compositor") continue;
  const base = path.dirname(p.manifest_path),
    candidates = (await fs.readdir(base, { withFileTypes: true }))
      .filter(
        x =>
          x.isFile() &&
          /^(license|licence|copying|copyright|notice)([._-]|$)/i.test(x.name)
      )
      .map(x => path.join(base, x.name));
  if (p.license_file) candidates.push(path.resolve(base, p.license_file));
  if (
    !candidates.length &&
    (p.name.startsWith("effectcraft-") || p.name.startsWith("craft-"))
  )
    candidates.push(
      path.resolve(base, "../../LICENSE-MIT"),
      path.resolve(base, "../../LICENSE-APACHE")
    );
  if (!candidates.length && process.argv.includes("--download")) {
    const vcs = JSON.parse(
        await fs.readFile(path.join(base, ".cargo_vcs_info.json"), "utf8")
      ),
      commit = vcs.git?.sha1;
    const repo = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+)\/?$/.exec(
      p.repository ?? ""
    )?.[1];
    if (!repo || !/^\w{40}$/.test(commit ?? ""))
      throw Error("Unverified license source: " + p.name);
    const key = `${repo}/${commit}`;
    if (!remoteCache.has(key)) {
      const headers = {
        "User-Agent": "REELASSATI-license-bundler",
        Accept: "application/vnd.github+json",
      };
      const response = await fetch(
        `https://api.github.com/repos/${repo}/git/trees/${commit}`,
        { headers, signal: AbortSignal.timeout(30000) }
      );
      if (!response.ok)
        throw Error("License source unavailable: " + response.status);
      const tree = await response.json(),
        files = tree.tree.filter(
          x =>
            x.type === "blob" &&
            /^(license|licence|copying|copyright|notice)([._-]|$)/i.test(x.path)
        );
      const cache = path.resolve(
        "verification-assets/reel-nov19/license-sources",
        commit
      );
      await fs.mkdir(cache, { recursive: true });
      const paths = [];
      for (const item of files) {
        const r = await fetch(
          `https://raw.githubusercontent.com/${repo}/${commit}/${item.path}`,
          { signal: AbortSignal.timeout(30000) }
        );
        if (!r.ok) throw Error("License download failed");
        const bytes = new Uint8Array(await r.arrayBuffer());
        if (bytes.length > 1_000_000) throw Error("License too large");
        const dest = path.join(cache, path.basename(item.path));
        await fs.writeFile(dest, bytes);
        paths.push(dest);
      }
      remoteCache.set(key, paths);
    }
    candidates.push(...remoteCache.get(key));
  }
  if (!candidates.length)
    throw Error("Missing dependency license files: " + p.name);
  const directory = `${p.name}-${p.version}`;
  if (!/^[a-zA-Z0-9._+-]+$/.test(directory)) throw Error("Unsafe package name");
  await fs.mkdir(path.join(output, directory), { recursive: true });
  const files = [];
  for (const candidate of [...new Set(candidates)]) {
    const data = await fs.readFile(candidate);
    if (data.length > 1_000_000) throw Error("License too large");
    const name = path.basename(candidate);
    await fs.writeFile(path.join(output, directory, name), data);
    files.push({
      file: `${directory}/${name}`,
      sha256: createHash("sha256").update(data).digest("hex"),
    });
  }
  index.push({ name: p.name, version: p.version, license: p.license, files });
}
await fs.writeFile(
  path.join(output, "index.json"),
  JSON.stringify(index, null, 2) + "\n"
);
console.log("Packaged dependency notices", index.length);
