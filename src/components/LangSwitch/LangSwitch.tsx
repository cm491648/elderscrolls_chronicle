import { eventUrl, homeUrl } from '../../lib/paths';
import type { Lang } from '../../lib/types';
import { t } from '../../i18n';

export function LangSwitch({ lang, eventId }: { lang: Lang; eventId: string | null }) {
  const other: Lang = lang === 'en' ? 'zh-tw' : 'en';
  const href = eventId ? eventUrl(other, eventId) : homeUrl(other);
  const otherHtml = other === 'zh-tw' ? 'zh-Hant-TW' : 'en';
  // The accessible name starts with the visible words (the other language's name, in that language), then says what
  // the link does: "中文 Switch language" (axe: label-content-name-mismatch).
  return (
    <a class="lang-switch" href={href} hreflang={otherHtml}>
      <span lang={otherHtml}>{t(lang, 'switchLangText')}</span>
      <span class="sr-only"> {t(lang, 'switchLang')}</span>
    </a>
  );
}
