// Zero-dependency static file server for local preview - matches how
// Netlify serves this repo (plain static files, no framework server).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const port = process.env.PORT || 5173;

const MIME = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".txt": "text/plain" };

// Applies the repo's Netlify _headers file (the site's CSP and other
// security headers) to every local response, so a CSP violation shows up in
// local preview instead of first appearing in production. Only the "/*"
// block is read - it's the only one _headers uses.
async function loadSiteHeaders() {
  try {
    const text = await readFile(path.join(root, "_headers"), "utf8");
    const headers = {};
    let inAll = false;
    for (const line of text.split(/\r?\n/)) {
      if (!line.trim() || line.trim().startsWith("#")) continue;
      if (!/^\s/.test(line)) {
        inAll = line.trim() === "/*";
        continue;
      }
      const i = line.indexOf(":");
      if (inAll && i > 0) headers[line.slice(0, i).trim()] = line.slice(i + 1).trim();
    }
    return headers;
  } catch {
    return {};
  }
}
const siteHeaders = await loadSiteHeaders();

async function readFirstMatch(candidates) {
  for (const candidate of candidates) {
    try {
      return { data: await readFile(candidate), filePath: candidate };
    } catch {}
  }
  return null;
}

createServer(async (req, res) => {
  let reqPath = decodeURIComponent(req.url.split("?")[0]);
  if (reqPath === "/") reqPath = "/index.html";
  const filePath = path.join(root, reqPath);
  try {
    // Netlify's own resolution order for a request with no matching file
    // extension: the exact path, then path.html, then path/index.html -
    // e.g. /methodology resolves to methodology/index.html, the prerendered
    // snapshot scripts/prerender.js writes there. Only tried when reqPath
    // has no extension, same as Netlify only applies this to "pretty" URLs.
    const hasExt = path.extname(reqPath) !== "";
    const candidates = hasExt
      ? [filePath]
      : [filePath, `${filePath}.html`, path.join(filePath, "index.html")];
    const found = await readFirstMatch(candidates);
    if (!found) throw new Error("not found");
    const ext = path.extname(found.filePath);
    res.writeHead(200, { ...siteHeaders, "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(found.data);
  } catch {
    // Mirrors the repo's _redirects catch-all (/* /index.html 200): any
    // path with no matching file - a client-side route like /exploits,
    // hit via direct load, refresh, or a real href in a new tab - falls
    // through to index.html instead of a bare 404, same as on Netlify.
    try {
      const data = await readFile(path.join(root, "index.html"));
      res.writeHead(200, { ...siteHeaders, "Content-Type": "text/html", "Cache-Control": "no-store" });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end("Not found");
    }
  }
}).listen(port, () => console.log(`Serving on http://localhost:${port}`));
