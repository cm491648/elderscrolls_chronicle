import { describe, expect, test } from 'vitest';
import { validateContent, type ContentInput } from '../../src/lib/validate';
import { setMapSet } from '../../src/lib/map-set';
import type { EventMeta } from '../../src/lib/types';

const ev = (over: Partial<EventMeta> = {}): EventMeta => ({
  id: 'red-mountain-battle', era: '1E', year: 700, order: 0, mapLayer: 'tamriel',
  locations: ['red-mountain'], categories: ['war'], people: ['nerevar'], related: [], games: ['morrowind'],
  sources: [{ title: 'x', kind: 'book' }], certainty: 'disputed', review: 'agreed', ...over,
});

const base = (over: Partial<ContentInput> = {}): ContentInput => ({
  events: [ev()],
  translations: { en: ['red-mountain-battle'], 'zh-tw': ['red-mountain-battle'] },
  locations: [{ id: 'red-mountain', layer: 'morrowind', region: 'morrowind', x: 351, y: 305, drawn: { x: 732, y: 146 }, name: { en: 'Red Mountain', 'zh-tw': '紅山' } }],
  people: [{ id: 'nerevar', name: { en: 'Nerevar', 'zh-tw': '尼瑞瓦' }, summary: { en: '', 'zh-tw': '' } }],
  strict: false,
  ...over,
});

