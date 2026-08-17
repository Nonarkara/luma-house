import type { Opening, PlanState, Room } from '../types'
import { exteriorWalls } from '../analysis/walls'
import { egressRoutes } from '../analysis/egress'
import type { Compass } from '../analysis/types'
import { roomAreaFor, siteOf } from '../plan'
import { DEFAULT_THRESHOLDS, getStandard, type Severity, type Thresholds } from './standards'

export interface CodeIssue {
  /** Standard code reference, e.g. "IBC 1208.1". */
  ref: string
  /** Long standard name. */
  name: string
  /** Severity level for the UI. */
  severity: Severity
  /** Room this issue applies to. null = whole-plan issue. */
  roomId: string | null
  /** Opening this issue applies to. null = not opening-specific. */
  openingId: string | null
  /** Short headline — used in lists. */
  title: string
  /** One-sentence explanation with the actual measured value. */
  body: string
  /** Suggested fix, if any. The Inspector uses this to drive one-click actions. */
  fixAction?:
  | { type: 'enlarge_opening'; openingId: string }
  | { type: 'set_ceiling'; roomId: string; meters: number }
  | { type: 'add_exterior_door'; roomId: string }
}

function roomIsHabitable(room: Room): boolean {
  return room.kind === 'living' || room.kind === 'kitchen' || room.kind === 'bedroom' || room.kind === 'studio'
}

function roomNeedsEgress(room: Room): boolean {
  // Habitable rooms need a path to the exterior for fire egress.
  return roomIsHabitable(room) || room.kind === 'bathroom'
}

function defaultDoorWidthM(opening: Opening): number {
  return opening.widthM ?? (opening.type === 'window' ? 1.6 : 0.9)
}

function defaultDoorHeightM(opening: Opening): number {
  return opening.heightM ?? (opening.type === 'window' ? 1.2 : 2.1)
}

/**
 * Round to two decimals for human display. Used for measured values
 * surfaced in CodeIssue bodies so the user can see exactly what the
 * rule is comparing against.
 */
function fmt(value: number, suffix: string): string {
  return `${value.toFixed(2)} ${suffix}`
}

/**
 * Run every rule. Pure function: same PlanState + thresholds → same issues.
 * The Inspector renders the result; nothing here reads or writes to a store.
 */
