import { furnitureCatalog, furnitureRectFor, siteOf } from '../plan'
import type { Furniture, FurnitureKind, PlanState } from '../types'
import { furnitureBounds, furniturePlacementIssues } from './furniturePlacement'

export interface FurnitureChoice {
  kind: FurnitureKind
  label: string
  wM: number
  dM: number
  assetId?: string
}
export type ReplacementResult = { item: Furniture; error?: never } | { item?: never; error: string }

/** A product swap preserves identity, centre and orientation, never the old product's
 * dimensions or mesh. It does not search another room or quietly shrink the choice. */
export function prepareFurnitureReplacement(plan: PlanState, id: string, choice: FurnitureChoice): ReplacementResult {
  const original = plan.furniture.find(item => item.id === id)
  if (!original) return { error: 'That piece is no longer in the drawing.' }
  if (!furnitureCatalog[choice.kind] || ![choice.wM, choice.dM].every(n => Number.isFinite(n) && n > 0 && n <= 100)) return { error: 'Choose valid furniture dimensions.' }
  const site = siteOf(plan), before = furnitureRectFor(original, site)
  const item: Furniture = { id: original.id, kind: choice.kind, label: choice.label, wM: choice.wM, dM: choice.dM, ...(choice.assetId ? { assetId: choice.assetId } : {}), rotated: original.rotated, x: original.x, y: original.y }
  const after = furnitureRectFor(item, site)
  item.x += (before.w - after.w) / 2
  item.y += (before.h - after.h) / 2
  const bounds = furnitureBounds(plan, original)
  if (!bounds || ![item.x, item.y, after.w, after.h].every(Number.isFinite) || item.x < bounds.x - 1e-7 || item.y < bounds.y - 1e-7 || item.x + after.w > bounds.x + bounds.w + 1e-7 || item.y + after.h > bounds.y + bounds.h + 1e-7) return { error: 'Too large here: move the original away from the wall, or choose a smaller piece.' }
  const issues = furniturePlacementIssues(plan, item)
  if (issues.includes('overlaps furniture')) return { error: 'This choice overlaps another piece. Move it clear first.' }
  if (issues.includes('blocks a door swing')) return { error: 'This choice blocks a door swing. Move it clear first.' }
  return { item }
}
