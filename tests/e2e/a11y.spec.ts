import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { openApp } from './helpers';

// P3-A5: axe-core finds no serious or critical problem on the main pages and with each panel open.
async function expectNoSeriousIssues(page: Page, what: string) {
  const { violations } = await new AxeBuilder({ page }).analyze();
  const bad = violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${what}: ${v.id} (${v.impact}) ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).slice(0, 5).join(' | ')}`);
  expect(bad).toEqual([]);
}

for (const path of ['/en/', '/zh-tw/', '/en/events/great-war/', '/zh-tw/events/great-war/']) {
  test(`${path} has no serious accessibility problem`, async ({ page }) => {
    await openApp(page, path);
    await expectNoSeriousIssues(page, path);
  });
}

test('the open search panel has no serious accessibility problem', async ({ page }) => {
  await openApp(page, '/zh-tw/');
  await page.locator('.topbar .search-toggle').click();
  const field = page.getByRole('dialog', { name: '搜尋事件' }).getByRole('searchbox');
  await expect(field).toBeFocused();
  await field.fill('戰爭');
  await expect(page.locator('.search-results a').first()).toBeVisible();
  await expectNoSeriousIssues(page, 'search panel');
});

test('the open region menu has no serious accessibility problem', async ({ page }) => {
  await openApp(page, '/en/');
  await page.locator('.timeline').getByRole('button', { name: 'Regions', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: 'Akavir', exact: true })).toBeVisible();
  await expectNoSeriousIssues(page, 'region menu');
});