export function checkPlan(
  plan: PlanState,
  thresholds: Thresholds = DEFAULT_THRESHOLDS,
): CodeIssue[] {
  const issues: CodeIssue[] = []
  const site = siteOf(plan)
  const add = (
    ref: string,
    severity: Severity,
    roomId: string | null,
    openingId: string | null,
    title: string,
    body: string,
    fixAction?: CodeIssue['fixAction'],
  ) => {
    const std = getStandard(ref)
    issues.push({
      ref,
      name: std?.name ?? 'Unknown standard',
      severity,
      roomId,
      openingId,
      title,
      body,
      fixAction,
    })
  }

  // --- per-room rules ---
  for (const room of plan.rooms) {
    // IBC 1208.1 — minimum habitable area (residential: 6.5 m² / 70 sq ft)
    if (roomIsHabitable(room)) {
      const area = roomAreaFor(room, site)
      if (area < thresholds.minHabitableAreaM2) {
        add(
          'IBC-1208.1',
          'critical',
          room.id,
          null,
          `${room.name} is below minimum habitable area`,
          `${fmt(area, 'm²')} is below the ${fmt(thresholds.minHabitableAreaM2, 'm²')} minimum.`,
          undefined,
        )
      }
    }

    // IBC 1208.2 — minimum ceiling height (residential: 2.13 m / 7'-0")
    const ceiling = room.wallHeight ?? 2.5
    if (roomIsHabitable(room) && ceiling < thresholds.minCeilingHeightM) {
      add(
        'IBC-1208.2',
        'warning',
        room.id,
        null,
        `${room.name} ceiling is below the habitable minimum`,
        `${fmt(ceiling, 'm')} ceiling is below the ${fmt(thresholds.minCeilingHeightM, 'm')} minimum.`,
        { type: 'set_ceiling', roomId: room.id, meters: thresholds.minCeilingHeightM },
      )
    }
  }

  // IBC 1003.3 — egress connectivity via the door graph. A door symbol on an
  // interior wall is not egress: the room needs a continuous modeled door
  // path to an exterior door. This reuses the same engine the Escape lens
  // draws on the canvas, so the check and the visualization can't disagree.
  for (const route of egressRoutes(plan)) {
    if (!roomNeedsEgress(route.room)) continue
    if (route.connected) continue
    add(
      'IBC-1003.3',
      'critical',
      route.room.id,
      null,
      `${route.room.name} has no door path to the exterior`,
      `No continuous modeled door route reaches outdoors — a door into another dead-end room is not egress. Add an exterior door or connect this room through doors to one.`,
      { type: 'add_exterior_door', roomId: route.room.id },
    )
  }

  // --- per-opening rules ---
  for (const opening of plan.openings) {
    const width = defaultDoorWidthM(opening)
    // ADA 404.2.3 — door clear width 815 mm (32 in) for accessible egress
    if (opening.type === 'door' && width < thresholds.minDoorClearWidthM) {
      add(
        'ADA-404.2.3',
        'critical',
        null,
        opening.id,
        `Door clear width below ADA minimum`,
        `${fmt(width, 'm')} clear is below the ${fmt(thresholds.minDoorClearWidthM, 'm')} minimum for accessible egress.`,
        { type: 'enlarge_opening', openingId: opening.id },
      )
    }
    // IBC 1010.1.1 — door height minimum 2.03 m (80 in)
    if (opening.type === 'door') {
      const height = defaultDoorHeightM(opening)
      if (height < thresholds.minDoorHeightM) {
        add(
          'IBC-1010.1.1',
          'warning',
          null,
          opening.id,
          `Door height below the standard minimum`,
          `${fmt(height, 'm')} is below the ${fmt(thresholds.minDoorHeightM, 'm')} (${Math.round(thresholds.minDoorHeightM / 0.0254)} in) standard door height.`,
        )
      }
    }
  }

  // --- whole-plan rules (aggregated: one row per concern, not per item) ---

  // ASHRAE 62.1 — kitchen exhaust: one row listing the kitchens, not one
  // identical row per kitchen.
  const kitchens = plan.rooms.filter((room) => room.kind === 'kitchen')
  if (kitchens.length > 0) {
    add(
      'ASHRAE-62.1-KITCHEN',
      'info',
      null,
      null,
      `Kitchen exhaust — ${kitchens.map((room) => room.name).join(', ')}`,
      `Range hoods typically need ${thresholds.kitchenExhaustLs} L/s intermittent (or ${thresholds.kitchenExhaustLs / 2} L/s continuous) exhaust vented to the exterior.`,
    )
  }

  // ASHRAE 62.1 — bathroom exhaust, aggregated the same way.
  const bathrooms = plan.rooms.filter((room) => room.kind === 'bathroom')
  if (bathrooms.length > 0) {
    add(
      'ASHRAE-62.1-BATHROOM',
      'info',
      null,
      null,
      `Bathroom exhaust — ${bathrooms.map((room) => room.name).join(', ')}`,
      `Bathrooms typically need ${thresholds.bathroomExhaustLs} L/s intermittent exhaust vented outside.`,
    )
  }

  // ASHRAE 90.1 — one envelope row for all windows: U-value / SHGC defaults
  // live in the climate response library, not in this check.
  const windows = plan.openings.filter((opening) => opening.type === 'window')
  if (windows.length > 0) {
    add(
      'ASHRAE-90.1-ENVELOPE',
      'info',
      null,
      null,
      `${windows.length} window${windows.length === 1 ? '' : 's'} — envelope spec`,
      `Location-specific U-value and SHGC defaults are applied by the climate response library (Systems panel); this check does not rate glazing.`,
    )
  }

  // ASHRAE 62.1 — minimum fresh-air for the whole house
  const totalOccupants = plan.rooms.reduce((sum, room) => {
    const occ = thresholds.occupantsPerKind[room.kind] ?? 0
    return sum + occ
  }, 0)
  const requiredLs = totalOccupants * thresholds.freshAirLsPerPerson
  // We don't have a mechanical ventilation rate in the plan state, so the
  // check is informational: does the plan have a *path* for fresh air?
  const hasAnyOpening = plan.openings.some((op) => op.type === 'window' || op.type === 'door')
  if (totalOccupants > 0 && !hasAnyOpening) {
    add(
      'ASHRAE-62.1-RESIDENTIAL',
      'critical',
      null,
      null,
      'No openable apertures for fresh air',
      `Plan supports ${totalOccupants} occupants; needs at least one openable window or door.`,
    )
  } else if (totalOccupants > 0) {
    add(
      'ASHRAE-62.1-RESIDENTIAL',
      'info',
      null,
      null,
      `Fresh air target: ${fmt(requiredLs, 'L/s')} (${totalOccupants} occupants × ${thresholds.freshAirLsPerPerson} L/s)`,
      'Infiltration alone is rarely enough — confirm mechanical supply per ASHRAE 62.1.',
    )
  }

  return issues
}

