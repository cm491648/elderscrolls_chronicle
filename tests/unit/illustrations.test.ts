import { existsSync, readdirSync, statSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { ILLUSTRATION_WIDTHS, illustrationFor, plateWidths, splitStory, type IllustrationEntry } from '../../src/lib/illustrations';
import data from '../../src/content/illustrations.json';
import { webpSize } from './helpers/webp';

const entries = data as IllustrationEntry[];
const eventIds = readdirSync('src/content/events/en').map((f) => f.replace(/\.md$/, ''));

describe('splitStory', () => {
  const p = (n: number) => Array.from({ length: n }, (_, i) => `<p>p${i + 1}</p>\n`).join('');

  test('the plate goes after the middle paragraph', () => {
    expect(splitStory(p(4))).toEqual({ before: '<p>p1</p>\n<p>p2</p>', after: '\n<p>p3</p>\n<p>p4</p>\n' });
    expect(splitStory(p(5)).before).toBe('<p>p1</p>\n<p>p2</p>\n<p>p3</p>');
    expect(splitStory(p(2)).before).toBe('<p>p1</p>');
  });

  test('one paragraph: the plate follows it; none: everything stays before', () => {
    expect(splitStory(p(1))).toEqual({ before: '<p>p1</p>', after: '\n' });
    expect(splitStory('<ul><li>x</li></ul>')).toEqual({ before: '<ul><li>x</li></ul>', after: '' });
  });

  test('only top-level paragraphs count, and markup inside them stays whole', () => {
    const html = '<p>a <b class="term">b</b></p>\n<blockquote>\n<p>q1</p>\n<p>q2</p>\n</blockquote>\n<p>c</p>\n<p>d</p>\n';
    // Three top-level paragraphs (a, c, d): the cut is after the second, c.
    const { before, after } = splitStory(html);
    expect(before.endsWith('<p>c</p>')).toBe(true);
    expect(after).toBe('\n<p>d</p>\n');
    expect(before + after).toBe(html);
  });
});

describe('illustration data', () => {
  test('one plate per event, for every event', () => {
    expect(entries.map((e) => e.id).sort()).toEqual([...eventIds].sort());
  });

  test('each plate comes in 640, 960 and full width as WebP, each the width it claims, within budget', () => {
    expect(ILLUSTRATION_WIDTHS).toEqual([640, 960]);
    const budget: Record<number, number> = { 640: 120, 960: 200, 1200: 300 };
    for (const e of entries) {
      const plate = illustrationFor(e, 'en');
      expect(plate.srcset.map((s) => s.width)).toEqual([640, 960, e.width]);
      expect(plate.src).toBe(plate.srcset[0].href);
      for (const { href, width } of plate.srcset) {
        expect(existsSync(`public${href}`), href).toBe(true);
        expect(statSync(`public${href}`).size / 1024, href).toBeLessThan(budget[width]);
        const size = webpSize(`public${href}`);
        expect(size.width, href).toBe(width);
        expect(Math.abs(size.width / size.height - e.width / e.height), href).toBeLessThan(0.01);
      }
      expect(webpSize(`public${plate.srcset[2].href}`)).toEqual({ width: e.width, height: e.height });
    }
  });

  test('captions exist in both languages and say what the picture shows, not how it was made', () => {
    for (const e of entries) {
      for (const lang of ['en', 'zh-tw'] as const) {
        expect(e.caption[lang].trim().length, `${e.id} ${lang}`).toBeGreaterThan(5);
        expect(e.caption[lang]).not.toMatch(/\bAI\b|生成|Codex|prompt|提示詞/i);
      }
      expect(illustrationFor(e, 'zh-tw').caption).toBe(e.caption['zh-tw']);
    }
  });
});

describe('illustrationFor', () => {
  const entry: IllustrationEntry = { id: 'red-year', width: 1536, height: 1024, caption: { en: 'x', 'zh-tw': 'y' } };

  test('the site lists every width, smallest first', () => {
    const plate = illustrationFor(entry, 'zh-tw', null);
    expect(plate.srcset.map((s) => s.width)).toEqual([640, 960, 1536]);
    expect(plate.src).toBe('/illustrations/red-year-640.webp');
    expect(plate.caption).toBe('y');
  });

  test('the artifact build lists only the widths it ships', () => {
    const plate = illustrationFor(entry, 'en', [960]);
    expect(plate.srcset).toEqual([{ href: '/illustrations/red-year-960.webp', width: 960 }]);
    expect(plate.src).toBe('/illustrations/red-year-960.webp');
  });

  test('PUBLIC_PLATE_WIDTHS picks the widths', () => {
    expect(plateWidths(undefined)).toBeNull();
    expect(plateWidths('')).toBeNull();
    expect(plateWidths('960')).toEqual([960]);
    expect(plateWidths('640, 960')).toEqual([640, 960]);
  });
});
