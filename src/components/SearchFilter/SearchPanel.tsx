import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { loadSearchIndex, searchEvents, type SearchEntry } from '../../lib/search';
import { formatDate } from '../../lib/format';
import { eventUrl } from '../../lib/paths';
import type { Category, EventSummary, Lang } from '../../lib/types';
import { EMPTY_FILTER, FILTER_CATEGORIES, isFilterActive, type FilterState } from '../../lib/filter';
import { t, type UiKey } from '../../i18n';
import './SearchPanel.css';

export const SEARCH_PANEL_ID = 'search-panel';
/** How long the typing has to pause before the result count is read out (once, not on every key). */
const ANNOUNCE_DELAY = 500;

interface Props {
  lang: Lang;
  /** Every event, in timeline order: the results' titles and dates. */
  events: EventSummary[];
  /** Side by side the panel sits on the map and leaves the page usable; otherwise it covers the screen. */
  wide: boolean;
  /** `restoreFocus`: hand the focus back to the button that opened the panel. */
  onClose(restoreFocus: boolean): void;
  onSelect(id: string): void;
  filter: FilterState;
  onFilterChange(f: FilterState): void;
  /** How many events the filter keeps. */
  matching: number;
  /** The events the filter leaves out: still listed as results, marked as filtered out. */
  dimmed: ReadonlySet<string>;
}

type IndexState = { status: 'loading' } | { status: 'failed' } | { status: 'ready'; index: SearchEntry[] };

/**
 * The search panel (docs/design/search-filter.md): a search field whose results list as links while typing. The
 * index is fetched the first time the panel opens. Arrow keys inside belong to the panel (data-own-arrows).
 */
