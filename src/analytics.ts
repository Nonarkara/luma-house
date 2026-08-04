import { readJson, writeJson } from './storage/keys'

const PAGEVIEWS_KEY = 'pageviews'

export function trackPageview() {
  try {
    const views =
      readJson<Array<Record<string, string>>>(PAGEVIEWS_KEY, 'luma-house:pageviews') ?? []
    views.push({
      path: window.location.pathname,
      referrer: document.referrer || 'direct',
      language: navigator.language,
      userAgent: navigator.userAgent,
      createdAt: new Date().toISOString(),
    })
    writeJson(PAGEVIEWS_KEY, views.slice(-500))
  } catch {
    // Analytics must never interrupt the design workspace.
  }
}
