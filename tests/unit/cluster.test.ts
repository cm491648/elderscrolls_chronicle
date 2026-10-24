import { describe, expect, test } from 'vitest';
import { clusterPoints, fanOut, fanOutGroups, joinClusterTitles } from '../../src/lib/cluster';

describe('clusterPoints', () => {
  test('empty input', () => {
    expect(clusterPoints([], 10)).toEqual([]);
  });

  test('far apart points stay separate, sorted by x', () => {
    expect(clusterPoints([{ id: 'b', x: 100 }, { id: 'a', x: 0 }], 10)).toEqual([
      { ids: ['a'], x: 0 },
      { ids: ['b'], x: 100 },
    ]);
  });

  test('chained close points merge and use the mean x', () => {
    expect(clusterPoints([{ id: 'a', x: 0 }, { id: 'b', x: 8 }, { id: 'c', x: 16 }, { id: 'd', x: 60 }], 10)).toEqual([
      { ids: ['a', 'b', 'c'], x: 8 },
      { ids: ['d'], x: 60 },
    ]);
  });
});

describe('fanOut', () => {
  const xs = (pts: { id: string; x: number }[]) => pts.map((p) => p.x);
  test('points already far enough apart keep their places, sorted by x', () => {
    expect(fanOut([{ id: 'b', x: 100 }, { id: 'a', x: 0 }], 10)).toEqual([
      { id: 'a', x: 0 },
      { id: 'b', x: 100 },
    ]);
  });
  test('points at the same place spread out around it, keeping their order', () => {
    const out = fanOut([{ id: 'a', x: 50 }, { id: 'b', x: 50 }, { id: 'c', x: 50 }], 10);
    expect(out.map((p) => p.id)).toEqual(['a', 'b', 'c']);
    expect(xs(out)).toEqual([40, 50, 60]);
  });
  test('every neighbour ends at least the gap apart, even in a crowd', () => {
    const pts = [0, 2, 3, 5, 30, 31, 32, 70].map((x, i) => ({ id: String(i), x }));
    const out = xs(fanOut(pts, 10));
    for (let i = 1; i < out.length; i++) expect(out[i] - out[i - 1]).toBeGreaterThanOrEqual(10 - 1e-9);
  });
  test('a spread run stays centred on its points', () => {
    const out = xs(fanOut([{ id: 'a', x: 100 }, { id: 'b', x: 104 }], 10));
    expect((out[0] + out[1]) / 2).toBeCloseTo(102);
  });
  test('stays inside the band when one is given', () => {
    const out = xs(fanOut([{ id: 'a', x: 99 }, { id: 'b', x: 100 }, { id: 'c', x: 100 }], 10, 0, 100));
    expect(Math.max(...out)).toBeLessThanOrEqual(100);
    expect(out[1] - out[0]).toBeGreaterThanOrEqual(10 - 1e-9);
  });
});

describe('fanOutGroups', () => {
  test('events at the same place stay one group, in their input order', () => {
    expect(fanOutGroups([{ id: 'a', x: 50 }, { id: 'b', x: 200 }, { id: 'c', x: 50 }], 10)).toEqual([
      { ids: ['a', 'c'], x: 50 },
      { ids: ['b'], x: 200 },
    ]);
  });
  test('groups at nearby places are spread like single points, never merged', () => {
    const out = fanOutGroups([{ id: 'a', x: 100 }, { id: 'b', x: 100 }, { id: 'c', x: 103 }, { id: 'd', x: 106 }], 10);
    expect(out.map((g) => g.ids)).toEqual([['a', 'b'], ['c'], ['d']]);
    for (let i = 1; i < out.length; i++) expect(out[i].x - out[i - 1].x).toBeGreaterThanOrEqual(10 - 1e-9);
  });
  test('stays inside the band when one is given', () => {
    const out = fanOutGroups([{ id: 'a', x: 99 }, { id: 'b', x: 100 }, { id: 'c', x: 100 }], 10, 0, 100);
    expect(out.map((g) => g.ids)).toEqual([['a'], ['b', 'c']]);
    expect(Math.max(...out.map((g) => g.x))).toBeLessThanOrEqual(100);
  });
});

describe('joinClusterTitles', () => {
  test('joins with a comma and space for English', () => {
    expect(joinClusterTitles(['A', 'B', 'C'], 'en')).toBe('A, B, C');
  });

  test('joins with the enumeration comma for zh-tw', () => {
    expect(joinClusterTitles(['紅山之戰', '首次議會'], 'zh-tw')).toBe('紅山之戰、首次議會');
  });

  test('single and empty lists', () => {
    expect(joinClusterTitles(['A'], 'en')).toBe('A');
    expect(joinClusterTitles([], 'zh-tw')).toBe('');
  });
});
