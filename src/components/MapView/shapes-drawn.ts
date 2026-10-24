import { PROVINCES, type MapLayer, type Province } from '../../lib/types';
import { OFFICIAL_MAPS, type MapShape, type Region } from './shapes';
import { NIRN_REGIONS, NIRN_TAMRIEL, NIRN_VIEWBOX, PROVINCE_POLYGONS, SCHEMATIC_VIEWBOX } from './schematic-shapes';
import params from '../../content/schematic-map.json';

/**
 * The drawn map's layers (P3-B): the same layer tree as the official map, with the shapes generated from written
 * geography (schematic-shapes.ts). The cosmos is shared. Nirn and Tamriel use the schematic frames; each province
 * layer is its province's box on the schematic Tamriel, enlarged so its longer side is PROVINCE_SIDE units.
 */
type Pt = [number, number];

/** Longer side of a drawn province layer, in its own units. */
export const PROVINCE_SIDE = 1000;
/** Margin around a province's box on Tamriel, as a fraction of its longer side (room for coast and neighbours). */
const MARGIN = 0.08;

const round1 = (v: number) => Math.round(v * 10) / 10;
const nameOf = (layer: MapLayer, id: string) => OFFICIAL_MAPS[layer].regions.find((r) => r.id === id)!.name;

function centroid(parts: Pt[][]): Pt {
  const pts = parts.flat();
  return [round1(pts.reduce((s, p) => s + p[0], 0) / pts.length), round1(pts.reduce((s, p) => s + p[1], 0) / pts.length)];
}

/**
 * The painted layers carry 1.5 image pixels per layer unit (scripts/import-schematic-paintings.py): zoom no deeper than
 * 3 CSS px per unit, i.e. 2 CSS px per image pixel.
 */
const PAINTED_MAX_ZOOM = 3;

const nirn: MapShape = {
  layer: 'nirn',
  viewBox: NIRN_VIEWBOX,
  focusScale: 2.5,
  maxZoom: PAINTED_MAX_ZOOM,
  parent: OFFICIAL_MAPS.nirn.parent,
  looseRegions: true,
  regions: (Object.keys(NIRN_REGIONS) as (keyof typeof NIRN_REGIONS)[]).map((id) => ({
    id,
    name: nameOf('nirn', id),
    geometry: { kind: 'polygons', parts: NIRN_REGIONS[id] },
    label: centroid(NIRN_REGIONS[id]),
  })),
};

const labels = params.labels as Record<Province, Pt>;
const tamriel: MapShape = {
  layer: 'tamriel',
  viewBox: SCHEMATIC_VIEWBOX,
  focusScale: 2.5,
  maxZoom: PAINTED_MAX_ZOOM,
  parent: { layer: 'nirn', ...NIRN_TAMRIEL },
  childMarkers: true,
  regions: PROVINCES.map((id) => ({
    id,
    name: nameOf('tamriel', id),
    geometry: { kind: 'polygons', parts: PROVINCE_POLYGONS[id] },
    label: labels[id],
  })),
};

/** Where a drawn province layer sits on the schematic Tamriel: a layer point p is at p * k + (x, y) there. */
export function provinceFrame(id: Province): { k: number; x: number; y: number; size: [number, number] } {
  const pts = PROVINCE_POLYGONS[id].flat();
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const side = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  const m = side * MARGIN;
  const [x0, y0, x1, y1] = [Math.min(...xs) - m, Math.min(...ys) - m, Math.max(...xs) + m, Math.max(...ys) + m];
  const k = (side + 2 * m) / PROVINCE_SIDE;
  return { k, x: x0, y: y0, size: [Math.round((x1 - x0) / k), Math.round((y1 - y0) / k)] };
}

function provinceMap(id: Province): MapShape {
  const f = provinceFrame(id);
  const local = ([x, y]: Pt): Pt => [round1((x - f.x) / f.k), round1((y - f.y) / f.k)];
  const region: Region = {
    id,
    name: nameOf('tamriel', id),
    geometry: { kind: 'polygons', parts: PROVINCE_POLYGONS[id].map((part) => part.map(local)) },
    label: local(labels[id]),
  };
  return {
    layer: id,
    viewBox: f.size,
    focusScale: 1,
    maxZoom: PAINTED_MAX_ZOOM,
    parent: { layer: 'tamriel', k: f.k, x: f.x, y: f.y },
    regions: [region],
  };
}

export const DRAWN_MAPS: Record<MapLayer, MapShape> = {
  cosmos: OFFICIAL_MAPS.cosmos,
  nirn,
  tamriel,
  ...(Object.fromEntries(PROVINCES.map((id) => [id, provinceMap(id)])) as Record<Province, MapShape>),
};
