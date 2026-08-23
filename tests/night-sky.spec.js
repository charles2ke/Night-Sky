import { expect, test } from '@playwright/test';

const SCREENSHOT_DIR = 'test-results/screenshots';

// The place lookup is stubbed so the tests do not depend on the network.
async function stubGeocoding(page) {
  await page.route('**/geocoding-api.open-meteo.com/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        results: [
          {
            name: 'Gurugram',
            admin1: 'Haryana',
            country: 'India',
            latitude: 28.4595,
            longitude: 77.0266,
            timezone: 'Asia/Kolkata',
            population: 876824,
          },
        ],
      }),
    })
  );
}

async function generate(page, { place, date, time, direction }) {
  await page.fill('#place', place);
  await page.fill('#date', date);
  await page.fill('#time', time);
  if (direction) await page.selectOption('#direction', direction);
  await page.click('#generate');
  await expect(page.locator('#status')).toContainText('Night sky over', { timeout: 20000 });
}

/** Fraction of non-black pixels, used to check that a sky was actually drawn. */
async function litPixelFraction(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('sky-canvas');
    const ctx = canvas.getContext('2d');
    const { data } = ctx.getImageData(0, 0, canvas.width, Math.round(canvas.height * 0.8));
    let lit = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] + data[i + 1] + data[i + 2] > 200) lit++;
    }
    return lit / (data.length / 4);
  });
}

test.beforeEach(async ({ page }) => {
  await stubGeocoding(page);
  await page.goto('/index.html');
  await expect(page.locator('#status')).toContainText('Night sky over', { timeout: 20000 });
});

test('renders the night sky for a date and place', async ({ page }) => {
  await generate(page, { place: 'Gurugram, India', date: '1995-02-01', time: '00:00', direction: 'S' });

  await expect(page.locator('#details')).toBeVisible();
  await expect(page.locator('#details-list')).toContainText('28.4595° N');
  expect(await litPixelFraction(page)).toBeGreaterThan(0.001);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/gurugram-1995-02-01.png`, fullPage: true });
});

test('shows the correct Moon phase for a known full moon', async ({ page }) => {
  await generate(page, { place: 'Gurugram, India', date: '2024-01-25', time: '23:00', direction: 'S' });

  const details = page.locator('#details-list');
  await expect(details).toContainText('Full Moon');
  await expect(details).toContainText(/9[89]\.\d% illuminated|100\.0% illuminated/);

  await page.screenshot({ path: `${SCREENSHOT_DIR}/full-moon-2024-01-25.png`, fullPage: true });
});

test('shows a new moon as unlit', async ({ page }) => {
  await generate(page, { place: 'Gurugram, India', date: '2024-02-09', time: '23:00', direction: 'W' });
  await expect(page.locator('#details-list')).toContainText('New Moon');
});

test('the sky changes when the viewing direction changes', async ({ page }) => {
  await generate(page, { place: 'Gurugram, India', date: '1995-02-01', time: '00:00', direction: 'S' });
  const south = await page.locator('#sky-canvas').screenshot();

  await page.selectOption('#direction', 'N');
  await expect
    .poll(async () => Buffer.compare(south, await page.locator('#sky-canvas').screenshot()))
    .not.toBe(0);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/facing-north.png`, fullPage: true });
});

test('accepts raw coordinates and reports lookup source', async ({ page }) => {
  await generate(page, { place: '-24.5, -69.25', date: '2023-07-14', time: '01:30', direction: 'N' });
  await expect(page.locator('#details-list')).toContainText('coordinates');
  await expect(page.locator('#details-list')).toContainText('24.5000° S');
  await page.screenshot({ path: `${SCREENSHOT_DIR}/atacama-coordinates.png`, fullPage: true });
});

test('reports an error for an unknown place', async ({ page }) => {
  await page.route('**/geocoding-api.open-meteo.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"generationtime_ms":0.1}' })
  );
  await page.fill('#place', 'Nowhere at all zzz');
  await page.click('#generate');
  await expect(page.locator('#status')).toHaveAttribute('data-state', 'error');
});

test('constellation lines can be toggled off', async ({ page }) => {
  await generate(page, { place: 'Gurugram, India', date: '1995-02-01', time: '00:00', direction: 'S' });
  const withLines = await litPixelFraction(page);
  await page.uncheck('#toggle-constellations');
  await expect.poll(() => litPixelFraction(page)).toBeLessThan(withLines);
});
