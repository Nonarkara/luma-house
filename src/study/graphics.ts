import { roomHeight, siteOf, sunVector } from '../plan'
import { citySunPosition } from '../location/solar'
import type { PlanState, ProjectLocation } from '../types'
import { FLOOR_M, wallParts, type WallPart } from './geometry'

/** All pieces retain real sill/lintel gaps. Presentation cuts do not alter casters. */
export function studyWalls(plan: PlanState): WallPart[] {
  return plan.rooms.filter(r => r.kind !== 'terrace').flatMap(r =>
    (['N', 'S', 'E', 'W'] as const).flatMap(c => wallParts(r, c, plan)))
}

export function planWallCuts(plan: PlanState) {
  return plan.rooms.filter(r => r.kind !== 'terrace').flatMap(r => {
    // A room's horizontal section is 1.2 m above its finished floor, or half
    // its height if shorter. This preserves atypical low walls and high sills.
    const cut = FLOOR_M + Math.min(1.2, roomHeight(r) / 2)
    return (['N', 'S', 'E', 'W'] as const).flatMap(c => wallParts(r, c, plan))
      .filter(p => p.position[1] + p.size[1] / 2 > cut && p.position[1] - p.size[1] / 2 < cut)
  })
}

export function dimensionStops(plan: PlanState, axis: 'x' | 'y') {
  const site = siteOf(plan), extent = axis === 'x' ? site.w : site.h
  return [...new Set(plan.rooms.flatMap(r => [r[axis], r[axis] + (axis === 'x' ? r.w : r.h)])
    .map(p => Math.round(p / 100 * extent * 1000000) / 1000000))].sort((a, b) => a - b)
}

export function seasonalSun(location: ProjectLocation, year: number, hour: number) {
  return [5, 11].map(month => {
    const date = new Date(Date.UTC(year, month, 21))
    const day = Math.round((date.getTime() - Date.UTC(year, 0, 0)) / 86400000)
    const sun = citySunPosition(location, day, hour, year)
    // SunCalc 2 returns degrees clockwise from north; reuse the live 3D basis.
    const vector = sunVector(sun.azimuth, sun.altitude)
    return { date: date.toISOString().slice(0, 10), day, altitude: sun.altitude,
      bearing: sun.azimuth, vector }
  })
}
export type SeasonalSun = ReturnType<typeof seasonalSun>[number]
type Point = { x: number; z: number }
function hull(points: Point[]): Point[] {
  const sorted = points.sort((a, b) => a.x - b.x || a.z - b.z)
  const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x)
  const half = (values: Point[]) => {
    const result: Point[] = []
    for (const p of values) {
      while (result.length >= 2 && cross(result[result.length - 2], result[result.length - 1], p) <= 0) result.pop()
      result.push(p)
    }
    return result.slice(0, -1)
  }
  return [...half(sorted), ...half([...sorted].reverse())]
}

/** Parallel projection of every solid corner onto ground y=0, opposite the sun.
 * A convex cuboid's ground shadow is the hull of its eight projected corners.
 * Opaque polygon union (not stacked opacity) preserves opening/solid differences. */
export function groundShadows(parts: WallPart[], sun: SeasonalSun): Point[][] {
  if (sun.altitude <= 0) return []
  return parts.map(p => hull([-1, 1].flatMap(a => [-1, 1].flatMap(b => [-1, 1].map(c => {
    const y = p.position[1] + b * p.size[1] / 2
    return { x: p.position[0] + a * p.size[0] / 2 - y * sun.vector.x / sun.vector.y,
      z: p.position[2] + c * p.size[2] / 2 - y * sun.vector.z / sun.vector.y }
  })))))
}

export function studyHeight(plan: PlanState) { return Math.max(3, ...plan.rooms.map(roomHeight)) + FLOOR_M }
