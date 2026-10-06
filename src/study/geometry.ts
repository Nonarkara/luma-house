import { Box3, OrthographicCamera, Vector3 } from 'three'
import { openingsForRoomWall } from '../analysis/walls'
import type { Compass } from '../analysis'
import { defaultSite, roomHeight, siteOf } from '../plan'
import { openingDimensions } from '../openingGeometry'
import type { PlanState, Room, SiteSpec } from '../types'
export const WALL_M = 0.15
export const FLOOR_M = 0.1
export interface WallPart { key: string; position: [number, number, number]; size: [number, number, number] }
export function pointInMetres(x: number, y: number, site: SiteSpec) {
  return { mx: x / 100 * site.w - site.w / 2, mz: y / 100 * site.h - site.h / 2 }
}
export function roomBounds(room: Room, site: SiteSpec) {
  const a = pointInMetres(room.x, room.y, site), b = pointInMetres(room.x + room.w, room.y + room.h, site)
  return { minX: a.mx, maxX: b.mx, minZ: a.mz, maxZ: b.mz, cx: (a.mx + b.mx) / 2, cz: (a.mz + b.mz) / 2, width: b.mx - a.mx, depth: b.mz - a.mz }
}
/** Full-height physical wall pieces; view cuts never mutate these. */
export function wallParts(room: Room, compass: Compass, plan: PlanState): WallPart[] {
  const site = siteOf(plan), b = roomBounds(room, site), height = roomHeight(room)
  const horizontal = compass === 'N' || compass === 'S'
  const start = horizontal ? b.minX : b.minZ, end = horizontal ? b.maxX : b.maxZ
  const fixed = compass === 'N' ? b.minZ : compass === 'S' ? b.maxZ : compass === 'W' ? b.minX : b.maxX
  const cuts = openingsForRoomWall(plan, room.id, compass).map(opening => {
    const p = pointInMetres(opening.x, opening.y, site), d = openingDimensions(opening)
    const center = horizontal ? p.mx : p.mz
    return { id: opening.id, start: Math.max(start, center - d.width / 2), end: Math.min(end, center + d.width / 2), sill: Math.min(height, d.sill), head: Math.min(height, d.sill + d.height) }
  }).filter(c => c.end - c.start > 0.05).sort((a, b) => a.start - b.start)
  const parts: WallPart[] = []
  const add = (key: string, x: number, length: number, bottom: number, h: number) => {
    if (length <= 0 || h <= 0) return
    parts.push({ key, position: horizontal ? [x + length / 2, FLOOR_M + bottom + h / 2, fixed] : [fixed, FLOOR_M + bottom + h / 2, x + length / 2], size: horizontal ? [length, h, WALL_M] : [WALL_M, h, length] })
  }
  let cursor = start
  cuts.forEach((c, i) => {
    add(`pier-${i}`, cursor, c.start - cursor, 0, height)
    const a = Math.max(cursor, c.start)
    add(`sill-${c.id}`, a, c.end - a, 0, c.sill)
    add(`head-${c.id}`, a, c.end - a, c.head, height - c.head)
    cursor = Math.max(cursor, c.end)
  })
  add('pier-end', cursor, end - cursor, 0, height)
  return parts
}
export function cutPart(part: WallPart, cut: number) {
  const bottom = part.position[1] - part.size[1] / 2
  const height = Math.max(0, Math.min(part.size[1], cut - bottom))
  return { height, y: bottom + height / 2, capped: height > 0 && height < part.size[1] - 0.0001 }
}
export function modelBounds(plan: Pick<PlanState, 'rooms' | 'site'>) {
  const site = plan.site ?? defaultSite(), box = new Box3()
  for (const room of plan.rooms) {
    const b = roomBounds(room, site)
    box.expandByPoint(new Vector3(b.minX - WALL_M, 0, b.minZ - WALL_M))
    box.expandByPoint(new Vector3(b.maxX + WALL_M, roomHeight(room) + FLOOR_M, b.maxZ + WALL_M))
  }
  if (box.isEmpty()) box.set(new Vector3(-site.w / 2, 0, -site.h / 2), new Vector3(site.w / 2, 3, site.h / 2))
  return box
}
/** A true parallel camera fitted to the building; Top-Down keeps north up. */
export function drawingCamera(plan: PlanState, preset: 'axonometric' | 'topdown', aspect: number) {
  const box = modelBounds(plan), target = box.getCenter(new Vector3()), size = box.getSize(new Vector3())
  const extent = Math.max(size.x, size.y, size.z, 3)
  const camera = new OrthographicCamera(-1, 1, 1, -1, 0.01, extent * 20)
  camera.up.set(0, preset === 'topdown' ? 0 : 1, preset === 'topdown' ? -1 : 0)
  camera.position.copy(target).add(new Vector3(...(preset === 'topdown' ? [0, extent * 3, 0] : [extent * 3, extent * 3, extent * 3]) as [number, number, number]))
  camera.lookAt(target); camera.updateMatrixWorld()
  let x = 0, y = 0
  for (const a of [box.min.x, box.max.x]) for (const b of [box.min.y, box.max.y]) for (const c of [box.min.z, box.max.z]) {
    const p = new Vector3(a, b, c).applyMatrix4(camera.matrixWorldInverse)
    x = Math.max(x, Math.abs(p.x)); y = Math.max(y, Math.abs(p.y))
  }
  const half = Math.max(y, x / Math.max(aspect, 0.1), 1) * 1.4
  camera.left = -half * aspect; camera.right = half * aspect; camera.top = half; camera.bottom = -half
  camera.updateProjectionMatrix()
  return { camera, target: target.toArray() as [number, number, number] }
}
/** Presentation, geography and saved views do not alter solids. */
export function physicalGeometryKey(plan: PlanState, roofStyle = 'flat') {
  return JSON.stringify({ site: siteOf(plan), rooms: plan.rooms, openings: plan.openings, furniture: plan.furniture, solar: plan.systems.solar, roofStyle })
}
export function geometryFingerprint(plan: PlanState, roofStyle = 'flat') {
  const data = physicalGeometryKey(plan, roofStyle)
  let hash = 2166136261
  for (let i = 0; i < data.length; i++) hash = Math.imul(hash ^ data.charCodeAt(i), 16777619)
  return `${data.length}-${(hash >>> 0).toString(16)}`
}
export function sheetScale(site: SiteSpec, wallHeight = 3) {
  // Include annotation margins and the vertical section, not just the footprint.
  return [50, 100, 200, 500, 1000, 2000, 5000, 10000].find(n => site.w * 1000 / n <= 128 && site.h * 1000 / n <= 64 && (Math.max(3, wallHeight) + FLOOR_M) * 1000 / n + 14 <= 45) ?? 10000
}
