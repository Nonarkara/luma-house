import { furnitureDoorConflicts, furnitureRectFor, MODEL_WALL_THICKNESS_M, siteOf } from '../plan'
import type { Furniture, PlanState, Room, SiteSpec } from '../types'

const EPS = 1e-7
type Rect = { x: number; y: number; w: number; h: number }
const overlaps = (a: Rect, b: Rect) => a.x < b.x + b.w - EPS && a.x + a.w > b.x + EPS && a.y < b.y + b.h - EPS && a.y + a.h > b.y + EPS
const contains = (a: Rect, b: Rect) => b.x >= a.x - EPS && b.y >= a.y - EPS && b.x + b.w <= a.x + a.w + EPS && b.y + b.h <= a.y + a.h + EPS

/** The clear floor of the room holding the piece's centre, inside half a wall. A piece that
 * sits in no room (a terrace sketch, a legacy plan) keeps the whole site. */
export function furnitureBounds(plan: PlanState, item: Furniture): Rect | null {
  const site = siteOf(plan), r = furnitureRectFor(item, site), cx = r.x + r.w / 2, cy = r.y + r.h / 2
  const room = plan.rooms.find(room => cx >= room.x && cx <= room.x + room.w && cy >= room.y && cy <= room.y + room.h)
  if (!room) return null
  const ix = MODEL_WALL_THICKNESS_M / 2 / site.w * 100, iy = MODEL_WALL_THICKNESS_M / 2 / site.h * 100
  return { x: room.x + ix, y: room.y + iy, w: room.w - 2 * ix, h: room.h - 2 * iy }
}

/** Move the footprint, never its physical dimensions. Invalid poses are refused. Within
 * `bounds` a drag slides along the wall instead of passing through it. */
export function moveFurnitureTo(item: Furniture, x: number, y: number, site: SiteSpec, bounds: Rect | null = null): Furniture | null {
  const r = furnitureRectFor(item, site)
  if (![x, y, r.w, r.h].every(Number.isFinite) || r.w <= 0 || r.h <= 0 || r.w > 100 || r.h > 100) return null
  const b = bounds && r.w <= bounds.w + EPS && r.h <= bounds.h + EPS ? bounds : { x: 0, y: 0, w: 100, h: 100 }
  return { ...item, x: Math.max(b.x, Math.min(b.x + b.w - r.w, x)), y: Math.max(b.y, Math.min(b.y + b.h - r.h, y)) }
}

/** A quarter-turn that cannot fit inside its room is refused rather than pushed through a wall. */
export function rotateFurnitureAtCentre(item: Furniture, site: SiteSpec, bounds: Rect | null = null): Furniture | null {
  const before = furnitureRectFor(item, site), rotated = { ...item, rotated: !item.rotated }
  const after = furnitureRectFor(rotated, site)
  if (bounds && (after.w > bounds.w + EPS || after.h > bounds.h + EPS)) return null
  return moveFurnitureTo(rotated, item.x + (before.w - after.w) / 2, item.y + (before.h - after.h) / 2, site, bounds)
}

/** Conservative footprint warnings, not a circulation or accessibility verdict. */
export function furniturePlacementIssues(plan: PlanState, item: Furniture): string[] {
  const site = siteOf(plan), rect = furnitureRectFor(item, site), issues: string[] = []
  if (!plan.rooms.some(room => contains(room, rect))) issues.push('outside room bounds')
  if (plan.furniture.some(other => other.id !== item.id && overlaps(rect, furnitureRectFor(other, site)))) issues.push('overlaps furniture')
  if (furnitureDoorConflicts([item], plan.openings, site).has(item.id)) issues.push('blocks a door swing')
  return issues
}

/**
 * Place a piece where it was dropped.
 *
 * The pointer is the centre of the piece. The piece keeps its real size and
 * never crosses a wall: if the exact spot is taken it slides to the nearest
 * clear floor in the same room, and the caller is told which of the two
 * happened. Nothing is ever shrunk to make it fit.
 */
export function findFurniturePlacementAt(
  plan: PlanState,
  item: Furniture,
  point: { x: number; y: number },
): { item: Furniture; room: Room; exact: boolean } | null {
  const site = siteOf(plan)
  const insetX = (MODEL_WALL_THICKNESS_M / 2 + .01) / site.w * 100
  const insetY = (MODEL_WALL_THICKNESS_M / 2 + .01) / site.h * 100
  const occupied = plan.furniture.filter(other => other.id !== item.id).map(other => furnitureRectFor(other, site))

  const room = plan.rooms.find(candidate =>
    point.x >= candidate.x && point.x <= candidate.x + candidate.w &&
    point.y >= candidate.y && point.y <= candidate.y + candidate.h)
  if (!room) return null

  const blockers = occupied.filter(other => overlaps(room, other))

  for (const rotated of [item.rotated, !item.rotated]) {
    const candidate = { ...item, rotated }
    const rect = furnitureRectFor(candidate, site)
    const left = room.x + insetX
    const top = room.y + insetY
    const right = room.x + room.w - insetX - rect.w
    const bottom = room.y + room.h - insetY - rect.h
    if (right < left || bottom < top) continue

    const wanted = {
      x: Math.max(left, Math.min(right, point.x - rect.w / 2)),
      y: Math.max(top, Math.min(bottom, point.y - rect.h / 2)),
    }
    // The drop point first, then a ring around it, so a piece dropped beside
    // something else lands beside it rather than in the middle of the room.
    const attempts: Array<{ x: number; y: number }> = [wanted]
    for (let ring = 1; ring <= 4; ring += 1) {
      const stepX = (rect.w + insetX) * ring / 2
      const stepY = (rect.h + insetY) * ring / 2
      for (const dx of [-stepX, 0, stepX]) {
        for (const dy of [-stepY, 0, stepY]) {
          if (dx === 0 && dy === 0) continue
          attempts.push({ x: wanted.x + dx, y: wanted.y + dy })
        }
      }
    }

    for (const attempt of attempts) {
      const x = Math.max(left, Math.min(right, attempt.x))
      const y = Math.max(top, Math.min(bottom, attempt.y))
      const pose = { ...candidate, x, y }
      const placed = furnitureRectFor(pose, site)
      if (blockers.some(other => overlaps(placed, other))) continue
      if (furnitureDoorConflicts([pose], plan.openings, site).has(pose.id)) continue
      return { item: pose, room, exact: x === wanted.x && y === wanted.y }
    }
  }
  return null
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
