import { useRef } from 'preact/hooks';
import { formatDate, gameName } from '../../lib/format';
import type { EventStory, EventSummary, Lang, PersonName } from '../../lib/types';
import { t, type UiKey } from '../../i18n';
import { TermTooltip } from './TermTooltip';
import { splitStory } from '../../lib/illustrations';
import { eventUrl, withBase } from '../../lib/paths';
import './StoryPanel.css';

interface Props {
  event: EventSummary | null;
  /** The event's story; null while it loads (or after it failed to). */
  story: EventStory | null;
  /** The story could not be loaded: offer `onRetry`. */
  failed?: boolean;
  onRetry?: () => void;
  /** The events this one names as related, in timeline order. */
  related?: EventSummary[];
  onSelect?: (id: string) => void;
  people: PersonName[];
  lang: Lang;
}

/** Story text with its plate after the middle paragraph (docs/design/directions.md 1.6, 2.8). */
function StoryBody({ story, lang }: { story: EventStory; lang: Lang }) {
  const plate = story.illustration;
  if (!plate) return <div class="story-body" dangerouslySetInnerHTML={{ __html: story.html }} />;
  const { before, after } = splitStory(story.html);
  return (
    <div class="story-body">
      <div class="story-part" dangerouslySetInnerHTML={{ __html: before }} />
      <figure class="story-plate">
        {/* The caption describes the picture, so the image itself is alt="" and the figure takes the caption as its
            name: screen readers hear "圖一 …" once, and what low-vision readers see matches what they hear. */}
        <img
          src={withBase(plate.src)}
          srcset={plate.srcset.map((s) => `${withBase(s.href)} ${s.width}w`).join(', ')}
          sizes="(max-width: 899px) calc(100vw - 70px), 600px"
          width={plate.width}
          height={plate.height}
          loading="lazy"
          decoding="async"
          alt=""
        />
        <figcaption>
          <b>{t(lang, 'plateLabel')}</b>
          {plate.caption}
        </figcaption>
      </figure>
      {after && <div class="story-part" dangerouslySetInnerHTML={{ __html: after }} />}
    </div>
  );
}

const NO_TERMS: EventStory['terms'] = [];

/** Number of entries in the endnotes: list items when it is a list, otherwise paragraphs. */
function countNotes(html: string): number {
  const items = html.match(/<li[\s>]/g)?.length ?? 0;
  return items || Math.max(1, html.match(/<p[\s>]/g)?.length ?? 0);
}

export function StoryPanel({ event, story, failed = false, onRetry, related = [], onSelect, people, lang }: Props) {
  const articleRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  if (!event) return <p class="story-empty">{t(lang, 'selectEvent')}</p>;
  const names = event.people.map((id) => people.find((p) => p.id === id)?.name ?? id);

  // The tooltip is a sibling of the live region (it portals to <body>), so its text is never announced as a story update.
  return (
    <>
      <article class="story" ref={articleRef}>
        <p class="story-date">{formatDate(event, lang)}</p>
        {/* tabindex -1: a story that opens takes the focus here (ChronicleApp). */}
        <h2 tabindex={-1} ref={titleRef}>
          {event.title}
        </h2>
        {event.titleEn && (
          <p class="story-en" lang="en">
            {event.titleEn}
          </p>
        )}
        <p class="story-badges">
          <span class={`badge badge-${event.certainty}`}>{t(lang, `certainty_${event.certainty}` as UiKey)}</span>
          {event.review === 'unresolved' && <span class="badge badge-unresolved">{t(lang, 'review_unresolved')}</span>}
          {/* Only with neither a place nor a region: a region-only event (the Mundus ring, Cyrodiil) is framed on the map. */}
          {event.locations.length === 0 && !event.regions?.length && <span class="story-note">{t(lang, 'locationUnknown')}</span>}
        </p>
        {/* The title, date and badges come with every page; the text itself may still be on its way. */}
        {story ? (
          <StoryBody story={story} lang={lang} />
        ) : failed ? (
          <div class="story-body story-failed">
            <p role="alert">{t(lang, 'storyLoadFailed')}</p>
            <button
              type="button"
              class="story-retry"
              onClick={() => {
                // The button goes away with the retry: keep the focus at the story's title.
                titleRef.current?.focus({ preventScroll: true });
                onRetry?.();
              }}
            >
              {t(lang, 'retry')}
            </button>
          </div>
        ) : (
          <div class="story-body story-loading" aria-busy="true">
            <p role="status">{t(lang, 'storyLoading')}</p>
          </div>
        )}
        {story?.notesHtml && (
          // Open with every story, so readers weigh the other accounts and sources themselves; keyed so a story
          // the reader folded does not leave the next one folded.
          <details key={story.id} class="story-notes orule-top" open>
            <summary>
              <span class="notes-mark" aria-hidden="true">¶</span>
              <span class="notes-title">{t(lang, 'notes')}</span>
              <span class="notes-count">{t(lang, 'notesCount', { n: countNotes(story.notesHtml) })}</span>
              <span class="notes-chev" aria-hidden="true" />
            </summary>
            <div class="notes-body" dangerouslySetInnerHTML={{ __html: story.notesHtml }} />
          </details>
        )}
        {related.length > 0 && (
          <section class="story-related">
            <h3>{t(lang, 'related')}</h3>
            <ul>
              {related.map((r) => (
                <li key={r.id}>
                  {/* A real link (new tab, copy address); a plain click stays in the page. */}
                  <a
                    href={eventUrl(lang, r.id)}
                    onClick={(e) => {
                      if (!onSelect || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
                      e.preventDefault();
                      onSelect(r.id);
                    }}
                  >
                    {r.title}
                    {/* Heard as "title, date"; seen as the title with the date set apart. */}
                    <span class="sr-only">{lang === 'en' ? ', ' : '，'}</span>
                    <span class="related-date">{formatDate(r, lang)}</span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        )}
        {names.length > 0 && (
          <section>
            <h3>{t(lang, 'people')}</h3>
            <ul>{names.map((n) => <li key={n}>{n}</li>)}</ul>
          </section>
        )}
        {event.games.length > 0 && (
          <section>
            <h3>{t(lang, 'games')}</h3>
            <ul>{event.games.map((g) => <li key={g}>{gameName(g, lang)}</li>)}</ul>
          </section>
        )}
        {story && (
          <section>
            <h3>{t(lang, 'sources')}</h3>
            <ul>
              {story.sources.map((s) => (
                <li key={s.title}>
                  {s.url ? (
                    <a href={s.url} target="_blank" rel="noopener noreferrer">{s.title}</a>
                  ) : (
                    s.title
                  )}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
      <TermTooltip key={event.id} terms={story?.terms ?? NO_TERMS} lang={lang} container={articleRef} />
    </>
  );
}
