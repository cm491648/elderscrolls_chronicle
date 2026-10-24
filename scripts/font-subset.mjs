// Build-time font work for the self-hosted fonts (astro.config.mjs).
//
// Chinese pages: at every production build, the three Chinese faces the site uses (Noto Sans TC 400 / 700, Noto Serif
// TC 700) are cut down to exactly the characters that appear anywhere in src/ (stories, glossary, people, places,
// interface strings, captions...) and published as one woff2 each, replacing fontsource's ~110 unicode-range slices
// per weight. Every Chinese page then needs the same three files, so after the first page nothing more is fetched.
// The dev server keeps the fontsource slices, so text added while it runs never falls back to a system font.
//
// Sources: the full Google Fonts TTFs from @expo-google-fonts/noto-sans-tc and noto-serif-tc (fonts SIL OFL 1.1,
// package MIT); subsetting with subset-font (harfbuzz compiled to WebAssembly, BSD-3-Clause), so it runs the same on
// Windows, macOS and CI with no native tools.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { dirname, extname, join, relative } from 'node:path';

const require = createRequire(import.meta.url);
const TEXT_FILES = new Set(['.md', '.json', '.ts', '.tsx', '.astro', '.mjs', '.js', '.css']);

/** The Chinese faces the site uses and where their full fonts live (decisions/round3: no 500 / 600). */
export const CHINESE_FACES = [
  { family: 'Noto Sans TC', weight: 400, source: '@expo-google-fonts/noto-sans-tc/400Regular/NotoSansTC_400Regular.ttf', text: 'body' },
  // Bold sans sets names and labels inside running text (terms, note headings), so it is cut to those (boldCodepoints).
  { family: 'Noto Sans TC', weight: 700, source: '@expo-google-fonts/noto-sans-tc/700Bold/NotoSansTC_700Bold.ttf', text: 'bold' },
  // The serif face sets titles and names only (`--font-title`), so it is cut to those characters (titleCodepoints).
  { family: 'Noto Serif TC', weight: 700, source: '@expo-google-fonts/noto-serif-tc/700Bold/NotoSerifTC_700Bold.ttf', text: 'title' },
];

/**
 * Name-table entries every subset keeps, so each published copy carries its OFL notice (OFL 1.1 section 2):
 * 0 copyright, 1-6 names and version, 7 trademark, 11 vendor URL, 13 licence description, 14 licence URL.
 */
export const KEPT_NAME_IDS = [0, 1, 2, 3, 4, 5, 6, 7, 11, 13, 14];

/** The options every subset is cut with; part of the cache key, so changing them rebuilds the files. */
export const SUBSET_OPTIONS = { targetFormat: 'woff2', preserveNameIds: KEPT_NAME_IDS };

/** The font licences published with the site (dist/fonts/), one per family used. */
export const FONT_LICENSES = [
  { from: '@expo-google-fonts/noto-sans-tc/LICENSE_FONT', to: 'OFL-NotoSansTC.txt' },
  { from: '@expo-google-fonts/noto-serif-tc/LICENSE_FONT', to: 'OFL-NotoSerifTC.txt' },
  { from: '@fontsource/alegreya/LICENSE', to: 'OFL-Alegreya.txt' },
  { from: '@fontsource/alegreya-sans/LICENSE', to: 'OFL-AlegreyaSans.txt' },
];

/** Cuts `font` down to `text` with the site's options (`targetFormat` can be overridden, e.g. for tests). */
export async function subsetFace(font, text, overrides = {}) {
  const { default: subsetFont } = await import('subset-font');
  return subsetFont(font, text, { ...SUBSET_OPTIONS, ...overrides });
}

/**
 * A text file as the site shows it. The glossary's `note` (why a translation was chosen) is for translators and never
 * reaches a page, so its characters stay out of the subsets.
 */
function shownText(path) {
  const text = readFileSync(path, 'utf-8');
  if (!path.replace(/\\/g, '/').endsWith('content/glossary.json')) return text;
  return JSON.stringify(JSON.parse(text).map(({ note: _note, ...shown }) => shown));
}

