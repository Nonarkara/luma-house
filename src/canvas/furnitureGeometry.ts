import type { Camera, Light, Mesh, Object3D } from 'three'
import { fitScaleFor, type FurnitureAsset } from '../catalog/furnitureAssets'

/** Catalogue scenes provide geometry/materials; the building owns all lighting. */
export function prepareFurnitureScene(source: Object3D): Object3D {
  const clone = source.clone(true), excluded: Object3D[] = []
  clone.traverse(child => {
    if ((child as Light).isLight || (child as Camera).isCamera) excluded.push(child)
    else if ((child as Mesh).isMesh) { child.castShadow = true; child.receiveShadow = true }
  })
  for (const child of excluded) child.removeFromParent()
  return clone
}

/** Resolved geometry and every schematic/error representation share one height. */
export function furnitureHeight(asset: FurnitureAsset | null, widthM: number, depthM: number, kindHeight: number): number {
  return asset ? asset.heightM * fitScaleFor(asset, widthM, depthM) : kindHeight
}

/** Async geometry changes are outside the saved-plan key used by the sun cache. */
export function refreshFurnitureShadows(scene: Object3D): void {
  scene.traverse(child => {
    if ((child as Light).isLight && 'shadow' in child && child.shadow) {
      (child.shadow as { needsUpdate: boolean }).needsUpdate = true
    }
  })
}
