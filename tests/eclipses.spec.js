import { expect, test } from '@playwright/test';

const SCREENSHOT_DIR = 'test-results/screenshots';

test.beforeEach(async ({ page }) => {
  await page.goto('/eclipses.html');
  await expect(page.locator('#status')).toContainText('eclipses.', { timeout: 20000 });
});

test('lists past and upcoming eclipses', async ({ page }) => {
  await expect(page.locator('#past-list .eclipse')).not.toHaveCount(0);
  await expect(page.locator('#upcoming-list .eclipse')).not.toHaveCount(0);
  await expect(page.locator('#next-up')).toContainText('Next:');
  await expect(page.locator('#past-list')).toContainText('8 April 2024');

  await page.screenshot({ path: `${SCREENSHOT_DIR}/eclipses-all.png`, fullPage: true });
});

test('upcoming eclipses are in the future and past ones are not', async ({ page }) => {
  const now = Date.now();
  const dates = async (selector) =>
    page.locator(selector).evaluateAll((nodes) => nodes.map((n) => n.dateTime));

  for (const d of await dates('#upcoming-list .eclipse-date')) {
    expect(new Date(`${d}T23:59:59Z`).getTime()).toBeGreaterThan(now - 86400000);
  }
  for (const d of await dates('#past-list .eclipse-date')) {
    expect(new Date(`${d}T00:00:00Z`).getTime()).toBeLessThan(now);
  }
});

test('upcoming eclipses are listed soonest first and show a countdown', async ({ page }) => {
  const dates = await page
    .locator('#upcoming-list .eclipse-date')
    .evaluateAll((nodes) => nodes.map((n) => n.dateTime));
  expect(dates).toEqual([...dates].sort());
  await expect(page.locator('#upcoming-list .eclipse-countdown').first()).toContainText(
    /In \d+ days|Today|Tomorrow/
  );
});

test('past eclipses are listed most recent first', async ({ page }) => {
  const dates = await page
    .locator('#past-list .eclipse-date')
    .evaluateAll((nodes) => nodes.map((n) => n.dateTime));
  expect(dates).toEqual([...dates].sort().reverse());
});

test('the solar and lunar filters narrow the lists', async ({ page }) => {
  const all = await page.locator('.eclipse-list .eclipse').count();

  await page.check('input[name="kind"][value="solar"]');
  await expect(page.locator('.badge', { hasText: 'lunar' })).toHaveCount(0);
  const solar = await page.locator('.eclipse-list .eclipse').count();
  expect(solar).toBeGreaterThan(0);
  expect(solar).toBeLessThan(all);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/eclipses-solar.png`, fullPage: true });

  await page.check('input[name="kind"][value="lunar"]');
  await expect(page.locator('.badge', { hasText: 'solar' })).toHaveCount(0);
  expect(await page.locator('.eclipse-list .eclipse').count()).toBe(all - solar);
});

test('each eclipse shows an emoji for its type', async ({ page }) => {
  const EMOJI = {
    'Total solar eclipse': '🌑',
    'Annular solar eclipse': '💍',
    'Hybrid solar eclipse': '🌓',
    'Partial solar eclipse': '🌒',
    'Total lunar eclipse': '🔴',
    'Partial lunar eclipse': '🌗',
    'Penumbral lunar eclipse': '🌖',
  };

  const items = await page.locator('.eclipse-list .eclipse').evaluateAll((nodes) =>
    nodes.map((n) => ({
      emoji: n.querySelector('.eclipse-emoji')?.textContent,
      label: n.querySelector('.eclipse-emoji')?.getAttribute('aria-label'),
      badge: n.querySelector('.badge')?.textContent,
    }))
  );

  expect(items.length).toBeGreaterThan(0);
  for (const item of items) {
    expect(item.label).toBe(item.badge);
    expect(item.emoji).toBe(EMOJI[item.badge]);
  }

  await expect(page.locator('#next-up')).toContainText(/🌑|💍|🌓|🌒|🔴|🌗|🌖/);
});

test('reports an error when the catalogue cannot be loaded', async ({ page }) => {
  await page.route('**/data/eclipses.json', (route) => route.fulfill({ status: 500, body: '' }));
  await page.reload();
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'error');
});

test('the pages link to each other', async ({ page }) => {
  await page.click('.site-nav a[href="./index.html"]');
  await expect(page.locator('.masthead h1')).toHaveText('Night Sky');
  await page.click('.site-nav a[href="./eclipses.html"]');
  await expect(page.locator('.masthead h1')).toHaveText('Eclipses');
});
