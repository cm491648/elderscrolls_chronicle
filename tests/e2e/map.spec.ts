import { readdirSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  eventTitle,
  readJson,
  RED,
  MUNDUS_EN,
  storyTitle,
  activeMarker,
  openApp,
  recordRasters,
  DRAWN_SITE,
  currentMapLayer,
  goUpToMapLayer,
  settledMapTransform,
  expectedRasterNow,
  activeMapRegion,
} from './helpers';

/**
 * A shape's geometry box on screen (its fill outline, through the zoom transform), like boundingBox() but without the
 * stroke: Chrome counts a stroke's miter joins in getBoundingClientRect even when the stroke is transparent.
 */
async function geomBox(loc: Locator) {
  return loc.evaluate((el) => {
    const g = el as SVGGraphicsElement;
    const b = g.getBBox();
    const m = g.getScreenCTM()!;
    const pts = [
      [b.x, b.y],
      [b.x + b.width, b.y],
      [b.x, b.y + b.height],
      [b.x + b.width, b.y + b.height],
    ].map(([x, y]) => new DOMPoint(x, y).matrixTransform(m));
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  });
}

/** The layer's picture covers the whole plate at the settled zoom: no empty margin on any side. */
async function expectPlateCovered(page: Page) {
  const { x, y, k } = await settledMapTransform(page);
  const { W, H, w, h } = await page.locator('.map-plate').evaluate((el) => {
    const b = el.querySelector('.map-svg')!.getBoundingClientRect();
    // The clip rectangle is the layer's own frame (its viewBox size).
    const frame = el.querySelector('clipPath rect')!;
    return { W: b.width, H: b.height, w: Number(frame.getAttribute('width')), h: Number(frame.getAttribute('height')) };
  });
  expect(x).toBeLessThanOrEqual(0.5);
  expect(y).toBeLessThanOrEqual(0.5);
  expect(x + k * w).toBeGreaterThanOrEqual(W - 0.5);
  expect(y + k * h).toBeGreaterThanOrEqual(H - 0.5);
}

test('clicking a map location lists its events', async ({ page }) => {
  await openApp(page, '/en/events/battle-of-red-mountain/');
  // The active marker's bbox includes its pointer-events:none name tag, so click its hit circle.
  await page.getByRole('button', { name: 'Red Mountain', exact: true }).locator('.mk-hit').click();
  await expect(page.locator('.map-popup').getByRole('button', { name: RED.en })).toBeVisible();
  // Each entry carries its year after the title, as on the timeline (decisions/p4-design).
  await expect(page.locator('.map-popup').getByRole('button', { name: `${RED.en} 1E 700`, exact: true })).toBeVisible();
  await expect(page.locator('.map-popup .map-popup-year')).toContainText(['1E 700']);
});

test("an undated event in a map list reads its era's short tag (decisions/p4-merge)", async ({ page }) => {
  const title = eventTitle('en', 'dragon-war');
  await openApp(page, '/en/events/dragon-war/');
  await activeMarker(page).locator('.mk-hit').first().click();
  await expect(page.locator('.map-popup').getByRole('button', { name: `${title} ME`, exact: true })).toBeVisible();
});

