import type { ComponentChildren, Ref } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { t, type UiKey } from '../../i18n';
import type { Lang } from '../../lib/types';
import { aboutUrl, biographyIndexUrl, glossaryUrl, homeUrl, topicIndexUrl } from '../../lib/paths';
import { LangSwitch } from '../LangSwitch/LangSwitch';

export const SECTIONS = ['map', 'topics', 'biographies', 'glossary', 'about'] as const;
export type Section = (typeof SECTIONS)[number];

const LABELS: Record<Section, UiKey> = {
  map: 'navMap',
  topics: 'navTopics',
  biographies: 'navBiographies',
  glossary: 'navGlossary',
  about: 'navAbout',
};

export function sectionUrl(lang: Lang, s: Section): string {
  switch (s) {
    case 'map': return homeUrl(lang);
    case 'topics': return topicIndexUrl(lang);
    case 'biographies': return biographyIndexUrl(lang);
    case 'glossary': return glossaryUrl(lang);
    case 'about': return aboutUrl(lang);
  }
}

interface Props {
  lang: Lang;
  /** The section this page belongs to: its link is marked current. */
  current: Section;
  /** This page in the other language. */
  langHref: string;
  /** The map page's only heading is the site's name; other pages have their own h1. */
  brandHeading?: boolean;
  headerRef?: Ref<HTMLElement>;
  /** Extra buttons before the language switch (the map page's search). */
  children?: ComponentChildren;
}

/**
 * The leather header on every page (decisions/redesign-design): the site's name, the five sections, the language
 * switch. Where the five links do not fit beside the rest (global.css, max-width 1023px) they fold into a menu
 * button whose list drops over the page, so the header keeps its one-row height and the map below keeps its size.
 */
export function SiteHeader({ lang, current, langHref, brandHeading = false, headerRef, children }: Props) {
  const [open, setOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      setOpen(false);
      toggleRef.current?.focus();
    };
    const onDown = (e: PointerEvent) => {
      if (!navRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('pointerdown', onDown);
    };
  }, [open]);
  const Title = brandHeading ? 'h1' : 'p';
  return (
    <header class="topbar leather on-leather orule-bottom" ref={headerRef}>
      <div class="brand">
        <Title class="site-title">
          <a href={homeUrl(lang)}>{t(lang, 'siteTitle')}</a>
        </Title>
        {t(lang, 'siteSubtitle') && (
          <span class="brand-sub" lang="en" aria-hidden="true">
            {t(lang, 'siteSubtitle')}
          </span>
        )}
      </div>
      <nav class="site-nav" aria-label={t(lang, 'siteNav')} ref={navRef}>
        <button
          type="button"
          class="nav-toggle"
          ref={toggleRef}
          aria-expanded={open}
          aria-controls="site-nav-list"
          onClick={() => setOpen((o) => !o)}
        >
          <span class="nav-toggle-icon" aria-hidden="true" />
          <span class="nav-toggle-text">{t(lang, 'menu')}</span>
        </button>
        <ul id="site-nav-list" class={open ? 'is-open' : undefined}>
          {SECTIONS.map((s) => (
            <li key={s}>
              <a href={sectionUrl(lang, s)} aria-current={s === current ? 'page' : undefined}>
                {t(lang, LABELS[s])}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <div class="topbar-tools">
        {children}
        <LangSwitch lang={lang} href={langHref} />
      </div>
    </header>
  );
}
