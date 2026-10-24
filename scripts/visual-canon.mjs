// Reads the visual canon (docs/design/visual-canon): entries, the era-to-game version rule, reference list,
// and a consistency check used by the tests. See docs/superpowers/specs/2026-10-19-visual-canon-design.md.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';

export const CANON_DIR = fileURLToPath(new URL('../docs/design/visual-canon/', import.meta.url));
export const VERSION_KEYS = ['tes3', 'tes4', 'tes5', 'eso', 'lore'];
export const CATEGORIES = ['people', 'races', 'factions', 'gear', 'places', 'creatures', 'objects'];
/** subjects.json `era` values: the site's eras (src/lib/types.ts ERAS); pickVersion compares these exact strings. */
export const CANON_ERAS = ['dawn', 'merethic', '1E', '2E', '3E', '4E'];
/** subjects.json `region` values (README 的「紀元與地區」); pickVersion only reads `morrowind`. */
export const CANON_REGIONS = [
  'aetherius', 'akavir', 'atmora', 'black-marsh', 'cyrodiil', 'elsweyr', 'hammerfell', 'high-rock', 'morrowind',
  'mundus', 'nirn', 'oblivion', 'skyrim', 'summerset', 'tamriel', 'valenwood', 'yokuda',
];

/** Bullet items under a "## <title>" heading, up to the next heading. */
function section(body, title) {
  const m = body.match(new RegExp(`^## ${title}\\s*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`, 'm'));
  if (!m) return [];
  return m[1].split('\n').filter((l) => l.startsWith('- ')).map((l) => l.slice(2).trim());
}

/** `[tes4] text` or `[tes4, eso] text` → { text, versions }; an untagged item has versions null (every version). */
function parseItem(line, variants, where) {
  const m = line.match(/^\[([^\]]*)\]\s*(.*)$/);
  if (!m) return { text: line, versions: null };
  const versions = m[1].split(',').map((v) => v.trim()).filter(Boolean);
  if (versions.length === 0 || !m[2]) throw new Error(`${where}: 版本標記不完整：${line}`);
  for (const v of versions) {
    if (!VERSION_KEYS.includes(v)) throw new Error(`${where}: 不認得的版本標記 ${v}：${line}`);
    if (typeof variants[v] !== 'string') throw new Error(`${where}: 版本標記 ${v} 沒有對應的片段：${line}`);
  }
  return { text: m[2], versions };
}

/** Texts of the items that apply to a version: untagged items plus items tagged with it. */
export function itemsFor(items, version) {
  return items.filter((i) => !i.versions || i.versions.includes(version)).map((i) => i.text);
}

export function parseEntry(text, file) {
  const m = text.replace(/\r\n/g, '\n').match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error(`${file}: 沒有 frontmatter`);
  const fm = YAML.parse(m[1]);
  const body = m[2];
  const where = `${file} (${fm.id})`;
  if (!fm.id || !CATEGORIES.includes(fm.category)) throw new Error(`${where}: id 或 category 不正確`);
  if (!fm.name?.en || !fm.name?.['zh-tw']) throw new Error(`${where}: name 要有 en 與 zh-tw`);
  const variants = fm.variants ?? {};
  for (const k of Object.keys(variants)) {
    if (k !== 'default' && !VERSION_KEYS.includes(k)) throw new Error(`${where}: 不認得的版本鍵 ${k}`);
  }
  if (!VERSION_KEYS.includes(variants.default) || typeof variants[variants.default] !== 'string') {
    throw new Error(`${where}: variants.default 要指向一個存在的版本`);
  }
  if (!Array.isArray(fm.sources) || fm.sources.length === 0) throw new Error(`${where}: sources 不可為空`);
  const mustHave = section(body, '必要特徵').map((l) => parseItem(l, variants, where));
  if (mustHave.length === 0) throw new Error(`${where}: 必要特徵不可為空`);
  for (const v of Object.keys(variants)) {
    if (v !== 'default' && itemsFor(mustHave, v).length === 0) throw new Error(`${where}: ${v} 版本沒有任何必要特徵`);
  }
  return {
    id: fm.id,
    category: fm.category,
    name: fm.name,
    variants,
    refs: fm.refs ?? [],
    sources: fm.sources,
    mustHave,
    mistakes: section(body, '常見錯誤').map((l) => parseItem(l, variants, where)),
    file,
  };
}

export function loadEntries(dir = CANON_DIR) {
  const entries = new Map();
  for (const category of CATEGORIES) {
    const folder = path.join(dir, category);
    let names = [];
    try {
      if (!statSync(folder).isDirectory()) continue;
      names = readdirSync(folder).filter((n) => n.endsWith('.md'));
    } catch {
      continue;
    }
    for (const name of names) {
      const rel = `${category}/${name}`;
      const entry = parseEntry(readFileSync(path.join(folder, name), 'utf-8'), rel);
      if (entries.has(entry.id)) throw new Error(`${rel}: id ${entry.id} 重複`);
      entries.set(entry.id, entry);
    }
  }
  return entries;
}

/** Which game's design an event uses (README 的版本規則); null = each entry's own default. */
export function pickVersion({ era, year, region }) {
  if (era === '4E') return 'tes5';
  if (era === '3E' && year != null && year >= 431) return 'tes4';
  if (era === '3E' && year != null && year >= 420 && region === 'morrowind') return 'tes3';
  if (era === '2E') return 'eso';
  return null;
}

/** The version key whose variant an entry uses for the wanted version (eso falls back to tes5, then the default). */
export function resolveVersion(entry, version) {
  const v = entry.variants;
  if (version && typeof v[version] === 'string') return version;
  if (version === 'eso' && typeof v.tes5 === 'string') return 'tes5';
  return v.default;
}

export function resolveSnippet(entry, version) {
  return entry.variants[resolveVersion(entry, version)];
}

export function parseRefs(markdown) {
  return markdown
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.startsWith('|') && !/^\|\s*-/.test(l) && !/^\|\s*id\s*\|/.test(l))
    .map((l) => l.split('|').slice(1, -1).map((c) => c.trim()))
    .map(([id, entry, url, note]) => ({ id, entry, url, note }));
}

export function checkCanon({ entries, subjects, refs }) {
  const problems = [];
  const refIds = new Set(refs.map((r) => r.id));
  for (const [eventId, s] of Object.entries(subjects)) {
    if (!CANON_ERAS.includes(s.era)) problems.push(`${eventId}: 不認得的紀元 ${s.era}`);
    if (!CANON_REGIONS.includes(s.region)) problems.push(`${eventId}: 不認得的地區 ${s.region}`);
    for (const id of s.entries) if (!entries.has(id)) problems.push(`${eventId}: 條目 ${id} 不存在`);
    for (const [id, version] of Object.entries(s.overrides ?? {})) {
      const e = entries.get(id);
      if (!VERSION_KEYS.includes(version)) problems.push(`${eventId}: ${id} 的覆寫 ${version} 不是版本鍵`);
      else if (e && typeof e.variants[version] !== 'string') problems.push(`${eventId}: ${id} 沒有 ${version} 版本`);
    }
  }
  for (const e of entries.values()) {
    for (const r of e.refs) if (!refIds.has(r)) problems.push(`${e.id}: 參考圖 ${r} 不在 refs.md`);
  }
  for (const r of refs) if (!entries.has(r.entry)) problems.push(`refs.md: ${r.id} 指向不存在的條目 ${r.entry}`);
  return problems;
}
