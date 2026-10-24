/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Build-time map source override: 'drawn' switches every layer to the site's own maps (src/lib/map-source.ts). */
  readonly PUBLIC_MAP_SOURCE?: string;
  /** Plate widths a build ships, e.g. '960' for the claude.ai artifact export (src/lib/illustrations.ts). */
  readonly PUBLIC_PLATE_WIDTHS?: string;
  /** '1': one /stories/<id>.json per event with both languages, for the artifact export (src/lib/story-cache.ts). */
  readonly PUBLIC_STORIES_BILINGUAL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
