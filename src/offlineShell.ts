/**
 * The offline shell.
 *
 * designon computes every drawing, sun study and cost estimate in the
 * browser, so once the application is on the device the network is optional.
 * `public/sw.js` is the worker that keeps the shell available when it is not;
 * this module decides where that worker lives and registers it.
 *
 * The worker is a static file beside the application, so its URL is resolved
 * against the document: "/" in production, "/luma-house/" on the mirror. Its
 * scope follows from its location, which keeps one file serving both hosts.
 */

/**
 * The worker URL for a given document base.
 *
 * @param base the document base URI, e.g. "https://designon.nonarkara.org/" or
 *   "https://nonarkara.github.io/luma-house/".
 * @returns the absolute worker URL, e.g. ".../sw.js".
 */
export function offlineShellUrl(base: string): string {
  return new URL('sw.js', base).href
}

/**
 * Register the offline shell.
 *
 * Automated browsers are skipped on purpose. A harness that installs a worker
 * it did not ask for inherits a cache it cannot reason about, and the shell
 * has a spec of its own that registers it deliberately and asserts what it
 * serves.
 */
export function registerOfflineShell(): void {
  if (typeof navigator === 'undefined') return
  if (!('serviceWorker' in navigator)) return
  if (navigator.webdriver) return
  try {
    navigator.serviceWorker
      .register(offlineShellUrl(document.baseURI))
      .then(registration => {
        // Ask for the worker script again, explicitly. The browser only
        // re-checks it on its own schedule, and a CDN in front of the site
        // may hold the script for hours. Without this a corrected worker
        // could sit on the shelf while the app that depends on it moves on.
        registration.update().catch(() => {
          // An update check that fails is not a failure of the shell.
        })
      })
      .catch(() => {
        // A refused or unsupported registration must never break the desk.
      })
  } catch {
    // Some browsers throw rather than reject when registration is blocked.
  }
}
