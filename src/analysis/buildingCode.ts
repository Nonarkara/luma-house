import { siteOf } from '../plan'
import type { Opening, PlanState, Room } from '../types'
import { exteriorWalls } from './walls'

export interface CodeIssue {
  id: string
  severity: 'error' | 'warning' | 'info'
  codeReference: string // e.g. "IRC R305.1", "IRC R310.2", "IBC 1204.1"
  category: 'ceiling' | 'egress' | 'glazing' | 'structure' | 'acoustics'
  title: string
  detail: string
  roomId?: string
  openingId?: string
  autoFixAvailable?: boolean
  fixAction?: 'set_ceiling_2_5m' | 'fix_egress_window' | 'add_glazing' | 'add_lintel'
}

export interface ArchitecturalCodeReport {
  overallStatus: 'COMPLIANT' | 'NEEDS_ATTENTION' | 'NON_COMPLIANT'
  issues: CodeIssue[]
  summary: {
    ceilingHeightStatus: 'PASS' | 'WARN'
    egressStatus: 'PASS' | 'WARN' | 'FAIL'
    glazingRatioStatus: 'PASS' | 'WARN'
    structuralSpanStatus: 'PASS' | 'WARN'
    acousticRatingStatus: 'QUIET' | 'BALANCED' | 'NOISY'
    averageCeilingM: number
    glazingToFloorPct: number
    sleepingRoomsEgressCount: number
    totalSleepingRooms: number
    acousticSTCRating: number // STC scale (e.g., 35-52)
  }
}

/** Legal minimum ceiling height per standard residential building codes (e.g. IRC R305.1). */
export const CODE_MIN_CEILING_HEIGHT_M = 2.5

/** Minimum glazing area fraction relative to floor area for natural light (IRC R303.1 ~8%). */
export const MIN_GLAZING_RATIO = 0.08

/** Sleeping room emergency escape opening requirements (IRC R310). */
export const EGRESS_MIN_CLEAR_AREA_M2 = 0.35
export const EGRESS_MIN_WIDTH_M = 0.5
export const EGRESS_MIN_HEIGHT_M = 0.6
export const EGRESS_MAX_SILL_HEIGHT_M = 1.1

/** Opening width above which a heavy structural lintel/header beam is required. */
export const STRUCTURAL_LINTEL_THRESHOLD_M = 2.0

/** Room dimension above which intermediate floor/roof joist support beam grid is required. */
export const STRUCTURAL_SPAN_THRESHOLD_M = 6.0

function roomAreaM2(room: Room, plan: PlanState): number {
  const site = siteOf(plan)
  return (room.w / 100) * site.w * ((room.h / 100) * site.h)
}

function roomSpanM(room: Room, plan: PlanState): { widthM: number; depthM: number; maxM: number } {
  const site = siteOf(plan)
  const widthM = (room.w / 100) * site.w
  const depthM = (room.h / 100) * site.h
  return { widthM, depthM, maxM: Math.max(widthM, depthM) }
}

/**
 * Runs full architectural building code and engineering compliance checks.
 */
