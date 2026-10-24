import { readFileSync, readdirSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { boxesOverlap } from '../../src/lib/timeline-view';
import {
  eventTitle,
  termEnglishName,
  RED,
  MUNDUS_EN,
  storyTitle,
  currentMapLayer,
  settledMapTransform,
  activeMapRegion,
  activeMarker,
  openApp,
  waitForTimelineSettled,
  zoomTimelineToFit,
  revealTimelineDot,
  timelineSignature,
  plates,
} from './helpers';

test('event URL renders its story and restores the map client-side', async ({ page }) => {
  await openApp(page, '/en/events/battle-of-red-mountain/');
  await expect(storyTitle(page)).toHaveText(RED.en);
  await expect(currentMapLayer(page)).toHaveText('Morrowind');
  await expect(activeMarker(page)).toHaveAttribute('aria-label', 'Red Mountain');
});

test('next button changes selection, URL and history', async ({ page }) => {
  await openApp(page, '/en/events/creation-of-mundus/');
  await expect(storyTitle(page)).toHaveText(MUNDUS_EN);
  await page.getByRole('button', { name: 'Next event' }).click();
  await expect(page).not.toHaveURL(/creation-of-mundus/);
  await expect(storyTitle(page)).not.toHaveText(MUNDUS_EN);
  await page.goBack();
  await expect(page).toHaveURL(/\/en\/events\/creation-of-mundus\/$/);
  await expect(storyTitle(page)).toHaveText(MUNDUS_EN);
});

test('Chinese pages show the English source title under the event name; English pages do not', async ({ page }) => {
  await openApp(page, '/zh-tw/events/battle-of-red-mountain/');
  const sub = page.locator('.story h2 + .story-en');
  await expect(sub).toHaveText(RED.en);
  await expect(sub).toHaveAttribute('lang', 'en');
  await expect(sub).toHaveCSS('font-style', 'italic');
  // It follows the selection.
  await page.getByRole('button', { name: '下一則' }).click();
  await expect(storyTitle(page)).not.toHaveText(RED.zh);
  await expect(sub).not.toHaveText(RED.en);
  await expect(sub).not.toBeEmpty();

  await openApp(page, '/en/events/battle-of-red-mountain/');
  await expect(storyTitle(page)).toHaveText(RED.en);
  await expect(page.locator('.story-en')).toHaveCount(0);
});

test('language switch keeps the event', async ({ page }) => {
  await openApp(page, '/en/events/battle-of-red-mountain/');
  await page.getByRole('link', { name: 'Switch language' }).click();
  await expect(page).toHaveURL(/\/zh-tw\/events\/battle-of-red-mountain\/$/);
  await expect(storyTitle(page)).toHaveText(RED.zh);
});

const langs = [
  { lang: 'en', red: 'Red Mountain', mundus: 'Mundus', morrowind: 'Morrowind', cosmos: 'Cosmos', redTitle: RED.en },
  { lang: 'zh-tw', red: '紅山', mundus: '凡界', morrowind: '晨風', cosmos: '宇宙', redTitle: RED.zh },
];

for (const l of langs) {
  test(`selecting an event moves the map and updates the panel (${l.lang})`, async ({ page }) => {
    await openApp(page, `/${l.lang}/events/creation-of-mundus/`);
    await expect(currentMapLayer(page)).toHaveText(l.cosmos);
    await expect(activeMapRegion(page)).toHaveAttribute('aria-label', l.mundus);

    await revealTimelineDot(page, l.redTitle);
    await page.locator('.timeline').getByRole('button', { name: l.redTitle, exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`/${l.lang}/events/battle-of-red-mountain/$`));
    await expect(storyTitle(page)).toHaveText(l.redTitle);
    await expect(currentMapLayer(page)).toHaveText(l.morrowind);
    await expect(activeMarker(page)).toHaveAttribute('aria-label', l.red);
  });
}

test.describe('root redirect', () => {
  test.use({ locale: 'zh-TW' });

  test('Chinese browsers land on /zh-tw/', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/zh-tw\/$/);
  });
});

test('proper nouns show a tooltip, and notes are collapsed by default', async ({ page }) => {
  await openApp(page, '/zh-tw/events/creation-of-mundus/');
  const term = await readStory(page);
  await term.hover();
  const tip = page.getByRole('tooltip');
  await expect(tip).toBeVisible();
  // The tip shows the term's English name, whichever term it is.
  await expect(tip).toContainText(termEnglishName((await term.getAttribute('data-term'))!));
  await expect(term).toHaveAttribute('aria-describedby', await tip.getAttribute('id') ?? '');
  await page.keyboard.press('Escape');
  await expect(tip).toHaveCount(0);
  await expect(term).not.toHaveAttribute('aria-describedby', /.+/);

  await term.focus();
  await expect(tip).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(tip).toHaveCount(0);

  await page.mouse.move(0, 0);
  await term.click();
  await expect(tip).toBeVisible();
  await page.locator('.story h2').click();
  await expect(tip).toHaveCount(0);

  // The notes are open with every story, at the story's own type size; the reader can still fold them.
  const notes = page.locator('.story-notes');
  await expect(notes).toHaveCount(1);
  await expect(notes).toHaveAttribute('open', /.*/);
  await expect(notes.locator('.notes-body')).toBeVisible();
  // Measure the text itself: a rule on lists once shrank the notes' items under a full-size container.
  const size = (sel: string) => page.locator(sel).first().evaluate((el) => getComputedStyle(el).fontSize);
  expect(await size('.notes-body :is(li, p)')).toBe(await size('.story-body p'));
  await notes.locator('summary').click();
  await expect(notes).not.toHaveAttribute('open', /.*/);
});

test('timeline dots have a hit area of at least 24px, larger than the visible dot', async ({ page }) => {
  await openApp(page, '/en/events/creation-of-mundus/');
  const band = (await page.locator('.tl-scroll').boundingBox())!;
  const zoomIn = page.locator('.timeline').getByRole('button', { name: 'Zoom in', exact: true });
  let target: { name: string; box: { x: number; y: number; width: number; height: number } } | null = null;
  for (let i = 0; i < 6 && !target; i++) {
    for (const dot of await page.locator('.tl-dot:not(.is-selected)').all()) {
      const box = await dot.boundingBox();
      if (box && box.x >= band.x + 24 && box.x + box.width <= band.x + band.width - 24) {
        target = { name: (await dot.getAttribute('aria-label'))!, box };
        break;
      }
    }
    if (!target) {
      await zoomIn.click();
      await waitForTimelineSettled(page);
    }
  }
  expect(target).not.toBeNull();
  const { name, box } = target!;
  expect(box.width).toBeGreaterThanOrEqual(24);
  expect(box.height).toBeGreaterThanOrEqual(24);
  // 10px right of the centre is outside the 12px dot but inside the hit circle.
  await page.mouse.click(box.x + box.width / 2 + 10, box.y + box.height / 2);
  await expect(storyTitle(page)).toHaveText(name);
  await expect(page.locator('.timeline').getByRole('button', { name, exact: true })).toHaveAttribute('aria-pressed', 'true');
});

