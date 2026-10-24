import { MAPS, type MapShape, type Region } from '../components/MapView/shapes';
import { MAP_LAYERS, type EventMeta, type Location, type MapLayer } from './types';

/**
 * The map's layer tree (R12): cosmos > Nirn > Tamriel > nine provinces. Every layer but the cosmos sits on its parent
 * through a uniform scale and shift (MapShape.parent). A place is stored on the finest layer it belongs to and is
 * carried up to coarser layers through those links; a region whose id names a layer opens that layer when clicked.
 */

export type Point = [number, number];
/** [x0, y0, x1, y1] in a layer's units. */
export type Box = [number, number, number, number];
/** A zoom transform: a layer point p is drawn at p * k + (x, y) screen pixels. */
export interface View {
  k: number;
  x: number;
  y: number;
}

export const parentOf = (layer: MapLayer): MapLayer | null => MAPS[layer].parent?.layer ?? null;

/** The layer and its ancestors, finest first. */
export function lineage(layer: MapLayer): MapLayer[] {
  const out: MapLayer[] = [];
  for (let l: MapLayer | null = layer; l; l = parentOf(l)) out.push(l);
  return out;
}

/** The breadcrumb from the root down to `layer`. */
export const pathTo = (layer: MapLayer): MapLayer[] => lineage(layer).reverse();

export const isAncestorOrSelf = (ancestor: MapLayer, layer: MapLayer) => lineage(layer).includes(ancestor);

/** The deepest layer that is an ancestor-or-self of every given layer. */
export function commonLayer(layers: MapLayer[]): MapLayer {
  if (layers.length === 0) return 'cosmos';
  let common = lineage(layers[0]);
  for (const l of layers.slice(1)) {
    const up = new Set(lineage(l));
    common = common.filter((c) => up.has(c));
  }
  return common[0];
}

/** The scale-and-shift taking points of `from` to its ancestor `to`. */
export function linkTo(from: MapLayer, to: MapLayer): View {
  let t: View = { k: 1, x: 0, y: 0 };
  for (let l = from; l !== to; ) {
    const p = MAPS[l].parent;
    if (!p) throw new Error(`${to} is not above ${from}`);
    t = { k: t.k * p.k, x: t.x * p.k + p.x, y: t.y * p.k + p.y };
    l = p.layer;
  }
  return t;
}

/**
 * A thin-plate spline through control points (exact at each), as a function of the point: used for the residual
 * between a layer's plain link and where its control points belong on the parent.
 */
function thinPlate(src: Point[], dst: Point[]): (p: Point) => Point {
  const n = src.length;
  const S = 1 / 1000; // keep the system well conditioned
  const P = src.map(([x, y]) => [x * S, y * S]);
  const U = (r2: number) => (r2 === 0 ? 0 : r2 * Math.log(r2));
  const m = n + 3;
  const A: number[][] = Array.from({ length: m }, () => new Array(m).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) A[i][j] = U((P[i][0] - P[j][0]) ** 2 + (P[i][1] - P[j][1]) ** 2);
    A[i][n] = A[n][i] = 1;
    A[i][n + 1] = A[n + 1][i] = P[i][0];
    A[i][n + 2] = A[n + 2][i] = P[i][1];
  }
  const solve = (b: number[]) => {
    const M = A.map((row, i) => [...row, b[i]]);
    for (let c = 0; c < m; c++) {
      let piv = c;
      for (let r = c + 1; r < m; r++) if (Math.abs(M[r][c]) > Math.abs(M[piv][c])) piv = r;
      [M[c], M[piv]] = [M[piv], M[c]];
      for (let r = 0; r < m; r++) {
        if (r === c) continue;
        const f = M[r][c] / M[c][c];
        for (let k = c; k <= m; k++) M[r][k] -= f * M[c][k];
      }
    }
    return M.map((row, i) => row[m] / row[i]);
  };
  const wx = solve([...dst.map((d) => d[0]), 0, 0, 0]);
  const wy = solve([...dst.map((d) => d[1]), 0, 0, 0]);
  return ([x, y]) => {
    const q = [x * S, y * S];
    let rx = wx[n] + wx[n + 1] * q[0] + wx[n + 2] * q[1];
    let ry = wy[n] + wy[n + 1] * q[0] + wy[n + 2] * q[1];
    for (let i = 0; i < n; i++) {
      const u = U((q[0] - P[i][0]) ** 2 + (q[1] - P[i][1]) ** 2);
      rx += wx[i] * u;
      ry += wy[i] * u;
    }
    return [rx, ry];
  };
}

