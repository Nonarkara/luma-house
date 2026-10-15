/**
 * One furniture piece in the 3D scene.
 *
 * Draws the real measured mesh when the catalogue has one for this piece, and
 * the measured box otherwise. Both paths agree on footprint by construction: the
 * mesh is uniformly scaled onto `widthM × depthM`, which is the same rectangle the
 * 2D plan and the axonometric sheet draw. Schematic views keep full-height shadow
 * geometry; loaded meshes cast their own shadows without a duplicate box.
 *
 * Wireframe and architectural modes keep the box treatment — the point of those
 * modes is a legible drawing, not a material study — and real geometry appears in
 * the default solid view.
 */

import { Edges, useGLTF } from '@react-three/drei'
import { Component, Suspense, useLayoutEffect, useMemo, type ReactNode } from 'react'
import { useThree } from '@react-three/fiber'
import { furnitureHeight, prepareFurnitureScene, refreshFurnitureShadows } from './furnitureGeometry'
import type { Furniture, SiteSpec } from '../types'
import { furnitureRectFor, furnitureSpecFor } from '../plan'
import { fitScaleFor, furnitureAssetFor, type FurnitureAsset } from '../catalog/furnitureAssets'

const WIREFILL_COLOR = '#faf7f1'
const WIREFILL_OPACITY = 0.16

export interface FurniturePieceProps {
  item: Furniture
  site: SiteSpec
  wireframe: boolean
  edgeColor: string
  architectural: boolean
  sectionHeight: number
  /** Full height of the generic box for this kind, in metres. */
  kindHeight: number
  floorThickness: number
  /** Resolve the catalogue asset for a piece. Injected so tests can drive it. */
  resolveAsset?: typeof furnitureAssetFor
}

class FurnitureAssetBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError(): { failed: boolean } {
    return { failed: true }
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children
  }
}

/** Rebuild once when a fallback/model replaces another, then let idle GPU rest. */
function ShadowRepresentation() {
  const scene = useThree(state => state.scene), invalidate = useThree(state => state.invalidate)
  useLayoutEffect(() => {
    const refresh = () => { refreshFurnitureShadows(scene); invalidate() }
    refresh()
    return refresh
  }, [scene, invalidate])
  return null
}

function MeasuredMesh({ asset, url, widthM, depthM }: {
  asset: FurnitureAsset; url: string; widthM: number; depthM: number
}) {
  // The decoder stays bundled; never mount a downloaded model's lights/cameras.
  const gltf = useGLTF(url, false, true)
  const clone = useMemo(() => prepareFurnitureScene(gltf.scene), [gltf.scene])
  const scale = fitScaleFor(asset, widthM, depthM)
  return <><primitive object={clone} scale={scale} raycast={() => {}} /><ShadowRepresentation /></>
}

/**
 * Renders one piece. Real geometry is attempted only in the solid view; the
 * schematic modes always use the measured box so the drawing stays legible.
 */
export default function FurniturePieceView({
  item,
  site,
  wireframe,
  edgeColor,
  architectural,
  sectionHeight,
  kindHeight,
  floorThickness,
  resolveAsset = furnitureAssetFor,
}: FurniturePieceProps) {
  const rect = useMemo(() => furnitureRectFor(item, site), [item, site])
  const spec = useMemo(() => furnitureSpecFor(item), [item])
  const widthM = (rect.w / 100) * site.w
  const depthM = (rect.h / 100) * site.h
  const { mx, mz } = {
    mx: ((rect.x + rect.w / 2) / 100) * site.w - site.w / 2,
    mz: ((rect.y + rect.h / 2) / 100) * site.h - site.h / 2,
  }
  // Resolve against the unrotated catalogue dimensions. Rotation belongs to
  // the placed object, not to the identity of the model.
  const asset = resolveAsset(item.kind, spec.w, spec.d, 0, item.assetId)
  const realHeight = furnitureHeight(asset, spec.w, spec.d, kindHeight)
  const height = Math.max(0, Math.min(realHeight, sectionHeight - floorThickness))
  const showReal = Boolean(asset) && !wireframe && !architectural && sectionHeight >= floorThickness + realHeight
  const url = asset ? `${import.meta.env.BASE_URL}${import.meta.env.BASE_URL.endsWith('/') ? '' : '/'}${asset.file}` : null

  const box = (
    <>
    <ShadowRepresentation />
    <mesh position={[0, realHeight / 2, 0]} castShadow raycast={() => {}}>
      <boxGeometry args={[widthM, realHeight, depthM]} />
      <meshBasicMaterial colorWrite={false} depthWrite={false} />
    </mesh>
    <mesh position={[0, height / 2, 0]}>
      <boxGeometry args={[widthM, height, depthM]} />
      <meshStandardMaterial
        color={wireframe || architectural ? WIREFILL_COLOR : '#8b8f98'}
        roughness={0.9}
        metalness={0}
        transparent={wireframe}
        opacity={wireframe ? WIREFILL_OPACITY : 1}
      />
      {(wireframe || architectural) && (
        <Edges color={edgeColor} threshold={1} lineWidth={architectural ? 0.7 : 1} />
      )}
    </mesh>
    </>
  )

  return (
    <group>
      <group position={[mx, floorThickness, mz]}>
        {showReal && asset && url ? (
          <FurnitureAssetBoundary key={url} fallback={box}>
            <Suspense fallback={box}>
              <group rotation={[0, item.rotated ? -Math.PI / 2 : 0, 0]}>
                <MeasuredMesh
                  asset={asset}
                  url={url}
                  widthM={spec.w}
                  depthM={spec.d}
                />
              </group>
            </Suspense>
          </FurnitureAssetBoundary>
        ) : (
          box
        )}
      </group>
    </group>
  )
}