test('a province layer draws its Anthology crop under the markers; Tamriel the whole map; both credited', async ({ page }) => {
  const nirnFiles: string[] = [];
  page.on('request', (req) => {
    // Map images; the tiny preview shown while one loads has its own test.
    if (req.url().includes('/maps/drawn/nirn') && !req.url().endsWith('-preview.webp')) nirnFiles.push(new URL(req.url()).pathname);
  });
  await openApp(page, '/zh-tw/events/battle-of-red-mountain/');
  const plate = page.locator('.map-plate');
  const basemap = plate.locator('image.map-basemap');
  // Red Mountain is the event's only place: the finest layer holding it is Morrowind.
  await expect(currentMapLayer(page)).toHaveText('晨風');
  await expect(plate).toHaveClass(/has-basemap/);
  await expect(basemap).toHaveCount(1);
  await expect(basemap).toHaveAttribute('href', '/maps/official/provinces/morrowind.webp');
  // The image actually loads (SVG <image> has no naturalWidth, so fetch what it points at).
  const res = await page.request.get('/maps/official/provinces/morrowind.webp');
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/webp');
  // The raster sits underneath: regions and markers come after it in the overlay.
  const order = await page
    .locator('.map-svg > g')
    .evaluate((g) => [...g.children].map((c) => c.getAttribute('class') ?? c.tagName));
  expect(order.slice(0, 3)).toEqual(['map-pad', 'map-preview', 'map-basemap']);
  await expect(page.locator('.map-marker.is-active')).toHaveAttribute('aria-label', '紅山');
  // Chinese pages add the Chinese name on a paper tag; the crop's own lettering is English.
  await expect(plate.locator('.region-tag')).toHaveCount(1);
  await expect(plate.locator('.region-label')).toHaveCount(0);
  const cap = page.locator('.map-cap');
  await expect(cap).toContainText('© Bethesda Softworks');
  // It opens a new tab, and says so to screen readers.
  const uesp = cap.getByRole('link', { name: /^UESP\s?（另開新分頁）$/ });
  await expect(uesp).toHaveAttribute('href', 'https://en.uesp.net/wiki/File:LO-map-Morrowind_(Anthology).jpg');
  await expect(uesp).toHaveAttribute('target', '_blank');
  await expect(page.locator('.site-footer')).toContainText('非官方粉絲網站');
  await expect(page.locator('.site-footer')).toContainText('官方地圖經 UESP 取得');

  // One level up: the whole Anthology map, nine province tags, every province's places.
  await page.locator('.map-up').click();
  await expect(currentMapLayer(page)).toHaveText('泰姆瑞爾');
  await expect(basemap).toHaveAttribute('href', /\/maps\/official\/tamriel-anthology(-1440)?\.webp$/);
  await expect(plate.locator('.region-tag')).toHaveCount(9);
  await expect(cap.getByRole('link')).toHaveAttribute('href', /uesp\.net\/wiki\/File:LO-map-Tamriel/);
  const belowTamriel = readJson<{ layer: string }[]>('src/content/locations.json').filter((l) => !['cosmos', 'nirn'].includes(l.layer));
  // Every place has a marker of its own or a place in a group marker (places too close to tap apart, P3-A5).
  await expect
    .poll(() => page.locator('.map-marker').evaluateAll((els) => els.reduce((n, el) => n + Number(el.getAttribute('data-count') ?? 1), 0)))
    .toBe(belowTamriel.length);

  // Nirn has no official map: our drawn raster, credited to the site, with no source link.
  // (Straight on, while Tamriel's own zoom out is still running: the interrupted zoom must not let the new one
  // fetch Nirn's full image on its way through the deep start of the zoom out.)
  await goUpToMapLayer(page, '奈恩');
  await expect(currentMapLayer(page)).toHaveText('奈恩');
  await expect(plate.locator('image.map-basemap')).toHaveAttribute('href', /\/maps\/drawn\//);
  // Settled: one Nirn image, the one its resting zoom needs, fetched once.
  const want = await expectedRasterNow(page, 'nirn');
  await expect(plate.locator('image.map-basemap')).toHaveAttribute('href', want);
  expect(nirnFiles).toEqual([want]);
  await expect(cap).toContainText('本站自繪');
  await expect(cap.getByRole('link')).toHaveCount(0);
});

test('English pages credit the map and leave the province names to the map itself', async ({ page }) => {
  await openApp(page, '/en/events/battle-of-red-mountain/');
  await expect(currentMapLayer(page)).toHaveText('Morrowind');
  await expect(page.locator('.map-plate')).toHaveClass(/has-basemap/);
  await expect(page.locator('.region-tag, .region-label')).toHaveCount(0);
  await expect(page.locator('.map-cap')).toContainText('The Elder Scrolls Anthology map, © Bethesda Softworks');
  await expect(page.locator('.site-footer')).toContainText('not affiliated with or endorsed by');
});

test('a page downloads a single map image: the province crop the event opens on', async ({ page }) => {
  const urls = recordRasters(page);
  await openApp(page, '/en/events/battle-of-red-mountain/');
  await expect(page.locator('image.map-basemap')).toHaveCount(1);
  await settledMapTransform(page);
  await page.waitForTimeout(500); // nothing else is fetched once the view has settled
  expect(urls).toEqual(['/maps/official/provinces/morrowind.webp']);
});

test('the whole Tamriel map downloads only the image its fill zoom needs', async ({ page }) => {
  const urls = recordRasters(page);
  await openApp(page, '/en/events/creation-of-mundus/');
  expect(urls).toHaveLength(0); // the cosmos layer has no official raster
  await expect(currentMapLayer(page)).toHaveText('Cosmos');
  // Down two levels by clicking regions: the cosmos' Nirn, then Nirn's Tamriel.
  await page.getByRole('button', { name: 'Zoom into Nirn' }).click();
  await expect(currentMapLayer(page)).toHaveText('Nirn');
  await page.getByRole('button', { name: 'Zoom into Tamriel' }).click();
  await expect(currentMapLayer(page)).toHaveText('Tamriel');
  const expected = await expectedRasterNow(page, 'tamriel');
  await page.waitForTimeout(500);
  expect(urls).toEqual([expected]);
  await expect(page.locator('image.map-basemap')).toHaveAttribute('href', expected);
});

// The site is light only (decisions/es-feel-1): one set of focus rings.
test.describe('map focus rings', () => {
  test('regions and markers show a paper-and-ink ring on keyboard focus over the raster', async ({ page }) => {
    await openApp(page, '/en/events/oblivion-crisis/');
    await page.keyboard.press('Tab'); // keyboard modality, so programmatic focus matches :focus-visible
    const colors = await page.evaluate(() => {
      const cs = getComputedStyle(document.documentElement);
      const probe = document.createElement('div');
      document.body.append(probe);
      const resolve = (v: string) => {
        probe.style.color = cs.getPropertyValue(v);
        return getComputedStyle(probe).color;
      };
      const out = { surface: resolve('--surface'), ink: resolve('--ink') };
      probe.remove();
      return out;
    });

    const region = page.locator('.map-svg .region').first();
    await region.focus();
    const ring = page.locator('.region-focus');
    await expect(ring).toHaveCount(1);
    await expect(ring.locator('.focus-halo')).toHaveCSS('stroke', colors.surface);
    await expect(ring.locator('.focus-ink')).toHaveCSS('stroke', colors.ink);
    expect(Number.parseFloat(await ring.locator('.focus-halo').evaluate((el) => getComputedStyle(el).strokeWidth))).toBeGreaterThanOrEqual(
      Number.parseFloat(await ring.locator('.focus-ink').evaluate((el) => getComputedStyle(el).strokeWidth)) + 3,
    );
    await region.blur();
    await expect(ring).toHaveCount(0);
    // A mouse click focuses a region too, but draws no keyboard ring (Cyrodiil's own layer: it lists its events).
    // Measure only once the web fonts are in and the page has stopped moving (the font swap shifts the layout),
    // and take the spot twice in a row to be sure it is stable.
    await page.evaluate(() => document.fonts.ready);
    await settledMapTransform(page);
    const findSpot = () =>
      page.locator('.map-plate').evaluate((plate) => {
        const b = plate.getBoundingClientRect();
        for (let y = b.top + 60; y < b.bottom - 20; y += 15) {
          for (let x = b.left + 20; x < b.right - 20; x += 15) {
            if (document.elementFromPoint(x, y)?.classList.contains('region')) return { x, y };
          }
        }
        return null;
      });
    let point = await findSpot();
    await expect.poll(async () => {
      const again = await findSpot();
      const same = JSON.stringify(again) === JSON.stringify(point);
      point = again;
      return same;
    }, { intervals: [150] }).toBe(true);
    expect(point).not.toBeNull();
    await page.mouse.click(point!.x, point!.y);
    await expect(page.locator('.map-popup')).toBeVisible();
    await expect(page.locator('.region-focus')).toHaveCount(0);
    await page.locator('.map-popup .close').click();

    await page.keyboard.press('Tab');
    const marker = page.locator('.map-marker:not(.map-marker-group)').first();
    await marker.focus();
    await expect(marker.locator('.mk-hit')).toHaveCSS('stroke', colors.surface);
    await expect(marker.locator('.mk-focus')).toHaveCSS('stroke', colors.ink);
  });
});

test('map reverse lookup: another layer\'s location selects its event', async ({ page }) => {
  await openApp(page, '/en/events/battle-of-red-mountain/');
  await goUpToMapLayer(page, 'Cosmos');
  await expect(currentMapLayer(page)).toHaveText('Cosmos');
  // The zoom out ends with focus on the region we came out of (Nirn); then move it on.
  await expect(page.locator('.region[data-region="nirn"]')).toBeFocused();
  // The creation of Mundus names the whole Mundus ring: the ring (not a drill-down region) lists it.
  await page.getByRole('button', { name: 'Mundus', exact: true }).focus();
  await page.keyboard.press('Enter');
  const popup = page.locator('.map-popup');
  await popup.getByRole('button', { name: MUNDUS_EN }).click();
  await expect(page).toHaveURL(/\/en\/events\/creation-of-mundus\/$/);
  await expect(storyTitle(page)).toHaveText(MUNDUS_EN);
});

test('Nirn and the cosmos draw our own maps, one image each, with paper-tag names', async ({ page }) => {
  const urls: string[] = [];
  page.on('request', (req) => {
    // Map images; the tiny preview shown while one loads has its own test.
    if (req.url().includes('/maps/') && !req.url().endsWith('-preview.webp')) urls.push(new URL(req.url()).pathname);
  });
  await openApp(page, '/zh-tw/events/creation-of-mundus/');
  const plate = page.locator('.map-plate');
  // Cosmos (the selected event's layer): a square drawn map, four rings named on tags.
  await expect(plate).toHaveClass(/has-basemap/);
  await expect(plate.locator('image.map-basemap')).toHaveAttribute('href', await expectedRasterNow(page, 'cosmos'));
  // Framed on the Mundus ring the event names (lit, no marker): the whole ring on the plate.
  await settledMapTransform(page);
  await expect(activeMapRegion(page)).toHaveAttribute('aria-label', '凡界');
  const svgBox = (await plate.locator('.map-svg').boundingBox())!;
  const ring = await geomBox(activeMapRegion(page));
  expect(ring.y >= svgBox.y - 1 && ring.y + ring.height <= svgBox.y + svgBox.height + 1).toBe(true);
  await expect(page.locator('.map-marker.is-active')).toHaveCount(0);
  // Four rings, four paper tags.
  await expect(plate.locator('.region-tag')).toHaveCount(4);
  await expect(page.locator('.map-cap')).toContainText('地圖：本站自繪');
  await expect(page.locator('.map-cap a')).toHaveCount(0);

  await page.getByRole('button', { name: '放大到奈恩' }).click();
  await expect(currentMapLayer(page)).toHaveText('奈恩');
  await expect(plate.locator('image.map-basemap')).toHaveAttribute('href', await expectedRasterNow(page, 'nirn'));
  await expect(plate.locator('.region-tag')).toHaveCount(5);
  await expect(page.getByRole('button', { name: '阿特摩拉', exact: true }).first()).toBeAttached();
  await page.waitForTimeout(800);
  expect(urls.filter((u) => u.includes('cosmos'))).toHaveLength(1);
  expect(urls.filter((u) => u.includes('nirn'))).toHaveLength(1);
  expect(urls.filter((u) => u.includes('/maps/official/'))).toHaveLength(0);
});

test('a selected Nirn region is tinted without its loose outline', async ({ page }) => {
  await openApp(page, '/zh-tw/events/atmoran-migration/');
  const region = page.locator('.map-plate.regions-loose .region.is-active');
  await expect(region).toHaveCount(1);
  await expect(region).toHaveCSS('stroke', 'rgba(0, 0, 0, 0)');
  expect(await region.evaluate((el) => getComputedStyle(el).fill)).not.toBe('rgba(0, 0, 0, 0)');
});

test('the Atmoran migration shows Atmora and Skyrim together on Nirn, with Saarthal marked', async ({ page }) => {
  await openApp(page, '/zh-tw/events/atmoran-migration/');
  await expect(currentMapLayer(page)).toHaveText('奈恩');
  await expect(activeMapRegion(page)).toHaveAttribute('aria-label', '阿特摩拉');
  // Skyrim lives on the Tamriel layer: carried up to Nirn as an outline.
  const skyrim = page.locator('.map-plate .event-region');
  await expect(skyrim).toHaveCount(1);
  await expect(page.locator('.map-marker.is-active')).toHaveAttribute('aria-label', '薩瑟爾城');
  // All of it is in view.
  await settledMapTransform(page);
  const plate = (await page.locator('.map-svg').boundingBox())!;
  for (const box of [await geomBox(skyrim), await geomBox(activeMapRegion(page))]) {
    expect(box!.x >= plate.x - 1 && box!.x + box!.width <= plate.x + plate.width + 1).toBe(true);
    expect(box!.y >= plate.y - 1 && box!.y + box!.height <= plate.y + plate.height + 1).toBe(true);
  }
  // Nirn v3c's coast follows the province outlines: the carried-up Skyrim keeps its lapis wash and outline.
  await expect(skyrim).not.toHaveClass(/is-soft/);
  expect(await skyrim.evaluate((el) => getComputedStyle(el).stroke)).not.toBe('none');
});

test('the Middle Dawn names no place: Tamriel, with Cyrodiil lit', async ({ page }) => {
  await openApp(page, '/en/events/middle-dawn/');
  await expect(currentMapLayer(page)).toHaveText('Tamriel');
  await expect(activeMapRegion(page)).toHaveCount(1);
  await expect(activeMapRegion(page)).toHaveAttribute('aria-label', 'Zoom into Cyrodiil');
  await expect(page.locator('.map-marker.is-active')).toHaveCount(0);
  // The whole of Cyrodiil is in view.
  await settledMapTransform(page);
  const plate = (await page.locator('.map-svg').boundingBox())!;
  const box = await geomBox(activeMapRegion(page));
  expect(box.x >= plate.x - 1 && box.x + box.width <= plate.x + plate.width + 1).toBe(true);
  expect(box.y >= plate.y - 1 && box.y + box.height <= plate.y + plate.height + 1).toBe(true);
});

test('the cosmos takes its full image as soon as the 512 px one would be stretched', async ({ page }) => {
  await openApp(page, '/en/events/creation-of-mundus/');
  // Whole Mundus ring in view: the zoom depends on the plate, and the image on that zoom (rasterFor).
  await expect(page.locator('image.map-basemap').first()).toHaveAttribute('href', await expectedRasterNow(page, 'cosmos'));
  // Zoomed into Nirn's disc and back out to the cosmos at the fill zoom: past 512 px, so the full image.
  await page.getByRole('button', { name: 'Zoom into Nirn' }).click();
  await expect(currentMapLayer(page)).toHaveText('Nirn');
  await page.locator('.map-up').click();
  await expect(currentMapLayer(page)).toHaveText('Cosmos');
  const want = await expectedRasterNow(page, 'cosmos');
  await expect(page.locator('image.map-basemap').last()).toHaveAttribute('href', want);
});

// ---- R12: map levels ----

test('clicking a region zooms one level down; the path and "up one level" zoom back out; focus follows', async ({ page }) => {
  await openApp(page, '/zh-tw/events/oblivion-crisis/');
  await expect(currentMapLayer(page)).toHaveText('賽洛迪爾');
  const path = page.locator('.map-path');
  await expect(path.locator('li')).toHaveText(['宇宙', '奈恩', '泰姆瑞爾', '賽洛迪爾']);
  await expect(page.getByRole('navigation', { name: '地圖層級' })).toBeVisible();

  // Up one level by keyboard: Tamriel, focus on the region we came out of.
  await page.locator('.map-up').focus();
  await page.keyboard.press('Enter');
  await expect(currentMapLayer(page)).toHaveText('泰姆瑞爾');
  await expect(page.locator('.map-path li')).toHaveCount(3);
  await expect(page.locator('.region[data-region="cyrodiil"]')).toBeFocused();
  await expect(page.locator('.map-view [aria-live]')).toHaveText('地圖：泰姆瑞爾');

  // Into Skyrim by keyboard (Enter on its region): focus moves to the path's current level.
  const skyrim = page.getByRole('button', { name: '放大到天際' });
  await skyrim.focus();
  await page.keyboard.press('Enter');
  await expect(currentMapLayer(page)).toHaveText('天際');
  await expect(currentMapLayer(page)).toBeFocused();
  // Skyrim is the game's own map (round 3), in two sizes; credited to Skyrim with its UESP file page.
  await expect(page.locator('.map-plate image.map-basemap').first()).toHaveAttribute('href', /\/maps\/official\/provinces\/skyrim(-1024)?\.webp$/);
  await expect(page.locator('.map-cap')).toContainText('《上古卷軸 V：無界天際》遊戲地圖');
  await expect(page.locator('.map-cap a')).toHaveAttribute('href', 'https://en.uesp.net/wiki/File:SR-map-Skyrim.jpg');
  // Skyrim's own places are marked (Helgen, Windhelm, ...), Cyrodiil's are not.
  await expect(page.getByRole('button', { name: '風舵城', exact: true })).toBeAttached();
  await expect(page.getByRole('button', { name: '帝都', exact: true })).toHaveCount(0);

  // The path jumps straight to the cosmos; the root has no "up" button.
  await goUpToMapLayer(page, '宇宙');
  await expect(currentMapLayer(page)).toHaveText('宇宙');
  await expect(page.locator('.map-up')).toHaveCount(0);
  await expect(page.locator('.region[data-region="nirn"]')).toBeFocused();
});

test('every layer fills the plate (no margin), and can be dragged to see what lies past its edges', async ({ page }) => {
  await openApp(page, '/en/events/oblivion-crisis/');
  for (const step of ['Cyrodiil', 'Tamriel', 'Nirn', 'Cosmos']) {
    if (step !== 'Cyrodiil') await page.locator('.map-up').click();
    await expect(currentMapLayer(page)).toHaveText(step);
    await expectPlateCovered(page);
  }
  // Back down to Tamriel, then drag: the view moves and still covers the plate.
  await page.getByRole('button', { name: 'Zoom into Nirn' }).click();
  await page.getByRole('button', { name: 'Zoom into Tamriel' }).click();
  await expect(currentMapLayer(page)).toHaveText('Tamriel');
  const before = await settledMapTransform(page);
  const box = (await page.locator('.map-svg').boundingBox())!;
  // Drag on a marker-free spot near the plate's bottom edge.
  const x = box.x + box.width / 2;
  const y = box.y + box.height - 12;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - 40, y - 60, { steps: 6 });
  await page.mouse.up();
  const after = await settledMapTransform(page);
  expect(after.x !== before.x || after.y !== before.y).toBe(true);
  await expectPlateCovered(page);
});

