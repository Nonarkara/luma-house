import type { Opening, PlanState, Room } from '../types'
import { openingsForRoomWall } from '../analysis/walls'
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
    | { type: 'add_opening_for_egress'; roomId: string; compass: 'N' | 'E' | 'S' | 'W' }
    | { type: 'add_exterior_door'; roomId: string; compass: 'N' | 'E' | 'S' | 'W' }
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
 * Round to one decimal for human display. Used for measured values
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

    // Egress connectivity for habitable rooms
    if (roomNeedsEgress(room)) {
      // We only flag if the room has no doors at all (interior-only).
      const hasAnyDoor = plan.openings.some(
        (op) => op.type === 'door' &&
          (openingsForRoomWall(plan, room.id, 'N').some((d) => d.id === op.id) ||
           openingsForRoomWall(plan, room.id, 'S').some((d) => d.id === op.id) ||
           openingsForRoomWall(plan, room.id, 'E').some((d) => d.id === op.id) ||
           openingsForRoomWall(plan, room.id, 'W').some((d) => d.id === op.id)),
      )
      if (!hasAnyDoor) {
        add(
          'IBC-1003.3',
          'critical',
          room.id,
          null,
          `${room.name} has no door to an adjacent space`,
          `Habitable rooms need a clear egress path. Add a door on any exterior wall.`,
          { type: 'add_exterior_door', roomId: room.id, compass: 'S' },
        )
      }
    }

    // Kitchen exhaust (ASHRAE 62.1)
    if (room.kind === 'kitchen') {
      add(
        'ASHRAE-62.1-KITCHEN',
        'info',
        room.id,
        null,
        `${room.name} kitchen — confirm range-hood exhaust`,
        `Kitchens typically need ${thresholds.kitchenExhaustLs} L/s intermittent or ${thresholds.kitchenExhaustLs / 2} L/s continuous exhaust.`,
      )
    }

    // Bathroom exhaust (ASHRAE 62.1)
    if (room.kind === 'bathroom') {
      add(
        'ASHRAE-62.1-BATHROOM',
        'info',
        room.id,
        null,
        `${room.name} bath — confirm fan exhaust to exterior`,
        `Bathrooms typically need ${thresholds.bathroomExhaustLs} L/s intermittent exhaust vented outside.`,
      )
    }
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
      if (height < 2.03) {
        add(
          'IBC-1010.1.1',
          'warning',
          null,
          opening.id,
          `Door height below the standard minimum`,
          `${fmt(height, 'm')} is below the 2.03 m (80 in) standard door height.`,
        )
      }
    }
    // ASHRAE 90.1 — window U-value and SHGC are covered by the climate
    // response library; we add an info tag for natural-light windows.
    if (opening.type === 'window') {
      add(
        'ASHRAE-90.1-ENVELOPE',
        'info',
        null,
        opening.id,
        'Window envelope spec',
        'See the climate response library for the location-specific U-value and SHGC defaults.',
      )
    }
  }

  // --- whole-plan rules ---

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

/**
 * Severity colour map for the UI. Sharp, no gradient, single accent.
 * Per Axiom Design Core.
 */
export const SEVERITY_LABEL: Record<Severity, string> = {
  info: 'Info',
  warning: 'Warning',
  critical: 'Critical',
}
