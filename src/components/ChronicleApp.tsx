import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
// First: a drawn-only build (the takedown fallback) switches the map set before anything reads it.
import '../lib/map-set';
import { createTimescale } from '../lib/timescale';
import { formatDate } from '../lib/format';
import { eventUrl, homeUrl, parseEventId } from '../lib/paths';
import { ownsArrowKeys } from '../lib/keys';
import { EMPTY_FILTER, dimmedIds, filterCount, isFilterActive, readFilter, saveFilter, stepTarget, type FilterState } from '../lib/filter';
import type { EventStory, Lang } from '../lib/types';
import { loadStory, prefetchStory, seedStory } from '../lib/story-cache';
import { chronicleData, pageStory } from '../lib/page-data';
import { MAP_SOURCE } from '../lib/map-source';
import { BEACON_TOKEN } from '../lib/analytics';
import { t } from '../i18n';
import { Timeline } from './Timeline/Timeline';
import { MapView } from './MapView/MapView';
import { StoryPanel } from './StoryPanel/StoryPanel';
import { LangSwitch } from './LangSwitch/LangSwitch';
import { SearchPanel, SEARCH_PANEL_ID } from './SearchFilter/SearchPanel';

interface Props {
  lang: Lang;
  /** The event the page opens on (its story comes with the page, lib/page-data); null on the home page. */
  initialId: string | null;
}

/** How far (px) the reader scrolls down into the story, past where the timeline sticks, before the map folds away. */
const FOLD_AFTER = 48;
/** Scrolling back within this many px of the top unfolds the map again. */
const TOP_ZONE = 8;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
/**
 * Wide screens show the map and the story side by side (global.css uses the same query). They must be tall enough
 * too: on a phone held sideways (~915×412) the story column would be cut off, so short screens stack instead.
 */
const WIDE_QUERY = '(min-width: 900px) and (min-height: 560px)';

type ScrollRequest = { to: 'story' | 'top'; n: number };

/**
 * Header, then the timeline, then the map and (once an event is chosen) its story. The home page has no story; an
 * event URL opens with it.
 * - Wide screens (≥ 900px): the map fills the window under the timeline; a story opens in a column on its right that
 *   scrolls on its own, so the page never scrolls and the map stays whole. Closing the story widens the map back.
 * - Narrow screens: one column, timeline (sticky) › map › story; reading down a long story folds the map away, and
 *   scrolling back to the top or the "Show map" button unfolds it.
 */
