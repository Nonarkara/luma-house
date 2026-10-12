import { describe, expect, it } from 'vitest'
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type { Mesh, Object3D } from 'three'
import { chinaApartmentPlan } from '../mockups/chinaApartment'
import { meshToBinaryStl, meshToGlb } from './formats'
import { houseMesh, scaleToPrint } from './houseMesh'

// Independent readers: three.js's own loaders, as used by online model viewers.
// 3MF needs DOMParser, so its reader check runs in the browser, not here.
const mesh = houseMesh(chinaApartmentPlan)
const triangles = mesh.parts.reduce((sum, p) => sum + p.positions.length / 9, 0)
const buffer = (bytes: Uint8Array) => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer
const countTriangles = (root: Object3D) => {
  let n = 0
  root.traverse((o) => { const g = (o as Mesh).geometry; if (g) n += (g.index ? g.index.count : g.attributes.position.count) / 3 })
  return n
}

describe('exported files open in independent readers', () => {
  it('STL', () => {
    const geometry = new STLLoader().parse(buffer(meshToBinaryStl(scaleToPrint(mesh, 100, 0.2))))
    expect(geometry.attributes.position.count / 3).toBe(triangles)
  })

  it('GLB', async () => {
    const gltf = await new GLTFLoader().parseAsync(buffer(meshToGlb(mesh.parts)), '')
    expect(countTriangles(gltf.scene)).toBe(triangles)
    // glTF is Y up: the walls rise along +Y to the tallest room height.
    let maxY = -Infinity
    gltf.scene.traverse((o) => { const g = (o as Mesh).geometry; if (g) { g.computeBoundingBox(); maxY = Math.max(maxY, g.boundingBox!.max.y) } })
    expect(maxY).toBeCloseTo(mesh.bounds.maxZ, 3)
  })
})
