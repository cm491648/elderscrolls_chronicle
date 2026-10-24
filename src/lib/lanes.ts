/** Timeline lanes: which strip each event is drawn on, worked out from the areas it already names (no DOM). */
import { PROVINCES, type Province } from './types';

export const TOP_LANES = ['realms', 'atmora', 'akavir', 'yokuda', 'tamriel'] as const;
export type LaneId = (typeof TOP_LANES)[number] | Province;

const AREA_LANE: Record<string, LaneId> = {
  mundus: 'realms', aetherius: 'realms', oblivion: 'realms',
  atmora: 'atmora', akavir: 'akavir', yokuda: 'yokuda', tamriel: 'tamriel',
  ...Object.fromEntries(PROVINCES.map((p) => [p, p])),
};

export function laneOfArea(area: string): LaneId | null {
  return AREA_LANE[area] ?? null;
}

export function isProvinceLane(id: LaneId): id is Province {
  return (PROVINCES as readonly string[]).includes(id);
}

type Placed = { id: string; locations: string[]; regions?: string[]; timelineRegions?: string[] };
type RegionOf = (locationId: string) => string | undefined;

/** The areas an event covers: its regions, its timeline-only regions and the region of each of its places, once each, sorted. */
export function eventAreas(e: Omit<Placed, 'id'>, regionOf: RegionOf): string[] {
  const out = new Set([...(e.regions ?? []), ...(e.timelineRegions ?? [])]);
  for (const id of e.locations) {
    const r = regionOf(id);
    if (r) out.add(r);
  }
  return [...out].sort();
}

export interface Lane {
  id: LaneId;
  /** 0 for the top lanes, 1 for a province under Tamriel. */
  depth: 0 | 1;
  /** Tamriel, when it has provinces to open. */
  expandable: boolean;
  /** The events drawn on this lane, in the order given (time order). */
  ids: string[];
  /** Shown only because the selected event has no other lane on screen. */
  temporary: boolean;
}

export interface LaneOptions {
  expanded: boolean;
  hidden: ReadonlySet<LaneId>;
  selectedId: string | null;
}

/** The lanes an event lands on: provinces fold into Tamriel unless it is open. */
function lanesOf(e: Placed, regionOf: RegionOf, expanded: boolean): LaneId[] {
  const out = new Set<LaneId>();
  for (const a of eventAreas(e, regionOf)) {
    const lane = laneOfArea(a);
    if (lane) out.add(!expanded && isProvinceLane(lane) ? 'tamriel' : lane);
  }
  return [...out];
}

const ORDER: LaneId[] = [...TOP_LANES, ...PROVINCES];

/** Every lane that has events, provinces under Tamriel: what the region menu lists. */
export function laneChoices(events: Placed[], regionOf: RegionOf): { id: LaneId; depth: 0 | 1 }[] {
  const used = new Set(events.flatMap((e) => lanesOf(e, regionOf, true)));
  if ([...used].some(isProvinceLane)) used.add('tamriel');
  return ORDER.filter((id) => used.has(id)).map((id) => ({ id, depth: isProvinceLane(id) ? 1 : 0 }));
}

export function buildLanes(events: Placed[], regionOf: RegionOf, opts: LaneOptions): Lane[] {
  const { expanded, hidden, selectedId } = opts;
  // A hidden province is gone from the timeline, also from the folded Tamriel lane.
  const visibleAreaLane = (e: Placed): LaneId[] => {
    const out = new Set<LaneId>();
    for (const a of eventAreas(e, regionOf)) {
      const lane = laneOfArea(a);
      if (!lane || hidden.has(lane)) continue;
      if (isProvinceLane(lane) && hidden.has('tamriel')) continue;
      out.add(!expanded && isProvinceLane(lane) ? 'tamriel' : lane);
    }
    return [...out];
  };
  const byLane = new Map<LaneId, string[]>();
  const add = (lane: LaneId, id: string) => {
    if (!byLane.has(lane)) byLane.set(lane, []);
    const list = byLane.get(lane)!;
    if (!list.includes(id)) list.push(id);
  };
  let selectedShown = selectedId === null;
  for (const e of events) {
    const lanes = visibleAreaLane(e);
    if (e.id === selectedId && lanes.length > 0) selectedShown = true;
    for (const l of lanes) add(l, e.id);
  }
  const temporary = new Set<LaneId>();
  if (!selectedShown) {
    const sel = events.find((e) => e.id === selectedId);
    if (sel)
      for (const l of lanesOf(sel, regionOf, expanded)) {
        if (!byLane.has(l)) temporary.add(l);
        add(l, sel.id);
      }
  }
  const hasProvinces = events.some((e) => lanesOf(e, regionOf, true).some(isProvinceLane));
  // Tamriel's row carries the open/close button, so it stays while any of its provinces is on screen.
  if (expanded && !hidden.has('tamriel') && [...byLane.keys()].some(isProvinceLane) && !byLane.has('tamriel'))
    byLane.set('tamriel', []);
  return ORDER.filter((id) => byLane.has(id)).map((id) => ({
    id,
    depth: isProvinceLane(id) ? 1 : 0,
    expandable: id === 'tamriel' && hasProvinces,
    ids: byLane.get(id)!,
    temporary: temporary.has(id),
  }));
}
