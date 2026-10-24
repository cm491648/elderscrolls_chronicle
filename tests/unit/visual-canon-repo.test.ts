// tests/unit/visual-canon-repo.test.ts
import { describe, expect, test } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { checkCanon, itemsFor, loadEntries, parseRefs } from '../../scripts/visual-canon.mjs';

const subjects = JSON.parse(readFileSync('docs/design/visual-canon/subjects.json', 'utf-8')) as Record<string, { era: string; year: number | null; region: string; phase: number; entries: string[]; overrides: Record<string, string> }>;
const frontmatter = (id: string) => readFileSync(`src/content/events/en/${id}.md`, 'utf-8').split('---')[1];
const published = readdirSync('src/content/events/en').map((f) => f.replace(/\.md$/, ''));

describe('visual canon subjects', () => {
  test('covers every published event with the content files’ era and year', () => {
    for (const id of published) {
      const s = subjects[id];
      expect(s, id).toBeDefined();
      expect([1, 2, 3], id).toContain(s.phase);
      const fm = frontmatter(id);
      expect(fm, id).toMatch(new RegExp(`^era: ${s.era}$`, 'm'));
      const year = fm.match(/^year: (.+)$/m)![1].trim();
      expect(String(s.year), id).toBe(year === 'null' ? 'null' : year);
      expect(s.entries.length, id).toBeGreaterThan(0);
    }
    // Every phase-1 and phase-3 subject is published (phase 3 adds a subject with its event); phase-2 subjects joined batch by batch.
    for (const [id, s] of Object.entries(subjects)) if (s.phase === 1 || s.phase === 3) expect(published, id).toContain(id);
  });
  test('lists the phase-2 candidates too (62 events in all)', () => {
    expect(Object.values(subjects).filter((s) => s.phase === 1 || s.phase === 2)).toHaveLength(62);
    expect(Object.values(subjects).filter((s) => s.phase === 2)).toHaveLength(42);
    expect(subjects['last-dragonborn-defeats-alduin']?.entries).toContain('last-dragonborn');
  });
  test('every reference image has an images.uesp.net address and a note', () => {
    const refs = parseRefs(readFileSync('docs/design/visual-canon/refs.md', 'utf-8'));
    expect(refs.length).toBeGreaterThan(0);
    for (const r of refs) {
      expect(r.url, r.id).toMatch(/^https:\/\/images\.uesp\.net\//);
      expect(r.note, r.id).not.toBe('');
    }
    expect(new Set(refs.map((r: { id: string }) => r.id)).size).toBe(refs.length);
  });
  test('every reference id is <entry-id>-<version>-<n> (the assembler reads the version from it)', () => {
    for (const r of parseRefs(readFileSync('docs/design/visual-canon/refs.md', 'utf-8'))) {
      const escaped = r.entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      expect(r.id, r.id).toMatch(new RegExp(`^${escaped}-(tes3|tes4|tes5|eso|lore)-\\d+$`));
    }
  });
});

describe('visual canon entries', () => {
  test('every subject, override and reference resolves', () => {
    const refs = parseRefs(readFileSync('docs/design/visual-canon/refs.md', 'utf-8'));
    expect(checkCanon({ entries: loadEntries(), subjects, refs })).toEqual([]);
  });
  test('every override names an entry the event actually uses', () => {
    for (const [id, s] of Object.entries(subjects)) {
      for (const key of Object.keys(s.overrides ?? {})) expect(s.entries, `${id}: ${key}`).toContain(key);
    }
  });
  test('no entry sends a reference marked 不適用 to the image model', () => {
    const notes = new Map(parseRefs(readFileSync('docs/design/visual-canon/refs.md', 'utf-8')).map((r: { id: string; note: string }) => [r.id, r.note] as const));
    for (const e of loadEntries().values()) {
      for (const r of e.refs) expect(String(notes.get(r) ?? '').startsWith('不適用'), `${e.id}: ${r}`).toBe(false);
    }
  });
  test('every entry follows the authoring rules', () => {
    const cjk = { test: (t: string) => [...t].some((c) => c.codePointAt(0)! >= 0x3000) };
    for (const e of loadEntries().values()) {
      for (const [k, raw] of Object.entries(e.variants)) {
        if (k === 'default') continue;
        const v = String(raw);
        expect(v.trim().split(/\s+/).length, `${e.id} ${k} words`).toBeLessThanOrEqual(80);
        expect(cjk.test(v), `${e.id} ${k} has CJK`).toBe(false);
      }
      expect(e.mustHave.length, `${e.id} 必要特徵`).toBeGreaterThanOrEqual(3);
      expect(e.mustHave.length, `${e.id} 必要特徵`).toBeLessThanOrEqual(6);
      expect(e.mistakes.length, `${e.id} 常見錯誤`).toBeGreaterThanOrEqual(2);
      expect(e.mistakes.length, `${e.id} 常見錯誤`).toBeLessThanOrEqual(4);
      for (const { text: m } of e.mistakes) {
        expect(m, e.id).toMatch(/^Do not /);
        expect(cjk.test(m), `${e.id} mistake has CJK`).toBe(false);
      }
      expect(e.sources.length, `${e.id} sources`).toBeGreaterThan(0);
    }
  });
  test('version-specific items use a [version] tag, not a version label in the text', () => {
    for (const e of loadEntries().values()) {
      for (const { text, versions } of e.mustHave) {
        if (!versions) expect(text, e.id).not.toMatch(/^(ESO|晨風|遺忘之都|天際|lore|神格|凡人奇莫|祭司|繼位者|戰場重建)[^，；]{0,12}版[（：]/);
      }
      for (const { text, versions } of e.mistakes) {
        if (!versions) expect(text, e.id).not.toMatch(/\((tes3|tes4|tes5|eso|lore)\)|in the (Skyrim|Oblivion|Morrowind|ESO) version|in his (Morrowind|Skyrim|Oblivion) form/);
      }
    }
  });
  test('the Last Dragonborn follows the user’s decision: iron horned helmet, face not shown', () => {
    const e = loadEntries().get('last-dragonborn')!;
    const must = itemsFor(e.mustHave, 'tes5').join(' ');
    expect(must).toMatch(/鐵製角盔/);
    expect(must).toMatch(/看不到臉|不露臉/);
  });
});