test('the mouse wheel pans the timeline from anywhere on the band', async ({ page }) => {
  await openApp(page, '/en/events/great-war/');
  const zoomIn = page.locator('.timeline').getByRole('button', { name: 'Zoom in', exact: true });
  for (let i = 0; i < 2; i++) {
    await zoomIn.click();
    await waitForTimelineSettled(page);
  }
  // Changing the selection scrolls it into view, so its title overlay is on the band.
  await page.getByRole('button', { name: 'Previous event' }).click();
  await waitForTimelineSettled(page);
  // The part of the lanes on screen: the drawing's width, the scrolling band's height.
  const plot = (await page.locator('.tl-scroll').boundingBox())!;
  const lanes = (await page.locator('.tl-band').boundingBox())!;
  const band = { x: plot.x, width: plot.width, y: lanes.y, height: lanes.height };
  const points: [number, number][] = [
    [band.x + 8, band.y + 6], // top-left corner, by the era names
    [band.x + band.width - 8, band.y + 6], // top-right corner
    [band.x + band.width / 2, band.y + band.height - 4], // bottom edge, under the axis
    [band.x + 8, band.y + band.height / 2], // left end of the axis
  ];
  const label = (await page.locator('.tl-sel-label').boundingBox())!;
  points.push([label.x + label.width / 2, label.y + label.height / 2]); // over the selected title overlay
  let delta = -120;
  for (const [x, y] of points) {
    const before = await timelineSignature(page);
    await page.mouse.move(x, y);
    await page.mouse.wheel(0, delta);
    await expect.poll(() => timelineSignature(page), { timeout: 2000 }).not.toBe(before);
    delta = -delta;
  }
  // The svg covers nearly all of the band, so also prove the listener is on .tl-scroll itself: a wheel event
  // dispatched on the band (it never reaches the svg inside) must still pan.
  const before = await timelineSignature(page);
  const handled = await page.locator('.tl-scroll').evaluate((el, deltaY) => {
    const ev = new WheelEvent('wheel', { deltaY, bubbles: true, cancelable: true });
    el.dispatchEvent(ev);
    return ev.defaultPrevented;
  }, delta);
  expect(handled).toBe(true);
  await expect.poll(() => timelineSignature(page), { timeout: 2000 }).not.toBe(before);
});

test('era names stay out of the edge fade, which still covers the axis and the events', async ({ page }) => {
  await openApp(page, '/zh-tw/events/creation-of-mundus/');
  const svg = page.locator('.tl-svg');
  await expect(svg.locator('.era-name').first()).toBeVisible();
  const faded = await svg.evaluate((root) => {
    /** Every element from `el` up to <html> that masks or dims what it draws. */
    const dimmers = (el: Element) => {
      const found: string[] = [];
      for (let n: Element | null = el; n; n = n.parentElement) {
        const cs = getComputedStyle(n);
        const mask = cs.maskImage || cs.getPropertyValue('-webkit-mask-image');
        if ((mask && mask !== 'none') || Number(cs.opacity) < 1) found.push(n.getAttribute('class') ?? n.tagName);
      }
      return found;
    };
    return {
      eraNames: [...root.querySelectorAll('.era-name')].map(dimmers).filter((d) => d.length > 0),
      dots: [...root.querySelectorAll('.tl-dot, .tl-cluster')].map(dimmers).filter((d) => d.length > 0).length,
      total: root.querySelectorAll('.tl-dot, .tl-cluster').length,
    };
  });
  expect(faded.eraNames).toEqual([]);
  expect(faded.total).toBeGreaterThan(0);
  expect(faded.dots).toBe(faded.total);
});

test('the term tooltip sits outside the live region, can be hovered, and closes when the story scrolls', async ({ page }) => {
  await openApp(page, '/zh-tw/events/creation-of-mundus/');
  const term = await readStory(page);
  const tip = page.getByRole('tooltip');

  await term.hover();
  await expect(tip).toBeVisible();
  await expect(page.locator('[aria-live] [role="tooltip"]')).toHaveCount(0);
  await expect(term).toHaveClass(/is-open/);

  // WCAG 1.4.13: the pointer can move from the term into the tooltip without it closing.
  const t = (await term.boundingBox())!;
  const b = (await tip.boundingBox())!;
  const x = Math.min(Math.max(t.x + t.width / 2, b.x + 4), b.x + b.width - 4);
  await page.mouse.move(x, b.y > t.y ? b.y + 6 : b.y + b.height - 6, { steps: 4 });
  // Past the 200ms close delay it is still open: visible on five polls in a row, 100ms apart.
  await stillVisible(tip, 5);
  await page.mouse.move(1, 1);
  await expect(tip).toHaveCount(0);

  await term.focus();
  await expect(tip).toBeVisible();
  // A resize (phone address bar, on-screen keyboard) re-places the tooltip instead of closing it.
  const size = page.viewportSize()!;
  await page.setViewportSize({ width: size.width, height: size.height - 40 });
  await stillVisible(tip, 3);
  await page.setViewportSize(size);
  await expect(tip).toBeVisible();
  // Side by side the story's column scrolls; on narrow screens the page does.
  await scrollStory(page, 60);
  await expect(tip).toHaveCount(0);
});

test('the story plate sits after the middle paragraph, framed, captioned, sized before it loads', async ({ page }) => {
  const id = 'night-of-tears';
  const data = plates.find((p) => p.id === id)!;
  await openApp(page, `/zh-tw/events/${id}/`);
  const fig = page.locator('.story-body figure.story-plate');
  await expect(fig).toHaveCount(1);
  const img = fig.locator('img');
  await expect(img).toHaveAttribute('loading', 'lazy');
  await expect(img).toHaveAttribute('width', String(data.width));
  await expect(img).toHaveAttribute('height', String(data.height));
  await expect(img).toHaveAttribute(
    'srcset',
    `/illustrations/${id}-640.webp 640w, /illustrations/${id}-960.webp 960w, /illustrations/${id}.webp ${data.width}w`,
  );
  // The caption names the figure (read once, and visible to everyone); the image itself is alt="".
  await expect(img).toHaveAttribute('alt', '');
  await expect(fig.locator('figcaption')).toHaveText(`圖一${data.caption['zh-tw']}`);
  await expect(fig.locator('figcaption')).not.toHaveAttribute('aria-hidden', /.*/);
  await expect(page.getByRole('figure', { name: `圖一${data.caption['zh-tw']}` })).toHaveCount(1);
  await expect(fig.locator('figcaption b')).toHaveText('圖一');

  // Middle of the story: ceil(n/2) paragraphs before the plate, the rest after.
  const [before, after] = await page.locator('.story-body').evaluate((body) => [
    body.querySelectorAll(':scope > .story-part:first-child > p').length,
    body.querySelectorAll(':scope > figure ~ .story-part > p').length,
  ]);
  expect(before).toBe(Math.ceil((before + after) / 2));
  expect(after).toBeGreaterThan(0);

  // The width and height attributes reserve the box: its aspect ratio holds whether or not the image has loaded.
  const box = (await img.boundingBox())!;
  expect(Math.abs(box.height / box.width - data.height / data.width)).toBeLessThan(0.02);
  await expect(img).toHaveCSS('border-top-width', '1px');
  await expect(img).toHaveCSS('outline-style', 'solid');
  await img.scrollIntoViewIfNeeded();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  const loaded = (await img.boundingBox())!;
  expect(Math.abs(loaded.height - box.height)).toBeLessThan(1);

  // English pages: same plate, English caption, "Plate I".
  await openApp(page, `/en/events/${id}/`);
  await expect(page.locator('figure.story-plate figcaption')).toHaveText(`Plate I${data.caption.en}`);
});

