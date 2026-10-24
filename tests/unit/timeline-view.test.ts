import { describe, expect, test } from 'vitest';
import {
  boxesOverlap,
  centuryLines,
  padEnd,
  spanLabel,
  clampLabelX,
  clampView,
  clusterView,
  listYearLabel,
  estimateTextWidth,
  focusView,
  placeLabels,
  isAtPanLimit,
  normalizeWheelDelta,
  preserveView,
  tabStopIndex,
  wheelZoomFactor,
  yearLabel,
  yearRangeLabel,
  zoomLimits,
} from '../../src/lib/timeline-view';
import { buildSegments } from '../../src/lib/timescale';

describe('normalizeWheelDelta', () => {
  test('pixel mode passes through, dominant axis wins', () => {
    expect(normalizeWheelDelta({ deltaX: 0, deltaY: 40, deltaMode: 0 }, 800)).toBe(40);
    expect(normalizeWheelDelta({ deltaX: -30, deltaY: 5, deltaMode: 0 }, 800)).toBe(-30);
  });
  test('line mode is scaled by 16, page mode by the page size', () => {
    expect(normalizeWheelDelta({ deltaX: 0, deltaY: 3, deltaMode: 1 }, 800)).toBe(48);
    expect(normalizeWheelDelta({ deltaX: 0, deltaY: -1, deltaMode: 2 }, 800)).toBe(-800);
  });
});

describe('isAtPanLimit', () => {
  const total = 1000;
  test('left edge blocks scrolling backward only', () => {
    const view = { x: 0, k: 2 };
    expect(isAtPanLimit(-10, view, 500, total)).toBe(true);
    expect(isAtPanLimit(10, view, 500, total)).toBe(false);
  });
  test('right edge blocks scrolling forward only', () => {
    const view = { x: 500 - 2 * total, k: 2 };
    expect(isAtPanLimit(10, view, 500, total)).toBe(true);
    expect(isAtPanLimit(-10, view, 500, total)).toBe(false);
  });
  test('fully zoomed out is always at the limit; zero delta never pans', () => {
    expect(isAtPanLimit(10, { x: 0, k: 0.5 }, 500, total)).toBe(true);
    expect(isAtPanLimit(-10, { x: 0, k: 0.5 }, 500, total)).toBe(true);
    expect(isAtPanLimit(0, { x: -100, k: 2 }, 500, total)).toBe(true);
  });
});

describe('clampView / preserveView', () => {
  test('clampView limits zoom and translation', () => {
    expect(clampView({ x: 50, k: 0.1 }, 500, 1000, 10)).toEqual({ x: 0, k: 0.5 });
    expect(clampView({ x: -99999, k: 99 }, 500, 1000, 10)).toEqual({ x: 500 - 5 * 1000, k: 5 });
  });
  test('preserveView keeps fit state fitted after a resize', () => {
    expect(preserveView({ x: 0, k: 0.8 }, 800, 400, 1000, 60)).toEqual({ x: 0, k: 0.4 });
  });
  test('preserveView keeps the centre world position and zoom', () => {
    const prev = { x: -2000, k: 4 }; // centre world x = (400 + 2000) / 4 = 600 at width 800
    const next = preserveView(prev, 800, 400, 1000, 60);
    expect(next.k).toBe(4);
    expect((400 / 2 - next.x) / next.k).toBeCloseTo(600);
  });
  test('preserveView clamps k to the new extent', () => {
    // zoomed in 1.5x of fit at width 400; growing to width 1000 makes fit k = 1
    const next = preserveView({ x: -100, k: 0.6 }, 400, 1000, 1000, 60);
    expect(next.k).toBeGreaterThanOrEqual(1);
  });
});

describe('zoomLimits', () => {
  test('flags both extremes', () => {
    expect(zoomLimits(0.5, 500, 1000, 10)).toEqual({ canZoomOut: false, canZoomIn: true });
    expect(zoomLimits(5, 500, 1000, 10)).toEqual({ canZoomOut: true, canZoomIn: false });
    expect(zoomLimits(1, 500, 1000, 10)).toEqual({ canZoomOut: true, canZoomIn: true });
  });
});

