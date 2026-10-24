import { rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import { loadEnv } from 'vite';
import { DEFAULT_MAP_SOURCE } from './src/lib/map-source-default.mjs';
import { fontLicenses, fontsourcePostcss } from './scripts/font-subset.mjs';

// Same rule as src/lib/map-source.ts: PUBLIC_MAP_SOURCE (process env or .env files) wins over the default.
const env = loadEnv(process.env.NODE_ENV === 'development' ? 'development' : 'production', process.cwd(), 'PUBLIC_');
const requested = process.env.PUBLIC_MAP_SOURCE ?? env.PUBLIC_MAP_SOURCE;
const mapSource = requested === 'drawn' || requested === 'official' ? requested : DEFAULT_MAP_SOURCE;

/**
 * A build publishes one map set only: a drawn-map build drops the official map files (that is what the drawn source
 * is for), an official build drops the drawn map's painted layers, kept as the takedown fallback (decisions/p3-map-drop).
 */
const dropOfficialMaps = {
  name: 'drop-official-maps',
  hooks: {
    'astro:build:done': async ({ dir, logger }) => {
      if (mapSource === 'drawn') {
        await rm(new URL('maps/official/', dir), { recursive: true, force: true });
        logger.info('map source is drawn: removed maps/official/ from the output');
      } else {
        await rm(new URL('maps/drawn/schematic/', dir), { recursive: true, force: true });
      }
    },
  },
};

/**
 * Where the site is published (docs/deploy.md): GitHub Pages serves a project site under /<repo>/, so the deploy
 * workflow sets CHRONICLE_SITE and CHRONICLE_BASE. Unset (local builds, tests, the artifact export), the site lives
 * at the root as before.
 */
const site = process.env.CHRONICLE_SITE || undefined;
const base = process.env.CHRONICLE_BASE || undefined;

export default defineConfig({
  ...(site ? { site } : {}),
  ...(base ? { base } : {}),
  integrations: [preact(), dropOfficialMaps, fontLicenses()],
  // Self-hosted fonts: woff2 only; on production builds the Chinese faces are cut down to the site's own characters
  // (scripts/font-subset.mjs).
  vite: {
    css: {
      postcss: {
        plugins: [
          fontsourcePostcss({
            srcDir: fileURLToPath(new URL('./src', import.meta.url)),
            cacheDir: fileURLToPath(new URL('./node_modules/.cache/chronicle-fonts', import.meta.url)),
            subset: process.env.NODE_ENV !== 'development',
          }),
        ],
      },
    },
  },
  trailingSlash: 'always',
});
