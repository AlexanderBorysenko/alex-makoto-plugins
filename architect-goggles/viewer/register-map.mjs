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
// contract lint (spec/lint.mjs): perimeter closure, evidence, flow well-formedness,
// deterministic-metric recompute, hotspot eligibility. Registration IS validation.
const { lintMap } = await import(new URL("../spec/lint.mjs", import.meta.url));
const { errors, warnings } = lintMap(doc);
if (warnings.length) console.warn("LINT WARNINGS:\n - " + warnings.join("\n - "));
if (errors.length) { console.error("CONTRACT LINT FAILED:\n - " + errors.join("\n - ")); process.exit(2); }

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
