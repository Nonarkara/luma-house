import { heatFlowSnapshot, windFlowPotential } from '../analysis'
import { solarPosition } from '../plan'
import type { PlanState } from '../types'

export interface ClimateScenario {
  id: 'hot_afternoon' | 'winter_noon' | 'cross_breeze' | 'still_evening'
  name: string
  tagline: string
  description: string
  icon: 'Sun' | 'SunDim' | 'Wind' | 'Gauge'
  intent: 'heat' | 'solar' | 'air'
  params: {
    day: number
    hour: number
    outsideC: number
    windFrom: number
    windSpeed: number
  }
}

export interface ScenarioEvaluation {
  status: 'Watch' | 'Opportunity' | 'Compare'
  headline: string
  keyInsight: string
  recommendation: string
  metrics: Array<{ label: string; value: string }>
}

/** What-if inputs, not historical weather records. They run at the selected project location. */
export const CLIMATE_SCENARIOS: ClimateScenario[] = [
  {
    id: 'hot_afternoon',
    name: 'Hot afternoon',
    tagline: '14:00 · 38°C · moderate south wind',
    description: 'Compare direct solar gain and envelope transmission during a deliberately hot afternoon.',
    icon: 'Sun',
    intent: 'heat',
    params: { day: 172, hour: 14, outsideC: 38, windFrom: 180, windSpeed: 3 },
  },
  {
    id: 'winter_noon',
    name: 'Cold winter noon',
    tagline: '12:00 · 4°C · low winter sun',
    description: 'See whether low-angle sun offsets part of the current envelope heat loss.',
    icon: 'SunDim',
    intent: 'solar',
    params: { day: 355, hour: 12, outsideC: 4, windFrom: 340, windSpeed: 4 },
  },
  {
    id: 'cross_breeze',
    name: 'Strong cross-breeze',
    tagline: '16:00 · 29°C · 6 m/s southwest wind',
    description: 'Rotate a strong wind across the plan and count rooms with a usable inlet-to-outlet pressure path.',
    icon: 'Wind',
    intent: 'air',
    params: { day: 190, hour: 16, outsideC: 29, windFrom: 215, windSpeed: 6 },
  },
  {
    id: 'still_evening',
    name: 'Still warm evening',
    tagline: '19:00 · 30°C · 0.5 m/s wind',
    description: 'Test the passive plan when useful wind is nearly absent and direct solar gain has ended.',
    icon: 'Gauge',
    intent: 'air',
    params: { day: 202, hour: 19, outsideC: 30, windFrom: 180, windSpeed: 0.5 },
  },
]

export function evaluateScenario(
  scenario: ClimateScenario,
  plan: PlanState,
  latitude: number,
): ScenarioEvaluation {
  const sun = solarPosition(latitude, scenario.params.day, scenario.params.hour)
  const heat = heatFlowSnapshot({
    plan,
    sunAzimuth: sun.azimuth,
    sunAltitude: sun.altitude,
    outsideC: scenario.params.outsideC,
  })
  const wind = windFlowPotential(plan, scenario.params.windFrom, scenario.params.windSpeed)
  const pressurePaths = wind.filter((room) => room.mode === 'through-flow').length

  if (scenario.intent === 'air') {
    const usefulWind = scenario.params.windSpeed >= 1.5
    return {
      status: usefulWind && pressurePaths > 0 ? 'Opportunity' : 'Watch',
      headline: usefulWind
        ? `${pressurePaths} of ${plan.rooms.length} rooms show a pressure path`
        : 'The plan cannot rely on wind in this condition',
      keyInsight: usefulWind
        ? `The arrows show geometric capacity at ${scenario.params.windSpeed.toFixed(1)} m/s. Screens, security, rain and internal-door position are not modeled.`
        : `Wind is only ${scenario.params.windSpeed.toFixed(1)} m/s. A drawn pressure path may exist, but the available drive is weak.`,
      recommendation: usefulWind
        ? 'Rotate the wind and look for rooms that lose their path; robust plans work across more than one direction.'
        : 'Treat mechanical fresh air or fans as a separate decision; do not count on this wind case for cooling.',
      metrics: [
        { label: 'Wind input', value: `${scenario.params.windFrom}° · ${scenario.params.windSpeed.toFixed(1)} m/s` },
        { label: 'Pressure paths', value: `${pressurePaths} / ${plan.rooms.length} rooms` },
        { label: 'Outdoor air', value: `${scenario.params.outsideC.toFixed(1)} °C` },
        { label: 'Confidence', value: 'Concept geometry' },
      ],
    }
  }

  const signedNet = `${heat.netW >= 0 ? '+' : '−'}${Math.round(Math.abs(heat.netW))} W`
  const solarUseful = scenario.intent === 'solar' && heat.solarW > 0
  return {
    status: scenario.intent === 'heat' && heat.netW > 0 ? 'Watch' : solarUseful ? 'Opportunity' : 'Compare',
    headline: scenario.intent === 'heat'
      ? `${Math.round(Math.max(0, heat.netW))} W entering in this snapshot`
      : `${Math.round(heat.solarW)} W of direct solar gain now`,
    keyInsight: `The current wall, opening and direct-sun model gives ${signedNet} net heat at ${scenario.params.outsideC.toFixed(1)}°C outside.`,
    recommendation: scenario.intent === 'heat'
      ? 'Compare external shade and the envelope option. Use the difference, not this snapshot, to choose the next move.'
      : 'Scrub nearby hours before preserving or blocking this sun; useful winter gain can become glare or summer load.',
    metrics: [
      { label: 'Sun position', value: `${sun.altitude.toFixed(1)}° alt · ${sun.azimuth.toFixed(0)}° az` },
      { label: 'Direct solar', value: `${Math.round(heat.solarW)} W` },
      { label: 'Envelope transmission', value: `${Math.round(Math.abs(heat.wallW + heat.openingW))} W` },
      { label: 'Model scope', value: 'Walls + openings' },
    ],
  }
}