const warps = new Map<MapLayer, (p: Point) => Point>();

let drawnPlaces = false;
/**
 * Where a place is on its own layer: its official position, or on the drawn map (src/lib/map-set.ts) its drawn one,
 * which is stored in the schematic Tamriel frame for Tamriel and the provinces, the Nirn frame for Nirn.
 */
export function locationPoint(loc: Location): Point {
  if (!drawnPlaces || !loc.drawn) return [loc.x, loc.y];
  const { x, y } = loc.drawn;
  const link = MAPS[loc.layer].parent;
  if (loc.layer === 'nirn' || loc.layer === 'tamriel' || !link) return [x, y];
  return [(x - link.x) / link.k, (y - link.y) / link.k];
}
/** Called by setMapSet: places switch to their drawn positions, and the warps cached for the old layers go. */
export function useDrawnPlaces(on: boolean): void {
  drawnPlaces = on;
  warps.clear();
}
/** The residual a layer's warp adds on its parent to a point carried up by the plain link (zero without a warp). */
function warpResidual(layer: MapLayer): ((p: Point) => Point) | null {
  const link = MAPS[layer].parent;
  if (!link?.warp?.length) return null;
  if (!warps.has(layer)) {
    const src = link.warp.map(([from]) => from);
    const dst = link.warp.map(([from, to]) => [to[0] - (from[0] * link.k + link.x), to[1] - (from[1] * link.k + link.y)] as Point);
    warps.set(layer, thinPlate(src, dst));
  }
  return warps.get(layer)!;
}

/**
 * A point of layer `from` on its ancestor layer `to`, one link at a time. Where a link has a warp (the game-map
 * provinces), the point also gets the warp's correction, so marked cities land on the parent map's own glyphs;
 * `plain` skips it (the picture's own scale-and-shift, which the views use).
 */
export function project([x, y]: Point, from: MapLayer, to: MapLayer, plain = false): Point {
  let p: Point = [x, y];
  for (let l = from; l !== to; ) {
    const link = MAPS[l].parent;
    if (!link) throw new Error(`${to} is not above ${from}`);
    const q: Point = [p[0] * link.k + link.x, p[1] * link.k + link.y];
    const w = plain ? null : warpResidual(l);
    if (w) {
      const [dx, dy] = w(p);
      q[0] += dx;
      q[1] += dy;
    }
    p = q;
    l = link.layer;
  }
  return p;
}

/** The child layer a region of `layer` opens (Tamriel's provinces, Nirn's Tamriel, the cosmos' Nirn), if any. */
export function childLayerOf(layer: MapLayer, regionId: string): MapLayer | null {
  const child = (MAP_LAYERS as readonly string[]).includes(regionId) ? (regionId as MapLayer) : null;
  return child && parentOf(child) === layer ? child : null;
}

/** Where a region id is defined: the coarsest layer that has it (province layers repeat their own outline). */
export function findRegion(id: string): { layer: MapLayer; region: Region } | null {
  for (const layer of MAP_LAYERS) {
    const region = MAPS[layer].regions.find((r) => r.id === id);
    if (region) return { layer, region };
  }
  return null;
}

/**
 * The layer an event region is shown on: the layer it is drawn on. A province is shown on Tamriel, not on its own
 * layer, whose crop is the province itself (user decision on event locations, 2026-10-18).
 */
export function regionHome(id: string): MapLayer | null {
  return findRegion(id)?.layer ?? null;
}

export function regionPoints(region: Region): Point[] {
  const g = region.geometry;
  if (g.kind === 'circle') return [[g.cx - g.r, g.cy - g.r], [g.cx + g.r, g.cy + g.r]];
  return g.kind === 'polygons' ? g.parts.flat() : g.points;
}

const boxOf = (pts: Point[]): Box => [
  Math.min(...pts.map((p) => p[0])),
  Math.min(...pts.map((p) => p[1])),
  Math.max(...pts.map((p) => p[0])),
  Math.max(...pts.map((p) => p[1])),
];

/** A region drawn on a layer below `layer`, carried up as SVG path data and a box (for event regions). */
export interface ProjectedRegion {
  id: string;
  /** Path data in `layer` units, or null when the region is drawn on `layer` itself (it is highlighted there). */
  d: string | null;
  box: Box;
  /** Carried up: the region of `layer` it lies in (Skyrim on Nirn lies in Tamriel). */
  within?: string;
}

