// The site's map source when the build sets nothing ('official' | 'drawn'). Plain JS so astro.config.mjs can read
// it too: a 'drawn' build drops public/maps/official/ from the output (see the integration there).
export const DEFAULT_MAP_SOURCE = 'official';
