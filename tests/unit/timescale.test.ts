import { describe, expect, test } from 'vitest';
import { buildSegments, createTimescale, ERA_YEAR_SCALE, PX_PER_YEAR } from '../../src/lib/timescale';

const ev = (id: string, era: any, year: number | null, order = 0) => ({ id, era, year, order });

describe('buildSegments', () => {
  test('segments are contiguous in era order; dated eras are their years at their own year width', () => {
    const segs = buildSegments();
    expect(segs.map((s) => s.era)).toEqual(['dawn', 'merethic', '1E', '2E', '3E', '4E']);
    for (let i = 1; i < segs.length; i++) expect(segs[i].start).toBe(segs[i - 1].end);
    expect(segs[0]).toEqual({ era: 'dawn', start: 0, end: 400, fixed: true, pxPerYear: 0 });
    expect(segs[1]).toEqual({ era: 'merethic', start: 400, end: 800, fixed: true, pxPerYear: 0 });
    const years = { '1E': 2920, '2E': 896, '3E': 433, '4E': 201 } as const;
    for (const s of segs.slice(2)) {
      const era = s.era as keyof typeof years;
      expect(s.fixed).toBe(false);
      expect(s.pxPerYear).toBeCloseTo(ERA_YEAR_SCALE[era] * PX_PER_YEAR);
      expect(s.end - s.start).toBeCloseTo(years[era] * s.pxPerYear);
    }
  });

  test('the First Era is squeezed and the Third and Fourth widened (decisions/p4-design B)', () => {
    expect(ERA_YEAR_SCALE).toEqual({ '1E': 1 / 3, '2E': 1, '3E': 1.5, '4E': 2 });
  });
});

describe('createTimescale', () => {
  test('places dated events by year', () => {
    const s = createTimescale([ev('red-mountain', '1E', 700), ev('helgen', '4E', 201)]);
    const seg = (era: string) => buildSegments().find((x) => x.era === era)!;
    expect(s.totalWidth).toBeCloseTo(seg('4E').end);
    expect(s.x('red-mountain')).toBeCloseTo(seg('1E').start + 700 / 3);
    expect(s.x('helgen')).toBeCloseTo(seg('4E').end);
  });

  test('clamps years outside the era', () => {
    const s = createTimescale([ev('late', '3E', 500), ev('early', '2E', -5)]);
    const seg = (era: string) => buildSegments().find((x) => x.era === era)!;
    expect(s.x('late')).toBeCloseTo(seg('3E').end);
    expect(s.x('early')).toBeCloseTo(seg('2E').start);
  });

  test('spaces undated events evenly by order inside fixed eras', () => {
    const s = createTimescale([ev('c', 'dawn', null, 3), ev('a', 'dawn', null, 1), ev('b', 'dawn', null, 2)]);
    expect([s.x('a'), s.x('b'), s.x('c')]).toEqual([100, 200, 300]);
  });

  test('orders events by position, then order, then id', () => {
    const s = createTimescale([
      ev('z', '1E', 10, 2),
      ev('y', '1E', 10, 1),
      ev('m', 'merethic', null, 0),
      ev('x', '1E', 10, 1),
    ]);
    expect(s.ordered).toEqual(['m', 'x', 'y', 'z']);
  });

  test('throws for unknown ids', () => {
    expect(() => createTimescale([]).x('nope')).toThrow('Unknown event: nope');
  });
});

test('span runs from the first year to the last, and is a point without an end year or a date', () => {
  const s = createTimescale([
    { id: 'war', era: '4E', year: 171, yearEnd: 175, order: 0 },
    { id: 'one', era: '4E', year: 201, order: 0 },
    { id: 'dawn', era: 'dawn', year: null, order: 0 },
  ]);
  const [a, b] = s.span('war');
  expect(a).toBe(s.x('war'));
  expect(b - a).toBeCloseTo(4 * ERA_YEAR_SCALE['4E'] * PX_PER_YEAR);
  expect(s.span('one')).toEqual([s.x('one'), s.x('one')]);
  expect(s.span('dawn')).toEqual([s.x('dawn'), s.x('dawn')]);
});
