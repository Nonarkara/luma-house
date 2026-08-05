import { siteOf } from '../plan'
import type { PlanState } from '../types'

export interface RoomAirQuality {
  roomId: string
  roomName: string
  occupants: number
  steadyStateCo2Ppm: number
  overnightMaxCo2Ppm: number // 8-hour sleep concentration
  iaqRating: 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'POOR'
  freshAirSupplyM3h: number
  recommendation: string
}

export interface AirQualityReport {
  overallIaq: 'EXCELLENT' | 'GOOD' | 'MODERATE' | 'POOR'
  rooms: RoomAirQuality[]
  averageCo2Ppm: number
}

const OUTDOOR_CO2_PPM = 415 // Baseline outdoor ambient CO2 concentration
const HUMAN_CO2_GEN_L_PER_S = 0.0052 // CO2 generation rate per sedentary person (L/s)

/**
 * Calculates indoor CO2 accumulation (ppm) and fresh air exchange rates.
 */
export function analyzeAirQuality(plan: PlanState): AirQualityReport {
  const site = siteOf(plan)
  const results: RoomAirQuality[] = []

  for (const room of plan.rooms) {
    if (room.kind === 'terrace') continue

    // Estimate occupancy: Bedrooms = 2, Living = 3, Studio/Kitchen = 1
    const occupants = room.kind === 'bedroom' ? 2 : room.kind === 'living' ? 3 : 1
    const areaM2 = (room.w / 100) * site.w * ((room.h / 100) * site.h)
    const heightM = room.wallHeight ?? 2.5
    const volumeM3 = areaM2 * heightM

    // Determine Air Change Rate per Hour (ACH)
    const naturalAch = plan.systems.insulation ? 0.6 : 1.8 // Unsealed building gets higher infiltration
    const hrvAch = plan.systems.climate ? 1.2 : 0 // Active ventilation system
    const totalAch = naturalAch + hrvAch

    const freshAirSupplyM3h = volumeM3 * totalAch

    // Steady state CO2 (ppm) = Outdoor + (Generation / Ventilation Rate)
    // Generation in m³/h = occupants * 0.0052 L/s * 3600 / 1000 = occupants * 0.01872 m³/h
    const co2GenM3h = occupants * HUMAN_CO2_GEN_L_PER_S * 3.6
    const steadyStateCo2Ppm = Math.round(OUTDOOR_CO2_PPM + (freshAirSupplyM3h > 0 ? (co2GenM3h / freshAirSupplyM3h) * 1e6 : 2000))

    // 8-hour overnight transient accumulation in closed bedroom
    // C(t) = C_ss + (C_0 - C_ss) * e^(-ACH * t)
    const overnightMaxCo2Ppm = Math.round(steadyStateCo2Ppm + (200 * (1 / Math.max(0.4, totalAch))))

    let iaqRating: RoomAirQuality['iaqRating'] = 'EXCELLENT'
    let recommendation = 'Air quality is fresh and within healthy parameters.'

    if (overnightMaxCo2Ppm > 1500) {
      iaqRating = 'POOR'
      recommendation = `High CO₂ accumulation (${overnightMaxCo2Ppm} ppm overnight). Enable trickle vents or mechanical HRV system.`
    } else if (overnightMaxCo2Ppm > 1000) {
      iaqRating = 'MODERATE'
      recommendation = `Moderate CO₂ level (${overnightMaxCo2Ppm} ppm). Consider night cross-ventilation.`
    } else if (overnightMaxCo2Ppm > 750) {
      iaqRating = 'GOOD'
      recommendation = 'Good indoor air quality with adequate fresh air change.'
    }

    results.push({
      roomId: room.id,
      roomName: room.name,
      occupants,
      steadyStateCo2Ppm,
      overnightMaxCo2Ppm,
      iaqRating,
      freshAirSupplyM3h: parseFloat(freshAirSupplyM3h.toFixed(1)),
      recommendation,
    })
  }

  const avgCo2 = results.length > 0 ? Math.round(results.reduce((s, r) => s + r.overnightMaxCo2Ppm, 0) / results.length) : OUTDOOR_CO2_PPM
  const hasPoor = results.some((r) => r.iaqRating === 'POOR')
  const hasMod = results.some((r) => r.iaqRating === 'MODERATE')
  const overallIaq = hasPoor ? 'POOR' : hasMod ? 'MODERATE' : 'EXCELLENT'

  return {
    overallIaq,
    rooms: results,
    averageCo2Ppm: avgCo2,
  }
}