export interface DoorPlacement {
  /** Percent coordinates on the chosen wall (rounded to 0.1). */
  x: number
  y: number
  rotation: 0 | 90
  /** Compass of the exterior wall the placement sits on. */
  compass: Compass
  /** True when every slot on the wall was taken and the midpoint was reused. */
  crowded: boolean
}

/**
 * Where a one-click egress door should go: the midpoint of the room's
 * longest exterior wall (per `exteriorWalls`), slid along the wall in 5%
 * steps when the midpoint is already occupied. Returns null when the room
 * has no exterior wall at all — the caller must say so instead of placing
 * a door on a shared interior wall.
 *
 * Pure: derives everything from the passed plan.
 */
export function exteriorDoorPlacement(plan: PlanState, roomId: string): DoorPlacement | null {
  const room = plan.rooms.find((r) => r.id === roomId)
  if (!room) return null
  const walls = exteriorWalls(plan).filter((wall) => wall.roomId === roomId)
  if (walls.length === 0) return null
  const best = [...walls].sort((a, b) => b.lengthPct - a.lengthPct)[0]

  const isOccupied = (x: number, y: number) =>
    plan.openings.some((op) => Math.abs(op.x - x) < 0.5 && Math.abs(op.y - y) < 0.5)

  const along = (compass: Compass): { pos: number; min: number; max: number } =>
    compass === 'N' || compass === 'S'
      ? { pos: room.x + room.w / 2, min: room.x + 5, max: room.x + room.w - 5 }
      : { pos: room.y + room.h / 2, min: room.y + 5, max: room.y + room.h - 5 }

  const point = (compass: Compass, value: number): { x: number; y: number; rotation: 0 | 90 } => {
    if (compass === 'N') return { x: value, y: room.y, rotation: 0 }
    if (compass === 'S') return { x: value, y: room.y + room.h, rotation: 0 }
    if (compass === 'W') return { x: room.x, y: value, rotation: 90 }
    return { x: room.x + room.w, y: value, rotation: 90 }
  }

  const { pos, min, max } = along(best.compass)
  const candidates = [pos]
  for (let step = 1; step <= 8; step += 1) {
    candidates.push(pos + step * 5, pos - step * 5)
  }
  for (const candidate of candidates) {
    const value = Math.max(min, Math.min(max, candidate))
    const spot = point(best.compass, value)
    if (!isOccupied(spot.x, spot.y)) {
      return {
        x: Math.round(spot.x * 10) / 10,
        y: Math.round(spot.y * 10) / 10,
        rotation: spot.rotation,
        compass: best.compass,
        crowded: false,
      }
    }
  }
  // Every slot on the longest wall is taken; fall back to the midpoint and
  // let the UI tell the user to drag it somewhere clear.
  const midpoint = point(best.compass, pos)
  return {
    x: Math.round(midpoint.x * 10) / 10,
    y: Math.round(midpoint.y * 10) / 10,
    rotation: midpoint.rotation,
    compass: best.compass,
    crowded: true,
  }
}

/**
 * Severity colour map for the UI. Sharp, no gradient, single accent.
 * Per Axiom Design Core.
 */
export const SEVERITY_LABEL: Record<Severity, string> = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
}