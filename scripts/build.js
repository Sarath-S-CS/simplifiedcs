// Builds the site into static files Netlify serves as-is (the output is
// committed; Netlify runs no build step for this repo):
//   assets/build/main-<hash>.js    the app, as an ES module
//   assets/build/chunk-<hash>.js   code loaded on demand (PDF generator,
//                                  Supabase client for the live feeds)
//   assets/build/app-<hash>.css    the stylesheet
//   index.html                     src/head.html + src/shell-body.html,
//                                  referencing the hashed files
// File names change whenever content changes, so _headers can let browsers
// cache everything under /assets/build/ for a year ("immutable") without
// ever serving a stale file. The output is minified.
//
// Reproducible: the same sources and lockfile produce byte-identical files
// under assets/build (esbuild's hashes are content-based; CI checks this).
// The build date only goes into index.html's <meta name="site-updated">,
// and can be pinned with the SOURCE_DATE_EPOCH environment variable.
//
// Usage: node scripts/build.js [--watch]
import { build, context } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const outdir = path.join(root, "assets/build");
const watch = process.argv.includes("--watch");

const buildTime = process.env.SOURCE_DATE_EPOCH ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000) : new Date();
const buildDate = buildTime.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

const buildOptions = {
  entryPoints: { main: path.join(root, "src/main.js"), app: path.join(root, "src/styles/app.css") },
  bundle: true,
  format: "esm",
  splitting: true,
  minify: true,
  target: "es2020",
  outdir,
  entryNames: "[name]-[hash]",
  chunkNames: "chunk-[hash]",
  assetNames: "[name]-[hash]",
  // Images referenced from CSS by absolute URL are served as they are.
  external: ["/assets/*"],
  metafile: true,
  logLevel: "info",
  legalComments: "linked",
};

function outputFor(metafile, entryPath) {
  const rel = path.relative(root, entryPath).split(path.sep).join("/");
  const found = Object.entries(metafile.outputs).find(([, o]) => o.entryPoint === rel);
  if (!found) throw new Error(`no output for ${rel}`);
  return "/" + found[0].split(path.sep).join("/").replace(/^\/+/, "");
}

function assembleHtml(metafile) {
  const js = outputFor(metafile, buildOptions.entryPoints.main);
  const css = outputFor(metafile, buildOptions.entryPoints.app);
  const head = readFileSync(path.join(root, "src/head.html"), "utf8");
  const shellBody = readFileSync(path.join(root, "src/shell-body.html"), "utf8");
  // Absolute paths: scripts/prerender.js reuses this head for per-route
  // pages such as /methodology, where relative paths would break.
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
${head}<meta name="site-updated" content="${buildDate}">
<link rel="stylesheet" href="${css}">
<script type="module" src="${js}"></script>
</head>
<body>
${shellBody}
</body>
</html>
`;
  writeFileSync(path.join(root, "index.html"), html);
  return { js, css };
}

if (watch) {
  const ctx = await context({
    ...buildOptions,
    plugins: [{ name: "assemble-html", setup: (b) => b.onEnd((r) => r.metafile && assembleHtml(r.metafile)) }],
  });
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  rmSync(outdir, { recursive: true, force: true });
  mkdirSync(outdir, { recursive: true });
  const result = await build(buildOptions);
  const { js, css } = assembleHtml(result.metafile);
  const sizes = Object.entries(result.metafile.outputs)
    .filter(([f]) => !f.endsWith(".map") && !f.endsWith(".txt"))
    .map(([f, o]) => `  ${f.split("/").pop()}  ${(o.bytes / 1024).toFixed(0)} KB`)
    .join("\n");
  console.log(`Build complete: index.html -> ${js}, ${css}\n${sizes}`);
}