test('changing level zooms: mid-way the old picture is still fading out over a moving map', async ({ page }) => {
  await openApp(page, '/en/events/oblivion-crisis/');
  await settledMapTransform(page);
  const ghost = page.locator('.map-ghost');
  await page.locator('.map-up').click();
  // Sample the transform and the fading picture over the first frames of the zoom out.
  const samples = await page.evaluate(async () => {
    const out: { k: number; ghost: number; children: number }[] = [];
    const g = document.querySelector('.map-svg > g')!;
    const ghostEl = document.querySelector<HTMLElement>('.map-ghost')!;
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => requestAnimationFrame(r));
      const k = Number(/scale\(([-\d.e]+)\)/.exec(g.getAttribute('transform') ?? '')?.[1] ?? 0);
      out.push({ k, ghost: Number(getComputedStyle(ghostEl).opacity), children: ghostEl.childElementCount });
    }
    return out;
  });
  // The ghost holds the Cyrodiil picture while it fades.
  expect(samples.some((s) => s.children === 1 && s.ghost > 0 && s.ghost < 1)).toBe(true);
  // The Tamriel view zooms out through several scales rather than jumping.
  expect(new Set(samples.map((s) => s.k.toFixed(3))).size).toBeGreaterThan(4);
  await expect(currentMapLayer(page)).toHaveText('Tamriel');
  await expect(ghost).toHaveCSS('opacity', '0');
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('changing level cross-fades without zooming', async ({ page }) => {
    await openApp(page, '/en/events/oblivion-crisis/');
    await settledMapTransform(page);
    await page.locator('.map-up').click();
    await expect(currentMapLayer(page)).toHaveText('Tamriel');
    const samples = await page.evaluate(async () => {
      const g = document.querySelector('.map-svg > g')!;
      const out: string[] = [];
      for (let i = 0; i < 15; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        out.push(g.getAttribute('transform') ?? '');
      }
      return out;
    });
    // The new layer appears at its final view straight away: one transform for every frame.
    expect(new Set(samples).size).toBe(1);
  });

  test('the cross-fade still runs (the old picture fades out over the new one)', async ({ page }) => {
    await openApp(page, '/en/events/oblivion-crisis/');
    await settledMapTransform(page);
    await page.locator('.map-up').click();
    const fades = await page.evaluate(async () => {
      const ghost = document.querySelector<HTMLElement>('.map-ghost')!;
      const out: number[] = [];
      for (let i = 0; i < 40; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        if (ghost.childElementCount) out.push(Number(getComputedStyle(ghost).opacity));
      }
      return out;
    });
    expect(fades.some((o) => o > 0.05 && o < 0.95)).toBe(true);
    await expect(page.locator('.map-ghost')).toBeEmpty();
  });
});