describe('tabStopIndex', () => {
  const items = [
    { ids: ['a'], x: -50 },
    { ids: ['b', 'c'], x: 100 },
    { ids: ['d'], x: 300 },
    { ids: ['e'], x: 900 },
  ];
  test('empty list has no tab stop', () => {
    expect(tabStopIndex([], 'a', 500)).toBe(-1);
  });
  test('the item containing the selection wins, even inside a cluster', () => {
    expect(tabStopIndex(items, 'c', 500)).toBe(1);
    expect(tabStopIndex(items, 'e', 500)).toBe(3);
  });
  test('otherwise the first visible item', () => {
    expect(tabStopIndex(items, null, 500)).toBe(1);
    expect(tabStopIndex(items, 'missing', 500)).toBe(1);
  });
  test('falls back to the first item when nothing is visible', () => {
    expect(tabStopIndex([{ ids: ['a'], x: -10 }, { ids: ['b'], x: 700 }], null, 500)).toBe(0);
  });
});

describe('wheelZoomFactor', () => {
  test('scrolling up zooms in, down zooms out, symmetric', () => {
    const inF = wheelZoomFactor({ deltaY: -50, deltaMode: 0 });
    const outF = wheelZoomFactor({ deltaY: 50, deltaMode: 0 });
    expect(inF).toBeGreaterThan(1);
    expect(outF).toBeLessThan(1);
    expect(inF * outF).toBeCloseTo(1);
  });
  test('line mode uses a larger unit', () => {
    expect(wheelZoomFactor({ deltaY: -1, deltaMode: 1 })).toBeCloseTo(Math.pow(2, 0.5));
  });
});

describe('clusterView', () => {
  // A 1000-wide world on a 400-wide band (fit k = 0.4), max zoom 60x fit, 48 px kept clear at each edge.
  const inView = (v: { x: number; k: number }, wx: number) => {
    const sx = v.x + v.k * wx;
    return sx >= 48 - 1e-9 && sx <= 400 - 48 + 1e-9;
  };
  test('zooms three times deeper when the members still fit, centred on them', () => {
    const v = clusterView([500, 510], 0.4, 400, 1000, 60, 48);
    expect(v.k).toBeCloseTo(1.2);
    expect((200 - v.x) / v.k).toBeCloseTo(505);
  });
  test('zooms less when three times would push a member out of view', () => {
    const v = clusterView([100, 400], 0.4, 400, 1000, 60, 48);
    expect(v.k).toBeLessThan(1.2);
    expect(inView(v, 100) && inView(v, 400)).toBe(true);
  });
  test('members that already span more than the band still zoom in (twice as deep), centred on their mean', () => {
    // A long chain of merged dots: 100..900 at k 0.4 is 320 px, more than the 304 px between the edges.
    const xs = [100, 300, 350, 400, 900];
    const v = clusterView(xs, 0.4, 400, 1000, 60, 48);
    expect(v.k).toBeCloseTo(0.8);
    expect((200 - v.x) / v.k).toBeCloseTo(410);
  });
  test('members that just fill the band, so keeping them all would barely zoom, still zoom twice as deep', () => {
    // 100..860 at k 0.4 is exactly the 304 px between the edges.
    const v = clusterView([100, 860], 0.4, 400, 1000, 60, 48);
    expect(v.k).toBeCloseTo(0.8);
    expect((200 - v.x) / v.k).toBeCloseTo(480);
  });
  test('a cluster at the very start of time stays on the band (the extent ends there)', () => {
    const v = clusterView([20, 40, 60, 80, 100], 0.4, 400, 1000, 60, 48);
    for (const wx of [20, 40, 60, 80, 100]) {
      const sx = v.x + v.k * wx;
      expect(sx >= 0 && sx <= 400, String(wx)).toBe(true);
    }
  });
  test('near the zoom limit the members are still centred', () => {
    const v = clusterView([700, 700], 20, 400, 1000, 60, 48);
    expect(v.k).toBeCloseTo(24);
    expect(v.x + v.k * 700).toBeCloseTo(200);
  });
  test('never zooms past the limit or out of the extent', () => {
    const v = clusterView([700, 700], 20, 400, 1000, 60, 48);
    expect(v.k).toBeLessThanOrEqual(0.4 * 60 + 1e-9);
    expect(v.x).toBeLessThanOrEqual(0);
    expect(v.x + v.k * 1000).toBeGreaterThanOrEqual(400 - 1e-9);
  });
});

