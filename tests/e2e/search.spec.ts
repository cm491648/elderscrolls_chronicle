import { readdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { eventTitle, openApp, storyTitle } from './helpers';

/** Side by side (desktop project) the panel sits on the map; on the phone project it covers the screen. */
const isWide = (page: Page) => page.viewportSize()!.width >= 900 && page.viewportSize()!.height >= 560;
const toggle = (page: Page) => page.locator('.topbar .search-toggle');
const panel = (page: Page) => page.getByRole('dialog', { name: /^(搜尋事件|Search events)$/ });
const field = (page: Page) => panel(page).getByRole('searchbox');
const results = (page: Page) => panel(page).locator('.search-results a');

async function openSearch(page: Page) {
  await toggle(page).click();
  await expect(field(page)).toBeFocused();
}

test('the search index loads only when the panel first opens, and only once', async ({ page }) => {
  const fetched: string[] = [];
  page.on('request', (req) => {
    if (req.url().includes('search.json')) fetched.push(new URL(req.url()).pathname);
  });
  await openApp(page, '/zh-tw/');
  await expect(toggle(page)).toHaveText('搜尋與篩選');
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'false');
  expect(fetched).toEqual([]);
  await openSearch(page);
  await expect(toggle(page)).toHaveAttribute('aria-expanded', 'true');
  await field(page).fill('奧杜因');
  await expect(results(page).first()).toBeVisible();
  await page.keyboard.press('Escape');
  await openSearch(page);
  await field(page).fill('塔洛斯');
  await expect(results(page).first()).toBeVisible();
  expect(fetched).toEqual(['/zh-tw/search.json']);
});

test('a title match comes first; a name match says which name; a story match shows the words around it', async ({ page }) => {
  await openApp(page, '/zh-tw/');
  await openSearch(page);
  // 「泰伯」 is in three Tiber Septim titles and is a person (and part of a term) other stories name: the titles first, each
  // group in timeline order.
  await field(page).fill('泰伯');
  const tiber = ['tiber-septim-crowned', 'tamriel-unified-by-numidium', 'talos-ascends', 'battle-of-sancre-tor', 'battle-of-hunding-bay', 'stros-mkai-uprising', 'failed-invasion-of-akavir', 'gortwog-founds-nova-orsinium', 'warp-in-the-west'];
  await expect(results(page).locator('.hit-title')).toHaveText(tiber.map((id) => eventTitle('zh-tw', id)));
  await expect(results(page).nth(tiber.indexOf('warp-in-the-west')).locator('.hit-where')).toContainText('提到：泰伯');

  // Talos is a marked term in these stories, never in their titles.
  await field(page).fill('塔洛斯');
  await expect(results(page).first().locator('.hit-where')).toContainText('提到：塔洛斯');

  // A plain word from a story body (not a title, person or term): highlighted in a snippet.
  await field(page).fill('割讓');
  // Both treaty stories use it; story matches keep timeline order.
  const hits = results(page).filter({ has: page.locator('mark') });
  await expect(hits.locator('mark')).toHaveText(['割讓', '割讓']);
  await expect(hits.locator('.hit-title')).toHaveText([eventTitle('zh-tw', 'great-war'), eventTitle('zh-tw', 'white-gold-concordat')]);
});

test('English pages find events by their English names too, whatever the case', async ({ page }) => {
  await openApp(page, '/en/');
  await openSearch(page);
  await field(page).fill('ALDUIN');
  await expect(results(page).first().locator('.hit-title')).toHaveText(eventTitle('en', 'return-of-alduin'));
  await field(page).fill('zzqx');
  await expect(panel(page).getByText('No events match.')).toBeVisible();
  await expect(results(page)).toHaveCount(0);
});

