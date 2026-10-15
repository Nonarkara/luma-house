import { describe, expect, it } from 'vitest'
import { readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
// @ts-expect-error The build helper is intentionally plain ESM so Node can run it directly.
import { readGlbChunks, writeGlbChunks, worldBoundsFromAccessorBounds } from '../../scripts/furniture-glb.mjs'
import {
  FURNITURE_ASSETS,
  FURNITURE_BUDGET_BYTES,
  FURNITURE_CATALOGUE_BYTES,
  fitScaleFor,
  furnitureAssetFor,
  furnitureAssetsForKind,
  furnitureAssetUrl,
} from './furnitureAssets'
import { furnitureCatalog, furnitureSpecFor } from '../plan'
import type { FurnitureKind } from '../types'

const PUBLIC_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../public')

function shippedGeometry(asset: (typeof FURNITURE_ASSETS)[number]) {
  const path = resolve(PUBLIC_ROOT, asset.file)
  const { json } = readGlbChunks(readFileSync(path))
  return { json, bounds: worldBoundsFromAccessorBounds(json) }
}

describe('furniture catalogue integrity', () => {
  it('is not empty and has unique ids', () => {
    expect(FURNITURE_ASSETS.length).toBeGreaterThan(0)
    const ids = FURNITURE_ASSETS.map((asset) => asset.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('records a permissive licence and a credit for every asset', () => {
    for (const asset of FURNITURE_ASSETS) {
      expect(asset.license, `${asset.id} needs a licence`).toMatch(/^CC0|^CC-BY/)
      expect(asset.credit.length, `${asset.id} needs a credit`).toBeGreaterThan(3)
      expect(asset.source, `${asset.id} needs a source URL`).toMatch(/^https:\/\//)
    }
  })

  it('declares positive, furniture-scale dimensions', () => {
    for (const asset of FURNITURE_ASSETS) {
      expect(asset.widthM, `${asset.id} width`).toBeGreaterThan(0.05)
      expect(asset.widthM, `${asset.id} width`).toBeLessThan(3.5)
      expect(asset.depthM, `${asset.id} depth`).toBeGreaterThan(0.05)
      expect(asset.depthM, `${asset.id} depth`).toBeLessThan(3.5)
      expect(asset.heightM, `${asset.id} height`).toBeGreaterThan(0.05)
      expect(asset.heightM, `${asset.id} height`).toBeLessThan(3)
    }
  })

  it('ships every file it references, at the exact declared size', () => {
    for (const asset of FURNITURE_ASSETS) {
      const path = resolve(PUBLIC_ROOT, asset.file)
      expect(statSync(path).isFile(), `${asset.id} missing at ${asset.file}`).toBe(true)
      expect(statSync(path).size, `${asset.id} size drifted from the manifest`).toBe(asset.bytes)
    }
  })

  it('stays inside the lazy-load budget so furniture never enters first paint', () => {
    expect(FURNITURE_CATALOGUE_BYTES).toBe(
      FURNITURE_ASSETS.reduce((sum, asset) => sum + asset.bytes, 0),
    )
    expect(FURNITURE_CATALOGUE_BYTES).toBeLessThanOrEqual(FURNITURE_BUDGET_BYTES)
  })

  it('resolves paths under the deployment base, with or without a trailing slash', () => {
    expect(furnitureAssetUrl('furniture/models/x.glb', '/')).toBe('/furniture/models/x.glb')
    expect(furnitureAssetUrl('furniture/models/x.glb', '/app/')).toBe('/app/furniture/models/x.glb')
    expect(furnitureAssetUrl('furniture/models/x.glb', '/app')).toBe('/app/furniture/models/x.glb')
  })
})

describe('the shipped geometry agrees with the drawing', () => {
  /** The load-bearing test: shipped geometry and drawn footprint stay one fact. */
  it.each(FURNITURE_ASSETS.map((asset) => [asset.id, asset] as const))(
    '%s measures within a centimetre of its manifest footprint',
    (_id, asset) => {
      const { bounds } = shippedGeometry(asset)
      expect(Math.abs(bounds.size[0] - asset.widthM), `${asset.id} width`).toBeLessThanOrEqual(0.01)
      expect(Math.abs(bounds.size[2] - asset.depthM), `${asset.id} depth`).toBeLessThanOrEqual(0.01)
      expect(Math.abs(bounds.size[1] - asset.heightM), `${asset.id} height`).toBeLessThanOrEqual(0.01)
    },
  )

  it.each(FURNITURE_ASSETS.map((asset) => [asset.id, asset] as const))(
    '%s is seated on the floor and centred on its footprint',
    (_id, asset) => {
      const { bounds } = shippedGeometry(asset)
      // A mesh floating above y=0 would visibly detach from the plan.
      expect(Math.abs(bounds.min[1]), `${asset.id} is not seated on the floor`).toBeLessThan(0.01)
      // Centred so rotation about the piece's own centre stays in the plan.
      const centreX = (bounds.min[0] + bounds.max[0]) / 2
      const centreZ = (bounds.min[2] + bounds.max[2]) / 2
      expect(Math.abs(centreX), `${asset.id} is not centred in x`).toBeLessThan(0.01)
      expect(Math.abs(centreZ), `${asset.id} is not centred in z`).toBeLessThan(0.01)
    },
  )

  it('uses Meshopt rather than a runtime-fetched Draco decoder', () => {
    for (const asset of FURNITURE_ASSETS) {
      const { json } = shippedGeometry(asset)
      expect(json.extensionsRequired ?? [], asset.id).toContain('EXT_meshopt_compression')
      expect(json.extensionsRequired ?? [], asset.id).not.toContain('KHR_draco_mesh_compression')
    }
  })
})

describe('the GLB writer survives non-ASCII metadata', () => {
  /**
   * Regression guard. A glTF JSON chunk is measured in bytes, but
   * `String.length` counts UTF-16 code units. Any multi-byte character — a `©`,
   * an author name in CJK, an em dash — made the written file one byte short,
   * which silently truncated the JSON and produced a GLB that no other tool
   * could parse. The real catalogue hit this on SheenWoodLeatherSofa.
   */
  it('round-trips a JSON chunk containing multi-byte characters', () => {
    const json = {
      asset: { version: '2.0' },
      extras: { credit: '© 2024 Darmstadt Graphics Group GmbH — 版权所有' },
      scenes: [{ nodes: [] }],
      nodes: [],
    }
    const out = writeGlbChunks(json, Buffer.alloc(16, 7))
    const declaredLength = out.readUInt32LE(12)
    const chunk = out.subarray(20, 20 + declaredLength)
    expect(() => JSON.parse(chunk.toString('utf8'))).not.toThrow()
    expect(JSON.parse(chunk.toString('utf8')).extras.credit).toBe(json.extras.credit)
  })

  it('keeps the BIN chunk byte-identical', () => {
    const bin = Buffer.from([1, 2, 3, 4, 5])
    const out = writeGlbChunks({ asset: { version: '2.0' } }, bin)
    const binLength = out.readUInt32LE(out.readUInt32LE(12) + 12 + 8)
    const written = out.subarray(out.readUInt32LE(12) + 12 + 8 + 8, out.readUInt32LE(12) + 12 + 8 + 8 + binLength)
    expect([...written.subarray(0, 5)]).toEqual([1, 2, 3, 4, 5])
  })

  it('reads back a written GLB through the chunk reader', () => {
    const json = { asset: { version: '2.0' }, scenes: [{ nodes: [] }], nodes: [], note: 'héllo' }
    const parsed = readGlbChunks(writeGlbChunks(json, Buffer.alloc(8, 1)))
    expect(parsed.json.note).toBe('héllo')
  })
})

describe('resolving a piece to real geometry', () => {
  it('gives a sofa real geometry', () => {
    const asset = furnitureAssetFor('sofa', 2.2, 0.9)
    expect(asset).not.toBeNull()
    expect(asset?.serves).toContain('sofa')
  })

  it('prefers an exact footprint match, which needs no scaling at all', () => {
    expect(furnitureAssetFor('sofa', 2.73, 0.92)?.id).toBe('wood-leather-sofa')
    expect(furnitureAssetFor('sofa', 2.19, 1.02)?.id).toBe('glam-velvet-sofa')
  })

  it('still returns same-kind geometry for a different-sized piece', () => {
    const asset = furnitureAssetFor('sofa', 1.9, 0.85)
    expect(asset?.serves).toContain('sofa')
    // Not an exact match, so the renderer must scale it.
    expect(asset && Math.abs(asset.widthM - 1.9) <= 0.02).toBe(false)
  })

  it('returns nothing for kinds with no real mesh, so the box stays honest', () => {
    for (const kind of ['bed', 'dining', 'wardrobe', 'desk', 'wc'] as const) {
      expect(furnitureAssetFor(kind, 2, 1), kind).toBeNull()
      expect(furnitureAssetsForKind(kind), kind).toHaveLength(0)
    }
  })

  it('rotates through alternatives deterministically', () => {
    const first = furnitureAssetFor('sofa', 2.2, 0.9, 0)
    const second = furnitureAssetFor('sofa', 2.2, 0.9, 1)
    expect(first?.id).not.toBe(second?.id)
    expect(furnitureAssetFor('sofa', 2.2, 0.9, 0)?.id).toBe(first?.id)
  })

  it('honours an explicit asset choice and rejects a mismatched choice', () => {
    expect(furnitureAssetFor('chair', 0.83, 0.57, 0, 'damask-chair')?.id).toBe('damask-chair')
    expect(furnitureAssetFor('sofa', 2.2, 0.9, 0, 'damask-chair')).toBeNull()
  })

  it('fits a mesh onto a differently-sized footprint with a bounded scale', () => {
    const asset = furnitureAssetFor('sofa', 2.73, 0.92)!
    const scale = fitScaleFor(asset, 2.2, 0.9)
    // The smaller ratio wins so the mesh never overhangs the drawn rectangle.
    expect(scale).toBeCloseTo(Math.min(2.2 / asset.widthM, 0.9 / asset.depthM), 10)
    expect(scale).toBeGreaterThan(0.1)
    expect(scale).toBeLessThan(4)
  })

  it('scales a real mesh so its drawn footprint is never exceeded', () => {
    for (const asset of FURNITURE_ASSETS) {
      const drawn = { w: 1.7, d: 0.95 }
      const scale = fitScaleFor(asset, drawn.w, drawn.d)
      expect(asset.widthM * scale, `${asset.id} overhangs in x`).toBeLessThanOrEqual(drawn.w + 1e-9)
      expect(asset.depthM * scale, `${asset.id} overhangs in z`).toBeLessThanOrEqual(drawn.d + 1e-9)
    }
  })
})

describe('the placed default and the rendered mesh are one measurement', () => {
  /**
   * The load-bearing claim of this whole feature, stated as an assertion.
   *
   * `plan.ts` holds the footprint a user gets when they place a piece with no
   * explicit size. `FurnitureMesh` scales a real mesh onto that same footprint.
   * Nothing else in the codebase ties those two numbers together, so a default
   * edited for looks could drift until a chair rendered at twice its size or a
   * vase at six times — and nothing would fail.
   *
   * Two separate promises are checked here:
   *
   *   1. Every kind the catalogue claims to serve actually resolves to a mesh
   *      when placed at its default. Otherwise the catalogue advertises geometry
   *      the user silently never sees.
   *   2. That mesh is served near-natively. A scale far from 1 means the default
   *      footprint and the mesh disagree about what the object is, which is the
   *      same lie as drawing a 2.2 m sofa with a chair mesh in it.
   */
  const servedKinds = FURNITURE_ASSETS.flatMap((asset) => asset.serves)
  const uniqueKinds = [...new Set(servedKinds)]

  it.each(uniqueKinds)('%s places a real mesh at its default footprint', (kind) => {
    const spec = furnitureCatalog[kind as FurnitureKind]
    const asset = furnitureAssetFor(kind as FurnitureKind, spec.w, spec.d)
    expect(asset, `${kind} is advertised as having real geometry but resolves to a box`).not.toBeNull()
    const scale = fitScaleFor(asset!, spec.w, spec.d)
    expect(scale, `${kind} default ${spec.w}x${spec.d} m is served by ${asset!.id} at ${scale.toFixed(2)}x`).toBeGreaterThan(0.75)
    expect(scale, `${kind} default ${spec.w}x${spec.d} m is served by ${asset!.id} at ${scale.toFixed(2)}x`).toBeLessThan(1.34)
  })

  it('reports the size a default piece would actually draw', () => {
    // Guards the other half: `furnitureSpecFor` is what every 2D layer reads for
    // a piece with no explicit size, so it must agree with the catalog default.
    for (const kind of uniqueKinds) {
      const piece = { id: 'probe', kind: kind as FurnitureKind, x: 0, y: 0, rotated: false }
      expect(furnitureSpecFor(piece)).toEqual({ w: furnitureCatalog[kind as FurnitureKind].w, d: furnitureCatalog[kind as FurnitureKind].d })
    }
  })

  it('never lets a mesh overhang the rectangle the plan draws', () => {
    for (const asset of FURNITURE_ASSETS) {
      for (const kind of asset.serves) {
        const spec = furnitureCatalog[kind]
        const scale = fitScaleFor(asset, spec.w, spec.d)
        expect(asset.widthM * scale, `${asset.id} as ${kind} overhangs in x`).toBeLessThanOrEqual(spec.w + 1e-9)
        expect(asset.depthM * scale, `${asset.id} as ${kind} overhangs in z`).toBeLessThanOrEqual(spec.d + 1e-9)
      }
    }
  })
})
