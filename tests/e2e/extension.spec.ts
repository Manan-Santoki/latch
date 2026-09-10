import { fileURLToPath } from 'node:url';
import { type BrowserContext, chromium, expect, test } from '@playwright/test';

// Loads the built extension in a persistent context and checks it comes up.
// Requires a production build in .output/chrome-mv3 and a Chromium install
// (`pnpm build && pnpm exec playwright install chromium`).
const EXT_PATH = fileURLToPath(new URL('../../.output/chrome-mv3', import.meta.url));
const EXT_ID = 'gnmhkieamdmhjddhjgpkledmcgbejfec';

let context: BrowserContext;

test.beforeAll(async () => {
  context = await chromium.launchPersistentContext('', {
    args: [`--disable-extensions-except=${EXT_PATH}`, `--load-extension=${EXT_PATH}`],
  });
});

test.afterAll(async () => {
  await context?.close();
});

test('service worker registers at the fixed extension id', async () => {
  let [sw] = context.serviceWorkers();
  if (!sw) sw = await context.waitForEvent('serviceworker');
  expect(sw.url()).toContain(EXT_ID);
});

test('overlay demo page renders a verification card', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${EXT_ID}/overlay.html?demo=code`);
  await expect(page.getByText('Verification code')).toBeVisible();
  await expect(page.getByText('824 193')).toBeVisible();
  await page.close();
});

test('popup renders', async () => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${EXT_ID}/popup.html`);
  await expect(page.getByText('Latch')).toBeVisible();
  await expect(page.getByText('Site access')).toBeVisible();
  await page.close();
});
