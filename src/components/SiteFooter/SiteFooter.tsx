import type { Ref } from 'preact';
import { t } from '../../i18n';
import type { Lang } from '../../lib/types';
import { MAP_SOURCE } from '../../lib/map-source';
import { BEACON_TOKEN } from '../../lib/analytics';
import { aboutUrl } from '../../lib/paths';

/** The leather footer on every page: the disclaimer, where the maps come from, visit counting, and About. */
export function SiteFooter({ lang, footerRef }: { lang: Lang; footerRef?: Ref<HTMLElement> }) {
  const gap = lang === 'en' ? ' ' : '';
  return (
    <footer class="site-footer leather on-leather orule-top" ref={footerRef}>
      {t(lang, 'disclaimer')}
      {MAP_SOURCE === 'official' && (
        <>
          {gap}
          {t(lang, 'disclaimerOfficialMap')}
        </>
      )}
      {BEACON_TOKEN && (
        <>
          {gap}
          {t(lang, 'disclaimerAnalytics')}
        </>
      )}
      {gap}
      <a href={aboutUrl(lang)}>{t(lang, 'navAbout')}</a>
    </footer>
  );
}
