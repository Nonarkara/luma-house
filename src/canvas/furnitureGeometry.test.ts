import { describe, expect, it } from 'vitest'
import { BoxGeometry, DirectionalLight, Group, Mesh, MeshStandardMaterial, PerspectiveCamera, Scene, SpotLight } from 'three'
import { furnitureAssetById } from '../catalog/furnitureAssets'
import { furnitureHeight, prepareFurnitureScene, refreshFurnitureShadows } from './furnitureGeometry'

describe('furniture belongs to the building lighting model', () => {
  it('removes imported studio lights and cameras without changing shared source geometry/materials', () => {
    const source = new Scene(), group = new Group(), mesh = new Mesh(new BoxGeometry(), new MeshStandardMaterial())
    mesh.name = 'real furniture'
    const light = new DirectionalLight('white', 3), camera = new PerspectiveCamera()
    group.add(mesh, light, camera); source.add(group)
    const result = prepareFurnitureScene(source), retained: string[] = []
    result.traverse(child => retained.push(child.type))
    expect(retained).not.toContain('DirectionalLight'); expect(retained).not.toContain('PerspectiveCamera')
    const copy = result.getObjectByName(mesh.name) as Mesh
    expect(copy.castShadow).toBe(true); expect(copy.receiveShadow).toBe(true)
    expect(copy.geometry).toBe(mesh.geometry); expect(copy.material).toBe(mesh.material)
    expect(mesh.castShadow).toBe(false); expect(group.children).toContain(light); expect(group.children).toContain(camera)
    expect(light.intensity).toBe(3)
  })

  it.each(['glass-vase', 'wood-leather-sofa'])('%s keeps its measured height in schematic and error fallback', id => {
    const asset = furnitureAssetById(id)!
    expect(furnitureHeight(asset, asset.widthM, asset.depthM, .6)).toBe(asset.heightM)
    expect(furnitureHeight(asset, asset.widthM / 2, asset.depthM / 2, .6)).toBe(asset.heightM / 2)
  })

  it('keeps the generic height for kinds without a matching model', () => {
    expect(furnitureHeight(null, 2, 1.8, .55)).toBe(.55)
  })

  it('refreshes existing cached shadows for arriving/removing geometry without enabling continuous updates', () => {
    const scene = new Scene(), sun = new DirectionalLight(), spot = new SpotLight()
    sun.shadow.autoUpdate = false; spot.shadow.autoUpdate = false
    sun.shadow.needsUpdate = false; spot.shadow.needsUpdate = false
    scene.add(sun, spot)
    refreshFurnitureShadows(scene)
    expect(sun.shadow.needsUpdate).toBe(true); expect(spot.shadow.needsUpdate).toBe(true)
    expect(sun.shadow.autoUpdate).toBe(false); expect(spot.shadow.autoUpdate).toBe(false)
    expect(scene.children).toHaveLength(2)
  })
})
