import type { Lang, TermInfo } from './types';

/** `{{id}}` or `{{id|display text}}` — a proper noun that links to the glossary. */
export const TERM_PATTERN = /\{\{([a-z0-9-]+)(?:\|([^}]+))?\}\}/g;

const NOTES_HEADING = /^##[ \t]+(?:註|Notes)[ \t]*$/m;

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Term ids in order of appearance (repeats kept). */
export function termIds(md: string): string[] {
  return [...md.matchAll(TERM_PATTERN)].map((m) => m[1]);
}

/** Splits a body at a stand-alone `## 註` / `## Notes` line; the heading line belongs to neither side. */
export function splitNotes(md: string): { story: string; notes: string | null } {
  const match = NOTES_HEADING.exec(md);
  if (!match) return { story: md.trim(), notes: null };
  return {
    story: md.slice(0, match.index).trim(),
    notes: md.slice(match.index + match[0].length).trim(),
  };
}

function lookup(id: string, terms: Map<string, TermInfo>): TermInfo {
  const term = terms.get(id);
  if (!term) throw new Error(`Unknown term "${id}"`);
  return term;
}

/** Where a story's term links (a person's biography, else its glossary entry); null for a plain bold name. */
export type TermHref = (id: string) => string | null;

/** The id of the hidden text that describes a story's term (StoryPanel renders it): its tooltip's words. */
export const termDescriptionId = (id: string) => `term-desc-${id}`;

/**
 * Replaces each marker. In a story (`href` given) it is a real link to the term's page, described by the hidden text
 * its tooltip shows (so a screen reader hears it when the link takes the focus); on the section pages, which have no
 * tooltip, it is plain bold text.
 */
export function renderTerms(md: string, lang: Lang, terms: Map<string, TermInfo>, href?: TermHref): string {
  return md.replace(TERM_PATTERN, (_, id: string, display?: string) => {
    const term = lookup(id, terms);
    const text = escapeHtml(display ?? term.name[lang]);
    const to = href?.(id);
    return to
      ? `<a class="term" href="${escapeHtml(to)}" data-term="${id}" aria-describedby="${termDescriptionId(id)}">${text}</a>`
      : `<b class="term">${text}</b>`;
  });
}

/** Marker-free, Markdown-free text, for meta descriptions. */
export function plainText(md: string, lang: Lang, terms: Map<string, TermInfo>): string {
  return md
    .replace(TERM_PATTERN, (_, id: string, display?: string) => display ?? lookup(id, terms).name[lang])
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}[ \t]+/gm, '')
    .replace(/[*_`>]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