test('focus moved away during a zoom is not pulled back when the zoom ends', async ({ page }, info) => {
  await openApp(page, '/en/events/oblivion-crisis/');
  await settledMapTransform(page);
  await page.locator('.map-up').focus();
  await page.keyboard.press('Enter');
  // Mid-zoom the reader tabs to the timeline (outside the map).
  await expect(currentMapLayer(page)).toHaveText('Tamriel');
  // Inside the map (a level in the path) on a desktop; the phone path has no other level, so the timeline there.
  const elsewhere =
    info.project.name === 'mobile' ? page.locator('.timeline').getByRole('button').first() : page.locator('.map-path button').first();
  await elsewhere.focus();
  await settledMapTransform(page);
  await page.waitForTimeout(300);
  await expect(elsewhere).toBeFocused();
});

test('choosing the selected event again in a map popup closes the popup', async ({ page }) => {
  await openApp(page, '/en/events/battle-of-red-mountain/');
  await page.getByRole('button', { name: 'Red Mountain', exact: true }).locator('.mk-hit').click();
  const popup = page.locator('.map-popup');
  await popup.getByRole('button', { name: RED.en }).click();
  await expect(popup).toHaveCount(0);
});

// I-1 / I-2: every event, on this project's screen.
const EVENT_IDS = readdirSync('src/content/events/en').map((f) => f.replace(/\.md$/, ''));
for (const lang of ['en', 'zh-tw'] as const)
test(`every event (${lang}): selected places and their tags on the plate, clear of the level path, of each other and of every selected place`, async ({ page }) => {
  test.setTimeout(150_000);
  for (const id of EVENT_IDS) {
    await openApp(page, `/${lang}/events/${id}/`);
    await settledMapTransform(page);
    // Tags are sized, then placed, once the view settles (and again when the fonts arrive): wait until their
    // positions and widths stop changing.
    let lastTags = '';
    await expect
      .poll(
        async () => {
          const now = await page.evaluate(() =>
            [...document.querySelectorAll('.mk-tags .mk-tag')]
              .map((t) => `${t.getAttribute('transform')}|${t.querySelector('rect')?.getAttribute('width')}`)
              .join(';'),
          );
          const same = now === lastTags && !now.includes('|0');
          lastTags = now;
          return same;
        },
        { intervals: [100] },
      )
      .toBe(true);
    const r = await page.evaluate(() => {
      const box = (el: Element) => {
        const b = el.getBoundingClientRect();
        return { l: b.left, t: b.top, r: b.right, b: b.bottom };
      };
      const plate = box(document.querySelector('.map-svg')!);
      const nav = box(document.querySelector('.map-nav')!);
      const navParts = [...document.querySelectorAll('.map-nav > *')].map(box);
      const dots = [...document.querySelectorAll('.map-marker.is-active .mk-dot')].map(box);
      const tags = [...document.querySelectorAll('.mk-tags .mk-tag rect')].map(box);
      // Regions by their geometry (not getBoundingClientRect, which counts the stroke's miter joins).
      const geom = (el: Element) => {
        const g = el as SVGGraphicsElement;
        const b = g.getBBox();
        const m = g.getScreenCTM()!;
        const pts = [[b.x, b.y], [b.x + b.width, b.y + b.height]].map(([x, y]) => new DOMPoint(x, y).matrixTransform(m));
        return { l: pts[0].x, t: pts[0].y, r: pts[1].x, b: pts[1].y };
      };
      const regions = [...document.querySelectorAll('.region.is-active, .event-region')].map(geom);
      return { plate, nav, navParts, dots, tags, regions };
    });
    type B = { l: number; t: number; r: number; b: number };
    const inside = (a: B, o: B, slack = 0.5) => a.l >= o.l - slack && a.r <= o.r + slack && a.t >= o.t - slack && a.b <= o.b + slack;
    const hit = (a: B, o: B) => a.l < o.r - 0.5 && o.l < a.r - 0.5 && a.t < o.b - 0.5 && o.t < a.b - 0.5;
    for (const [i, d] of r.dots.entries()) {
      expect(inside(d, r.plate), `${id}: place ${i} on the plate`).toBe(true);
      for (const n of r.navParts) expect(hit(d, n), `${id}: place ${i} under the level path`).toBe(false);
    }
    for (const [i, t] of r.tags.entries()) {
      expect(inside(t, r.plate), `${id}: tag ${i} on the plate`).toBe(true);
      for (const n of r.navParts) expect(hit(t, n), `${id}: tag ${i} under the level path`).toBe(false);
      for (const [j, o] of r.tags.entries()) if (j > i) expect(hit(t, o), `${id}: tags ${i} and ${j} overlap`).toBe(false);
      // No tag hides a selected place (its own or another), however crowded (the Warp in the West on a phone).
      for (const [j, d] of r.dots.entries()) expect(hit(t, d), `${id}: tag ${i} covers place ${j}`).toBe(false);
    }
    for (const [i, g] of r.regions.entries()) expect(inside(g, r.plate, 1.5), `${id}: region ${i} whole on the plate`).toBe(true);
  }
});

