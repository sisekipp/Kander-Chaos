import { defineConfig, devices } from '@playwright/test';

const PORT = 4180;

/**
 * E2E-Tests gegen den Produktions-Build (Service Worker aktiv) in WebKit – der Engine von Safari.
 * Start: pnpm --filter @kandern/game exec playwright test
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1180, height: 820 },
    serviceWorkers: 'allow',
  },
  projects: [{ name: 'webkit', use: { ...devices['Desktop Safari'], viewport: { width: 1180, height: 820 } } }],
  webServer: {
    command: `pnpm exec vp build && pnpm exec vp preview --port ${PORT} --strictPort`,
    port: PORT,
    reuseExistingServer: false,
    timeout: 180_000,
  },
});
