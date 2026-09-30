import { defineConfig } from '@playwright/test'

/**
 * Shipability smoke test — runs against `npm run preview` (vite preview on
 * port 4173). The spec uses `webServer` to start + tear down the server
 * itself, so a single `npm run test:e2e` does the whole round trip.
 *
 * The CI gate is the existing GitHub Pages workflow; this smoke test is a
 * local-dev guardrail against the three shipability bugs that slipped past
 * the 284-test vitest suite (see the audit at c250c32). It runs the app in
 * real Chromium and a real iPhone-13-sized viewport so regressions surface
 * here, not in a user's hands.
 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    actionTimeout: 5_000,
    navigationTimeout: 15_000,
  },
  webServer: {
    command: 'npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
  projects: [
    {
      name: 'desktop',
      use: { viewport: { width: 1280, height: 800 } },
    },
    {
      name: 'mobile',
      use: { viewport: { width: 390, height: 844 } },
    },
  ],
})
