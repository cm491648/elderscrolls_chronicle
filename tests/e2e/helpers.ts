import { readFileSync } from 'node:fs';
import { expect, type Locator, type Page } from '@playwright/test';


// Titles and term names come from the content files, so rewriting a story never breaks these tests.
export const readJson = <T>(file: string): T => JSON.parse(readFileSync(file, 'utf-8')) as T;
export const eventTitle = (lang: 'en' | 'zh-tw', id: string) =>
  readFileSync(`src/content/events/${lang}/${id}.md`, 'utf-8').match(/^title:\s*(.+?)\s*$/m)![1].replace(/^(['"])(.*)$/, '$2');
/** The English name a term tooltip shows: the glossary's name wins over a person's (as in src/lib/data.ts). */
export function termEnglishName(id: string): string {
  const glossary = readJson<{ id: string; en: string }[]>('src/content/glossary.json');
  const people = readJson<{ id: string; name: { en: string } }[]>('src/content/people.json');
  const name = glossary.find((g) => g.id === id)?.en ?? people.find((p) => p.id === id)?.name.en;
  if (!name) throw new Error(`no English name for term ${id}`);
  return name;
}
export const RED = { en: eventTitle('en', 'battle-of-red-mountain'), zh: eventTitle('zh-tw', 'battle-of-red-mountain') };
export const MUNDUS_EN = eventTitle('en', 'creation-of-mundus');

export const storyTitle = (page: Page) => page.locator('.story h2');
export const activeMarker = (page: Page) => page.locator('.map-marker.is-active');

export async function openApp(page: Page, path: string) {
  await page.goto(path);
  // Every island has finished hydrating once none is left in its SSR-only state.
  await expect(page.locator('astro-island[ssr]')).toHaveCount(0);
}

/** The zoom transition has ended once the timeline's markup stops changing between frames. */
export async function waitForTimelineSettled(page: Page) {
  const svg = page.locator('.tl-svg');
  let prev = '';
  await expect
    .poll(async () => {
      const cur = await svg.innerHTML();
      const same = cur === prev;
      prev = cur;
      return same;
    }, { intervals: [100], timeout: 5000 })
    .toBe(true);
}

/** Zooms the timeline all the way out (narrow screens open zoomed in around the selection). */
export async function zoomTimelineToFit(page: Page) {
  const zoomOut = page.locator('.timeline').getByRole('button', { name: /^(Zoom out|縮小)$/ });
  // An open same-year list can cover the zoom buttons on a phone: close it first, as a reader would.
  if ((await page.locator('.tl-pick').count()) > 0) {
    await page.keyboard.press('Escape');
    await expect(page.locator('.tl-pick')).toHaveCount(0);
  }
  for (let i = 0; i < 10 && (await zoomOut.isEnabled()); i++) {
    await zoomOut.click();
    await waitForTimelineSettled(page);
  }
  await expect(zoomOut).toBeDisabled();
}

/** Pans the timeline (wheel over the band) until `item` sits in the middle of the drawing, as a reader would drag. */
async function panTimelineTo(page: Page, item: Locator) {
  const plot = (await page.locator('.tl-scroll').boundingBox())!;
  const lanes = (await page.locator('.tl-band').boundingBox())!;
  for (let i = 0; i < 6; i++) {
    const box = await item.boundingBox();
    if (!box) return;
    const off = box.x + box.width / 2 - (plot.x + plot.width / 2);
    if (Math.abs(off) < plot.width / 4) return;
    await page.mouse.move(plot.x + plot.width / 2, lanes.y + 14);
    await page.mouse.wheel(0, off);
    await waitForTimelineSettled(page);
  }
}

/**
 * Zooms through clusters (they chain-merge on narrow viewports) until the event's own dot is a button. A long chain
 * opens about its middle, which can push the event's part of it aside: pan back to it before the next tap. Zoomed in
 * all the way, events of the same year stay one mark that opens a list: the event's button is then its entry there
 * (left open, so no panning, which would close it).
 */
export async function revealTimelineDot(page: Page, title: string) {
  const timeline = page.locator('.timeline');
  const dot = timeline.getByRole('button', { name: title, exact: true });
  await zoomTimelineToFit(page);
  for (let i = 0; i < 12; i++) {
    if ((await dot.count()) > 0) {
      if ((await timeline.locator('.tl-pick').count()) === 0) await panTimelineTo(page, dot);
      return;
    }
    const cluster = timeline.locator(`.tl-cluster[role="button"][aria-label*="${title}"]`).first();
    if ((await cluster.count()) === 0) break;
    await panTimelineTo(page, cluster);
    await cluster.click();
    await waitForTimelineSettled(page);
  }
  await expect(dot).toHaveCount(1);
}
/** Requests for the official map rasters made by the page, recorded from before navigation. */
export function recordRasters(page: Page) {
  const urls: string[] = [];
  page.on('request', (req) => {
    // The map images themselves; the tiny previews shown while they load are checked on their own (map.spec.ts).
    if (req.url().includes('/maps/official/') && !req.url().endsWith('-preview.webp')) urls.push(new URL(req.url()).pathname);
  });
  return urls;
}

/** Positions of every timeline item, as one string: changes whenever the view pans or zooms. */
export const timelineSignature = (page: Page) =>
  page
    .locator('.tl-svg')
    .evaluate((svg) => [...svg.querySelectorAll('[role="button"]')].map((g) => g.getAttribute('transform')).join(';'));

// ---- R8b: drawn Nirn and cosmos rasters, story plates, the drawn-map build ----

export const DRAWN_SITE = 'http://localhost:4322';
export type Plate = { id: string; width: number; height: number; caption: { en: string; 'zh-tw': string } };
export const plates = readJson<Plate[]>('src/content/illustrations.json');

/** The raster a drawn map should use: full once (map width on screen x DPR (at most 2) x zoom) > its small width x 1600/1440. */
export async function expectedRaster(page: Page, layer: 'nirn' | 'cosmos', zoom: number) {
  const spec = { nirn: { w: 1000, h: 600, small: 850 }, cosmos: { w: 1000, h: 1000, small: 512 } }[layer];
  const devicePx = await page.locator('.map-svg').evaluate(
    (svg, s) => {
      const b = svg.getBoundingClientRect();
      // The site caps the density at 2 (MAX_DENSITY in src/lib/map-source.ts).
      return Math.min(b.width / s.w, b.height / s.h) * s.w * Math.min(devicePixelRatio, 2);
    },
    spec,
  );
  const full = devicePx * zoom > (spec.small * 1600) / 1440;
  return `/maps/drawn/${layer}-drawn${full ? '' : `-${spec.small}`}.webp`;
}

// ---- R12: map levels (path, cover framing) ----

/** The map level on screen: the path's current item (e.g. 'Morrowind' for the Battle of Red Mountain). */
export const currentMapLayer = (page: Page) => page.locator('.map-path [aria-current]');
/** A level in the map's path (an ancestor of the current one), as a button. */
export const mapCrumb = (page: Page, name: string) => page.locator('.map-path').getByRole('button', { name, exact: true });

/** The map's zoom transform once it has stopped changing (layer changes and framing zooms have ended). */
export async function settledMapTransform(page: Page) {
  const g = page.locator('.map-svg > g');
  let prev = '';
  await expect
    .poll(async () => {
      const cur = `${await g.getAttribute('transform')}|${await currentMapLayer(page).textContent()}`;
      const same = cur === prev;
      prev = cur;
      return same;
    }, { intervals: [150], timeout: 8000 })
    .toBe(true);
  const m = /translate\(([-\d.e]+),\s*([-\d.e]+)\)\s*scale\(([-\d.e]+)\)/.exec(prev)!;
  return { x: Number(m[1]), y: Number(m[2]), k: Number(m[3]) };
}

/** The raster a layer needs at its current zoom: full once (layer width x zoom x DPR) > its small width x 1600/1440. */
export async function expectedRasterNow(page: Page, layer: 'nirn' | 'cosmos' | 'tamriel') {
  const spec = {
    nirn: { w: 1000, small: 850, full: '/maps/drawn/nirn-drawn.webp', smallHref: '/maps/drawn/nirn-drawn-850.webp' },
    cosmos: { w: 1000, small: 512, full: '/maps/drawn/cosmos-drawn.webp', smallHref: '/maps/drawn/cosmos-drawn-512.webp' },
    tamriel: { w: 1000, small: 1440, full: '/maps/official/tamriel-anthology.webp', smallHref: '/maps/official/tamriel-anthology-1440.webp' },
  }[layer];
  const { k } = await settledMapTransform(page);
  const dpr = await page.evaluate(() => Math.min(devicePixelRatio, 2)); // MAX_DENSITY
  return k * spec.w * dpr > (spec.small * 1600) / 1440 ? spec.full : spec.smallHref;
}
/** Regions lit for the selected event on the map on screen (e.g. Mundus for the creation of Mundus). */
export const activeMapRegion = (page: Page) => page.locator('.map-plate .region.is-active');

/**
 * Up to an ancestor map level: through the path on a desktop, one "up" at a time on a phone (round 3: the phone path
 * shows only the "up" button and the current level).
 */
export async function goUpToMapLayer(page: Page, name: string) {
  const crumb = mapCrumb(page, name);
  if (await crumb.isVisible()) {
    await crumb.click();
    await expect(currentMapLayer(page)).toHaveText(name);
    return;
  }
  for (let i = 0; i < 4; i++) {
    const now = await currentMapLayer(page).textContent();
    if (now === name) return;
    await page.locator('.map-up').click();
    await expect(currentMapLayer(page)).not.toHaveText(now!);
  }
  await expect(currentMapLayer(page)).toHaveText(name);
}
