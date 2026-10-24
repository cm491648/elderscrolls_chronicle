import { describe, expect, test } from 'vitest';
import { eventsAtLocation, eventsInRegion } from '../../src/lib/lookup';
import type { EventMeta, Location } from '../../src/lib/types';

const ev = (id: string, locations: string[]): EventMeta => ({
  id, era: '1E', year: 1, order: 0, mapLayer: 'tamriel', locations,
  categories: ['war'], people: [], related: [], games: [], sources: [], certainty: 'canon', review: 'agreed',
});
const loc = (id: string, layer: Location['layer'], region: string): Location => ({
  id, layer, region, x: 0, y: 0, name: { en: id, 'zh-tw': id },
});

const events = [ev('a', ['red-mountain']), ev('b', ['white-gold']), ev('c', ['red-mountain', 'white-gold'])];
const locations = [loc('red-mountain', 'tamriel', 'morrowind'), loc('white-gold', 'tamriel', 'cyrodiil')];

describe('lookup', () => {
  test('events at a location keep input order', () => {
    expect(eventsAtLocation(events, 'red-mountain').map((e) => e.id)).toEqual(['a', 'c']);
  });

  test('events in a region on a layer', () => {
    expect(eventsInRegion(events, locations, 'tamriel', 'cyrodiil').map((e) => e.id)).toEqual(['b', 'c']);
    expect(eventsInRegion(events, locations, 'nirn', 'cyrodiil')).toEqual([]);
  });

  test('an event naming a whole region is listed there too, without a place in it', () => {
    const withRegion = [...events, { ...ev('d', []), mapLayer: 'cosmos' as const, regions: ['mundus'] }];
    expect(eventsInRegion(withRegion, locations, 'cosmos', 'mundus').map((e) => e.id)).toEqual(['d']);
    expect(eventsInRegion(withRegion, locations, 'tamriel', 'cyrodiil').map((e) => e.id)).toEqual(['b', 'c']);
  });
});
