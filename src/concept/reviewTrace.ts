import type { PlanState, SiteSpec } from '../types'
import { siteOf } from '../plan'
import { roomsForOpening } from '../analysis/walls'
import { egressRoutes } from '../analysis/egress'

/** Percent image coordinates must retain the source aspect ratio. */
export function traceSiteFromImage(width: number, height: number): SiteSpec {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) throw new Error('Image dimensions could not be read')
  return { w: 14, h: 14 * height / width, unit: Math.min(1, 14 * height / width) }
}

export function calibrateTrace(plan: PlanState, roomId: string, axis: 'w' | 'h', meters: number): PlanState | null {
  const room = plan.rooms.find(item => item.id === roomId)
  if (!room || !Number.isFinite(meters) || meters <= 0) return null
  const site = siteOf(plan)
  const factor = meters / (room[axis] / 100 * site[axis])
  const w = site.w * factor
  const h = site.h * factor
  if (Math.min(w, h) < 1 || Math.max(w, h) > 200) return null
  return { ...plan, site: { w, h, unit: Math.min(site.unit, w, h) } }
}

/** Model problems to correct after accepting a draft, never silently repaired. */
export function traceIssues(plan: PlanState): string[] {
  const issues: string[] = []
  if (new Set(plan.rooms.map(r => r.id)).size !== plan.rooms.length) issues.push('Duplicate room identifiers.')
  for (const [i, room] of plan.rooms.entries()) {
    if (room.x < 0 || room.y < 0 || room.x + room.w > 100 || room.y + room.h > 100) issues.push(`${room.name}: outside the drawing boundary.`)
    for (const other of plan.rooms.slice(i + 1)) {
      if (Math.min(room.x + room.w, other.x + other.w) - Math.max(room.x, other.x) > 0.01 && Math.min(room.y + room.h, other.y + other.h) - Math.max(room.y, other.y) > 0.01) issues.push(`${room.name} overlaps ${other.name}.`)
    }
  }
  const detached = plan.openings.filter(opening => roomsForOpening(plan, opening).length === 0)
  if (detached.length) issues.push(`${detached.length} opening(s) do not fit a wall. Reposition or resize them.`)
  const disconnected = egressRoutes(plan).filter(route => route.room.kind !== 'terrace' && !route.connected)
  if (disconnected.length) issues.push(`${disconnected.length} room(s) have no modeled door path outdoors.`)
  return issues
}
