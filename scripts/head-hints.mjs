import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * Loading hints added to every built page (performance: the island's scripts and the fonts above the fold are
 * discovered from the HTML instead of one after another):
 * - <link rel="modulepreload"> for each island's module and every module it statically imports, so the browser
 *   fetches them all at once instead of finding preact, hooks and the header only once the island's module arrives;
 * - on English pages, <link rel="preload" as="font"> for the two Latin faces the first screen shows (the title's and
 *   the text's). Their stylesheet still only applies once the page has loaded (Base.astro); the files are then
 *   already there. Chinese pages keep waiting: their subsets are hundreds of KB;
 * - a Content-Security-Policy <meta> (GitHub Pages cannot send headers): scripts only from the site itself and the
 *   page's own inline scripts, by hash (they differ per page: the map's preload carries the page's own view), so an
 *   injected script cannot run. Style attributes stay allowed: the server HTML positions the map's markers with them.
 */

/** The faces English pages preload: the title (Alegreya 700) and the body text (Alegreya Sans 400), Latin only. */
export const EN_PRELOAD_FONTS = [/\/alegreya-latin-700-normal\.[\w-]+\.woff2$/, /\/alegreya-sans-latin-400-normal\.[\w-]+\.woff2$/];

/** The relative modules a built module imports statically (`import … from"./x.js"`, `import"./x.js"`). */
export function staticImports(code) {
  const out = [];
  for (const m of code.matchAll(/(?:^|[;\s}])import\s*(?:[\w$*{}\s,]+?\s*from\s*)?["'](\.{1,2}\/[^"']+\.js)["']/g)) out.push(m[1]);
  return [...new Set(out)];
}

/** Every module URL an island needs, in load order: itself first, then what it imports, depth first. */
export async function moduleClosure(entryUrl, readModule) {
  const seen = new Set();
  const visit = async (url) => {
    if (seen.has(url)) return;
    seen.add(url);
    const code = await readModule(url);
    if (code === null) return;
    for (const rel of staticImports(code)) await visit(new URL(rel, `http://x${url}`).pathname);
  };
  await visit(entryUrl);
  return [...seen];
}

/** The page's island entry modules (component and renderer), as the HTML names them. */
export function islandModules(html) {
  const urls = new Set();
  for (const m of html.matchAll(/<astro-island\b[^>]*>/g)) {
    for (const attr of ['component-url', 'renderer-url']) {
      const v = new RegExp(`\\s${attr}="([^"]+)"`).exec(m[0]);
      if (v) urls.add(v[1]);
    }
  }
  return [...urls];
}

/** The font files to preload on a page whose fonts stylesheet is `css`. */
export function fontPreloads(css) {
  const urls = [...css.matchAll(/url\(\s*["']?([^"')]+\.woff2)["']?\s*\)/g)].map((m) => m[1]);
  return EN_PRELOAD_FONTS.map((re) => urls.find((u) => re.test(u))).filter(Boolean);
}

/**
 * Inserts the hints just before </head> (once: a page that already has one is left alone).
 * @param {string} html
 * @param {{ modules?: string[], fonts?: string[] }} hints
 */
export function addHints(html, { modules = [], fonts = [] }) {
  if (html.includes('data-head-hints')) return html;
  const tags = [
    ...modules.map((u) => `<link rel="modulepreload" href="${u}" data-head-hints>`),
    ...fonts.map((u) => `<link rel="preload" as="font" type="font/woff2" href="${u}" crossorigin data-head-hints>`),
  ];
  return tags.length === 0 ? html : html.replace('</head>', `${tags.join('')}</head>`);
}

/** Script types the browser runs (a JSON data block is not one, so it needs no hash). */
const RUNS = (type) => type === null || type === '' || /^(text\/javascript|module|application\/javascript|speculationrules)$/i.test(type);
const sha256 = (text) => `'sha256-${createHash('sha256').update(text, 'utf8').digest('base64')}'`;

/** The page's Content-Security-Policy: every inline script and style it has, by hash. */
export function cspFor(html) {
  const scripts = [];
  for (const m of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)) {
    const attrs = m[1];
    if (/\ssrc=/.test(attrs)) continue;
    const type = /\stype="([^"]*)"/.exec(attrs)?.[1] ?? null;
    if (RUNS(type)) scripts.push(sha256(m[2]));
  }
  const styles = [...html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map((m) => sha256(m[1]));
  // Visit counting (decisions/analytics): the beacon's script and where it reports.
  const beacon = html.includes('static.cloudflareinsights.com');
  return [
    "default-src 'self'",
    ['script-src', "'self'", ...new Set(scripts), ...(beacon ? ['https://static.cloudflareinsights.com'] : [])].join(' '),
    ['style-src', "'self'", ...new Set(styles)].join(' '),
    "style-src-attr 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    ['connect-src', "'self'", ...(beacon ? ['https://cloudflareinsights.com'] : [])].join(' '),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}

/** Puts the policy first in <head> after the charset (it only covers what comes after it). */
export function addCsp(html) {
  if (html.includes('http-equiv="content-security-policy"')) return html;
  const meta = `<meta http-equiv="content-security-policy" content="${cspFor(html)}">`;
  return html.replace(/(<meta charset="[^"]*"\s*\/?>)/i, `$1${meta}`);
}

async function* htmlFiles(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(p);
    else if (entry.name.endsWith('.html')) yield p;
  }
}

/** `csp: false` leaves the policy out (the claude.ai artifact export, whose host serves the pages its own way). */
export function headHints({ csp = true } = {}) {
  let base = '/';
  return {
    name: 'head-hints',
    hooks: {
      'astro:config:done': ({ config }) => {
        base = config.base.endsWith('/') ? config.base : `${config.base}/`;
      },
      'astro:build:done': async ({ dir, logger }) => {
        const root = fileURLToPath(dir);
        // A URL the HTML names (under the site's base) → the built file.
        const fileOf = (url) => (url.startsWith(base) ? path.join(root, url.slice(base.length)) : null);
        const read = async (url) => {
          const f = fileOf(url);
          if (!f) return null;
          try {
            return await readFile(f, 'utf8');
          } catch {
            return null;
          }
        };
        const closures = new Map();
        const fontsFor = new Map();
        let pages = 0;
        for await (const file of htmlFiles(root)) {
          const html = await readFile(file, 'utf8');
          const modules = [];
          for (const entry of islandModules(html)) {
            if (!closures.has(entry)) closures.set(entry, await moduleClosure(entry, read));
            for (const m of closures.get(entry)) if (!modules.includes(m)) modules.push(m);
          }
          let fonts = [];
          if (/<html[^>]*\slang="en"/.test(html)) {
            const href = /<link id="site-fonts"[^>]*\shref="([^"]+)"/.exec(html)?.[1];
            if (href) {
              if (!fontsFor.has(href)) fontsFor.set(href, fontPreloads((await read(href)) ?? ''));
              fonts = fontsFor.get(href);
            }
          }
          const hinted = addHints(html, { modules, fonts });
          // Last, once nothing else changes the page's inline scripts.
          const next = csp ? addCsp(hinted) : hinted;
          if (next !== html) {
            await writeFile(file, next);
            pages++;
          }
        }
        logger.info(`added loading hints to ${pages} pages`);
      },
    },
  };
}
