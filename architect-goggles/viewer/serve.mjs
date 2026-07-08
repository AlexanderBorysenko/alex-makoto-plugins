// PCE viewer server. Usage: node serve.mjs [port]
// Serves the viewer + registered maps. Maps live in ./maps/<hash>.json (see register-map.mjs).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.argv[2] || 4173);
const MIME = { ".html":"text/html; charset=utf-8", ".json":"application/json", ".js":"text/javascript", ".mjs":"text/javascript", ".css":"text/css", ".svg":"image/svg+xml" };

// resolve a repo-relative path under a source_root, refusing to escape the root
function within(root, rel) {
  if (!root) return null;
  const base = resolve(root), abs = resolve(base, rel);
  return (abs === base || abs.startsWith(base + sep)) ? abs : null;
}
const jsonHead = { "content-type": "application/json", "cache-control": "no-store" };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    // live source preview: /source?root=<abs>&ref=<file:lineStart-lineEnd>
    if (url.pathname === "/source") {
      const root = url.searchParams.get("root") || "";
      const ref = url.searchParams.get("ref") || "";
      const m = /^(.*?):(\d+)(?:-(\d+))?$/.exec(ref);
      if (!m) { res.writeHead(400, jsonHead); return res.end('{"error":"bad ref"}'); }
      const abs = within(root, m[1]);
      if (!abs) { res.writeHead(403, jsonHead); return res.end('{"error":"outside root"}'); }
      const s = +m[2], e = m[3] ? +m[3] : s, CTX = 3;
      try {
        const all = (await readFile(abs, "utf8")).split(/\r?\n/);
        const start = Math.max(1, s - CTX), end = Math.min(all.length, e + CTX);
        res.writeHead(200, jsonHead);
        return res.end(JSON.stringify({ path: m[1], start, end, hlStart: s, hlEnd: e, lines: all.slice(start - 1, end) }));
      } catch { res.writeHead(404, jsonHead); return res.end('{"error":"read failed"}'); }
    }

    // map by direct file path (no registry): /mapfile?path=<abs-path-to-map.json>
    // Primary flow: one canonical map file per task lives in the project's
    // .claude-memory/maps/; the viewer reads it live, so editing the file +
    // refreshing the browser is the whole update loop.
    if (url.pathname === "/mapfile") {
      const p = url.searchParams.get("path") || "";
      if (!p.toLowerCase().endsWith(".json")) { res.writeHead(400, jsonHead); return res.end('{"error":"path must be a .json file"}'); }
      try {
        const body = await readFile(resolve(p), "utf8");
        JSON.parse(body); // reject non-JSON early with a clear error
        res.writeHead(200, jsonHead);
        return res.end(body);
      } catch (e) {
        res.writeHead(404, jsonHead);
        return res.end(JSON.stringify({ error: `cannot read map: ${e.message}` }));
      }
    }

    // launch editor at file:line: /open?root=<abs>&file=<rel>&line=<n>
    if (url.pathname === "/open") {
      const abs = within(url.searchParams.get("root") || "", url.searchParams.get("file") || "");
      const line = parseInt(url.searchParams.get("line") || "1", 10) || 1;
      if (!abs) { res.writeHead(403, jsonHead); return res.end('{"error":"outside root"}'); }
      const editor = process.env.PCE_EDITOR || "code";
      try {
        // shell:true so `code`/`code.cmd` resolves on Windows; quote target for paths with spaces
        const child = spawn(editor, ["-g", `"${abs}:${line}"`], { shell: true, stdio: "ignore", detached: true });
        child.on("error", () => {});   // don't crash the server if the editor is missing
        child.unref();
        res.writeHead(200, jsonHead); return res.end(JSON.stringify({ ok: true, opened: `${abs}:${line}` }));
      } catch { res.writeHead(500, jsonHead); return res.end('{"error":"spawn failed"}'); }
    }

    let p = url.pathname === "/" ? "/index.html" : url.pathname;
    const path = normalize(join(ROOT, p));
    if (!path.startsWith(ROOT)) { res.writeHead(403); return res.end("forbidden"); }
    const body = await readFile(path);
    res.writeHead(200, { "content-type": MIME[extname(path)] || "application/octet-stream", "cache-control": "no-store" });
    res.end(body);
  } catch {
    res.writeHead(404); res.end("not found");
  }
}).listen(PORT, () => console.log(`PCE viewer: http://localhost:${PORT}  (map: /?map=<hash>, example: /?map=example)`));
