import { MAPS } from '../components/MapView/shapes';
import { MAX_ZOOM, eventView, frameExtent } from './map-layers';
import { FULL_RATIO, MAX_DENSITY, basemapFor } from './map-source';
import type { EventMeta, Location, MapLayer } from './types';
import { withBase } from './paths';

/**
 * What a page's early script needs to request the map's first image before the page's script has loaded
 * (performance: the map image is requested in plain HTML, not after hydration). The map itself (MapView) picks the
 * image from the size its plate is about to be shown at; this script makes the same choice from the plate's size as
 * the page is parsed, and only when that choice cannot change with the size the page settles at (the header and
 * timeline heights are still guesses then): otherwise it requests nothing, so a page never downloads two images.
 */
export interface MapPreload {
  /** The layer's viewBox. */
  w: number;
  h: number;
  /** The event's framed area (MapView zooms to it, or farther out); null: the whole layer at the cover zoom. */
  bw: number | null;
  bh: number | null;
  /** maxScale(): the layer's deepest zoom, as a multiple of cover, and its own cap. */
  zoomMax: number;
  own: number | null;
  /** Device pixels above which the full image is used (rasterFor), and the density cap (deviceWidth). */
  limit: number;
  density: number;
  small: string;
  full: string;
}

/** The plan for the home page (`event` null) or an event page; null when the first layer has no image. */
export function mapPreload(event: Pick<EventMeta, 'mapLayer' | 'locations' | 'regions'> | null, locations: Location[], lang: string): MapPreload | null {
  const view = event ? eventView(event, locations, lang) : null;
  const layer: MapLayer = view?.layer ?? 'tamriel';
  const bm = basemapFor(layer);
  if (!bm) return null;
  const [w, h] = MAPS[layer].viewBox;
  const extent = view?.frame && view.frame.points.length + view.frame.boxes.length > 0 ? frameExtent(layer, view.frame) : null;
  return {
    w,
    h,
    bw: extent?.bw ?? null,
    bh: extent?.bh ?? null,
    zoomMax: MAX_ZOOM,
    own: MAPS[layer].maxZoom ?? null,
    limit: bm.smallWidth * FULL_RATIO,
    density: MAX_DENSITY,
    small: withBase(bm.hrefSmall),
    full: withBase(bm.href),
  };
}

/**
 * The image to request for a plate of W×H CSS pixels, or null when it may still change. Without a frame the map shows
 * the cover zoom; with one it starts at most at k0 (frameView may zoom out further to fit the names), so only "small"
 * is certain there. The plate's height is still a guess while the page is parsed: the choice must hold from 15% under
 * to 15% over it (and 5% either way for the width).
 */
export function preloadChoice(p: MapPreload, W: number, H: number, dpr: number): string | null {
  const choices = new Set<string | null>();
  for (const fw of [0.95, 1.05])
    for (const fh of [0.85, 1.15]) {
      const pw = W * fw;
      const ph = H * fh;
      const cover = Math.max(pw / p.w, ph / p.h);
      const maxK = p.own === null ? cover * p.zoomMax : Math.max(cover, Math.min(cover * p.zoomMax, p.own));
      const k0 = p.bw === null || p.bh === null ? cover : Math.min(Math.max(Math.min(pw / p.bw, ph / p.bh), cover), maxK);
      const device = (k: number) => k * p.w * Math.min(dpr, p.density);
      if (device(k0) <= p.limit) choices.add(p.small);
      else if (p.bw === null) choices.add(p.full);
      else choices.add(null);
    }
  return choices.size === 1 ? [...choices][0] : null;
}

/**
 * The inline script (runs right after the app's server HTML, so the plate has its size): measures the plate and adds
 * a high-priority preload for the chosen image. `preloadChoice` is inlined from its source, so the two cannot differ.
 */
export function mapPreloadScript(p: MapPreload): string {
  return `(function(){var p=${JSON.stringify(p)};var s=document.querySelector('.map-plate svg');if(!s)return;var r=s.getBoundingClientRect();if(!r.width||!r.height)return;var c=(${preloadChoice.toString()})(p,r.width,r.height,devicePixelRatio||1);if(!c)return;var l=document.createElement('link');l.rel='preload';l.as='image';l.href=c;l.setAttribute('fetchpriority','high');document.head.appendChild(l);})();`;
}
