import { defineConfig } from 'vitest/config';
import { WxtVitest } from 'wxt/testing/vitest-plugin';

// WxtVitest wires up WXT path aliases (@/, ~/) and an in-memory fake `browser`/
// `chrome` (via @webext-core/fake-browser) so extension code is testable without
// a real browser. See https://wxt.dev/guide/essentials/unit-testing.html
export default defineConfig({
  plugins: [WxtVitest()],
  test: {
    environment: 'happy-dom',
    globals: true,
    passWithNoTests: true,
    setupFiles: ['./tests/setup.ts'],
    include: [
      'tests/**/*.{test,spec}.{ts,tsx}',
      'src/**/*.{test,spec}.{ts,tsx}',
    ],
  },
});