// ---- R12-1: full-width layout (timeline › map › story), story only once an event is chosen ----

const mapWrap = (page: Page) => page.locator('#map-wrap');
/** Wide screens (>= 900px) show the map and the story side by side; narrow ones stack them. */
const isWide = (page: Page) => page.viewportSize()!.width >= 900;
/** Scrolls whatever holds the story: its own column side by side, the page on narrow screens. */
const scrollStory = (page: Page, dy: number) =>
  page.evaluate((d) => {
    const col = document.querySelector('.story-col');
    if (col && col.scrollHeight > col.clientHeight && getComputedStyle(col).overflowY !== 'visible') col.scrollBy(0, d);
    else scrollBy(0, d);
  }, dy);
const mapToggle = (page: Page) => page.locator('.map-toggle');
/** Scrolls the page down in small steps, as a reader would, so every step fires its own scroll event. */
async function readDown(page: Page, steps = 8, by = 160) {
  for (let i = 0; i < steps; i++) {
    // Two frames after each step its scroll event has been handled, so every step counts on its own.
    await page.evaluate(
      (dy) =>
        new Promise<void>((r) => {
          scrollBy(0, dy);
          requestAnimationFrame(() => requestAnimationFrame(() => r()));
        }),
      by,
    );
  }
}
/** Passes once `loc` has been visible on `polls` polls in a row (100ms apart); fails if it disappears for good. */
async function stillVisible(loc: ReturnType<Page['locator']>, polls: number) {
  let streak = 0;
  await expect
    .poll(async () => {
      streak = (await loc.isVisible()) ? streak + 1 : 0;
      return streak;
    }, { intervals: [100] })
    .toBeGreaterThanOrEqual(polls);
}
/**
 * Puts the page where a reader of the story would be: scrolled into the story with the map folded away, and returns
 * a term from the middle of the story, now in the middle of the screen. (Hovering a term from the top of the page
 * would scroll, fold the map and move the term out from under the pointer mid-action; a term from the opening lines
 * would sit so close to the top that centring it unfolds the map again.)
 */
async function readStory(page: Page) {
  const terms = page.locator('.story-body .term');
  if (isWide(page)) {
    // Side by side nothing folds: bring a middle term into view in the story's own column.
    const term = terms.nth(Math.floor((await terms.count()) / 2));
    await term.evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await scrollSettled(page);
    return term;
  }
  await readDown(page, 4);
  await expect(mapWrap(page)).toHaveClass(/is-folded/);
  await expect.poll(async () => (await mapWrap(page).boundingBox())?.height ?? 0).toBeLessThan(1);
  const term = terms.nth(Math.floor((await terms.count()) / 2));
  await term.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await scrollSettled(page);
  await expect(mapWrap(page)).toHaveClass(/is-folded/);
  return term;
}
/** Waits until the page has stopped scrolling (smooth scrolls included) and its scroll events have been delivered. */
async function scrollSettled(page: Page) {
  let prev = -1;
  await expect
    .poll(async () => {
      // The page's and the story column's scroll positions together.
      const y = await page.evaluate(
        () =>
          new Promise<number>((r) =>
            requestAnimationFrame(() => requestAnimationFrame(() => r(scrollY + (document.querySelector('.story-col')?.scrollTop ?? 0) * 1e6))),
          ),
      );
      const same = y === prev;
      prev = y;
      return same;
    }, { intervals: [100] })
    .toBe(true);
}

for (const home of [
  { path: '/zh-tw/', title: '上古卷軸編年史', hint: '請在時間軸或地圖上選擇一則事件。' },
  { path: '/en/', title: 'Elder Scrolls Chronicle', hint: 'Select an event on the timeline or the map.' },
]) {
  test(`the home page shows the timeline and the map, but no story (${home.path})`, async ({ page }) => {
    await openApp(page, home.path);
    await expect(page.locator('.story-pane')).toHaveCount(0);
    await expect(page.locator('.story')).toHaveCount(0);
    await expect(page.locator('.map-plate')).toBeVisible();
    await expect(page.locator('.map-hint')).toHaveText(home.hint);
    await expect(page.locator('.timeline [aria-pressed="true"]')).toHaveCount(0);
    await expect(page).toHaveTitle(home.title);
    await expect(page).toHaveURL(new RegExp(`${home.path}$`));
    // With no story the map takes the rest of the screen.
    const plate = (await page.locator('.map-plate').boundingBox())!;
    expect(plate.height).toBeGreaterThan(page.viewportSize()!.height * 0.3);
  });
}

test('narrow screens: choosing an event shows its story under the map; closing it returns to the home page', async ({ page }) => {
  test.skip(isWide(page), 'narrow screens stack the story under the map (side by side: see below)');
  await openApp(page, '/en/');
  await revealTimelineDot(page, RED.en);
  await page.locator('.timeline').getByRole('button', { name: RED.en, exact: true }).click();
  await expect(page).toHaveURL(/\/en\/events\/battle-of-red-mountain\/$/);
  await expect(storyTitle(page)).toHaveText(RED.en);
  await expect(storyTitle(page)).toBeInViewport();
  await expect(page).toHaveTitle(`${RED.en} | Elder Scrolls Chronicle`);
  // Top to bottom: timeline, map, story; the map is the full width of the page.
  await scrollSettled(page);
  const tl = (await page.locator('.timeline').boundingBox())!;
  const map = (await page.locator('.map-plate').boundingBox())!;
  const story = (await page.locator('.story-pane').boundingBox())!;
  expect(map.y).toBeGreaterThanOrEqual(tl.y + tl.height - 1);
  expect(story.y).toBeGreaterThanOrEqual(map.y + map.height - 1);
  const vw = page.viewportSize()!.width;
  expect(map.width).toBeGreaterThan(vw * 0.85);
  // The story column keeps a reading width, centred.
  expect(Math.abs(story.x + story.width / 2 - vw / 2)).toBeLessThan(2);
  expect(story.width).toBeLessThanOrEqual(680);
  // The map, now shorter than on the home page, still frames the chosen place.
  await expect(activeMarker(page)).toHaveAttribute('aria-label', 'Red Mountain');
  await settledMapTransform(page);
  await scrollSettled(page);
  const m = (await activeMarker(page).locator('.mk-hit').boundingBox())!;
  const p = (await page.locator('.map-plate').boundingBox())!;
  const [cx, cy] = [m.x + m.width / 2, m.y + m.height / 2];
  expect(cx > p.x && cx < p.x + p.width && cy > p.y && cy < p.y + p.height).toBe(true);

  await page.getByRole('button', { name: 'Close story' }).click();
  await expect(page.locator('.story-pane')).toHaveCount(0);
  await expect(page).toHaveURL(/\/en\/$/);
  await expect(page).toHaveTitle('Elder Scrolls Chronicle');
  await expect(page.locator('.timeline [aria-pressed="true"]')).toHaveCount(0);
  // Focus lands back on the timeline, not on the page body.
  await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.timeline'))).toBe(true);
  await expect(page.getByRole('link', { name: 'Switch language' })).toHaveAttribute('href', '/zh-tw/');

  // History: back reopens the story, forward closes it again.
  await page.goBack();
  await expect(storyTitle(page)).toHaveText(RED.en);
  await page.goForward();
  await expect(page.locator('.story-pane')).toHaveCount(0);
});

