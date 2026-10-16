import { furnitureRectFor, furnitureSpecFor, roomOverlaps, siteOf } from '../plan'
import { openingCompassForRoom } from '../analysis/walls'
import type { Furniture, Opening, PlanState, Room } from '../types'

type Rect = { x: number; y: number; w: number; h: number }
export type RoomGoal = 'centre' | 'window' | 'walls'
export interface RoomMeasures {
  centreClearanceM: number
  nearestWindowM: number | null
  meanWallGapM: number
}
export interface RoomOption {
  goal: RoomGoal
  title: string
  furniture: Furniture[]
  measures: RoomMeasures
}
export interface RoomOptions {
  options: RoomOption[]
  current: RoomMeasures
  issues: string[]
  reason?: string
}

const EPS = 1e-6
const cache = new WeakMap<PlanState, Map<string, RoomOptions>>()
const proposalSignatures = new WeakMap<RoomOption, string>()
const goals = [
  { goal: 'centre', title: 'Open centre' },
  { goal: 'window', title: 'Window side' },
  { goal: 'walls', title: 'Along walls' },
] as const
function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS && a.y < b.y + b.h - EPS && a.y + a.h > b.y + EPS
}
function contains(a: Rect, b: Rect) {
  return b.x >= a.x - EPS && b.y >= a.y - EPS && b.x + b.w <= a.x + a.w + EPS && b.y + b.h <= a.y + a.h + EPS
}
function distance(x: number, y: number, r: Rect) {
  return Math.hypot(Math.max(r.x - x, 0, x - r.x - r.w), Math.max(r.y - y, 0, y - r.y - r.h))
}
function geometry(plan: PlanState, room: Room) {
  const site = siteOf(plan)
  const bounds = { x: room.x / 100 * site.w, y: room.y / 100 * site.h, w: room.w / 100 * site.w, h: room.h / 100 * site.h }
  // ponytail: furniture poses are never mutated, so one footprint per object is exact.
  const rects = new WeakMap<Furniture, Rect>()
  const rect = (f: Furniture): Rect => {
    let m = rects.get(f)
    if (!m) {
      const r = furnitureRectFor(f, site)
      m = { x: r.x / 100 * site.w, y: r.y / 100 * site.h, w: r.w / 100 * site.w, h: r.h / 100 * site.h }
      rects.set(f, m)
    }
    return m
  }
  const owns = (f: Furniture) => {
    const r = rect(f), x = r.x + r.w / 2, y = r.y + r.h / 2
    return x >= bounds.x && x < bounds.x + bounds.w && y >= bounds.y && y < bounds.y + bounds.h
  }
  const openings = plan.openings.filter(o => openingCompassForRoom(room, o, site) !== null)
  const point = (o: Opening) => ({ x: o.x / 100 * site.w, y: o.y / 100 * site.h })
  const wallGap = (r: Rect) => Math.max(0, Math.min(r.x - bounds.x, r.y - bounds.y, bounds.x + bounds.w - r.x - r.w, bounds.y + bounds.h - r.y - r.h))
  const doorConflict = (r: Rect) => openings.some(o => {
    if (o.type !== 'door') return false
    const p = point(o)
    return distance(p.x, p.y, r) < Math.max(.9, o.widthM ?? .9) - EPS
  })
  return { site, bounds, rect, owns, openings, point, wallGap, doorConflict }
}

/** Geometric distances only: these are neither lux nor an accessibility verdict. */
function measures(g: ReturnType<typeof geometry>, furniture: Furniture[]): RoomMeasures {
  const rects = furniture.map(g.rect).filter(r => overlaps(r, g.bounds))
  const centre = { x: g.bounds.x + g.bounds.w / 2, y: g.bounds.y + g.bounds.h / 2 }
  const windows = g.openings.filter(o => o.type === 'window')
  const desks = furniture.filter(f => g.owns(f) && f.kind === 'desk')
  const seats = desks.length ? desks : furniture.filter(f => g.owns(f) && ['sofa', 'dining', 'bed'].includes(f.kind))
  const gaps = seats.flatMap(f => windows.map(o => { const p = g.point(o); return distance(p.x, p.y, g.rect(f)) }))
  return {
    centreClearanceM: Math.min(g.bounds.w / 2, g.bounds.h / 2, ...rects.map(r => distance(centre.x, centre.y, r))),
    nearestWindowM: gaps.length ? Math.min(...gaps) : null,
    meanWallGapM: rects.length ? rects.reduce((n, r) => n + g.wallGap(r), 0) / rects.length : 0,
  }
}

