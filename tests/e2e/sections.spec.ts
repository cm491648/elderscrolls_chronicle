import { readdirSync, readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { eventTitle, openApp, readJson, storyTitle, waitForStill } from './helpers';

const NAV = { zh: '網站導覽', en: 'Site sections' };

/** The site navigation; on narrow screens its menu is opened first, as a reader would. */
async function nav(page: Page, name: string) {
  const region = page.getByRole('navigation', { name });
  const toggle = region.locator('.nav-toggle');
  if (await toggle.isVisible()) {
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
  }
  return region;
}

const CURRENT: [string, string][] = [
  ['/zh-tw/', '地圖與時間軸'],
  ['/zh-tw/events/great-war/', '地圖與時間軸'],
  ['/zh-tw/topics/', '專題'],
  ['/zh-tw/topics/great-war/', '專題'],
  ['/zh-tw/biographies/', '人物'],
  ['/zh-tw/biographies/tiber-septim/', '人物'],
  ['/zh-tw/glossary/', '用語表'],
  ['/zh-tw/about/', '關於本站'],
];

for (const [path, label] of CURRENT) {
  test(`${path} marks "${label}" as the current section`, async ({ page }) => {
    await openApp(page, path);
    const region = await nav(page, NAV.zh);
    await expect(region.locator('a[aria-current="page"]')).toHaveText(label);
    await expect(region.getByRole('link')).toHaveCount(5);
  });
}

test('the menu closes on Escape and gives the focus back to its button', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'the menu button only shows on narrow screens');
  await openApp(page, '/zh-tw/');
  const toggle = page.locator('.nav-toggle');
  const before = (await page.locator('.topbar').boundingBox())!.height;
  await toggle.click();
  await expect(page.locator('#site-nav-list')).toBeVisible();
  expect((await page.locator('.topbar').boundingBox())!.height).toBe(before);
  await page.keyboard.press('Escape');
  await expect(page.locator('#site-nav-list')).toBeHidden();
  await expect(toggle).toBeFocused();
});

test('switching language stays on the same page', async ({ page }) => {
  await openApp(page, '/zh-tw/biographies/tiber-septim/');
  await page.locator('.lang-switch').click();
  await expect(page).toHaveURL(/\/en\/biographies\/tiber-septim\/$/);
  await expect(page.locator('h1')).toHaveText('Tiber Septim');
});

test('a person page lists their events and opens them', async ({ page }) => {
  await openApp(page, '/zh-tw/biographies/tiber-septim/');
  const crowned = eventTitle('zh-tw', 'tiber-septim-crowned');
  await page.getByRole('link', { name: crowned, exact: true }).click();
  await expect(page).toHaveURL(/\/zh-tw\/events\/tiber-septim-crowned\/$/);
  await expect(storyTitle(page)).toHaveText(crowned);
});

test('a planned biography says it is being written', async ({ page }) => {
  await openApp(page, '/zh-tw/biographies/tiber-septim/');
  await expect(page.locator('.wip')).toContainText('施工中');
});

test('only people with a biography have a page; the index sends everyone else to the glossary', async ({ page, request }) => {
  expect((await request.get('/zh-tw/biographies/lorkhan/')).status()).toBe(404);
  await openApp(page, '/zh-tw/biographies/');
  await expect(page.locator('#people-list > li')).toHaveCount(readdirSync('src/content/biographies/en').length);
  await page.getByRole('link', { name: '其他人物請見用語表。' }).click();
  await expect(page).toHaveURL(/\/zh-tw\/glossary\/$/);
});

test('the biographies index: a row a person, in the order they take the stage, each opening their biography', async ({ page }) => {
  await openApp(page, '/zh-tw/biographies/');
  const rows = page.locator('#people-list > li');
  const order = await rows.evaluateAll((lis) => lis.map((li) => li.getAttribute('data-person')!));
  expect([...order].sort()).toEqual(readdirSync('src/content/biographies/en').map((f) => f.replace(/\.md$/, '')).sort());
  // Ysgramor (Merethic Era) → Nerevar (1E 700) → Tiber Septim (2E) → Uriel VII (3E) → Titus Mede II (4E).
  const chain = ['ysgramor', 'nerevar', 'tiber-septim', 'uriel-septim-vii', 'titus-mede-ii'].map((id) => order.indexOf(id));
  expect(chain).toEqual([...chain].sort((a, b) => a - b));
  for (const id of order) {
    await expect(page.locator(`[data-person="${id}"] h2 a`)).toHaveAttribute('href', `/zh-tw/biographies/${id}/`);
  }
  // Name, English name, events, state and summary beside a decorative portrait; no era headings, no search.
  const row = page.locator('[data-person="tiber-septim"]');
  await expect(row.locator('.section-en')).toHaveText('Tiber Septim');
  await expect(row.locator('.meta-line')).toContainText(/則事件.*施工中/);
  await expect(row.locator('.meta-line')).not.toContainText('紀元'); // no years (decisions/sections-round4)
  await expect(row.locator('.portrait')).toHaveAttribute('aria-hidden', 'true');
  await expect(page.locator('.section-main h2')).toHaveCount(order.length);
  await expect(page.getByRole('searchbox')).toHaveCount(0);
  // The whole row opens the biography: the name's link stretches over it.
  await row.locator('.portrait').click({ force: true });
  await expect(page).toHaveURL(/\/zh-tw\/biographies\/tiber-septim\/$/);
});

