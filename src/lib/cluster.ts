export interface Cluster {
  ids: string[];
  x: number;
}

export function clusterPoints(points: { id: string; x: number }[], minGap: number): Cluster[] {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const groups: { id: string; x: number }[][] = [];
  for (const p of sorted) {
    const last = groups[groups.length - 1];
    if (last && p.x - last[last.length - 1].x < minGap) last.push(p);
    else groups.push([p]);
  }
  return groups.map((g) => ({
    ids: g.map((p) => p.id),
    x: g.reduce((sum, p) => sum + p.x, 0) / g.length,
  }));
}

/**
 * Spreads points so that neighbours end at least `minGap` apart, each run of crowded points centred on the mean of
 * where they really are, and kept inside [min, max]. Used when the timeline can zoom in no further: events in the
 * same or nearby years would otherwise stay merged for good. Order by x is kept; ties keep their input order.
 */
export function fanOut(
  points: { id: string; x: number }[],
  minGap: number,
  min = -Infinity,
  max = Infinity,
): { id: string; x: number }[] {
  const sorted = points.map((p, i) => ({ ...p, i })).sort((a, b) => a.x - b.x || a.i - b.i);
  type Run = { pts: typeof sorted; sum: number; start: number };
  const place = (r: Run) => {
    const span = (r.pts.length - 1) * minGap;
    r.start = Math.min(Math.max(r.sum / r.pts.length - span / 2, min), max - span);
  };
  const runs: Run[] = [];
  for (const p of sorted) {
    const run: Run = { pts: [p], sum: p.x, start: p.x };
    place(run);
    runs.push(run);
    // Merge back while the new run would come closer than the gap to the one before it.
    while (runs.length > 1) {
      const b = runs[runs.length - 1];
      const a = runs[runs.length - 2];
      if (a.start + (a.pts.length - 1) * minGap + minGap <= b.start + 1e-9) break;
      runs.pop();
      a.pts.push(...b.pts);
      a.sum += b.sum;
      place(a);
    }
  }
  return runs.flatMap((r) => r.pts.map((p, k) => ({ id: p.id, x: r.start + k * minGap })));
}

/**
 * fanOut for the fully zoomed-in timeline, but events at the very same place on the axis (the same year) stay one
 * group: a same-year group is one mark the reader opens to choose from, so it never looks like several years. Only
 * groups at different places are spread `minGap` apart.
 */
export function fanOutGroups(
  points: { id: string; x: number }[],
  minGap: number,
  min = -Infinity,
  max = Infinity,
): Cluster[] {
  const groups: { ids: string[]; x: number }[] = [];
  for (const p of [...points].sort((a, b) => a.x - b.x)) {
    const last = groups[groups.length - 1];
    if (last && Math.abs(p.x - last.x) < 0.5) last.ids.push(p.id);
    else groups.push({ ids: [p.id], x: p.x });
  }
  const spread = new Map(fanOut(groups.map((g, i) => ({ id: String(i), x: g.x })), minGap, min, max).map((p) => [p.id, p.x]));
  return groups.map((g, i) => ({ ids: g.ids, x: spread.get(String(i))! }));
}

/** Joins event titles for a cluster's tooltip / accessible name, using the language's list separator. */
export function joinClusterTitles(titles: string[], lang: 'en' | 'zh-tw'): string {
  return titles.join(lang === 'zh-tw' ? '、' : ', ');
}