export function analyzeBuildingCode(plan: PlanState): ArchitecturalCodeReport {
  const issues: CodeIssue[] = []

  // 1. Ceiling & Headroom Clearance Check (IRC R305.1)
  let totalCeilingM = 0
  let lowCeilingCount = 0

  for (const room of plan.rooms) {
    const heightM = room.wallHeight ?? CODE_MIN_CEILING_HEIGHT_M
    totalCeilingM += heightM

    if (heightM < CODE_MIN_CEILING_HEIGHT_M) {
      lowCeilingCount++
      issues.push({
        id: `ceiling-${room.id}`,
        severity: 'error',
        codeReference: 'IRC R305.1',
        category: 'ceiling',
        title: `Low ceiling clearance in ${room.name}`,
        detail: `Ceiling height is ${heightM.toFixed(2)}m. Building code requires a minimum habitable clearance of 2.50m.`,
        roomId: room.id,
        autoFixAvailable: true,
        fixAction: 'set_ceiling_2_5m',
      })
    }
  }

  const averageCeilingM = plan.rooms.length > 0 ? totalCeilingM / plan.rooms.length : CODE_MIN_CEILING_HEIGHT_M

  // 2. Bedroom Emergency Escape & Rescue Openings (IRC R310)
  const bedrooms = plan.rooms.filter((r) => r.kind === 'bedroom')
  let compliantBedrooms = 0

  for (const bed of bedrooms) {
    // Find windows on exterior walls of this bedroom
    const extWalls = exteriorWalls(plan).filter((w) => w.roomId === bed.id)
    const roomWindows: Opening[] = []

    for (const wall of extWalls) {
      for (const op of plan.openings) {
        if (op.type !== 'window') continue
        if (wall.compass === 'N') {
          if (Math.abs(op.y - bed.y) < 5 && op.x >= bed.x - 2 && op.x <= bed.x + bed.w + 2) roomWindows.push(op)
        } else if (wall.compass === 'S') {
          if (Math.abs(op.y - (bed.y + bed.h)) < 5 && op.x >= bed.x - 2 && op.x <= bed.x + bed.w + 2) roomWindows.push(op)
        } else if (wall.compass === 'W') {
          if (Math.abs(op.x - bed.x) < 5 && op.y >= bed.y - 2 && op.y <= bed.y + bed.h + 2) roomWindows.push(op)
        } else if (wall.compass === 'E') {
          if (Math.abs(op.x - (bed.x + bed.w)) < 5 && op.y >= bed.y - 2 && op.y <= bed.y + bed.h + 2) roomWindows.push(op)
        }
      }
    }

    const validEgressWindow = roomWindows.find((w) => {
      const widthM = w.widthM ?? 1.6
      const heightM = w.heightM ?? 1.2
      const sillM = w.sillHeightM ?? 0.9
      const netArea = widthM * heightM * (w.operableFraction ?? 0.5)

      return (
        netArea >= EGRESS_MIN_CLEAR_AREA_M2 &&
        widthM >= EGRESS_MIN_WIDTH_M &&
        heightM >= EGRESS_MIN_HEIGHT_M &&
        sillM <= EGRESS_MAX_SILL_HEIGHT_M
      )
    })

    if (validEgressWindow) {
      compliantBedrooms++
    } else {
      const bestWindow = roomWindows[0]
      issues.push({
        id: `egress-${bed.id}`,
        severity: 'error',
        codeReference: 'IRC R310.2',
        category: 'egress',
        title: `Egress Window Non-Compliant in ${bed.name}`,
        detail: roomWindows.length === 0
          ? `Bedroom lacks an exterior egress window. IRC R310 requires at least one escape window (min 0.35m² operable area, sill height ≤ 1.1m).`
          : `Window in ${bed.name} fails egress requirements. Ensure operable area ≥ 0.35m² and sill height ≤ 1.1m.`,
        roomId: bed.id,
        openingId: bestWindow?.id,
        autoFixAvailable: true,
        fixAction: 'fix_egress_window',
      })
    }
  }

  // 3. Natural Light & Glazing Area Ratio (IRC R303.1 / IBC 1204.1)
  let totalFloorAreaM2 = 0
  let totalGlazingAreaM2 = 0

  for (const room of plan.rooms) {
    const fArea = roomAreaM2(room, plan)
    totalFloorAreaM2 += fArea

    const extWalls = exteriorWalls(plan).filter((w) => w.roomId === room.id)
    let roomGlazingM2 = 0

    for (const wall of extWalls) {
      for (const op of plan.openings) {
        if (op.type !== 'window') continue
        if (wall.compass === 'N') {
          if (Math.abs(op.y - room.y) < 5 && op.x >= room.x - 2 && op.x <= room.x + room.w + 2) roomGlazingM2 += (op.widthM ?? 1.6) * (op.heightM ?? 1.2)
        } else if (wall.compass === 'S') {
          if (Math.abs(op.y - (room.y + room.h)) < 5 && op.x >= room.x - 2 && op.x <= room.x + room.w + 2) roomGlazingM2 += (op.widthM ?? 1.6) * (op.heightM ?? 1.2)
        } else if (wall.compass === 'W') {
          if (Math.abs(op.x - room.x) < 5 && op.y >= room.y - 2 && op.y <= room.y + room.h + 2) roomGlazingM2 += (op.widthM ?? 1.6) * (op.heightM ?? 1.2)
        } else if (wall.compass === 'E') {
          if (Math.abs(op.x - (room.x + room.w)) < 5 && op.y >= room.y - 2 && op.y <= room.y + room.h + 2) roomGlazingM2 += (op.widthM ?? 1.6) * (op.heightM ?? 1.2)
        }
      }
    }

    totalGlazingAreaM2 += roomGlazingM2
    const ratio = fArea > 0 ? roomGlazingM2 / fArea : 0

    if (room.kind !== 'terrace' && ratio < MIN_GLAZING_RATIO) {
      issues.push({
        id: `glazing-${room.id}`,
        severity: 'warning',
        codeReference: 'IRC R303.1',
        category: 'glazing',
        title: `Low Natural Light in ${room.name}`,
        detail: `Glazing area is ${(ratio * 100).toFixed(1)}% of floor area (minimum 8% recommended for natural daylight).`,
        roomId: room.id,
        autoFixAvailable: true,
        fixAction: 'add_glazing',
      })
    }
  }

  const glazingToFloorPct = totalFloorAreaM2 > 0 ? (totalGlazingAreaM2 / totalFloorAreaM2) * 100 : 0

  // 4. Structural Lintel & Joist Span Pre-Check
  for (const op of plan.openings) {
    const wM = op.widthM ?? (op.type === 'window' ? 1.6 : 0.9)
    if (wM > STRUCTURAL_LINTEL_THRESHOLD_M) {
      issues.push({
        id: `lintel-${op.id}`,
        severity: 'info',
        codeReference: 'IBC 2308.5',
        category: 'structure',
        title: `Wide Opening (${wM.toFixed(1)}m) Requires Engineered Lintel`,
        detail: `Opening spans ${wM.toFixed(1)}m. A structural steel lintel or double LVL header beam is required to transfer roof/floor loads.`,
        openingId: op.id,
        autoFixAvailable: true,
        fixAction: 'add_lintel',
      })
    }
  }

  for (const room of plan.rooms) {
    const span = roomSpanM(room, plan)
    if (span.maxM > STRUCTURAL_SPAN_THRESHOLD_M) {
      issues.push({
        id: `span-${room.id}`,
        severity: 'warning',
        codeReference: 'IBC 1604.1',
        category: 'structure',
        title: `Long Span (${span.maxM.toFixed(1)}m) in ${room.name}`,
        detail: `Clear room span exceeds 6.0m. Requires engineered floor joists, post-tensioned slab, or intermediate beam/column support.`,
        roomId: room.id,
      })
    }
  }

  // 5. Sound Transmission Class (STC) Acoustic Index
  const baseWallSTC = plan.assemblies?.wall ? (plan.assemblies.wall.includes('acoustic') ? 52 : 45) : 42
  const acousticPenalty = glazingToFloorPct > 15 ? 8 : glazingToFloorPct > 10 ? 4 : 0
  const acousticSTCRating = Math.max(30, baseWallSTC - acousticPenalty)

  if (acousticSTCRating < 40) {
    issues.push({
      id: 'acoustic-low',
      severity: 'warning',
      codeReference: 'IBC 1206.2',
      category: 'acoustics',
      title: 'Acoustic Sound Isolation Below Recommended STC 45',
      detail: `Estimated sound transmission class STC ${acousticSTCRating} between spaces. Consider high-performance glazing or staggered-stud insulated partitions.`,
    })
  }

  const hasErrors = issues.some((i) => i.severity === 'error')
  const hasWarnings = issues.some((i) => i.severity === 'warning')
  const overallStatus = hasErrors ? 'NON_COMPLIANT' : hasWarnings ? 'NEEDS_ATTENTION' : 'COMPLIANT'

  return {
    overallStatus,
    issues,
    summary: {
      ceilingHeightStatus: lowCeilingCount > 0 ? 'WARN' : 'PASS',
      egressStatus: bedrooms.length > 0 && compliantBedrooms < bedrooms.length ? 'WARN' : 'PASS',
      glazingRatioStatus: glazingToFloorPct < 8 ? 'WARN' : 'PASS',
      structuralSpanStatus: issues.some((i) => i.category === 'structure') ? 'WARN' : 'PASS',
      acousticRatingStatus: acousticSTCRating >= 48 ? 'QUIET' : acousticSTCRating >= 40 ? 'BALANCED' : 'NOISY',
      averageCeilingM,
      glazingToFloorPct,
      sleepingRoomsEgressCount: compliantBedrooms,
      totalSleepingRooms: bedrooms.length,
      acousticSTCRating,
    },
  }
}
