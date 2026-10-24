import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/e2e',
  // Two builds: the published site on :4321, and the drawn-map build (PUBLIC_MAP_SOURCE=drawn) on :4322, used by
  // the tests that pass `baseURL: DRAWN_SITE`. See scripts/e2e-serve.mjs.
  webServer: {
    command: 'node scripts/e2e-serve.mjs',
    url: 'http://localhost:4322/en/',
    // Always build and serve fresh: reusing a leftover preview would test an old build.
    reuseExistingServer: false,
    timeout: 240_000,
  },
  use: { baseURL: 'http://localhost:4321' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
});
