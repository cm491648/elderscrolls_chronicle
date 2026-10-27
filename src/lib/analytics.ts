/**
 * Visit counting and search verification (decisions/analytics): Cloudflare Web Analytics (no cookies) and Google Search
 * Console. Only the deploy workflow sets these, so local builds, previews, the e2e suite and the artifact export never
 * count a visit. Both values are public by design: they appear in every published page.
 */

/** The Web Analytics site token; empty means no beacon and no footer note. */
export const BEACON_TOKEN = import.meta.env.PUBLIC_CF_BEACON_TOKEN?.trim() ?? '';

/** The `content` of Search Console's HTML-tag verification; empty means no tag. */
export const SEARCH_CONSOLE_CODE = import.meta.env.PUBLIC_GSC_VERIFICATION?.trim() ?? '';

/** The beacon's `data-cf-beacon` attribute. It follows the History API on its own, so each story counts as a page. */
export const beaconConfig = (token: string): string => JSON.stringify({ token });
