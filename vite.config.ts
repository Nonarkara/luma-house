import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  test: {
    // Stale branch checkouts live here; they are not part of this codebase.
    // Playwright specs live in `e2e/` and run via `npm run test:e2e`, not vitest.
    exclude: ['**/node_modules/**', '**/.worktrees/**', 'e2e/**'],
  },
})
