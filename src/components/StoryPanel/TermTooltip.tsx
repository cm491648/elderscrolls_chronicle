import type { RefObject } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Lang, StoryTerm } from '../../lib/types';
import { termLinks } from '../../lib/term-links';
import { t } from '../../i18n';

interface Props {
  terms: StoryTerm[];
  lang: Lang;
  container: RefObject<HTMLElement>;
}

const TIP_ID = 'term-tooltip';
const GAP = 6;
const MARGIN = 8;
/** Grace period for the pointer to travel from a term into its tooltip (WCAG 1.4.13 hoverable). */
const HIDE_DELAY = 200;

interface Open {
  el: HTMLElement;
  term: StoryTerm;
  /** Opened by the pointer (hover, tap) or by the keyboard's focus. Only a pointer's tooltip offers its links: from
   * the keyboard the term itself is the link, and its words are already its description (StoryPanel). */
  via: 'pointer' | 'focus';
}

const htmlLang = (l: Lang) => (l === 'en' ? 'en' : 'zh-Hant-TW');

/**
 * A tooltip for the `.term` links inside `container`: shows on hover, focus and tap; hides on leave, blur,
 * Esc, an outside tap, or when the story scrolls (a resize only re-places it). It is portalled to <body>,
 * outside the story's live region, and the pointer may move into it without it closing.
 * A mouse click and Enter follow the term's link as links do; on a touch screen the first tap shows the tooltip
 * (decisions: tap to open on phones) and a second tap on the same term follows the link.
 */
