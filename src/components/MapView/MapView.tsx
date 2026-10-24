import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { select } from 'd3-selection';
import { zoom as d3zoom, zoomIdentity, type ZoomBehavior } from 'd3-zoom';
import 'd3-transition';
import { MAPS, pathData, type Region } from './shapes';
import { basemapFor, deviceWidth, rasterFor } from '../../lib/map-source';
import {
  childLayerOf,
  commonLayer,
  coverScale,
  coverViewAt,
  clampView,
  maxScale,
  eventView,
  frameView,
  EDGE_INSETS,
  lineage,
  parentOf,
  pathTo,
  placesOn,
  project,
  projectRegion,
  regionOnLayer,
  viewOnParent,
  type Frame,
  type Insets,
  type View,
} from '../../lib/map-layers';
import { withBase } from '../../lib/paths';
import { eventsAtLocation, eventsInRegion } from '../../lib/lookup';
import { groupMarkers, separatingScale } from '../../lib/marker-groups';
import { joinClusterTitles } from '../../lib/cluster';
import { listYearLabel } from '../../lib/timeline-view';
import { PROVINCES, type EventSummary, type Lang, type Location, type MapLayer, type Province } from '../../lib/types';
import { t, type UiKey } from '../../i18n';
import './MapView.css';

interface Props {
  events: EventSummary[];
  locations: Location[];
  selected: EventSummary | null;
  lang: Lang;
  onSelect(id: string): void;
  /** Events a filter leaves out: a place whose events are all left out is drawn faint. */
  dimmed?: ReadonlySet<string>;
}

const NONE: ReadonlySet<string> = new Set();

interface Popup {
  title: string;
  events: EventSummary[];
}

interface Size {
  W: number;
  H: number;
}

const TAG_PAD = 7;
/** One zoom between a layer and the next (in or out). */
const STEP_MS = 480;
/** The cross-fade between two layers' pictures. */
const FADE_MS = 260;
/** Longest wait for a layer's raster before the cross-fade starts anyway. */
const RASTER_WAIT_MS = 700;
/** The frozen picture keeps its look under ghost-* names, without ids, roles, focus or labels. */
const GHOST_DROP = ['id', 'role', 'tabindex', 'aria-label', 'aria-current', 'data-region', 'clip-path'];
const GHOST_CLASSES = [
  ['map-marker', 'ghost-marker'],
  ['map-basemap', 'ghost-basemap'],
  ['map-preview', 'ghost-preview'],
  ['map-pad', 'ghost-pad'],
  ['region', 'ghost-region'],
  ['region-tag', 'ghost-tag'],
  ['region-label', 'ghost-label'],
  ['event-region', 'ghost-event-region'],
] as const;
const nextFrames = (n: number) =>
  new Promise<void>((resolve) => {
    const step = (left: number) => (left <= 0 ? resolve() : requestAnimationFrame(() => step(left - 1)));
    step(n);
  });
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const isProvince = (layer: MapLayer): layer is Province => (PROVINCES as readonly string[]).includes(layer);

export function layerName(layer: MapLayer, lang: Lang): string {
  if (isProvince(layer)) return MAPS.tamriel.regions.find((r) => r.id === layer)!.name[lang];
  return t(lang, `layer_${layer}` as UiKey);
}

