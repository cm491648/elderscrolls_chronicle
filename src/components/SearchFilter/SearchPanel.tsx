import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
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
 *
 * A native <dialog>: covering the screen (narrow) it is modal (showModal: the page under it is inert and out of reach,
 * Tab stays inside, Escape closes it); side by side it sits on the map and leaves the page usable (show).
 */
export function SearchPanel({ lang, events, wide, onClose, onSelect, filter, onFilterChange, matching, dimmed }: Props) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState<IndexState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [announce, setAnnounce] = useState('');
  const rootRef = useRef<HTMLDialogElement>(null);
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

  // A dialog cannot switch between modal and not while open: crossing the width where the page goes side by side
  // closes and opens it again the other way.
  useLayoutEffect(() => {
    const dialog = rootRef.current!;
    if (dialog.open) dialog.close();
    if (wide) dialog.show();
    else dialog.showModal();
    inputRef.current?.focus();
  }, [wide]);

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

  // A changed filter is read out too: how many events it now keeps (the line under the checkboxes says the same).
  const filterSaid = useRef(false);
  useEffect(() => {
    if (!filterSaid.current) {
      filterSaid.current = true;
      return;
    }
    setAnnounce('');
    const message = !isFilterActive(filter)
      ? ''
      : matching === 0
        ? t(lang, 'filterNone')
        : t(lang, 'filterMatching', { n: matching, total: events.length });
    if (!message) return;
    const timer = setTimeout(() => setAnnounce(message), ANNOUNCE_DELAY);
    return () => clearTimeout(timer);
  }, [filter, matching]);

  // Escape closes the panel either way (a modal dialog would close itself, but the page owns the panel's state).
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    onClose(true);
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
    <dialog
      id={SEARCH_PANEL_ID}
      ref={rootRef}
      class={`search-panel paper corners${wide ? '' : ' is-cover'}`}
      aria-labelledby="search-panel-title"
      data-own-arrows
      onKeyDown={onKeyDown}
      onCancel={(e) => {
        e.preventDefault();
        onClose(true);
      }}
    >
      <div class="search-head">
        <h2 id="search-panel-title">{t(lang, 'searchPanel')}</h2>
        <button type="button" class="search-close" aria-label={t(lang, 'close')} onClick={() => onClose(true)}>
          <span aria-hidden="true">×</span>
          {t(lang, 'close')}
        </button>
      </div>
      <search class="search-form">
      <label class="search-label" for="search-field">
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
      </search>
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
      <search class="filter-form">
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
      </search>
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
    </dialog>
  );
}
