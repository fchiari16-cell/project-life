import { defineConfig, devices } from '@playwright/test';

// E2E runs against the production build (service worker only registers there).
export default defineConfig({
  testDir: 'apps/web/e2e',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4173', trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Opt-in (E2E_FIREFOX=1): on the development machine Windows refused to execute the Playwright Firefox build.
    ...(process.env.E2E_FIREFOX ? [{ name: 'firefox', use: { ...devices['Desktop Firefox'] } }] : []),
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
