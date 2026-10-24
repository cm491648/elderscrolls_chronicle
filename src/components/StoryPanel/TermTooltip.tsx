import type { RefObject } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Lang, StoryTerm } from '../../lib/types';

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
}

const htmlLang = (l: Lang) => (l === 'en' ? 'en' : 'zh-Hant-TW');

/**
 * A tooltip for `.term` elements inside `container`: shows on hover, focus and tap; hides on leave, blur,
 * Esc, an outside tap, or when the story scrolls (a resize only re-places it). It is portalled to <body>,
 * outside the story's live region, and the pointer may move into it without it closing.
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
    const show = (el: HTMLElement | null) => {
      const term = el && byId.get(el.dataset.term ?? '');
      if (!el || !term) return;
      cancelHide();
      // Re-entering the same term keeps the same object, so the tooltip does not re-layout or flicker.
      setOpen((cur) => (cur && cur.el === el ? cur : { el, term }));
    };

    const onOver = (e: MouseEvent) => show(termOf(e.target));
    const onOut = (e: MouseEvent) => {
      const from = termOf(e.target);
      if (!from || termOf(e.relatedTarget) === from || inTip(e.relatedTarget)) return;
      scheduleHide(from);
    };
    const onFocusIn = (e: FocusEvent) => show(termOf(e.target));
    const onFocusOut = (e: FocusEvent) => {
      const from = termOf(e.target);
      if (!from || tipRef.current?.matches(':hover')) return;
      cancelHide();
      setOpen((cur) => (cur && cur.el === from ? null : cur));
    };
    const onClick = (e: MouseEvent) => show(termOf(e.target));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    const onDown = (e: Event) => {
      if (!termOf(e.target) && !inTip(e.target)) close();
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

  // The trigger is described by the tooltip, and marked open, only while it is open.
  useEffect(() => {
    if (!open) return;
    open.el.setAttribute('aria-describedby', TIP_ID);
    open.el.classList.add('is-open');
    return () => {
      open.el.removeAttribute('aria-describedby');
      open.el.classList.remove('is-open');
    };
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
  const { term } = open;
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
    </div>,
    document.body,
  );
}

function termOf(target: EventTarget | null): HTMLElement | null {
  return target instanceof Element ? (target.closest('.term') as HTMLElement | null) : null;
}
