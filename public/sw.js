/**
 * designon — offline shell.
 *
 * Everything designon draws, measures and prices is computed in the browser.
 * Once the application code is on the device, no drawing, sun study or cost
 * estimate needs the network. The one thing the HTTP cache cannot do is open
 * the application at all when there is no connection, so this worker caches
 * the shell and serves it in that case.
 *
 * Policy
 *   navigation  network-first; the cached shell is the fallback when the
 *               network is gone. A visit that reaches the network always
 *               gets the current build, never a stale one.
 *   /assets/*   cache-first. Vite writes content-hashed filenames, so a
 *               cached file is by definition the file the page asked for.
 *   /brand/*    cache-first. Small, stable artwork the drawing sheet needs.
 *   anything    left alone — no respondWith, so the page keeps its own
 *               request events and the furniture models are never cached.
 *
 * The worker lives beside the application (./sw.js) and takes its scope from
 * its own location, so the root domain and the /luma-house/ mirror both
 * register it correctly without a second copy.
 */

const VERSION = 'v1'
const CACHE = `designon-shell-${VERSION}`

/** The directory this worker lives in — "/" in production, "/luma-house/" on the mirror. */
const ROOT = new URL('./', self.location.href)

/** Paths, relative to ROOT, whose files are cached and served from cache. */
const CACHED_PATHS = ['assets/', 'brand/']

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE)
      try {
        const shell = await fetch(ROOT.href, { cache: 'reload' })
        if (shell && shell.ok) {
          await cache.put(ROOT.href, shell.clone())
          await precacheFromDocument(cache, shell)
        }
      } catch {
        // No network at install time. The shell fills in on the first
        // successful navigation instead.
      }
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys()
      await Promise.all(
        names
          .filter(name => name.startsWith('designon-shell-') && name !== CACHE)
          .map(name => caches.delete(name)),
      )
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  if (request.mode === 'navigate') {
    event.respondWith(navigation(request))
    return
  }

  if (!isCachedPath(url)) return

  event.respondWith(
    (async () => {
      const cache = await caches.open(CACHE)
      // Looked up by URL, not by the incoming request. The build's files are
      // served with `Vary: Origin`, and a module script loaded with the
      // `crossorigin` attribute carries an Origin header that the worker's
      // own fetch did not — a request-keyed lookup misses every one of them
      // and the application then loads with no code at all.
      const cached = await cache.match(url.href, { ignoreVary: true })
      if (cached) return cached
      const response = await fetch(request)
      if (response && response.ok) await cache.put(url.href, response.clone())
      return response
    })(),
  )
})

/**
 * Serve the current build when the network answers, the cached shell when it
 * does not. The cached shell is stored under ROOT rather than under the
 * request URL so that a query string — /?studio=1, a shared plan — still
 * finds it.
 */
async function navigation(request) {
  try {
    const response = await fetch(request)
    if (response && response.ok) {
      const cache = await caches.open(CACHE)
      await cache.put(ROOT.href, response.clone())
    }
    return response
  } catch {
    const cache = await caches.open(CACHE)
    const shell = await cache.match(ROOT.href)
    if (!shell) return Response.error()
    // The marker names the source of the answer, so an offline start is
    // visible in the network panel and in the browser's own tests rather
    // than looking like an ordinary page load.
    const headers = new Headers(shell.headers)
    headers.set('X-Designon-Shell', 'offline')
    return new Response(await shell.blob(), {
      status: shell.status,
      statusText: shell.statusText,
      headers,
    })
  }
}

/** True when the path sits under one of the cached directories. */
function isCachedPath(url) {
  if (!url.pathname.startsWith(ROOT.pathname)) return false
  const relative = url.pathname.slice(ROOT.pathname.length)
  return CACHED_PATHS.some(prefix => relative.startsWith(prefix))
}

/**
 * Pull the build into the cache at install time: the scripts and styles the
 * document names, then the fonts those styles name. The application is
 * therefore complete offline after a single visit, not after a second one.
 */
async function precacheFromDocument(cache, response) {
  const html = await response.text()
  const references = new Set()

  for (const match of html.matchAll(/(?:src|href)\s*=\s*["']([^"']+)["']/g)) {
    const value = match[1]
    if (!value || value.startsWith('#') || value.startsWith('data:')) continue
    if (/^(?:https?:)?\/\//.test(value)) continue
    references.add(new URL(value, ROOT.href).href)
  }

  await Promise.all(
    [...references].map(async href => {
      try {
        const asset = await fetch(href, { cache: 'reload' })
        if (!asset || !asset.ok) return
        await cache.put(href, asset.clone())
        if (!href.endsWith('.css')) return
        const css = await asset.text()
        for (const match of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) {
          const font = new URL(match[1], href)
          if (font.origin !== self.location.origin) continue
          const fontResponse = await fetch(font.href, { cache: 'reload' }).catch(() => null)
          if (fontResponse && fontResponse.ok) await cache.put(font.href, fontResponse)
        }
      } catch {
        // A missing optional file must not fail the whole install.
      }
    }),
  )
}
