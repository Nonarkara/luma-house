/**
 * Lazy glTF loading for the furniture catalogue.
 *
 * One fetch per asset, shared across every piece that uses it, held in a module
 * cache so re-rendering the scene never re-downloads. Decoder hooks are supplied
 * by the caller, which keeps this file free of a three.js import and cheap to
 * unit-test in node. The current React scene uses drei's `useGLTF`; this lower-
 * level adapter remains useful to non-React hosts and catalogue build checks.
 *
 * Failure is a normal path, not an exception: an offline or 404 asset resolves to
 * `null` and the caller draws its measured box instead. The drawing is never
 * blocked by a missing model.
 */

import type { FurnitureAsset } from './furnitureAssets'

export interface LoadedFurniture {
  assetId: string
  url: string
  bytes: number
}

/** Minimal shape of a glTF that this module actually consumes. */
interface MiniScene {
  traverse(callback: (child: { type?: string; isMesh?: boolean; material?: unknown; castShadow?: boolean; receiveShadow?: boolean }) => void): void
  clone(recursive?: boolean): MiniScene
}

interface MiniGLTF {
  scene: MiniScene
}

const cache = new Map<string, Promise<MiniGLTF | null>>()
const inflight = new Set<string>()

/** Test seam: clear the module cache so each test starts clean. */
export function resetFurnitureCache(): void {
  cache.clear()
  inflight.clear()
}

/** Number of distinct assets currently cached — used to assert dedupe. */
export function cachedFurnitureCount(): number {
  return cache.size
}

/** Number of unique asset ids still loading. */
export function inflightFurnitureCount(): number {
  return inflight.size
}

type LoaderCtor = new () => {
  loadAsync(url: string): Promise<MiniGLTF>
  setDRACOLoader(loader: unknown): unknown
  setKTX2Loader(loader: unknown): unknown
  setMeshoptDecoder?(decoder: unknown): unknown
}

type ConstructorLoader = {
  setDRACOLoader?: (loader: unknown) => void
  setKTX2Loader?: (loader: unknown) => void
}

async function loadWith(
  url: string,
  loaderFactory: () => { loader: { loadAsync(url: string): Promise<MiniGLTF> }; dispose(): void },
): Promise<MiniGLTF | null> {
  const { loader, dispose } = loaderFactory()
  try {
    const gltf = await loader.loadAsync(url)
    return gltf
  } catch {
    // A missing or unreadable asset must never break the drawing.
    return null
  } finally {
    dispose()
  }
}

/**
 * Fetch one catalogue asset. Returns the same promise for repeat calls, so N
 * pieces of the same kind cost one download.
 */
export function loadFurnitureAsset(
  asset: FurnitureAsset,
  base: string,
  factories: {
    gltfLoader: () => LoaderCtor
    dracoLoader?: () => unknown
    ktx2Loader?: () => unknown
    meshoptDecoder?: () => unknown
  },
): Promise<MiniGLTF | null> {
  const url = `${base}${base.endsWith('/') ? '' : '/'}${asset.file}`
  const existing = cache.get(url)
  if (existing) return existing
  inflight.add(asset.id)
  const promise = loadWith(url, () => {
    const GLTFLoaderCtor = factories.gltfLoader()
    const loader = new GLTFLoaderCtor()
    const configure: ConstructorLoader = loader as unknown as ConstructorLoader
    if (factories.dracoLoader) configure.setDRACOLoader?.(factories.dracoLoader())
    if (factories.ktx2Loader) configure.setKTX2Loader?.(factories.ktx2Loader())
    if (factories.meshoptDecoder && loader.setMeshoptDecoder) {
      loader.setMeshoptDecoder(factories.meshoptDecoder())
    }
    return { loader, dispose: () => {} }
  }).finally(() => {
    inflight.delete(asset.id)
  })
  cache.set(url, promise)
  return promise
}

/** Resolved URL for an asset, exposed for tests and for preloading. */
export function furnitureUrl(asset: FurnitureAsset, base: string): string {
  return `${base}${base.endsWith('/') ? '' : '/'}${asset.file}`
}

/** Warm the cache for a set of assets without blocking on the result. */
export function prefetchFurnitureAssets(
  assets: readonly FurnitureAsset[],
  base: string,
  factories: Parameters<typeof loadFurnitureAsset>[2],
): void {
  for (const asset of assets) void loadFurnitureAsset(asset, base, factories)
}
