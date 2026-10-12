import { openingDimensions } from '../openingGeometry'
import { roomHeight, siteOf } from '../plan'
import type { PlanState } from '../types'
import type { MeshPart } from './formats'

/** Same 0.15 m the 3D view and the BOQ use. */
export const WALL_M = 0.15
const ON_WALL_M = 0.25 // an opening counts as on a wall within this distance of its line

/** Push a closed box (12 triangles, outward winding) into `out`. Z is up. */
export function pushBox(out: number[], x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
  if (x1 - x0 <= 1e-9 || y1 - y0 <= 1e-9 || z1 - z0 <= 1e-9) return
  const v = [
    [x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0],
    [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1],
  ]
  const quads = [
    [0, 3, 2, 1], // bottom (z0), facing -z
    [4, 5, 6, 7], // top, +z
    [0, 1, 5, 4], // south (y0), -y
    [2, 3, 7, 6], // north, +y
    [1, 2, 6, 5], // east, +x
    [3, 0, 4, 7], // west, -x
  ]
  for (const [a, b, c, d] of quads) {
    out.push(...v[a], ...v[b], ...v[c], ...v[a], ...v[c], ...v[d])
  }
}

interface Run { horizontal: boolean; line: number; from: number; to: number; height: number }

/** Union the rooms' edges into wall runs so a shared wall is built once. */
export function wallRuns(plan: PlanState): Run[] {
  const site = siteOf(plan)
  const raw: Run[] = []
  for (const room of plan.rooms) {
    if (room.kind === 'terrace') continue
    const x0 = (room.x / 100) * site.w
    const x1 = ((room.x + room.w) / 100) * site.w
    const yTop = site.h - (room.y / 100) * site.h // plan y grows south; model y grows north
    const yBottom = site.h - ((room.y + room.h) / 100) * site.h
    const height = roomHeight(room)
    raw.push(
      { horizontal: true, line: yTop, from: x0, to: x1, height },
      { horizontal: true, line: yBottom, from: x0, to: x1, height },
      { horizontal: false, line: x0, from: yBottom, to: yTop, height },
      { horizontal: false, line: x1, from: yBottom, to: yTop, height },
    )
  }
  const key = (r: Run) => `${r.horizontal ? 'h' : 'v'}:${r.line.toFixed(3)}`
  const groups = new Map<string, Run[]>()
  for (const r of raw) groups.set(key(r), [...(groups.get(key(r)) ?? []), r])
  const merged: Run[] = []
  for (const runs of groups.values()) {
    runs.sort((a, b) => a.from - b.from)
    let current = { ...runs[0] }
    for (const r of runs.slice(1)) {
      if (r.from <= current.to + 1e-6) {
        current.to = Math.max(current.to, r.to)
        // ponytail: a merged run takes the tallest room's height; per-segment heights if mixed ceilings matter.
        current.height = Math.max(current.height, r.height)
      } else {
        merged.push(current)
        current = { ...r }
      }
    }
    merged.push(current)
  }
  return merged
}

export interface HouseMesh {
  parts: MeshPart[]
  /** Building extent in metres, excluding the base plate margin. */
  bounds: { minX: number; minY: number; maxX: number; maxY: number; maxZ: number }
  /** Widest lintel span: an opening whose head is below the wall top. */
  longestLintelM: number
}

/**
 * The plan as a roofless architectural model: walls with real door and window
 * holes on a base plate. Units are metres, x east, y north, z up.
 */
export function houseMesh(plan: PlanState, options: { wallM?: number; baseM?: number } = {}): HouseMesh {
  const site = siteOf(plan)
  const t = options.wallM ?? WALL_M
  const baseT = options.baseM ?? 0.2
  const runs = wallRuns(plan)
  const walls: number[] = []
  let longestLintelM = 0

  for (const run of runs) {
    const openings = plan.openings
      .map((o) => {
        const ox = (o.x / 100) * site.w
        const oy = site.h - (o.y / 100) * site.h
        const across = run.horizontal ? oy : ox
        const along = run.horizontal ? ox : oy
        return { o, across, along }
      })
      .filter(({ across, along }) => Math.abs(across - run.line) <= ON_WALL_M && along >= run.from - 0.05 && along <= run.to + 0.05)
      .map(({ o, along }) => {
        const d = openingDimensions(o)
        return { start: Math.max(run.from, along - d.width / 2), end: Math.min(run.to, along + d.width / 2), sill: d.sill, head: Math.min(d.head, run.height) }
      })
      .sort((a, b) => a.start - b.start)

    const piece = (a: number, b: number, z0: number, z1: number) => {
      if (b - a <= 1e-6 || z1 - z0 <= 1e-6) return
      if (run.horizontal) pushBox(walls, a, run.line - t / 2, z0, b, run.line + t / 2, z1)
      else pushBox(walls, run.line - t / 2, a, z0, run.line + t / 2, b, z1)
    }

    // Solid wall between openings; extend the run by half a wall so corners close.
    let cursor = run.from - t / 2
    for (const gap of openings) {
      if (gap.start < cursor) continue // ponytail: overlapping openings — later one dropped; fine for concept plans.
      piece(cursor, gap.start, 0, run.height)
      piece(gap.start, gap.end, 0, gap.sill) // sill below a window; zero for doors
      piece(gap.start, gap.end, gap.head, run.height) // lintel above
      if (gap.head < run.height) longestLintelM = Math.max(longestLintelM, gap.end - gap.start)
      cursor = gap.end
    }
    piece(cursor, run.to + t / 2, 0, run.height)
  }

  const xs = runs.flatMap((r) => (r.horizontal ? [r.from, r.to] : [r.line]))
  const ys = runs.flatMap((r) => (r.horizontal ? [r.line] : [r.from, r.to]))
  const bounds = xs.length
    ? { minX: Math.min(...xs) - t / 2, minY: Math.min(...ys) - t / 2, maxX: Math.max(...xs) + t / 2, maxY: Math.max(...ys) + t / 2, maxZ: Math.max(...runs.map((r) => r.height)) }
    : { minX: 0, minY: 0, maxX: 0, maxY: 0, maxZ: 0 }

  const base: number[] = []
  const margin = 0.5
  if (xs.length) pushBox(base, bounds.minX - margin, bounds.minY - margin, -baseT, bounds.maxX + margin, bounds.maxY + margin, 0)

  return {
    parts: [
      { name: 'Base', color: '#8A8F98', positions: base },
      { name: 'Walls', color: '#F4F1EA', positions: walls },
    ],
    bounds,
    longestLintelM,
  }
}

/** Scale a Z-up metre mesh to millimetres at 1:denominator, origin at the base corner. */
export function scaleToPrint(mesh: HouseMesh, denominator: number, baseM: number): MeshPart[] {
  const k = 1000 / denominator
  const ox = mesh.bounds.minX - 0.5
  const oy = mesh.bounds.minY - 0.5
  return mesh.parts.map((part) => ({
    ...part,
    positions: part.positions.map((value, i) => {
      const axis = i % 3
      if (axis === 0) return Math.round((value - ox) * k * 1000) / 1000
      if (axis === 1) return Math.round((value - oy) * k * 1000) / 1000
      return Math.round((value + baseM) * k * 1000) / 1000
    }),
  }))
}
