import { describe, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  BINDINGS, bindingOf, byFirstMainEvent, byLastEvent, eventTopics, glossaryEntries, glossaryTopics, personEvents,
  personTopics, sortByName, sortByTimeline, termEventIndex,
} from '../../src/lib/sections';

describe('termEventIndex', () => {
  test('maps each term to the events that mark it, once each, in input order', () => {
    const index = termEventIndex({
      'great-war': 'The {{thalmor}} came. {{thalmor|They}} left. {{titus-mede-ii}}',
      'void-nights': 'The {{thalmor}} rose.',
    });
    expect(index.get('thalmor')).toEqual(['great-war', 'void-nights']);
    expect(index.get('titus-mede-ii')).toEqual(['great-war']);
    expect(index.get('nobody')).toBeUndefined();
  });
});

describe('sortByTimeline', () => {
  test('orders ids by their timeline position; unknown ids go last', () => {
    const order = new Map([['a', 0], ['b', 1], ['c', 2]]);
    expect(sortByTimeline(['c', 'x', 'a'], order)).toEqual(['a', 'c', 'x']);
  });
});

describe('personEvents', () => {
  const events = [
    { id: 'e1', people: ['tiber-septim'] },
    { id: 'e2', people: [] },
    { id: 'e3', people: ['tiber-septim'] },
  ];
  test('listed events are main; events that only mention the person are not', () => {
    const index = new Map([['tiber-septim', ['e2', 'e3']]]);
    expect(personEvents('tiber-septim', events, index)).toEqual([
      { id: 'e1', main: true },
      { id: 'e2', main: false },
      { id: 'e3', main: true },
    ]);
  });
});

describe('topics', () => {
  const topics = [
    { id: 't1', events: ['e1', 'e2'], people: ['a'] },
    { id: 't2', events: ['e3'], people: [] },
  ];
  test('eventTopics finds the topics holding an event', () => {
    expect(eventTopics(topics, 'e2').map((t) => t.id)).toEqual(['t1']);
    expect(eventTopics(topics, 'e9')).toEqual([]);
  });
  test('personTopics: named in the topic, or main figure of one of its events', () => {
    expect(personTopics(topics, 'a', new Set()).map((t) => t.id)).toEqual(['t1']);
    expect(personTopics(topics, 'b', new Set(['e3'])).map((t) => t.id)).toEqual(['t2']);
  });
});

describe('byLastEvent', () => {
  const order = new Map([['e1', 0], ['e2', 1], ['e3', 2], ['e4', 3]]);
  test('orders topics by where their last event falls on the timeline; topics with no events go last', () => {
    const topics = [
      { id: 'empty', events: [] },
      { id: 'long', events: ['e1', 'e4'] }, // starts first but ends last
      { id: 'short', events: ['e2'] },
      { id: 'unsorted', events: ['e3', 'e1'] }, // its ids need not be in timeline order
    ];
    expect(byLastEvent(topics, order).map((t) => t.id)).toEqual(['short', 'unsorted', 'long', 'empty']);
    expect(topics[0].id).toBe('empty'); // the input is left alone
  });
  test('ties keep their given order; events the timeline does not know are ignored', () => {
    const topics = [
      { id: 'b', events: ['e2'] },
      { id: 'a', events: ['e1', 'e2'] },
      { id: 'ghost', events: ['nowhere'] },
      { id: 'c', events: ['e1', 'nowhere'] },
    ];
    expect(byLastEvent(topics, order).map((t) => t.id)).toEqual(['c', 'b', 'a', 'ghost']);
  });
});

describe('eventTopics in the topics index order', () => {
  test('an event in several topics lists them by where their last event falls, whatever order they were given in', () => {
    const order = new Map([['e1', 0], ['e2', 1], ['e3', 2]]);
    const ordered = byLastEvent(
      [
        { id: 'late', events: ['e1', 'e3'] },
        { id: 'early', events: ['e1', 'e2'] },
        { id: 'other', events: ['e3'] },
      ],
      order,
    );
    expect(eventTopics(ordered, 'e1').map((t) => t.id)).toEqual(['early', 'late']);
  });
});

