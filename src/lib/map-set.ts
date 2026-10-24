import { OFFICIAL_MAPS, useMapShapes } from '../components/MapView/shapes';
import { DRAWN_MAPS } from '../components/MapView/shapes-drawn';
import { useDrawnPlaces } from './map-layers';
import { MAP_SOURCE, useMapSource, type MapSource } from './map-source';

/**
 * Switches the whole map between its two sources (P3-B): the layer shapes (MAPS), where places sit on them, and which
 * basemaps and art draw them. Every module reads the switched values on its next call; a mounted map must be
 * remounted to pick them up.
 */
export function setMapSet(source: MapSource): void {
  useMapShapes(source === 'drawn' ? DRAWN_MAPS : OFFICIAL_MAPS);
  useDrawnPlaces(source === 'drawn');
  useMapSource(source);
}

// A drawn-only build (PUBLIC_MAP_SOURCE=drawn, for when the official map must come down) starts on the drawn map.
if (MAP_SOURCE === 'drawn') setMapSet('drawn');
