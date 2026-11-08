import type { Era, EventMeta, Game, Lang } from './types';

const ERA_LABELS: Record<Lang, Record<Era, string>> = {
  en: {
    dawn: 'Dawn Era', merethic: 'Merethic Era',
    '1E': 'First Era', '2E': 'Second Era', '3E': 'Third Era', '4E': 'Fourth Era',
  },
  'zh-tw': {
    dawn: '黎明紀元', merethic: '神話紀元',
    '1E': '第一紀元', '2E': '第二紀元', '3E': '第三紀元', '4E': '第四紀元',
  },
};

const GAME_NAMES: Record<Game, Record<Lang, string>> = {
  arena: { en: 'The Elder Scrolls: Arena', 'zh-tw': '上古卷軸：競技場' },
  daggerfall: { en: 'The Elder Scrolls II: Daggerfall', 'zh-tw': '上古卷軸 II：匕首雨' },
  battlespire: { en: 'An Elder Scrolls Legend: Battlespire', 'zh-tw': '上古卷軸傳奇：戰鬥神塔' },
  redguard: { en: 'The Elder Scrolls Adventures: Redguard', 'zh-tw': '上古卷軸冒險：紅色守衛' },
  morrowind: { en: 'The Elder Scrolls III: Morrowind', 'zh-tw': '上古卷軸 III：魔捲晨風' },
  oblivion: { en: 'The Elder Scrolls IV: Oblivion', 'zh-tw': '上古卷軸 IV：遺忘之都' },
  skyrim: { en: 'The Elder Scrolls V: Skyrim', 'zh-tw': '上古卷軸 V：無界天際' },
  eso: { en: 'The Elder Scrolls Online', 'zh-tw': '上古卷軸 Online' },
};

export function eraLabel(era: Era, lang: Lang): string {
  return ERA_LABELS[lang][era];
}

/** The eras a run of events covers, short enough for a book cover: `Third Era`, `1E–4E`, `第一至第四紀元`. */
export function eraSpan(first: Era, last: Era, lang: Lang): string {
  if (first === last) return eraLabel(first, lang);
  const numbered = (era: Era) => era !== 'dawn' && era !== 'merethic';
  if (lang === 'en') return [first, last].map((era) => (numbered(era) ? era : eraLabel(era, lang))).join('–');
  if (numbered(first) && numbered(last)) return `${eraLabel(first, lang).replace('紀元', '')}至${eraLabel(last, lang)}`;
  return `${eraLabel(first, lang)}至${eraLabel(last, lang)}`;
}

/** `1E 700` / `第一紀元 700 年`; an approximate year (`circa`) reads `c. 1E 792` / `第一紀元約 792 年`. */
export function formatDate(e: Pick<EventMeta, 'era' | 'year' | 'yearEnd' | 'circa'>, lang: Lang): string {
  const era = eraLabel(e.era, lang);
  if (e.year === null) return lang === 'en' ? `${era} (undated)` : `${era}（年代不可考）`;
  const range = e.yearEnd != null && e.yearEnd !== e.year ? `${e.year}–${e.yearEnd}` : `${e.year}`;
  if (lang === 'en') {
    const prefix = e.era === 'dawn' || e.era === 'merethic' ? era : e.era;
    return `${e.circa ? 'c. ' : ''}${prefix} ${range}`;
  }
  return `${era}${e.circa ? '約' : ''} ${range} 年`;
}

type Dated = Pick<EventMeta, 'era' | 'year' | 'yearEnd' | 'circa'>;

/** One end of a span: `1E 780` / `第一紀元 780 年`, or the era alone when it has no year. */
function spanEnd(era: Era, year: number | null, circa: boolean | undefined, lang: Lang): string {
  const name = eraLabel(era, lang);
  if (year === null) return name;
  if (lang === 'en') return `${circa ? 'c. ' : ''}${era === 'dawn' || era === 'merethic' ? name : era} ${year}`;
  return `${name}${circa ? '約' : ''} ${year} 年`;
}

/** The years a run of events covers, from the first one's start to the last one's end (a topic's dates). */
export function formatSpan(first: Dated, last: Dated, lang: Lang): string {
  const end = last.yearEnd ?? last.year;
  if (first === last) return formatDate(first, lang);
  if (first.era === last.era && first.year !== null && end !== null) {
    if (first.year === end) return formatDate({ ...first, yearEnd: undefined }, lang);
    return formatDate({ era: first.era, year: first.year, yearEnd: end, circa: first.circa }, lang);
  }
  // Same era with an undated end: the era name alone, not "Merethic Era – Merethic Era".
  if (first.era === last.era) return spanEnd(first.era, null, undefined, lang);
  return `${spanEnd(first.era, first.year, first.circa, lang)} – ${spanEnd(last.era, end, last.circa, lang)}`;
}

export function gameName(game: Game, lang: Lang): string {
  return GAME_NAMES[game][lang];
}

/** The English source title to show under a translated title: never on English pages, nor when it adds nothing. */
export function originalTitle(lang: Lang, title: string, enTitle: string | undefined): string | null {
  if (lang === 'en' || !enTitle || enTitle.trim() === title.trim()) return null;
  return enTitle;
}
