import { openingDimensions } from '../openingGeometry'
import { roomHeight, siteOf } from '../plan'
import type { PlanState } from '../types'
import type { MeshPart } from './formats'
import { unionBoxes, type SolidBox } from './unionBoxes'

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
    const points = [...new Set(runs.flatMap(run => [run.from, run.to]))].sort((a, b) => a - b)
    for (let i = 0; i < points.length - 1; i++) {
      const from = points[i], to = points[i + 1], middle = (from + to) / 2
      const covering = runs.filter(run => middle >= run.from && middle <= run.to)
      if (!covering.length) continue
      const height = Math.max(...covering.map(run => run.height))
      const previous = merged[merged.length - 1]
      if (previous && previous.horizontal === runs[0].horizontal && previous.line === runs[0].line && previous.to === from && previous.height === height) previous.to = to
      else merged.push({ ...runs[0], from, to, height })
    }
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
export function houseMesh(plan: PlanState, options: { wallM?: number; baseM?: number; boundsOnly?: boolean } = {}): HouseMesh {
  const site = siteOf(plan)
  const t = options.wallM ?? WALL_M
  const baseT = options.baseM ?? 0.2
  const runs = wallRuns(plan)
  const wallBoxes: SolidBox[] = []
  let longestLintelM = 0
  const lintelGroups = new Map<string, Array<{ start: number; end: number; sill: number; head: number }>>()

  for (const run of runs) {
    const openings = plan.openings
      .map((o) => {
        const ox = (o.x / 100) * site.w
        const oy = site.h - (o.y / 100) * site.h
        const across = run.horizontal ? oy : ox
        const along = run.horizontal ? ox : oy
        return { o, across, along }
      })
      .filter(({ o, across }) => (o.rotation === 0) === run.horizontal && Math.abs(across - run.line) <= ON_WALL_M)
      .map(({ o, along }) => {
        const d = openingDimensions(o)
        return { start: Math.max(run.from, along - d.width / 2), end: Math.min(run.to, along + d.width / 2), sill: d.sill, head: Math.min(d.head, run.height) }
      })
      .filter(gap => gap.end > gap.start)
      .sort((a, b) => a.start - b.start)

    const piece = (a: number, b: number, z0: number, z1: number) => {
      if (b - a <= 1e-6 || z1 - z0 <= 1e-6) return
      if (run.horizontal) wallBoxes.push([a, run.line - t / 2, z0, b, run.line + t / 2, z1])
      else wallBoxes.push([run.line - t / 2, a, z0, run.line + t / 2, b, z1])
    }

    // Partition the run at all aperture edges. Unioned openings remove the
    // same material regardless of their order, including partial overlaps.
    const collinear = runs.filter(other => other !== run && other.horizontal === run.horizontal && Math.abs(other.line - run.line) < 1e-8)
    const from = run.from - (collinear.some(other => Math.abs(other.to - run.from) < 1e-8) ? 0 : t / 2)
    const to = run.to + (collinear.some(other => Math.abs(other.from - run.to) < 1e-8) ? 0 : t / 2)
    const along = [...new Set([from, to, ...openings.flatMap(gap => [gap.start, gap.end])])].sort((a, b) => a - b)
    const levels = [...new Set([0, run.height, ...openings.flatMap(gap => [Math.min(run.height, gap.sill), gap.head])])].sort((a, b) => a - b)
    const key = `${run.horizontal}:${run.line.toFixed(3)}`
    lintelGroups.set(key, [...(lintelGroups.get(key) ?? []), ...openings.filter(gap => gap.head < run.height)])
    for (let i = 0; i < along.length - 1; i++) for (let j = 0; j < levels.length - 1; j++) {
      const center = (along[i] + along[i + 1]) / 2, z = (levels[j] + levels[j + 1]) / 2
      if (openings.some(gap => center >= gap.start && center <= gap.end && z >= gap.sill && z <= gap.head)) continue
      piece(along[i], along[i + 1], levels[j], levels[j + 1])
    }
  }

  // A continuous unsupported span can contain more than one overlapping
  // aperture. Measure their union at each height, across adjacent wall runs.
  for (const gaps of lintelGroups.values()) {
    const levels = [...new Set(gaps.flatMap(gap => [gap.sill, gap.head]))].sort((a, b) => a - b)
    for (let i = 0; i < levels.length - 1; i++) {
      const z = (levels[i] + levels[i + 1]) / 2
      const spans = gaps.filter(gap => z > gap.sill && z < gap.head).sort((a, b) => a.start - b.start)
      let start = 0, end = 0, active = false
      for (const span of spans) {
        if (!active || span.start > end + 1e-8) { start = span.start; end = span.end; active = true }
        else end = Math.max(end, span.end)
        longestLintelM = Math.max(longestLintelM, end - start)
      }
    }
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
      { name: 'Walls', color: '#F4F1EA', positions: options.boundsOnly ? [] : unionBoxes(wallBoxes) },
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
