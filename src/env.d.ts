/// <reference types="astro/client" />

interface ImportMetaEnv {
  /** Build-time map source override: 'drawn' switches every layer to the site's own maps (src/lib/map-source.ts). */
  readonly PUBLIC_MAP_SOURCE?: string;
  /** Plate widths a build ships, e.g. '960' for the claude.ai artifact export (src/lib/illustrations.ts). */
  readonly PUBLIC_PLATE_WIDTHS?: string;
  /** '1': one /stories/<id>.json per event with both languages, for the artifact export (src/lib/story-cache.ts). */
  readonly PUBLIC_STORIES_BILINGUAL?: string;
  /** Cloudflare Web Analytics site token, set only by the deploy workflow (src/lib/analytics.ts). */
  readonly PUBLIC_CF_BEACON_TOKEN?: string;
  /** Google Search Console HTML-tag verification code, set only by the deploy workflow (src/lib/analytics.ts). */
  readonly PUBLIC_GSC_VERIFICATION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
