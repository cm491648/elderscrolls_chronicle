// Assembles one Codex image prompt from the visual canon: instructions, base, production rules, a style,
// the design references of the event's entries (version picked by era), reference images, the scene and the
// forbidden list; also writes the checklist used to accept the image.
// Usage: node scripts/build-image-prompt.mjs <event-id> [--style A|B|C (default B)] --out <dir> [--file name.png] [--size 1536x1024]
import { copyFileSync, mkdirSync, readFileSync, readdirSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { superpowersDir } from './superpowers-dir.mjs';
import { CANON_DIR, itemsFor, loadEntries, parseRefs, pickVersion, resolveSnippet, resolveVersion } from './visual-canon.mjs';

const REFS_DIR = path.join(superpowersDir(), 'refs');

const MAX_REFS = 5; // the Codex image tool accepts at most 5 reference images

/** Ref ids are `<entry-id>-<version>-<n>`; entry ids may contain hyphens, so the version is the second-to-last segment. */
const refVersion = (refId) => refId.split('-').slice(-2, -1)[0];

/** The downloaded file of a ref (`<id>.<ext>`); a half-written `.part` from fetch-refs does not count. */
const refFile = (available, id) => available.find((n) => n.startsWith(`${id}.`) && !n.endsWith('.part'));
/** Refs of the version the entry actually uses, in the entry's order. */
const refsOfUsedVersion = ({ version, refs }) => refs.filter((id) => refVersion(id) === version);

/**
 * Picks the reference images for an event: per entry only refs of the version actually used and already
 * downloaded, then round-robin across entries (event order) up to `max`. Refs whose URL (from refs.md) was
 * already picked under another id are skipped, so one image never takes two slots.
 * @param {{ entries: { id: string, version: string, refs: string[] }[], available: string[], max?: number, urls?: Record<string, string> }} opts
 * @returns {string[]}
 */
export function selectRefs({ entries, available, max = MAX_REFS, urls = {} }) {
  const queues = entries.map((e) => refsOfUsedVersion(e).filter((id) => refFile(available, id)));
  const picked = [];
  const seen = new Set();
  const image = (id) => urls[id] ?? id;
  while (picked.length < max && queues.some((q) => q.length)) {
    for (const q of queues) {
      while (q.length && seen.has(image(q[0]))) q.shift();
      if (q.length && picked.length < max) {
        const id = q.shift();
        picked.push(id);
        seen.add(image(id));
      }
    }
  }
  return picked;
}

/**
 * Warnings for refs of the used version that are not downloaded, and for downloaded ones cut by the cap
 * (a ref that is the same image as a picked one is not cut, so it gets no warning).
 * @param {{ entries: { id: string, version: string, refs: string[] }[], available: string[], max?: number, urls?: Record<string, string> }} opts
 * @returns {string[]}
 */
export function refWarnings({ entries, available, max = MAX_REFS, urls = {} }) {
  const picked = selectRefs({ entries, available, max, urls });
  const pickedImages = new Set(picked.map((id) => urls[id] ?? id));
  const warnings = [];
  for (const e of entries) {
    for (const id of refsOfUsedVersion(e)) {
      if (!refFile(available, id)) warnings.push(`warning: 參考圖 ${id} 還沒下載（條目 ${e.id}）`);
      else if (!pickedImages.has(urls[id] ?? id)) warnings.push(`warning: 參考圖 ${id} 超過上限 ${max} 張，未使用`);
    }
  }
  return warnings;
}

/** Ref copies (`<entry>-<version>-<n>.<ext>`, or a `.part` of one) in an output folder that this run does not use. */
export function staleRefCopies(files, keep) {
  const kept = new Set(keep);
  return files.filter((n) => /-(tes3|tes4|tes5|eso|lore)-\d+\.[A-Za-z0-9]+(\.part)?$/.test(n) && !kept.has(n));
}

/**
 * @param {{ subject: any, entries: Map<string, any>, parts: any, scene: string, style: string, file: string, size: string, available?: string[], refUrls?: Record<string, string> }} opts
 */
export function assemblePrompt({ subject, entries, parts, scene, style, file, size, available = [], refUrls = {} }) {
  const styleText = parts.styles[style];
  if (!styleText) throw new Error(`style ${style} 沒有提示詞段落（prompt-parts/style-${style}.txt）`);
  const version = pickVersion(subject);
  const used = subject.entries.map((id) => {
    const e = entries.get(id);
    if (!e) throw new Error(`條目 ${id} 不存在`);
    const want = subject.overrides?.[id] ?? version;
    return { e, version: resolveVersion(e, want), snippet: resolveSnippet(e, want) };
  });
  const usedRefs = used.map(({ e, version }) => ({ id: e.id, version, refs: e.refs }));
  const refIds = selectRefs({ entries: usedRefs, available, urls: refUrls });
  const warnings = refWarnings({ entries: usedRefs, available, urls: refUrls });
  const refFiles = refIds.map((id) => refFile(available, id));
  const design = ['DESIGN REFERENCE (follow these designs closely; they are how the games depict these subjects):', ...used.map(({ e, snippet }) => `- ${e.name.en}: ${snippet}`)].join('\n');
  const refs = refFiles.length
    ? `REFERENCE IMAGES in this folder: ${refFiles.join(', ')}. Use them only for the design of costumes, armour, architecture and creatures. Do not copy their composition, and draw no text, interface or logos.`
    : '';
  const avoid = [parts.forbidden, ...used.flatMap(({ e, version }) => itemsFor(e.mistakes, version).map((m) => `- ${e.name.en}: ${m}`))].join('\n');
  const prompt = [
    parts.instructions.replace('{FILE}', file).replace('{SIZE}', size),
    parts.base,
    parts.production,
    styleText,
    design,
    refs,
    `SCENE:\n${scene}`,
    `AVOID:\n${avoid}`,
  ].filter(Boolean).join('\n\n');
  const checklist = [
    '# 驗收清單',
    '',
    '- [ ] 場景、人數與正文一致',
    ...used.flatMap(({ e, version }) => ['', `## ${e.name['zh-tw']}`, ...itemsFor(e.mustHave, version).map((m) => `- [ ] ${m}`)]),
    '',
  ].join('\n');
  return { prompt, checklist, refIds, refFiles, warnings };
}

function loadParts() {
  const dir = path.join(CANON_DIR, 'prompt-parts');
  const read = (n) => readFileSync(path.join(dir, n), 'utf-8').trim();
  const styles = {};
  for (const s of ['A', 'B', 'C']) if (existsSync(path.join(dir, `style-${s}.txt`))) styles[s] = read(`style-${s}.txt`);
  return { instructions: read('instructions.txt'), base: read('base.txt'), production: read('production.txt'), styles, forbidden: read('forbidden.txt') };
}

function main(argv) {
  const [eventId, ...rest] = argv;
  const opt = (name, fallback) => {
    const i = rest.indexOf(`--${name}`);
    return i >= 0 ? rest[i + 1] : fallback;
  };
  const style = opt('style', 'B');
  const out = path.resolve(opt('out', path.join(superpowersDir(), 'image-samples', 'canon', eventId)));
  const file = opt('file', `${eventId}.png`);
  const size = opt('size', '1536x1024');
  const subjects = JSON.parse(readFileSync(path.join(CANON_DIR, 'subjects.json'), 'utf-8'));
  const subject = subjects[eventId];
  if (!subject) throw new Error(`subjects.json 沒有 ${eventId}`);
  const entries = loadEntries();
  const scene = readFileSync(path.join(CANON_DIR, 'scenes', `${eventId}.txt`), 'utf-8').trim();
  mkdirSync(out, { recursive: true });
  const available = existsSync(REFS_DIR) ? readdirSync(REFS_DIR) : [];
  const refUrls = Object.fromEntries(parseRefs(readFileSync(path.join(CANON_DIR, 'refs.md'), 'utf-8')).map((r) => [r.id, r.url]));
  const { prompt, checklist, refFiles, warnings } = assemblePrompt({ subject, entries, parts: loadParts(), scene, style, file, size, available, refUrls });
  for (const w of warnings) console.warn(w);
  // Earlier runs into the same folder may have left other reference copies; the prompt names only this run's.
  for (const f of staleRefCopies(readdirSync(out), refFiles)) rmSync(path.join(out, f));
  for (const f of refFiles) copyFileSync(path.join(REFS_DIR, f), path.join(out, f));
  writeFileSync(path.join(out, 'prompt.txt'), prompt + '\n');
  writeFileSync(path.join(out, 'checklist.md'), checklist);
  console.log(`prompt: ${path.join(out, 'prompt.txt')} (${refFiles.length} reference images)`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2));
