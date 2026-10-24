import { LANGS, type Era, type EventMeta, type Lang, type Location, type Person } from './types';
import { OFFICIAL_MAPS, regionContains } from '../components/MapView/shapes';
import { DRAWN_MAPS } from '../components/MapView/shapes-drawn';
import { isAncestorOrSelf, regionHome } from './map-layers';
import { eventAreas, laneOfArea } from './lanes';

export interface ContentInput {
  events: EventMeta[];
  translations: Record<Lang, string[]>;
  locations: Location[];
  people: Person[];
  strict: boolean;
}

const UNDATED_ERAS = new Set<Era>(['dawn', 'merethic']);

export function validateContent(input: ContentInput): string[] {
  const errors: string[] = [];
  const eventIds = new Set(input.events.map((e) => e.id));
  const locationsById = new Map(input.locations.map((l) => [l.id, l]));
  const personIds = new Set(input.people.map((p) => p.id));

  for (const e of input.events) {
    for (const id of e.locations) {
      const loc = locationsById.get(id);
      if (!loc) errors.push(`${e.id}: unknown location "${id}"`);
      // A place may sit on a finer layer than the event's (a Skyrim place in a Tamriel event), never a coarser one.
      else if (!isAncestorOrSelf(e.mapLayer, loc.layer))
        errors.push(`${e.id}: location "${id}" is on layer ${loc.layer}, event is on ${e.mapLayer}`);
    }
    for (const id of e.regions ?? []) {
      const home = regionHome(id);
      if (!home) errors.push(`${e.id}: unknown region "${id}"`);
      else if (!isAncestorOrSelf(e.mapLayer, home)) errors.push(`${e.id}: region "${id}" is above the event's layer ${e.mapLayer}`);
    }
    for (const id of e.timelineRegions ?? []) if (!regionHome(id)) errors.push(`${e.id}: unknown timeline region "${id}"`);
    // The timeline draws each event on the lanes of the areas it names (an unknown region is reported above).
    for (const area of eventAreas(e, (id) => locationsById.get(id)?.region))
      if (!laneOfArea(area) && regionHome(area)) errors.push(`${e.id}: region "${area}" has no timeline lane (add it to src/lib/lanes.ts)`);
    for (const id of e.people) if (!personIds.has(id)) errors.push(`${e.id}: unknown person "${id}"`);
    for (const id of e.related) if (!eventIds.has(id)) errors.push(`${e.id}: unknown related event "${id}"`);
    if (e.related.includes(e.id)) errors.push(`${e.id}: lists itself as a related event`);
    if (!UNDATED_ERAS.has(e.era) && e.year === null) errors.push(`${e.id}: era ${e.era} requires a year`);
    if (e.circa && e.year === null) errors.push(`${e.id}: circa needs a year`);
    if (e.yearEnd !== undefined && (e.year === null || e.yearEnd < e.year))
      errors.push(`${e.id}: yearEnd must be >= year`);
    if (input.strict && e.review === 'unresolved') errors.push(`${e.id}: review is unresolved`);
  }

  for (const loc of input.locations) {
    const region = OFFICIAL_MAPS[loc.layer]?.regions.find((r) => r.id === loc.region);
    if (!region) errors.push(`location ${loc.id}: no region "${loc.region}" on layer ${loc.layer}`);
    // Open water (a bay) belongs to a province without lying on its land: it must be on its layer's map and off
    // every land outline there.
    else if (loc.sea) {
      const [w, h] = OFFICIAL_MAPS[loc.layer].viewBox;
      if (!(loc.x >= 0 && loc.x <= w && loc.y >= 0 && loc.y <= h))
        errors.push(`location ${loc.id}: ${loc.x},${loc.y} lies off the ${loc.layer} map`);
      else if (OFFICIAL_MAPS[loc.layer].regions.some((r) => regionContains(r, loc.x, loc.y)))
        errors.push(`location ${loc.id}: marked as sea but ${loc.x},${loc.y} lies on land`);
    } else if (!regionContains(region, loc.x, loc.y))
      errors.push(`location ${loc.id}: ${loc.x},${loc.y} lies outside ${loc.region}`);

    // The drawn map (P3-B): the same rules for the place's drawn position, on the drawn layers.
    if (!loc.drawn) {
      errors.push(`location ${loc.id}: no drawn position`);
      continue;
    }
    const shape = DRAWN_MAPS[loc.layer];
    const link = shape.parent;
    const [dx, dy] =
      loc.layer === 'nirn' || loc.layer === 'tamriel' || !link
        ? [loc.drawn.x, loc.drawn.y]
        : [(loc.drawn.x - link.x) / link.k, (loc.drawn.y - link.y) / link.k];
    const drawnRegion = shape.regions.find((r) => r.id === loc.region);
    if (!drawnRegion) errors.push(`location ${loc.id}: no region "${loc.region}" on the drawn ${loc.layer} layer`);
    else if (loc.sea ? shape.regions.some((r) => regionContains(r, dx, dy)) : !regionContains(drawnRegion, dx, dy))
      errors.push(`location ${loc.id}: drawn position ${loc.drawn.x},${loc.drawn.y} is not where its region needs it`);
  }

  for (const lang of LANGS) {
    const ids = new Set(input.translations[lang]);
    for (const id of eventIds) if (!ids.has(id)) errors.push(`${id}: missing ${lang} text`);
    for (const id of ids) if (!eventIds.has(id)) errors.push(`${id}: ${lang} text has no event`);
  }

  return errors;
}
