const PAGEVIEWS_KEY = 'luma-house:pageviews'

export function trackPageview() {
  try {
    const views = JSON.parse(localStorage.getItem(PAGEVIEWS_KEY) ?? '[]') as Array<Record<string, string>>
    views.push({
      path: window.location.pathname,
      referrer: document.referrer || 'direct',
      language: navigator.language,
      userAgent: navigator.userAgent,
      createdAt: new Date().toISOString(),
    })
    localStorage.setItem(PAGEVIEWS_KEY, JSON.stringify(views.slice(-500)))
  } catch {
    // Analytics must never interrupt the design workspace.
  }
}
