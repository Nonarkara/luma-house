import type { PlanState } from '../types'
import { houseMesh, WALL_M } from './houseMesh'

/**
 * Process limits from earthtojake/text-to-cad, skills/dfam-check/references/
 * process-limits.md (MIT). Their sources: Hubs and Formlabs design guides,
 * ISO/ASTM 52910. A freestanding model wall is an unsupported wall; the beam
 * over a door or window prints as a bridge.
 */
export const PROCESS_LIMITS = {
  fdm: { label: 'Home filament printer (FDM)', minUnsupportedWallMm: 1.6, maxBridgeMm: 10 },
  sla: { label: 'Resin printer (SLA)', minUnsupportedWallMm: 1.0, maxBridgeMm: 5 },
} as const
export type PrintProcess = keyof typeof PROCESS_LIMITS

/** A common 256 mm build plate (Bambu Lab A1 / P1 / X1 class). An assumption, shown on screen. */
export const BUILD_PLATE_MM = 256
/** Base plate thickness in the print, whatever the scale. */
export const BASE_PRINT_MM = 2
export const PRINT_SCALES = [50, 75, 100, 150, 200, 250] as const

export interface PrintCheck {
  denominator: number
  process: PrintProcess
  /** True-scale wall thickness in the print. */
  wallMm: number
  /** Wall thickness actually written to the file (thickened when allowed). */
  printedWallMm: number
  thickened: boolean
  wallOk: boolean
  bridgeMm: number
  /** Within the unsupported-bridge limit. When false the slicer needs supports
   * under the lintels — advice, not a blocker: slicers add them automatically. */
  bridgeOk: boolean
  sizeMm: { x: number; y: number; z: number }
  fits: boolean
  /** Prints at this scale: walls hold and it fits the plate. */
  ok: boolean
}

export function checkPrint(plan: PlanState, denominator: number, process: PrintProcess, thicken: boolean): PrintCheck {
  const limits = PROCESS_LIMITS[process]
  const k = 1000 / denominator
  const wallMm = WALL_M * k
  const thickened = thicken && wallMm < limits.minUnsupportedWallMm
  const printedWallMm = thickened ? limits.minUnsupportedWallMm : wallMm
  const mesh = houseMesh(plan, { wallM: printedWallMm / k, boundsOnly: true })
  const margin = 0.5 * 2
  const sizeMm = {
    x: (mesh.bounds.maxX - mesh.bounds.minX + margin) * k,
    y: (mesh.bounds.maxY - mesh.bounds.minY + margin) * k,
    z: mesh.bounds.maxZ * k + BASE_PRINT_MM,
  }
  const bridgeMm = mesh.longestLintelM * k
  const wallOk = printedWallMm >= limits.minUnsupportedWallMm - 1e-9
  const bridgeOk = bridgeMm <= limits.maxBridgeMm + 1e-9
  const fits = sizeMm.x <= BUILD_PLATE_MM && sizeMm.y <= BUILD_PLATE_MM && sizeMm.z <= BUILD_PLATE_MM
  return { denominator, process, wallMm, printedWallMm, thickened, wallOk, bridgeMm, bridgeOk, sizeMm, fits, ok: wallOk && fits }
}

/** The biggest model that prints: walls hold and it fits the plate. */
export function recommendScale(plan: PlanState, process: PrintProcess, thicken: boolean): PrintCheck | null {
  if (plan.rooms.every((r) => r.kind === 'terrace')) return null
  return PRINT_SCALES.map((d) => checkPrint(plan, d, process, thicken)).find((c) => c.ok) ?? null
}
