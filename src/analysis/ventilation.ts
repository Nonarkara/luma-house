import type { PlanState, Room } from '../types'
import { openingsForRoomWall } from './walls'
import type { Compass } from './types'

const OPPOSITE: Record<Compass, Compass> = { N: 'S', S: 'N', E: 'W', W: 'E' }

interface VentilationVerdict {
  /** 0 = sealed, 1 = strong cross-breeze */
  score: number
  /** Compass directions of the walls that have openings (windows + doors) */
  wallsWithOpenings: Compass[]
  /** Human-readable reason for the score */
  reason: string
}

/**
 * Cross-ventilation score for a single room. Based on the standard architectural
 * rule: a room needs openings on **at least two different walls**, and ideally on
 * **opposing** walls, to feel a through-breeze.
 *
 * - 0 walls: 0.00  (sealed box)
 * - 1 wall:  0.25  (single-sided, marginal)
 * - 2 same-axis walls (N+S or E+W): 0.75  (cross-breeze)
 * - 2 walls at 90° (e.g. N+E): 0.55  (corner, partial)
 * - 3+ walls: 0.85
 * - 4 walls: 1.00  (pavilion)
 */
export function crossVentilationScore(plan: PlanState, room: Room): VentilationVerdict {
  const directions: Compass[] = ['N', 'E', 'S', 'W']
  const wallsWithOpenings: Compass[] = []

  for (const compass of directions) {
    const onWall = openingsForRoomWall(plan, room.id, compass)
    const hasWindow = onWall.some((o) => o.type === 'window')
    const hasDoor = onWall.some((o) => o.type === 'door')
    if (hasWindow || hasDoor) wallsWithOpenings.push(compass)
  }

  const count = wallsWithOpenings.length
  if (count === 0) {
    return { score: 0, wallsWithOpenings, reason: 'Sealed — no windows or doors on any wall.' }
  }
  if (count === 1) {
    return { score: 0.25, wallsWithOpenings, reason: `Single-sided on ${wallsWithOpenings[0]} wall — minimal air exchange.` }
  }

  const set = new Set(wallsWithOpenings)
  const hasOpposing = (set.has('N') && set.has('S')) || (set.has('E') && set.has('W'))

  if (count === 2 && hasOpposing) {
    const pair = set.has('N') ? 'N ↔ S' : 'E ↔ W'
    return { score: 0.75, wallsWithOpenings, reason: `Cross-breeze from ${pair}.` }
  }
  if (count === 2) {
    return { score: 0.55, wallsWithOpenings, reason: `Corner openings on ${wallsWithOpenings.join(' + ')} — partial exchange.` }
  }
  if (count === 3) {
    return { score: 0.85, wallsWithOpenings, reason: 'Three-sided openings — strong flow.' }
  }
  return { score: 1, wallsWithOpenings, reason: 'Pavilion — openings on all four sides.' }
}

/**
 * Identify the opposing wall of a room that has zero openings but where adding
 * a window would enable cross-breeze. Returns null if no useful opportunity.
 */
export function missingOppositeWall(
  plan: PlanState,
  room: Room,
): { from: Compass; to: Compass } | null {
  const set = new Set(
    ['N', 'E', 'S', 'W'].filter((c) => openingsForRoomWall(plan, room.id, c as Compass).length > 0) as Compass[],
  )
  if (set.size === 0) return null
  if (set.size >= 2) return null

  const [only] = Array.from(set)
  const opposite = OPPOSITE[only]
  if (set.has(opposite)) return null
  return { from: only, to: opposite }
}