test('an event URL opens with its story and a close button; Next on the home page starts at the first event', async ({ page }) => {
  await openApp(page, '/zh-tw/events/battle-of-red-mountain/');
  await expect(storyTitle(page)).toHaveText(RED.zh);
  const close = page.getByRole('button', { name: '關閉故事' });
  await expect(close).toBeVisible();
  await expect(close).toContainText('關閉');

  await openApp(page, '/zh-tw/');
  await expect(page.getByRole('button', { name: '上一則' })).toBeDisabled();
  await page.getByRole('button', { name: '下一則' }).click();
  await expect(page).toHaveURL(/\/zh-tw\/events\/creation-of-mundus\/$/);
  await expect(storyTitle(page)).toHaveText(eventTitle('zh-tw', 'creation-of-mundus'));
});

test('reading down a long story folds the map away; the timeline stays; Show map or the top unfolds it', async ({ page }) => {
  test.skip(isWide(page), 'narrow screens only: side by side nothing folds');
  await openApp(page, '/en/events/creation-of-mundus/');
  await expect(mapToggle(page)).toHaveAttribute('aria-expanded', 'true');
  await readDown(page);
  await expect(mapWrap(page)).toHaveClass(/is-folded/);
  await expect(mapWrap(page)).toHaveAttribute('inert', /.*/);
  await expect(mapToggle(page)).toHaveAttribute('aria-expanded', 'false');
  await expect(mapToggle(page)).toHaveText('Show map');
  await expect.poll(async () => (await mapWrap(page).boundingBox())?.height ?? 0).toBeLessThan(1);
  // The timeline is still pinned to the top of the screen, and the story is what the reader sees.
  const tl = (await page.locator('.timeline').boundingBox())!;
  expect(tl.y).toBeLessThan(20);
  await expect(page.locator('.story-body')).toBeInViewport();

  // The button unfolds it in place, under the timeline.
  await mapToggle(page).click();
  await expect(mapWrap(page)).not.toHaveClass(/is-folded/);
  await expect(mapToggle(page)).toHaveText('Hide map');
  await expect(page.locator('.map-plate')).toBeInViewport();

  // Reading on folds it again; scrolling back to the top unfolds it.
  await readDown(page, 4);
  await expect(mapWrap(page)).toHaveClass(/is-folded/);
  await page.evaluate(() => scrollTo(0, 0));
  await expect(mapWrap(page)).not.toHaveClass(/is-folded/);
  await expect(page.locator('.map-plate')).toBeInViewport();
});

test('choosing another event while deep in a story unfolds the map and returns to the story opening', async ({ page }) => {
  test.skip(isWide(page), 'narrow screens only: side by side nothing folds');
  await openApp(page, '/en/events/creation-of-mundus/');
  await readDown(page);
  await expect(mapWrap(page)).toHaveClass(/is-folded/);
  await page.getByRole('button', { name: 'Next event' }).click();
  await expect(storyTitle(page)).not.toHaveText(MUNDUS_EN);
  await expect(mapWrap(page)).not.toHaveClass(/is-folded/);
  await expect(storyTitle(page)).toBeInViewport();
  await expect(page.locator('.map-plate')).toBeInViewport();
});

test.describe('reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  test('the map folds without an animation', async ({ page }) => {
    test.skip(isWide(page), 'narrow screens only: side by side nothing folds');
    await openApp(page, '/en/events/creation-of-mundus/');
    expect(await mapWrap(page).evaluate((el) => getComputedStyle(el).transitionDuration)).toMatch(/^0s(, 0s)*$/);
    await readDown(page);
    await expect(mapWrap(page)).toHaveClass(/is-folded/);
    expect(await mapWrap(page).evaluate((el) => el.getBoundingClientRect().height)).toBe(0);
  });
});

for (const l of [
  { lang: 'en', unknown: 'Unknown' },
  { lang: 'zh-tw', unknown: '未知' },
]) {
  test(`timeline dots carry their year, "${l.unknown}" when undated, ranges on clusters, never overlapping (${l.lang})`, async ({ page }) => {
    await openApp(page, `/${l.lang}/`);
    await zoomTimelineToFit(page);
    const years = page.locator('.tl-year');
    // Zoomed all the way out a phone has room for only a couple of (range) labels once the chronicle is crowded.
    expect(await years.count()).toBeGreaterThan(isWide(page) ? 2 : 1);
    // An approximate year reads `c. 1E 792` / `約 1E 792`, also at either end of a range.
    const end = `(${l.unknown}|(c\\. |約 )?[1-4]E \\d+)`;
    for (const text of await years.allTextContents()) expect(text).toMatch(new RegExp(`^${end}(–(${end}|\\d+))?$`));
    expect((await years.allTextContents()).some((x) => x.includes('–'))).toBe(true);
    expect((await years.allTextContents()).some((x) => x.includes(l.unknown))).toBe(true);
    // No two labels share any area: side by side on a lane, or on lanes one above the other.
    const boxes = await years.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().toJSON() as DOMRect));
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) expect(boxesOverlap(boxes[i], boxes[j]), `labels ${i} and ${j}`).toBe(false);
  });

  test(`the selected event's year label: "${l.unknown}" for the undated dawn of time, era and year otherwise (${l.lang})`, async ({ page }) => {
    await openApp(page, `/${l.lang}/events/creation-of-mundus/`);
    await expect(page.locator('.tl-year.is-selected')).toHaveText(l.unknown);
    // Screen readers hear the year too, as the item's description (the visible labels are aria-hidden).
    const mundus = eventTitle(l.lang as 'en' | 'zh-tw', 'creation-of-mundus');
    // Several undated events share the dawn of time: open their cluster down to this event's own dot.
    await revealTimelineDot(page, mundus);
    await expect(page.locator('.timeline').getByRole('button', { name: mundus, exact: true })).toHaveAccessibleDescription(l.unknown);
    await openApp(page, `/${l.lang}/events/battle-of-red-mountain/`);
    if ((await page.locator('.tl-dot.is-selected').count()) === 0) await revealTimelineDot(page, l.lang === 'en' ? RED.en : RED.zh);
    await expect(page.locator('.tl-year.is-selected')).toHaveText('1E 700');
    const red = page.locator('.timeline').getByRole('button', { name: l.lang === 'en' ? RED.en : RED.zh, exact: true });
    await expect(red).toHaveAccessibleDescription('1E 700');
    // A cluster describes its range: zoomed all the way out there are always some.
    await zoomTimelineToFit(page);
    await expect(page.locator('.tl-cluster').first()).toHaveAccessibleDescription(/^(未知|Unknown|[1-4]E \d+)(–.+)?$/);
  });
}

// ---- R12-2: self-hosted fonts ----

