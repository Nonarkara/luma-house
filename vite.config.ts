import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'node:fs'

/**
 * Cloudflare Pages `_headers` rules, parsed once so the preview server
 * serves exactly what production serves — including the path rules, which
 * are where the caching decisions live.
 */
interface HeaderRule {
  path: string
  headers: Record<string, string>
}

function parseHeaderRules(raw: string): HeaderRule[] {
  const rules: HeaderRule[] = []
  let current: HeaderRule | null = null
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    if (!line.startsWith('  ')) {
      current = { path: trimmed, headers: {} }
      rules.push(current)
      continue
    }
    if (!current) throw new Error('Header line before any path rule')
    const colon = line.indexOf(':')
    if (colon < 1) throw new Error('Invalid production header')
    current.headers[line.slice(0, colon).trim()] = line.slice(colon + 1).trim()
  }
  return rules
}

const headerRules = parseHeaderRules(readFileSync(new URL('./public/_headers', import.meta.url), 'utf8'))

const globalRule = headerRules.find(rule => rule.path === '/*')
if (!globalRule) throw new Error('Preview expects one global /* header rule')
if (!globalRule.headers['Content-Security-Policy']) throw new Error('Production CSP is missing')
// Hashed filenames can never change under the same name, so they must be
// cached immutably or every release re-downloads the app for everyone.
const assetsRule = headerRules.find(rule => rule.path === '/assets/*')
if (!assetsRule?.headers['Cache-Control']?.includes('immutable')) {
  throw new Error('Hashed assets must be served with an immutable Cache-Control')
}

function matches(pattern: string, url: string): boolean {
  const path = url.split('?')[0]
  const expression = new RegExp('^' + pattern.split('*').map(part => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$')
  return expression.test(path)
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'production-headers',
      configurePreviewServer(server) {
        server.middlewares.use((request, response, next) => {
          for (const rule of headerRules) {
            if (!matches(rule.path, request.url ?? '')) continue
            for (const [name, value] of Object.entries(rule.headers)) response.setHeader(name, value)
          }
          next()
        })
      },
    },
  ],
  base: './',
  build: {
    rollupOptions: {
      input: { main: 'index.html', selftest: 'selftest.html' },
    },
  },
  test: {
    // Stale branch checkouts live here; they are not part of this codebase.
    // Playwright specs live in `e2e/` and run via `npm run test:e2e`, not vitest.
    exclude: ['**/node_modules/**', '**/.worktrees/**', 'e2e/**'],
  },
})
