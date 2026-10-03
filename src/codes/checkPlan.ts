import { openingDimensions } from '../openingGeometry'
import type { Opening, PlanState, Room } from '../types'
import { exteriorWalls } from '../analysis/walls'
import { egressRoutes } from '../analysis/egress'
import type { Compass } from '../analysis/types'
import { roomAreaFor, siteOf } from '../plan'
import { DEFAULT_THRESHOLDS, getStandard, type Severity, type Thresholds } from './standards'

export interface CodeIssue {
  /** Standard code reference, e.g. "2021 IRC R304.1". */
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
  return openingDimensions(opening).width
}

function defaultDoorHeightM(opening: Opening): number {
  return openingDimensions(opening).height
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
    // 2021 IRC R304.1 — example minimum habitable-room area.
    if (roomIsHabitable(room)) {
      const area = roomAreaFor(room, site)
      if (area < thresholds.minHabitableAreaM2) {
        add(
          'IRC-2021-R304.1',
          'critical',
          room.id,
          null,
          `${room.name} is below the reference room area`,
          `${fmt(area, 'm²')} is below the ${fmt(thresholds.minHabitableAreaM2, 'm²')} 2021 IRC example; adopted local rules may differ.`,
          undefined,
        )
      }
    }

    // 2021 IRC R305.1 — example minimum habitable-space ceiling height.
    const ceiling = room.wallHeight ?? 2.5
    if (roomIsHabitable(room) && ceiling < thresholds.minCeilingHeightM) {
      add(
        'IRC-2021-R305.1',
        'warning',
        room.id,
        null,
        `${room.name} ceiling is below the reference height`,
        `${fmt(ceiling, 'm')} is below the ${fmt(thresholds.minCeilingHeightM, 'm')} 2021 IRC example; verify the adopted local edition.`,
        { type: 'set_ceiling', roomId: room.id, meters: thresholds.minCeilingHeightM },
      )
    }

    // 2021 IRC R304.2 — 7 ft minimum horizontal dimension, except kitchens.
    // This is a direct geometry comparison, not the former corridor heuristic.
    const widthM = (room.w / 100) * site.w
    const depthM = (room.h / 100) * site.h
    const narrowM = Math.min(widthM, depthM)
    if (roomIsHabitable(room) && room.kind !== 'kitchen' && narrowM < thresholds.minHabitableDimensionM) {
      add(
        'IRC-2021-R304.2',
        'warning',
        room.id,
        null,
        `${room.name} is below the reference room width`,
        `${fmt(narrowM, 'm')} short side is below the ${fmt(thresholds.minHabitableDimensionM, 'm')} 2021 IRC example (kitchens excepted).`,
      )
    }

    // ADA 304.3 — turning space. A bathroom or kitchen that is shorter than
    // the 1.5 m turning diameter cannot accommodate a wheelchair without a
    // T-turn; flag so the user knows the room fails accessible design.
    if (room.kind === 'bathroom' || room.kind === 'kitchen') {
      if (narrowM < thresholds.adaTurningDiameterM) {
        add(
          'ADA-304.3',
          'warning',
          room.id,
          null,
          `${room.name} cannot fit the circular ADA reference envelope`,
          `${fmt(narrowM, 'm')} short side is below a ${fmt(thresholds.adaTurningDiameterM, 'm')} circle. A compliant T-turn may also work; fixtures, furniture, and project applicability are not modeled.`,
        )
      }
    }
  }

  // Geometry-only route connectivity via the door graph. A door symbol on an
  // interior wall is not egress: the room needs a continuous modeled door
  // path to an exterior door. This reuses the same engine the Escape lens
  // draws on the canvas, so the check and the visualization can't disagree.
  for (const route of egressRoutes(plan)) {
    if (!roomNeedsEgress(route.room)) continue
    if (route.connected) continue
    add(
      'MODEL-EGRESS',
      'critical',
      route.room.id,
      null,
      `${route.room.name} has no modeled route outdoors`,
      `No continuous door graph reaches outdoors. This catches disconnected rooms; it does not evaluate travel distance, occupancy, fire rating, or legal egress compliance.`,
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
        `Door width is below the ADA reference envelope`,
        `${fmt(width, 'm')} modeled width is below ${fmt(thresholds.minDoorClearWidthM, 'm')}. The tool does not know clear opening or whether accessibility rules apply.`,
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

  // ASHRAE 62.2 — kitchen exhaust: one row listing the kitchens, not one
  // identical row per kitchen.
  const kitchens = plan.rooms.filter((room) => room.kind === 'kitchen')
  if (kitchens.length > 0) {
    add(
      'ASHRAE-62.2-KITCHEN',
      'info',
      null,
      null,
      `Kitchen exhaust — ${kitchens.map((room) => room.name).join(', ')}`,
      `Residential reference: ${thresholds.kitchenExhaustLs} L/s intermittent through a vented range hood, or 5 ACH continuous. Verify the adopted ASHRAE 62.2 edition and local exhaust rules.`,
    )
  }

  // ASHRAE 62.2 — bathroom exhaust, aggregated the same way.
  const bathrooms = plan.rooms.filter((room) => room.kind === 'bathroom')
  if (bathrooms.length > 0) {
    add(
      'ASHRAE-62.2-BATHROOM',
      'info',
      null,
      null,
      `Bathroom exhaust — ${bathrooms.map((room) => room.name).join(', ')}`,
      `Residential reference: ${thresholds.bathroomExhaustLs} L/s intermittent or 10 L/s continuous exhaust to outdoors. Verify the adopted edition and local rules.`,
    )
  }

  // The envelope row reports only what this model actually knows. It is not
  // an ASHRAE 90.1 determination for a residential project.
  const windows = plan.openings.filter((opening) => opening.type === 'window')
  if (windows.length > 0) {
    add(
      'MODEL-ENVELOPE',
      'info',
      null,
      null,
      `${windows.length} modeled window${windows.length === 1 ? '' : 's'} — inspect U-value and SHGC`,
      `The Systems panel supplies scenario inputs for heat and solar-gain comparisons. No jurisdictional envelope compliance is calculated.`,
    )
  }

  // Occupancy is a transparent scenario input, not an ASHRAE 62.2 formula.
  const totalOccupants = plan.rooms.reduce((sum, room) => {
    const occ = thresholds.occupantsPerKind[room.kind] ?? 0
    return sum + occ
  }, 0)
  // We don't have a mechanical ventilation rate in the plan state, so the
  // check is informational: does the plan have a *path* for fresh air?
  const hasAnyOpening = plan.openings.some((op) => op.type === 'window' || op.type === 'door')
  if (totalOccupants > 0 && !hasAnyOpening) {
    add(
      'MODEL-VENTILATION',
      'critical',
      null,
      null,
      'No modeled operable air path',
      `The ${totalOccupants}-occupant scenario has no window or door. Add an opening for a passive path, then size any mechanical system separately.`,
    )
  } else if (totalOccupants > 0) {
    add(
      'ASHRAE-62.2-WHOLE-DWELLING',
      'info',
      null,
      null,
      'Whole-dwelling ventilation needs more inputs',
      `The ${totalOccupants}-occupant scenario is not a 62.2 sizing result. Floor area, bedrooms, infiltration credit, system type, and adopted edition must be confirmed by a qualified local professional.`,
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
