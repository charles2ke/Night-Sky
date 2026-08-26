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
  await page.goto('/galaxies.html');
  await expect(page.locator('#galaxy-grid .galaxy-card').first()).toBeVisible();
});

test('highlights the Milky Way and lists the other known galaxies', async ({ page }) => {
  const home = page.locator('#milky-way');
  await expect(home.locator('h2')).toHaveText('The Milky Way');
  await expect(home).toContainText('Sagittarius A*');
  await expect(home).toContainText('Barred spiral');

  const cards = page.locator('#galaxy-grid .galaxy-card');
  await expect(cards).toHaveCount(15);
  await expect(page.locator('#andromeda')).toContainText('Messier 31');
  await expect(page.locator('#status')).toBeHidden();

  await page.screenshot({ path: `${SCREENSHOT_DIR}/galaxies.png`, fullPage: true });
});

test('every gallery entry has an image with alt text and a credited licence', async ({ page }) => {
  const figures = page.locator('.shot');
  expect(await figures.count()).toBeGreaterThan(15);

  for (const figure of await figures.all()) {
    const img = figure.locator('img');
    await expect(img).toHaveAttribute('alt', /.{20,}/);
    await expect(img).toHaveAttribute('src', /commons\.wikimedia\.org/);
    await expect(figure.locator('.credit a')).toHaveCount(2);
  }
});

test('the pages link to each other', async ({ page }) => {
  await page.click('.site-nav a[href="./index.html"]');
  await expect(page.locator('.masthead h1')).toHaveText('Night Sky');
  await page.click('.site-nav a[href="./galaxies.html"]');
  await expect(page.locator('.masthead h1')).toHaveText('Galaxies');
});

test('reports an error when the galaxy data cannot be loaded', async ({ page }) => {
  await page.route('**/data/galaxies.json', (route) => route.fulfill({ status: 500, body: '' }));
  await page.goto('/galaxies.html');
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'error');
});
