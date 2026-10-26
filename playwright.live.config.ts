import { defineConfig } from '@playwright/test'
import base from './playwright.config'

/** Isolated fixture journeys against deployed bytes; never start a dev server. */
export default defineConfig({
  ...base,
  webServer: undefined,
  globalSetup: './scripts/verify-live-build.mjs',
  use: {
    ...base.use,
    baseURL: process.env.DESIGNON_LIVE_URL ?? 'https://designon.nonarkara.org/',
    serviceWorkers: 'block',
  },
})