describe('bindingOf', () => {
  const lum = (hex: string) => {
    const c = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a: string, b: string) => {
    const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
    return (x + 0.05) / (y + 0.05);
  };
  const onLeatherSoft = readFileSync('src/styles/tokens.css', 'utf-8').match(/--on-leather-soft:\s*(#[0-9a-f]{6})/i)![1];
  test('a topic keeps its colour whatever its place in the list, and the colour comes from the palette', () => {
    expect(BINDINGS.length).toBeGreaterThanOrEqual(5);
    const ids = ['nords', 'great-war', 'oblivion-crisis', 'dragon-crisis', 'first-empire', 'the-warp', 'a', 'b', 'c', 'd'];
    const first = ids.map((id) => bindingOf(id));
    for (const id of [...ids].reverse()) expect(bindingOf(id)).toBe(first[ids.indexOf(id)]); // order of asking is irrelevant
    for (const c of first) expect(BINDINGS as readonly string[]).toContain(c);
    expect(new Set(first).size).toBeGreaterThan(2); // spread over the palette, not one colour
  });
  test('every binding is a deep tone: the small cover text stays readable on it', () => {
    for (const b of BINDINGS) expect(ratio(b, onLeatherSoft), b).toBeGreaterThanOrEqual(4.5);
    expect(new Set(BINDINGS).size).toBe(BINDINGS.length);
  });
});

describe('glossaryTopics', () => {
  const topics = [
    { id: 'pub-marks', status: 'published' as const, events: ['e1'], people: [] },
    { id: 'pub-about', status: 'published' as const, events: ['e2'], people: [] },
    { id: 'wip-about', status: 'planned' as const, events: ['e2'], people: ['torygg'] },
    { id: 'wip-marks', status: 'planned' as const, events: [], people: [] },
  ];
  const marks = new Map([['pub-marks', new Set(['torygg', 'thalmor'])], ['wip-marks', new Set(['thalmor'])]]);
  test('a term: the published topics whose text marks it', () => {
    expect(glossaryTopics(topics, 'thalmor', marks, null).map((t) => t.id)).toEqual(['pub-marks']);
  });
  test('a person: also the published topics about them, never a planned one', () => {
    expect(glossaryTopics(topics, 'torygg', marks, new Set(['e2'])).map((t) => t.id)).toEqual(['pub-marks', 'pub-about']);
  });
});

describe('sortByName', () => {
  test('Chinese by stroke count, English alphabetically', () => {
    // 人 (2 strokes), 十 (2), 三 (3), 中 (4): stroke order is 人十三中; code-point order would be 三中人十;
    // pinyin order would be 人三十中. So this fails unless the zh-tw collator really orders by stroke.
    const items = [
      { id: 'san', name: { en: 'Dunmer', 'zh-tw': '三' } },
      { id: 'ren', name: { en: 'Breton', 'zh-tw': '人' } },
      { id: 'zhong', name: { en: 'Cyrodiil', 'zh-tw': '中' } },
      { id: 'shi', name: { en: 'Altmer', 'zh-tw': '十' } },
    ];
    expect(sortByName(items, 'zh-tw').map((i) => i.id)).toEqual(['ren', 'shi', 'san', 'zhong']);
    expect(sortByName(items, 'en').map((i) => i.id)).toEqual(['shi', 'ren', 'zhong', 'san']);
    expect(items[0].id).toBe('san'); // the input is left alone
  });
});

describe('glossaryEntries', () => {
  const name = (en: string) => ({ en, 'zh-tw': en });
  const said = (s: string) => ({ en: s, 'zh-tw': s });
  const glossary = [
    { id: 'thalmor', name: name('Thalmor'), category: 'faction' as const, summary: said('g') },
    { id: 'lorkhan', name: name('Lorkhan'), category: 'deity' as const },
  ];
  const people = [
    { id: 'lorkhan', name: name('Lorkhan (people.json)'), summary: said('p') },
    { id: 'torygg', name: name('Torygg'), summary: said('t') },
    { id: 'hircine', name: name('Hircine'), summary: said('h'), category: 'deity' as const },
  ];
  test('the glossary terms as they are, then the people it has no entry for, as people unless they say otherwise', () => {
    expect(glossaryEntries(glossary, people)).toEqual([
      glossary[0],
      glossary[1],
      { id: 'torygg', name: name('Torygg'), category: 'person', summary: said('t') },
      { id: 'hircine', name: name('Hircine'), category: 'deity', summary: said('h') },
    ]);
  });
});

test('no glossary or person id clashes with an id the section pages use', () => {
  const reserved = ['main', 'site-nav-list', 'site-fonts', 'glossary-list', 'glossary-list-q', 'people-list', 'people-list-q'];
  const read = (file: string) => (JSON.parse(readFileSync(file, 'utf-8')) as { id: string }[]).map((g) => g.id);
  const people = read('src/content/people.json');
  const ids = [...read('src/content/glossary.json'), ...people];
  expect(people.length).toBeGreaterThan(100);
  expect(ids.filter((id) => reserved.includes(id) || id.startsWith('cat-'))).toEqual([]);
});

describe('byFirstMainEvent', () => {
  const order = new Map([['e1', 0], ['e2', 1], ['e3', 2], ['e4', 3]]);
  const at = (id: string, main: boolean) => ({ event: { id }, main });
  test('people sit where they first appear as a main figure, not where they are first mentioned', () => {
    const people = [
      { id: 'late', events: [at('e1', false), at('e4', true)] },
      { id: 'early', events: [at('e2', true), at('e3', true)] },
    ];
    expect(byFirstMainEvent(people, order).map((p) => p.id)).toEqual(['early', 'late']);
    expect(people[0].id).toBe('late'); // the input is left alone
  });
  test('a mention-only person by their first mention; no events (or none the timeline knows) last; ties keep their order', () => {
    const people = [
      { id: 'none', events: [] },
      { id: 'unknown', events: [at('nowhere', true)] },
      { id: 'mentioned', events: [at('e3', false)] },
      { id: 'tie-a', events: [at('e2', true)] },
      { id: 'tie-b', events: [at('e2', true)] },
    ];
    expect(byFirstMainEvent(people, order).map((p) => p.id)).toEqual(['tie-a', 'tie-b', 'mentioned', 'none', 'unknown']);
  });
  test('main events the timeline does not know are skipped, falling back to mentions', () => {
    const people = [
      { id: 'main-e3', events: [at('e3', true)] },
      { id: 'lost-main', events: [at('nowhere', true), at('e1', false)] },
    ];
    expect(byFirstMainEvent(people, order).map((p) => p.id)).toEqual(['lost-main', 'main-e3']);
  });
});
