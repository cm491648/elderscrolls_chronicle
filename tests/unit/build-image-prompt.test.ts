// tests/unit/build-image-prompt.test.ts
import { describe, expect, test } from 'vitest';
import { assemblePrompt, refWarnings, selectRefs, staleRefCopies } from '../../scripts/build-image-prompt.mjs';
import { parseEntry } from '../../scripts/visual-canon.mjs';

const entry = (id: string, tes5: string, tes3: string | null, must: string, mistake: string) =>
  parseEntry(
    `---\nid: ${id}\ncategory: people\nname: { en: ${id}, zh-tw: ${id} }\nvariants:\n  default: tes5\n  tes5: "${tes5}"\n${tes3 ? `  tes3: "${tes3}"\n` : ''}refs: [${id}-tes3-1, ${id}-tes5-1]\nsources: [https://en.uesp.net/wiki/x]\n---\n\n## 必要特徵\n- ${must}\n\n## 常見錯誤\n- ${mistake}\n`,
    `${id}.md`,
  );

const entries = new Map([
  ['nerevarine', entry('nerevarine', 'TES5 hero', 'TES3 hero in netch leather', '手戴護手', 'Do not draw a knight in plate armour.')],
  ['dagoth-ur', entry('dagoth-ur', 'TES5 dagoth', 'golden mask, robes', '金色面具', 'Do not draw a skull instead of the mask.')],
]);
const parts = {
  instructions: 'TASK: save as {FILE}. IMAGE SIZE: {SIZE}',
  base: 'BASE TEXT',
  production: 'PRODUCTION TEXT',
  styles: { A: 'STYLE A TEXT', B: 'STYLE B TEXT' },
  forbidden: 'FORBIDDEN TEXT',
};
const subject = { era: '3E', year: 427, region: 'morrowind', phase: 1, entries: ['nerevarine', 'dagoth-ur'], overrides: {} };

describe('assemblePrompt', () => {
  const out = assemblePrompt({ subject, entries, parts, scene: 'SCENE TEXT', style: 'A', file: 'x.png', size: '1536x1024', available: ['nerevarine-tes3-1.jpg', 'nerevarine-tes5-1.jpg', 'dagoth-ur-tes3-1.png'] });

  test('puts the parts in order with the chosen style and the TES3 designs', () => {
    const order = ['TASK: save as x.png. IMAGE SIZE: 1536x1024', 'BASE TEXT', 'PRODUCTION TEXT', 'STYLE A TEXT', 'DESIGN REFERENCE', 'TES3 hero in netch leather', 'golden mask, robes', 'REFERENCE IMAGES', 'nerevarine-tes3-1.jpg', 'dagoth-ur-tes3-1.png', 'SCENE TEXT', 'FORBIDDEN TEXT', 'Do not draw a knight in plate armour.'];
    let at = -1;
    for (const piece of order) {
      const i = out.prompt.indexOf(piece);
      expect(i, piece).toBeGreaterThan(at);
      at = i;
    }
    expect(out.prompt).not.toContain('TES5 hero');
    expect(out.prompt).not.toContain('STYLE B TEXT');
  });

  test('lists only the reference images of the version used, not other games', () => {
    expect(out.prompt).not.toContain('nerevarine-tes5-1');
    expect(out.refFiles).toEqual(['nerevarine-tes3-1.jpg', 'dagoth-ur-tes3-1.png']);
  });

  test('lists every must-have feature in the checklist and returns the ref ids', () => {
    expect(out.checklist).toContain('- [ ] 手戴護手');
    expect(out.checklist).toContain('- [ ] 金色面具');
    expect(out.refIds).toEqual(['nerevarine-tes3-1', 'dagoth-ur-tes3-1']);
  });

  test('an override wins over the era rule; no reference images means no reference paragraph', () => {
    const o = assemblePrompt({ subject: { ...subject, overrides: { 'dagoth-ur': 'tes5' } }, entries, parts, scene: 'S', style: 'A', file: 'x.png', size: '1536x1024', available: [] });
    expect(o.prompt).toContain('TES5 dagoth');
    expect(o.prompt).not.toContain('REFERENCE IMAGES');
  });

  test('fails loudly on a style that has no text', () => {
    expect(() => assemblePrompt({ subject, entries, parts, scene: 'S', style: 'C', file: 'x.png', size: '1536x1024', available: [] })).toThrow(/style C/);
  });
});

