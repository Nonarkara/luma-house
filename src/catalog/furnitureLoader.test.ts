import { describe, expect, it } from 'vitest'
import { FURNITURE_ASSETS } from './furnitureAssets'
import {
  cachedFurnitureCount,
  furnitureUrl,
  inflightFurnitureCount,
  loadFurnitureAsset,
  resetFurnitureCache,
} from './furnitureLoader'

const asset = FURNITURE_ASSETS[0]

function loaderFactory(loadAsync: (url: string) => Promise<{ scene: never }>) {
  return {
    gltfLoader: () => class {
      loadAsync = loadAsync
      setDRACOLoader() {}
      setKTX2Loader() {}
    },
  }
}

describe('low-level furniture loading', () => {
  it('normalises deployment-base URLs', () => {
    expect(furnitureUrl(asset, '/')).toBe(`/${asset.file}`)
    expect(furnitureUrl(asset, '/luma-house')).toBe(`/luma-house/${asset.file}`)
  })

  it('deduplicates an in-flight and cached asset', async () => {
    resetFurnitureCache()
    let resolveLoad!: (value: { scene: never }) => void
    let calls = 0
    const pending = new Promise<{ scene: never }>((resolve) => { resolveLoad = resolve })
    const factories = loaderFactory(async () => {
      calls += 1
      return pending
    })

    const first = loadFurnitureAsset(asset, '/', factories)
    const second = loadFurnitureAsset(asset, '/', factories)
    expect(first).toBe(second)
    expect(calls).toBe(1)
    expect(cachedFurnitureCount()).toBe(1)
    expect(inflightFurnitureCount()).toBe(1)

    resolveLoad({ scene: {} as never })
    await first
    expect(inflightFurnitureCount()).toBe(0)
  })

  it('turns a network or parser failure into the documented null fallback', async () => {
    resetFurnitureCache()
    const result = await loadFurnitureAsset(
      asset,
      '/',
      loaderFactory(async () => { throw new Error('broken GLB') }),
    )
    expect(result).toBeNull()
    expect(inflightFurnitureCount()).toBe(0)
  })
})