export function SearchPanel({ lang, events, wide, onClose, onSelect, filter, onFilterChange, matching, dimmed }: Props) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<IndexState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [announce, setAnnounce] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    setState({ status: 'loading' });
    loadSearchIndex(lang).then(
      (index) => live && setState({ status: 'ready', index }),
      () => live && setState({ status: 'failed' }),
    );
    return () => {
      live = false;
    };
  }, [lang, attempt]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const byId = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const hits = useMemo(
    () => (state.status === 'ready' ? searchEvents(state.index, query).filter((h) => byId.has(h.id)) : []),
    [state, query, byId],
  );
  const searching = state.status === 'ready' && query.trim() !== '';

  // The count is read out once the typing pauses, not on every key.
  useEffect(() => {
    // Cleared first, so the same count after a new query is read out again.
    setAnnounce('');
    if (!searching) return;
    const message =
      hits.length === 0 ? t(lang, 'searchNone') : hits.length === 1 ? t(lang, 'searchFoundOne') : t(lang, 'searchFound', { n: hits.length });
    const timer = setTimeout(() => setAnnounce(message), ANNOUNCE_DELAY);
    return () => clearTimeout(timer);
  }, [searching, hits, lang]);

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose(true);
      return;
    }
    // Covering the screen, the panel keeps Tab inside itself.
    if (e.key !== 'Tab' || wide) return;
    const focusable = [...rootRef.current!.querySelectorAll<HTMLElement>('input, button, a[href]')].filter(
      (el) => !el.hidden && !(el as HTMLButtonElement).disabled,
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === rootRef.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const choose = (e: MouseEvent, id: string) => {
    // A modified click opens the link as links do; a plain one stays in the page.
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    onSelect(id);
    // Covering the screen, the panel gives way to the story (which takes the focus once the panel is gone).
    if (!wide) onClose(false);
  };

  return (
    <div
      id={SEARCH_PANEL_ID}
      ref={rootRef}
      class={`search-panel paper corners${wide ? '' : ' is-cover'}`}
      role="dialog"
      aria-modal={wide ? 'false' : 'true'}
      aria-labelledby="search-panel-title"
      // A click on the panel's background keeps the focus in the panel (so Tab stays trapped on narrow screens).
      tabIndex={-1}
      data-own-arrows
      onKeyDown={onKeyDown}
    >
      <div class="search-head">
        <h2 id="search-panel-title">{t(lang, 'searchPanel')}</h2>
        <button type="button" class="search-close" aria-label={t(lang, 'close')} onClick={() => onClose(true)}>
          <span aria-hidden="true">×</span>
          {t(lang, 'close')}
        </button>
      </div>
      <label class="sr-only" for="search-field">
        {t(lang, 'searchLabel')}
      </label>
      <input
        id="search-field"
        ref={inputRef}
        class="search-field"
        type="search"
        autocomplete="off"
        spellcheck={false}
        placeholder={t(lang, 'searchPlaceholder')}
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
      />
      <p class="sr-only" aria-live="polite">
        {announce}
      </p>
      {state.status === 'loading' && <p class="search-note">{t(lang, 'searchLoading')}</p>}
      {state.status === 'failed' && (
        <div class="search-note">
          <p role="alert">{t(lang, 'searchLoadFailed')}</p>
          <button type="button" class="search-retry" onClick={() => setAttempt((n) => n + 1)}>
            {t(lang, 'retry')}
          </button>
        </div>
      )}
      {searching && hits.length === 0 && <p class="search-note">{t(lang, 'searchNone')}</p>}
      {hits.length > 0 && (
        // role: list-style none would make Safari drop the list semantics.
        <ul class="search-results" role="list">
          {hits.map((h) => {
            const e = byId.get(h.id)!;
            return (
              <li key={h.id} class={dimmed.has(h.id) ? 'is-filtered' : undefined}>
                <a href={eventUrl(lang, h.id)} onClick={(ev) => choose(ev, h.id)}>
                  <span class="hit-title">{e.title}</span>
                  <span class="sr-only">{lang === 'en' ? ', ' : '，'}</span>
                  <span class="hit-date">{formatDate(e, lang)}</span>
                  {dimmed.has(h.id) && (
                    <span class="hit-filtered">
                      <span class="sr-only">{lang === 'en' ? '. ' : '。'}</span>
                      {t(lang, 'searchFilteredOut')}
                    </span>
                  )}
                  {h.field === 'name' && (
                    <span class="hit-where">
                      <span class="sr-only">{lang === 'en' ? '. ' : '。'}</span>
                      {t(lang, 'searchMentions', { name: h.name! })}
                    </span>
                  )}
                  {h.field === 'text' && h.snippet && (
                    <span class="hit-where">
                      <span class="sr-only">{lang === 'en' ? '. ' : '。'}</span>
                      {h.snippet.before}
                      <mark>{h.snippet.match}</mark>
                      {h.snippet.after}
                    </span>
                  )}
                </a>
              </li>
            );
          })}
        </ul>
      )}
      {/* Filters (decisions/p3-retag, p3-filter-review): the seven categories; any ticked one matches. */}
      <fieldset class="filter-group">
        <legend>{t(lang, 'filterCategories')}</legend>
        {FILTER_CATEGORIES.map((c: Category) => {
          const on = filter.categories.includes(c);
          return (
            <label key={c} class="filter-check">
              <input
                type="checkbox"
                checked={on}
                onChange={() =>
                  onFilterChange({ ...filter, categories: on ? filter.categories.filter((x) => x !== c) : [...filter.categories, c] })
                }
              />
              {t(lang, `category_${c}` as UiKey)}
            </label>
          );
        })}
      </fieldset>
      {isFilterActive(filter) && (
        <div class="filter-foot">
          <span>{matching === 0 ? t(lang, 'filterNone') : t(lang, 'filterMatching', { n: matching, total: events.length })}</span>
          <button
            type="button"
            class="filter-clear"
            onClick={() => {
              onFilterChange(EMPTY_FILTER);
              inputRef.current?.focus();
            }}
          >
            {t(lang, 'clearFilters')}
          </button>
        </div>
      )}
    </div>
  );
}
