// Zero-dependency static file server for local preview - matches how
// Netlify serves this repo (plain static files, no framework server).
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ROOT = path.resolve(root);
const port = process.env.PORT || 5173;
// Loopback only: this preview server has no auth and serves repo files, so it
// must not be reachable from other machines on the network. Overridable for
// the rare container case, but never 0.0.0.0 by default.
const host = process.env.HOST || "127.0.0.1";

// Resolves a decoded request path to an absolute path, but only if it stays
// inside the repo root - blocks "/../x", encoded "..%2f" (already decoded by
// the caller), absolute-path and Windows-separator traversal. Returns null if
// the path escapes the root.
function resolveWithinRoot(reqPath) {
  const resolved = path.resolve(ROOT, "." + reqPath.replace(/\\/g, "/"));
  if (resolved !== ROOT && !resolved.startsWith(ROOT + path.sep)) return null;
  return resolved;
}

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
  // Only Netlify accepts form posts (Netlify Forms); it answers 404 when no
  // form matches. Do the same here, so a local feedback test shows the
  // "didn't send" path instead of a false "sent".
  if (req.method !== "GET" && req.method !== "HEAD") {
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("No form handling on the local server");
    return;
  }
  let reqPath;
  try {
    reqPath = decodeURIComponent(req.url.split("?")[0]);
  } catch {
    // Malformed percent-encoding (e.g. a lone "%"): reject rather than guess.
    res.writeHead(400, { "content-type": "text/plain" });
    res.end("Bad request");
    return;
  }
  if (reqPath === "/") reqPath = "/index.html";
  const filePath = resolveWithinRoot(reqPath);
  const serve404 = async () => {
    // Mirrors the repo's _redirects catch-all (/* /404.html 404): any path
    // with no matching file - an unknown route or a missing asset - gets a
    // genuine 404 and the standalone 404.html, same as on Netlify.
    try {
      const data = await readFile(path.join(ROOT, "404.html"));
      res.writeHead(404, { ...siteHeaders, "Content-Type": "text/html", "Cache-Control": "no-store" });
      res.end(data);
    } catch {
      res.writeHead(404, { "content-type": "text/plain" });
      res.end("Not found");
    }
  };
  // Path escaped the repo root (traversal attempt): 404, don't read it.
  if (!filePath) return serve404();
  try {
    // Netlify's own resolution order for a request with no matching file
    // extension: the exact path, then path.html, then path/index.html -
    // e.g. /methodology resolves to methodology.html, the prerendered
    // snapshot scripts/prerender.js writes there. Only tried when reqPath
    // has no extension, same as Netlify only applies this to "pretty" URLs.
    const hasExt = path.extname(reqPath) !== "";
    const candidates = hasExt
      ? [filePath]
      : [filePath, `${filePath}.html`, path.join(filePath, "index.html")];
    const found = await readFirstMatch(candidates);
    if (!found) return serve404();
    const ext = path.extname(found.filePath);
    res.writeHead(200, { ...siteHeaders, "Content-Type": MIME[ext] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(found.data);
  } catch {
    return serve404();
  }
}).listen(port, host, () => console.log(`Serving on http://${host}:${port}`));