test('a planned topic lists its events in timeline order', async ({ page }) => {
  await openApp(page, '/zh-tw/topics/great-war/');
  await expect(page.locator('.wip')).toContainText('施工中');
  const listed = readFileSync('src/content/topics/en/great-war.md', 'utf-8').match(/^events: \[(.*)\]$/m)![1].split(', ');
  await expect(page.locator('.event-list li')).toHaveCount(listed.length);
  await expect(page.locator('.event-list li a').first()).toHaveText(eventTitle('zh-tw', 'great-war'));
});

const topicIds = () => readdirSync('src/content/topics/en').map((f) => f.replace(/\.md$/, ''));

test('both topics indexes are the covers alone: a row a topic, each opening it; no shelf, no view buttons, no view script', async ({ page, request }) => {
  for (const lang of ['zh-tw', 'en']) {
    await openApp(page, `/${lang}/topics/`);
    const rows = page.locator('.cover-list > li');
    await expect(rows).toHaveCount(topicIds().length);
    const listed = await rows.evaluateAll((lis) => lis.map((li) => li.getAttribute('data-topic')!));
    expect([...listed].sort(), lang).toEqual(topicIds().sort());
    for (const id of listed) {
      await expect(page.locator(`[data-topic="${id}"] h2 a`)).toHaveAttribute('href', `/${lang}/topics/${id}/`);
    }
    await expect(page.locator('.bookcase, a[data-book], .view-toggle, #topic-views')).toHaveCount(0);
    await expect(page.locator('.section-main button')).toHaveCount(0);
    const html = await (await request.get(`/${lang}/topics/`)).text();
    expect(html).not.toContain('chronicle.topicsView');
    expect(html).not.toContain('<script type="module"');
  }
  // Clicking the cover opens its topic: the title's link stretches over the whole row (so the click lands on it).
  await page.locator('.cover-row').first().locator('.cover').click({ force: true });
  await expect(page).toHaveURL(/\/en\/topics\/[a-z-]+\/$/);
});

test('the keyboard reaches every topic in the covers list and opens it', async ({ page }) => {
  await openApp(page, '/zh-tw/topics/');
  const links = page.locator('.cover-list h2 a');
  const count = await links.count();
  expect(count).toBe(topicIds().length);
  // Start from the heading, just before the list.
  await page.locator('.section-main h1').evaluate((h) => {
    h.tabIndex = -1;
    h.focus();
  });
  for (let i = 0; i < count; i++) {
    await page.keyboard.press('Tab');
    await expect(links.nth(i)).toBeFocused();
  }
  const last = links.nth(count - 1);
  const id = (await last.locator('xpath=ancestor::li').getAttribute('data-topic'))!;
  const title = readFileSync(`src/content/topics/zh-tw/${id}.md`, 'utf-8').match(/^title: "(.*)"$/m)![1];
  await expect(last).toHaveAccessibleName(title);
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(new RegExp(`/zh-tw/topics/${id}/$`));
});

test('neither topics index shows the intro line (it stays the page description)', async ({ page }) => {
  const intro = { 'zh-tw': '把幾則相關事件串成一個較長的故事。', en: readJson<Record<string, string>>('src/i18n/en.json').topicsIntro };
  for (const lang of ['zh-tw', 'en'] as const) {
    await openApp(page, `/${lang}/topics/`);
    await expect(page.locator('.section-main .section-lede')).toHaveCount(0);
    await expect(page.getByText(intro[lang])).toHaveCount(0);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', intro[lang]);
  }
});

test('the topics and biographies indexes never scroll sideways, in either language', async ({ page }) => {
  for (const path of ['/zh-tw/topics/', '/en/topics/', '/zh-tw/biographies/', '/en/biographies/']) {
    await openApp(page, path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth), path).toBeLessThanOrEqual(0);
  }
});

test('topics sit where their story ends: by last event, as the story lists them', async ({ page }) => {
  for (const path of ['/en/topics/', '/zh-tw/topics/']) {
    await openApp(page, path);
    const order = await page.locator('.cover-list > li').evaluateAll((lis) => lis.map((li) => li.getAttribute('data-topic')));
    // The Rise and Fall of the Tribunal starts in the Merethic Era but ends in the Fourth, after the Third Empire.
    expect(order.indexOf('tribunal'), path).toBeGreaterThan(order.indexOf('third-empire'));
  }
});

