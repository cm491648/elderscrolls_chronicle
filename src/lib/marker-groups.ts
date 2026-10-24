/**
 * Map markers that would overlap on screen merge into one group marker (P3-A5): a tap on either would be a guess.
 * Positions are in map units; `k` is the zoom (map units to CSS px), so the gap is measured on screen.
 */
export interface MarkerPoint {
  id: string;
  x: number;
  y: number;
}

export interface MarkerGroup {
  ids: string[];
  x: number;
  y: number;
}

/** Room a marker needs: its tap target is 28 px across (r = 14). */
export const MARKER_GAP = 28;

/** Groups markers whose centres are closer than `gap` CSS px at zoom `k`, chaining neighbours; input order is kept. */
export function groupMarkers(points: MarkerPoint[], k: number, gap = MARKER_GAP): MarkerGroup[] {
  const parent = points.map((_, i) => i);
  const root = (i: number): number => (parent[i] === i ? i : (parent[i] = root(parent[i])));
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y) * k < gap) parent[root(j)] = root(i);
    }
  }
  const byRoot = new Map<number, MarkerPoint[]>();
  points.forEach((p, i) => {
    const r = root(i);
    byRoot.set(r, [...(byRoot.get(r) ?? []), p]);
  });
  return [...byRoot.values()].map((members) => ({
    ids: members.map((m) => m.id),
    x: members.reduce((s, m) => s + m.x, 0) / members.length,
    y: members.reduce((s, m) => s + m.y, 0) / members.length,
  }));
}

/** The zoom at which a group's closest pair stands `gap` CSS px apart, with 15% to spare (Infinity: never). */
export function separatingScale(points: MarkerPoint[], gap = MARKER_GAP): number {
  let closest = Infinity;
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      closest = Math.min(closest, Math.hypot(points[i].x - points[j].x, points[i].y - points[j].y));
    }
  }
  return closest === 0 ? Infinity : (gap / closest) * 1.15;
}