export function projectRegion(id: string, layer: MapLayer): ProjectedRegion | null {
  const found = findRegion(id);
  if (!found) return null;
  // Shown on its own layer, or on the layer it opens (the reader zoomed into it): highlight it in place.
  const own = MAPS[layer].regions.find((r) => r.id === id);
  if (own && (found.layer === layer || childLayerOf(found.layer, id) === layer))
    return { id, d: null, box: boxOf(regionPoints(own)) };
  if (!isAncestorOrSelf(layer, found.layer)) return null;
  const t = linkTo(found.layer, layer);
  const g = found.region.geometry;
  const move = ([x, y]: Point): Point => [x * t.k + t.x, y * t.k + t.y];
  const parts = g.kind === 'circle' ? [] : g.kind === 'polygons' ? g.parts : [g.points];
  const d = parts.map((p) => `M${p.map((q) => move(q).map((v) => v.toFixed(1)).join(',')).join('L')}Z`).join('');
  const up = lineage(found.layer);
  const within = up[up.indexOf(layer) - 1];
  return { id, d, box: boxOf(regionPoints(found.region).map(move)), within };
}

/** A name tag's screen width (px) beside a marker: the larger of its English and Chinese names, padding included. */
export function tagWidth(name: Record<string, string>, lang?: string): number {
  const text = (t: string) => [...t].reduce((sum, c) => sum + (/[\u2E80-\u9FFF\uF900-\uFAFF\uFF00-\uFFEF]/.test(c) ? 13.5 : 7.6), 0);
  // 16 px from the dot's centre to the tag, 7 px padding each side, a little slack for the font.
  const names = lang && name[lang] !== undefined ? [name[lang]] : Object.values(name);
  return Math.ceil(16 + 14 + 6 + Math.max(...names.map(text)));
}

/** What a frame must keep on the plate. */
export interface Frame {
  /** Places, each with the screen width of its name tag (drawn to its right). */
  points: { at: Point; tag: number }[];
  /** Regions to show whole. */
  boxes: Box[];
  /**
   * The event names several places or any region: all must be in view, below the cover zoom if need be. A single
   * place keeps the cover zoom unless the plate's edges or the level path would hide it.
   */
  fitAll: boolean;
}

/** What a selected event shows: the layer, the places (in that layer's units), extra region outlines, a frame. */
export interface EventView {
  layer: MapLayer;
  places: { id: string; at: Point }[];
  regions: ProjectedRegion[];
  /** The box around every place and region, or null for the whole layer. */
  box: Box | null;
  /** See Frame.fitAll. */
  fitAll: boolean;
  /** What to keep on the plate (null: the whole layer). */
  frame: Frame | null;
}

/**
 * The finest layer holding every place and region of the event, with the box that frames them all. An event that
 * names nothing falls back to its `mapLayer`, shown whole.
 */
export function eventView(
  event: Pick<EventMeta, 'mapLayer' | 'locations' | 'regions'>,
  locations: Location[],
  /** The page language, for the name tags' widths (both languages, the wider, when omitted). */
  lang?: string,
): EventView {
  const locs = event.locations.map((id) => locations.find((l) => l.id === id)).filter((l): l is Location => !!l);
  const regionIds = (event.regions ?? []).filter((id) => regionHome(id));
  const homes = [...locs.map((l) => l.layer), ...regionIds.map((id) => regionHome(id)!)];
  if (homes.length === 0) return { layer: event.mapLayer, places: [], regions: [], box: null, fitAll: false, frame: null };
  const layer = commonLayer(homes);
  const places = locs.map((l) => ({ id: l.id, at: project(locationPoint(l), l.layer, layer) }));
  const regions = regionIds.map((id) => projectRegion(id, layer)).filter((r): r is ProjectedRegion => !!r);
  const pts: Point[] = [...places.map((p) => p.at), ...regions.flatMap((r) => [[r.box[0], r.box[1]], [r.box[2], r.box[3]]] as Point[])];
  const fitAll = homes.length > 1 || regions.length > 0;
  const frame: Frame = {
    points: places.map((p, i) => ({ at: p.at, tag: tagWidth(locs[i].name, lang) })),
    boxes: regions.map((r) => r.box),
    fitAll,
  };
  return { layer, places, regions, box: boxOf(pts), fitAll, frame };
}

