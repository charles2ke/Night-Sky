import { expect, test } from '@playwright/test';

const SCREENSHOT_DIR = 'test-results/screenshots';

// Photographs live on Wikimedia Commons; stub them so the page renders offline.
const PIXEL = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

test.beforeEach(async ({ page }) => {
  await page.route('**/commons.wikimedia.org/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/png', body: PIXEL })
  );
  await page.goto('/black-holes.html');
  await expect(page.locator('.black-hole-card').first()).toBeVisible();
});

test('lists the known black holes with their masses', async ({ page }) => {
  const cards = page.locator('.black-hole-card');
  expect(await cards.count()).toBeGreaterThan(10);

  const sgrA = page.locator('#sagittarius-a-star');
  await expect(sgrA).toContainText('4.3 million M☉');
  await expect(page.locator('#messier-87-star')).toContainText('6.5 billion M☉');
  await expect(page.locator('#status')).toBeHidden();
  await expect(page.locator('#black-hole-count')).toContainText('black holes');

  await page.screenshot({ path: `${SCREENSHOT_DIR}/black-holes.png`, fullPage: true });
});

test('draws a bar for every black hole in the scale diagram', async ({ page }) => {
  const bars = page.locator('#horizon-diagram .horizon-bar');
  const cards = page.locator('.black-hole-card');
  await expect(bars).toHaveCount(await cards.count());

  // The smallest horizon is drawn shortest, the largest longest.
  const widths = await bars.evaluateAll((nodes) => nodes.map((node) => Number(node.getAttribute('width'))));
  expect(widths).toEqual([...widths].sort((a, b) => a - b));
});

test('filters the cards by class', async ({ page }) => {
  await page.check('input[name="hole-class"][value="stellar"]');
  await expect(page.locator('#cygnus-x-1')).toBeVisible();
  await expect(page.locator('#messier-87-star')).toBeHidden();

  await page.check('input[name="hole-class"][value="supermassive"]');
  await expect(page.locator('#messier-87-star')).toBeVisible();
  await expect(page.locator('#cygnus-x-1')).toBeHidden();

  await page.check('input[name="hole-class"][value="all"]');
  await expect(page.locator('#cygnus-x-1')).toBeVisible();
  await expect(page.locator('#messier-87-star')).toBeVisible();
});

test('every black hole picture is credited', async ({ page }) => {
  const figures = page.locator('.black-hole-card .shot');
  for (const figure of await figures.all()) {
    await expect(figure.locator('img')).toHaveAttribute('alt', /.{20,}/);
    await expect(figure.locator('.credit a')).toHaveCount(2);
  }
});

test('is reachable from the galaxies page sub-menu', async ({ page }) => {
  await page.goto('/galaxies.html');
  await page.click('.sub-nav a[href="./black-holes.html"]');
  await expect(page.locator('.masthead h1')).toHaveText('Black holes');
});

test('reports an error when the black hole data cannot be loaded', async ({ page }) => {
  await page.route('**/data/black-holes.json', (route) => route.fulfill({ status: 500, body: '' }));
  await page.goto('/black-holes.html');
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'error');
});
