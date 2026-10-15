import { furnitureRectFor, siteOf } from '../plan'
import { measureRoom, roomOptionIssues } from '../options/roomOptions'
import type { PlanState, SiteSpec } from '../types'

/** Presentation only. Anchor both sites at their north-west corner, preserving
 * metres for every coordinate and keeping catalog/custom furniture dimensions. */
function reframePlan(plan: PlanState, frame: SiteSpec): PlanState {
  const own = siteOf(plan), sx = own.w / frame.w, sy = own.h / frame.h
  return { ...plan, site: frame,
    rooms: plan.rooms.map(r => ({ ...r, x: r.x * sx, y: r.y * sy, w: r.w * sx, h: r.h * sy })),
    openings: plan.openings.map(o => ({ ...o, x: o.x * sx, y: o.y * sy })),
    furniture: plan.furniture.map(f => ({ ...f, x: f.x * sx, y: f.y * sy })),
    walls: plan.walls?.map(w => ({ ...w, x1: w.x1 * sx, x2: w.x2 * sx, y1: w.y1 * sy, y2: w.y2 * sy })),
  }
}
export function comparisonFrame(a: PlanState, b: PlanState) {
  const sa = siteOf(a), sb = siteOf(b)
  const site = { w: Math.max(sa.w, sb.w), h: Math.max(sa.h, sb.h), unit: 1 }
  const baseline = reframePlan(a, site), proposed = reframePlan(b, site)
  // Used only for a common camera. It never enters the saved model or renderer.
  const framing = { ...baseline, rooms: [...baseline.rooms, ...proposed.rooms] }
  // Render originals with a view/group transform. Recomputing adjacency on
  // normalized percentages would change the meaning of wall tolerances.
  return { site, baseline: a, proposed: b, framing }
}
export function compareRoomLayouts(a: PlanState, b: PlanState) {
  const ids = [...new Set([...a.rooms.map(r => r.id), ...b.rooms.map(r => r.id)])]
  return ids.map(id => {
    const before = a.rooms.find(r => r.id === id), after = b.rooms.find(r => r.id === id)
    return { id, name: after?.name ?? before!.name,
      status: !before ? 'Added room' : !after ? 'Removed room' : 'Matched room',
      baseline: before ? measureRoom(a, before) : null,
      proposed: after ? measureRoom(b, after) : null,
      baselineIssues: before ? roomOptionIssues(a, before, a.furniture) : [],
      proposedIssues: after ? roomOptionIssues(b, after, b.furniture) : [],
    }
  })
}
export function furnitureChangeIds(a: PlanState, b: PlanState) {
  const baseline = a, proposed = b
  const beforeItems = new Map(baseline.furniture.map(f => [f.id, f])), afterItems = new Map(proposed.furniture.map(f => [f.id, f]))
  const pose = (p: PlanState, id: string) => {
    const f = (p === baseline ? beforeItems : afterItems).get(id)
    if (!f) return null
    const site = siteOf(p), r = furnitureRectFor(f, site)
    return [f.kind, f.rotated, r.x / 100 * site.w, r.y / 100 * site.h, r.w / 100 * site.w, r.h / 100 * site.h]
  }
  const added = new Set(proposed.furniture.filter(f => !beforeItems.has(f.id)).map(f => f.id))
  const removed = new Set(baseline.furniture.filter(f => !afterItems.has(f.id)).map(f => f.id))
  const changed = baseline.furniture.filter(f => {
    const after = pose(proposed, f.id), before = pose(baseline, f.id)!
    return after && after.some((v, i) => typeof v === 'number' ? Math.abs(v - Number(before[i])) > 1e-6 : v !== before[i])
  }).map(f => f.id)
  return { added, removed, changed: new Set(changed) }
}
export function furnitureChanges(a: PlanState, b: PlanState) {
  const ids = furnitureChangeIds(a, b)
  return { added: ids.added.size, removed: ids.removed.size, changed: ids.changed.size }
}