test('an event with several places opens the finest layer holding them all, framing every one', async ({ page }) => {
  await openApp(page, '/zh-tw/events/return-of-alduin/');
  await expect(currentMapLayer(page)).toHaveText('天際');
  await settledMapTransform(page);
  for (const name of ['海爾根', '世界之喉']) {
    const marker = page.locator('.map-marker.is-active').and(page.getByRole('button', { name, exact: true }));
    await expect(marker).toHaveCount(1);
    const m = (await marker.locator('.mk-dot').boundingBox())!;
    const plate = (await page.locator('.map-svg').boundingBox())!;
    expect(m.x > plate.x && m.x + m.width < plate.x + plate.width && m.y > plate.y && m.y + m.height < plate.y + plate.height, name).toBe(true);
  }
  // Two Cyrodiil places: the Cyrodiil layer.
  await openApp(page, '/zh-tw/events/oblivion-crisis/');
  await expect(currentMapLayer(page)).toHaveText('賽洛迪爾');
  await expect(activeMarker(page)).toHaveCount(2);
});

test('the Warp in the West marks the bay and its four kingdoms on Tamriel; the bay marker sits on open water', async ({ page }) => {
  await openApp(page, '/en/events/warp-in-the-west/');
  // Sentinel is in Hammerfell, the rest in High Rock: the finest layer holding all five is Tamriel.
  await expect(currentMapLayer(page)).toHaveText('Tamriel');
  await settledMapTransform(page);
  const active = page.locator('.map-marker.is-active');
  await expect(active).toHaveCount(5);
  const plateBox = (await page.locator('.map-svg').boundingBox())!;
  for (const name of ['Iliac Bay', 'Daggerfall', 'Wayrest', 'Sentinel', 'Orsinium']) {
    const m = (await page.getByRole('button', { name, exact: true }).locator('.mk-dot').boundingBox())!;
    expect(m.x > plateBox.x && m.x + m.width < plateBox.x + plateBox.width, name).toBe(true);
    expect(m.y > plateBox.y && m.y + m.height < plateBox.y + plateBox.height, name).toBe(true);
  }
  const marker = page.getByRole('button', { name: 'Iliac Bay', exact: true });
  await expect(marker).toBeAttached();
  // No region under the marker's centre: it is not on High Rock's (or anyone's) land.
  const onLand = await marker.locator('.mk-dot').evaluate((dot) => {
    const b = dot.getBoundingClientRect();
    const x = b.left + b.width / 2;
    const y = b.top + b.height / 2;
    return document.elementsFromPoint(x, y).some((el) => el.classList.contains('region'));
  });
  expect(onLand).toBe(false);
});