export function measureRoom(plan: PlanState, room: Room, furniture = plan.furniture): RoomMeasures {
  return measures(geometry(plan, room), furniture)
}

/** Validate the complete proposal again at Apply, including untouched furniture. */
export function roomOptionIssues(plan: PlanState, room: Room, furniture: Furniture[]): string[] {
  const g = geometry(plan, room), own = furniture.filter(g.owns)
  const issues = new Set<string>()
  for (const item of own) {
    const r = g.rect(item)
    if (!contains(g.bounds, r)) issues.add('Furniture extends outside this room.')
    if (g.doorConflict(r)) issues.add('Furniture enters a door buffer.')
    if (furniture.some(other => other.id !== item.id && overlaps(r, g.rect(other)))) issues.add('Furniture footprints overlap.')
  }
  return [...issues]
}

function poseKey(furniture: Furniture[]) {
  return furniture.map(f => `${f.id}:${f.x.toFixed(4)}:${f.y.toFixed(4)}:${f.rotated}`).join('|')
}

/** Bounded beam search, not an exhaustive solver. All sizes and fixed WC poses survive. */
export function generateRoomOptions(plan: PlanState, room: Room): RoomOptions {
  const existing = cache.get(plan)?.get(room.id)
  if (existing) return existing
  const g = geometry(plan, room), current = measureRoom(plan, room)
  const issues = roomOptionIssues(plan, room, plan.furniture)
  const own = plan.furniture.filter(g.owns), movable = own.filter(f => f.kind !== 'wc')
  // Remote furniture cannot influence this room. Keep it out of every beam
  // state and scoring pass, then preserve it when assembling the final plan.
  const fixed = plan.furniture.filter(f => !movable.includes(f) && overlaps(g.rect(f), g.bounds))
  const finish = (options: RoomOption[], reason?: string): RoomOptions => {
    const result = { options, current, issues, reason }
    const rooms = cache.get(plan) ?? new Map<string, RoomOptions>()
    rooms.set(room.id, result); cache.set(plan, rooms)
    return result
  }
  if (roomOverlaps(plan.rooms).has(room.id)) return finish([], 'Separate overlapping rooms before comparing furniture options.')
  if ((plan.walls ?? []).some(w => overlaps(g.bounds, {
    x: Math.min(w.x1, w.x2) / 100 * g.site.w - .001,
    y: Math.min(w.y1, w.y2) / 100 * g.site.h - .001,
    w: Math.abs(w.x2 - w.x1) / 100 * g.site.w + .002,
    h: Math.abs(w.y2 - w.y1) / 100 * g.site.h + .002,
  }))) return finish([], 'Resolve pencil walls touching this room before searching for arrangements.')
  if (!movable.length) return finish([], 'Add movable furniture to this room first. WC fixtures stay fixed.')
  if (movable.length > 8) return finish([], 'This local search supports up to eight movable pieces per room. Arrange larger inventories manually.')
  if (plan.furniture.some(f => overlaps(g.rect(f), g.bounds) && plan.rooms.some(r => r.id !== room.id && overlaps(g.rect(f), geometry(plan, r).bounds)))) {
    return finish([], 'Move furniture that crosses into another room fully into one room first.')
  }
  if (fixed.some(f => g.owns(f) && (!contains(g.bounds, g.rect(f)) || g.doorConflict(g.rect(f))))) {
    return finish([], 'A fixed fixture is outside the room or blocks a door buffer. Correct it manually first.')
  }
  const ordered = [...movable].sort((a, b) => {
    const x = furnitureSpecFor(a), y = furnitureSpecFor(b)
    return y.w * y.d - x.w * x.d || a.id.localeCompare(b.id)
  })
  const options: RoomOption[] = [], used = new Set([poseKey(plan.furniture)])
  for (const { goal, title } of goals) {
    if (goal === 'window' && current.nearestWindowM === null) continue
    const score = (items: Furniture[]) => {
      const m = measures(g, items)
      return goal === 'centre' ? -m.centreClearanceM + m.meanWallGapM * .01
        : goal === 'window' ? (m.nearestWindowM ?? 1e3) + m.meanWallGapM * .01
          : m.meanWallGapM - m.centreClearanceM * .01
    }
    let beam: Furniture[][] = [fixed]
    for (const item of ordered) {
      const candidates: Furniture[] = []
      for (const rotated of [false, true]) {
        const r = g.rect({ ...item, rotated })
        const spanX = g.bounds.w - r.w, spanY = g.bounds.h - r.h
        if (spanX < -EPS || spanY < -EPS) continue
        // Include both walls and the original pose alongside a bounded 9×9 grid.
        const xs = [...new Set([item.x / 100 * g.site.w, ...Array.from({ length: 9 }, (_, i) => g.bounds.x + spanX * i / 8)])]
        const ys = [...new Set([item.y / 100 * g.site.h, ...Array.from({ length: 9 }, (_, i) => g.bounds.y + spanY * i / 8)])]
        for (const x of xs) for (const y of ys) {
          const candidate = { ...item, x: x / g.site.w * 100, y: y / g.site.h * 100, rotated }
          const box = g.rect(candidate)
          if (contains(g.bounds, box) && !g.doorConflict(box) && !fixed.some(f => overlaps(box, g.rect(f)))) candidates.push(candidate)
        }
      }
      const ranked: { items: Furniture[]; score: number }[] = []
      for (const placed of beam) for (const candidate of candidates) {
        if (placed.some(f => overlaps(g.rect(candidate), g.rect(f)))) continue
        const items = [...placed, candidate]
        ranked.push({ items, score: score(items) })
      }
      ranked.sort((a, b) => a.score - b.score)
      beam = ranked.slice(0, 24).map(v => v.items)
      if (!beam.length) break
    }
    for (const arrangement of beam) {
      const replacements = new Map(arrangement.map(f => [f.id, f]))
      const furniture = plan.furniture.map(f => replacements.get(f.id) ?? f)
      const key = poseKey(furniture)
      if (used.has(key) || roomOptionIssues(plan, room, furniture).length) continue
      const option = { goal, title, furniture, measures: measureRoom(plan, room, furniture) }
      proposalSignatures.set(option, JSON.stringify(furniture))
      used.add(key); options.push(option); break
    }
  }
  return finish(options, options.length ? undefined : 'No alternative found within this bounded search. Keep the drawing; try fewer pieces or adjust their placement manually.')
}

/** Refuse stale or altered proposals. Never add, resize or silently drop a piece. */
export function applyRoomOption(plan: PlanState, room: Room, option: RoomOption): PlanState | null {
  if (!plan.rooms.includes(room)) return null
  const offered = generateRoomOptions(plan, room).options.find(o => o === option)
  if (!offered || proposalSignatures.get(offered) !== JSON.stringify(offered.furniture) || roomOptionIssues(plan, room, offered.furniture).length) return null
  const g = geometry(plan, room)
  if (offered.furniture.length !== plan.furniture.length || offered.furniture.some((f, i) => {
    const original = plan.furniture[i]
    return f.id !== original.id || f.kind !== original.kind || f.wM !== original.wM || f.dM !== original.dM
      || ((!g.owns(original) || original.kind === 'wc') && (f.x !== original.x || f.y !== original.y || f.rotated !== original.rotated))
  })) return null
  return { ...plan, furniture: offered.furniture }
}