describe('selectRefs', () => {
  const names = (ids: string[], ext = 'jpg') => ids.map((i) => `${i}.${ext}`);

  test('keeps only refs of the version the entry actually uses', () => {
    const refs = ['legion-tes3-1', 'legion-tes4-1', 'legion-tes5-1', 'legion-eso-1'];
    const out = selectRefs({ entries: [{ id: 'legion', version: 'tes5', refs }], available: names(refs) });
    expect(out).toEqual(['legion-tes5-1']);
  });

  test('skips refs that have no downloaded file', () => {
    const refs = ['a-tes5-1', 'a-tes5-2', 'a-tes5-3'];
    const out = selectRefs({ entries: [{ id: 'a', version: 'tes5', refs }], available: names(['a-tes5-2']) });
    expect(out).toEqual(['a-tes5-2']);
  });

  test('does not match a ref whose name is only a prefix of another file', () => {
    const out = selectRefs({ entries: [{ id: 'a', version: 'tes5', refs: ['a-tes5-1'] }], available: ['a-tes5-10.jpg'] });
    expect(out).toEqual([]);
  });

  test('picks round-robin across entries in event order', () => {
    const a = { id: 'a', version: 'tes5', refs: ['a-tes5-1', 'a-tes5-2'] };
    const b = { id: 'b', version: 'tes5', refs: ['b-tes5-1', 'b-tes5-2'] };
    const c = { id: 'c', version: 'tes5', refs: ['c-tes5-1'] };
    const available = names([...a.refs, ...b.refs, ...c.refs]);
    expect(selectRefs({ entries: [a, b, c], available })).toEqual(['a-tes5-1', 'b-tes5-1', 'c-tes5-1', 'a-tes5-2', 'b-tes5-2']);
  });

  test('caps at 5 by default and honours max', () => {
    const entries = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({ id, version: 'tes5', refs: [`${id}-tes5-1`] }));
    const available = names(entries.flatMap((e) => e.refs));
    expect(selectRefs({ entries, available })).toEqual(['a-tes5-1', 'b-tes5-1', 'c-tes5-1', 'd-tes5-1', 'e-tes5-1']);
    expect(selectRefs({ entries, available, max: 2 })).toEqual(['a-tes5-1', 'b-tes5-1']);
  });

  test('every entry with a usable ref gets one before any gets two, even when an entry has none', () => {
    const a = { id: 'a', version: 'tes5', refs: ['a-tes5-1', 'a-tes5-2', 'a-tes5-3'] };
    const none = { id: 'none', version: 'eso', refs: ['none-tes5-1'] };
    const b = { id: 'b', version: 'tes5', refs: ['b-tes5-1'] };
    const available = names([...a.refs, ...none.refs, ...b.refs]);
    expect(selectRefs({ entries: [a, none, b], available, max: 3 })).toEqual(['a-tes5-1', 'b-tes5-1', 'a-tes5-2']);
  });

  test('parses the version from the second-to-last segment for hyphenated entry ids', () => {
    const e = { id: 'imperial-legion-officer', version: 'tes5', refs: ['imperial-legion-officer-tes3-1', 'imperial-legion-officer-tes5-1', 'imperial-legion-officer-tes5-2'] };
    expect(selectRefs({ entries: [e], available: names(e.refs) })).toEqual(['imperial-legion-officer-tes5-1', 'imperial-legion-officer-tes5-2']);
  });

  test('an entry with no ref for its used version contributes none (no fallback)', () => {
    const e = { id: 'a', version: 'eso', refs: ['a-tes3-1', 'a-tes5-1'] };
    expect(selectRefs({ entries: [e], available: names(e.refs) })).toEqual([]);
  });
});

describe('refWarnings', () => {
  test('reports refs of the used version that are not downloaded, and refs dropped by the cap', () => {
    const entries = [
      { id: 'a', version: 'tes5', refs: ['a-tes3-1', 'a-tes5-1', 'a-tes5-2'] },
      { id: 'b', version: 'tes5', refs: ['b-tes5-1', 'b-tes5-2'] },
    ];
    const available = ['a-tes5-1.jpg', 'b-tes5-1.jpg', 'b-tes5-2.jpg'];
    const w = refWarnings({ entries, available, max: 2 });
    expect(w).toEqual([
      'warning: 參考圖 a-tes5-2 還沒下載（條目 a）',
      'warning: 參考圖 b-tes5-2 超過上限 2 張，未使用',
    ]);
  });

  test('is empty when everything is downloaded and fits', () => {
    const entries = [{ id: 'a', version: 'tes5', refs: ['a-tes5-1'] }];
    expect(refWarnings({ entries, available: ['a-tes5-1.jpg'] })).toEqual([]);
  });

  test('assemblePrompt returns the warnings for the CLI', () => {
    const o = assemblePrompt({ subject, entries, parts, scene: 'S', style: 'A', file: 'x.png', size: '1536x1024', available: ['nerevarine-tes3-1.jpg'] });
    expect(o.warnings).toEqual(['warning: 參考圖 dagoth-ur-tes3-1 還沒下載（條目 dagoth-ur）']);
  });
});

