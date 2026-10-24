import { describe, expect, test } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import {
  CHINESE_FACES,
  FONT_LICENSES,
  KEPT_NAME_IDS,
  chineseFaceText,
  collectCodepoints,
  parseUnicodeRange,
  titleCodepoints,
  boldCodepoints,
  subsetFace,
  toUnicodeRange,
} from '../../scripts/font-subset.mjs';

const require = createRequire(import.meta.url);
const readJson = <T,>(file: string): T => JSON.parse(readFileSync(file, 'utf-8'));
const glossary = readJson<{ id: string; en: string; 'zh-tw': string; note?: string }[]>('src/content/glossary.json');
/** The glossary without its translators' notes. */
const glossaryShown = () => glossary.map(({ note: _note, ...shown }) => shown);

/** The name table of a TrueType font: nameID → its Windows (UTF-16BE) string. */
function nameTable(font: Buffer): Map<number, string> {
  const numTables = font.readUInt16BE(4);
  let offset = -1;
  for (let i = 0; i < numTables; i++) {
    const rec = 12 + i * 16;
    if (font.toString('latin1', rec, rec + 4) === 'name') offset = font.readUInt32BE(rec + 8);
  }
  expect(offset).toBeGreaterThan(0);
  const count = font.readUInt16BE(offset + 2);
  const strings = offset + font.readUInt16BE(offset + 4);
  const names = new Map<number, string>();
  for (let i = 0; i < count; i++) {
    const r = offset + 6 + i * 12;
    if (font.readUInt16BE(r) !== 3) continue; // Windows platform, UTF-16BE
    const id = font.readUInt16BE(r + 6);
    const len = font.readUInt16BE(r + 8);
    const start = strings + font.readUInt16BE(r + 10);
    const bytes = Buffer.from(font.subarray(start, start + len));
    names.set(id, bytes.swap16().toString('utf16le'));
  }
  return names;
}

