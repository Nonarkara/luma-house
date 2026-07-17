import type { PlanState, Room, RoomKind } from '../types'

/** Cardinal direction of a wall in plan view. North = top of canvas. */
export type Compass = 'N' | 'S' | 'E' | 'W'

/** A wall segment of a room. Interior walls are not analyzed. */
export interface WallSegment {
  roomId: string
  compass: Compass
  /** wall length as percentage of site (0–100) */
  lengthPct: number
  /** wall length in meters (relative to SITE_WIDTH_METERS / SITE_HEIGHT_METERS per axis) */
  lengthMeters: number
}

/** Sun exposure summary for one wall over a sample day. */
export interface WallSun {
  roomId: string
  compass: Compass
  /** Wall length in meters */
  lengthMeters: number
  /** Total minutes of direct sun on the wall face, 06:00–18:00 local */
  directMinutes: number
  /** Peak instantaneous solar intensity, 0–1 (1 = sun perpendicular) */
  peakIntensity: number
  /** Worst hour-of-day bin (0–23) when the wall gets blasted */
  worstHour: number
  /** Whether the wall exceeds a glare/heat threshold and needs shading */
  needsShade: boolean
}

/** Per-room environmental summary. */
export interface RoomClimate {
  room: Room
  /** Sun-hours per day per exterior wall */
  walls: WallSun[]
  /** 0 = sealed box, 1 = strong cross-breeze */
  crossVentilation: number
  /** Human-readable ventilation reason */
  ventilationNote: string
  /** 0 = harsh, 1 = comfortable — for the worst month at the chosen location */
  comfortScore: number
  /** Estimated peak indoor °C in the worst month (rough envelope model) */
  peakIndoorC: number
  /** Degrees above outdoor in the worst case */
  deltaC: number
  /** Estimated occupied-hours per year above the comfort threshold (directional) */
  overheatingHours: number
  /** Month (1–12) with the most overheating; 0 when none */
  overheatingWorstMonth: number
  /** Severity: 0 = no issue, 1 = nice-to-have, 2 = recommended, 3 = critical */
  severity: number
}

export interface Suggestion {
  roomId: string | null
  severity: 1 | 2 | 3
  title: string
  body: string
  /** What kind of intervention this is, for UI grouping / icons */
  kind: 'ventilation' | 'shading' | 'insulation' | 'orientation' | 'layout' | 'digital'
  /** Optional: a specific action the UI can execute (e.g. place a window) */
  action?: {
    type: 'place-window'
    roomId: string
    compass: Compass
  }
}

export interface AnalysisResult {
  location: string
  latitude: number
  /** Day of year used for the snapshot (1–365) */
  day: number
  rooms: RoomClimate[]
  suggestions: Suggestion[]
  /** Whole-house scores, 0–100 */
  scores: {
    ventilation: number
    solarGain: number
    shade: number
    overall: number
  }
}

export interface AnalysisInput {
  plan: PlanState
  location: { latitude: number; label?: string }
  /** Day of year used for sun exposure (default = summer solstice, day 172) */
  day?: number
}

export type { PlanState, Room, RoomKind }