/** Every code point in the text files under `dir` (recursively) that the site can show. */
export function collectCodepoints(dir) {
  const used = new Set();
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (TEXT_FILES.has(extname(entry.name))) for (const ch of shownText(p)) used.add(ch.codePointAt(0));
    }
  };
  walk(dir);
  return used;
}

/**
 * Every code point the serif title face (Noto Serif TC 700) can be asked for: it sets names, never running text.
 * Event titles, glossary, people and place names (the term tooltip, map labels and the events-here popup), plus every
 * file outside src/content: interface strings, era and region names, date formats. Story bodies, summaries, notes and
 * captions are set in the sans faces.
 */
export function titleCodepoints(srcDir) {
  const used = new Set();
  const add = (text) => {
    for (const ch of text) used.add(ch.codePointAt(0));
  };
  const content = join(srcDir, 'content');
  const json = (name) => JSON.parse(readFileSync(join(content, name), 'utf-8'));
  for (const lang of readdirSync(join(content, 'events'))) {
    for (const f of readdirSync(join(content, 'events', lang))) {
      const title = /^title:\s*(.*)$/m.exec(readFileSync(join(content, 'events', lang, f), 'utf-8'));
      if (title) add(title[1]);
    }
  }
  for (const g of json('glossary.json')) add(`${g.en}${g['zh-tw']}`);
  for (const file of ['people.json', 'locations.json']) for (const x of json(file)) add(Object.values(x.name).join(''));
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) {
        if (p !== content) walk(p);
      } else if (TEXT_FILES.has(extname(entry.name))) add(readFileSync(p, 'utf-8'));
    }
  };
  walk(srcDir);
  return used;
}

/**
 * Every code point bold sans (Noto Sans TC 700) can be asked for: the title set (names, interface strings) plus what
 * stories set in bold, i.e. the text a `{{id|shown}}` marker shows and markdown `**bold**` (note headings).
 * A term without `|shown` shows its glossary or person name, already in the title set.
 */
export function boldCodepoints(srcDir) {
  const used = titleCodepoints(srcDir);
  const events = join(srcDir, 'content', 'events');
  for (const lang of readdirSync(events)) {
    for (const f of readdirSync(join(events, lang))) {
      const text = readFileSync(join(events, lang, f), 'utf-8');
      for (const m of text.matchAll(/{{[^}|]+\|([^}]+)}}|\*\*([^*]+)\*\*/g)) {
        for (const ch of m[1] ?? m[2]) used.add(ch.codePointAt(0));
      }
    }
  }
  return used;
}

/**
 * The characters the Chinese faces must hold: everything in src/ from U+00A0 up. ASCII is left to Alegreya, which
 * comes first in both font stacks; the Latin-1 and punctuation characters are kept in case Alegreya lacks one.
 */
export function chineseFaceText(used) {
  return [...used].filter((cp) => cp >= 0xa0).sort((a, b) => a - b);
}

/** Sorted code points → a compact unicode-range value (`U+3001-3002,U+4e00`). */
export function toUnicodeRange(codepoints) {
  const parts = [];
  for (let i = 0; i < codepoints.length; i++) {
    const lo = codepoints[i];
    let hi = lo;
    while (i + 1 < codepoints.length && codepoints[i + 1] === hi + 1) hi = codepoints[++i];
    parts.push(lo === hi ? `U+${lo.toString(16)}` : `U+${lo.toString(16)}-${hi.toString(16)}`);
  }
  return parts.join(',');
}

/** `U+4e00-9fff, U+3001` → [[0x4e00, 0x9fff], [0x3001, 0x3001]] (also `U+4??` wildcards). */
export function parseUnicodeRange(value) {
  return value
    .split(',')
    .map((part) => part.trim().replace(/^u\+/i, ''))
    .filter(Boolean)
    .map((part) => {
      if (part.includes('?')) return [parseInt(part.replace(/\?/g, '0'), 16), parseInt(part.replace(/\?/g, 'f'), 16)];
      const [lo, hi = lo] = part.split('-');
      return [parseInt(lo, 16), parseInt(hi, 16)];
    });
}

