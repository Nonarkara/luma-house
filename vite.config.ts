import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

// Preview/CI must enforce the same policy as Cloudflare, including WASM and
// embedded GLB texture fetches. Fail clearly if this single global rule changes.
const headerLines = readFileSync(new URL('./public/_headers', import.meta.url), 'utf8').split('\n').filter(line => line.trim())
if (headerLines.filter(line => !line.startsWith('  ')).join('\n') !== '/*') throw new Error('Preview expects one global /* header rule')
const productionHeaders = Object.fromEntries(headerLines.slice(1).map(line => {
  const colon = line.indexOf(':')
  if (colon < 1) throw new Error('Invalid production header')
  return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()]
}))
if (!productionHeaders['Content-Security-Policy']) throw new Error('Production CSP is missing')

export default defineConfig({
  plugins: [react()],
  base: './',
  preview: { headers: productionHeaders },
  test: {
    // Stale branch checkouts live here; they are not part of this codebase.
    // Playwright specs live in `e2e/` and run via `npm run test:e2e`, not vitest.
    exclude: ['**/node_modules/**', '**/.worktrees/**', 'e2e/**'],
  },
})