describe('validateContent', () => {
  test('valid content has no errors', () => {
    expect(validateContent(base())).toEqual([]);
  });

  test('timeline-only regions must exist too', () => {
    expect(validateContent(base({ events: [ev({ timelineRegions: ['oblivion'] })] }))).toEqual([]);
    expect(validateContent(base({ events: [ev({ timelineRegions: ['atlantis'] })] }))).toEqual([
      'red-mountain-battle: unknown timeline region "atlantis"',
    ]);
  });

  test('every area an event names must have a timeline lane', () => {
    // Pyandonea is a real region on the Nirn map, but no lane holds it yet.
    expect(validateContent(base({ events: [ev({ mapLayer: 'nirn', locations: [], regions: ['pyandonea'] })] }))).toEqual([
      'red-mountain-battle: region "pyandonea" has no timeline lane (add it to src/lib/lanes.ts)',
    ]);
  });

  test('an event is not related to itself', () => {
    expect(validateContent(base({ events: [ev({ related: ['red-mountain-battle'] })] }))).toEqual([
      'red-mountain-battle: lists itself as a related event',
    ]);
  });

  test('an approximate year needs a year', () => {
    expect(validateContent(base({ events: [ev({ era: 'dawn', year: null, circa: true, locations: [] })] }))).toEqual([
      'red-mountain-battle: circa needs a year',
    ]);
    expect(validateContent(base({ events: [ev({ circa: true })] }))).toEqual([]);
  });

  test('unknown location, person and related event', () => {
    const errors = validateContent(base({ events: [ev({ locations: ['nowhere'], people: ['nobody'], related: ['ghost'] })] }));
    expect(errors).toEqual([
      'red-mountain-battle: unknown location "nowhere"',
      'red-mountain-battle: unknown person "nobody"',
      'red-mountain-battle: unknown related event "ghost"',
    ]);
  });

  test('a location sits on the event map layer or a finer layer below it', () => {
    // Morrowind is below Tamriel, Nirn and the cosmos: all fine.
    for (const mapLayer of ['morrowind', 'tamriel', 'nirn', 'cosmos'] as const)
      expect(validateContent(base({ events: [ev({ mapLayer })] })), mapLayer).toEqual([]);
    // A sibling province is not.
    expect(validateContent(base({ events: [ev({ mapLayer: 'skyrim' })] }))).toEqual([
      'red-mountain-battle: location "red-mountain" is on layer morrowind, event is on skyrim',
    ]);
  });

  test('a location lies inside its region, unless it is open water', () => {
    const loc = base().locations[0];
    expect(validateContent(base({ locations: [{ ...loc, x: 20, y: 20 }] }))).toEqual([
      'location red-mountain: 20,20 lies outside morrowind',
    ]);
    // At sea on the drawn map too: the Inner Sea, off Vvardenfell.
    const drawnSea = { x: 765, y: 110 };
    expect(validateContent(base({ locations: [{ ...loc, x: 20, y: 20, sea: true, drawn: drawnSea }] }))).toEqual([]);
    // Sea, but on Morrowind's land, or off the Morrowind map.
    expect(validateContent(base({ locations: [{ ...loc, sea: true, drawn: drawnSea }] }))).toEqual([
      'location red-mountain: marked as sea but 351,305 lies on land',
    ]);
    expect(validateContent(base({ locations: [{ ...loc, x: 2000, y: 20, sea: true, drawn: drawnSea }] }))).toEqual([
      'location red-mountain: 2000,20 lies off the morrowind map',
    ]);
    expect(validateContent(base({ locations: [{ ...loc, region: 'skyrim' }] }))).toEqual([
      'location red-mountain: no region "skyrim" on layer morrowind',
      'location red-mountain: no region "skyrim" on the drawn morrowind layer',
    ]);
  });

  test('the checks do not depend on which map set is on screen (a drawn-only build switches before it validates)', () => {
    setMapSet('drawn');
    try {
      expect(validateContent(base())).toEqual([]);
    } finally {
      setMapSet('official');
    }
  });

  test('every place has a drawn position, inside its region on the drawn map (or at sea there)', () => {
    const loc = base().locations[0];
    expect(validateContent(base({ locations: [{ ...loc, drawn: undefined }] }))).toEqual(['location red-mountain: no drawn position']);
    // The drawn Morrowind's Inner Sea is not its land; Skyrim's middle is not Morrowind.
    expect(validateContent(base({ locations: [{ ...loc, drawn: { x: 765, y: 110 } }] }))).toEqual([
      'location red-mountain: drawn position 765,110 is not where its region needs it',
    ]);
    expect(validateContent(base({ locations: [{ ...loc, sea: true, x: 20, y: 20 }] }))).toEqual([
      'location red-mountain: drawn position 732,146 is not where its region needs it',
    ]);
  });

  test('event regions must exist and sit on the event map layer or below', () => {
    expect(validateContent(base({ events: [ev({ regions: ['morrowind', 'skyrim'] })] }))).toEqual([]);
    expect(validateContent(base({ events: [ev({ regions: ['atlantis'] })] }))).toEqual([
      'red-mountain-battle: unknown region "atlantis"',
    ]);
    // Atmora is on Nirn, above a Tamriel event.
    expect(validateContent(base({ events: [ev({ regions: ['atmora'] })] }))).toEqual([
      "red-mountain-battle: region \"atmora\" is above the event's layer tamriel",
    ]);
  });

  test('dated eras need a year and a valid range', () => {
    expect(validateContent(base({ events: [ev({ year: null })] }))).toContain('red-mountain-battle: era 1E requires a year');
    expect(validateContent(base({ events: [ev({ yearEnd: 600 })] }))).toContain('red-mountain-battle: yearEnd must be >= year');
    expect(validateContent(base({ events: [ev({ era: 'dawn', year: null })] }))).toEqual([]);
  });

  test('translations must pair with events', () => {
    const errors = validateContent(base({ translations: { en: ['red-mountain-battle'], 'zh-tw': ['orphan'] } }));
    expect(errors).toEqual(['red-mountain-battle: missing zh-tw text', 'orphan: zh-tw text has no event']);
  });

  test('strict builds reject unresolved reviews', () => {
    const input = base({ events: [ev({ review: 'unresolved' })] });
    expect(validateContent(input)).toEqual([]);
    expect(validateContent({ ...input, strict: true })).toEqual(['red-mountain-battle: review is unresolved']);
  });
});
