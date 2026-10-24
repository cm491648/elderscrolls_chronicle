import { describe, expect, test, vi } from 'vitest';
import { loadSearchIndex, normalize, searchEvents, snippetAround, type SearchEntry } from '../../src/lib/search';

const index: SearchEntry[] = [
  { id: 'dragon-war', titles: ['龍之戰爭', 'Dragon War'], names: ['奧杜因', 'Alduin', '帕圖納克斯', 'Paarthurnax'], text: '拜龍教統治天際的時代，龍祭司替巨龍管理人類。' },
  { id: 'tiber-septim-crowned', titles: ['泰伯·賽普汀加冕', 'Tiber Septim Crowned'], names: ['塔洛斯', 'Talos'], text: '他後來被奉為塔洛斯。' },
  { id: 'planemeld', titles: ['莫拉格·巴爾的位面融合', "Molag Bal's Planemeld"], names: ['莫拉格·巴爾', 'Molag Bal'], text: '黑暗錨從天而降。' },
  { id: 'return-of-alduin', titles: ['奧杜因回歸', 'Return of Alduin'], names: ['奧杜因', 'Alduin'], text: '世界吞噬者回來了。' },
];

describe('normalize', () => {
  test('folds case, accents, spaces and the name dots', () => {
    expect(normalize('Nérevar')).toBe('nerevar');
    expect(normalize('Molag  Bal')).toBe('molagbal');
    expect(normalize('莫拉格·巴爾')).toBe('莫拉格巴爾');
    expect(normalize('莫拉格‧巴爾')).toBe('莫拉格巴爾');
    expect(normalize('ＡＢＣ')).toBe('abc');
  });
});

describe('searchEvents', () => {
  test('a title match ranks above a name match; each level keeps timeline order', () => {
    expect(searchEvents(index, '奧杜因').map((h) => [h.id, h.field])).toEqual([
      ['return-of-alduin', 'title'],
      ['dragon-war', 'name'],
    ]);
  });
  test('either language finds the event, whatever the case, spacing or name dots', () => {
    expect(searchEvents(index, 'ALDUIN').map((h) => h.id)).toEqual(['return-of-alduin', 'dragon-war']);
    expect(searchEvents(index, '莫拉格巴爾')[0]).toMatchObject({ id: 'planemeld', field: 'title' });
    expect(searchEvents(index, 'molag bal')[0].id).toBe('planemeld');
  });
  test('a name hit says which name matched', () => {
    expect(searchEvents(index, 'talos')).toEqual([{ id: 'tiber-septim-crowned', field: 'name', name: 'Talos', snippet: null }]);
  });
  test('each event appears once, under its best field', () => {
    const hits = searchEvents(index, '塔洛斯');
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatchObject({ id: 'tiber-septim-crowned', field: 'name', name: '塔洛斯' });
  });
  test('a body hit comes with a snippet around the match', () => {
    const [hit] = searchEvents(index, '龍祭司');
    expect(hit).toMatchObject({ id: 'dragon-war', field: 'text', name: null });
    expect(hit.snippet).toEqual({ before: '拜龍教統治天際的時代，', match: '龍祭司', after: '替巨龍管理人類。' });
  });
  test('a blank query finds nothing', () => {
    expect(searchEvents(index, '')).toEqual([]);
    expect(searchEvents(index, ' · ')).toEqual([]);
  });
  test('nothing matching finds nothing', () => {
    expect(searchEvents(index, '索瑟·希爾')).toEqual([]);
  });
});

describe('snippetAround', () => {
  test('keeps about 20 characters on each side and marks where it cut', () => {
    const text = 'a'.repeat(100) + 'Needle' + 'b'.repeat(100);
    const s = snippetAround(text, 'needle')!;
    expect(s.match).toBe('Needle');
    expect(s.before).toBe('…' + 'a'.repeat(20));
    expect(s.after).toBe('b'.repeat(20) + '…');
  });
  test('the match is found on the text itself, even where lowercasing changes the length', () => {
    // 'İ' lowercases to two UTF-16 units: positions taken from a lowercased copy would be off by one.
    expect(snippetAround('İstanbul and the Needle', 'needle')).toEqual({ before: 'İstanbul and the ', match: 'Needle', after: '' });
  });
  test('a cut never splits a character that takes two UTF-16 units', () => {
    const rare = '\u{20BB7}'; // 𠮷, outside the BMP: two UTF-16 units
    // Both cuts (20 units from the match) would land on the second half of `rare`.
    const text = 'z' + rare + 'a'.repeat(19) + 'X' + 'b'.repeat(19) + rare + 'c';
    expect(snippetAround(text, 'x')).toEqual({ before: '…' + rare + 'a'.repeat(19), match: 'X', after: 'b'.repeat(19) + rare + '…' });
  });
  test('no cut marks when the text is short; null when the query is not in the text', () => {
    expect(snippetAround('天際的龍', '龍')).toEqual({ before: '天際的', match: '龍', after: '' });
    expect(snippetAround('天際', '龍')).toBeNull();
  });
});

describe('loadSearchIndex', () => {
  const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
  test('fetches once per language and can retry after a failure', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 503 }))
      .mockImplementation(() => ok(index));
    await expect(loadSearchIndex('en', fetcher)).rejects.toThrow('search index: HTTP 503');
    expect(await loadSearchIndex('en', fetcher)).toHaveLength(4);
    await loadSearchIndex('en', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(String(fetcher.mock.calls[0][0])).toMatch(/\/en\/search\.json$/);
    // A hung request is cut off rather than leaving the panel loading for ever.
    expect(fetcher.mock.calls[0][1]?.signal).toBeInstanceOf(AbortSignal);
  });
});