/** Places drawn on `layer`: its own, its children's where the layer asks for them, and any selected one below it. */
export function placesOn(
  layer: MapLayer,
  locations: Location[],
  selected: Set<string>,
): { loc: Location; at: Point; plain: Point }[] {
  const shape: MapShape = MAPS[layer];
  return locations
    .filter((l) => {
      if (l.layer === layer) return true;
      if (!isAncestorOrSelf(layer, l.layer)) return false;
      return selected.has(l.id) || (shape.childMarkers === true && parentOf(l.layer) === layer);
    })
    .map((loc) => ({ loc, at: project(locationPoint(loc), loc.layer, layer), plain: project(locationPoint(loc), loc.layer, layer, true) }));
}

/** The region of `layer` a place on that layer or below belongs to (on Tamriel, a Skyrim place lights Skyrim). */
export function regionOnLayer(loc: Location, layer: MapLayer): string | null {
  if (loc.layer === layer) return loc.region;
  const up = lineage(loc.layer);
  const i = up.indexOf(layer);
  return i > 0 ? up[i - 1] : null;
}

// ---- views (zoom transforms) on a plate of W x H screen pixels ----

/** The deepest zoom of a layer on a W x H plate: MAX_ZOOM times cover, or the layer's own limit (never below cover). */
export function maxScale(layer: MapLayer, W: number, H: number): number {
  const [w, h] = MAPS[layer].viewBox;
  const cover = Math.max(W / w, H / h);
  const own = MAPS[layer].maxZoom;
  return own === undefined ? cover * MAX_ZOOM : Math.max(cover, Math.min(cover * MAX_ZOOM, own));
}

/** The smallest zoom at which the layer fills the plate (cover: no empty margin). */
export const coverScale = (W: number, H: number, w: number, h: number) => Math.max(W / w, H / h);

/** Deepest zoom allowed, as a multiple of the cover zoom. */
export const MAX_ZOOM = 8;

/**
 * Keeps a view inside the layer: at least `minK` (normally the cover zoom), at most MAX_ZOOM times cover, and no
 * margin showing on an axis the layer fills (an axis it does not fill, below cover, is centred).
 */
export function clampView(
  v: View,
  W: number,
  H: number,
  w: number,
  h: number,
  minK = coverScale(W, H, w, h),
  maxK = coverScale(W, H, w, h) * MAX_ZOOM,
): View {
  const cover = coverScale(W, H, w, h);
  const k = Math.min(Math.max(v.k, minK), Math.max(Math.min(cover * MAX_ZOOM, maxK), minK));
  const axis = (t: number, plate: number, size: number) =>
    k * size >= plate ? Math.min(0, Math.max(plate - k * size, t)) : (plate - k * size) / 2;
  return { k, x: axis(v.x, W, w), y: axis(v.y, H, h) };
}

/** Screen pixels kept clear at the plate's edges (the top one holds the level path). */
export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}
export const EDGE_INSETS: Insets = { top: 14, right: 14, bottom: 14, left: 14 };
/** Half a marker (its 28 px hit circle) and half a name tag's height, around a place's centre. */
const MARK = 14;

/** Whether every place (with its tag) and region of `frame` lies inside the plate minus `insets` under view `v`. */
export function frameFits(frame: Frame, v: View, W: number, H: number, insets: Insets = EDGE_INSETS): boolean {
  const L = insets.left - 0.5;
  const T = insets.top - 0.5;
  const R = W - insets.right + 0.5;
  const B = H - insets.bottom + 0.5;
  for (const { at: [x, y], tag } of frame.points) {
    const sx = x * v.k + v.x;
    const sy = y * v.k + v.y;
    // The tag goes right of the place, or left when the right edge is too near (placeTags does the same).
    const tagFits = sx + Math.max(tag, MARK) <= R || sx - Math.max(tag, MARK) >= L;
    if (sx - MARK < L || sx + MARK > R || !tagFits || sy - MARK < T || sy + MARK > B) return false;
  }
  // A region only has to be whole on the plate: it is a wash, and one reaching the map's edge (Atmora) could not
  // keep clear of the edge insets without leaving the whole map smaller than the plate.
  for (const [x0, y0, x1, y1] of frame.boxes) {
    if (x0 * v.k + v.x < -0.5 || x1 * v.k + v.x > W + 0.5 || y0 * v.k + v.y < -0.5 || y1 * v.k + v.y > H + 0.5) return false;
  }
  return true;
}