/**
 * Cuts each face down to its characters (`codepoints[face.text]`: body, bold or title), caching the
 * result in `cacheDir` under a name that changes with the text, the source font, the subset-font version and the
 * options, so an unchanged site reuses the files and any new character (or a tool or option change) produces new ones.
 */
export async function buildChineseSubsets(codepoints, cacheDir) {
  const tool = `subset-font@${require('subset-font/package.json').version} ${JSON.stringify(SUBSET_OPTIONS)}`;
  mkdirSync(cacheDir, { recursive: true });
  const faces = [];
  for (const face of CHINESE_FACES) {
    const cps = codepoints[face.text];
    const text = String.fromCodePoint(...cps);
    const font = readFileSync(require.resolve(face.source));
    const hash = createHash('sha256').update(text).update(font).update(tool).digest('hex').slice(0, 12);
    const slug = `${face.family.toLowerCase().replace(/\s+/g, '-')}-${face.weight}`;
    const file = join(cacheDir, `${slug}-${hash}.woff2`);
    if (!existsSync(file)) writeFileSync(file, await subsetFace(font, text));
    faces.push({ ...face, file, range: toUnicodeRange(cps) });
  }
  return faces;
}

/**
 * PostCSS plugin for the fontsource CSS. Everywhere: drops each .woff fallback (every supported browser reads
 * woff2). In `fonts-zh.css` on a production build: replaces the Noto TC slices with the site subsets. Runs in `Once`,
 * after Vite has inlined the @imports and before it rewrites url()s, so dropped slices are never emitted and the
 * subsets are published like any other asset.
 */
export function fontsourcePostcss({ srcDir, cacheDir, subset = true }) {
  let faces = null;
  return {
    postcssPlugin: 'fontsource-build',
    async Once(root, { AtRule }) {
      root.walkDecls('src', (decl) => {
        decl.value = decl.value.replace(/,\s*url\([^)]*\.woff\)\s*format\(['"]woff['"]\)/g, '');
      });
      const file = root.source?.input.file ?? '';
      // Vite hands the entry over as `…/fonts-zh.css?transform-only` (the page links it with ?url).
      if (!subset || !/fonts-zh\.css(\?|$)/.test(file)) return;
      const codepoints = {
        body: chineseFaceText(collectCodepoints(srcDir)),
        bold: chineseFaceText(boldCodepoints(srcDir)),
        title: chineseFaceText(titleCodepoints(srcDir)),
      };
      faces ??= await buildChineseSubsets(codepoints, cacheDir);
      const families = new Set(CHINESE_FACES.map((f) => f.family));
      root.walkAtRules('font-face', (rule) => {
        let family = '';
        rule.walkDecls('font-family', (d) => (family = d.value.replace(/["']/g, '').trim()));
        if (families.has(family)) rule.remove();
      });
      const cssDir = dirname(file.replace(/\?.*$/, ''));
      for (const face of faces) {
        const rule = new AtRule({ name: 'font-face' });
        rule.append(
          { prop: 'font-family', value: `'${face.family}'` },
          { prop: 'font-style', value: 'normal' },
          { prop: 'font-display', value: 'swap' },
          { prop: 'font-weight', value: String(face.weight) },
          { prop: 'src', value: `url(${relative(cssDir, face.file).replace(/\\/g, '/')}) format('woff2')` },
          { prop: 'unicode-range', value: face.range },
        );
        // Vite resolves a url() against the file its declaration came from, so the new rules claim fonts-zh.css.
        rule.source = root.source;
        rule.each((decl) => (decl.source = root.source));
        root.append(rule);
      }
    },
  };
}

/** Astro integration: publishes the OFL text of every font family the site uses under dist/fonts/. */
export function fontLicenses() {
  return {
    name: 'font-licenses',
    hooks: {
      'astro:build:done': ({ dir }) => {
        const out = fileURLToPath(new URL('fonts/', dir));
        mkdirSync(out, { recursive: true });
        for (const l of FONT_LICENSES) copyFileSync(require.resolve(l.from), join(out, l.to));
      },
    },
  };
}
