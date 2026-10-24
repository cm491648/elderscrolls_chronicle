import { expect, test, type Page } from '@playwright/test';
import { eventTitle, openApp, revealTimelineDot, waitForTimelineSettled } from './helpers';

/** The lanes on screen, top to bottom, by id. */
const laneIds = (page: Page) => page.locator('.tl-name').evaluateAll((els) => els.map((e) => e.getAttribute('data-lane')));

test.describe('region lanes', () => {
  test('opens with the top lanes; Tamriel opens into the provinces that have events, and stays open', async ({ page }) => {
    await openApp(page, '/en/');
    expect(await laneIds(page)).toEqual(['realms', 'atmora', 'akavir', 'yokuda', 'tamriel']);
    const toggle = page.locator('.tl-expand');
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    const open = await laneIds(page);
    expect(open.slice(0, 5)).toEqual(['realms', 'atmora', 'akavir', 'yokuda', 'tamriel']);
    expect(open).toContain('skyrim');
    expect(open).toContain('elsweyr');
    // Only provinces that have events: no empty lane.
    for (const lane of open) expect(await page.locator(`.tl-svg [data-lane="${lane}"][data-ids]`).count(), String(lane)).toBeGreaterThan(0);
    await page.reload();
    await expect(page.locator('.tl-expand')).toHaveAttribute('aria-expanded', 'true');
    await page.locator('.tl-expand').click();
  });

  test('an event in several regions has a dot on each of their lanes, joined while selected', async ({ page }) => {
    const id = 'war-of-the-red-diamond';
    const title = eventTitle('en', id);
    await openApp(page, `/en/events/${id}/`);
    await page.locator('.tl-expand').click();
    await revealTimelineDot(page, title);
    for (const lane of ['high-rock', 'skyrim', 'hammerfell'])
      await expect(page.locator(`.tl-svg [data-lane="${lane}"][data-ids*="${id}"]`).first()).toBeAttached();
    await expect(page.locator('.tl-link')).toHaveCount(1);
    // Screen readers meet the event once.
    await expect(page.locator('.timeline').getByRole('button', { name: title, exact: true })).toHaveCount(1);
    await page.locator('.tl-expand').click();
  });

  test('an event in Oblivion and on Nirn is on both lanes, while the map keeps to its places', async ({ page }) => {
    const id = 'soulburst';
    await openApp(page, `/en/events/${id}/`);
    for (const lane of ['realms', 'tamriel'])
      await expect(page.locator(`.tl-svg [data-lane="${lane}"][data-ids*="${id}"]`).first()).toBeAttached();
    await revealTimelineDot(page, eventTitle('en', id));
    await expect(page.locator('.tl-link')).toHaveCount(1);
    await expect(page.locator('.map-path [aria-current]')).toHaveText('Cyrodiil');
  });

  test('zoomed in all the way, events of one year stay one mark that opens a list to choose from', async ({ page }) => {
    // decisions/p3-same-year: 3E 427 has three events; they must not look like three different years.
    const ids = ['nerevarine-defeats-dagoth-ur', 'almalexia-murders-sotha-sil', 'bloodmoon-prophecy'];
    const titles = ids.map((id) => eventTitle('en', id));
    await openApp(page, '/en/events/bloodmoon-prophecy/');
    await revealTimelineDot(page, titles[2]);
    const mark = page.locator(`.tl-cluster[role="button"][data-pick][aria-label*="${titles[2]}"]`);
    await expect(mark).toHaveCount(1);
    await expect(mark).toHaveAttribute('aria-label', /same year/);
    await expect(mark).toHaveAttribute('aria-expanded', 'true');
    await expect(mark.locator('text')).toHaveText('3');
    await expect(page.locator('.tl-year.is-selected')).toHaveText('3E 427');
    // The list: every event of that year, the selected one marked, each described by the year.
    const list = page.locator('.tl-pick');
    for (const title of titles) {
      const entry = list.getByRole('button', { name: title, exact: true });
      await expect(entry).toBeVisible();
      await expect(entry).toHaveAccessibleDescription('3E 427');
    }
    await expect(list.getByRole('button', { name: titles[2], exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(list.getByRole('button').first()).toBeFocused();
    // Choosing one selects it and closes the list.
    await list.getByRole('button', { name: titles[1], exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/en/events/${ids[1]}/$`));
    await expect(list).toHaveCount(0);
    // Escape closes it again and gives the focus back to the mark.
    await mark.click();
    await expect(list).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    await expect(mark).toBeFocused();
  });

  test('an event that lasted is drawn as a bar once zoomed in far enough', async ({ page }) => {
    await openApp(page, '/en/events/great-war/');
    const zoomIn = page.locator('.timeline').getByRole('button', { name: 'Zoom in', exact: true });
    for (let i = 0; i < 10 && (await zoomIn.isEnabled()); i++) {
      await zoomIn.click();
      await waitForTimelineSettled(page);
    }
    const bar = page.locator('.tl-span.is-selected .tl-bar').first();
    await expect(bar).toBeVisible();
    expect((await bar.boundingBox())!.width).toBeGreaterThanOrEqual(10);
  });

  test('a region can be hidden; its event shows the lane for now when selected', async ({ page }) => {
    await openApp(page, '/en/');
    const menu = page.locator('.timeline').getByRole('button', { name: 'Regions', exact: true });
    await menu.click();
    await page.getByRole('checkbox', { name: 'Akavir', exact: true }).uncheck();
    await page.keyboard.press('Escape');
    await expect(menu).toBeFocused();
    expect(await laneIds(page)).not.toContain('akavir');
    await page.reload();
    await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
    await expect.poll(() => laneIds(page)).not.toContain('akavir');
    await openApp(page, '/en/events/failed-invasion-of-akavir/');
    await expect(page.locator('.tl-name[data-lane="akavir"]')).toContainText('shown for now');
    // Back on: the region is plain again.
    await page.locator('.timeline').getByRole('button', { name: 'Regions', exact: true }).click();
    await page.getByRole('checkbox', { name: 'Akavir', exact: true }).check();
    await page.keyboard.press('Escape');
    await expect(page.locator('.tl-name[data-lane="akavir"]')).not.toContainText('shown for now');
  });
});

test.describe('the ends of time and zooming', () => {
  test('zoomed in all the way at the end of time, the last marks are whole with room after them', async ({ page }) => {
    await openApp(page, '/en/events/last-dragonborn-defeats-alduin/');
    const zoomIn = page.locator('.timeline').getByRole('button', { name: 'Zoom in', exact: true });
    for (let i = 0; i < 12 && (await zoomIn.isEnabled()); i++) {
      await zoomIn.click();
      await waitForTimelineSettled(page);
    }
    await expect(zoomIn).toBeDisabled();
    // Drag time to the left until it stops: the end of time (4E 201) reaches the right of the band.
    const band = (await page.locator('.tl-scroll').boundingBox())!;
    const y = band.y + 40;
    const marks = page.locator('.tl-svg :is(.tl-dot, .tl-cluster).is-selected');
    const markX = async () => (await marks.first().boundingBox())!.x;
    for (let i = 0, last = NaN; i < 60; i++) {
      await page.mouse.move(band.x + band.width * 0.8, y);
      await page.mouse.down();
      await page.mouse.move(band.x + band.width * 0.1, y, { steps: 5 });
      await page.mouse.up();
      const x = await markX();
      if (Math.abs(x - last) < 0.5) break;
      last = x;
    }
    await waitForTimelineSettled(page);
    expect(await marks.count()).toBeGreaterThan(0);
    for (const box of await marks.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON()))) {
      // The whole hit area is on the band, and decisions/p4-review: at least 48 px of blank space after 4E 201.
      expect(box.x).toBeGreaterThanOrEqual(band.x);
      expect(box.x + box.width).toBeLessThanOrEqual(band.x + band.width);
      expect(box.x + box.width / 2 + 48).toBeLessThanOrEqual(band.x + band.width + 1);
    }
    await expect(page.locator('.tl-sel-label')).toBeVisible();
  });

  test('a pinch zooms about the fingers', async ({ page, browserName }, info) => {
    test.skip(info.project.name !== 'mobile' || browserName !== 'chromium', 'touch pinch through CDP on the phone only');
    await openApp(page, '/en/events/battle-of-red-mountain/');
    await waitForTimelineSettled(page);
    const svg = (await page.locator('.tl-svg').boundingBox())!;
    const cx = svg.x + svg.width / 2;
    const cy = svg.y + 80;
    const lines = () =>
      page.locator('.tl-century').evaluateAll((els) =>
        Object.fromEntries(els.map((e) => [e.getAttribute('data-century')!, e.getBoundingClientRect().x])),
      );
    const before = await lines();
    const [key, x0] = Object.entries(before).sort((a, b) => Math.abs(a[1] - cx) - Math.abs(b[1] - cx))[0];
    const cdp = await page.context().newCDPSession(page);
    const fingers = (d: number) => [{ x: cx - d, y: cy, id: 0 }, { x: cx + d, y: cy, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: fingers(20) });
    for (let d = 22; d <= 40; d += 2) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: fingers(d) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await waitForTimelineSettled(page);
    // The fingers moved twice as far apart: what was under them stays under them, twice as far from their middle.
    const after = await lines();
    expect(after[key]).toBeDefined();
    expect(Math.abs(after[key] - (cx + 2 * (x0 - cx)))).toBeLessThan(4);
  });
});

// A small window (624 × 384, like a side pane): the hint and the tools share the timeline's foot row.
test.describe('a 624 × 384 window', () => {
  test.use({ viewport: { width: 624, height: 384 } });
  test('the regions button keeps its name on one line', async ({ page }) => {
    await openApp(page, '/zh-tw/events/battle-of-red-mountain/');
    // The rows its text takes: one per distinct line box.
    const rows = await page.locator('.tl-regions').evaluate((el) => {
      const range = document.createRange();
      range.selectNodeContents(el);
      return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
    });
    expect(rows).toBe(1);
  });
});