export function TermTooltip({ terms, lang, container }: Props) {
  const [open, setOpen] = useState<Open | null>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);
  /** Bumped on window resize so the open tooltip is re-placed instead of closed. */
  const [layoutRev, setLayoutRev] = useState(0);
  const tipRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<number | undefined>(undefined);
  const byId = useMemo(() => new Map(terms.map((x) => [x.id, x])), [terms]);

  const cancelHide = () => {
    clearTimeout(hideTimer.current);
    hideTimer.current = undefined;
  };
  /** Closes the tooltip after a short delay; `el` limits it to that trigger (null = whichever is open). */
  const scheduleHide = (el: HTMLElement | null) => {
    cancelHide();
    hideTimer.current = window.setTimeout(() => {
      setOpen((cur) => (cur && (el === null || cur.el === el) ? null : cur));
    }, HIDE_DELAY);
  };
  const close = () => {
    cancelHide();
    setOpen(null);
  };

  useEffect(() => {
    const root = container.current;
    if (!root) return;
    // Side by side the story's own column scrolls; on narrow screens the page does (listened to below).
    const scroller = root.closest('.story-col') ?? root;
    const inTip = (target: EventTarget | null) => target instanceof Node && !!tipRef.current?.contains(target);
    const show = (el: HTMLElement | null, via: Open['via']) => {
      const term = el && byId.get(el.dataset.term ?? '');
      if (!el || !term) return;
      cancelHide();
      // Re-entering the same term keeps the same object, so the tooltip does not re-layout or flicker; a pointer
      // reaching a term the keyboard opened adds the links.
      setOpen((cur) => (cur && cur.el === el && (cur.via === via || cur.via === 'pointer') ? cur : { el, term, via }));
    };
    /** The kind of pointer that pressed last (a tap's click follows its pointerdown). */
    let pointerType = 'mouse';
    /** The term the last tap opened: a second tap on it follows its link. */
    let tapped: HTMLElement | null = null;

    const onOver = (e: MouseEvent) => show(termOf(e.target), 'pointer');
    const onOut = (e: MouseEvent) => {
      const from = termOf(e.target);
      if (!from || termOf(e.relatedTarget) === from || inTip(e.relatedTarget)) return;
      scheduleHide(from);
    };
    const onFocusIn = (e: FocusEvent) => show(termOf(e.target), 'focus');
    const onFocusOut = (e: FocusEvent) => {
      const from = termOf(e.target);
      if (!from || tipRef.current?.matches(':hover')) return;
      cancelHide();
      setOpen((cur) => (cur && cur.el === from ? null : cur));
    };
    const onClick = (e: MouseEvent) => {
      const el = termOf(e.target);
      if (!el) return;
      if (pointerType === 'mouse' || e.detail === 0 || e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;
      // A tap: the first one shows the tooltip, a second one on the same term follows the link.
      if (tapped === el) return;
      e.preventDefault();
      tapped = el;
      show(el, 'pointer');
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onDown = (e: PointerEvent) => {
      pointerType = e.pointerType || 'mouse';
      const el = termOf(e.target);
      if (el !== tapped && !inTip(e.target)) tapped = null;
      if (!el && !inTip(e.target)) close();
    };

    root.addEventListener('mouseover', onOver);
    root.addEventListener('mouseout', onOut);
    root.addEventListener('focusin', onFocusIn);
    root.addEventListener('focusout', onFocusOut);
    root.addEventListener('click', onClick);
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    // The tooltip is position: fixed, so any scroll of the story pane or the page would strand it. A resize
    // (phone address bar collapsing, on-screen keyboard) is not the reader's doing, so it only re-places it.
    const onResize = () => setLayoutRev((n) => n + 1);
    scroller.addEventListener('scroll', close, { passive: true });
    addEventListener('scroll', close, { passive: true });
    addEventListener('resize', onResize);
    return () => {
      cancelHide();
      root.removeEventListener('mouseover', onOver);
      root.removeEventListener('mouseout', onOut);
      root.removeEventListener('focusin', onFocusIn);
      root.removeEventListener('focusout', onFocusOut);
      root.removeEventListener('click', onClick);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
      scroller.removeEventListener('scroll', close);
      removeEventListener('scroll', close);
      removeEventListener('resize', onResize);
    };
  }, [container, byId]);

  // The trigger is marked open while its tooltip shows (its description is wired from the start, StoryPanel).
  useEffect(() => {
    if (!open) return;
    open.el.classList.add('is-open');
    return () => open.el.classList.remove('is-open');
  }, [open]);

  useLayoutEffect(() => {
    const tip = tipRef.current;
    if (!open || !tip) {
      setPos(null);
      return;
    }
    const r = open.el.getBoundingClientRect();
    if (!open.el.isConnected || (r.width === 0 && r.height === 0)) {
      // A resize can hide the term (layout switch); there is nothing left to point at.
      setOpen(null);
      return;
    }
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    const left = Math.max(MARGIN, Math.min(r.left - 14, innerWidth - w - MARGIN));
    const below = r.bottom + GAP;
    const top = below + h + MARGIN > innerHeight ? Math.max(MARGIN, r.top - GAP - h) : below;
    setPos({ left, top });
  }, [open, layoutRev]);

  if (!open || typeof document === 'undefined') return null;
  const other: Lang = lang === 'en' ? 'zh-tw' : 'en';
  const { term, via } = open;
  const links = via === 'pointer' ? termLinks(term, lang) : { biography: null, glossary: null };
  return createPortal(
    <div
      id={TIP_ID}
      role="tooltip"
      class="term-tip"
      ref={tipRef}
      lang={htmlLang(lang)}
      style={{ left: `${pos?.left ?? 0}px`, top: `${pos?.top ?? 0}px`, visibility: pos ? 'visible' : 'hidden' }}
      onMouseEnter={cancelHide}
      onMouseLeave={(e) => {
        if (termOf(e.relatedTarget) !== open.el) scheduleHide(null);
      }}
    >
      <p class="term-tip-name">
        <strong lang={htmlLang(lang)}>{term.name[lang]}</strong>
        <span lang={htmlLang(other)}>{term.name[other]}</span>
      </p>
      {term.summary && <p class="term-tip-summary">{term.summary}</p>}
      {(links.biography || links.glossary) && (
        <p class="term-tip-links">
          {links.biography && <a href={links.biography}>{t(lang, 'biographyPage')}</a>}
          {links.glossary && <a href={links.glossary}>{t(lang, 'termInGlossary')}</a>}
        </p>
      )}
    </div>,
    document.body,
  );
}

function termOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? (target.closest('.term') as HTMLElement | null) : null;
}
