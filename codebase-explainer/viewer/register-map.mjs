// Register a PCE map for the viewer.
// Usage: node register-map.mjs <path-to-map.json> [--name <alias>]
// Copies the file to maps/<hash>.json, updates registry.json, prints the URL.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const [,, src, ...rest] = process.argv;
if (!src) { console.error("usage: node register-map.mjs <map.json> [--name alias]"); process.exit(1); }
const nameIdx = rest.indexOf("--name");
const alias = nameIdx >= 0 ? rest[nameIdx + 1] : null;

const raw = await readFile(src, "utf8");
let doc;
try { doc = JSON.parse(raw); } catch (e) { console.error("invalid JSON:", e.message); process.exit(1); }
// minimal contract lint
const problems = [];
if (doc.protocol_version !== "0.4") problems.push("protocol_version must be '0.4'");
if (!doc.meta?.commit_hash) problems.push("meta.commit_hash missing (maps are ephemeral — stamp them)");
for (const n of doc.nodes || []) {
  if (!n.resolution) problems.push(`node ${n.id}: no resolution (perimeter closure violated)`);
  if ((n.resolution === "suspected" || n.resolution === "dismissed") && !n.evidence)
    problems.push(`node ${n.id}: ${n.resolution} without evidence (contract §2)`);
}
if (problems.length) { console.error("CONTRACT LINT FAILED:\n - " + problems.join("\n - ")); process.exit(2); }

const hash = createHash("sha1").update(raw).digest("hex").slice(0, 12);
await mkdir(join(ROOT, "maps"), { recursive: true });
await writeFile(join(ROOT, "maps", `${hash}.json`), raw);
if (alias) await writeFile(join(ROOT, "maps", `${alias}.json`), raw);

let registry = [];
try { registry = JSON.parse(await readFile(join(ROOT, "registry.json"), "utf8")); } catch {}
registry.unshift({ hash, alias, title: doc.meta?.title, intent: doc.meta?.intent, commit: doc.meta?.commit_hash, registered_at: new Date().toISOString(), source: src });
await writeFile(join(ROOT, "registry.json"), JSON.stringify(registry, null, 2));

console.log(`registered: ${hash}${alias ? ` (alias: ${alias})` : ""}`);
console.log(`open: http://localhost:4173/?map=${alias || hash}`);
