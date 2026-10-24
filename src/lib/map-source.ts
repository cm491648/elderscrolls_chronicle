import { PROVINCES, type MapLayer, type Province } from './types';
import { DEFAULT_MAP_SOURCE } from './map-source-default.mjs';
import { MAPS, PROVINCE_GAME_MAPS } from '../components/MapView/shapes';
import paintedLayers from '../content/drawn-basemaps.json';

/**
 * Which base maps the site draws under the SVG regions and markers.
 * - `official`: the Anthology map of Tamriel (© Bethesda Softworks, obtained via UESP; see docs/design/assets-log.md).
 * - `drawn`: our own maps only: Codex's paintings over the schematic shapes for Nirn, Tamriel and the provinces
 *   (src/content/drawn-basemaps.json), and the drawn cosmos.
 * Nirn and the cosmos have no official map, so the official source uses the drawn rasters there too. The province
 * layers use the Anthology province crops or the games' own maps (official) or the paintings (drawn).
 * If the official map ever has to come down, set DEFAULT_MAP_SOURCE in map-source-default.mjs to 'drawn' (or build
 * with PUBLIC_MAP_SOURCE=drawn, as the e2e suite does for its second copy): the caption and footer drop the UESP
 * credit, and the build leaves public/maps/official/ out of the output (astro.config.mjs).
 */
export type MapSource = 'official' | 'drawn';
const envSource = import.meta.env.PUBLIC_MAP_SOURCE;
export const MAP_SOURCE: MapSource =
  envSource === 'drawn' || envSource === 'official' ? envSource : DEFAULT_MAP_SOURCE;

/** The source on screen now: MAP_SOURCE (src/lib/map-set.ts switches a drawn-only build at startup). */
let activeSource: MapSource = MAP_SOURCE;
export const currentMapSource = (): MapSource => activeSource;
export function useMapSource(source: MapSource): void {
  activeSource = source;
}

export interface Basemap {
  /** Full-resolution image (served from /public). */
  href: string;
  /** Smaller image for small or low-density screens. */
  hrefSmall: string;
  /** A PREVIEW_WIDTH px copy (a few hundred bytes), drawn blurred under the plate while the image loads. */
  hrefPreview: string;
  /** Pixel width of `hrefSmall`: past it (times FULL_RATIO) the full image is used. */
  smallWidth: number;
  /** Source pixels of `href`; the layer's viewBox has the same aspect ratio. */
  width: number;
  height: number;
  /** Where the image came from, linked from the map caption (drawn maps have none). */
  sourceUrl?: string;
  /** Caption credit, in the i18n dictionaries. */
  credit: 'mapCreditAnthology' | 'mapCreditSkyrim' | 'mapCreditOblivion' | 'mapCreditDrawn' | 'mapCreditSchematic';
  /** The colour at the image's edges, filling the plate around it when the plate's shape differs from the map's. */
  paper: string;
}

/** Width of the map previews (scripts/map-previews.py writes them next to each map as <name>-preview.webp). */
export const PREVIEW_WIDTH = 48;
const previewOf = (href: string) => href.replace(/\.webp$/, '-preview.webp');

const ANTHOLOGY: Basemap = {
  href: '/maps/official/tamriel-anthology.webp',
  hrefSmall: '/maps/official/tamriel-anthology-1440.webp',
  hrefPreview: previewOf('/maps/official/tamriel-anthology.webp'),
  smallWidth: 1440,
  width: 2880,
  height: 2057,
  sourceUrl: 'https://en.uesp.net/wiki/File:LO-map-Tamriel_(Anthology).jpg',
  credit: 'mapCreditAnthology',
  paper: '#9c7349', // mean colour of the image's outer 40px
};

/** UESP file names of the Anthology province crops, and the colour at each crop's edges. */
const PROVINCE_SOURCES: Record<Province, [string, string]> = {
  'high-rock': ['High_Rock', '#ab9678'],
  skyrim: ['Skyrim', '#a69174'],
  morrowind: ['Morrowind', '#a89171'],
  hammerfell: ['Hammerfell', '#aa9577'],
  cyrodiil: ['Cyrodiil', '#ad9b80'],
  'black-marsh': ['Black_Marsh', '#ae9879'],
  elsweyr: ['Elsweyr', '#ac987b'],
  valenwood: ['Valenwood', '#af9c7e'],
  summerset: ['Summerset_Isle', '#cbb28b'],
};

/**
 * The province layers (R12): UESP's crops of the same Anthology map, greying out the neighbours, at the map's own
 * resolution (the largest is 1190 px wide). One size each, so `hrefSmall` is the same file.
 */
function provinceBasemap(id: Province): Basemap {
  const [width, height] = MAPS[id].viewBox;
  const href = `/maps/official/provinces/${id}.webp`;
  const game = GAME_MAP_SOURCES[id];
  if (game && PROVINCE_GAME_MAPS[id]) {
    return {
      href,
      hrefSmall: `/maps/official/provinces/${id}-${width / 2}.webp`,
      hrefPreview: previewOf(href),
      smallWidth: width / 2,
      width,
      height,
      sourceUrl: `https://en.uesp.net/wiki/File:${game.file}`,
      credit: game.credit,
      paper: game.paper,
    };
  }
  const [file, paper] = PROVINCE_SOURCES[id];
  return {
    href,
    hrefSmall: href,
    hrefPreview: previewOf(href),
    smallWidth: width,
    width,
    height,
    sourceUrl: `https://en.uesp.net/wiki/File:LO-map-${file}_(Anthology).jpg`,
    credit: 'mapCreditAnthology',
    paper,
  };
}

