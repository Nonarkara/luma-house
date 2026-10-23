import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Html, Edges } from '@react-three/drei'
import { useThree, type ThreeEvent } from '@react-three/fiber'
import { Plane, Raycaster, Vector2, Vector3 } from 'three'
import type { OrbitControls } from 'three-stdlib'
import { furnitureRectFor } from '../plan'
import type { Furniture, SiteSpec } from '../types'
import { moveFurnitureTo } from './furniturePlacement'

/** Floor-plane interaction is independent of camera angle and model complexity. */
export function SpatialFurniture({ item, site, selected, enabled, height, color, controls, select, preview, commit, children }: {
  item: Furniture; site: SiteSpec; selected: boolean; enabled: boolean; height: number; color: string
  controls: React.RefObject<OrbitControls>
  select: (id: string) => void
  preview: (item: Furniture | null) => void
  commit: (id: string, x: number, y: number) => void
  children: (item: Furniture) => ReactNode
}) {
  const { camera, gl } = useThree()
  const [draft, setDraft] = useState<Furniture | null>(null)
  const cleanup = useRef<(() => void) | null>(null)
  useEffect(() => () => cleanup.current?.(), [])
  // Undo, deletion or a view change cancels an unfinished drag, without saving it.
  useEffect(() => { cleanup.current?.() }, [item, enabled])
  const pose = draft ?? item, rect = furnitureRectFor(pose, site)
  const center: [number, number, number] = [((rect.x + rect.w / 2) / 100 - .5) * site.w, .1 + height / 2, ((rect.y + rect.h / 2) / 100 - .5) * site.h]

  const start = (event: PointerEvent) => {
    if (!enabled || event.button !== 0 || cleanup.current) return
    select(item.id)
    const ray = new Raycaster(), point = new Vector3(), plane = new Plane(new Vector3(0, 1, 0), -.1)
    const project = (x: number, y: number) => {
      const box = gl.domElement.getBoundingClientRect()
      ray.setFromCamera(new Vector2((x - box.left) / box.width * 2 - 1, -(y - box.top) / box.height * 2 + 1), camera)
      return ray.ray.intersectPlane(plane, point)?.clone() ?? null
    }
    const origin = project(event.clientX, event.clientY)
    if (!origin) return
    const orbit = controls.current, wasEnabled = orbit?.enabled ?? false
    if (orbit) orbit.enabled = false
    let latest = item, moved = false
    const move = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId) return
      if (!moved && Math.hypot(next.clientX - event.clientX, next.clientY - event.clientY) < 3) return
      const p = project(next.clientX, next.clientY)
      if (!p) return
      const candidate = moveFurnitureTo(item, item.x + (p.x - origin.x) / site.w * 100, item.y + (p.z - origin.z) / site.h * 100, site)
      if (!candidate) return
      moved = true; latest = candidate
      setDraft(candidate); preview(candidate)
    }
    const clear = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', cancel)
      window.removeEventListener('blur', cancel)
      window.removeEventListener('keydown', key)
      if (orbit) orbit.enabled = wasEnabled
      cleanup.current = null
      setDraft(null); preview(null)
    }
    const up = (next: PointerEvent) => {
      if (next.pointerId !== event.pointerId) return
      move(next)
      clear()
      if (moved) commit(item.id, latest.x, latest.y)
    }
    const cancel = () => clear()
    const key = (next: KeyboardEvent) => { if (next.key === 'Escape') { next.stopImmediatePropagation(); clear() } }
    cleanup.current = clear
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', cancel)
    window.addEventListener('blur', cancel)
    window.addEventListener('keydown', key)
  }
  const down = (event: ThreeEvent<PointerEvent>) => {
    if (!enabled) return
    event.stopPropagation(); start(event.nativeEvent)
  }

  return <group>
    {children(pose)}
    {enabled && <mesh position={center} onPointerDown={down} onClick={event => event.stopPropagation()}>
      <boxGeometry args={[rect.w / 100 * site.w, height, rect.h / 100 * site.h]} />
      <meshBasicMaterial colorWrite={false} depthWrite={false} />
      {selected && <Edges color={color} lineWidth={1.5} />}
    </mesh>}
    {enabled && selected && <Html position={[center[0], .12 + height, center[2]]} center zIndexRange={[4, 0]}>
      <button type="button" className="spatial-furniture-handle" aria-label="Drag selected furniture on the floor"
        onPointerDown={event => { event.stopPropagation(); start(event.nativeEvent) }}
        onClick={event => event.stopPropagation()} title="Drag on the floor; Escape cancels">Move</button>
    </Html>}
  </group>
}
