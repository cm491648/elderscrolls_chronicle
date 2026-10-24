import type { EventStory, EventSummary, Lang, Location, PersonName } from './types';
import type { MapSource } from './map-source';

/**
 * The chronicle's shared data (every event's summary, the places, the people's names): the same on every page of a
 * language. Island props are serialized value by value and HTML-escaped, which nearly doubles them, so the pages carry
 * this once as plain JSON in `<script type="application/json" id="chronicle-data">` instead (the 150 KiB page budget).
 * The server registers it per language before rendering; the browser reads the script once.
 */
export interface ChronicleData {
  events: EventSummary[];
  locations: Location[];
  people: PersonName[];
}

export const CHRONICLE_DATA_ID = 'chronicle-data';

/**
 * The places as a page carries them. Only a drawn-map build reads the drawn positions (src/lib/map-set.ts), so an
 * official-map page leaves them out (about 1.8 KB a page).
 */
export function pagePlaces(locations: Location[], source: MapSource): Location[] {
  return source === 'drawn' ? locations : locations.map(({ drawn: _drawn, ...place }) => place);
}

const byLang = new Map<Lang, ChronicleData>();

/** Server: called by the page before it renders the app. */
export function provideChronicleData(lang: Lang, data: ChronicleData): void {
  byLang.set(lang, data);
}

/** JSON for a page's data script; `<` is escaped so the text cannot close the script early. */
export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function chronicleData(lang: Lang): ChronicleData {
  const known = byLang.get(lang);
  if (known) return known;
  const el = typeof document === 'undefined' ? null : document.getElementById(CHRONICLE_DATA_ID);
  if (!el?.textContent) throw new Error(`No chronicle data for ${lang}`);
  const data = JSON.parse(el.textContent) as ChronicleData;
  byLang.set(lang, data);
  return data;
}

/**
 * An event page's own story, so it shows without a fetch: carried the same way, once, as plain JSON in
 * `<script type="application/json" id="chronicle-story">` rather than as an island prop. The server registers each page's
 * story by language and id before rendering (pages may render side by side); the browser reads the script.
 */
export const CHRONICLE_STORY_ID = 'chronicle-story';

const storiesByPage = new Map<string, EventStory>();

/** Server: called by an event page before it renders the app. */
export function providePageStory(lang: Lang, story: EventStory): void {
  storiesByPage.set(`${lang}:${story.id}`, story);
}

/** The page's own story, or null on the home page (and for an id the page did not carry). */
export function pageStory(lang: Lang, id: string | null): EventStory | null {
  if (!id) return null;
  const key = `${lang}:${id}`;
  const known = storiesByPage.get(key);
  if (known) return known;
  const el = typeof document === 'undefined' ? null : document.getElementById(CHRONICLE_STORY_ID);
  if (!el?.textContent) return null;
  const story = JSON.parse(el.textContent) as EventStory;
  if (story.id !== id) return null;
  storiesByPage.set(key, story);
  return story;
}
