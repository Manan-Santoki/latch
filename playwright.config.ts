import { defineConfig } from '@playwright/test';

// MV3 extensions require a persistent context and a headed (or new-headless)
// Chromium. Run with: pnpm exec playwright install chromium && pnpm e2e
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
});
