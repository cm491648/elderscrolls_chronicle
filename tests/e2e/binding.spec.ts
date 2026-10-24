import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

// The interface is a book (decisions/es-feel-1, es-feel-spec-2): paper pages bound in leather, light only.
test.describe('no dark mode', () => {
  test.use({ colorScheme: 'dark' });
  test('a dark system setting still gets the paper page', async ({ page }) => {
    await openApp(page, '/en/events/battle-of-red-mountain/');
    const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--page').trim());
    expect(bg).toBe('#e2dccd');
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme)).toBe('light');
  });
});

test('ornaments: the tapered gilt rule under the header, corners on the story, framed buttons', async ({ page }) => {
  await openApp(page, '/en/events/battle-of-red-mountain/');
  const pseudo = (sel: string, which: '::before' | '::after', prop: string) =>
    page.locator(sel).first().evaluate((el, [w, p]) => getComputedStyle(el, w).getPropertyValue(p), [which, prop] as const);
  expect(await pseudo('.topbar', '::before', 'clip-path')).toContain('polygon');
  expect(await pseudo('.topbar', '::after', 'transform')).not.toBe('none'); // the lozenge is a turned square
  expect(await pseudo('.story-pane', '::before', 'background-image')).toContain('svg');
  const btn = await page.locator('.story-close').evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(btn).toBe('solid'); // the faint inner rule
});

test('the header and the timeline are bound in leather; the timeline band stays light paper', async ({ page }) => {
  await openApp(page, '/zh-tw/events/battle-of-red-mountain/');
  const bgImg = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(await bgImg('.topbar')).toContain('leather');
  expect(await bgImg('.tl-wrap')).toContain('leather');
  const band = await page.locator('.tl-band').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(band).toBe('rgb(244, 239, 226)'); // --paper: flat, so the era row's SVG backing matches it
  const title = await page.locator('.topbar h1').evaluate((el) => getComputedStyle(el).color);
  expect(title).toBe('rgb(239, 226, 196)'); // --on-leather
  expect(await page.locator('.tl-band-frame').evaluate((el) => getComputedStyle(el, '::before').backgroundImage)).toContain('svg');
});

test('map, story, search panel and popups are paper pages', async ({ page }) => {
  await openApp(page, '/en/events/battle-of-red-mountain/');
  const bgImg = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).backgroundImage);
  expect(await bgImg('.map-view')).toContain('vellum');
  expect(await bgImg('.story-pane')).toContain('vellum');
  expect(await page.locator('.story-notes').evaluate((el) => getComputedStyle(el, '::before').clipPath)).toContain('polygon');
  await page.getByRole('button', { name: 'Search & filter' }).click();
  expect(await bgImg('.search-panel')).toContain('vellum');
});

test('the footer is a leather strip under a gilt rule', async ({ page }) => {
  await openApp(page, '/en/');
  const foot = page.locator('.site-footer');
  expect(await foot.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain('leather');
  expect(await foot.evaluate((el) => getComputedStyle(el, '::before').clipPath)).toContain('polygon');
});

test('the language switch is framed like the search button and lines up with it (decisions/es-feel-review)', async ({ page }) => {
  await openApp(page, '/zh-tw/events/battle-of-red-mountain/');
  const lang = page.locator('.lang-switch');
  const search = page.locator('.search-toggle');
  const [a, b] = [(await lang.boundingBox())!, (await search.boundingBox())!];
  expect(Math.abs(a.height - b.height)).toBeLessThan(1);
  expect(Math.abs(a.y - b.y)).toBeLessThan(1);
  const frame = (l: typeof lang) => l.evaluate((el) => { const c = getComputedStyle(el); return [c.borderTopStyle, c.borderTopColor, c.outlineStyle, c.backgroundColor]; });
  expect(await frame(lang)).toEqual(await frame(search));
});

test.describe('a phone-width header', () => {
  test.use({ viewport: { width: 390, height: 844 } });
  test('stays one line with both framed buttons, so the map below keeps its height', async ({ page }) => {
    await openApp(page, '/en/events/death-of-torygg/');
    const h1 = (await page.locator('.topbar h1').boundingBox())!;
    const lineHeight = await page.locator('.topbar h1').evaluate((el) => parseFloat(getComputedStyle(el).lineHeight));
    expect(h1.height).toBeLessThan(lineHeight * 1.5); // the site title did not wrap
    expect((await page.locator('.topbar').boundingBox())!.height).toBeLessThanOrEqual(56);
  });
});