describe('focusView', () => {
  test('centres the world point at the requested zoom', () => {
    const v = focusView(500, 4, 400, 1000, 60);
    expect(v.k).toBeCloseTo(1.6);
    expect((200 - v.x) / v.k).toBeCloseTo(500);
  });
  test('clamps at the extent edges', () => {
    expect(focusView(0, 4, 400, 1000, 60).x).toBe(0);
    const right = focusView(1000, 4, 400, 1000, 60);
    expect(right.x + right.k * 1000).toBeCloseTo(400);
  });
});

describe('estimateTextWidth / clampLabelX', () => {
  test('CJK glyphs count as a full em', () => {
    expect(estimateTextWidth('淚之夜', 10)).toBe(30);
    expect(estimateTextWidth('abc', 10)).toBeCloseTo(17.4);
  });
  test('labels stay inside the band', () => {
    expect(clampLabelX(5, 40, 300)).toBe(24);
    expect(clampLabelX(299, 40, 300)).toBe(276);
    expect(clampLabelX(150, 40, 300)).toBe(150);
    expect(clampLabelX(10, 400, 300)).toBe(150);
  });
});

describe('yearLabel / yearRangeLabel', () => {
  test('era tag and year, or the unknown word', () => {
    expect(yearLabel({ era: '4E', year: 171 }, '未知')).toBe('4E 171');
    expect(yearLabel({ era: 'merethic', year: null }, 'Unknown')).toBe('Unknown');
    expect(yearLabel({ era: 'merethic', year: 2500 }, '未知')).toBe('ME 2500');
  });
  test('ranges drop the repeated era, keep both eras across a boundary, collapse equal ends', () => {
    expect(yearRangeLabel({ era: '1E', year: 242 }, { era: '1E', year: 700 }, '未知')).toBe('1E 242–700');
    expect(yearRangeLabel({ era: '3E', year: 433 }, { era: '4E', year: 171 }, '未知')).toBe('3E 433–4E 171');
    expect(yearRangeLabel({ era: 'dawn', year: null }, { era: '1E', year: 143 }, '未知')).toBe('未知–1E 143');
    expect(yearRangeLabel({ era: 'dawn', year: null }, { era: 'merethic', year: null }, 'Unknown')).toBe('Unknown');
    expect(yearRangeLabel({ era: '1E', year: 700 }, { era: '1E', year: 700 }, '未知')).toBe('1E 700');
  });
});

describe('approximate years on the timeline', () => {
  test('a circa year carries the page language prefix', () => {
    expect(yearLabel({ era: '1E', year: 792, circa: true }, '未知', '約 ')).toBe('約 1E 792');
    expect(yearLabel({ era: '1E', year: 792, circa: true }, 'Unknown', 'c. ')).toBe('c. 1E 792');
    expect(yearLabel({ era: '1E', year: 792, circa: false }, '未知', '約 ')).toBe('1E 792');
    expect(yearLabel({ era: 'dawn', year: null, circa: true }, '未知', '約 ')).toBe('未知');
  });
  test('ranges keep the prefix and only shorten when both ends agree on it', () => {
    const a = { era: '1E', year: 668, circa: true };
    expect(yearRangeLabel(a, { era: '1E', year: 700, circa: true }, '未知', '約 ')).toBe('約 1E 668–700');
    expect(yearRangeLabel({ era: '1E', year: 482 }, { era: '1E', year: 792, circa: true }, '未知', '約 ')).toBe('1E 482–約 1E 792');
    expect(yearRangeLabel(a, { era: '1E', year: 808 }, '未知', '約 ')).toBe('約 1E 668–1E 808');
    // One year, approximate at either end, is one label.
    expect(yearRangeLabel({ era: '1E', year: 700 }, { era: '1E', year: 700, circa: true }, '未知', '約 ')).toBe('約 1E 700');
  });
});

