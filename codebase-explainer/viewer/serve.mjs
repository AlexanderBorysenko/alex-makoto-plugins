// PCE viewer server. Usage: node serve.mjs [port]
// Serves the viewer + registered maps. Maps live in ./maps/<hash>.json (see register-map.mjs).
import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = fileURLToPath(new URL(".", import.meta.url));
const PORT = Number(process.argv[2] || 4173);
const MIME = { ".html":"text/html; charset=utf-8", ".json":"application/json", ".js":"text/javascript", ".mjs":"text/javascript", ".css":"text/css", ".svg":"image/svg+xml" };

http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
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