export default function ChronicleApp({ lang, initialId }: Props) {
  // Every event, place and name: the page's shared data (lib/page-data), not island props.
  const { events, locations, people } = useMemo(() => chronicleData(lang), [lang]);
  const scale = useMemo(() => createTimescale(events), [events]);
  const ordered = useMemo(() => {
    const byId = new Map(events.map((e) => [e.id, e]));
    return scale.ordered.map((id) => byId.get(id)!);
  }, [events, scale]);
  const known = (id: string | null) => (id && ordered.some((e) => e.id === id) ? id : null);
  const [selectedId, setSelectedId] = useState<string | null>(known(initialId));
  const [mapOpen, setMapOpen] = useState(true);
  const [scrollReq, setScrollReq] = useState<ScrollRequest | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const topbarRef = useRef<HTMLElement>(null);
  const tlRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const headRef = useRef<HTMLDivElement>(null);
  const storyColRef = useRef<HTMLDivElement>(null);
  const [wide, setWide] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // The server HTML is unfiltered; the filter kept on this device applies once the page is live.
  const [filter, setFilterState] = useState<FilterState>(EMPTY_FILTER);
  useEffect(() => setFilterState(readFilter()), []);
  const setFilter = (f: FilterState) => {
    saveFilter(f);
    setFilterState(f);
  };
  const dimmed = useMemo(() => dimmedIds(ordered, filter), [ordered, filter]);
  // The story effect runs on selection only, and the arrow keys are bound once: both read the current order, filter
  // and selection through this ref, so a key pressed right after the story changes steps from the new one.
  const stepping = useRef({ ordered, dimmed, selectedId });
  stepping.current = { ordered, dimmed, selectedId };
  const searchToggleRef = useRef<HTMLButtonElement>(null);
  /** Where the focus goes once the search panel has closed: its button, or the story a result opened. */
  const focusAfterSearch = useRef<'toggle' | 'story' | null>(null);
  const wideRef = useRef(wide);
  wideRef.current = wide;
  const mapOpenRef = useRef(mapOpen);
  mapOpenRef.current = mapOpen;
  /** Scroll position the map was last unfolded at; folding needs FOLD_AFTER px of reading past it. */
  const openedAt = useRef(0);
  const selected = ordered.find((e) => e.id === selectedId) ?? null;
  // Stories by id as they arrive. Only an event page's own story comes with the page; the rest are fetched when chosen
  // (lib/story-cache), and the summary shows the title, date and badges meanwhile.
  const [stories, setStories] = useState<Record<string, EventStory>>(() => {
    const initialStory = pageStory(lang, initialId);
    if (!initialStory) return {};
    // Also runs while the page is built: harmless there, the server never loads a story.
    seedStory(lang, initialStory);
    return { [initialStory.id]: initialStory };
  });
  const [failedId, setFailedId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const story = (selectedId && stories[selectedId]) || null;
  // Opening or closing a story changes the map's height in one step, not animated: the map frames the newly chosen
  // place as soon as it is told about it, so its box must already have the new size by then. Only folding and
  // unfolding animate.
  const hadStory = useRef(!!selected);
  const storyToggled = hadStory.current !== !!selected;
  hadStory.current = !!selected;
  // The event the map shows. When a story opens or closes the map changes height, and MapView frames the selection
  // from the size it last measured; so the map hears of the change only once it has measured its new box (two frames
  // later). Otherwise it follows the selection at once.
  const [mapEvent, setMapEvent] = useState(selected);
  useEffect(() => {
    if (mapEvent?.id === selected?.id) return;
    if (!!mapEvent === !!selected) {
      setMapEvent(selected);
      return;
    }
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setMapEvent(selected));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [selected]);

  useEffect(() => {
    if (!selectedId) return;
    let live = true;
    setFailedId(null);
    loadStory(lang, selectedId).then(
      (s) => {
        setStories((all) => (all[s.id] ? all : { ...all, [s.id]: s }));
        if (!live) return;
        // The reader may step on along the timeline: fetch the stories on either side ahead of time.
        const now = stepping.current;
        const ids = now.ordered.map((e) => e.id);
        for (const dir of [-1, 1] as const) {
          const id = stepTarget(ids, s.id, dir, now.dimmed);
          if (id) prefetchStory(lang, id);
        }
      },
      () => {
        if (live) setFailedId(selectedId);
      },
    );
    return () => {
      live = false;
    };
  }, [selectedId, attempt]);

  const requestScroll = (to: ScrollRequest['to']) => setScrollReq((r) => ({ to, n: (r?.n ?? 0) + 1 }));
  const openMap = () => {
    openedAt.current = scrollY;
    setMapOpen(true);
  };

  /** Shows an event's story under the map and brings its opening into view. */
  const select = (id: string) => {
    if (id !== selectedId) {
      setSelectedId(id);
      history.pushState({ id }, '', eventUrl(lang, id));
    }
    setMapOpen(true);
    requestScroll('story');
  };
  const selectRef = useRef(select);
  selectRef.current = select;

  // Covering the screen, the panel keeps the page under it from scrolling and out of reach (aria-modal alone does not
  // stop a screen reader's virtual cursor).
  useEffect(() => {
    const covering = searchOpen && !wide;
    document.documentElement.classList.toggle('search-covering', covering);
    const under = [...rootRef.current!.querySelectorAll<HTMLElement>('.topbar, .sticky-head, .story-col, .site-footer')];
    for (const el of under) el.inert = covering;
    // Only now, with the page no longer inert, can the focus come back to it.
    const target = searchOpen ? null : focusAfterSearch.current;
    focusAfterSearch.current = null;
    if (target === 'toggle') searchToggleRef.current?.focus();
    // A chosen result: its story (also when it was the story already open, which the focus effect does not see).
    else if (target === 'story') document.querySelector<HTMLElement>('.story h2')?.focus({ preventScroll: true });
    return () => {
      document.documentElement.classList.remove('search-covering');
      for (const el of under) el.inert = false;
    };
  }, [searchOpen, wide, !!selected]);

  const close = () => {
    setSelectedId(null);
    history.pushState({ id: null }, '', homeUrl(lang));
    setMapOpen(true);
    requestScroll('top');
    // The close button is gone; hand focus to the timeline's tab stop so keyboard readers stay in the page.
    requestAnimationFrame(() => {
      const stop = document.querySelector<HTMLElement>('.timeline [role="button"][tabindex="0"]');
      (stop ?? document.querySelector<HTMLElement>('.tl-svg'))?.focus({ preventScroll: true });
    });
  };

  // This page owns its scroll position: a history step lands on the story's opening (or the top), never on a stale offset.
  useEffect(() => {
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const onPop = () => {
      const id = known(parseEventId(location.pathname));
      setSelectedId(id);
      setMapOpen(true);
      requestScroll(id ? 'story' : 'top');
    };
    addEventListener('popstate', onPop);
    return () => removeEventListener('popstate', onPop);
  }, [ordered]);

  useEffect(() => {
    const mq = matchMedia(WIDE_QUERY);
    const update = () => {
      setWide(mq.matches);
      // Side by side the map never folds.
      if (mq.matches) setMapOpen(true);
    };
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (!scrollReq) return;
    const behavior = reducedMotion() ? 'auto' : 'smooth';
    if (wideRef.current) {
      // Side by side the page does not scroll; a new story starts at the top of its own column.
      if (scrollReq.to === 'story') storyColRef.current?.scrollTo({ top: 0 });
      else scrollTo({ top: 0 });
      return;
    }
    if (scrollReq.to === 'top') {
      openedAt.current = 0;
      scrollTo({ top: 0, behavior });
      return;
    }
    // Where the sticky timeline catches: the story then starts right under the map.
    const target = Math.round(mainRef.current!.getBoundingClientRect().top + scrollY);
    openedAt.current = target;
    if (Math.abs(scrollY - target) > 1) scrollTo({ top: target, behavior });
  }, [scrollReq]);

  useEffect(() => {
    document.title = selected ? `${selected.title} | ${t(lang, 'siteTitle')}` : t(lang, 'siteTitle');
  }, [selected, lang]);

  // A story that opens takes the focus on its title (so the keyboard reads on from there, and arrow keys scroll its
  // column); so does a new story chosen from somewhere that is gone (the map's popup). Stepping through stories with
  // the timeline's buttons or arrow keys leaves the focus where it is.
  // Otherwise (focus stays put) a polite live region says which story is now shown: its title and date only, never
  // the whole story.
  const shownId = useRef(selectedId);
  const [announce, setAnnounce] = useState('');
  useEffect(() => {
    const was = shownId.current;
    shownId.current = selectedId;
    if (!selectedId || was === selectedId) return;
    const active = document.activeElement;
    const lost = !active || active === document.body || !active.isConnected || !!active.closest('.map-popup');
    // Already on the story's title (the search panel hands it the focus): reading the title out again would repeat it.
    const onTitle = !!active?.matches('.story h2');
    if (was === null || lost || onTitle) {
      document.querySelector<HTMLElement>('.story h2')?.focus({ preventScroll: true });
      return;
    }
    const e = ordered.find((x) => x.id === selectedId);
    if (e) setAnnounce(`${e.title}${lang === 'en' ? ', ' : '，'}${formatDate(e, lang)}`);
  }, [selectedId]);

  // Heights the map sizes itself from (CSS variables on .chronicle): the header, the timeline and the footer; and the
  // sticky head's height. Set once before the first paint too, so the map does not first lay out at the guesses in
  // global.css and pick its image for a size it then leaves (an observer only reports after layout).
  useLayoutEffect(() => {
    const root = rootRef.current!;
    const parts: [HTMLElement | null, string][] = [
      [topbarRef.current, '--top-h'],
      [tlRef.current, '--tl-h'],
      [footRef.current, '--foot-h'],
    ];
    const head = headRef.current!;
    const update = () => {
      for (const [el, name] of parts) if (el) root.style.setProperty(name, `${Math.ceil(el.getBoundingClientRect().height)}px`);
      // On <html>, for scroll-padding-top: whatever the browser scrolls into view (focus, find) clears the sticky head.
      document.documentElement.style.setProperty('--sticky-h', `${Math.ceil(head.getBoundingClientRect().height)}px`);
    };
    update();
    const observer = new ResizeObserver(update);
    for (const [el] of parts) if (el) observer.observe(el);
    observer.observe(head);
    return () => observer.disconnect();
    // The footer moves into the story column while a story is open: observe the element that is there now.
  }, [!!selected]);

  // Reading down folds the map; back at the top it unfolds. Only with a story open, and only when the story is long
  // enough that the page can stay scrolled past the timeline once the map is gone (otherwise the shorter page would
  // land back at the top and the map would unfold again).
  useEffect(() => {
    if (!selectedId || wide) return;
    let last = scrollY;
    const onScroll = () => {
      const y = scrollY;
      const down = y > last;
      last = y;
      if (y <= TOP_ZONE) {
        if (!mapOpenRef.current) {
          openedAt.current = 0;
          setMapOpen(true);
        }
        return;
      }
      if (!down || !mapOpenRef.current) return;
      // Never fold the map out from under the keyboard: focusing something in it can scroll the page.
      if (wrapRef.current!.contains(document.activeElement)) return;
      const stick = mainRef.current!.getBoundingClientRect().top + y;
      const threshold = Math.max(openedAt.current, stick) + FOLD_AFTER;
      const mapH = wrapRef.current!.getBoundingClientRect().height;
      const maxAfterFold = document.documentElement.scrollHeight - mapH - innerHeight;
      if (y > threshold && maxAfterFold > stick + FOLD_AFTER) setMapOpen(false);
    };
    addEventListener('scroll', onScroll, { passive: true });
    return () => removeEventListener('scroll', onScroll);
  }, [selectedId, wide]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Arrow keys belong to whatever edits or adjusts a value: fields, lists, sliders, editable text.
      if (ownsArrowKeys(e.target as Element | null)) return;
      if (e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      if (e.repeat) return;
      // With nothing chosen yet, → starts at the first event; events a filter leaves out are skipped.
      const now = stepping.current;
      const next = stepTarget(now.ordered.map((x) => x.id), now.selectedId, e.key === 'ArrowRight' ? 1 : -1, now.dimmed);
      if (next) {
        e.preventDefault();
        selectRef.current(next);
      }
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  const footer = (
    <footer class="site-footer leather on-leather orule-top" ref={footRef}>
      {t(lang, 'disclaimer')}
      {MAP_SOURCE === 'official' && (
        <>
          {lang === 'en' ? ' ' : ''}
          {t(lang, 'disclaimerOfficialMap')}
        </>
      )}
      {BEACON_TOKEN && (
        <>
          {lang === 'en' ? ' ' : ''}
          {t(lang, 'disclaimerAnalytics')}
        </>
      )}
    </footer>
  );

  return (
    <div class={`chronicle${selected ? ' has-story' : ''}${searchOpen ? ' search-open' : ''}`} ref={rootRef}>
      <header class="topbar leather on-leather orule-bottom" ref={topbarRef}>
        <div class="brand">
          <h1>{t(lang, 'siteTitle')}</h1>
          {t(lang, 'siteSubtitle') && (
            <span class="brand-sub" lang="en" aria-hidden="true">
              {t(lang, 'siteSubtitle')}
            </span>
          )}
        </div>
        <button
          type="button"
          class="search-toggle"
          ref={searchToggleRef}
          aria-expanded={searchOpen}
          aria-controls={SEARCH_PANEL_ID}
          onClick={() => setSearchOpen((o) => !o)}
        >
          {t(lang, 'searchAndFilter')}
          {isFilterActive(filter) && (
            <span class="search-count">
              <span class="sr-only">{lang === 'en' ? ', filters on: ' : '，已勾選 '}</span>
              {filterCount(filter)}
            </span>
          )}
        </button>
        <LangSwitch lang={lang} eventId={selectedId} />
      </header>
      <p class="sr-only" aria-live="polite" data-story-announce>
        {announce}
      </p>
      <main class="stage" ref={mainRef}>
        {searchOpen && (
          <SearchPanel
            lang={lang}
            events={ordered}
            wide={wide}
            filter={filter}
            onFilterChange={setFilter}
            matching={ordered.length - dimmed.size}
            dimmed={dimmed}
            onSelect={select}
            onClose={(restoreFocus) => {
              focusAfterSearch.current = restoreFocus ? 'toggle' : 'story';
              setSearchOpen(false);
            }}
          />
        )}
        <div class="sticky-head" ref={headRef}>
          <div class="tl-wrap leather" ref={tlRef}>
            <Timeline events={ordered} scale={scale} selectedId={selectedId} lang={lang} onSelect={select} dimmed={dimmed} locations={locations} />
          </div>
          <div id="map-wrap" class={`map-wrap${mapOpen ? '' : ' is-folded'}${storyToggled ? ' no-anim' : ''}`} ref={wrapRef} inert={!mapOpen}>
            <MapView events={ordered} locations={locations} selected={mapEvent} lang={lang} onSelect={select} dimmed={dimmed} />
          </div>
          <div class="map-bar">
            {selected ? (
              // Side by side nothing folds, so there is no fold button (CSS also hides it before hydration).
              !wide && (
                <button
                  type="button"
                  class="map-toggle"
                  aria-expanded={mapOpen}
                  aria-controls="map-wrap"
                  onClick={() => (mapOpen ? setMapOpen(false) : openMap())}
                >
                  {t(lang, mapOpen ? 'hideMap' : 'showMap')}
                </button>
              )
            ) : (
              <p class="map-hint">{t(lang, 'selectEvent')}</p>
            )}
          </div>
        </div>
        {selected && (
          // Side by side this column scrolls on its own; the footer goes with the story, at its foot.
          <div class="story-col" ref={storyColRef}>
            <section class="story-pane paper corners" aria-label={selected.title}>
              <button type="button" class="story-close" aria-label={t(lang, 'closeStory')} onClick={close}>
                <span aria-hidden="true">×</span>
                {t(lang, 'close')}
              </button>
              <StoryPanel
                event={selected}
                story={story}
                failed={!story && failedId === selectedId}
                onRetry={() => {
                  setFailedId(null);
                  setAttempt((n) => n + 1);
                }}
                // The link that was clicked leaves with the old story, so the new story takes the focus (above).
                related={ordered.filter((e) => e.id !== selected.id && selected.related.includes(e.id))}
                onSelect={select}
                people={people}
                lang={lang}
              />
            </section>
            {footer}
          </div>
        )}
      </main>
      {!selected && footer}
    </div>
  );
}
