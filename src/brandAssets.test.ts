import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/**
 * Brand artwork is displayed at a handful of small sizes. A source file far
 * larger than its display size costs every first visit the difference, and
 * nothing on screen reveals it: the browser just scales it down.
 */
const BRAND: Array<{ file: string; maxWidth: number; maxKb: number; why: string }> = [
  { file: 'designon-wordmark.png', maxWidth: 400, maxKb: 40, why: 'displayed at 150 px, printed at 30 mm' },
  { file: 'designon-app.png', maxWidth: 64, maxKb: 12, why: 'displayed at 28 px' },
  { file: 'designon-symbol.png', maxWidth: 128, maxKb: 20, why: 'displayed at 36 px' },
  { file: 'designon-mono.png', maxWidth: 64, maxKb: 8, why: 'favicon' },
]

function readPng(file: string): { width: number; height: number; bytes: number } {
  const buffer = readFileSync(new URL(`../public/brand/${file}`, import.meta.url))
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20), bytes: buffer.byteLength }
}

describe('brand artwork', () => {
  for (const asset of BRAND) {
    it(`${asset.file} is not bigger than its use needs — ${asset.why}`, () => {
      const png = readPng(asset.file)
      expect(png.width, `${asset.file} should be at most ${asset.maxWidth} px wide`).toBeLessThanOrEqual(asset.maxWidth)
      expect(png.bytes, `${asset.file} should be at most ${asset.maxKb} kB`).toBeLessThanOrEqual(asset.maxKb * 1024)
    })
  }

  it('keeps the install icons at the sizes the manifest declares', () => {
    expect(readPng('app-icon-192.png').width).toBe(192)
    expect(readPng('app-icon-512.png').width).toBe(512)
  })
})