describe('font-subset', () => {
  test('unicode-range round trip, with runs merged', () => {
    const cps = [0x3001, 0x3002, 0x3003, 0x4e00, 0x4e02];
    expect(toUnicodeRange(cps)).toBe('U+3001-3003,U+4e00,U+4e02');
    expect(parseUnicodeRange(toUnicodeRange(cps))).toEqual([
      [0x3001, 0x3003],
      [0x4e00, 0x4e00],
      [0x4e02, 0x4e02],
    ]);
    expect(parseUnicodeRange('u+30??')).toEqual([[0x3000, 0x30ff]]);
  });

  test('the subset text holds every character of every Chinese story, the 404 page and the shared content', () => {
    const text = new Set(chineseFaceText(collectCodepoints('src')));
    expect([...text].every((cp) => cp >= 0xa0)).toBe(true);
    const sources = [
      ...readdirSync('src/content/events/zh-tw').map((f) => `src/content/events/zh-tw/${f}`),
      'src/pages/404.astro',
      'src/i18n/zh-tw.json',
      'src/content/people.json',
      'src/content/locations.json',
      'src/content/illustrations.json',
    ];
    expect(sources.length).toBeGreaterThan(20);
    const texts = sources.map((file) => [file, readFileSync(file, 'utf-8')]);
    // The glossary as the site shows it: its translators' notes (`note`) never reach a page.
    texts.push(['src/content/glossary.json', JSON.stringify(glossaryShown())]);
    for (const [file, content] of texts) {
      for (const ch of content) {
        const cp = ch.codePointAt(0)!;
        if (cp >= 0xa0) expect(text.has(cp), `${file}: ${ch}`).toBe(true);
      }
    }
  });

  test("the glossary's translator notes are not shown, so their characters stay out of the subsets", () => {
    for (const dir of ['src/lib', 'src/components', 'src/pages', 'src/layouts']) {
      for (const f of readdirSync(dir, { recursive: true, encoding: 'utf-8' })) {
        if (/\.(ts|tsx|astro)$/.test(f)) expect(readFileSync(`${dir}/${f}`, 'utf-8'), f).not.toMatch(/\.note\b/);
      }
    }
    const notes = new Set([...glossary.map((g) => g.note ?? '').join('')].map((c) => c.codePointAt(0)!));
    const shown = new Set(chineseFaceText(collectCodepoints('src')));
    expect([...notes].filter((cp) => cp >= 0x4e00 && !shown.has(cp)).length).toBeGreaterThan(50);
  });

  test('the serif title face holds every name the site sets in it, and far fewer characters than the body', () => {
    const title = new Set(chineseFaceText(titleCodepoints('src')));
    const body = chineseFaceText(collectCodepoints('src'));
    const names = [
      ...readdirSync('src/content/events/zh-tw').map((f) => /^title:\s*(.*)$/m.exec(readFileSync(`src/content/events/zh-tw/${f}`, 'utf-8'))![1]),
      ...glossary.map((g) => g['zh-tw']),
      ...readJson<{ name: Record<string, string> }[]>('src/content/people.json').map((p) => p.name['zh-tw']),
      ...readJson<{ name: Record<string, string> }[]>('src/content/locations.json').map((p) => p.name['zh-tw']),
      readFileSync('src/i18n/zh-tw.json', 'utf-8'),
      readFileSync('src/lib/format.ts', 'utf-8'),
      readFileSync('src/components/MapView/shapes.ts', 'utf-8'),
    ];
    for (const name of names) {
      for (const ch of name) {
        const cp = ch.codePointAt(0)!;
        if (cp >= 0xa0) expect(title.has(cp), `${name.slice(0, 20)}: ${ch}`).toBe(true);
      }
    }
    expect(title.size).toBeLessThan(body.length * 0.4);
  });

  test('bold sans holds every term and note heading the stories set in bold, and far fewer characters than the body', () => {
    const bold = new Set(chineseFaceText(boldCodepoints('src')));
    const title = new Set(chineseFaceText(titleCodepoints('src')));
    expect([...title].every((cp) => bold.has(cp))).toBe(true);
    let checked = 0;
    for (const f of readdirSync('src/content/events/zh-tw')) {
      const story = readFileSync(`src/content/events/zh-tw/${f}`, 'utf-8');
      for (const m of story.matchAll(/{{[^}|]+\|([^}]+)}}|\*\*([^*]+)\*\*/g)) {
        for (const ch of m[1] ?? m[2]) {
          const cp = ch.codePointAt(0)!;
          if (cp >= 0xa0) expect(bold.has(cp), `${f}: ${ch}`).toBe(true);
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(300);
    expect(bold.size).toBeLessThan(chineseFaceText(collectCodepoints('src')).length * 0.5);
  });

  test('the faces are the three Chinese weights the site uses, from installed full fonts', () => {
    expect(CHINESE_FACES.map((f) => `${f.family} ${f.weight}`)).toEqual(['Noto Sans TC 400', 'Noto Sans TC 700', 'Noto Serif TC 700']);
    for (const f of CHINESE_FACES) expect(readFileSync(require.resolve(f.source)).length).toBeGreaterThan(1_000_000);
  });

  test('every subset keeps its copyright, licence and licence URL (OFL 1.1 section 2)', async () => {
    for (const face of CHINESE_FACES) {
      const font = readFileSync(require.resolve(face.source));
      const original = nameTable(font);
      // The same options as the build, as TrueType so the name table can be read directly.
      const names = nameTable(Buffer.from(await subsetFace(font, '紅山之戰', { targetFormat: 'truetype' })));
      expect(names.get(1), face.family).toBe(face.family);
      for (const id of [0, 13, 14]) {
        expect(names.get(id), `${face.family} name ${id}`).toBe(original.get(id));
        expect(names.get(id)?.length ?? 0).toBeGreaterThan(0);
      }
      expect(names.get(13)).toContain('SIL Open Font License');
      expect(names.get(14)).toMatch(/scripts\.sil\.org\/OFL|openfontlicense\.org/i);
      if (original.has(7)) expect(names.get(7)).toBe(original.get(7));
    }
    expect(KEPT_NAME_IDS).toEqual(expect.arrayContaining([0, 7, 13, 14]));
    // The build output is woff2.
    const woff2 = await subsetFace(readFileSync(require.resolve(CHINESE_FACES[0].source)), '紅');
    expect(Buffer.from(woff2).toString('latin1', 0, 4)).toBe('wOF2');
  });

  test('a licence text ships for every family the site uses', () => {
    expect(FONT_LICENSES.map((l) => l.to)).toEqual(['OFL-NotoSansTC.txt', 'OFL-NotoSerifTC.txt', 'OFL-Alegreya.txt', 'OFL-AlegreyaSans.txt']);
    for (const l of FONT_LICENSES) expect(readFileSync(require.resolve(l.from), 'utf-8')).toMatch(/SIL OPEN FONT LICENSE/i);
  });
});