/**
 * Round 3: Skyrim and Cyrodiil use the games' own maps (UESP SR-map-Skyrim.jpg, the paper map in Skyrim; and
 * OB-map-Cyrodiil.jpg, Oblivion's map), 2048 px wide, plus a 1024 px copy.
 */
const GAME_MAP_SOURCES: Partial<Record<Province, { file: string; credit: Basemap['credit']; paper: string }>> = {
  skyrim: { file: 'SR-map-Skyrim.jpg', credit: 'mapCreditSkyrim', paper: '#9c7f52' },
  cyrodiil: { file: 'OB-map-Cyrodiil.jpg', credit: 'mapCreditOblivion', paper: '#aa8e6d' },
};

/**
 * Drawn rasters for the layers that have no official map (R9: nirn-v2 extended to 5:3, cosmos-v3 cropped square;
 * made by Codex, see docs/design/assets-log.md). Each is <name>.webp plus a half-size copy in public/maps/drawn/;
 * the layer's viewBox in shapes.ts has the image's aspect ratio (the unit test checks it), and its regions and
 * locations are placed on the image.
 */
const DRAWN_RASTERS: Partial<Record<MapLayer, Basemap>> = {
  nirn: {
    href: '/maps/drawn/nirn-drawn.webp',
    hrefSmall: '/maps/drawn/nirn-drawn-850.webp',
    hrefPreview: previewOf('/maps/drawn/nirn-drawn.webp'),
    smallWidth: 850,
    width: 1700,
    height: 1020,
    credit: 'mapCreditDrawn',
    paper: '#c5ccc7', // the sea at the image's edges
  },
  cosmos: {
    href: '/maps/drawn/cosmos-drawn.webp',
    hrefSmall: '/maps/drawn/cosmos-drawn-512.webp',
    hrefPreview: previewOf('/maps/drawn/cosmos-drawn.webp'),
    smallWidth: 512,
    width: 1024,
    height: 1024,
    credit: 'mapCreditDrawn',
    paper: '#262a34', // the night sky in the image's corners
  },
};

/**
 * The drawn map's painted layers (scripts/import-schematic-paintings.py writes them and src/content/drawn-basemaps.json):
 * <layer>.webp at 1.5 px per layer unit, <layer>-<w>.webp at 1 px, each with its 48 px preview.
 */
function paintedBasemaps(): Partial<Record<MapLayer, Basemap>> {
  const out: Partial<Record<MapLayer, Basemap>> = {};
  for (const [layer, m] of Object.entries(paintedLayers) as [MapLayer, { width: number; height: number; smallWidth: number; paper: string }][]) {
    const href = `/maps/drawn/schematic/${layer}.webp`;
    out[layer] = {
      href,
      hrefSmall: `/maps/drawn/schematic/${layer}-${m.smallWidth}.webp`,
      hrefPreview: previewOf(href),
      smallWidth: m.smallWidth,
      width: m.width,
      height: m.height,
      credit: 'mapCreditSchematic',
      paper: m.paper,
    };
  }
  return out;
}

export const BASEMAPS: Record<MapSource, Partial<Record<MapLayer, Basemap>>> = {
  official: {
    ...DRAWN_RASTERS,
    tamriel: ANTHOLOGY,
    ...(Object.fromEntries(PROVINCES.map((id) => [id, provinceBasemap(id)])) as Record<Province, Basemap>),
  },
  // The drawn map (P3-B): Codex's paintings over the schematic shapes for Nirn, Tamriel and the provinces; the cosmos
  // is the drawn cosmos as on the official map.
  drawn: { cosmos: DRAWN_RASTERS.cosmos, ...paintedBasemaps() },
};

/** The raster under a layer, or null when the layer is drawn in SVG. */
export function basemapFor(layer: MapLayer, source: MapSource = activeSource): Basemap | null {
  return BASEMAPS[source][layer] ?? null;
}

/** A layer without a raster (none today: every layer of both maps has one) is drawn as the plain schematic. */
export function svgArtFor(layer: MapLayer, source: MapSource = activeSource): 'schematic' | null {
  return basemapFor(layer, source) ? null : 'schematic';
}

/**
 * How far the small image may be stretched before the full one is used: 1600 / 1440, i.e. the Anthology map switches
 * at 1600 device pixels, the drawn Nirn map at ~944 and the cosmos at ~569.
 */
export const FULL_RATIO = 1600 / 1440;

/**
 * Which image of `map` a map shown `devicePx` wide needs (the whole map's width on screen, in device pixels, at the
 * zoom it is about to be shown at). Decided once before the first image is requested, so a page downloads one image;
 * it only adds the full one later if the reader zooms in past the threshold.
 */
/**
 * Past twice its CSS width an image looks no sharper on a phone, yet phones report 2.6 or 3 device pixels per CSS
 * pixel and so picked the full map (780-920 KB). Capping the density makes them take the mid-size one.
 */
export const MAX_DENSITY = 2;

/** Device pixels of something `cssPx` wide on a screen of density `dpr`, the density capped at MAX_DENSITY. */
export function deviceWidth(cssPx: number, dpr: number): number {
  return cssPx * Math.min(dpr, MAX_DENSITY);
}

export function rasterFor(devicePx: number, map: Pick<Basemap, 'smallWidth'>): 'small' | 'full' {
  return devicePx > map.smallWidth * FULL_RATIO ? 'full' : 'small';
}