test('choosing a result opens that event; the phone panel gives way to the story', async ({ page }) => {
  await openApp(page, '/zh-tw/');
  await openSearch(page);
  const title = eventTitle('zh-tw', 'great-war');
  await field(page).fill(title);
  await results(page).first().click();
  await expect(page).toHaveURL(/\/zh-tw\/events\/great-war\//);
  await expect(storyTitle(page)).toHaveText(title);
  if (isWide(page)) {
    // Side by side the panel stays, so the reader can try the next result.
    await expect(panel(page)).toBeVisible();
  } else {
    await expect(panel(page)).toHaveCount(0);
    await expect(storyTitle(page)).toBeFocused();
    // The focus already reads the title out: the announcement region stays quiet.
    await expect(page.locator('[data-story-announce]')).toHaveText('');
  }
});

test('Escape closes the panel and gives the focus back to its button; arrow keys in it never change the event', async ({ page }) => {
  await openApp(page, '/en/events/great-war/');
  await openSearch(page);
  await field(page).fill('war');
  await results(page).first().focus();
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowLeft');
  await expect(page).toHaveURL(/\/en\/events\/great-war\//);
  await page.keyboard.press('Escape');
  await expect(panel(page)).toHaveCount(0);
  await expect(toggle(page)).toBeFocused();
});

test('on the phone the panel covers the screen and keeps Tab inside it', async ({ page }) => {
  test.skip(isWide(page), 'narrow screens only');
  await openApp(page, '/en/');
  await openSearch(page);
  await expect(panel(page)).toHaveAttribute('aria-modal', 'true');
  const box = (await panel(page).boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(page.viewportSize()!.width - 1);
  await field(page).fill('alduin');
  await expect(results(page).first()).toBeVisible();
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    expect(await panel(page).evaluate((p) => p.contains(document.activeElement))).toBe(true);
  }
});

test('side by side the panel sits on the map and leaves the timeline usable', async ({ page }) => {
  test.skip(!isWide(page), 'wide screens only');
  await openApp(page, '/en/');
  await openSearch(page);
  await expect(panel(page)).toHaveAttribute('aria-modal', 'false');
  const p = (await panel(page).boundingBox())!;
  const map = (await page.locator('.map-wrap').boundingBox())!;
  expect(p.x).toBeGreaterThanOrEqual(map.x);
  expect(p.y).toBeGreaterThanOrEqual(map.y);
  expect(p.y + p.height).toBeLessThanOrEqual(map.y + map.height + 1);
  await page.getByRole('button', { name: 'Next event' }).click();
  await expect(storyTitle(page)).toBeVisible();
  await expect(panel(page)).toBeVisible();
});

test('a failed index load says so and offers a retry that works', async ({ page }) => {
  let fail = true;
  await page.route('**/search.json', (route) => (fail ? route.fulfill({ status: 500, body: '' }) : route.continue()));
  await openApp(page, '/en/');
  await openSearch(page);
  await expect(panel(page).getByRole('alert')).toHaveText('Could not load the search.');
  fail = false;
  await panel(page).getByRole('button', { name: 'Retry' }).click();
  await field(page).fill('alduin');
  await expect(results(page).first()).toBeVisible();
});

test('the result count is read out once the typing pauses, also when it repeats', async ({ page }) => {
  await openApp(page, '/zh-tw/');
  await openSearch(page);
  const live = panel(page).locator('[aria-live="polite"]');
  await field(page).fill('塔洛斯');
  // count() does not wait: before the index has loaded it would read 0 while the page goes on to find 8.
  await expect(results(page).first()).toBeVisible();
  const n = await results(page).count();
  await expect(live).toHaveText(`找到 ${n} 則`);
  await field(page).fill('塔洛斯 ');
  await expect(live).toHaveText('');
  await expect(live).toHaveText(`找到 ${n} 則`);
  await field(page).fill('zzqx');
  await expect(live).toHaveText('找不到符合的事件。');
});

test('on the phone, choosing the story already open still hands it the focus', async ({ page }) => {
  test.skip(isWide(page), 'narrow screens only');
  await openApp(page, '/zh-tw/events/great-war/');
  await openSearch(page);
  await field(page).fill(eventTitle('zh-tw', 'great-war'));
  await results(page).first().click();
  await expect(panel(page)).toHaveCount(0);
  await expect(storyTitle(page)).toBeFocused();
});

test('side by side the map keeps its layer path and its popup clear of the panel', async ({ page }) => {
  test.skip(!isWide(page), 'wide screens only');
  await openApp(page, '/en/');
  await openSearch(page);
  const p = (await panel(page).boundingBox())!;
  const nav = (await page.locator('.map-nav').boundingBox())!;
  expect(nav.y + nav.height).toBeLessThanOrEqual(p.y);
  // From the keyboard: the marker may sit under the panel, which is what the popup must move away from.
  await page.locator('.map-marker:not(.map-marker-group)').first().focus();
  await page.keyboard.press('Enter');
  const popup = page.locator('.map-popup');
  await expect(popup).toBeVisible();
  const b = (await popup.boundingBox())!;
  expect(b.x >= p.x + p.width || b.x + b.width <= p.x).toBe(true);
});

test('the panel offers the seven categories and nothing else; nothing is dimmed until one is ticked', async ({ page }) => {
  await openApp(page, '/en/');
  await expect(toggle(page)).toHaveText('Search & filter');
  await openSearch(page);
  const groups = panel(page).locator('.filter-group');
  await expect(groups).toHaveCount(1);
  await expect(groups.locator('legend')).toHaveText('Categories');
  await expect(groups.getByRole('checkbox')).toHaveCount(7);
  await expect(panel(page).getByRole('checkbox')).toHaveCount(7);
  await expect(page.locator('.is-dimmed')).toHaveCount(0);
});

/** A list field of an event, from its content file. */
function listOf(id: string, key: string) {
  const fm = readFileSync(`src/content/events/en/${id}.md`, 'utf-8').split('---')[1];
  return /^\w+:\s*\[(.*)\]$/m.exec(fm.split('\n').find((l) => l.startsWith(`${key}:`)) ?? '')?.[1].split(',').map((x) => x.trim()) ?? [];
}
const categoriesOf = (id: string) => listOf(id, 'categories');
const eventIds = readdirSync('src/content/events/en').map((f) => f.replace(/\.md$/, ''));
/** The events at a place, as the map's popup lists them. */
const eventsAt = (place: string) => eventIds.filter((id) => listOf(id, 'locations').includes(place));
/** The filter in the test below: war or religion. */
const keeps = (id: string) => categoriesOf(id).some((c) => c === 'war' || c === 'religion');

test('any ticked category matches: the rest dims, the arrows skip it, search marks it, the filter stays and clears', async ({ page }, info) => {
  test.skip(!isWide(page), 'the arrow keys step on wide screens; the phone test above covers the panel');
  await openApp(page, '/zh-tw/events/death-of-torygg/');
  await openSearch(page);
  await panel(page).getByRole('checkbox', { name: '戰爭', exact: true }).check();
  await panel(page).getByRole('checkbox', { name: '宗教', exact: true }).check();
  await expect(toggle(page)).toContainText('2');
  // Creation of Mundus is neither war nor religion: dimmed on the timeline.
  await expect(page.locator('.tl-dot.is-dimmed, .tl-cluster.is-dimmed').first()).toBeAttached();
  const dimmedIds = await page.locator('.tl-dot.is-dimmed').evaluateAll((els) => els.flatMap((e) => (e.getAttribute('data-ids') ?? '').split(' ')));
  for (const id of dimmedIds.filter(Boolean)) expect(keeps(id), id).toBe(false);
  // And on the map (Skyrim, around Torygg's death): a place dims when the filter leaves out every event there.
  const places = page.locator('.map-marker[data-place]');
  await expect(places.first()).toBeAttached();
  const marks = await places.evaluateAll((els) => els.map((e) => [e.getAttribute('data-place')!, e.classList.contains('is-dimmed')] as const));
  for (const [place, dim] of marks) {
    const here = eventsAt(place);
    expect(dim, place).toBe(here.length > 0 && !here.some(keeps));
  }
  expect(marks.map(([, dim]) => dim), 'both kinds of place').toContain(true);
  expect(marks.map(([, dim]) => dim), 'both kinds of place').toContain(false);
  // Search still lists every hit; the ones the filter leaves out say so.
  await field(page).fill('諾德');
  const rows = panel(page).locator('.search-results li');
  await expect(rows.first()).toBeVisible();
  const kept: boolean[] = [];
  for (const row of await rows.all()) {
    const id = /events\/([^/]+)\//.exec((await row.locator('a').getAttribute('href'))!)![1];
    kept.push(keeps(id));
    await expect(row.locator('.hit-filtered'), id).toHaveCount(keeps(id) ? 0 : 1);
  }
  expect(kept, 'both kinds of hit').toContain(true);
  expect(kept, 'both kinds of hit').toContain(false);
  await expect(rows.locator('.hit-filtered').first()).toHaveText('。已被篩選'); // the separator is for screen readers only
  await field(page).fill('');
  await page.keyboard.press('Escape');
  // ← from Torygg's death lands only on events the filter keeps.
  for (let k = 0; k < 2; k++) {
    const before = page.url();
    await page.keyboard.press('ArrowLeft');
    await expect.poll(() => page.url()).not.toBe(before);
    const id = /events\/([^/]+)\//.exec(page.url())![1];
    // The story has switched before the next step.
    const zh = /^title:\s*(.*)$/m.exec(readFileSync(`src/content/events/zh-tw/${id}.md`, 'utf-8'))![1].trim();
    await expect(page.locator('.story h2')).toHaveText(zh);
    expect(keeps(id), id).toBe(true);
  }
  // Kept on this device.
  await page.reload();
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await expect(toggle(page)).toContainText('2');
  await expect(page.locator('.tl-dot.is-dimmed').first()).toBeAttached();
  // Cleared, everything is back.
  await openSearch(page);
  await panel(page).getByRole('button', { name: '清除篩選' }).click();
  await expect(page.locator('.is-dimmed')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
  await expect(page.locator('.is-dimmed')).toHaveCount(0);
  void info;
});

test('on the phone the page under the panel is out of reach until it closes', async ({ page }) => {
  test.skip(isWide(page), 'narrow screens only');
  await openApp(page, '/en/events/great-war/');
  await openSearch(page);
  for (const sel of ['.topbar', '.sticky-head', '.story-col']) await expect(page.locator(sel)).toHaveJSProperty('inert', true);
  await page.keyboard.press('Escape');
  for (const sel of ['.topbar', '.sticky-head', '.story-col']) await expect(page.locator(sel)).toHaveJSProperty('inert', false);
  await expect(toggle(page)).toBeFocused();
});

test('on a cramped map beside a story, the map popup still sits on top of the panel', async ({ page }) => {
  test.skip(!isWide(page), 'wide screens only');
  await page.setViewportSize({ width: 960, height: 720 });
  await openApp(page, '/en/events/great-war/');
  await openSearch(page);
  await page.locator('.map-marker:not(.map-marker-group)').first().focus();
  await page.keyboard.press('Enter');
  const popup = page.locator('.map-popup');
  await expect(popup).toBeVisible();
  const b = (await popup.boundingBox())!;
  const top = await page.evaluate(([x, y]) => !!document.elementFromPoint(x, y)?.closest('.map-popup'), [b.x + b.width / 2, b.y + 12]);
  expect(top).toBe(true);
});
