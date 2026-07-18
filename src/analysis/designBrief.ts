import type { AnalysisResult } from './types'
import type { PlanState } from '../types'
import { calculateBudget, estimateEnergySavings } from '../plan'

export interface BriefItem {
  id: 'insulation' | 'digital' | 'climate' | 'solar'
  title: string
  body: string
  recommended: boolean
  active: boolean
  costImpactTHB: number
  energyDeltaPct: number
}

export interface DesignBrief {
  headline: string
  summary: string
  items: BriefItem[]
  topActions: AnalysisResult['suggestions']
  projectedSavingsPct: number
  projectedTotalTHB: number
}

function climateBand(location: string): 'cold' | 'highland' | 'tropical' {
  if (location.includes('Anchorage')) return 'cold'
  if (location.includes('Quito')) return 'highland'
  return 'tropical'
}

/**
 * One-page advice a newcomer can act on: insulation, digital integration,
 * climate moves, with live cost deltas against the current BOQ.
 */
export function buildDesignBrief(
  plan: PlanState,
  climate: AnalysisResult,
  styleKeywords = '',
): DesignBrief {
  const band = climateBand(climate.location)
  const baseBudget = calculateBudget(plan, styleKeywords)
  const area = Math.max(1, baseBudget.area)

  const withInsulation: PlanState = {
    ...plan,
    systems: { ...plan.systems, insulation: true },
  }
  const withDigital: PlanState = {
    ...plan,
    systems: { ...plan.systems, lighting: true, climate: true },
  }
  const withSolar: PlanState = {
    ...plan,
    systems: { ...plan.systems, solar: true },
  }

  const insulationCost = calculateBudget(withInsulation, styleKeywords).total - baseBudget.total
  const digitalCost = calculateBudget(withDigital, styleKeywords).total - baseBudget.total
  const solarCost = calculateBudget(withSolar, styleKeywords).total - baseBudget.total

  const overheatingTotal = climate.rooms.reduce((sum, room) => sum + room.overheatingHours, 0)
  const avgVent = climate.rooms.length
    ? climate.rooms.reduce((sum, room) => sum + room.crossVentilation, 0) / climate.rooms.length
    : 0

  const insulation: BriefItem = {
    id: 'insulation',
    active: plan.systems.insulation,
    recommended: band === 'cold' || overheatingTotal > 200 || climate.scores.shade < 55,
    costImpactTHB: Math.max(0, insulationCost),
    energyDeltaPct: 18,
    title: plan.systems.insulation ? 'High-performance shell is on' : 'Add a high-performance shell',
    body:
      band === 'cold'
        ? 'Cold climates punish thin envelopes. Continuous roof R-30, Low-E glass, and airtightness cut both heat loss and condensation risk.'
        : band === 'highland'
          ? 'Mild days and cool nights reward thermal mass plus a decent roof. Insulation keeps daytime warmth for the evening without mechanical heat.'
          : overheatingTotal > 200
            ? `Rooms accumulate ~${Math.round(overheatingTotal)} overheating hours/year. Reflective roof, Low-E glass, and continuous insulation typically cut peak indoor temperature 2–4°C.`
            : 'Even in a well-ventilated tropical house, roof insulation and Low-E glass are the cheapest way to keep afternoon peaks out of bedrooms.',
  }

  const digital: BriefItem = {
    id: 'digital',
    active: plan.systems.lighting && plan.systems.climate,
    recommended: true,
    costImpactTHB: Math.max(0, digitalCost),
    energyDeltaPct: 20,
    title: plan.systems.lighting && plan.systems.climate
      ? 'Digital comfort stack is active'
      : 'Wire lighting + room climate as one system',
    body:
      'Presence-aware lighting, daylight dimming, and room-by-room setpoints are the digital layer that makes the envelope earn its keep. Spec DALI or equivalent early — retrofits cost more than coordinated first-fix.',
  }

  const solar: BriefItem = {
    id: 'solar',
    active: plan.systems.solar,
    recommended: band !== 'cold' || area >= 60,
    costImpactTHB: Math.max(0, solarCost),
    energyDeltaPct: 26,
    title: plan.systems.solar ? 'Solar array is included' : 'Add rooftop solar once the shell is tight',
    body:
      band === 'cold'
        ? 'Solar still pays in high latitudes if the shell is insulated first — otherwise generation fights an open envelope.'
        : 'A ~7 kWp array is sized to this footprint. Turn it on after insulation so the BOQ reflects generation on a load you have already reduced.',
  }

  const climateItem: BriefItem = {
    id: 'climate',
    active: avgVent >= 0.5 && climate.scores.ventilation >= 50,
    recommended: avgVent < 0.5 || climate.scores.ventilation < 50,
    costImpactTHB: 0,
    energyDeltaPct: 0,
    title: avgVent >= 0.5 ? 'Cross-ventilation is working' : 'Fix air paths before buying AC',
    body:
      avgVent >= 0.5
        ? `Average cross-vent score ${(avgVent * 100).toFixed(0)}%. Keep opposite-wall openings clear; fans beat compressors for most occupied hours.`
        : 'Openings are not aligned for through-breeze. Opposite-wall windows cost almost nothing compared with a second outdoor unit.',
  }

  const items = [insulation, climateItem, digital, solar]
  const missing = items.filter((item) => item.recommended && !item.active)
  const projectedSavingsPct = estimateEnergySavings({
    solar: plan.systems.solar || solar.recommended,
    insulation: plan.systems.insulation || insulation.recommended,
    climate: plan.systems.climate || digital.recommended,
    lighting: plan.systems.lighting || digital.recommended,
  })

  const advisedPlan: PlanState = {
    ...plan,
    systems: {
      solar: plan.systems.solar || solar.recommended,
      insulation: plan.systems.insulation || insulation.recommended,
      climate: plan.systems.climate || digital.recommended,
      lighting: plan.systems.lighting || digital.recommended,
    },
  }
  const projectedTotalTHB = calculateBudget(advisedPlan, styleKeywords).total

  const headline =
    missing.length === 0
      ? 'Envelope and systems are aligned with this climate'
      : `${missing.length} move${missing.length === 1 ? '' : 's'} before you lock the BOQ`

  const summary =
    band === 'cold'
      ? 'Priority order: airtight insulated shell → HRV → then solar and controls.'
      : band === 'highland'
        ? 'Priority order: thermal mass + night purge → modest insulation → lighting controls.'
        : 'Priority order: cross-vent + shade → roof insulation → fans/zoning → solar last.'

  return {
    headline,
    summary,
    items,
    topActions: climate.suggestions.slice(0, 3),
    projectedSavingsPct,
    projectedTotalTHB,
  }
}
