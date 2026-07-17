import type { PlanState } from '../types'
import type { AnalysisResult, Suggestion, WallSun } from './types'
import { missingOppositeWall } from './ventilation'
import { wallNeedsShade } from './sunHours'

const COMPASS_LABEL: Record<WallSun['compass'], string> = {
  N: 'north',
  E: 'east',
  S: 'south',
  W: 'west',
}

export function generateSuggestions(result: AnalysisResult, plan: PlanState): Suggestion[] {
  const out: Suggestion[] = []

  for (const room of result.rooms) {
    // 1. Cross-ventilation
    if (room.crossVentilation < 0.4) {
      const missing = missingOppositeWall(plan, room.room)
      if (missing) {
        out.push({
          roomId: room.room.id,
          severity: 2,
          kind: 'ventilation',
          title: `Add a window to the ${COMPASS_LABEL[missing.to]} wall of ${room.room.name}`,
          body: `Currently only the ${COMPASS_LABEL[missing.from]} wall opens. A ${COMPASS_LABEL[missing.to]} window unlocks cross-breeze — the cheapest comfort gain you can make.`,
          action: { type: 'place-window', roomId: room.room.id, compass: missing.to },
        })
      } else {
        out.push({
          roomId: room.room.id,
          severity: 3,
          kind: 'ventilation',
          title: `${room.room.name} is sealed — no windows on any wall`,
          body: 'Add at least one window. Without openings this room will not breathe, no matter how good the rest of the envelope is.',
        })
      }
    } else if (room.crossVentilation < 0.6) {
      out.push({
        roomId: room.room.id,
        severity: 1,
        kind: 'ventilation',
        title: `${room.room.name} has corner openings, not cross-breeze`,
        body: 'A second window on the opposite wall will roughly double the air exchange for the same opening size.',
      })
    }

    // 2. Shading on hot walls
    for (const wall of room.walls) {
      if (!wallNeedsShade(wall.directMinutes)) continue
      if (wall.compass === 'N') continue // north rarely needs shading in tropical houses
      const overhang = wall.compass === 'W' ? '1.5 m' : '0.9 m'
      out.push({
        roomId: room.room.id,
        severity: wall.compass === 'W' ? 3 : 2,
        kind: 'shading',
        title: `${wallHoursLabel(wall)} of direct sun on the ${COMPASS_LABEL[wall.compass]} wall of ${room.room.name}`,
        body:
          wall.compass === 'W'
            ? `Western afternoon sun is the harshest load in tropical houses. Add a ${overhang} overhang, a deciduous shade tree, or a vertical screen to keep it off the glass.`
            : `Add a ${overhang} overhang, an external blind, or shade-sail to cut this afternoon load. Aim to keep direct sun off the wall between 13:00 and 16:00.`,
      })
    }

    // 3. Heat stress
    if (room.peakIndoorC >= 36) {
      out.push({
        roomId: room.room.id,
        severity: 3,
        kind: 'insulation',
        title: `${room.room.name} runs ~${room.peakIndoorC.toFixed(0)}°C in peak month`,
        body: 'Above the comfort threshold for sleeping and most daytime activity. Combine roof insulation (R-30+), reflective paint, and a ceiling fan — the cheapest stack to drop peak indoor temp by 3–4°C.',
      })
    } else if (room.peakIndoorC >= 33) {
      out.push({
        roomId: room.room.id,
        severity: 2,
        kind: 'insulation',
        title: `${room.room.name} sits at the edge of comfort in peak month`,
        body: 'A continuous ceiling fan, lighter roof color, or one more cross-vent window keeps this room from tipping into heat-stress in a heat-wave year.',
      })
    }

    // 4. Kitchens & bathrooms without exterior walls need mechanical extraction
    if (room.room.kind === 'kitchen' && room.walls.length === 0) {
      out.push({
        roomId: room.room.id,
        severity: 2,
        kind: 'ventilation',
        title: `${room.room.name} is interior — no exterior wall`,
        body: 'Plan for a mechanical extraction hood venting into a duct, or relocate against an exterior wall. Kitchens without make-up air cannot vent properly.',
      })
    }
    if (room.room.kind === 'bathroom' && room.walls.length === 0) {
      out.push({
        roomId: room.room.id,
        severity: 2,
        kind: 'ventilation',
        title: `${room.room.name} is interior — needs a vent fan`,
        body: 'Add an inline extraction fan ducted to the roof or an exterior wall. Without it, humidity will creep into adjacent rooms.',
      })
    }

    // 5. Bedrooms: prefer east or north, penalize heavy west exposure
    if (room.room.kind === 'bedroom' && room.walls.some((w) => w.compass === 'W' && w.directMinutes > 180)) {
      out.push({
        roomId: room.room.id,
        severity: 2,
        kind: 'orientation',
        title: `${room.room.name} faces heavy western sun`,
        body: 'Bedrooms with western exposure overheat in late afternoon. Pull the bed away from the west wall, or add a 1.5 m external overhang above any west-facing window.',
      })
    }
  }

  // 6. Whole-house passive moves when overall shade score is low
  if (result.scores.shade < 50) {
    out.push({
      roomId: null,
      severity: 1,
      kind: 'shading',
      title: 'Whole-house shading is thin',
      body: 'A continuous 1.0 m eave around the perimeter + deciduous trees on the west and south sides is the highest-leverage move. Cost: low. Effect: significant.',
    })
  }

  // 7. Whole-house ventilation if no room has good cross-flow
  if (result.scores.ventilation < 40) {
    out.push({
      roomId: null,
      severity: 2,
      kind: 'ventilation',
      title: 'Cross-ventilation across the house is weak',
      body: 'A breezeway, courtyard, or aligned window pair on the longest axis can turn the whole house into a single through-ventilated volume.',
    })
  }

  // 8. Location-specific ventilation strategy (passive-first, climate-aware)
  const locName = result.location || 'Bangkok'
  if (locName.includes('Anchorage')) {
    out.unshift({
      roomId: null,
      severity: 3,
      kind: 'ventilation',
      title: 'Specify HRV for cold-climate ventilation',
      body: 'Anchorage needs controlled fresh air without dumping heat. A heat-recovery ventilator captures exhaust warmth and pre-heats incoming air — standard practice below −10°C design temps.',
    })
  } else if (locName.includes('Quito')) {
    out.unshift({
      roomId: null,
      severity: 2,
      kind: 'ventilation',
      title: 'Use high-level louvers for diurnal thermal mass',
      body: 'Quito\'s mild days and cool nights reward operable high louvers: open during the warm afternoon for purge ventilation, close at sunset to retain mass warmth in thick walls.',
    })
  } else {
    out.unshift({
      roomId: null,
      severity: 2,
      kind: 'ventilation',
      title: 'Stack passive cooling before mechanical AC',
      body: 'In this climate, pair cross-ventilation with a solar chimney or high-level exhaust shaft. Ceiling fans move air at roughly 5% the energy cost of split AC for most occupied hours.',
    })
  }

  return out
}

function wallHoursLabel(wall: WallSun): string {
  const hours = wall.directMinutes / 60
  return `${hours.toFixed(1)} h`
}