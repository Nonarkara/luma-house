import { afterEach, describe, expect, it, vi } from 'vitest'
import { offlineShellUrl, registerOfflineShell } from './offlineShell'

type ServiceWorkerStub = {
  register: ReturnType<typeof vi.fn>
}

function stubBrowser(baseURI: string): { serviceWorker: ServiceWorkerStub; update: ReturnType<typeof vi.fn> } {
  const update = vi.fn().mockResolvedValue(undefined)
  const serviceWorker = { register: vi.fn().mockResolvedValue({ update }) }
  Object.defineProperty(globalThis.navigator, 'serviceWorker', {
    value: serviceWorker,
    configurable: true,
  })
  Object.defineProperty(globalThis, 'document', {
    value: { baseURI },
    configurable: true,
  })
  return { serviceWorker, update }
}

afterEach(() => {
  delete (globalThis as { navigator?: { serviceWorker?: unknown } }).navigator?.serviceWorker
  delete (globalThis as { document?: unknown }).document
})

describe('the offline shell URL', () => {
  it('sits beside the application at the root of the site', () => {
    expect(offlineShellUrl('https://designon.nonarkara.org/')).toBe(
      'https://designon.nonarkara.org/sw.js',
    )
  })

  it('follows the document on the mirror, so one file serves both hosts', () => {
    expect(offlineShellUrl('https://nonarkara.github.io/luma-house/')).toBe(
      'https://nonarkara.github.io/luma-house/sw.js',
    )
  })

  it('resolves against the directory, not the file name', () => {
    expect(offlineShellUrl('https://designon.nonarkara.org/?studio=1')).toBe(
      'https://designon.nonarkara.org/sw.js',
    )
  })
})

describe('registering the offline shell', () => {
  it('registers the worker beside the document', async () => {
    const { serviceWorker } = stubBrowser('https://designon.nonarkara.org/')
    registerOfflineShell()
    await vi.waitFor(() => expect(serviceWorker.register).toHaveBeenCalled())
    expect(serviceWorker.register).toHaveBeenCalledWith('https://designon.nonarkara.org/sw.js')
  })

  it('asks for the worker script again, so a corrected worker is not stuck behind a CDN', async () => {
    const { update } = stubBrowser('https://designon.nonarkara.org/')
    registerOfflineShell()
    await vi.waitFor(() => expect(update).toHaveBeenCalled())
  })

  it('never lets a refused registration break the desk', async () => {
    const { serviceWorker } = stubBrowser('https://designon.nonarkara.org/')
    serviceWorker.register.mockRejectedValue(new Error('blocked'))
    expect(() => registerOfflineShell()).not.toThrow()
    await vi.waitFor(() => expect(serviceWorker.register).toHaveBeenCalled())
  })

  it('does nothing where service workers do not exist', () => {
    delete (globalThis as { navigator?: { serviceWorker?: unknown } }).navigator?.serviceWorker
    expect(() => registerOfflineShell()).not.toThrow()
  })
})