describe('placeLabels', () => {
  test('labels that would overlap a placed one are left out, left to right', () => {
    const out = placeLabels([{ x: 100, w: 40 }, { x: 120, w: 40 }, { x: 200, w: 40 }], 400);
    expect(out).toEqual([100, null, 200]);
  });
  test('the selection is placed first and wins over an earlier neighbour', () => {
    const out = placeLabels([{ x: 100, w: 40 }, { x: 120, w: 40, priority: 1 }], 400);
    expect(out).toEqual([null, 120]);
  });
  test('labels stay inside the band and items off the band get none', () => {
    const out = placeLabels([{ x: 5, w: 40 }, { x: -10, w: 40 }, { x: 398, w: 40 }], 400);
    expect(out).toEqual([22, null, 378]);
  });
  test('placed labels never overlap, whatever the input', () => {
    const items = Array.from({ length: 30 }, (_, i) => ({ x: (i * 37) % 500, w: 30 + (i % 4) * 15, priority: i === 7 ? 1 : 0 }));
    const out = placeLabels(items, 500, 6);
    const spans = out
      .map((cx, i) => (cx === null ? null : [cx - items[i].w / 2, cx + items[i].w / 2]))
      .filter((s): s is number[] => s !== null)
      .sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < spans.length; i++) expect(spans[i][0]).toBeGreaterThanOrEqual(spans[i - 1][1] + 6);
    expect(out[7]).not.toBeNull();
  });
});

test('spanLabel reads a range for a span and a year otherwise', () => {
  expect(spanLabel({ era: '3E', year: 121, yearEnd: 127 }, 'Unknown')).toBe('3E 121–127');
  expect(spanLabel({ era: '3E', year: 121 }, 'Unknown')).toBe('3E 121');
  expect(spanLabel({ era: 'dawn', year: null }, 'Unknown')).toBe('Unknown');
});
test('boxesOverlap is true only when two boxes share area', () => {
  const a = { x: 0, y: 0, width: 10, height: 10 };
  expect(boxesOverlap(a, { x: 5, y: 5, width: 10, height: 10 })).toBe(true);
  expect(boxesOverlap(a, { x: 10, y: 0, width: 10, height: 10 })).toBe(false);
  expect(boxesOverlap(a, { x: 0, y: 12, width: 10, height: 10 })).toBe(false);
});

test('padEnd leaves 12% of the band after the end of time, 48 to 120 px (decisions/p4-review)', () => {
  expect(padEnd(300)).toBe(48);
  expect(padEnd(800)).toBe(96);
  expect(padEnd(1400)).toBe(120);
});

describe('centuryLines', () => {
  const segs = buildSegments();
  const total = segs[segs.length - 1].end;
  const years = (lines: { key: string }[], era: string) =>
    lines.filter((l) => l.key.startsWith(`${era}-`)).map((l) => Number(l.key.slice(era.length + 1)));

  test('the whole axis on a desktop band: every 500 years in the squeezed First Era, every 100 in the Second', () => {
    const k = 1000 / total;
    const lines = centuryLines(segs, k, (x) => x * k, 0, 1000);
    expect(years(lines, '1E')).toEqual([500, 1000, 1500, 2000, 2500]);
    expect(years(lines, '2E')).toEqual([100, 200, 300, 400, 500, 600, 700, 800]);
  });
  test("only the dated eras, never at an era's start or end, never closer than 24 px", () => {
    const k = 1000 / total;
    const lines = centuryLines(segs, k, (x) => x * k, -Infinity, Infinity);
    expect(lines.some((l) => /^(dawn|merethic)-/.test(l.key))).toBe(false);
    const eraYears: Record<string, number> = { '1E': 2920, '2E': 896, '3E': 433, '4E': 201 };
    for (const l of lines) {
      const [era, y] = l.key.split('-');
      expect(Number(y)).toBeGreaterThan(0);
      expect(Number(y)).toBeLessThan(eraYears[era]);
    }
    for (const era of Object.keys(eraYears)) {
      const xs = lines.filter((l) => l.key.startsWith(`${era}-`)).map((l) => l.x);
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(24);
    }
  });
  test('no lines where even 1000 years are closer than 24 px, and only those inside [lo, hi]', () => {
    expect(centuryLines(segs, 0.001, (x) => x * 0.001, -Infinity, Infinity)).toEqual([]);
    const lines = centuryLines(segs, 1, (x) => x - 1000, 0, 500);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l.x >= 0 && l.x <= 500).toBe(true);
  });
});

test("listYearLabel reads like the timeline, but an undated event reads its era's short tag (decisions/p4-merge)", () => {
  expect(listYearLabel({ era: 'merethic', year: null })).toBe('ME');
  expect(listYearLabel({ era: 'dawn', year: null })).toBe('DE');
  expect(listYearLabel({ era: '3E', year: 121, yearEnd: 127 })).toBe('3E 121–127');
  expect(listYearLabel({ era: '1E', year: 700, circa: true }, '約 ')).toBe('約 1E 700');
});
