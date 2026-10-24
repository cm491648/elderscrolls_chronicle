import { ERAS, type Era, type EventMeta } from './types';

export const PX_PER_YEAR = 1;
export const FIXED_ERA_WIDTH = 400;

type DatedEra = Exclude<Era, 'dawn' | 'merethic'>;
const ERA_YEARS: Record<DatedEra, number> = {
  '1E': 2920,
  '2E': 896,
  '3E': 433,
  '4E': 201,
};
/**
 * How wide a year is in each dated era, in units of PX_PER_YEAR (decisions/p4-design, option B): the long, thinly
 * told First Era is squeezed to a third, the crowded Third and Fourth widened, so no era swamps the axis.
 */
export const ERA_YEAR_SCALE: Record<DatedEra, number> = {
  '1E': 1 / 3,
  '2E': 1,
  '3E': 1.5,
  '4E': 2,
};

export interface Segment {
  era: Era;
  start: number;
  end: number;
  fixed: boolean;
  /** Width of one year in this era (0 for the undated eras, whose events are spaced by order). */
  pxPerYear: number;
}

export interface Timescale {
  segments: Segment[];
  totalWidth: number;
  ordered: string[];
  x(id: string): number;
  /** From the first year to the last: a point (both ends equal) without an end year, or in an era with no dates. */
  span(id: string): [number, number];
}

type Placeable = Pick<EventMeta, 'id' | 'era' | 'year' | 'order' | 'yearEnd'>;

export function buildSegments(): Segment[] {
  const segments: Segment[] = [];
  let cursor = 0;
  for (const era of ERAS) {
    const fixed = era === 'dawn' || era === 'merethic';
    const pxPerYear = fixed ? 0 : ERA_YEAR_SCALE[era] * PX_PER_YEAR;
    const width = fixed ? FIXED_ERA_WIDTH : ERA_YEARS[era] * pxPerYear;
    segments.push({ era, start: cursor, end: cursor + width, fixed, pxPerYear });
    cursor += width;
  }
  return segments;
}

const byOrderThenId = (a: Placeable, b: Placeable) => a.order - b.order || a.id.localeCompare(b.id);

export function createTimescale(events: Placeable[]): Timescale {
  const segments = buildSegments();
  const positions = new Map<string, number>();
  const ends = new Map<string, number>();

  for (const seg of segments) {
    const inEra = events.filter((e) => e.era === seg.era);
    const span = seg.end - seg.start;
    if (seg.fixed) {
      const sorted = [...inEra].sort(byOrderThenId);
      sorted.forEach((e, i) => positions.set(e.id, seg.start + (span * (i + 1)) / (sorted.length + 1)));
    } else {
      for (const e of inEra) {
        const years = Math.min(Math.max(e.year ?? 0, 0), span / seg.pxPerYear);
        positions.set(e.id, seg.start + years * seg.pxPerYear);
        if (e.year !== null && e.yearEnd !== undefined && e.yearEnd > e.year)
          ends.set(e.id, Math.min(seg.start + e.yearEnd * seg.pxPerYear, seg.end));
      }
    }
  }

  const ordered = [...events]
    .sort((a, b) => positions.get(a.id)! - positions.get(b.id)! || byOrderThenId(a, b))
    .map((e) => e.id);

  return {
    segments,
    totalWidth: segments[segments.length - 1].end,
    ordered,
    x(id) {
      const pos = positions.get(id);
      if (pos === undefined) throw new Error(`Unknown event: ${id}`);
      return pos;
    },
    span(id) {
      const pos = positions.get(id);
      if (pos === undefined) throw new Error(`Unknown event: ${id}`);
      return [pos, ends.get(id) ?? pos];
    },
  };
}
