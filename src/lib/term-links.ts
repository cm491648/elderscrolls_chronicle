import { biographyUrl, glossaryUrl } from './paths';
import type { Lang, StoryTerm } from './types';

type Linkable = Pick<StoryTerm, 'id' | 'glossary' | 'biography'>;

/** Where a story's term can take the reader: its glossary entry, and a person's biography. */
export function termLinks(term: Linkable, lang: Lang): { glossary: string | null; biography: string | null } {
  return {
    glossary: term.glossary ? glossaryUrl(lang, term.id) : null,
    biography: term.biography ? biographyUrl(lang, term.id) : null,
  };
}

/** Where Enter on a focused term goes: a person's biography, else the glossary entry, else nowhere. */
export function primaryTermHref(term: Linkable, lang: Lang): string | null {
  const links = termLinks(term, lang);
  return links.biography ?? links.glossary;
}

/** Where a person's name links: their biography if they have one, else their glossary entry (every person has one). */
export function personHref(person: { id: string; biography?: true }, lang: Lang): string {
  return person.biography ? biographyUrl(lang, person.id) : glossaryUrl(lang, person.id);
}
