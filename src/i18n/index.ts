import en from './en.json';
import zhTw from './zh-tw.json';
import type { Lang } from '../lib/types';

export type UiKey = keyof typeof en;

const dict: Record<Lang, Record<UiKey, string>> = { en, 'zh-tw': zhTw };

export function t(lang: Lang, key: UiKey, vars: Record<string, string | number> = {}): string {
  return dict[lang][key].replace(/\{(\w+)\}/g, (_, name: string) => String(vars[name] ?? `{${name}}`));
}
