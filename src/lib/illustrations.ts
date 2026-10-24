import type { Lang } from './types';

/** One entry of src/content/illustrations.json (written by scripts/import-illustrations.py). */
export interface IllustrationEntry {
  /** Event id; the files are public/illustrations/<id>.webp (full) plus <id>-960.webp and <id>-640.webp. */
  id: string;
  /** Pixel size of the full image (the small one has the same aspect ratio). */
  width: number;
  height: number;
  /** What the picture shows, in both languages (no production notes: those live in assets-log.md). */
  caption: Record<Lang, string>;
}

/** What the story panel needs to draw a plate, in the page language. */
export interface Illustration {
  /** Smallest file, the `src` fallback. */
  src: string;
  /** Every file with its width, smallest first, for `srcset`. */
  srcset: { href: string; width: number }[];
  width: number;
  height: number;
  caption: string;
}

/** Widths of the reduced copies (the full image is `entry.width`). 960 serves phones (~950 device px wide plates). */
export const ILLUSTRATION_WIDTHS = [640, 960] as const;

/**
 * Widths a build ships, from PUBLIC_PLATE_WIDTHS ("960" or "640,960"): the claude.ai artifact export keeps one width
 * to stay under the host's file limit. Unset: every width, the full image included.
 */
export function plateWidths(env: string | undefined = import.meta.env.PUBLIC_PLATE_WIDTHS): number[] | null {
  const widths = (env ?? '').split(',').map((w) => Number(w.trim())).filter((w) => w > 0);
  return widths.length ? widths : null;
}

export function illustrationFor(
  entry: IllustrationEntry,
  lang: Lang,
  widths: readonly number[] | null = plateWidths(),
): Illustration {
  const base = `/illustrations/${entry.id}`;
  const all = [
    ...ILLUSTRATION_WIDTHS.map((width) => ({ href: `${base}-${width}.webp`, width })),
    { href: `${base}.webp`, width: entry.width },
  ];
  const srcset = widths ? all.filter((s) => widths.includes(s.width)) : all;
  return {
    src: srcset[0].href,
    srcset,
    width: entry.width,
    height: entry.height,
    caption: entry.caption[lang],
  };
}

/**
 * Splits rendered story HTML where the plate goes: after the middle paragraph (the turn of the story), counting
 * top-level paragraphs only. One paragraph: the plate follows it. No paragraph: everything stays before.
 */
export function splitStory(html: string): { before: string; after: string } {
  const ends: number[] = [];
  let depth = 0;
  const tag = /<(\/?)(p|blockquote|ul|ol|li|div|table)\b[^>]*>/gi;
  for (let m = tag.exec(html); m; m = tag.exec(html)) {
    const closing = m[1] === '/';
    const name = m[2].toLowerCase();
    if (!closing) depth++;
    else {
      depth--;
      if (depth === 0 && name === 'p') ends.push(m.index + m[0].length);
    }
  }
  if (ends.length === 0) return { before: html, after: '' };
  const cut = ends[Math.ceil(ends.length / 2) - 1];
  return { before: html.slice(0, cut), after: html.slice(cut) };
}