export function MapView({ events, locations, selected, lang, onSelect, dimmed = NONE }: Props) {
  // The first view comes straight from the selected event (no zoom animation on page load).
  const initial = useMemo(() => (selected ? eventView(selected, locations, lang) : null), []);
  const [layer, setLayer] = useState<MapLayer>(initial?.layer ?? 'tamriel');
  const [size, setSize] = useState<Size | null>(null);
  const [popup, setPopup] = useState<Popup | null>(null);
  /**
   * Where markers carried up from a game-map province sit: 'warped' on the parent map's own glyphs (at rest), or
   * 'plain' where the province picture itself puts them (while zooming between the two layers, so they do not jump;
   * a CSS transition glides them from one to the other).
   */
  const [glide, setGlide] = useState<'warped' | 'plain'>('warped');
  const [focusRing, setFocusRing] = useState<string | null>(null);
  const [announce, setAnnounce] = useState('');
  // No raster in the server HTML: the client picks one image from the size the map is about to be shown at, so a
  // page requests a single file. Each layer keeps its own stack (small under full while the full one decodes).
  const [rasters, setRasters] = useState<Partial<Record<MapLayer, ('small' | 'full')[]>>>({});
  // The zoom the markers were last grouped at (P3-A5): set when a zoom ends, so groups split or merge after a gesture.
  const [markerK, setMarkerK] = useState<number | null>(null);
  /** A group that had the focus and zoomed apart hands it to its first place. */
  const focusPlaceRef = useRef<string | null>(null);

  const plateRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const gRef = useRef<SVGGElement>(null);
  const ghostRef = useRef<HTMLDivElement>(null);
  const navBarRef = useRef<HTMLElement>(null);
  const capRef = useRef<HTMLParagraphElement>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const layerRef = useRef(layer);
  const sizeRef = useRef<Size | null>(null);
  const viewRef = useRef<View>({ k: 1, x: 0, y: 0 });
  /** What the current layer is meant to show: refit to it when the plate changes size, until the reader pans. */
  const intentRef = useRef<{ layer: MapLayer; frame: Frame | null }>({ layer, frame: initial?.frame ?? null });
  const userMovedRef = useRef(false);
  /** Bumped by every navigation: a newer one cancels the steps left of an older one. */
  const navRef = useRef(0);
  const busyRef = useRef(false);
  /** The plate size the current view was worked out for: a resize during a zoom is caught up when it ends. */
  const viewSizeRef = useRef<Size | null>(null);
  /** Set by swapLayer: the view the next layer opens at, resolved once it is on screen. */
  const pendingRef = useRef<{ layer: MapLayer; view: View; settle: View; done(): void } | null>(null);
  const fadeRef = useRef<{ start(): void } | null>(null);
  /** Where keyboard focus goes once a navigation ends (the element that had it is gone with the old layer). */
  const focusAfterRef = useRef<'crumb' | { region: string } | null>(null);
  const clipId = `map-clip-${useId()}`;

  const map = MAPS[layer];
  const [w, h] = map.viewBox;
  const basemap = basemapFor(layer);
  const stack = rasters[layer] ?? [];
  // The official rasters already name the provinces in English: English pages hide our labels, Chinese pages add a
  // paper tag with the Chinese name under the map's own lettering. Drawn rasters carry no lettering and are busy, so
  // both languages get paper tags; a layer with no raster gets plain text labels.
  const labelMode: 'text' | 'tag' | 'none' = !basemap
    ? 'text'
    : basemap.credit === 'mapCreditDrawn' || basemap.credit === 'mapCreditSchematic' || lang !== 'en'
      ? 'tag'
      : 'none';
  const plateClass =
    (basemap ? ' has-basemap' : '') + (map.looseRegions ? ' regions-loose' : '');

  const selectedIds = useMemo(() => new Set(selected?.locations ?? []), [selected]);
  const selectedLocations = useMemo(() => locations.filter((l) => selectedIds.has(l.id)), [locations, selectedIds]);
  // Selected places from finer layers are carried up only onto the layer the event is shown on (not every ancestor).
  const viewLayer = useMemo(() => (selected ? eventView(selected, locations).layer : null), [selected, locations]);
  // Selected places are drawn last, so no other marker sits on them; their name tags go in a layer above all markers.
  const places = useMemo(() => {
    const all = placesOn(layer, locations, viewLayer === layer ? selectedIds : new Set());
    return [...all.filter((p) => !selectedIds.has(p.loc.id)), ...all.filter((p) => selectedIds.has(p.loc.id))];
  }, [layer, locations, selectedIds, viewLayer]);
  // Whole regions the event names: highlighted in place on their own layer, outlined when carried up from below.
  const eventRegions = useMemo(
    () => (selected?.regions ?? []).map((id) => projectRegion(id, layer)).filter((r) => r !== null),
    [selected, layer],
  );
  const activeRegions = new Set<string>();
  for (const loc of selectedLocations) {
    // On the layer the event is shown on, places from finer layers are marked themselves: lighting the region that
    // holds them too (all of Tamriel on Nirn) would drown the event's own regions.
    if (loc.layer !== layer && viewLayer === layer) continue;
    const r = regionOnLayer(loc, layer);
    if (r) activeRegions.add(r);
  }
  for (const r of eventRegions) if (r.d === null) activeRegions.add(r.id);
  // A province's own crop already sets it apart (neighbours greyed); outlining it too would read as a river.
  if (isProvince(layer)) activeRegions.delete(layer);

  layerRef.current = layer;

  // ---- zoom plumbing ----

  /** Pick a layer's first raster before anything is requested, from the zoom it is about to settle at. */
  const chooseRaster = (l: MapLayer, k: number) => {
    const bm = basemapFor(l);
    if (!bm) return;
    const choice = rasterFor(deviceWidth(k * MAPS[l].viewBox[0], devicePixelRatio), bm);
    setRasters((r) => (r[l]?.length ? r : { ...r, [l]: [choice] }));
  };

  /** Zooming in past the threshold later adds the full image on top of the small one. */
  const upgradeRaster = () => {
    const l = layerRef.current;
    const bm = basemapFor(l);
    if (!bm || busyRef.current) return;
    if (rasterFor(deviceWidth(viewRef.current.k * MAPS[l].viewBox[0], devicePixelRatio), bm) !== 'full') return;
    setRasters((r) => {
      const cur = r[l] ?? [];
      return cur.length === 0 || cur.includes('full') ? r : { ...r, [l]: [...cur, 'full'] };
    });
  };

  /** The current view moved to a plate of another size, with the same spot in the middle (and still filled). */
  const recentre = (from: Size, to: Size): View => {
    const [lw, lh] = MAPS[layerRef.current].viewBox;
    const cur = viewRef.current;
    const cx = (from.W / 2 - cur.x) / cur.k;
    const cy = (from.H / 2 - cur.y) / cur.k;
    return clampView({ k: cur.k, x: to.W / 2 - cur.k * cx, y: to.H / 2 - cur.k * cy }, to.W, to.H, lw, lh);
  };

  /** The caption's box when it lies over the plate (wide screens), or null when it sits under it. */
  const capOverPlate = () => {
    const svg = svgRef.current?.getBoundingClientRect();
    const cap = capRef.current?.getBoundingClientRect();
    return svg && cap && cap.height > 0 && cap.top < svg.bottom - 1 && cap.bottom > svg.top ? cap : null;
  };
  /** The plate's edges to keep clear when framing: the level path along the top, the caption along the bottom. */
  const insets = (): Insets => {
    const svg = svgRef.current?.getBoundingClientRect();
    if (!svg) return EDGE_INSETS;
    const nav = navBarRef.current?.getBoundingClientRect();
    const cap = capOverPlate();
    return {
      ...EDGE_INSETS,
      top: nav && nav.height > 0 ? Math.max(EDGE_INSETS.top, nav.bottom - svg.top + 6) : EDGE_INSETS.top,
      bottom: cap ? Math.max(EDGE_INSETS.bottom, svg.bottom - cap.top + 6) : EDGE_INSETS.bottom,
    };
  };
  const frameFor = (l: MapLayer, frame: Frame | null, s: Size) => frameView(l, frame, s.W, s.H, insets());

  /**
   * Place the selected places' name tags (and push region tags off the level path) once the view has settled:
   * each tag tries right of its dot, then left, then right or left a row up or down, and takes the first spot that
   * overlaps no tag placed before it, no selected dot and not the level path, inside the plate.
   */
  const placeTags = () => {
    const svg = svgRef.current;
    const plate = svg?.getBoundingClientRect();
    if (!svg || !plate || plate.width === 0) return;
    const nav = navBarRef.current?.getBoundingClientRect();
    const k = viewRef.current.k;
    type R = { l: number; t: number; r: number; b: number };
    const hit = (a: R, b: R) => a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
    const area = (a: R, b: R) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
    // Obstacles: every selected place (a tag must never hide one), the level path, and the tags placed so far.
    const dots: R[] = [];
    const taken: R[] = [];
    if (nav && nav.height > 0) taken.push({ l: nav.left - 4, t: nav.top - 4, r: nav.right + 4, b: nav.bottom + 4 });
    const cap = capOverPlate();
    if (cap) taken.push({ l: cap.left - 4, t: cap.top - 4, r: cap.right + 4, b: cap.bottom + 4 });
    svg.querySelectorAll<SVGElement>('.map-marker.is-active .mk-dot').forEach((d) => {
      const b = d.getBoundingClientRect();
      dots.push({ l: b.left - 3, t: b.top - 3, r: b.right + 3, b: b.bottom + 3 });
    });
    // Region tags first: only moved down out of the level path's way.
    svg.querySelectorAll<SVGGElement>('.region-tag-anchor').forEach((g) => {
      const lx = Number(g.dataset.x);
      const ly = Number(g.dataset.y);
      g.setAttribute('transform', `translate(${lx},${ly})`);
      const b = g.getBoundingClientRect();
      if (nav && nav.height > 0 && hit({ l: b.left, t: b.top, r: b.right, b: b.bottom }, { l: nav.left, t: nav.top, r: nav.right, b: nav.bottom }))
        g.setAttribute('transform', `translate(${lx},${ly + (nav.bottom + 4 - b.top) / k})`);
    });
    const tags = [...svg.querySelectorAll<SVGGElement>('.mk-tags .mk-tag')];
    // Each place's screen position from its map position and the view (the anchor's own box includes its tag).
    const v = viewRef.current;
    const sized = tags.map((tag) => {
      const anchor = tag.closest<SVGGElement>('.mk-tag-anchor')!;
      return {
        tag,
        w: Number(tag.querySelector('rect')?.getAttribute('width') ?? 0),
        cx: plate.left + Number(anchor.dataset.x) * v.k + v.x,
        cy: plate.top + Number(anchor.dataset.y) * v.k + v.y,
      };
    });
    sized.sort((a, b) => a.cy - b.cy);
    for (const { tag, w, cx, cy } of sized) {
      // Right, left, a row up or down on either side, then centred above or below, two rows out last.
      const spots: [number, number][] = [
        [16, 0], [-16 - w, 0], [16, -24], [16, 24], [-16 - w, -24], [-16 - w, 24],
        [-w / 2, -26], [-w / 2, 26], [16, -48], [16, 48], [-16 - w, -48], [-16 - w, 48], [-w / 2, -50], [-w / 2, 50],
      ];
      // The first spot clear of everything; failing that, the one covering the least: a selected place weighs
      // far more than another tag or the path, and leaving the plate more still.
      let chosen = spots[0];
      let best = Infinity;
      for (const [dx, dy] of spots) {
        const r = { l: cx + dx, t: cy + dy - 11, r: cx + dx + w, b: cy + dy + 11 };
        const outside =
          Math.max(0, plate.left - r.l) + Math.max(0, r.r - plate.right) + Math.max(0, plate.top - r.t) + Math.max(0, r.b - plate.bottom);
        const cost =
          dots.reduce((sum, d) => sum + 100 * area(r, d), 0) + taken.reduce((sum, o) => sum + area(r, o), 0) + 10_000 * outside;
        if (cost === 0 && !dots.some((d) => hit(r, d)) && !taken.some((o) => hit(r, o))) {
          chosen = [dx, dy];
          break;
        }
        if (cost < best) {
          best = cost;
          chosen = [dx, dy];
        }
      }
      tag.setAttribute('transform', `translate(${chosen[0]},${chosen[1]})`);
      taken.push({ l: cx + chosen[0], t: cy + chosen[1] - 11, r: cx + chosen[0] + w, b: cy + chosen[1] + 11 });
    }
  };

  const configureZoom = (l: MapLayer, s: Size) => {
    const [lw, lh] = MAPS[l].viewBox;
    const cover = coverScale(s.W, s.H, lw, lh);
    zoomRef.current
      ?.extent([[0, 0], [s.W, s.H]])
      .translateExtent([[0, 0], [lw, lh]])
      .scaleExtent([cover, maxScale(l, s.W, s.H)]);
  };

  /** `forSize`: the plate size `v` was worked out for (a later resize is caught up when the zoom ends). */
  const zoomTo = (v: View, ms: number, forSize: Size | null = sizeRef.current) =>
    new Promise<void>((resolve) => {
      viewSizeRef.current = forSize;
      // A frame below the cover zoom (an event too tall for a wide plate): let the reader zoom out to it again.
      const z = zoomRef.current!;
      const [lw, lh] = MAPS[layerRef.current].viewBox;
      const s = sizeRef.current;
      if (s) {
        const cover = coverScale(s.W, s.H, lw, lh);
        z.scaleExtent([Math.min(cover, v.k), Math.max(maxScale(layerRef.current, s.W, s.H), v.k)]);
      }
      const svg = select(svgRef.current!);
      const target = zoomIdentity.translate(v.x, v.y).scale(v.k);
      svg.interrupt();
      if (ms <= 0) {
        zoomRef.current!.transform(svg, target);
        resolve();
        return;
      }
      svg
        .transition()
        .duration(ms)
        .call(zoomRef.current!.transform, target)
        .on('end', () => resolve())
        .on('interrupt', () => resolve());
    });

  /**
   * Freeze the current picture on top, switch layers underneath at `view`, and fade the picture out once the new one
   * is in. `settle` is where the new layer ends up (its raster is chosen for that zoom, not the passing one).
   */
  const swapLayer = (next: MapLayer, view: View, settle: View, fadeMs: number) =>
    new Promise<void>((resolve) => {
      const ghost = ghostRef.current;
      const svg = svgRef.current;
      if (ghost && svg) {
        const copy = svg.cloneNode(true) as SVGSVGElement;
        copy.removeAttribute('class');
        // A picture only: nothing in it can be focused, read out, or mistaken for the live map's parts.
        copy.querySelectorAll('*').forEach((el) => {
          for (const a of GHOST_DROP) el.removeAttribute(a);
          for (const [from, to] of GHOST_CLASSES) if (el.classList.contains(from)) el.classList.replace(from, to);
        });
        ghost.replaceChildren(copy);
        ghost.getAnimations().forEach((a) => a.cancel());
        ghost.style.opacity = '1';
        let started = false;
        // A Web Animation, not a CSS transition: the site turns transitions off under reduced motion, and the
        // cross-fade is exactly what replaces the zoom there.
        const start = () => {
          if (started) return;
          started = true;
          fadeRef.current = null;
          const fade = ghost.animate([{ opacity: 1 }, { opacity: 0 }], { duration: fadeMs, easing: 'ease', fill: 'forwards' });
          fade.onfinish = () => {
            if (ghost.firstChild !== copy) return;
            ghost.style.opacity = '0';
            fade.cancel();
            ghost.replaceChildren();
          };
        };
        fadeRef.current = { start };
        // Wait for the new raster (its <image> load), but never long.
        window.setTimeout(start, basemapFor(next) ? RASTER_WAIT_MS : 0);
      }
      pendingRef.current = { layer: next, view, settle, done: resolve };
      if (next === layerRef.current) {
        pendingRef.current = null;
        resolve();
      } else setLayer(next);
    });

  /**
   * Go to `target`, framing `box` there (null: the whole layer). Steps one level at a time through the common
   * ancestor: zooming in, the parent zooms onto the child's frame and the child fades in over it; zooming out, the
   * parent fades in where the child was and zooms out. With reduced motion: a single cross-fade.
   */
  const navigate = async (target: MapLayer, frame: Frame | null, focusAfter: 'crumb' | { region: string } | null = null) => {
    const token = ++navRef.current;
    const s = sizeRef.current;
    // Focus moves at the end only if the reader has not moved it meanwhile: remember where it was.
    const trigger = document.activeElement;
    focusAfterRef.current = focusAfter;
    busyRef.current = false;
    setGlide('warped');
    setPopup(null);
    intentRef.current = { layer: target, frame };
    userMovedRef.current = false;
    if (!s) {
      setLayer(target);
      return;
    }
    const from = layerRef.current;
    if (reducedMotion()) {
      const v = frameFor(target, frame, s);
      await swapLayer(target, v, v, 200);
    } else if (from === target) {
      await zoomTo(frameFor(target, frame, s), STEP_MS);
    } else {
      busyRef.current = true;
      const common = commonLayer([from, target]);
      const up = lineage(from);
      const down = pathTo(target);
      const steps = [...up.slice(1, up.indexOf(common) + 1), ...down.slice(down.indexOf(common) + 1)];
      for (let i = 0; i < steps.length; i++) {
        if (token !== navRef.current) return;
        const next = steps[i];
        const cur = layerRef.current;
        const size = sizeRef.current ?? s;
        const last = i === steps.length - 1;
        if (parentOf(next) === cur) {
          const nextView = frameFor(next, last ? frame : null, size);
          // Markers glide onto where the child's picture puts them while the parent zooms in.
          setGlide('plain');
          await zoomTo(viewOnParent(nextView, next), STEP_MS);
          if (token !== navRef.current) return;
          await swapLayer(next, nextView, nextView, FADE_MS);
          if (token !== navRef.current) return;
          setGlide('warped');
        } else {
          // Zooming out ends on the whole parent, kept centred on the layer we leave (unless an event frames it).
          const [cw, ch] = MAPS[cur].viewBox;
          const centre = project([cw / 2, ch / 2], cur, next, true);
          const viewFor = (sz: Size) => (last && frame ? frameFor(next, frame, sz) : coverViewAt(next, centre, sz.W, sz.H));
          // The parent opens with markers where the child's picture had them, then they glide home while it zooms out.
          setGlide('plain');
          await swapLayer(next, viewOnParent(viewRef.current, cur), viewFor(size), FADE_MS);
          if (token !== navRef.current) return;
          await nextFrames(2);
          if (token !== navRef.current) return;
          setGlide('warped');
          // The new layer may have changed the plate's size (a shorter caption): aim at the view for the size now.
          const now = sizeRef.current ?? size;
          await zoomTo(viewFor(now), STEP_MS, now);
        }
      }
      // Only the navigation still in charge may end the busy spell: an interrupted one resumes here when its zoom
      // is cut short, and clearing the flag then let the newer zoom fetch the full raster on its way through.
      if (token !== navRef.current) return;
      busyRef.current = false;
    }
    if (token !== navRef.current) return;
    // The plate changed size while zooming: keep the same spot in the middle at the new size.
    const now = sizeRef.current;
    // (Right after a navigation the reader has not moved the map: refit what it was going to.)
    if (now && viewSizeRef.current && now !== viewSizeRef.current) {
      zoomTo(frame ? frameFor(target, frame, now) : recentre(viewSizeRef.current, now), 0);
    }
    upgradeRaster();
    placeTags();
    setAnnounce(t(lang, 'mapShowing', { name: layerName(target, lang) }));
    const focus = focusAfterRef.current;
    focusAfterRef.current = null;
    const active = document.activeElement;
    // Only where focus was lost with the old layer (body) or still sits where the reader left it (the "up" button):
    // never pull it back from somewhere the reader moved it during the zoom.
    if (focus && (!active || active === document.body || active === trigger)) {
      const el =
        focus === 'crumb'
          ? plateRef.current?.querySelector<HTMLElement>('.map-path [aria-current]')
          : svgRef.current?.querySelector<SVGElement>(`.region[data-region="${focus.region}"]`);
      el?.focus();
    }
  };

  // Measure the plate before the first paint; afterwards follow its size (the page layout opens and folds it).
  useLayoutEffect(() => {
    const svg = svgRef.current!;
    const measure = () => {
      const b = svg.getBoundingClientRect();
      if (b.width === 0 || b.height === 0) return; // folded away: keep the last view
      const prev = sizeRef.current;
      if (prev && Math.abs(prev.W - b.width) < 0.5 && Math.abs(prev.H - b.height) < 0.5) return;
      setSize({ W: b.width, H: b.height });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const svg = svgRef.current!;
    const z = d3zoom<SVGSVGElement, unknown>().on('zoom', (ev) => {
      const { k, x, y } = ev.transform;
      gRef.current!.setAttribute('transform', ev.transform.toString());
      viewRef.current = { k, x, y };
      svg.style.setProperty('--mk', String(1 / k));
      if (ev.sourceEvent) userMovedRef.current = true;
      upgradeRaster();
    });
    z.on('end', () => {
      setMarkerK(viewRef.current.k);
      if (!busyRef.current) placeTags();
    });
    select(svg).call(z).on('dblclick.zoom', null);
    zoomRef.current = z;
    return () => {
      select(svg).on('.zoom', null);
    };
  }, []);

  // A new layer or a new plate size: set the zoom limits and put the view where it belongs, before paint.
  useLayoutEffect(() => {
    if (!size || !zoomRef.current) return;
    // The page sets the heights the plate sizes itself from in its own layout effect, which runs after this
    // component's measure: read the plate again, so the view and the first image suit the size it really has.
    const now = svgRef.current!.getBoundingClientRect();
    if (now.width > 0 && now.height > 0 && (Math.abs(now.width - size.W) >= 0.5 || Math.abs(now.height - size.H) >= 0.5)) {
      setSize({ W: now.width, H: now.height });
      return;
    }
    const prev = sizeRef.current;
    sizeRef.current = size;
    configureZoom(layer, size);
    const pending = pendingRef.current?.layer === layer ? pendingRef.current : null;
    if (pending) {
      pendingRef.current = null;
      chooseRaster(layer, pending.settle.k);
      zoomTo(pending.view, 0);
      if (!basemapFor(layer)) fadeRef.current?.start();
      pending.done();
      return;
    }
    if (busyRef.current) return; // caught up when the zoom ends
    const v =
      !prev || !userMovedRef.current || intentRef.current.layer !== layer
        ? intentRef.current.layer === layer
          ? frameFor(layer, intentRef.current.frame, size)
          : frameFor(layer, null, size)
        : recentre(viewSizeRef.current ?? prev, size); // the reader has moved the map: keep their spot
    chooseRaster(layer, v.k);
    zoomTo(v, 0);
  }, [layer, size]);

  // A newly selected event: go to the finest layer holding all its places and regions, framed on them.
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    if (!selected) return;
    const v = eventView(selected, locations, lang);
    navigate(v.layer, v.frame);
  }, [selected?.id]);

  // Size each name tag to its text once rendered, and again when the web fonts arrive.
  useLayoutEffect(() => {
    const fit = () => {
      svgRef.current?.querySelectorAll<SVGGElement>('.mk-tag, .region-tag').forEach((tag) => {
        const text = tag.querySelector('text');
        const rect = tag.querySelector('rect');
        if (!text || !rect) return;
        const width = text.getComputedTextLength() + TAG_PAD * 2;
        rect.setAttribute('width', String(width));
        if (tag.classList.contains('region-tag')) rect.setAttribute('x', String(-width / 2));
      });
    };
    fit();
    placeTags();
    let live = true;
    document.fonts?.ready.then(() => {
      if (!live) return;
      fit();
      placeTags();
    });
    return () => {
      live = false;
    };
  }, [layer, lang, selected?.id, markerK]);

  useEffect(() => {
    const id = focusPlaceRef.current;
    if (!id) return;
    focusPlaceRef.current = null;
    svgRef.current?.querySelector<SVGGElement>(`.map-marker[data-place="${id}"]`)?.focus();
  }, [markerK]);

  // The popup is a small non-modal dialog: it takes the focus when it opens (its title), Esc or x closes it, and the
  // focus goes back to the region or marker that opened it (or the current level, if that one is gone).
  const popupTriggerRef = useRef<Element | null>(null);
  const popupTitleRef = useRef<HTMLHeadingElement>(null);
  const openPopup = (p: Popup) => {
    popupTriggerRef.current = document.activeElement;
    setPopup(p);
  };
  const closePopup = () => {
    setPopup(null);
    const back = popupTriggerRef.current;
    popupTriggerRef.current = null;
    const target =
      back instanceof HTMLElement || back instanceof SVGElement
        ? back.isConnected && back !== document.body
          ? back
          : plateRef.current?.querySelector<HTMLElement>('.map-path [aria-current]')
        : null;
    target?.focus();
  };
  useEffect(() => {
    if (popup) popupTitleRef.current?.focus();
  }, [popup]);
  const openRegion = (r: Region) =>
    openPopup({ title: r.name[lang], events: eventsInRegion(events, locations, layer, r.id) });
  const openLocation = (l: Location) => openPopup({ title: l.name[lang], events: eventsAtLocation(events, l.id) });
  /**
   * A group marker: zoom in until its places stand apart, centred on them; when even the deepest zoom cannot part
   * them, list the events of all of them instead.
   */
  const openGroup = (members: { loc: Location; x: number; y: number }[], cx: number, cy: number, el: Element) => {
    const s = sizeRef.current;
    const need = separatingScale(members.map((m) => ({ id: m.loc.id, x: m.x, y: m.y })));
    if (s && need <= maxScale(layer, s.W, s.H)) {
      if (document.activeElement === el) focusPlaceRef.current = members[0].loc.id;
      zoomTo({ k: need, x: s.W / 2 - cx * need, y: s.H / 2 - cy * need }, reducedMotion() ? 0 : STEP_MS);
      return;
    }
    const seen = new Set<string>();
    const all = members.flatMap((m) => eventsAtLocation(events, m.loc.id)).filter((e) => !seen.has(e.id) && !!seen.add(e.id));
    openPopup({ title: joinClusterTitles(members.map((m) => m.loc.name[lang]), lang), events: all });
  };
  const activateRegion = (r: Region) => {
    const child = childLayerOf(layer, r.id);
    if (!child) return openRegion(r);
    navigate(child, null, 'crumb');
  };
  /** Up to an ancestor; focus lands on the region we came out of. */
  const goUpTo = (ancestor: MapLayer) => {
    const path = pathTo(layer);
    navigate(ancestor, null, { region: path[path.indexOf(ancestor) + 1] });
  };
  const onKey = (fn: () => void) => (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      fn();
    }
  };

  const path = pathTo(layer);
  const parent = parentOf(layer);

  return (
    <section class="map-view paper corners" aria-label={t(lang, 'mapLabel')}>
      <div
        ref={plateRef}
        class={`map-plate${plateClass}`}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && popup) {
            e.preventDefault();
            closePopup();
          }
        }}
      >
        <svg
          ref={svgRef}
          class="map-svg"
          // Before the plate is measured (server HTML) the map fills it through the viewBox; afterwards the zoom
          // transform does, in screen pixels.
          viewBox={size ? undefined : `0 0 ${w} ${h}`}
          preserveAspectRatio={size ? undefined : 'xMidYMid slice'}
        >
          <g ref={gRef}>
            {basemap && (
              // Fills the plate around the map with the image's edge colour, toned like the image in dark mode.
              <rect class="map-pad" x={-4 * w} y={-4 * h} width={9 * w} height={9 * h} fill={basemap.paper} aria-hidden="true" />
            )}
            {basemap && size && (
              // A few hundred bytes, so it arrives first: the plate shows the map's colours, softly enlarged, while
              // the image loads, which then covers it (the rasters are opaque).
              <image
                class="map-preview"
                href={withBase(basemap.hrefPreview)}
                x={0}
                y={0}
                width={w}
                height={h}
                preserveAspectRatio="none"
                aria-hidden="true"
              />
            )}
            {basemap &&
              stack.map((sz) => (
                <image
                  key={`${layer}-${sz}`}
                  class="map-basemap"
                  href={withBase(sz === 'full' ? basemap.href : basemap.hrefSmall)}
                  x={0}
                  y={0}
                  width={w}
                  height={h}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                  onLoad={() => fadeRef.current?.start()}
                />
              ))}
            {/* On a raster, regions are clipped to the image: a ring that runs past it (Aetherius) never shows in the
                plate's margin when hovered or selected. */}
            <clipPath id={clipId}>
              <rect x={0} y={0} width={w} height={h} />
            </clipPath>
            <g clip-path={basemap ? `url(#${clipId})` : undefined}>
              {map.regions.map((r) => {
                const child = childLayerOf(layer, r.id);
                const cls = `region${activeRegions.has(r.id) ? ' is-active' : ''}${child ? ' opens-layer' : ''}`;
                const common = {
                  class: cls,
                  'data-region': r.id,
                  role: 'button' as const,
                  tabindex: 0,
                  'aria-label': child ? t(lang, 'mapZoomInto', { name: r.name[lang] }) : r.name[lang],
                  onClick: () => activateRegion(r),
                  onKeyDown: onKey(() => activateRegion(r)),
                  onFocus: (e: FocusEvent) => setFocusRing((e.currentTarget as Element).matches(':focus-visible') ? r.id : null),
                  onBlur: () => setFocusRing(null),
                };
                const g = r.geometry;
                if (g.kind === 'circle') return <circle key={r.id} {...common} cx={g.cx} cy={g.cy} r={g.r} />;
                if (g.kind === 'polygons') return <path key={r.id} {...common} d={pathData(g.parts)} />;
                return <polygon key={r.id} {...common} points={g.points.map((p) => p.join(',')).join(' ')} />;
              })}
            </g>
            {/* Regions the event covers that are drawn on a finer layer (Skyrim on Nirn): outlined, not clickable.
                (Nirn v3c's coast follows the province outlines, so these keep their full wash and outline there; the
                soft, clipped variant stays for a layer flagged softCarried.) */}
            {eventRegions
              .filter((r) => r.d !== null)
              .map((r) => {
                const holder = map.softCarried && r.within ? map.regions.find((m) => m.id === r.within) : undefined;
                const hg = holder?.geometry;
                const clip = `${clipId}-${r.id}`;
                return (
                  <g key={`${r.id}-event`} aria-hidden="true">
                    {hg && hg.kind !== 'circle' && (
                      <clipPath id={clip}>
                        <path d={pathData(hg.kind === 'polygons' ? hg.parts : [hg.points])} />
                      </clipPath>
                    )}
                    <path
                      class={`event-region${holder ? ' is-soft' : ''}`}
                      d={r.d!}
                      clip-path={hg && hg.kind !== 'circle' ? `url(#${clip})` : undefined}
                    />
                  </g>
                );
              })}
            {/* Keyboard focus on a region: an ink ring inside a paper halo, legible on any map (WCAG 2.4.11). */}
            {map.regions
              .filter((r) => r.id === focusRing)
              .map((r) => {
                const g = r.geometry;
                const ring = (cls: string) =>
                  g.kind === 'circle' ? (
                    <circle class={cls} cx={g.cx} cy={g.cy} r={g.r} />
                  ) : (
                    <path class={cls} d={pathData(g.kind === 'polygons' ? g.parts : [g.points])} />
                  );
                return (
                  <g key={`${r.id}-focus`} class="region-focus" aria-hidden="true">
                    {ring('focus-halo')}
                    {ring('focus-ink')}
                  </g>
                );
              })}
            {labelMode === 'text' &&
              map.regions.map((r) => (
                <text key={`${r.id}-label`} class="region-label" x={r.label[0]} y={r.label[1]}>
                  {r.name[lang]}
                </text>
              ))}
            {labelMode === 'tag' &&
              map.regions
                // A selected place named like its region (Atmora, Mundus) already shows that name on its own tag.
                .filter((r) => !selectedLocations.some((l) => l.layer === layer && l.region === r.id && l.name[lang] === r.name[lang]))
                .map((r) => (
                  <g
                    key={`${r.id}-label`}
                    class="region-tag-anchor"
                    data-x={r.label[0]}
                    data-y={r.label[1]}
                    transform={`translate(${r.label[0]},${r.label[1]})`}
                    aria-hidden="true"
                  >
                    <g class="mk region-tag">
                      <rect x={0} y={-10} height={20} width={0} />
                      <text x={0} y={5}>
                        {r.name[lang]}
                      </text>
                    </g>
                  </g>
                ))}
            {(() => {
              const drawn = places.map(({ loc, at, plain }) => {
                const [x, y] = glide === 'plain' ? plain : at;
                return { loc, x, y };
              });
              // Markers closer on screen than a tap target merge into one group marker (none before the first zoom).
              // The selected event's places always stand alone, drawn last (on top), as before.
              const single = (d: (typeof drawn)[number]) => ({ ids: [d.loc.id], x: d.x, y: d.y });
              const others = drawn.filter((d) => !selectedIds.has(d.loc.id));
              const groups = [
                ...(markerK === null
                  ? others.map(single)
                  : groupMarkers(others.map((d) => ({ id: d.loc.id, x: d.x, y: d.y })), markerK)),
                ...drawn.filter((d) => selectedIds.has(d.loc.id)).map(single),
              ];
              const byId = new Map(drawn.map((d) => [d.loc.id, d]));
              const fadedAt = (id: string) => {
                const here = dimmed.size ? eventsAtLocation(events, id) : [];
                return here.length > 0 && here.every((e) => dimmed.has(e.id));
              };
              return groups.map((g) => {
                const members = g.ids.map((id) => byId.get(id)!);
                if (members.length === 1) {
                  const { loc: l, x, y } = members[0];
                  const active = selectedIds.has(l.id);
                  return (
                    <g
                      key={`${layer}-${l.id}`}
                      class={`map-marker${active ? ' is-active' : ''}${fadedAt(l.id) ? ' is-dimmed' : ''}`}
                      data-place={l.id}
                      style={{ transform: `translate(${x}px, ${y}px)` }}
                      role="button"
                      tabindex={0}
                      aria-label={l.name[lang]}
                      onClick={(e) => {
                        e.stopPropagation();
                        openLocation(l);
                      }}
                      onKeyDown={onKey(() => openLocation(l))}
                    >
                      <g class="mk">
                        <circle class="mk-hit" r={14} />
                        <circle class="mk-focus" r={14} />
                        {/* Lapis 12px (selected 16px) inside a 2px paper ring (the dot's stroke) and a 1px ink ring. */}
                        <circle class="mk-ring" r={active ? 11 : 9} />
                        <circle class="mk-dot" r={active ? 9 : 7} />
                        {!active && (
                          <g class="mk-tag" transform="translate(14,0)" aria-hidden="true">
                            <rect x={0} y={-11} height={22} width={0} />
                            <text x={TAG_PAD} y={5}>
                              {l.name[lang]}
                            </text>
                          </g>
                        )}
                      </g>
                    </g>
                  );
                }
                // A group: a larger dot with the count.
                const names = joinClusterTitles(members.map((m) => m.loc.name[lang]), lang);
                return (
                  <g
                    key={`${layer}-group-${g.ids.join('+')}`}
                    class={`map-marker map-marker-group${members.every((m) => fadedAt(m.loc.id)) ? ' is-dimmed' : ''}`}
                    data-count={members.length}
                    style={{ transform: `translate(${g.x}px, ${g.y}px)` }}
                    role="button"
                    tabindex={0}
                    aria-label={t(lang, 'mapMarkerGroup', { count: String(members.length), names })}
                    onClick={(e) => {
                      e.stopPropagation();
                      openGroup(members, g.x, g.y, e.currentTarget as Element);
                    }}
                    onKeyDown={(e) => onKey(() => openGroup(members, g.x, g.y, e.currentTarget as Element))(e)}
                  >
                    <g class="mk">
                      <circle class="mk-hit" r={14} />
                      <circle class="mk-focus" r={14} />
                      <circle class="mk-ring" r={11} />
                      <circle class="mk-dot" r={9} />
                      <text class="mk-count" y={4} aria-hidden="true">
                        {members.length}
                      </text>
                      <g class="mk-tag" transform="translate(16,0)" aria-hidden="true">
                        <rect x={0} y={-11} height={22} width={0} />
                        <text x={TAG_PAD} y={5}>
                          {names}
                        </text>
                      </g>
                    </g>
                  </g>
                );
              });
            })()}
            {/* The selected places' name tags, above every marker (placed clear of each other by placeTags). */}
            <g class="mk-tags" aria-hidden="true">
              {places
                .filter(({ loc }) => selectedIds.has(loc.id))
                .map(({ loc: l, at, plain }) => {
                  const [x, y] = glide === 'plain' ? plain : at;
                  return (
                  <g key={`${layer}-${l.id}`} class="mk-tag-anchor" data-place={l.id} data-x={x} data-y={y} style={{ transform: `translate(${x}px, ${y}px)` }}>
                    <g class="mk">
                      <g class="mk-tag" transform="translate(16,0)">
                        <rect x={0} y={-11} height={22} width={0} />
                        <text x={TAG_PAD} y={5}>
                          {l.name[lang]}
                        </text>
                      </g>
                    </g>
                  </g>
                  );
                })}
            </g>
          </g>
        </svg>
        {/* The previous layer's picture, fading out over the new one while layers change. */}
        <div ref={ghostRef} class="map-ghost" aria-hidden="true" />
        <nav ref={navBarRef} class="map-nav" aria-label={t(lang, 'mapPath')}>
          {parent && (
            <button
              type="button"
              class="map-up"
              // The phone shows only "Up": the name also says which level (and keeps the visible words).
              aria-label={`${t(lang, 'mapUp')}${lang === 'en' ? ': ' : '：'}${layerName(parent, lang)}`}
              onClick={() => goUpTo(parent)}
            >
              <span aria-hidden="true">↑ </span>
              <span class="map-up-long">{t(lang, 'mapUp')}</span>
              <span class="map-up-short">{t(lang, 'mapUpShort')}</span>
            </button>
          )}
          <ol class="map-path">
            {path.map((l) =>
              l === layer ? (
                <li key={l}>
                  <span aria-current="location" tabindex={-1}>
                    {layerName(l, lang)}
                  </span>
                </li>
              ) : (
                <li key={l}>
                  <button type="button" onClick={() => goUpTo(l)}>
                    {layerName(l, lang)}
                  </button>
                </li>
              ),
            )}
          </ol>
        </nav>
        <p class="sr-only" aria-live="polite">
          {announce}
        </p>
        {popup && (
          <div class="map-popup paper corners" role="dialog" aria-label={popup.title}>
            <button type="button" class="close" aria-label={t(lang, 'close')} onClick={closePopup}>
              ×
            </button>
            <h3 ref={popupTitleRef} tabindex={-1}>
              {popup.title}
            </h3>
            {popup.events.length === 0 ? (
              <p>{t(lang, 'noEventsHere')}</p>
            ) : (
              <ul aria-label={t(lang, 'eventsHere')}>
                {/* Events a filter leaves out come last, faint. */}
                {[...popup.events.filter((e) => !dimmed.has(e.id)), ...popup.events.filter((e) => dimmed.has(e.id))].map((e) => (
                  <li key={e.id} class={dimmed.has(e.id) ? 'is-dimmed' : undefined}>
                    <button
                      type="button"
                      onClick={() => {
                        setPopup(null);
                        onSelect(e.id);
                      }}
                    >
                      {e.title}
                      {/* The year in the timeline's short form, on the same line (decisions/p4-design). */}
                      <span class="map-popup-year">{listYearLabel(e, t(lang, 'circaPrefix'))}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
      {/* Wide screens show the whole credit. Narrow screens show a one-line short form; the whole credit stays in the
          text (visually hidden there) for screen readers and as the short form's title, and the footer keeps the
          full copyright notice. */}
      <p class="map-cap" ref={capRef}>
        <b>{layerName(layer, lang)}</b>
        {(() => {
          const long = basemap ? t(lang, basemap.credit) : t(lang, 'mapSchematic');
          const short = t(lang, basemap ? (`${basemap.credit}Short` as UiKey) : 'mapCreditDrawnShort');
          return (
            <span class="cap-credit">
              <span class="cap-long">{long}</span>
              <span class="cap-short" aria-hidden="true" title={long}>
                {short}
              </span>
              {basemap?.sourceUrl && (
                <>
                  {' '}
                  <a href={basemap.sourceUrl} target="_blank" rel="noopener noreferrer">
                    UESP<span class="sr-only">{t(lang, 'newTab')}</span>
                  </a>
                </>
              )}
            </span>
          );
        })()}
      </p>
    </section>
  );
}
