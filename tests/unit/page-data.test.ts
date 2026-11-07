import { describe, expect, it } from 'vitest';
import { pagePlaces } from '../../src/lib/page-data';
import type { Location } from '../../src/lib/types';

const place = (id: string, drawn?: { x: number; y: number }): Location =>
  ({ id, name: { en: id, 'zh-tw': `${id}-zh` }, layer: 'tamriel', x: 1, y: 2, ...(drawn ? { drawn } : {}) }) as Location;

describe('pagePlaces', () => {
  const places = [place('a', { x: 5, y: 6 }), place('b')];

  it('leaves the drawn positions and the other language out of an official-map page', () => {
    const out = pagePlaces(places, 'official', 'zh-tw');
    expect(out.map((p) => 'drawn' in p)).toEqual([false, false]);
    expect(out[0]).toEqual({ id: 'a', name: { 'zh-tw': 'a-zh' }, layer: 'tamriel', x: 1, y: 2 });
    expect(places[0].drawn).toEqual({ x: 5, y: 6 });
    expect(places[0].name).toEqual({ en: 'a', 'zh-tw': 'a-zh' });
  });

  it('keeps the drawn positions on a drawn-map page, still with one language', () => {
    const out = pagePlaces(places, 'drawn', 'en');
    expect(out[0]).toEqual({ id: 'a', name: { en: 'a' }, layer: 'tamriel', x: 1, y: 2, drawn: { x: 5, y: 6 } });
  });
});
