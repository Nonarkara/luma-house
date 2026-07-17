import { exteriorWalls } from './walls'
import { wallSunForDay, wallNeedsShade } from './sunHours'
import { crossVentilationScore } from './ventilation'
import { thermalProfile } from './thermal'
import { generateSuggestions } from './suggestions'
import { overheatingProfile } from './overheating'
import type { AnalysisInput, AnalysisResult, RoomClimate, WallSun } from './types'

export type { AnalysisInput, AnalysisResult, RoomClimate, WallSun, Suggestion, Compass } from './types'
export { exteriorWalls } from './walls'
export { wallSunForDay, wallNeedsShade } from './sunHours'
export { crossVentilationScore, missingOppositeWall } from './ventilation'
export { thermalProfile, peakOutdoorC } from './thermal'
export { generateSuggestions } from './suggestions'
export { overheatingProfile, OVERHEAT_THRESHOLD_C } from './overheating'

const SCAN_DAY_DEFAULT = 172 // ~summer solstice (June 21 in northern hemisphere)

/**
 * Run the full environmental analysis: for each room, compute exterior-wall
 * orientation, daily direct-sun exposure, cross-ventilation, and a rough peak
 * indoor temperature. Then bundle suggestions.
 */
export function analyze(input: AnalysisInput): AnalysisResult {
  const { plan, location } = input
  const day = input.day ?? SCAN_DAY_DEFAULT
  const walls = exteriorWalls(plan)

  // Group walls by room for downstream scoring
  const wallsByRoom = new Map<string, WallSun[]>()
  for (const wall of walls) {
    const sun = wallSunForDay(location.latitude, day, wall.compass)
    const w: WallSun = {
      roomId: wall.roomId,
      compass: wall.compass,
      lengthMeters: wall.lengthMeters,
      directMinutes: sun.directMinutes,
      peakIntensity: sun.peakIntensity,
      worstHour: sun.worstHour,
      needsShade: wallNeedsShade(sun.directMinutes),
    }
    const arr = wallsByRoom.get(w.roomId) ?? []
    arr.push(w)
    wallsByRoom.set(w.roomId, arr)
  }

  const rooms: RoomClimate[] = plan.rooms.map((room) => {
    const roomWalls = wallsByRoom.get(room.id) ?? []
    const vent = crossVentilationScore(plan, room)
    const thermal = thermalProfile({
      walls: roomWalls,
      plan,
      room,
      ventilationScore: vent.score,
      insulationOn: plan.systems.insulation,
      latitude: location.latitude,
    })
    const overheat = overheatingProfile({
      latitude: location.latitude,
      plan,
      room,
      walls: roomWalls,
      ventilationScore: vent.score,
      insulationOn: plan.systems.insulation,
    })
    const sev = severity(roomWalls, vent.score, thermal.stress)
    return {
      room,
      walls: roomWalls,
      crossVentilation: vent.score,
      ventilationNote: vent.reason,
      comfortScore: 1 - thermal.stress,
      peakIndoorC: thermal.peakIndoorC,
      deltaC: thermal.deltaC,
      overheatingHours: overheat.hoursPerYear,
      overheatingWorstMonth: overheat.worstMonth,
      severity: sev,
    }
  })

  const scores = aggregateScores(rooms)
  const base: AnalysisResult = {
    location: location.label ?? `${location.latitude.toFixed(2)}°`,
    latitude: location.latitude,
    day,
    rooms,
    suggestions: [],
    scores,
  }
  base.suggestions = generateSuggestions(base, plan)
  return base
}

function severity(walls: WallSun[], ventScore: number, thermalStress: number): number {
  let s = 0
  if (ventScore < 0.4) s = Math.max(s, 2)
  else if (ventScore < 0.6) s = Math.max(s, 1)
  if (walls.some((w) => w.compass === 'W' && w.directMinutes > 240)) s = Math.max(s, 3)
  else if (walls.some((w) => w.needsShade)) s = Math.max(s, 2)
  if (thermalStress > 0.6) s = Math.max(s, 3)
  else if (thermalStress > 0.35) s = Math.max(s, 2)
  return s
}

function aggregateScores(rooms: RoomClimate[]): AnalysisResult['scores'] {
  if (rooms.length === 0) {
    return { ventilation: 0, solarGain: 0, shade: 0, overall: 0 }
  }
  const vent = (rooms.reduce((s, r) => s + r.crossVentilation, 0) / rooms.length) * 100
  // Shade: inverse — fewer "needs shade" walls is better.
  const needsShade = rooms.flatMap((r) => r.walls.filter((w) => w.needsShade)).length
  const totalWalls = rooms.reduce((s, r) => s + r.walls.length, 0) || 1
  const shade = Math.max(0, 100 - (needsShade / totalWalls) * 130)
  // Solar gain: penalize harsh west sun, reward even spread.
  const westBlast = rooms
    .flatMap((r) => r.walls)
    .filter((w) => w.compass === 'W' && w.directMinutes > 240).length
  const solarGain = Math.max(0, 100 - westBlast * 20)
  const overall = Math.round(vent * 0.4 + shade * 0.3 + solarGain * 0.3)
  return {
    ventilation: Math.round(vent),
    shade: Math.round(shade),
    solarGain: Math.round(solarGain),
    overall,
  }
}