/**
 * The view of a layer that frames `frame`, or the whole layer (filled, centred) when frame is null.
 * - It starts at the cover zoom or closer: a box smaller than 1/focusScale of the layer is grown to that, so a single
 *   place keeps some surroundings; the items (tags included) are centred in the plate minus `insets`.
 * - Then, while anything would be cut off by the plate's edges or hidden under the level path (`insets.top`), it
 *   zooms out step by step, below the cover zoom if need be (the margin shows the map's own edge colour), down to the
 *   whole layer fitted and a little under.
 */
export function frameView(layer: MapLayer, frame: Frame | null, W: number, H: number, insets: Insets = EDGE_INSETS): View {
  const { viewBox: [w, h], focusScale } = MAPS[layer];
  const cover = coverScale(W, H, w, h);
  if (!frame || frame.points.length + frame.boxes.length === 0) return { k: cover, x: (W - cover * w) / 2, y: (H - cover * h) / 2 };
  const corners: Point[] = [...frame.points.map((p) => p.at), ...frame.boxes.flatMap((b) => [[b[0], b[1]], [b[2], b[3]]] as Point[])];
  const [x0, y0, x1, y1] = boxOf(corners);
  const PAD = 1.3;
  const bw = Math.max((x1 - x0) * PAD, w / focusScale);
  const bh = Math.max((y1 - y0) * PAD, h / focusScale);
  const meet = Math.min(W / w, H / h);
  const maxK = maxScale(layer, W, H);
  let k = Math.min(Math.max(Math.min(W / bw, H / bh), cover), maxK);
  const innerCX = (insets.left + W - insets.right) / 2;
  const innerCY = (insets.top + H - insets.bottom) / 2;
  let v: View = { k, x: 0, y: 0 };
  for (let i = 0; i < 60; i++) {
    // Centre the items' screen extent (tags to the right of their places) in the free part of the plate.
    let lo = Infinity;
    let hi = -Infinity;
    let top = Infinity;
    let bottom = -Infinity;
    for (const { at: [x, y], tag } of frame.points) {
      lo = Math.min(lo, x * k - MARK);
      hi = Math.max(hi, x * k + Math.max(tag, MARK));
      top = Math.min(top, y * k - MARK);
      bottom = Math.max(bottom, y * k + MARK);
    }
    for (const b of frame.boxes) {
      lo = Math.min(lo, b[0] * k);
      hi = Math.max(hi, b[2] * k);
      top = Math.min(top, b[1] * k);
      bottom = Math.max(bottom, b[3] * k);
    }
    const want = { k, x: innerCX - (lo + hi) / 2, y: innerCY - (top + bottom) / 2 };
    // An axis the map fills is clamped to its edges; on an axis it does not fill (below cover) it may sit anywhere
    // on the plate rather than centred, so the items can be centred instead.
    const fit = (t: number, plate: number, size: number) =>
      k * size >= plate ? Math.min(0, Math.max(plate - k * size, t)) : Math.min(plate - k * size, Math.max(0, t));
    v = { k, x: fit(want.x, W, w), y: fit(want.y, H, h) };
    if (frameFits(frame, v, W, H, insets)) return v;
    // A place near the map's top edge would sit under the level path: let the map slide down under the path
    // (the strip behind it shows the map's edge colour) rather than zooming far out.
    // (A map shorter than the plate, below cover, may likewise sit lower than centred, down to the plate's bottom.)
    let need = -Infinity;
    for (const { at } of frame.points) need = Math.max(need, insets.top + MARK - at[1] * k);
    for (const b of frame.boxes) need = Math.max(need, -b[1] * k);
    if (need > v.y) {
      const slid = { ...v, y: Math.min(need, k * h >= H ? insets.top : H - k * h) };
      if (frameFits(frame, slid, W, H, insets)) return slid;
    }
    if (k <= meet * 0.6) return v;
    k *= 0.94;
  }
  return v;
}

/** The whole-layer zoom (cover), centred as near `at` as the edges allow: zooming out keeps the place in sight. */
export function coverViewAt(layer: MapLayer, [cx, cy]: Point, W: number, H: number): View {
  const [w, h] = MAPS[layer].viewBox;
  const k = coverScale(W, H, w, h);
  return clampView({ k, x: W / 2 - k * cx, y: H / 2 - k * cy }, W, H, w, h);
}

/** The same picture expressed as a view of the parent layer (for zooming between a layer and its parent). */
export function viewOnParent(v: View, child: MapLayer): View {
  const p = MAPS[child].parent!;
  return { k: v.k / p.k, x: v.x - (v.k * p.x) / p.k, y: v.y - (v.k * p.y) / p.k };
}
