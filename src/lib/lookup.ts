import type { EventMeta, Location, MapLayer } from './types';

export function eventsAtLocation<T extends Omit<EventMeta, 'sources'>>(events: T[], locationId: string): T[] {
  return events.filter((e) => e.locations.includes(locationId));
}

/**
 * Events in a region of a layer: those with a place in it on that layer, and those naming the whole region
 * (EventMeta.regions, e.g. the creation of Mundus on the Mundus ring).
 */
export function eventsInRegion<T extends Omit<EventMeta, 'sources'>>(
  events: T[],
  locations: Location[],
  layer: MapLayer,
  region: string,
): T[] {
  const ids = new Set(locations.filter((l) => l.layer === layer && l.region === region).map((l) => l.id));
  return events.filter((e) => e.locations.some((id) => ids.has(id)) || (e.regions ?? []).includes(region));
}
