import type { Illustration } from './illustrations';

export const LANGS = ['en', 'zh-tw'] as const;
export type Lang = (typeof LANGS)[number];

export const ERAS = ['dawn', 'merethic', '1E', '2E', '3E', '4E'] as const;
export type Era = (typeof ERAS)[number];

/** Tamriel's nine provinces: each is also a map layer under Tamriel (R12), named like its region on the Tamriel map. */
export const PROVINCES = [
  'high-rock', 'skyrim', 'morrowind', 'hammerfell', 'cyrodiil', 'black-marsh', 'elsweyr', 'valenwood', 'summerset',
] as const;
export type Province = (typeof PROVINCES)[number];

/** Map layers, coarsest first: cosmos > Nirn > Tamriel > the provinces (see MAPS in MapView/shapes.ts). */
export const MAP_LAYERS = ['cosmos', 'nirn', 'tamriel', ...PROVINCES] as const;
export type MapLayer = (typeof MAP_LAYERS)[number];

/** Event categories (decisions/p3-design, p3-retag): a story may have any number of them. */
export const CATEGORIES = ['myth', 'divine', 'war', 'religion', 'disaster', 'founding', 'heroes'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CERTAINTIES = ['canon', 'disputed', 'legend'] as const;
export type Certainty = (typeof CERTAINTIES)[number];

export const REVIEW_STATES = ['agreed', 'unresolved'] as const;
export type ReviewState = (typeof REVIEW_STATES)[number];

export const GAMES = ['arena', 'daggerfall', 'battlespire', 'redguard', 'morrowind', 'oblivion', 'skyrim', 'eso'] as const;
export type Game = (typeof GAMES)[number];

export const SOURCE_KINDS = ['game', 'book', 'web'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];

export interface Source {
  title: string;
  kind: SourceKind;
  url?: string;
}

export interface EventMeta {
  id: string;
  era: Era;
  year: number | null;
  yearEnd?: number;
  /** The year is approximate: shown as `c. 1E 792` / `第一紀元約 792 年`. Absent means exact. */
  circa?: boolean;
  order: number;
  /** The layer an event falls back to when it names no place; otherwise the map picks the finest layer holding them. */
  mapLayer: MapLayer;
  locations: string[];
  /**
   * Whole areas the event covers, as region ids (e.g. `skyrim`, `atmora`): shown outlined and framed with the
   * locations. Optional; proposed in R12 (docs/research/event-locations.md), applied once the user confirms.
   */
  regions?: string[];
  /**
   * Areas the event also belongs to on the timeline only (an event in Oblivion and on Nirn): drawn on their lanes
   * too, while the map keeps to the places and regions above.
   */
  timelineRegions?: string[];
  categories: Category[];
  people: string[];
  related: string[];
  games: Game[];
  sources: Source[];
  certainty: Certainty;
  review: ReviewState;
}

/**
 * What every page knows about every event: enough for the timeline, the map, search results and related links.
 * The sources travel with the story instead, since only the open story lists them.
 */
export interface EventSummary extends Omit<EventMeta, 'sources'> {
  title: string;
  /** The English source title, shown under a translated title; null on English pages. */
  titleEn: string | null;
}

/** One event's story, loaded on demand (built to /<lang>/stories/<id>.json). */
export interface EventStory {
  id: string;
  /** The story's plate (one per event), in the page language; null when the event has none. */
  illustration: Illustration | null;
  html: string;
  notesHtml: string | null;
  /** The terms this story (and its notes) marks, for the tooltips. */
  terms: StoryTerm[];
  sources: Source[];
}

export type ChronicleEvent = EventSummary & Omit<EventStory, 'id'>;

export interface Location {
  id: string;
  /** The finest layer the place is drawn on; coarser layers show it through each layer's transform to its parent. */
  layer: MapLayer;
  /** The region of `layer` the place belongs to (on a province layer: the province itself). */
  region: string;
  /** Open water (a bay, a sea): it belongs to `region` but need not lie inside the region's land outline. */
  sea?: boolean;
  x: number;
  y: number;
  /**
   * Its position on the drawn (schematic) map, in the schematic Tamriel frame (places on Tamriel and the provinces) or
   * the schematic Nirn frame (places on Nirn). Set for every place in the content; optional for hand-built test data.
   */
  drawn?: { x: number; y: number };
  name: Record<Lang, string>;
}

export interface Person {
  id: string;
  name: Record<Lang, string>;
  summary: Record<Lang, string>;
}

/** What a page needs of a person: the name its story lists, in the page language (the summaries travel with each story's terms). */
export interface PersonName {
  id: string;
  name: string;
}

export interface TermInfo {
  id: string;
  name: Record<Lang, string>;
  summary?: Record<Lang, string>;
}

/** A term as a story carries it for the tooltips: both names (the tip shows the other one too), the summary in the story's language only. */
export interface StoryTerm {
  id: string;
  name: Record<Lang, string>;
  summary?: string;
}