test.describe('drawn-map build (PUBLIC_MAP_SOURCE=drawn)', () => {
  test.use({ baseURL: DRAWN_SITE });

  test('every layer is our painted schematic map; nothing official is requested', async ({ page }) => {
    const urls: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/maps/')) urls.push(new URL(req.url()).pathname);
    });
    await openApp(page, '/zh-tw/events/battle-of-red-mountain/');
    const plate = page.locator('.map-plate');
    // The Morrowind layer: our painting of Morrowind, Chinese names on paper tags (the painting has no lettering).
    await expect(currentMapLayer(page)).toHaveText('晨風');
    await expect(plate).toHaveClass(/has-basemap/);
    await expect(plate.locator('image.map-basemap')).toHaveAttribute('href', /^\/maps\/drawn\/schematic\/morrowind(-\d+)?\.webp$/);
    await expect(plate.locator('.region-tag')).toHaveCount(1);
    await expect(page.locator('.map-marker.is-active')).toHaveAttribute('aria-label', '紅山');
    await expect(page.locator('.map-cap')).toContainText('本站自繪地圖');
    await expect(page.locator('.map-cap a')).toHaveCount(0);
    // A drawn-only build offers no switch: there is no official map to switch to.
    await expect(page.locator('.map-switch')).toHaveCount(0);
    // Markers still answer clicks.
    await page.getByRole('button', { name: '紅山', exact: true }).locator('.mk-hit').click();
    await expect(page.locator('.map-popup').getByRole('button', { name: RED.zh })).toBeVisible();
    await page.locator('.map-popup .close').click();
    // Up to Tamriel: the whole painted map, nine names of ours.
    await page.locator('.map-up').click();
    await expect(currentMapLayer(page)).toHaveText('泰姆瑞爾');
    await expect(plate.locator('image.map-basemap')).toHaveAttribute('href', /^\/maps\/drawn\/schematic\/tamriel(-\d+)?\.webp$/);
    await expect(plate.locator('.region-tag')).toHaveCount(9);
    await expect(page.locator('.map-marker.is-active')).toHaveAttribute('aria-label', '紅山');
    // Into another province: still ours, still nothing official.
    await page.getByRole('button', { name: '放大到天際' }).click();
    await expect(currentMapLayer(page)).toHaveText('天際');
    await expect(plate.locator('image.map-basemap').first()).toHaveAttribute('href', /^\/maps\/drawn\/schematic\/skyrim/);
    await page.waitForTimeout(500);
    expect(urls.filter((u) => !u.startsWith('/maps/drawn/'))).toEqual([]);
    // Without the official map the footer drops the UESP credit, and the files are not even published.
    await expect(page.locator('.site-footer')).toContainText('非官方粉絲網站');
    await expect(page.locator('.site-footer')).not.toContainText('UESP');
    for (const file of ['tamriel-anthology.webp', 'tamriel-anthology-1440.webp', 'provinces/skyrim.webp', 'provinces/skyrim-1024.webp', 'provinces/cyrodiil.webp']) {
      expect((await page.request.get(`/maps/official/${file}`)).status(), file).toBe(404);
    }
  });
});