test('a glossary anchor scrolls to its term, and the search narrows the list', async ({ page }) => {
  await openApp(page, '/zh-tw/glossary/#thalmor');
  await expect(page.locator('#thalmor')).toBeInViewport();
  const field = page.getByRole('searchbox', { name: '搜尋用語（中文或英文）' });
  await field.fill('thalmor');
  await expect(page.locator('#thalmor')).toBeVisible();
  await expect(page.locator('#mundus')).toBeHidden();
  await expect(page.locator('.filter-status')).toHaveText(/顯示 \d+ 項/);
  await field.fill('');
  await expect(page.locator('#mundus')).toBeVisible();
});

test('a gilt rule between the glossary categories, none above the first one shown', async ({ page }) => {
  await openApp(page, '/zh-tw/glossary/');
  const rules = () =>
    page.locator('#glossary-list > [data-filter-group]:visible').evaluateAll((els) => els.map((el) => getComputedStyle(el).borderTopWidth));
  const all = await rules();
  expect(all.length).toBeGreaterThan(1);
  expect(all[0]).toBe('0px');
  for (const w of all.slice(1)) expect(w).toBe('1px');
  // The search hides whole categories; the first one still shown has no rule above it.
  await page.getByRole('searchbox', { name: '搜尋用語（中文或英文）' }).fill('thalmor');
  await expect(page.locator('#mundus')).toBeHidden();
  const shown = await rules();
  expect(shown[0]).toBe('0px');
  for (const w of shown.slice(1)) expect(w).toBe('1px');
});

test('the story links its people, its topics and its terms', async ({ page }) => {
  await openApp(page, '/zh-tw/events/great-war/');
  const story = page.locator('.story');
  await expect(story.getByRole('link', { name: '提圖斯·邁德二世' })).toHaveAttribute('href', /\/zh-tw\/biographies\/titus-mede-ii\/$/);
  await expect(story.locator('.story-topics a').first()).toHaveAttribute('href', /\/zh-tw\/topics\/great-war\/$/);
  const term = story.locator('.term[data-term="thalmor"]').first();
  // On a narrow screen the page scrolls the story to its opening by itself and folds the map once it is read past; the
  // tooltip closes on any scroll, and a hover is not repeated while the pointer has not moved. So bring the term into
  // view, let the page come to rest, and only then hover.
  await term.scrollIntoViewIfNeeded();
  await waitForStill(term);
  // Retried as a whole, the pointer moved away first so each attempt is a fresh mouseover.
  await expect(async () => {
    await page.mouse.move(0, 0);
    await term.hover();
    await expect(page.locator('.term-tip-links a')).toHaveAttribute('href', /\/zh-tw\/glossary\/#thalmor$/, { timeout: 1500 });
  }).toPass({ timeout: 10_000 });
});

test('a person with no biography links to the glossary, one with a biography to it', async ({ page }) => {
  const people = readJson<{ id: string; name: Record<string, string> }[]>('src/content/people.json');
  const name = (id: string) => people.find((p) => p.id === id)!.name['zh-tw'];
  await openApp(page, '/zh-tw/events/battle-of-red-mountain/');
  const story = page.locator('.story');
  await expect(story.getByRole('link', { name: name('kagrenac'), exact: true })).toHaveAttribute('href', /\/zh-tw\/glossary\/#kagrenac$/);
  await expect(story.getByRole('link', { name: name('nerevar'), exact: true })).toHaveAttribute('href', /\/zh-tw\/biographies\/nerevar\/$/);
  await openApp(page, '/zh-tw/glossary/#kagrenac');
  await expect(page.locator('#kagrenac')).toBeInViewport();
  await expect(page.locator('#kagrenac').getByRole('link', { name: '傳記' })).toHaveCount(0);
  await expect(page.locator('#nerevar').getByRole('link', { name: '傳記' })).toHaveAttribute('href', /\/zh-tw\/biographies\/nerevar\/$/);
});

test('Enter on a focused person term opens their page', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'keyboard');
  await openApp(page, '/en/events/great-war/');
  await page.locator('.story .term[data-term="titus-mede-ii"]').first().focus();
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/en\/biographies\/titus-mede-ii\/$/);
});

test('every topic and everyone with a biography has a page, and the glossary has every person', async ({ page, request }, info) => {
  test.skip(info.project.name !== 'desktop', 'the same files on both projects');
  const topics = readdirSync('src/content/topics/en').map((f) => f.replace(/\.md$/, ''));
  for (const id of topics) expect((await request.get(`/en/topics/${id}/`)).ok(), id).toBe(true);
  const bios = readdirSync('src/content/biographies/en').map((f) => f.replace(/\.md$/, ''));
  for (const id of bios) expect((await request.get(`/zh-tw/biographies/${id}/`)).ok(), id).toBe(true);
  const people = readJson<{ id: string }[]>('src/content/people.json').map((p) => p.id);
  await openApp(page, '/en/glossary/');
  const anchors = new Set(await page.locator('.term-entry').evaluateAll((els) => els.map((e) => e.id)));
  expect(people.length).toBeGreaterThan(100);
  expect(people.filter((id) => !anchors.has(id))).toEqual([]);
});
