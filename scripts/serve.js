// Zero-dependency static file server for local preview - matches how
// Netlify serves this repo (plain static files, no framework server).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = process.env.PORT || 5173;

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml" };

createServer(async (req, res) => {
  let reqPath = decodeURIComponent(req.url.split("?")[0]);
  if (reqPath === "/") reqPath = "/index.html";
  const filePath = path.join(root, reqPath);
  try {
    const data = await readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(data);
  } catch {
    // Mirrors the repo's _redirects catch-all (/* /index.html 200): any
    // path with no matching file - a client-side route like /exploits,
    // hit via direct load, refresh, or a real href in a new tab - falls
    // through to index.html instead of a bare 404, same as on Netlify.
    try {
      const data = await readFile(path.join(root, "index.html"));
      res.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-store" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  }
}).listen(port, () => console.log(`Serving on http://localhost:${port}`));