test('the level path: the whole path on a desktop; on a phone only "up" and the current level, on one row', async ({ page }, info) => {
  await openApp(page, '/zh-tw/events/oblivion-crisis/');
  await expect(currentMapLayer(page)).toHaveText('賽洛迪爾');
  const up = page.locator('.map-up');
  // Both layouts name the level "up" leads to (the phone shows only "上一層").
  await expect(up).toHaveAccessibleName('返回上一層：泰姆瑞爾');
  const visibleCrumbs = page.locator('.map-path li:visible');
  if (info.project.name === 'mobile') {
    await expect(up).toHaveText(/^↑ ?上一層$/, { useInnerText: true });
    await expect(visibleCrumbs).toHaveCount(1);
    await expect(visibleCrumbs).toHaveText('賽洛迪爾');
    // One row, no taller than the button.
    const nav = (await page.locator('.map-nav').boundingBox())!;
    const btn = (await up.boundingBox())!;
    expect(nav.height).toBeLessThanOrEqual(btn.height + 1);
  } else {
    await expect(up).toHaveText(/^↑ ?返回上一層$/, { useInnerText: true });
    await expect(visibleCrumbs).toHaveCount(4);
  }
});

test('Cyrodiil is the Oblivion game map, credited to the game; the Anthology provinces stop zooming at 2 px per pixel', async ({ page }) => {
  await openApp(page, '/en/events/oblivion-crisis/');
  await expect(page.locator('image.map-basemap').first()).toHaveAttribute('href', /\/maps\/official\/provinces\/cyrodiil(-1024)?\.webp$/);
  await expect(page.locator('.map-cap')).toContainText('The Elder Scrolls IV: Oblivion game map');
  await expect(page.locator('.map-cap a')).toHaveAttribute('href', 'https://en.uesp.net/wiki/File:OB-map-Cyrodiil.jpg');
  // Summerset (the smallest Anthology crop): wheel in hard, the zoom stops at max(cover, 2).
  await openApp(page, '/en/events/aldmer-arrive-summerset/');
  await expect(currentMapLayer(page)).toHaveText('Tamriel');
  await page.getByRole('button', { name: 'Zoom into Summerset Isles' }).click();
  await expect(currentMapLayer(page)).toHaveText('Summerset Isles');
  await settledMapTransform(page);
  const box = (await page.locator('.map-svg').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  for (let i = 0; i < 12; i++) await page.mouse.wheel(0, -400);
  const { k } = await settledMapTransform(page);
  const cover = Math.max(box.width / 566, box.height / 603);
  expect(k).toBeLessThanOrEqual(Math.max(cover, 2) + 1e-6);
});

test('a city on a game-map province does not jump when zooming to Tamriel and back (it glides onto the Anthology glyph)', async ({ page }) => {
  await openApp(page, '/en/events/oblivion-crisis/');
  await settledMapTransform(page);
  const track = (trigger: string) =>
    page.evaluate(async (sel) => {
      const pos = () => {
        const m = [...document.querySelectorAll('.map-svg .map-marker')].find((e) => e.getAttribute('aria-label') === 'Imperial City');
        if (!m) return null;
        const b = m.querySelector('.mk-dot')!.getBoundingClientRect();
        return [b.left + b.width / 2, b.top + b.height / 2];
      };
      const out = [pos()];
      (document.querySelector(sel) as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
      for (let i = 0; i < 70; i++) {
        await new Promise((r) => requestAnimationFrame(r));
        out.push(pos());
      }
      return out;
    }, trigger);
  const maxStep = (pts: (number[] | null)[]) => {
    let max = 0;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      if (a && b) max = Math.max(max, Math.hypot(a[0] - b[0], a[1] - b[1]));
    }
    return max;
  };
  // Up: Cyrodiil -> Tamriel. Without the glide the marker would leap ~11 Tamriel units at the swap.
  const up = await track('.map-up');
  await expect(currentMapLayer(page)).toHaveText('Tamriel');
  expect(maxStep(up)).toBeLessThan(25);
  await settledMapTransform(page);
  // Down again: Tamriel -> Cyrodiil.
  const down = await track('.region[data-region="cyrodiil"]');
  await expect(currentMapLayer(page)).toHaveText('Cyrodiil');
  expect(maxStep(down)).toBeLessThan(25);
});

test('the events-here popup works from the keyboard: focus moves in, Tab stays in it, Esc and x hand focus back', async ({ page }) => {
  await openApp(page, '/en/events/battle-of-red-mountain/');
  await settledMapTransform(page);
  const marker = page.getByRole('button', { name: 'Red Mountain', exact: true });
  const popup = page.getByRole('dialog', { name: 'Red Mountain' });
  await page.keyboard.press('Tab'); // keyboard modality
  await marker.focus();
  await page.keyboard.press('Enter');
  await expect(popup).toBeVisible();
  // Focus lands on the popup's title, and the next Tab reaches its first event.
  await expect(popup.getByRole('heading', { name: 'Red Mountain' })).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(popup.getByRole('listitem').first().getByRole('button')).toBeFocused();
  // Esc closes it and gives the focus back to the marker.
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await expect(marker).toBeFocused();
  // Open again and close with x (reached with Shift+Tab from the title): focus back on the marker too.
  await page.keyboard.press('Enter');
  await expect(popup.getByRole('heading', { name: 'Red Mountain' })).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(popup.getByRole('button', { name: /^(Close|關閉)$/ })).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(popup).toHaveCount(0);
  await expect(marker).toBeFocused();
});

test('a region popup hands focus back to its region', async ({ page }) => {
  await openApp(page, '/en/events/battle-of-red-mountain/');
  await settledMapTransform(page);
  const region = page.locator('.region[data-region="morrowind"]');
  await page.keyboard.press('Tab');
  await region.focus();
  await page.keyboard.press('Enter');
  const popup = page.getByRole('dialog', { name: 'Morrowind' });
  await expect(popup.getByRole('heading', { name: 'Morrowind' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(popup).toHaveCount(0);
  await expect(region).toBeFocused();
});

test('a phone loads the mid-size Tamriel map, not the full one, under 400 KB of map', async ({ page }, info) => {
  test.skip(info.project.name !== 'mobile', 'the density cap is about dense phone screens');
  const sizes: Promise<[string, number]>[] = [];
  page.on('response', (res) => {
    if (res.url().includes('/maps/')) sizes.push(res.body().then((b) => [new URL(res.url()).pathname, b.length]));
  });
  await openApp(page, '/zh-tw/');
  await expect(page.locator('image.map-basemap').first()).toHaveAttribute('href', /tamriel-anthology-1440\.webp$/);
  await page.waitForLoadState('networkidle');
  const maps = await Promise.all(sizes);
  expect(maps.map(([p]) => p)).not.toContain('/maps/official/tamriel-anthology.webp');
  expect(maps.reduce((sum, [, n]) => sum + n, 0)).toBeLessThanOrEqual(400 * 1024);
});

test('while a map image loads, its tiny preview fills the plate; then the image covers it', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((r) => (release = r));
  const previews: string[] = [];
  page.on('request', (req) => {
    if (req.url().endsWith('-preview.webp')) previews.push(new URL(req.url()).pathname);
  });
  await page.route(/\/maps\/official\/provinces\/morrowind\.webp$/, async (route) => {
    await held;
    await route.continue();
  });
  await openApp(page, '/en/events/battle-of-red-mountain/');
  const preview = page.locator('.map-plate image.map-preview');
  await expect(preview).toHaveAttribute('href', '/maps/official/provinces/morrowind-preview.webp');
  await expect(preview).toBeVisible();
  const box = await preview.boundingBox();
  expect(box!.width).toBeGreaterThan(200);
  // The image itself is still on its way.
  await expect(page.locator('.map-plate image.map-basemap')).toHaveAttribute('href', '/maps/official/provinces/morrowind.webp');
  expect(previews).toEqual(['/maps/official/provinces/morrowind-preview.webp']);
  const arrived = page.waitForResponse(/\/maps\/official\/provinces\/morrowind\.webp$/);
  release();
  expect((await arrived).status()).toBe(200);
  // Drawn after the preview, the image covers it.
  const order = await page.locator('.map-svg > g').evaluate((g) => [...g.children].map((c) => c.getAttribute('class')));
  expect(order.indexOf('map-basemap')).toBeGreaterThan(order.indexOf('map-preview'));
});

test.describe('markers too close to tap apart (390 px wide)', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  /** Screen centres of every marker a reader can tap, singles and groups. */
  const markerCentres = (page: Page) =>
    page.locator('.map-plate .map-marker').evaluateAll((els) =>
      els.map((el) => {
        const b = el.querySelector('.mk-hit')!.getBoundingClientRect();
        return { name: el.getAttribute('aria-label')!, active: el.classList.contains('is-active'), x: b.x + b.width / 2, y: b.y + b.height / 2 };
      }),
    );

  // The selected event's own places always stand alone, on top (an event's places may lie close together).
  test('no two tappable markers overlap: close ones merge into a group that names its places', async ({ page }) => {
    await openApp(page, '/en/events/death-of-torygg/');
    await expect(currentMapLayer(page)).toHaveText('Skyrim');
    await settledMapTransform(page);
    const centres = await markerCentres(page);
    expect(centres.length).toBeGreaterThan(5);
    for (let i = 0; i < centres.length; i++) {
      for (let j = i + 1; j < centres.length; j++) {
        const [a, b] = [centres[i], centres[j]];
        if (a.active && b.active) continue;
        expect(Math.hypot(a.x - b.x, a.y - b.y), `${a.name} / ${b.name}`).toBeGreaterThanOrEqual(27.5);
      }
    }
    const group = page.locator('.map-plate .map-marker-group').first();
    await expect(group).toHaveCount(1);
    await expect(group).toHaveAttribute('aria-label', /^\d places: .+, .+/);
  });

  test('tapping a group zooms in until its places can be tapped one by one', async ({ page }) => {
    await openApp(page, '/en/events/death-of-torygg/');
    await settledMapTransform(page);
    const group = page.locator('.map-plate .map-marker-group').first();
    const label = (await group.getAttribute('aria-label'))!;
    const names = label.replace(/^\d places: /, '').split(', ');
    const before = (await settledMapTransform(page)).k;
    // On the dot: the group's box also spans its (hidden) name tag.
    await group.locator('.mk-hit').click();
    await expect.poll(async () => (await settledMapTransform(page)).k).toBeGreaterThan(before);
    const single = (name: string) =>
      page.locator('.map-plate .map-marker:not(.map-marker-group)').and(page.getByRole('button', { name, exact: true }));
    for (const name of names) await expect(single(name)).toHaveCount(1);
    // The focus went on to the first of them.
    await expect(single(names[0])).toBeFocused();
    await single(names[0]).locator('.mk-hit').click();
    await expect(page.locator('.map-popup h3')).toHaveText(names[0]);
  });
});

// decisions/p3-map-drop: the drawn map is only the takedown fallback; the published site shows the official map only.
test('the site offers no map switch and does not publish the drawn map', async ({ page }) => {
  await openApp(page, '/zh-tw/events/battle-of-red-mountain/');
  await expect(page.locator('.map-plate image.map-basemap')).toHaveAttribute('href', /^\/maps\/official\//);
  await expect(page.locator('.map-switch')).toHaveCount(0);
  for (const file of ['tamriel.webp', 'skyrim.webp', 'nirn-1000.webp']) {
    expect((await page.request.get(`/maps/drawn/schematic/${file}`)).status(), file).toBe(404);
  }
});