describe('version-scoped 必要特徵 and 常見錯誤', () => {
  const legion = parseEntry(
    [
      '---',
      'id: legion',
      'category: factions',
      'name: { en: Legion, zh-tw: 軍團 }',
      'variants:',
      '  default: tes5',
      '  tes4: "OBLIVION LEGION"',
      '  tes5: "SKYRIM LEGION"',
      'refs: []',
      'sources: [https://en.uesp.net/wiki/x]',
      '---',
      '',
      '## 必要特徵',
      '- 共通特徵',
      '- [tes4] 灰鋼全身板甲',
      '- [tes5] 紅布與皮甲',
      '',
      '## 常見錯誤',
      '- Do not use blue.',
      '- [tes4] Do not draw red cloth.',
      '- [tes5] Do not draw full plate.',
      '',
    ].join('\n'),
    'legion.md',
  );
  const legionEntries = new Map([['legion', legion]]);
  const run = (s: object) => assemblePrompt({ subject: { era: '4E', year: 201, region: 'skyrim', phase: 1, entries: ['legion'], overrides: {}, ...s }, entries: legionEntries, parts, scene: 'S', style: 'B', file: 'x.png', size: '1536x1024', available: [] });

  test('the prompt and checklist keep untagged items and items of the resolved version only', () => {
    const o = run({});
    expect(o.prompt).toContain('- Legion: Do not use blue.');
    expect(o.prompt).toContain('- Legion: Do not draw full plate.');
    expect(o.prompt).not.toContain('Do not draw red cloth.');
    expect(o.prompt).not.toContain('[tes');
    expect(o.checklist).toContain('- [ ] 共通特徵');
    expect(o.checklist).toContain('- [ ] 紅布與皮甲');
    expect(o.checklist).not.toContain('灰鋼全身板甲');
  });

  test('an override switches the scoped items with the snippet', () => {
    const o = run({ overrides: { legion: 'tes4' } });
    expect(o.prompt).toContain('OBLIVION LEGION');
    expect(o.prompt).toContain('Do not draw red cloth.');
    expect(o.prompt).not.toContain('Do not draw full plate.');
    expect(o.checklist).toContain('- [ ] 灰鋼全身板甲');
    expect(o.checklist).not.toContain('紅布與皮甲');
  });

  test('a version the entry lacks falls back to the default, and so do the scoped items', () => {
    const o = run({ era: '3E', year: 427, region: 'morrowind' }); // tes3 → no variant → default tes5
    expect(o.prompt).toContain('SKYRIM LEGION');
    expect(o.checklist).toContain('- [ ] 紅布與皮甲');
    expect(o.checklist).not.toContain('灰鋼全身板甲');
  });
});

describe('reference image hygiene', () => {
  test('the same image under two ref ids takes only one slot (deduped by URL)', () => {
    const a = { id: 'a', version: 'tes3', refs: ['a-tes3-1', 'a-tes3-2'] };
    const b = { id: 'b', version: 'tes3', refs: ['b-tes3-1', 'b-tes3-2'] };
    const available = ['a-tes3-1.jpg', 'a-tes3-2.jpg', 'b-tes3-1.jpg', 'b-tes3-2.jpg'];
    const urls = { 'a-tes3-1': 'https://x/1.jpg', 'a-tes3-2': 'https://x/2.jpg', 'b-tes3-1': 'https://x/1.jpg', 'b-tes3-2': 'https://x/3.jpg' };
    expect(selectRefs({ entries: [a, b], available, urls })).toEqual(['a-tes3-1', 'b-tes3-2', 'a-tes3-2']);
    expect(refWarnings({ entries: [a, b], available, urls })).toEqual([]);
  });

  test('assemblePrompt passes refUrls through to the selection', () => {
    const o = assemblePrompt({ subject, entries, parts, scene: 'S', style: 'B', file: 'x.png', size: '1536x1024', available: ['nerevarine-tes3-1.jpg', 'dagoth-ur-tes3-1.png'], refUrls: { 'nerevarine-tes3-1': 'https://x/same.jpg', 'dagoth-ur-tes3-1': 'https://x/same.jpg' } });
    expect(o.refIds).toEqual(['nerevarine-tes3-1']);
  });

  test('a leftover .part file does not count as downloaded', () => {
    const e = { id: 'a', version: 'tes5', refs: ['a-tes5-1', 'a-tes5-2'] };
    expect(selectRefs({ entries: [e], available: ['a-tes5-1.jpg.part', 'a-tes5-2.png'] })).toEqual(['a-tes5-2']);
    expect(refWarnings({ entries: [e], available: ['a-tes5-1.jpg.part', 'a-tes5-2.png'] })).toEqual(['warning: 參考圖 a-tes5-1 還沒下載（條目 a）']);
    const o = assemblePrompt({ subject, entries, parts, scene: 'S', style: 'B', file: 'x.png', size: '1536x1024', available: ['nerevarine-tes3-1.jpg.part', 'nerevarine-tes3-1.jpg', 'dagoth-ur-tes3-1.png.part'] });
    expect(o.refFiles).toEqual(['nerevarine-tes3-1.jpg']);
  });

  test('staleRefCopies lists reference copies in the output folder that this run does not use', () => {
    const files = ['prompt.txt', 'checklist.md', 'x.png', 'x-2.png', 'a-tes5-1.jpg', 'a-tes5-2.png', 'imperial-city-lore-1.webp', 'b-eso-3.jpg.part', 'notes-tes5.txt'];
    expect(staleRefCopies(files, ['a-tes5-1.jpg'])).toEqual(['a-tes5-2.png', 'imperial-city-lore-1.webp', 'b-eso-3.jpg.part']);
  });
});
