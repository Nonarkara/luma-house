import { describe, expect, it } from 'vitest'
import { offlineShellUrl } from './offlineShell'

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
