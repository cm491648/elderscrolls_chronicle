// Builds a copy of the site that runs from any folder of a static host without directory indexes
// (used to publish the site as a claude.ai artifact). Usage: node scripts/artifact-export.mjs <outDir>
//
// The site is built with a placeholder base, then every root-absolute URL is made relative:
// pages get <base href> pointing at the site root, so links, islands and runtime image URLs resolve from there;
// CSS files resolve their url()s from their own folder. Page URLs name index.html (PUBLIC_PAGE_FILE=1).
import { execFileSync } from 'node:child_process';
import { readdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { MAX_FILES, countFiles } from './artifact-files.mjs';
import { astroBin } from './astro-bin.mjs';

const PLACEHOLDER = '/__chronicle_base__/';
// The artifact service reserves top-level names that start with "_", so Astro's _astro/ folder ships as assets/.
const ASSETS = 'assets';
const outDir = path.resolve(process.argv[2] ?? 'dist-artifact');

await rm(outDir, { recursive: true, force: true });
// Run Astro's CLI with this Node directly (no shell), so paths with spaces stay one argument.
execFileSync(process.execPath, [astroBin, 'build', '--outDir', outDir, '--base', PLACEHOLDER], {
  stdio: 'inherit',
  // One plate width and one bilingual story file per event keep the export under the host's file limit
  // (scripts/artifact-files.mjs); the site itself ships every width and one story file per language.
  env: { ...process.env, PUBLIC_PAGE_FILE: '1', PUBLIC_PLATE_WIDTHS: '960', PUBLIC_STORIES_BILINGUAL: '1' },
});

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else yield full;
  }
}

const counts = { html: 0, js: 0, css: 0 };
for await (const file of walk(outDir)) {
  const rel = path.relative(outDir, file).split(path.sep).join('/');
  const ext = path.extname(file);
  if (!['.html', '.js', '.css'].includes(ext)) continue;
  let text = await readFile(file, 'utf-8');
  if (!text.includes(PLACEHOLDER) && !text.includes('_astro/') && ext !== '.html') continue;
  if (ext === '.html') {
    const depth = rel.split('/').length - 1;
    const toRoot = depth === 0 ? './' : '../'.repeat(depth);
    text = text.replaceAll(PLACEHOLDER, './');
    // Page links that end in a folder name its index.html (no directory indexes on the host).
    text = text.replace(/href="(\.\/(?:[^"#?]*\/)?)"/g, (m, p) => (p.includes('_astro') ? m : `href="${p}index.html"`));
    text = text.replaceAll('./_astro/', `./${ASSETS}/`);
    text = text.replace(/<head>/i, `<head><base href="${toRoot}">`);
    counts.html++;
  } else if (ext === '.css') {
    // url()s in a CSS file resolve from the file's own folder (_astro/).
    const dir = path.posix.dirname(rel);
    const toRoot = dir === '.' ? './' : '../'.repeat(dir.split('/').length);
    text = text.replaceAll(`${PLACEHOLDER}${dir}/`, './').replaceAll(PLACEHOLDER, toRoot).replaceAll('_astro/', `${ASSETS}/`);
    counts.css++;
  } else {
    // Runtime URLs (links, images, preloads) resolve against the page's <base>, i.e. the site root.
    text = text.replaceAll(PLACEHOLDER, './').replaceAll('_astro/', `${ASSETS}/`);
    counts.js++;
  }
  await writeFile(file, text);
}

await rename(path.join(outDir, '_astro'), path.join(outDir, ASSETS));
// Astro's content-layer cache files are not part of the site.
for (const extra of ['collections', 'content-assets.mjs', 'content-modules.mjs', 'data-store.json', 'settings.json']) {
  await rm(path.join(outDir, extra), { recursive: true, force: true });
}

// The root page picks a language with a redirect; replace it with a plain launcher.
await writeFile(
  path.join(outDir, 'index.html'),
  `<title>上古卷軸編年史</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>body{margin:0;padding:24px 16px;font:16px/1.7 system-ui,sans-serif;background:#e4e2dc;color:#1e1c2c}a{color:#24508f}</style>
<p>正在開啟上古卷軸編年史…… <a href="zh-tw/index.html">中文</a>　<a href="en/index.html">English</a></p>
<script>location.replace('zh-tw/index.html');</script>
`,
);
await rm(path.join(outDir, '404.html'), { force: true });

// An artifact version holds at most 512 files. The site writes only Latin and Chinese, so the Alegreya subsets for
// Cyrillic, Greek and Vietnamese are never requested: drop their files and their @font-face rules.
const UNUSED_FONT = /alegreya(?:-sans)?-(?:cyrillic|cyrillic-ext|greek|greek-ext|vietnamese)-\d{3}-[a-z]+\.[\w-]+\.woff2?/;
let droppedFonts = 0;
for await (const file of walk(path.join(outDir, ASSETS))) {
  if (UNUSED_FONT.test(path.basename(file))) {
    await rm(file);
    droppedFonts++;
  } else if (file.endsWith('.css')) {
    const text = await readFile(file, 'utf-8');
    const kept = text.replace(/@font-face\{[^}]*\}/g, (rule) => (UNUSED_FONT.test(rule) ? '' : rule));
    if (kept !== text) await writeFile(file, kept);
  }
}

// Pages list only the 960 plates (PUBLIC_PLATE_WIDTHS), so the 640 and full-size copies are never requested.
let droppedPlates = 0;
for (const name of await readdir(path.join(outDir, 'illustrations'))) {
  if (!name.endsWith('-960.webp')) {
    await rm(path.join(outDir, 'illustrations', name));
    droppedPlates++;
  }
}

let left = 0;
for await (const file of walk(outDir)) {
  if (/\.(html|js|css)$/.test(file)) {
    const text = await readFile(file, 'utf-8');
    if (text.includes(PLACEHOLDER) || text.includes('_astro/')) left++;
  }
}
const files = await countFiles(outDir);
console.log(
  `artifact export: rewrote ${counts.html} pages, ${counts.js} scripts, ${counts.css} stylesheets; dropped ${droppedFonts} unused font files and ${droppedPlates} plate copies; placeholders left: ${left}; ${files.total} files`,
);
if (left > 0) process.exitCode = 1;
if (files.total > MAX_FILES) {
  console.error(`artifact export: ${files.total} files, more than ${MAX_FILES}:`, files);
  process.exit(1);
}
