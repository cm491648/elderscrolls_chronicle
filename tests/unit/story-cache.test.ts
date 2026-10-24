import { describe, expect, test, vi } from 'vitest';
import { REQUEST_TIMEOUT_MS, loadStory, seedStory, storiesBilingual, storyUrl } from '../../src/lib/story-cache';

const story = (id: string) => ({ id, illustration: null, html: `<p>${id}</p>`, notesHtml: null, terms: [], sources: [] });
const ok = (body: unknown) => Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));

describe('story cache', () => {
  test('builds the JSON address under the language', () => {
    expect(storyUrl('zh-tw', 'great-war')).toMatch(/\/zh-tw\/stories\/great-war\.json$/);
  });
  test('a seeded story never fetches', async () => {
    const fetcher = vi.fn();
    seedStory('en', story('seeded'));
    expect((await loadStory('en', 'seeded', fetcher)).html).toBe('<p>seeded</p>');
    expect(fetcher).not.toHaveBeenCalled();
  });
  test('two requests for one story share one fetch', async () => {
    const fetcher = vi.fn(() => ok(story('a')));
    const [x, y] = await Promise.all([loadStory('en', 'a', fetcher), loadStory('en', 'a', fetcher)]);
    expect(x).toBe(y);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  test('a failed load can be retried', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockImplementationOnce(() => ok(story('b')));
    await expect(loadStory('en', 'b', fetcher)).rejects.toThrow('story b: HTTP 500');
    expect((await loadStory('en', 'b', fetcher)).id).toBe('b');
  });
  test('the cache is per language', async () => {
    const fetcher = vi.fn(() => ok(story('c')));
    await loadStory('en', 'c', fetcher);
    await loadStory('zh-tw', 'c', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  test('each request carries a time limit, so a hung one fails and offers the retry', async () => {
    const fetcher = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) => ok(story('d')));
    await loadStory('en', 'd', fetcher);
    const signal = fetcher.mock.calls[0][1]?.signal;
    expect(signal).toBeInstanceOf(AbortSignal);
    expect(signal!.aborted).toBe(false);
    expect(REQUEST_TIMEOUT_MS).toBeGreaterThanOrEqual(10000);
  });
});

describe('bilingual story files (the artifact build)', () => {
  test('one file per event holds both languages, and each page takes its own', async () => {
    const fetcher = vi.fn((_url: RequestInfo | URL) => ok({ en: story('e'), 'zh-tw': { ...story('e'), html: '<p>中</p>' } }));
    expect(storyUrl('zh-tw', 'e', true)).toMatch(/\/stories\/e\.json$/);
    expect(storyUrl('zh-tw', 'e', true)).not.toMatch(/zh-tw/);
    expect((await loadStory('zh-tw', 'e', fetcher, true)).html).toBe('<p>中</p>');
    expect(String(fetcher.mock.calls[0][0])).toMatch(/\/stories\/e\.json$/);
    expect(String(fetcher.mock.calls[0][0])).not.toMatch(/zh-tw/);
  });
  test('PUBLIC_STORIES_BILINGUAL turns it on; the site keeps one file per language', () => {
    expect(storiesBilingual(undefined)).toBe(false);
    expect(storiesBilingual('1')).toBe(true);
    expect(storyUrl('en', 'f')).toMatch(/\/en\/stories\/f\.json$/);
  });
});
