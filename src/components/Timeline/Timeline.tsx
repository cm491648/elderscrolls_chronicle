import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, zoomTransform, type ZoomBehavior, type ZoomTransform } from 'd3-zoom';
import 'd3-transition';
import { clusterPoints, fanOutGroups, joinClusterTitles } from '../../lib/cluster';
import { eraLabel } from '../../lib/format';
import { buildLanes, laneChoices, type LaneId } from '../../lib/lanes';
import {
  centuryLines,
  clampLabelX,
  clusterView,
  estimateTextWidth,
  focusView,
  isAtPanLimit,
  normalizeWheelDelta,
  padEnd,
  placeLabels,
  preserveView,
  spanLabel,
  tabStopIndex,
  type View,
  wheelZoomFactor,
  yearRangeLabel,
  zoomLimits,
} from '../../lib/timeline-view';
import type { Timescale } from '../../lib/timescale';
import type { EventSummary, Lang, Location } from '../../lib/types';
import { MAPS } from '../MapView/shapes';
import { t } from '../../i18n';
import { stepTarget } from '../../lib/filter';
import './Timeline.css';

interface Props {
  events: EventSummary[];
  scale: Timescale;
  selectedId: string | null;
  lang: Lang;
  onSelect(id: string): void;
  /** Events a filter leaves out: drawn faint, still clickable, skipped by previous/next. */
  dimmed?: ReadonlySet<string>;
  /** The places, for the region each event's places lie in (which lanes it is drawn on). */
  locations: Location[];
}

const NONE: ReadonlySet<string> = new Set();
/** The era names' row at the top of the band; it stays put while the lanes scroll under it. */
const HEAD_H = 28;
/** One lane: its year labels in the upper part, the line and the marks lower down. */
const LANE_H = 34;
const MARK_Y = 21;
/** Room under the last lane for the selected event's title. */
const SEL_PAD = 26;
const MAX_ZOOM = 60;
/** Items closer than one hit target (32px) merge into a cluster, so hit areas never overlap. */
const CLUSTER_GAP = 32;
const HIT_R = 16;
/**
 * Room left at both ends of the drawing, so the first and the last events of time are whole and easy to hit even
 * under the faded edges (decisions/p4-design: the 4E 201 marks sat cut off at the right end on phones).
 */
const PAD = 2 * HIT_R;
/**
 * The drawing sits PAD to the right inside the svg, but d3-zoom reads pointers (a pinch's fingers) in svg pixels.
 * So d3 keeps its transform in svg pixels and the band's views drop PAD: convert at every hand-over between them.
 */
const fromZoom = (t: { x: number; k: number }): View => ({ x: t.x - PAD, k: t.k });
const toZoom = (v: View) => zoomIdentity.translate(v.x + PAD, 0).scale(v.k);
const EDGE = 48;
/** A span shorter than this on screen is drawn as a dot. */
const MIN_BAR = 10;
/**
 * The timeline's one breakpoint (same as the `max-width: 560px` block in Timeline.css): the band takes the whole
 * row with the buttons below it, and it opens on a zoomed-in stretch around the selection instead of the whole
 * squeezed axis.
 */
const NARROW_QUERY = '(max-width: 560px)';
const NARROW_ZOOM = 4;
/** Share of the band faded out at each end; only the lanes and the events fade, never the era names. */
const FADE = 0.03;
const ERA_FONT = 13;
const CHIP_FONT = 12;
const LABEL_FONT = 15;
const YEAR_FONT = 11;
const HINT_KEY = 'chronicle.tl-hint-hidden';
const EXPANDED_KEY = 'chronicle.tl-expanded';
const HIDDEN_KEY = 'chronicle.tl-hidden';
const duration = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 500);
const laneY = (i: number) => HEAD_H + i * LANE_H + MARK_Y;

const REGION_NAMES = new Map(Object.values(MAPS).flatMap((m) => m.regions.map((r) => [r.id, r.name] as const)));
function laneName(id: LaneId, lang: Lang): string {
  return id === 'realms' ? t(lang, 'laneRealms') : REGION_NAMES.get(id)?.[lang] ?? id;
}

