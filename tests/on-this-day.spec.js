import { expect, test } from '@playwright/test';

const SCREENSHOT_DIR = 'test-results/screenshots';

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

async function generate(page, date) {
  await page.fill('#date', date);
  await page.click('#generate');
  await expect(page.locator('#status')).toContainText('Night sky over', { timeout: 20000 });
}

test.beforeEach(async ({ page }) => {
  await stubGeocoding(page);
  await page.goto('/index.html');
  await expect(page.locator('#status')).toContainText('Night sky over', { timeout: 20000 });
});

test('shows events for the selected day below the sky image', async ({ page }) => {
  await expect(page.locator('#on-this-day')).toBeVisible();
  await expect(page.locator('#on-this-day-heading')).toHaveText('On this day — 1 February');
  await expect(page.locator('#events-list')).toContainText('Explorer 1 reaches orbit');
  await expect(page.locator('#events-list .event-year').first()).toHaveText('1958');

  await page.screenshot({ path: `${SCREENSHOT_DIR}/on-this-day.png`, fullPage: true });
});

test('the section is below the sky image', async ({ page }) => {
  const figure = await page.locator('figure.sky').boundingBox();
  const section = await page.locator('#on-this-day').boundingBox();
  expect(section.y).toBeGreaterThan(figure.y + figure.height - 1);
});

test('events update when the date changes', async ({ page }) => {
  await generate(page, '1990-07-20');
  await expect(page.locator('#on-this-day-heading')).toHaveText('On this day — 20 July');
  await expect(page.locator('#events-list')).toContainText('Apollo 11 lands on the Moon');
  await expect(page.locator('#events-list')).not.toContainText('Explorer 1 reaches orbit');
});

test('events after the chosen date are not shown', async ({ page }) => {
  await generate(page, '1960-07-20');
  await expect(page.locator('#events-list')).not.toContainText('Apollo 11 lands on the Moon');
});

test('explains when no event matches the date', async ({ page }) => {
  await generate(page, '1700-01-01');
  await expect(page.locator('#events-list .empty')).toContainText('No events');
});
