// Bundles src/main.js (ESM) into a single IIFE and re-assembles the
// deployable index.html from src/shell-body.html + src/styles/app.css +
// the bundle. The output is committed to the repo root as plain index.html/
// assets/*, so Netlify keeps deploying it as a zero-config static site -
// this build step is a local/dev-time convenience only, not something
// Netlify itself needs to run (CLAUDE.md: don't touch hosting config).
import { build, context } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const watch = process.argv.includes("--watch");

// Stamped into src/main.js's SITE_LAST_UPDATED via esbuild's define below -
// a real build-time value instead of a hand-typed date someone has to
// remember to update (see ROADMAP-FIX-BRIEF.md - a hand-typed
// SITE_LAST_UPDATED/SITE_STARTED was exactly the failure mode that let the
// Roadmap page drift). Explicit en-US locale so this doesn't vary with
// whatever locale the build machine happens to default to.
const buildDate = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

function assembleHtml() {
  // head.html holds everything real inside <head> (meta tags, title,
  // favicon, font preconnects) verbatim from source - deliberately NOT
  // hand-typed here, so a future favicon/meta change on main can't get
  // silently dropped by this script again the way it was on 2026-08-11.
  const head = readFileSync(path.join(root, "src/head.html"), "utf8");
  const shellBody = readFileSync(path.join(root, "src/shell-body.html"), "utf8");
  const bundlePath = path.join(root, "assets/app.js");
  const bundle = readFileSync(bundlePath, "utf8");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
${head}<link rel="stylesheet" href="./assets/app.css">
</head>
<body>
${shellBody}
<script>
${bundle}</script>
</body>
</html>
`;
  writeFileSync(path.join(root, "index.html"), html);

  const css = readFileSync(path.join(root, "src/styles/app.css"), "utf8");
  mkdirSync(path.join(root, "assets"), { recursive: true });
  writeFileSync(path.join(root, "assets/app.css"), css);
}

const buildOptions = {
  entryPoints: [path.join(root, "src/main.js")],
  bundle: true,
  format: "iife",
  target: "es2020",
  outfile: path.join(root, "assets/app.js"),
  logLevel: "info",
  define: { __BUILD_TIME__: JSON.stringify(buildDate) },
};

if (watch) {
  const ctx = await context({
    ...buildOptions,
    plugins: [
      {
        name: "reassemble-html",
        setup(b) {
          b.onEnd(() => assembleHtml());
        },
      },
    ],
  });
  await ctx.watch();
  console.log("Watching for changes...");
} else {
  mkdirSync(path.join(root, "assets"), { recursive: true });
  await build(buildOptions);
  assembleHtml();
  console.log("Build complete: index.html + assets/app.css + assets/app.js");
}