function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStored(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: the choice lasts for this visit */
  }
}

/** One mark on one lane: an event's dot (or bar), or a cluster of nearby events. */
interface Item {
  key: string;
  lane: number;
  ids: string[];
  x: number;
  /** Holds an event's first lane: the one copy screen readers and the keyboard meet. */
  primary: boolean;
  /** Width of the span's bar on screen, when it is drawn as one. */
  bar: number;
}

export function Timeline({ events, scale, selectedId, lang, onSelect, dimmed = NONE, locations }: Props) {
  /** The first view at a given band width: the whole axis, or (narrow screens) a zoomed stretch around the selection. */
  const openingView = (w: number, id: string | null) =>
    matchMedia(NARROW_QUERY).matches && id
      ? focusView(scale.x(id), NARROW_ZOOM, w, scale.totalWidth, MAX_ZOOM)
      : { x: 0, k: w / scale.totalWidth };
  const svgRef = useRef<SVGSVGElement>(null);
  const fadeId = `tl-fade-${useId()}`;
  const bandRef = useRef<HTMLDivElement>(null);
  const laneBoxRef = useRef<HTMLDivElement>(null);
  const menuBtnRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const initWidthRef = useRef<number | null>(null);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  // 800 is only the pre-hydration guess; the zoom is set up once the real width is measured.
  const [svgWidth, setWidth] = useState(800);
  /** The width time is drawn over: the svg less the room at its ends. */
  const PAD_END = padEnd(svgWidth);
  const width = svgWidth - PAD - PAD_END;
  const [measured, setMeasured] = useState(false);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity.scale((800 - PAD - padEnd(800)) / scale.totalWidth));
  const [hover, setHover] = useState<string | null>(null);
  const [hintHidden, setHintHidden] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [hidden, setHidden] = useState<ReadonlySet<LaneId>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrollTop, setScrollTop] = useState(0);
  /** Zoomed in all the way, a same-year mark opens this list of its events, placed under the mark. */
  const [pick, setPick] = useState<{ key: string; ids: string[]; left: number; top: number } | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const pickRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (readStored(HINT_KEY) === '1') setHintHidden(true);
    if (readStored(EXPANDED_KEY) === '1') setExpanded(true);
    try {
      const list = JSON.parse(readStored(HIDDEN_KEY) ?? '[]');
      if (Array.isArray(list)) setHidden(new Set(list.filter((x): x is LaneId => typeof x === 'string')));
    } catch {
      /* unreadable: show every region */
    }
  }, []);
  const hideHint = () => {
    setHintHidden(true);
    writeStored(HINT_KEY, '1');
  };
  const toggleExpanded = () => {
    setExpanded(!expanded);
    writeStored(EXPANDED_KEY, expanded ? null : '1');
  };
  const toggleHidden = (id: LaneId) => {
    const next = new Set(hidden);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setHidden(next);
    writeStored(HIDDEN_KEY, next.size ? JSON.stringify([...next]) : null);
  };

  const regionOf = useMemo(() => {
    const m = new Map(locations.map((l) => [l.id, l.region]));
    return (id: string) => m.get(id);
  }, [locations]);
  const lanes = useMemo(
    () => buildLanes(events, regionOf, { expanded, hidden, selectedId }),
    [events, regionOf, expanded, hidden, selectedId],
  );
  const choices = useMemo(() => laneChoices(events, regionOf), [events, regionOf]);
  const height = HEAD_H + lanes.length * LANE_H + SEL_PAD;

  // Measure the band and lay the items out at their opening view before the first paint after hydration, so they
  // do not jump from the server's 800px guess once the zoom is set up (that effect then applies the same view).
  useLayoutEffect(() => {
    const w = svgRef.current!.getBoundingClientRect().width;
    if (w <= 0) return;
    const v = openingView(w - PAD - padEnd(w), selectedRef.current);
    setWidth(w);
    setMeasured(true);
    setTransform(zoomIdentity.translate(v.x, 0).scale(v.k));
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      if (w > 0) {
        setWidth(w);
        setMeasured(true);
      }
    });
    observer.observe(svgRef.current!);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!measured || width <= 0 || scale.totalWidth <= 0) return;
    const svg = svgRef.current!;
    const band = bandRef.current!;
    const sel = select(svg);
    const fitK = width / scale.totalWidth;
    const z = d3zoom<SVGSVGElement, unknown>()
      .extent([[PAD, 0], [PAD + width, height]])
      .scaleExtent([fitK, fitK * MAX_ZOOM])
      .translateExtent([[0, 0], [scale.totalWidth, height]])
      // Wheel input is handled below on the whole band; d3 keeps drag and pinch.
      .filter((ev: Event) => ev.type !== 'wheel' && !(ev as MouseEvent).button)
      .on('zoom', (ev) => {
        const v = fromZoom(ev.transform);
        setTransform(zoomIdentity.translate(v.x, 0).scale(v.k));
      });
    sel.call(z).on('dblclick.zoom', null);
    // First init: fit (wide) or a zoomed stretch around the selection (narrow); afterwards keep the view across resizes.
    const prevWidth = initWidthRef.current;
    const cur = fromZoom(zoomTransform(svg));
    const id = selectedRef.current;
    const next =
      prevWidth !== null
        ? preserveView(cur, prevWidth, width, scale.totalWidth, MAX_ZOOM)
        : openingView(width, id);
    sel.call(z.transform, toZoom(next));
    initWidthRef.current = width;
    zoomRef.current = z;

    const onWheel = (ev: WheelEvent) => {
      if (ev.ctrlKey) {
        // Ctrl+wheel and trackpad pinch zoom around the pointer; never let the page zoom instead.
        ev.preventDefault();
        const px = ev.clientX - svg.getBoundingClientRect().left;
        z.scaleBy(sel, wheelZoomFactor(ev), [px, height / 2]);
        return;
      }
      const delta = normalizeWheelDelta(ev, width);
      const t0 = zoomTransform(svg);
      if (isAtPanLimit(delta, fromZoom(t0), width, scale.totalWidth)) return;
      ev.preventDefault();
      z.translateBy(sel, -delta / t0.k, 0);
    };
    band.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      band.removeEventListener('wheel', onWheel);
      sel.on('.zoom', null);
    };
  }, [width, scale, measured, height]);

  useEffect(() => {
    const z = zoomRef.current;
    if (!z || !selectedId || width <= 0) return;
    const svg = svgRef.current!;
    const worldX = scale.x(selectedId);
    const screenX = zoomTransform(svg).applyX(worldX) - PAD;
    if (screenX < EDGE || screenX > width - EDGE) {
      z.translateTo(select(svg).transition().duration(duration()), worldX, height / 2);
    }
  }, [selectedId, width, scale]);

  // Bring the selected event's lane into the band when the lanes scroll.
  const selectedLane = selectedId ? lanes.findIndex((l) => l.ids.includes(selectedId)) : -1;
  useEffect(() => {
    const box = laneBoxRef.current;
    if (!box || selectedLane < 0) return;
    const y = laneY(selectedLane);
    const top = box.scrollTop + HEAD_H;
    const bottom = box.scrollTop + box.clientHeight - SEL_PAD;
    if (y - MARK_Y < top || y + LANE_H - MARK_Y > bottom)
      box.scrollTo({ top: Math.max(0, y - HEAD_H - LANE_H), behavior: duration() ? 'smooth' : 'auto' });
  }, [selectedId, selectedLane]);

  // The region menu closes on Escape (focus back on its button) and on a click anywhere else.
  useEffect(() => {
    if (!menuOpen) return;
    menuRef.current?.querySelector('input')?.focus();
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!menuRef.current?.contains(target) && !menuBtnRef.current?.contains(target)) setMenuOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [menuOpen]);
  const onMenuKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.stopPropagation();
    setMenuOpen(false);
    menuBtnRef.current?.focus();
  };

  // The same-year list closes when the view, the lanes or the selection change, on Escape and on a click elsewhere.
  useEffect(() => setPick(null), [transform.x, transform.k, lanes, selectedId, width]);
  // Layout effect: the list listens from the moment it is drawn, so an Escape pressed right away still closes it.
  useLayoutEffect(() => {
    if (!pick) return;
    pickRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onDown = (e: PointerEvent) => {
      const target = e.target as Element;
      if (!pickRef.current?.contains(target) && !target.closest?.(`[data-pick="${pick.key}"]`)) setPick(null);
    };
    // Escape closes it wherever the focus is (a story that has just opened may have taken it), before anything else
    // on the page reacts to the key.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      setPick(null);
      svgRef.current?.querySelector<SVGElement>(`[data-pick="${pick.key}"][role="button"]`)?.focus();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [pick]);

  const ids = useMemo(() => events.map((e) => e.id), [events]);
  const prevId = stepTarget(ids, selectedId, -1, dimmed);
  const nextId = stepTarget(ids, selectedId, 1, dimmed);
  const go = (step: 1 | -1) => {
    const target = step < 0 ? prevId : nextId;
    if (target) onSelect(target);
  };
  const limits = zoomLimits(transform.k, width, scale.totalWidth, MAX_ZOOM);
  const zoomBy = (factor: number, x: number) => {
    const z = zoomRef.current;
    if (z) z.scaleBy(select(svgRef.current!).transition().duration(duration()), factor, [x + PAD, height / 2]);
  };
  const openCluster = (it: Item, el: Element) => {
    const members = it.ids;
    if (!limits.canZoomIn) {
      // Same-year events: the list to choose from, under the mark (on the nav, so the scrolling band never clips it).
      if (pick?.key === it.key) {
        setPick(null);
        return;
      }
      const nav = navRef.current!.getBoundingClientRect();
      const mark = el.getBoundingClientRect();
      setPick({ key: it.key, ids: members, left: mark.left + mark.width / 2 - nav.left, top: mark.bottom - nav.top + 4 });
      return;
    }
    // The cluster element unmounts once it splits; park focus on the svg so it is not lost.
    svgRef.current?.focus();
    setHover(null);
    // Zoom in on the members, keeping all of them on the band (a plain 3x zoom about the cluster's centre could push
    // its outer members out of view).
    const z = zoomRef.current;
    if (!z) return;
    const v = clusterView(members.map((id) => scale.x(id)), transform.k, width, scale.totalWidth, MAX_ZOOM, EDGE);
    z.transform(select(svgRef.current!).transition().duration(duration()), toZoom(v));
  };
  const titles = new Map(events.map((e) => [e.id, e.title]));
  const byId = new Map(events.map((e) => [e.id, e]));

  // Each event's first lane holds the copy screen readers and the keyboard meet; the others only repeat it.
  const firstLane = new Map<string, number>();
  lanes.forEach((l, i) => l.ids.forEach((id) => firstLane.has(id) || firstLane.set(id, i)));
  const keyOf = (lane: number, members: string[]) => `${lane}:${members.join('|')}`;
  const items: Item[] = lanes.flatMap((l, lane) => {
    const points = l.ids.map((id) => ({ id, x: transform.applyX(scale.x(id)) }));
    // Zoomed in as far as it goes, events in nearby years would stay merged for good: spread them out so each year has
    // its own mark (a few px from its true place). Events of the very same year stay one mark, opened as a list.
    const groups = limits.canZoomIn
      ? clusterPoints(points, CLUSTER_GAP)
      : fanOutGroups(points, CLUSTER_GAP, transform.applyX(0), transform.applyX(scale.totalWidth));
    return groups.map((g) => {
      const [a, b] = scale.span(g.ids[0]);
      const bar = g.ids.length === 1 ? (b - a) * transform.k : 0;
      return {
        key: keyOf(lane, g.ids),
        lane,
        ids: g.ids,
        x: g.x,
        primary: g.ids.some((id) => firstLane.get(id) === lane),
        bar: bar >= MIN_BAR ? bar : 0,
      };
    });
  });
  const focusable = items.filter((it) => it.primary).sort((a, b) => a.x - b.x);
  const stopItem = focusable[tabStopIndex(focusable, selectedId, width)];
  const activate = (fn: () => void) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };
  const onTimelineKey = (e: KeyboardEvent) => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    if ((e.key === '+' || e.key === '=') && limits.canZoomIn) zoomBy(2, width / 2);
    else if ((e.key === '-' || e.key === '_') && limits.canZoomOut) zoomBy(0.5, width / 2);
    else return;
    e.preventDefault();
  };
  const hoverProps = (key: string) => ({
    onPointerEnter: () => setHover(key),
    onPointerLeave: () => setHover((h) => (h === key ? null : h)),
    onFocus: () => setHover(key),
    onBlur: () => setHover((h) => (h === key ? null : h)),
  });

  const hovered = hover ? items.find((it) => it.key === hover) : undefined;
  const chipText = hovered
    ? hovered.ids.length > 1
      ? joinClusterTitles(hovered.ids.map((id) => titles.get(id) ?? id), lang)
      : titles.get(hovered.ids[0]) ?? ''
    : '';
  const chipW = Math.min(260, estimateTextWidth(chipText, CHIP_FONT) + 18);
  const holder = selectedId ? items.find((it) => it.primary && it.ids.includes(selectedId)) : undefined;
  const selTitle = selectedId ? titles.get(selectedId) ?? '' : '';
  const selW = estimateTextWidth(selTitle, LABEL_FONT) * 1.05;
  const showSel = holder && holder.x >= 0 && holder.x <= width && hovered !== holder;
  // The selected (or hovered) event's marks on every lane it is on, joined top to bottom.
  const linkId = selectedId ?? (hovered && hovered.ids.length === 1 ? hovered.ids[0] : null);
  const linked = linkId ? items.filter((it) => it.ids.includes(linkId)).sort((a, b) => a.lane - b.lane) : [];
  // Year (dot), range (cluster) or span (bar) above every item that has room, lane by lane; the selection first.
  const unknown = t(lang, 'yearUnknown');
  const circa = t(lang, 'circaPrefix');
  const ownYear = (id: string) => spanLabel(byId.get(id)!, unknown, circa);
  const years = items.map((it) => {
    const first = byId.get(it.ids[0])!;
    const last = byId.get(it.ids[it.ids.length - 1])!;
    // A same-year mark holding the selection shows the selected event's own year (one of them may be approximate).
    if (it.ids.length > 1 && !limits.canZoomIn && selectedId && it.ids.includes(selectedId)) return ownYear(selectedId);
    return it.ids.length > 1 ? yearRangeLabel(first, last, unknown, circa) : spanLabel(first, unknown, circa);
  });
  const labelX = (it: Item) => it.x + it.bar / 2;
  const yearX: (number | null)[] = items.map(() => null);
  lanes.forEach((_, lane) => {
    const mine = items.map((it, i) => ({ it, i })).filter(({ it }) => it.lane === lane);
    const placed = placeLabels(
      mine.map(({ it, i }) => ({
        x: labelX(it),
        w: estimateTextWidth(years[i], YEAR_FONT) * 1.05 + 2,
        priority: it === holder ? 1 : 0,
      })),
      width,
    );
    mine.forEach(({ i }, k) => (yearX[i] = placed[k]));
  });
  const descId = (i: number) => `${fadeId}-y${i}`;
  const centuries = centuryLines(scale.segments, transform.k, (x) => transform.applyX(x), -PAD, width + PAD_END);
  const pickYear = pick ? years[items.findIndex((it) => it.key === pick.key)] ?? '' : '';

  return (
    <nav class="timeline" ref={navRef} aria-label={t(lang, 'timeline')} onKeyDown={onTimelineKey}>
      <button type="button" class="tl-nav tl-prev" aria-label={t(lang, 'prev')} disabled={prevId === null} onClick={() => go(-1)}>
        ‹
      </button>
      <div class="tl-band-frame corners">
        <div class="tl-band" ref={laneBoxRef} onScroll={(e) => setScrollTop((e.currentTarget as HTMLElement).scrollTop)}>
          <div class="tl-names" style={{ height: `${height}px` }}>
            <div class="tl-names-head" aria-hidden="true" />
            {lanes.map((l, i) => (
              <div
                key={l.id}
                class={`tl-name depth-${l.depth}${l.temporary ? ' is-temporary' : ''}`}
                data-lane={l.id}
                style={{ top: `${laneY(i) - 15}px` }}
              >
                <span class="tl-name-text">{laneName(l.id, lang)}</span>
                {l.temporary && <small>{t(lang, 'laneTemporary')}</small>}
                {l.expandable && (
                  <button
                    type="button"
                    class="tl-expand"
                    aria-expanded={expanded}
                    aria-label={t(lang, expanded ? 'laneCollapse' : 'laneExpand', { name: laneName('tamriel', lang) })}
                    onClick={toggleExpanded}
                  >
                    {expanded ? '▾' : '▸'}
                  </button>
                )}
              </div>
            ))}
          </div>
          <div class="tl-scroll" ref={bandRef}>
            <svg ref={svgRef} class="tl-svg" height={height} tabindex={-1}>
              <defs>
                <linearGradient id={`${fadeId}-g`}>
                  <stop offset={0} stop-color="#fff" stop-opacity={0} />
                  <stop offset={FADE} stop-color="#fff" />
                  <stop offset={1 - FADE} stop-color="#fff" />
                  <stop offset={1} stop-color="#fff" stop-opacity={0} />
                </linearGradient>
                <mask id={fadeId} maskUnits="userSpaceOnUse" x={-PAD} y={0} width={svgWidth} height={height}>
                  <rect x={-PAD} width={svgWidth} height={height} fill={`url(#${fadeId}-g)`} />
                </mask>
              </defs>
              <g transform={`translate(${PAD},0)`}>
              {scale.segments.map((s, i) => {
                const x0 = transform.applyX(s.start);
                if (i === 0 || x0 < 0 || x0 > width) return null;
                return <line key={s.era} class="era-sep" x1={x0} x2={x0} y1={0} y2={height} />;
              })}
              <g class="tl-faded" mask={`url(#${fadeId})`}>
                <g class="tl-centuries" aria-hidden="true">
                  {centuries.map((c) => (
                    <line key={c.key} class="tl-century" data-century={c.key} x1={c.x} x2={c.x} y1={HEAD_H} y2={height - SEL_PAD} />
                  ))}
                </g>
                {lanes.map((l, lane) => (
                  <g key={l.id} class="tl-lane" data-lane={l.id} transform={`translate(0,${laneY(lane)})`}>
                    <line class="tl-axis" x1={-PAD} x2={width + PAD_END} y1={0} y2={0} />
                    <g class="tl-years" aria-hidden="true">
                      {items.map((it, i) =>
                        it.lane !== lane || yearX[i] === null ? null : (
                          <text key={it.key} class={`tl-year${it === holder ? ' is-selected' : ''}`} x={yearX[i]!} y={-9}>
                            {years[i]}
                          </text>
                        ),
                      )}
                    </g>
                  </g>
                ))}
                {/* Spans under the dots: a dot on top of a bar stays clickable, the rest of the bar picks its own event. */}
                {items.map((it) =>
                  it.bar > 0 ? (
                    <g
                      key={`span-${it.key}`}
                      class={`tl-span${it.ids[0] === selectedId ? ' is-selected' : ''}${dimmed.has(it.ids[0]) ? ' is-dimmed' : ''}`}
                      transform={`translate(${it.x},${laneY(it.lane)})`}
                      data-ids={it.ids[0]}
                      data-lane={lanes[it.lane].id}
                      aria-hidden="true"
                      onClick={() => onSelect(it.ids[0])}
                      {...hoverProps(it.key)}
                    >
                      <rect class="tl-span-hit" x={0} y={-HIT_R} width={it.bar} height={2 * HIT_R} />
                      <rect class="tl-bar" x={0} y={-5} width={it.bar} height={10} rx={5} />
                      <circle class="tl-hit" cx={it.bar} r={HIT_R} />
                    </g>
                  ) : null,
                )}
                {linked.length > 1 && (
                  <polyline class="tl-link" points={linked.map((it) => `${it.x},${laneY(it.lane)}`).join(' ')} />
                )}
                {items.map((it, i) => {
                  const y = laneY(it.lane);
                  // Only an event's first copy is a button; the copies on its other lanes are hidden from screen readers.
                  const role = it.primary ? 'button' : undefined;
                  const tabindex = it.primary ? (it === stopItem ? 0 : -1) : undefined;
                  const describedBy = it.primary ? descId(i) : undefined;
                  const ariaHidden = it.primary ? undefined : true;
                  if (it.ids.length > 1) {
                    const members = joinClusterTitles(it.ids.map((id) => titles.get(id) ?? id), lang);
                    const holdsSelection = selectedId !== null && it.ids.includes(selectedId);
                    const allDimmed = it.ids.every((x) => dimmed.has(x));
                    const sameYear = !limits.canZoomIn;
                    return (
                      <g
                        key={it.key}
                        class={`tl-cluster${holdsSelection ? ' is-selected' : ''}${allDimmed ? ' is-dimmed' : ''}`}
                        transform={`translate(${it.x},${y})`}
                        data-ids={it.ids.join('|')}
                        data-lane={lanes[it.lane].id}
                        data-pick={sameYear ? it.key : undefined}
                        aria-label={`${t(lang, sameYear ? 'sameYearLabel' : 'clusterLabel', { n: it.ids.length })}: ${members}`}
                        aria-expanded={sameYear && it.primary ? pick?.key === it.key : undefined}
                        role={role}
                        tabindex={tabindex}
                        aria-describedby={describedBy}
                        aria-hidden={ariaHidden}
                        onClick={(e) => openCluster(it, e.currentTarget as Element)}
                        onKeyDown={(e) => activate(() => openCluster(it, e.currentTarget as Element))(e)}
                        {...hoverProps(it.key)}
                      >
                        <circle class="tl-hit" r={HIT_R} />
                        <circle class="tl-mark" r={11} />
                        <text dy={4}>{it.ids.length}</text>
                      </g>
                    );
                  }
                  const id = it.ids[0];
                  const isSelected = id === selectedId;
                  return (
                    <g
                      key={it.key}
                      class={`tl-dot${isSelected ? ' is-selected' : ''}${dimmed.has(id) ? ' is-dimmed' : ''}`}
                      transform={`translate(${it.x},${y})`}
                      data-ids={id}
                      data-lane={lanes[it.lane].id}
                      aria-label={titles.get(id)}
                      role={role}
                      tabindex={tabindex}
                      aria-describedby={describedBy}
                      aria-hidden={ariaHidden}
                      aria-pressed={it.primary ? isSelected : undefined}
                      onClick={() => onSelect(id)}
                      onKeyDown={activate(() => onSelect(id))}
                      {...hoverProps(it.key)}
                    >
                      <circle class="tl-hit" r={HIT_R} />
                      {isSelected && <circle class="tl-ring" r={15} />}
                      <circle class="tl-mark" r={isSelected ? 9 : 6} />
                    </g>
                  );
                })}
              </g>
              {/* The era names stay at the top while the lanes scroll under them. */}
              <g class="tl-head" transform={`translate(0,${scrollTop})`}>
                <rect class="tl-head-bg" x={-PAD} width={svgWidth} height={HEAD_H} />
                {scale.segments.map((s, i) => {
                  const x0 = transform.applyX(s.start);
                  const x1 = transform.applyX(s.end);
                  if (x1 < 0 || x0 > width) return null;
                  const left = Math.max(x0, 0);
                  const label = eraLabel(s.era, lang);
                  // The name follows a small lozenge (decisions/es-feel-spec-2), about 12px with its space.
                  const fits = x1 - left >= estimateTextWidth(label, ERA_FONT) * 1.1 + 16 + 12;
                  return (
                    <g key={s.era} class="era">
                      {i > 0 && <line class="era-sep" x1={x0} x2={x0} y1={0} y2={HEAD_H} />}
                      {fits && (
                        <text class="era-name" x={left + 8} y={19}>
                          <tspan class="era-mark" aria-hidden="true">◆ </tspan>
                          {label}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
              </g>
            </svg>
            {hovered && (
              <span
                class="tl-chip"
                aria-hidden="true"
                style={{ left: `${PAD + clampLabelX(hovered.x, chipW, width)}px`, top: `${laneY(hovered.lane) - 33}px`, maxWidth: '260px' }}
              >
                {chipText}
              </span>
            )}
            {showSel && (
              <span
                class="tl-sel-label"
                aria-hidden="true"
                style={{ left: `${PAD + clampLabelX(holder.x, selW, width)}px`, top: `${laneY(holder.lane) + 9}px` }}
              >
                {selTitle}
              </span>
            )}
          </div>
        </div>
      </div>
      {pick && (
        <div
          class="tl-pick"
          ref={pickRef}
          role="group"
          aria-label={t(lang, 'sameYearList', { year: pickYear })}
          style={{ left: `${pick.left}px`, top: `${pick.top}px` }}
        >
          {pick.ids.map((id, i) => (
            <button
              type="button"
              key={id}
              class={`tl-pick-option${dimmed.has(id) ? ' is-dimmed' : ''}`}
              aria-pressed={id === selectedId}
              aria-describedby={`${fadeId}-pick-${i}`}
              onClick={() => {
                setPick(null);
                onSelect(id);
              }}
            >
              {titles.get(id)}
              {dimmed.has(id) && <small>{t(lang, 'searchFilteredOut')}</small>}
              <span hidden id={`${fadeId}-pick-${i}`}>
                {ownYear(id)}
              </span>
            </button>
          ))}
        </div>
      )}
      <button
        type="button"
        class="tl-nav tl-next"
        aria-label={t(lang, 'next')}
        disabled={nextId === null}
        onClick={() => go(1)}
      >
        ›
      </button>
      {/* The year (or range) of every item for screen readers, as its description: the visible labels are drawn
          only where they fit and are aria-hidden, the names stay the bare titles. */}
      <div hidden>
        {items.map((it, i) => (it.primary ? <span key={it.key} id={descId(i)}>{years[i]}</span> : null))}
      </div>
      <div class="tl-foot">
        {!hintHidden && (
          <p class="tl-hint">
            <span>
              <kbd>{lang === 'en' ? 'Wheel' : '滾輪'}</kbd> {t(lang, 'hintWheel')}
            </span>
            <span>
              <kbd>Ctrl</kbd>＋<kbd>{lang === 'en' ? 'Wheel' : '滾輪'}</kbd> {t(lang, 'hintZoom')}
            </span>
            <button type="button" class="tl-hint-hide" aria-label={t(lang, 'hintHide')} onClick={hideHint}>
              ×
            </button>
          </p>
        )}
        <div class="tl-tools">
          <div class="tl-regions-wrap">
            <button
              type="button"
              class="tl-regions"
              ref={menuBtnRef}
              aria-expanded={menuOpen}
              aria-controls={`${fadeId}-regions`}
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {t(lang, 'laneMenu')}
            </button>
            {menuOpen && (
              <div
                class="tl-region-menu"
                id={`${fadeId}-regions`}
                ref={menuRef}
                role="group"
                aria-label={t(lang, 'laneMenuLabel')}
                onKeyDown={onMenuKey}
              >
                {choices.map((c) => (
                  <label key={c.id} class={`depth-${c.depth}`}>
                    <input type="checkbox" checked={!hidden.has(c.id)} onChange={() => toggleHidden(c.id)} />
                    {laneName(c.id, lang)}
                  </label>
                ))}
              </div>
            )}
          </div>
          <div class="tl-zoom">
            <button
              type="button"
              class="tl-nav tl-nav-sm"
              aria-label={t(lang, 'zoomOut')}
              disabled={!limits.canZoomOut}
              onClick={() => zoomBy(0.5, width / 2)}
            >
              −
            </button>
            <button
              type="button"
              class="tl-nav tl-nav-sm"
              aria-label={t(lang, 'zoomIn')}
              disabled={!limits.canZoomIn}
              onClick={() => zoomBy(2, width / 2)}
            >
              +
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
