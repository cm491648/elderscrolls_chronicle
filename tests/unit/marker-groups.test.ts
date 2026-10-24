import { expect, test } from 'vitest';
import { groupMarkers, separatingScale } from '../../src/lib/marker-groups';

const p = (id: string, x: number, y: number) => ({ id, x, y });

test('markers closer on screen than the gap merge; the group sits at their mean', () => {
  // At zoom 1 the first two are 20 px apart (< 28), the third far away.
  const groups = groupMarkers([p('a', 0, 0), p('b', 20, 0), p('c', 200, 0)], 1, 28);
  expect(groups).toEqual([
    { ids: ['a', 'b'], x: 10, y: 0 },
    { ids: ['c'], x: 200, y: 0 },
  ]);
});

test('the same markers split once the zoom spreads them past the gap', () => {
  expect(groupMarkers([p('a', 0, 0), p('b', 20, 0)], 1.5, 28).map((g) => g.ids)).toEqual([['a'], ['b']]);
});

test('distance is measured in two dimensions, and chains merge', () => {
  expect(groupMarkers([p('a', 0, 0), p('b', 15, 15)], 1, 28).map((g) => g.ids)).toEqual([['a', 'b']]);
  expect(groupMarkers([p('a', 0, 0), p('b', 20, 20)], 1, 28).map((g) => g.ids)).toEqual([['a'], ['b']]);
  // a-b and b-c are close, a-c is not: one group of three.
  expect(groupMarkers([p('a', 0, 0), p('b', 25, 0), p('c', 50, 0)], 1, 28).map((g) => g.ids)).toEqual([['a', 'b', 'c']]);
});

test('input order is kept inside and across groups', () => {
  const groups = groupMarkers([p('z', 100, 0), p('y', 0, 0), p('x', 110, 0)], 1, 28);
  expect(groups.map((g) => g.ids)).toEqual([['z', 'x'], ['y']]);
});

test('the zoom that separates a group: its closest pair a little past the gap', () => {
  // Closest pair 10 units apart: 28 / 10 = 2.8, with 15% to spare.
  expect(separatingScale([p('a', 0, 0), p('b', 10, 0), p('c', 0, 30)], 28)).toBeCloseTo(2.8 * 1.15);
  // Two markers in the very same spot never separate.
  expect(separatingScale([p('a', 5, 5), p('b', 5, 5)], 28)).toBe(Infinity);
});
