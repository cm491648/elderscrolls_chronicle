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

/** Replaces each marker with a focusable `<b class="term">`; its tooltip carries the name in both languages. */
export function renderTerms(md: string, lang: Lang, terms: Map<string, TermInfo>): string {
  return md.replace(TERM_PATTERN, (_, id: string, display?: string) => {
    const term = lookup(id, terms);
    const text = escapeHtml(display ?? term.name[lang]);
    return `<b class="term" data-term="${id}" tabindex="0">${text}</b>`;
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
