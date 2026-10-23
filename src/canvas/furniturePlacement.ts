import { furnitureDoorConflicts, furnitureRectFor, MODEL_WALL_THICKNESS_M, siteOf } from '../plan'
import type { Furniture, PlanState, Room, SiteSpec } from '../types'

const EPS = 1e-7
type Rect = { x: number; y: number; w: number; h: number }
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS && a.y < b.y + b.h - EPS && a.y + a.h > b.y + EPS
const contains = (a: Rect, b: Rect) => b.x >= a.x - EPS && b.y >= a.y - EPS && b.x + b.w <= a.x + a.w + EPS && b.y + b.h <= a.y + a.h + EPS

/** Move the footprint, never its physical dimensions. Invalid poses are refused. */
export function moveFurnitureTo(item: Furniture, x: number, y: number, site: SiteSpec): Furniture | null {
  const r = furnitureRectFor(item, site)
  if (![x, y, r.w, r.h].every(Number.isFinite) || r.w <= 0 || r.h <= 0 || r.w > 100 || r.h > 100) return null
  return { ...item, x: Math.max(0, Math.min(100 - r.w, x)), y: Math.max(0, Math.min(100 - r.h, y)) }
}

export function rotateFurnitureAtCentre(item: Furniture, site: SiteSpec): Furniture | null {
  const before = furnitureRectFor(item, site), rotated = { ...item, rotated: !item.rotated }
  const after = furnitureRectFor(rotated, site)
  return moveFurnitureTo(rotated, item.x + (before.w - after.w) / 2, item.y + (before.h - after.h) / 2, site)
}

/** Conservative footprint warnings, not a circulation or accessibility verdict. */
export function furniturePlacementIssues(plan: PlanState, item: Furniture): string[] {
  const site = siteOf(plan), rect = furnitureRectFor(item, site), issues: string[] = []
  if (!plan.rooms.some(room => contains(room, rect))) issues.push('outside room bounds')
  if (plan.furniture.some(other => other.id !== item.id && overlaps(rect, furnitureRectFor(other, site)))) issues.push('overlaps furniture')
  if (furnitureDoorConflicts([item], plan.openings, site).has(item.id)) issues.push('blocks a door swing')
  return issues
}

/** Bounded local search; a failed search never silently shrinks or stacks a piece. */
export function findFurniturePlacement(plan: PlanState, item: Furniture, selectedRoom?: string | null): { item: Furniture; room: Room } | null {
  const site = siteOf(plan)
  const occupied = plan.furniture.filter(other => other.id !== item.id).map(other => furnitureRectFor(other, site))
  const rooms = selectedRoom ? plan.rooms.filter(room => room.id === selectedRoom) : [...plan.rooms].sort((a, b) => b.w * b.h - a.w * a.h)
  const insetX = (MODEL_WALL_THICKNESS_M / 2 + .01) / site.w * 100
  const insetY = (MODEL_WALL_THICKNESS_M / 2 + .01) / site.h * 100
  for (const room of rooms) for (const rotated of [item.rotated, !item.rotated]) {
    const candidate = { ...item, rotated }, r = furnitureRectFor(candidate, site)
    const left = room.x + insetX, top = room.y + insetY
    const right = room.x + room.w - insetX - r.w, bottom = room.y + room.h - insetY - r.h
    if (right < left || bottom < top) continue
    const blockers = occupied.filter(other => overlaps(room, other))
    const near = blockers.slice(0, 24)
    const xs = [left, right, (left + right) / 2, ...near.flatMap(other => [other.x - r.w - insetX, other.x + other.w + insetX])]
    const ys = [top, bottom, (top + bottom) / 2, ...near.flatMap(other => [other.y - r.h - insetY, other.y + other.h + insetY])]
    // Include an even grid for gaps not adjacent to an existing footprint.
    for (let n = 1; n < 10; n++) { xs.push(left + (right - left) * n / 10); ys.push(top + (bottom - top) * n / 10) }
    const positions = [...new Set(xs)].filter(x => x >= left && x <= right).flatMap(x =>
      [...new Set(ys)].filter(y => y >= top && y <= bottom).map(y => ({ x, y })))
    positions.sort((a, b) => Math.hypot((a.x - (left + right) / 2) * site.w, (a.y - (top + bottom) / 2) * site.h) - Math.hypot((b.x - (left + right) / 2) * site.w, (b.y - (top + bottom) / 2) * site.h))
    for (const position of positions) {
      const pose = { ...candidate, ...position }, rect = furnitureRectFor(pose, site)
      if (blockers.some(other => overlaps(rect, other))) continue
      if (furnitureDoorConflicts([pose], plan.openings, site).has(pose.id)) continue
      return { item: pose, room }
    }
  }
  return null
}
