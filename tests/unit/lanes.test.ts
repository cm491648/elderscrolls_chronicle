import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { buildLanes, eventAreas, laneChoices, laneOfArea, TOP_LANES, type LaneId } from '../../src/lib/lanes';

const regionOf = (id: string) => ({ 'red-mountain': 'morrowind', 'white-gold': 'cyrodiil' } as Record<string, string>)[id];
const ev = (id: string, regions: string[] = [], locations: string[] = []) => ({ id, regions, locations });
const EVENTS = [
  ev('mundus', ['mundus']),
  ev('ehlnofey', ['akavir', 'atmora', 'tamriel', 'yokuda']),
  ev('red', [], ['red-mountain']),
  ev('diamond', ['high-rock', 'skyrim', 'hammerfell']),
  ev('crisis', [], ['white-gold']),
];
const opts = (o: Partial<{ expanded: boolean; hidden: LaneId[]; selectedId: string | null }> = {}) => ({
  expanded: o.expanded ?? false, hidden: new Set(o.hidden ?? []), selectedId: o.selectedId ?? null,
});
const ids = (lanes: ReturnType<typeof buildLanes>) => lanes.map((l) => l.id);

describe('lanes', () => {
  test('areas come from regions and from the locations\' regions, once each', () => {
    expect(eventAreas(ev('x', ['skyrim'], ['red-mountain', 'red-mountain']), regionOf)).toEqual(['morrowind', 'skyrim']);
  });
  test('an event drawn on an extra lane for the timeline only counts that area too', () => {
    expect(eventAreas({ locations: ['white-gold'], timelineRegions: ['oblivion'] }, regionOf)).toEqual(['cyrodiil', 'oblivion']);
    const lanes = buildLanes([{ id: 'burst', locations: ['white-gold'], timelineRegions: ['oblivion'] }], regionOf, opts());
    expect(lanes.map((l) => l.id)).toEqual(['realms', 'tamriel']);
  });
  test('every area has a lane; the three planes share the realms lane', () => {
    expect(['mundus', 'aetherius', 'oblivion'].map(laneOfArea)).toEqual(['realms', 'realms', 'realms']);
    expect(laneOfArea('skyrim')).toBe('skyrim');
    expect(laneOfArea('nowhere')).toBeNull();
  });
  test('collapsed: the top lanes in order, provinces folded into Tamriel, an event once per lane', () => {
    const lanes = buildLanes(EVENTS, regionOf, opts());
    expect(ids(lanes)).toEqual(['realms', 'atmora', 'akavir', 'yokuda', 'tamriel']);
    const tamriel = lanes.find((l) => l.id === 'tamriel')!;
    expect(tamriel.ids).toEqual(['ehlnofey', 'red', 'diamond', 'crisis']);
    expect(tamriel.expandable).toBe(true);
  });
  test('expanded: the provinces with events follow Tamriel, in map order; empty ones are left out', () => {
    const lanes = buildLanes(EVENTS, regionOf, opts({ expanded: true }));
    expect(ids(lanes)).toEqual(['realms', 'atmora', 'akavir', 'yokuda', 'tamriel', 'high-rock', 'skyrim', 'morrowind', 'hammerfell', 'cyrodiil']);
    expect(lanes.find((l) => l.id === 'tamriel')!.ids).toEqual(['ehlnofey']);
    expect(lanes.filter((l) => l.depth === 1).every((l) => l.ids.length > 0)).toBe(true);
    expect(lanes.find((l) => l.id === 'skyrim')!.ids).toEqual(['diamond']);
  });
  test('a lane with no events is not drawn', () => {
    expect(ids(buildLanes([ev('red', [], ['red-mountain'])], regionOf, opts()))).toEqual(['tamriel']);
  });
  test('hidden lanes are left out; hiding Tamriel hides its provinces; a hidden province leaves the folded lane too', () => {
    expect(ids(buildLanes(EVENTS, regionOf, opts({ hidden: ['akavir'] })))).not.toContain('akavir');
    expect(ids(buildLanes(EVENTS, regionOf, opts({ expanded: true, hidden: ['tamriel'] })))).toEqual(['realms', 'atmora', 'akavir', 'yokuda']);
    const folded = buildLanes(EVENTS, regionOf, opts({ hidden: ['morrowind'] })).find((l) => l.id === 'tamriel')!;
    expect(folded.ids).not.toContain('red');
  });
  test('the selected event shows its lanes for now when all of them are hidden', () => {
    const lanes = buildLanes(EVENTS, regionOf, opts({ hidden: ['realms'], selectedId: 'mundus' }));
    expect(lanes.find((l) => l.id === 'realms')).toMatchObject({ temporary: true, ids: ['mundus'] });
    // Visible somewhere already: nothing comes back.
    expect(ids(buildLanes(EVENTS, regionOf, opts({ hidden: ['akavir'], selectedId: 'ehlnofey' })))).not.toContain('akavir');
  });
  test('the region menu lists every lane that has events, provinces under Tamriel', () => {
    expect(laneChoices(EVENTS, regionOf).map((c) => `${c.depth}:${c.id}`)).toEqual([
      '0:realms', '0:atmora', '0:akavir', '0:yokuda', '0:tamriel',
      '1:high-rock', '1:skyrim', '1:morrowind', '1:hammerfell', '1:cyrodiil',
    ]);
  });
  test('every event of the chronicle falls into a lane', () => {
    const locations = JSON.parse(readFileSync('src/content/locations.json', 'utf-8')) as { id: string; region: string }[];
    const of = (id: string) => locations.find((l) => l.id === id)?.region;
    for (const f of readdirSync('src/content/events/en')) {
      const fm = readFileSync(`src/content/events/en/${f}`, 'utf-8').split('---')[1];
      const list = (k: string) => (fm.match(new RegExp(`^${k}:\\s*\\[(.*)\\]`, 'm'))?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean);
      const areas = eventAreas({ locations: list('locations'), regions: list('regions') }, of);
      expect(areas.length, f).toBeGreaterThan(0);
      for (const a of areas) expect(laneOfArea(a), `${f}: ${a}`).not.toBeNull();
    }
    expect(TOP_LANES).toEqual(['realms', 'atmora', 'akavir', 'yokuda', 'tamriel']);
  });
});
