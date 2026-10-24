import { describe, expect, it } from 'vitest';
import { pagePlaces } from '../../src/lib/page-data';
import type { Location } from '../../src/lib/types';

const place = (id: string, drawn?: { x: number; y: number }): Location =>
  ({ id, name: { en: id, 'zh-tw': id }, layer: 'tamriel', x: 1, y: 2, ...(drawn ? { drawn } : {}) }) as Location;

describe('pagePlaces', () => {
  const places = [place('a', { x: 5, y: 6 }), place('b')];

  it('leaves the drawn positions out of an official-map page', () => {
    const out = pagePlaces(places, 'official');
    expect(out.map((p) => 'drawn' in p)).toEqual([false, false]);
    expect(out[0]).toEqual({ id: 'a', name: { en: 'a', 'zh-tw': 'a' }, layer: 'tamriel', x: 1, y: 2 });
    expect(places[0].drawn).toEqual({ x: 5, y: 6 });
  });

  it('keeps them on a drawn-map page', () => {
    expect(pagePlaces(places, 'drawn')).toBe(places);
  });
});
