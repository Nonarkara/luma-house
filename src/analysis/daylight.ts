import { roomHeight, siteOf } from '../plan'
import type { PlanState, Room } from '../types'
import type { Compass } from './types'
import { exteriorWalls, isOpeningExterior, openingsForRoomWall } from './walls'

export const DAYLIGHT_ASSUMPTIONS = {
  windowHeadHeightM: 2.1,
  windowWidthM: 1.6,
  reachMultiplier: 1.5,
  lateralSpreadPerDepth: 0.5,
} as const

export interface DaylightBand {
  roomId: string
  openingId: string
  compass: Compass
  /** Indicative plan depth reached by useful daylight, not an illuminance contour. */
  reachM: number
  reachPct: number
  /** Center and width of the indicative zone along the window wall. */
  offsetPct: number
  spreadPct: number
}

export interface RoomDaylightPotential {
  room: Room
  bands: DaylightBand[]
  /** Approximate share of room plan within 1.5 × window-head height of an exterior window. */
  planCoverage: number
  exteriorWindowCount: number
  confidence: 'reference'
}

/**
 * Fast, deliberately non-photometric daylight reach.
 *
 * LBNL's early-design rule of thumb puts the ordinary daylight zone at about
 * 1.5–2 × window-head height. We use the conservative 1.5 multiplier and
 * sample the room plan on a small fixed grid. It answers "where might daylight
 * reach?", not "how many lux?".
 */
export function daylightPotential(plan: PlanState): RoomDaylightPotential[] {
  const site = siteOf(plan)
  const exterior = exteriorWalls(plan)

  return plan.rooms.map((room) => {
    const wallHeight = roomHeight(room)
    const exteriorCompasses = new Set(
      exterior.filter((wall) => wall.roomId === room.id).map((wall) => wall.compass),
    )
    const bands: DaylightBand[] = []
    let exteriorWindowCount = 0

    for (const compass of exteriorCompasses) {
      const windows = openingsForRoomWall(plan, room.id, compass).filter((opening) => opening.type === 'window' && isOpeningExterior(plan, room.id, opening))
      if (windows.length === 0) continue
      const roomDepthM = compass === 'N' || compass === 'S'
        ? (room.h / 100) * site.h
        : (room.w / 100) * site.w
      const roomAlongM = compass === 'N' || compass === 'S'
        ? (room.w / 100) * site.w
        : (room.h / 100) * site.h
      for (const window of windows) {
        exteriorWindowCount += 1
        const headHeight = Math.min(window.headHeightM ?? DAYLIGHT_ASSUMPTIONS.windowHeadHeightM, wallHeight)
        const vltFactor = (window.vlt ?? 0.70) / 0.70
        const reachM = headHeight * DAYLIGHT_ASSUMPTIONS.reachMultiplier * vltFactor
        const clippedReachM = Math.min(reachM, roomDepthM)
        const openingWidthM = window.widthM ?? DAYLIGHT_ASSUMPTIONS.windowWidthM
        const zoneWidthM = openingWidthM + clippedReachM * DAYLIGHT_ASSUMPTIONS.lateralSpreadPerDepth * 2
        const offsetPct = compass === 'N' || compass === 'S'
          ? ((window.x - room.x) / room.w) * 100
          : ((window.y - room.y) / room.h) * 100
        bands.push({
          roomId: room.id,
          openingId: window.id,
          compass,
          offsetPct: Math.max(0, Math.min(100, offsetPct)),
          spreadPct: Math.min(100, (zoneWidthM / Math.max(0.01, roomAlongM)) * 100),
          reachM: clippedReachM,
          reachPct: Math.min(100, (clippedReachM / Math.max(0.01, roomDepthM)) * 100),
        })
      }
    }

    // A deterministic grid avoids geometric-union dependencies and stays O(rooms).
    const samples = 12
    let reached = 0
    for (let x = 0; x < samples; x += 1) {
      for (let y = 0; y < samples; y += 1) {
        const px = ((x + 0.5) / samples) * ((room.w / 100) * site.w)
        const py = ((y + 0.5) / samples) * ((room.h / 100) * site.h)
        const roomWidthM = (room.w / 100) * site.w
        const roomDepthM = (room.h / 100) * site.h
        const inBand = bands.some((band) => {
          const alongM = band.compass === 'N' || band.compass === 'S' ? roomWidthM : roomDepthM
          const along = band.compass === 'N' || band.compass === 'S' ? px : py
          const centerM = (band.offsetPct / 100) * alongM
          const insideSpread = Math.abs(along - centerM) <= ((band.spreadPct / 100) * alongM) / 2
          if (!insideSpread) return false
          if (band.compass === 'N') return py <= band.reachM
          if (band.compass === 'S') return roomDepthM - py <= band.reachM
          if (band.compass === 'W') return px <= band.reachM
          return roomWidthM - px <= band.reachM
        })
        if (inBand) reached += 1
      }
    }

    return {
      room,
      bands,
      planCoverage: reached / (samples * samples),
      exteriorWindowCount,
      confidence: 'reference' as const,
    }
  })
}
