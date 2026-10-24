import { expect, test } from '@playwright/test';
import { openApp } from './helpers';

// Launch readiness (decisions/launch-2): an icon, share previews, the AI note in the footer, a sitemap.
test('every page has an icon, a light colour scheme and a share preview with its own picture', async ({ page }) => {
  await openApp(page, '/zh-tw/events/battle-of-red-mountain/');
  const head = page.locator('head');
  await expect(head.locator('link[rel="icon"]')).toHaveAttribute('href', /favicon\.svg$/);
  await expect(head.locator('meta[name="color-scheme"]')).toHaveAttribute('content', 'light');
  await expect(head.locator('meta[property="og:title"]')).toHaveAttribute('content', /^紅山之戰/);
  await expect(head.locator('meta[property="og:description"]')).toHaveAttribute('content', /.{40,}/);
  await expect(head.locator('meta[property="og:image"]')).toHaveAttribute('content', /illustrations\/battle-of-red-mountain-960\.webp$/);
  await expect(head.locator('meta[property="og:locale"]')).toHaveAttribute('content', 'zh_TW');
  for (const href of ['favicon.svg', 'apple-touch-icon.png']) expect((await page.request.get(`/${href}`)).status(), href).toBe(200);
});

test('the footer says the illustrations are AI-generated', async ({ page }) => {
  await openApp(page, '/en/');
  await expect(page.locator('.site-footer')).toContainText('Illustrations are AI-generated');
  await openApp(page, '/zh-tw/');
  await expect(page.locator('.site-footer')).toContainText('插圖由 AI 生成');
});

test('a sitemap is published', async ({ request }) => {
  const res = await request.get('/sitemap.xml');
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('<urlset');
});
