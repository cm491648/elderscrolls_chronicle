import type { Lang } from '../../lib/types';
import { t } from '../../i18n';

/** A link to the same page in the other language; the caller knows which page that is. */
export function LangSwitch({ lang, href }: { lang: Lang; href: string }) {
  const other: Lang = lang === 'en' ? 'zh-tw' : 'en';
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
