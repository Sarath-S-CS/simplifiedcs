// Guards against shipping stale prerendered snapshots.
//
// scripts/build.js writes index.html with the current content-hashed bundle
// names (main-<hash>.js / app-<hash>.css); scripts/prerender.js then writes a
// <route>.html snapshot per route that loads those same files. A JS/CSS change
// reruns build (new hashes, index.html updated) but the per-route snapshots are
// only refreshed by a separate `npm run prerender`. Skip it and every route
// snapshot still points at the OLD, now-deleted bundle: on a direct deep link
// that file 404s, Netlify serves the SPA-fallback HTML, the browser rejects it
// for the wrong MIME type, and the whole app never boots (dead theme toggle,
// stored theme not applied, interactions frozen). Home works because index.html
// is current, so only direct deep links break - easy to miss in review.
//
// This check is deterministic (it reads files, it does not re-render): for every
// HTML snapshot, every /assets/build/<file> it references must exist on disk and
// match the bundle index.html uses. It does NOT re-run prerender, because the
// news/exploits/case-studies snapshots embed live Supabase data and so are not
// byte-reproducible; only the asset references need to stay in lock-step.
import { readFileSync, existsSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Every HTML snapshot: the flat <route>.html files at the repo root, plus the
// one nested under assessment/ (see prerender.js for why it is flat, not
// <route>/index.html).
const htmlFiles = [];
for (const dir of [root, path.join(root, "assessment")]) {
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir)) {
    if (name.endsWith(".html")) htmlFiles.push(path.join(dir, name));
  }
}

const buildRef = /assets\/build\/([A-Za-z0-9._-]+\.(?:js|css))/g;
const mainOf = (refs) => refs.find((r) => /^main-.*\.js$/.test(r));

const indexRefs = [...readFileSync(path.join(root, "index.html"), "utf8").matchAll(buildRef)].map((m) => m[1]);
const indexMain = mainOf(indexRefs);

const problems = [];
for (const file of htmlFiles) {
  const rel = path.relative(root, file).replace(/\\/g, "/");
  const refs = [...readFileSync(file, "utf8").matchAll(buildRef)].map((m) => m[1]);
  for (const ref of refs) {
    if (!existsSync(path.join(root, "assets", "build", ref))) {
      problems.push(`${rel} -> missing assets/build/${ref}`);
    }
  }
  const main = mainOf(refs);
  if (indexMain && main && main !== indexMain) {
    problems.push(`${rel} loads ${main}, but index.html loads ${indexMain} (stale snapshot)`);
  }
}

if (problems.length) {
  console.error("Prerendered asset-reference check FAILED:\n");
  for (const p of problems) console.error("  - " + p);
  console.error("\nThe route snapshots are out of date with the build.");
  console.error("Fix: run `npm run build && npm run prerender`, then commit the regenerated *.html files.");
  process.exit(1);
}
console.log(`OK: ${htmlFiles.length} HTML snapshots reference existing build assets (bundle ${indexMain}).`);