test('fonts are self-hosted: nothing from Google Fonts; Chinese pages use one site subset per Chinese face', async ({ page }) => {
  const fonts: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'font' || /fonts\.(googleapis|gstatic)\.com/.test(r.url())) fonts.push(r.url());
  });
  await openApp(page, '/zh-tw/events/battle-of-red-mountain/');
  await expect(page.locator('link[href*="fonts.googleapis"], link[href*="fonts.gstatic"]')).toHaveCount(0);
  // The font stylesheet is applied after load, so wait for the faces themselves.
  const loaded = (family: string) =>
    page.evaluate((f) => [...document.fonts].some((x) => x.family.replace(/["']/g, '') === f && x.status === 'loaded'), family);
  for (const family of ['Noto Sans TC', 'Noto Serif TC', 'Alegreya', 'Alegreya Sans']) await expect.poll(() => loaded(family)).toBe(true);
  await page.waitForLoadState('networkidle');
  const origin = new URL(page.url()).origin;
  expect(fonts.length).toBeGreaterThan(0);
  for (const url of fonts) {
    expect(new URL(url).origin).toBe(origin);
    expect(url).toMatch(/\.woff2$/);
  }
  // Chinese: exactly the three subsets (Noto Sans TC 400 / 700, Noto Serif TC 700; decisions/round3), no slices.
  const noto = fonts.filter((u) => /noto/i.test(u)).map((u) => new URL(u).pathname.replace(/^.*\/(noto-[a-z-]+-\d00)-.*$/, '$1'));
  expect(noto.sort()).toEqual(['noto-sans-tc-400', 'noto-sans-tc-700', 'noto-serif-tc-700']);
  expect(fonts.length).toBeLessThanOrEqual(10);
  // The Chinese stylesheet is small: Alegreya's slices plus three Noto faces (scripts/font-subset.mjs).
  const css = await page.locator('#site-fonts').getAttribute('href');
  const text = await (await page.request.get(css!)).text();
  expect(text.length).toBeLessThan(60_000);
  expect(text.match(/font-family:\s*['"]?Noto (Sans|Serif) TC/g)).toHaveLength(3);
  // The OFL text of every family ships with the site (OFL 1.1 section 2; the subsets also keep it in their name table).
  for (const file of ['OFL-NotoSansTC.txt', 'OFL-NotoSerifTC.txt', 'OFL-Alegreya.txt', 'OFL-AlegreyaSans.txt']) {
    const res = await page.request.get(`/fonts/${file}`);
    expect(res.status(), file).toBe(200);
    expect(await res.text()).toMatch(/SIL OPEN FONT LICENSE/i);
  }
});

test('every character on the Chinese pages is in the Chinese font subset', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the same pages on both projects; once is enough');
  await openApp(page, '/zh-tw/');
  const css = await page.locator('#site-fonts').getAttribute('href');
  const text = await (await page.request.get(css!)).text();
  const range = /font-family:\s*['"]?Noto Sans TC['"]?;[^}]*unicode-range:\s*([^;}]+)/.exec(text)![1];
  const covered = range.split(',').map((part) => {
    const [lo, hi = lo] = part.trim().replace(/^u\+/i, '').split('-');
    return [parseInt(lo, 16), parseInt(hi, 16)];
  });
  const inSubset = (cp: number) => covered.some(([lo, hi]) => cp >= lo && cp <= hi);
  const ids = readdirSync('src/content/events/zh-tw').map((f) => f.replace(/\.md$/, ''));
  const missing = new Map<string, string>();
  for (const path of ['/zh-tw/', ...ids.map((id) => `/zh-tw/events/${id}/`)]) {
    // The page's HTML holds every story, note, caption and interface string it can show (notes collapsed or not),
    // and the island's props hold what it renders later (other stories, term tooltips, map names).
    const body = await (await page.request.get(path)).text();
    for (const ch of body) {
      const cp = ch.codePointAt(0)!;
      // From U+00A0 up, like the subset itself (dashes, ellipses and middle dots included); ASCII is Alegreya's.
      if (cp >= 0xa0 && !inSubset(cp)) missing.set(ch, path);
    }
  }
  expect([...missing].map(([ch, path]) => `${ch} (${path})`)).toEqual([]);
});

test('every character the Chinese pages draw in the serif face or in bold sans is in the subset of that face', async ({ page }, info) => {
  test.skip(info.project.name !== 'desktop', 'the same pages on both projects; once is enough');
  test.setTimeout(180_000);
  await openApp(page, '/zh-tw/');
  const css = await page.locator('#site-fonts').getAttribute('href');
  const text = await (await page.request.get(css!)).text();
  const rangeOf = (face: RegExp) => {
    const range = face.exec(text)![1];
    const covered = range.split(',').map((part) => {
      const [lo, hi = lo] = part.trim().replace(/^u\+/i, '').split('-');
      return [parseInt(lo, 16), parseInt(hi, 16)];
    });
    return (cp: number) => covered.some(([lo, hi]) => cp >= lo && cp <= hi);
  };
  const inFace = {
    serif: rangeOf(/font-family:\s*['"]?Noto Serif TC['"]?;[^}]*unicode-range:\s*([^;}]+)/),
    bold: rangeOf(/font-family:\s*['"]?Noto Sans TC['"]?;[^}]*font-weight:\s*700;[^}]*unicode-range:\s*([^;}]+)/),
  };
  const ids = readdirSync('src/content/events/zh-tw').map((f) => f.replace(/\.md$/, ''));
  const missing = new Map<string, string>();
  const seen = { serif: 0, bold: 0 };
  for (const path of ['/zh-tw/', ...ids.map((id) => `/zh-tw/events/${id}/`)]) {
    if (path !== '/zh-tw/') await openApp(page, path);
    // The text of every element set in the serif face (titles, map and timeline labels, rubrics) or in bold sans
    // (terms and note headings in the story, labels), closed notes included.
    const drawn = await page.evaluate(() => {
      const out = { serif: '', bold: '' };
      for (const el of document.querySelectorAll('body *')) {
        const style = getComputedStyle(el);
        const face = style.fontFamily.includes('Noto Serif TC') ? 'serif' : Number(style.fontWeight) >= 600 ? 'bold' : null;
        if (!face) continue;
        for (const n of el.childNodes) if (n.nodeType === Node.TEXT_NODE) out[face] += n.textContent;
      }
      return out;
    });
    for (const face of ['serif', 'bold'] as const) {
      for (const ch of drawn[face]) {
        const cp = ch.codePointAt(0)!;
        if (cp >= 0x3000) seen[face]++;
        if (cp >= 0xa0 && !inFace[face](cp)) missing.set(`${face} ${ch}`, path);
      }
    }
  }
  expect(seen.serif).toBeGreaterThan(1000);
  expect(seen.bold).toBeGreaterThan(1000);
  expect([...missing].map(([ch, path]) => `${ch} (${path})`)).toEqual([]);
});

test('English pages load the Latin fonts only', async ({ page }) => {
  const fonts: string[] = [];
  page.on('request', (r) => {
    if (r.resourceType() === 'font') fonts.push(r.url());
  });
  await openApp(page, '/en/events/battle-of-red-mountain/');
  await expect
    .poll(() => page.evaluate(() => [...document.fonts].some((x) => x.family.replace(/["']/g, '') === 'Alegreya' && x.status === 'loaded')))
    .toBe(true);
  await page.waitForLoadState('networkidle');
  expect(fonts.length).toBeGreaterThan(0);
  expect(fonts.length).toBeLessThanOrEqual(6);
  expect(fonts.filter((u) => /noto/i.test(u))).toEqual([]);
  const css = await page.locator('#site-fonts').getAttribute('href');
  const text = await (await page.request.get(css!)).text();
  expect(text).not.toContain('Noto');
  expect(text.length).toBeLessThan(20_000);
});

// ---- Side by side (wide screens, ≥ 900px): the map fills the window under the timeline, the story has its column ----

test.describe('side by side (wide screens)', () => {
  test.skip(({ viewport }) => (viewport?.width ?? 0) < 900, 'wide screens only');

  test('the map is the rest of the window high, the story column sits beside it and scrolls on its own', async ({ page }) => {
    await openApp(page, '/en/events/creation-of-mundus/');
    const vh = page.viewportSize()!.height;
    const vw = page.viewportSize()!.width;
    // The map is sized from the measured header and timeline heights, which can change once the web fonts swap in
    // (slower machines, CI): wait for the layout to settle on the window's foot before measuring the rest.
    await expect
      .poll(async () => {
        const m = (await mapWrap(page).boundingBox())!;
        return Math.abs(m.y + m.height - vh);
      })
      .toBeLessThan(2);
    const tl = (await page.locator('.tl-wrap').boundingBox())!;
    const map = (await mapWrap(page).boundingBox())!;
    const col = (await page.locator('.story-col').boundingBox())!;
    // Map: from the timeline's foot to the window's foot.
    expect(Math.abs(map.y - (tl.y + tl.height))).toBeLessThan(2);
    expect(Math.abs(map.y + map.height - vh)).toBeLessThan(2);
    // Story column: on the right, clamp(400px, 34vw, 560px) wide, as high as the map.
    expect(col.x).toBeGreaterThanOrEqual(map.x + map.width - 1);
    expect(col.width).toBeGreaterThanOrEqual(400 - 1);
    expect(col.width).toBeLessThanOrEqual(560 + 1);
    expect(Math.abs(col.width - Math.min(560, Math.max(400, vw * 0.34)))).toBeLessThan(2);
    expect(Math.abs(col.y - map.y)).toBeLessThan(2);
    expect(Math.abs(col.height - map.height)).toBeLessThan(2);
    // No fold button side by side, and the footer is at the foot of the story column.
    await expect(mapToggle(page)).toHaveCount(0);
    await expect(page.locator('.story-col .site-footer')).toHaveCount(1);
    // The page does not scroll; the story column does.
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(vh + 1);
    const before = (await storyTitle(page).boundingBox())!.y;
    await page.locator('.story-col').evaluate((el) => el.scrollBy(0, 300));
    await expect.poll(async () => (await storyTitle(page).boundingBox())!.y).toBeLessThan(before - 200);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    expect((await mapWrap(page).boundingBox())!.y).toBeCloseTo(map.y, 0);
    // The keyboard reads the timeline, then the map, then the story.
    const order = await page.evaluate(() => {
      const [a, b, c] = ['.tl-wrap', '#map-wrap', '.story-col'].map((s) => document.querySelector(s)!);
      return [a.compareDocumentPosition(b), b.compareDocumentPosition(c)].map((p) => !!(p & Node.DOCUMENT_POSITION_FOLLOWING));
    });
    expect(order).toEqual([true, true]);
  });

  test('a story that opens takes the focus on its title; keys scroll its column; closing widens the map back', async ({ page }) => {
    await openApp(page, '/en/');
    const full = (await mapWrap(page).boundingBox())!;
    await revealTimelineDot(page, MUNDUS_EN);
    await page.locator('.timeline').getByRole('button', { name: MUNDUS_EN, exact: true }).click();
    await expect(storyTitle(page)).toBeFocused();
    await expect.poll(async () => (await mapWrap(page).boundingBox())!.width).toBeLessThan(full.width - 300);
    const col = page.locator('.story-col');
    await page.keyboard.press('PageDown');
    await expect.poll(() => col.evaluate((el) => el.scrollTop)).toBeGreaterThan(100);
    expect(await page.evaluate(() => scrollY)).toBe(0);
    // Stepping to the next story keeps the focus on the button and starts the new story at the top of its column.
    await page.getByRole('button', { name: 'Next event' }).click();
    await expect(storyTitle(page)).not.toHaveText(MUNDUS_EN);
    await expect(page.getByRole('button', { name: 'Next event' })).toBeFocused();
    await expect.poll(() => col.evaluate((el) => el.scrollTop)).toBe(0);
    await page.getByRole('button', { name: 'Close story' }).click();
    await expect(page.locator('.story-col')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('.timeline'))).toBe(true);
    // The map widens back to the whole width (a 0.3s transition) and keeps the window's height.
    await expect.poll(async () => Math.round((await mapWrap(page).boundingBox())!.width)).toBe(Math.round(full.width));
    expect(Math.abs((await mapWrap(page).boundingBox())!.height - full.height)).toBeLessThan(2);
  });

  test.describe('reduced motion', () => {
    test.use({ reducedMotion: 'reduce' });

    test('closing the story widens the map at once', async ({ page }) => {
      await openApp(page, '/en/events/great-war/');
      expect(await page.locator('.stage').evaluate((el) => getComputedStyle(el).transitionDuration)).toMatch(/^0s(, 0s)*$/);
      await page.getByRole('button', { name: 'Close story' }).click();
      const vw = page.viewportSize()!.width;
      expect((await mapWrap(page).boundingBox())!.width).toBeGreaterThan(vw - 60);
    });
  });
});

// ---- Map credit: one short line on narrow screens, the whole credit side by side ----

for (const c of [
  { path: '/zh-tw/events/battle-of-red-mountain/', short: '地圖：Anthology ·', link: true, full: '地圖：The Elder Scrolls Anthology 附贈地圖，© Bethesda Softworks／ZeniMax Media；取自' },
  { path: '/zh-tw/events/oblivion-crisis/', short: '地圖：《遺忘之都》·', link: true, full: '《上古卷軸 IV：遺忘之都》遊戲地圖，© Bethesda Softworks' },
  { path: '/zh-tw/events/creation-of-mundus/', short: '地圖：本站自繪', link: false, full: '地圖：本站自繪' },
  { path: '/en/events/battle-of-red-mountain/', short: 'Map: Anthology ·', link: true, full: 'Map: The Elder Scrolls Anthology map, © Bethesda Softworks / ZeniMax Media; via' },
]) {
  test(`narrow screens credit the map on one short line, the whole credit still read out (${c.path})`, async ({ page }) => {
    test.skip(isWide(page), 'narrow screens only: side by side the whole credit rides on the plate');
    await openApp(page, c.path);
    const cap = page.locator('.map-cap');
    await expect(cap.locator('.cap-short')).toBeVisible();
    await expect(cap.locator('.cap-short')).toHaveText(c.short);
    await expect(cap.locator('.cap-short')).toHaveAttribute('title', new RegExp(c.full.slice(0, 12)));
    if (c.link) await expect(cap.getByRole('link', { name: /^UESP/ })).toBeVisible();
    // One line, not wrapped: the caption is no taller than one line of its text.
    const lineHeight = await cap.evaluate((el) => parseFloat(getComputedStyle(el).lineHeight) || parseFloat(getComputedStyle(el).fontSize) * 1.9);
    expect((await cap.boundingBox())!.height).toBeLessThanOrEqual(lineHeight + 2);
    // Screen readers get the whole credit (the short form is aria-hidden); the footer keeps the copyright notice.
    expect(await cap.ariaSnapshot()).toContain(c.full);
    expect(await cap.ariaSnapshot()).not.toContain(c.short === c.full ? '\u0000' : c.short);
    await expect(page.locator('.site-footer')).toContainText(/© Bethesda Softworks LLC/);
  });
}

test('side by side the map credit is the whole one', async ({ page }) => {
  test.skip(!isWide(page), 'wide screens only');
  await openApp(page, '/zh-tw/events/oblivion-crisis/');
  await expect(page.locator('.map-cap .cap-long')).toBeVisible();
  await expect(page.locator('.map-cap .cap-long')).toContainText('《上古卷軸 IV：遺忘之都》遊戲地圖，© Bethesda Softworks');
  await expect(page.locator('.map-cap .cap-short')).toBeHidden();
});

// ---- Final review fixes ----

for (const l of ['zh-tw', 'en'] as const) {
  test(`a region-only event is not "location unknown" (${l})`, async ({ page }) => {
    for (const id of ['middle-dawn', 'creation-of-mundus', 'great-war']) {
      await openApp(page, `/${l}/events/${id}/`);
      await expect(storyTitle(page)).toHaveText(eventTitle(l, id));
      await expect(page.locator('.story-badges .story-note')).toHaveCount(0);
    }
  });
}

/** Scrolls the page and the story column (whichever scrolls) to the very bottom. */
async function scrollAllTheWay(page: Page) {
  await page.evaluate(() => {
    scrollTo(0, document.documentElement.scrollHeight);
    const col = document.querySelector('.story-col');
    col?.scrollTo(0, col.scrollHeight);
  });
  await scrollSettled(page);
}

for (const size of [
  { width: 915, height: 412, wide: false }, // a phone held sideways
  { width: 932, height: 430, wide: false },
  { width: 1280, height: 600, wide: true },
  { width: 1280, height: 560, wide: true },
]) {
  test(`at ${size.width}×${size.height} every part of the story can be read, down to the footer`, async ({ page }, info) => {
    test.skip(info.project.name !== 'desktop', 'one viewport set is enough');
    await page.setViewportSize({ width: size.width, height: size.height });
    await openApp(page, '/zh-tw/events/creation-of-mundus/');
    // Short screens stack (side by side needs 560px of height); taller ones sit side by side.
    const overflow = await page.locator('.story-col').evaluate((el) => getComputedStyle(el).overflowY);
    expect(overflow === 'auto').toBe(size.wide);
    await scrollAllTheWay(page);
    const vh = size.height;
    for (const sel of ['.story section:last-of-type', '.site-footer']) {
      const box = (await page.locator(sel).boundingBox())!;
      expect(box.y + box.height, sel).toBeLessThanOrEqual(vh + 1);
      expect(box.y, sel).toBeGreaterThanOrEqual(0);
    }
  });
}

test('changing stories announces only the new title and date; the story itself is not a live region', async ({ page }) => {
  await openApp(page, '/en/events/creation-of-mundus/');
  await expect(page.locator('article.story')).not.toHaveAttribute('aria-live', /.*/);
  await page.getByRole('button', { name: 'Next event' }).click();
  await expect(storyTitle(page)).not.toHaveText(MUNDUS_EN);
  const title = await storyTitle(page).textContent();
  const date = await page.locator('.story-date').textContent();
  await expect(page.locator('[data-story-announce]')).toHaveText(`${title}, ${date}`);
  await expect(page.locator('[data-story-announce]')).toHaveAttribute('aria-live', 'polite');
});

test('pages describe themselves and link their other-language version; the 404 page marks its Chinese', async ({ page }) => {
  for (const [path, other] of [
    ['/zh-tw/', '/en/'],
    ['/en/events/great-war/', '/zh-tw/events/great-war/'],
  ]) {
    const html = await (await page.request.get(path)).text();
    expect(html).toMatch(/<meta name="description" content="[^"]{20,}"/);
    expect(html).toContain(`hreflang="${other.startsWith('/en') ? 'en' : 'zh-Hant-TW'}" href="${other}"`);
    expect(html).toContain(`hreflang="x-default" href="/"`);
  }
  // Event descriptions are cut on a boundary with an ellipsis, never mid-word.
  const en = await (await page.request.get('/en/events/great-war/')).text();
  const desc = /<meta name="description" content="([^"]+)"/.exec(en)![1];
  expect(desc.length).toBeLessThanOrEqual(151);
  expect(desc).toMatch(/(…|\.)$/);
  const res = await page.request.get('/404.html');
  const notFound = await res.text();
  expect(notFound).toMatch(/<span lang="zh-Hant-TW"[^>]*>／找不到頁面<\/span>/);
  expect(notFound).toMatch(/<p lang="zh-Hant-TW"[^>]*><a [^>]*>回到時間軸/);
});

/**
 * The longest run of Chinese characters in an event's story (above its notes): it appears verbatim wherever that
 * story's text does, so it tells which stories a page carries without naming any wording in the test.
 */
function storyPhrase(id: string): string {
  const body = readFileSync(`src/content/events/zh-tw/${id}.md`, 'utf-8').split(/^---$/m).slice(2).join('---');
  const story = body.split(/^##[ \t]+註[ \t]*$/m)[0];
  const runs = story.replace(/\{\{[^}]*\}\}/g, '|').match(/[一-鿿]{6,}/g) ?? [];
  const phrase = runs.sort((a, b) => b.length - a.length)[0];
  if (!phrase) throw new Error(`no phrase in ${id}`);
  return phrase;
}

test.describe('stories load on demand', () => {
  test('an event page carries its own story only, the others are JSON files', async ({ request }, info) => {
    test.skip(info.project.name !== 'desktop', 'the same files on both projects; once is enough');
    const res = await request.get('/zh-tw/events/great-war/');
    const html = await res.text();
    expect(html).toContain(storyPhrase('great-war'));
    const tears = storyPhrase('night-of-tears');
    expect(readFileSync('src/content/events/zh-tw/great-war.md', 'utf-8')).not.toContain(tears);
    expect(html).not.toContain(tears);
    // The other story is built as JSON, with the terms its tooltips need.
    const json = await (await request.get('/zh-tw/stories/night-of-tears.json')).json();
    expect(json.id).toBe('night-of-tears');
    expect(json.html).toContain(tears);
    // Its sources travel with it: only the open story lists them, so no page carries every event's.
    expect(json.sources.length).toBeGreaterThan(0);
    expect(html).not.toContain(json.sources[0].url);
    const marked = [...new Set([...`${json.html}${json.notesHtml ?? ''}`.matchAll(/data-term="([^"]+)"/g)].map((m) => m[1]))];
    expect(json.terms.map((t: { id: string }) => t.id).sort()).toEqual(marked.sort());
  });

  test('every page, home and event pages in both languages, stays under 150 KiB', async ({ request }, info) => {
    test.skip(info.project.name !== 'desktop', 'the same files on both projects; once is enough');
    const ids = readdirSync('src/content/events/en').map((f) => f.replace(/\.md$/, ''));
    const sizes: [string, number][] = [];
    for (const lang of ['en', 'zh-tw']) {
      for (const path of [`/${lang}/`, ...ids.map((id) => `/${lang}/events/${id}/`)]) {
        const res = await request.get(path);
        expect(res.ok(), path).toBe(true);
        sizes.push([path, (await res.body()).byteLength]);
      }
    }
    sizes.sort((a, b) => b[1] - a[1]);
    const largest = sizes.slice(0, 3).map(([p, n]) => `${p} ${n} B`).join(', ');
    expect(sizes[0][1], `largest pages: ${largest}`).toBeLessThan(150 * 1024);
  });

  test('choosing an event fetches its story once; choosing it again does not', async ({ page }) => {
    const fetched: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/stories/')) fetched.push(new URL(req.url()).pathname);
    });
    await openApp(page, '/en/');
    expect(fetched).toEqual([]);
    await revealTimelineDot(page, RED.en);
    await page.locator('.timeline').getByRole('button', { name: RED.en, exact: true }).click();
    await expect(storyTitle(page)).toHaveText(RED.en);
    await expect(page.locator('.story-body .term').first()).toBeVisible();
    const red = '/en/stories/battle-of-red-mountain.json';
    expect(fetched.filter((p) => p === red)).toHaveLength(1);

    await page.getByRole('button', { name: 'Next event' }).click();
    await expect(storyTitle(page)).not.toHaveText(RED.en);
    await page.getByRole('button', { name: 'Previous event' }).click();
    await expect(storyTitle(page)).toHaveText(RED.en);
    await expect(page.locator('.story-body .term').first()).toBeVisible();
    expect(fetched.filter((p) => p === red)).toHaveLength(1);
  });

  test('while a story loads its title shows; a failed load offers a retry that works', async ({ page }) => {
    let release = () => {};
    const gate = new Promise<void>((resolve) => (release = resolve));
    const fetched: string[] = [];
    page.on('request', (req) => {
      if (req.url().includes('/stories/')) fetched.push(new URL(req.url()).pathname);
    });
    await page.route('**/stories/*.json', async (route) => {
      await gate;
      await route.continue();
    });
    await openApp(page, '/zh-tw/');
    await page.getByRole('button', { name: '下一則' }).click();
    const mundus = eventTitle('zh-tw', 'creation-of-mundus');
    await expect(storyTitle(page)).toHaveText(mundus);
    const loading = page.locator('.story-loading');
    await expect(loading).toHaveAttribute('aria-busy', 'true');
    await expect(loading).toHaveText('正在載入故事……');
    release();
    await expect(page.locator('.story-body .term').first()).toBeVisible();
    await expect(loading).toHaveCount(0);

    await page.unroute('**/stories/*.json');
    await page.route('**/stories/*.json', (route) => route.fulfill({ status: 500, body: '' }));
    // Far from the stories on either side of the first one, which were fetched ahead of time.
    expect(fetched).not.toContain('/zh-tw/stories/battle-of-red-mountain.json');
    await revealTimelineDot(page, RED.zh);
    await page.locator('.timeline').getByRole('button', { name: RED.zh, exact: true }).click();
    await expect(storyTitle(page)).toHaveText(RED.zh);
    await expect(page.getByRole('alert')).toContainText('故事載入失敗');
    const retry = page.getByRole('button', { name: '重試' });
    await expect(retry).toBeVisible();

    await page.unroute('**/stories/*.json');
    await retry.click();
    await expect(page.locator('.story-body .term').first()).toBeVisible();
    await expect(retry).toHaveCount(0);
    await expect(page.locator('.story-failed')).toHaveCount(0);
  });

  test('terms in a story loaded on demand still show their tooltips', async ({ page }) => {
    await openApp(page, '/zh-tw/');
    await page.getByRole('button', { name: '下一則' }).click();
    await expect(storyTitle(page)).toHaveText(eventTitle('zh-tw', 'creation-of-mundus'));
    await expect(page.locator('.story-body .term').first()).toBeVisible();
    const term = await readStory(page);
    await term.hover();
    const tip = page.getByRole('tooltip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(termEnglishName((await term.getAttribute('data-term'))!));
  });
});

test.describe('related events', () => {
  // great-war lists these in its frontmatter; the story shows them in timeline order.
  const related = ['tiber-septim-crowned', 'talos-ascends', 'oblivion-crisis', 'white-gold-concordat', 'return-of-alduin'];

  test('a story lists its related events in timeline order, each with its date, as real links', async ({ page }) => {
    const fm = readFileSync('src/content/events/en/great-war.md', 'utf-8').match(/^related: \[(.*)\]$/m)![1].split(', ');
    expect([...fm].sort()).toEqual([...related].sort());
    await openApp(page, '/zh-tw/events/great-war/');
    const section = page.locator('.story-related');
    await expect(section.getByRole('heading', { name: '相關事件' })).toBeVisible();
    const links = section.getByRole('link');
    await expect(links).toHaveText(related.map((id) => new RegExp(eventTitle('zh-tw', id))));
    // Each date is the one the content file gives (all five are single exact years).
    const ERA_ZH: Record<string, string> = { '1E': '第一紀元', '2E': '第二紀元', '3E': '第三紀元', '4E': '第四紀元' };
    for (const [i, id] of related.entries()) {
      const fm = readFileSync(`src/content/events/en/${id}.md`, 'utf-8');
      const era = fm.match(/^era: (.+)$/m)![1].trim();
      const year = fm.match(/^year: (\d+)$/m)![1];
      await expect(links.nth(i)).toHaveAttribute('href', new RegExp(`/zh-tw/events/${id}/`));
      await expect(links.nth(i).locator('.related-date')).toHaveText(`${ERA_ZH[era]} ${year} 年`);
    }
    // Read out as "title, date".
    // (The browser may put spaces around the hidden comma.)
    const esc = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const date = (await links.first().locator('.related-date').textContent())!;
    await expect(links.first()).toHaveAccessibleName(new RegExp(`^${esc(eventTitle('zh-tw', related[0]))}\\s*，\\s*${esc(date)}$`));
  });

  test('choosing a related event opens it and puts the focus on its title', async ({ page }) => {
    await openApp(page, '/en/events/great-war/');
    const target = eventTitle('en', 'white-gold-concordat');
    await page.locator('.story-related').getByRole('link', { name: new RegExp(target) }).click();
    await expect(page).toHaveURL(/\/en\/events\/white-gold-concordat\//);
    await expect(storyTitle(page)).toHaveText(target);
    await expect(storyTitle(page)).toBeFocused();
    await page.goBack();
    await expect(storyTitle(page)).toHaveText(eventTitle('en', 'great-war'));
  });

  test('a modified click opens the related event in a new tab and leaves this story alone', async ({ page, context }) => {
    await openApp(page, '/en/events/great-war/');
    const target = eventTitle('en', 'white-gold-concordat');
    const [tab] = await Promise.all([
      context.waitForEvent('page'),
      page.locator('.story-related').getByRole('link', { name: new RegExp(target) }).click({ modifiers: ['ControlOrMeta'] }),
    ]);
    await tab.waitForLoadState();
    expect(new URL(tab.url()).pathname).toMatch(/\/en\/events\/white-gold-concordat\//);
    await expect(page).toHaveURL(/\/en\/events\/great-war\//);
    await expect(storyTitle(page)).toHaveText(eventTitle('en', 'great-war'));
    await tab.close();
  });
});
