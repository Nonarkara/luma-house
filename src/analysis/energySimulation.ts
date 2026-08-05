import { siteOf } from '../plan'
import type { PlanState } from '../types'
import { resolvePlanAssemblies, DEFAULT_ASSEMBLIES } from '../assemblies/resolve'
import { exteriorWalls } from './walls'

export interface EnergySimulationResult {
  heatingDemandKwhPerM2Yr: number
  coolingDemandKwhPerM2Yr: number
  lightingEquipmentKwhPerM2Yr: number
  solarPvGenerationKwhPerM2Yr: number
  grossEuiKwhPerM2Yr: number
  netEuiKwhPerM2Yr: number
  energyRating: 'A+' | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G'
  annualOperationalCarbonKg: number
  carbonNeutralityPaybackYears: number | null // Payback period for green envelope + PV upgrade
  breakdown: {
    wallLossKwh: number
    roofLossKwh: number
    floorLossKwh: number
    glazingLossKwh: number
    ventilationLossKwh: number
    solarGainKwh: number
    internalGainsKwh: number
  }
}

/**
 * Simulates annual operational energy balance (EUI in kWh/m²/yr) and carbon neutrality payback.
 */
export function simulateEnergy(plan: PlanState, latitude = 31.23): EnergySimulationResult {
  const site = siteOf(plan)
  const totalFloorAreaM2 = plan.rooms.reduce((acc, r) => acc + (r.w / 100) * site.w * ((r.h / 100) * site.h), 0)

  if (totalFloorAreaM2 <= 0) {
    return {
      heatingDemandKwhPerM2Yr: 0,
      coolingDemandKwhPerM2Yr: 0,
      lightingEquipmentKwhPerM2Yr: 0,
      solarPvGenerationKwhPerM2Yr: 0,
      grossEuiKwhPerM2Yr: 0,
      netEuiKwhPerM2Yr: 0,
      energyRating: 'A+',
      annualOperationalCarbonKg: 0,
      carbonNeutralityPaybackYears: 0,
      breakdown: {
        wallLossKwh: 0,
        roofLossKwh: 0,
        floorLossKwh: 0,
        glazingLossKwh: 0,
        ventilationLossKwh: 0,
        solarGainKwh: 0,
        internalGainsKwh: 0,
      },
    }
  }

  // 1. Resolve envelope U-values
  const assemblies = resolvePlanAssemblies(plan.assemblies ?? DEFAULT_ASSEMBLIES)
  const wallU = assemblies.wall.uValue
  const roofU = assemblies.roof.uValue
  const floorU = assemblies.floor.uValue
  const glazingU = plan.assemblies?.glazingUValue ?? 2.7
  const shgc = plan.assemblies?.glazingSHGC ?? 0.65

  // 2. Compute envelope areas
  const extWalls = exteriorWalls(plan)
  const totalWallAreaM2 = extWalls.reduce((sum, w) => {
    const r = plan.rooms.find((item) => item.id === w.roomId)
    const hM = r?.wallHeight ?? 2.5
    return sum + w.lengthMeters * hM
  }, 0)

  let totalGlazingM2 = 0
  for (const op of plan.openings) {
    if (op.type === 'window') {
      totalGlazingM2 += (op.widthM ?? 1.6) * (op.heightM ?? 1.2)
    }
  }

  const netWallAreaM2 = Math.max(0, totalWallAreaM2 - totalGlazingM2)
  const roofAreaM2 = totalFloorAreaM2
  const floorAreaM2 = totalFloorAreaM2

  // 3. Degree Days & Irradiance heuristic based on absolute latitude
  const absLat = Math.abs(latitude)
  // Higher latitude = more Heating Degree Days (HDD), lower = more Cooling Degree Days (CDD)
  const hdd = Math.max(200, (absLat - 10) * 90)
  const cdd = Math.max(100, (45 - absLat) * 75)
  const annualSolarIrradianceKwhM2 = Math.max(900, 1800 - absLat * 15)

  // 4. Transmission Losses (kWh/yr) = Area * U * HDD * 24 / 1000
  const wallLossKwh = (netWallAreaM2 * wallU * hdd * 24) / 1000
  const roofLossKwh = (roofAreaM2 * roofU * hdd * 24) / 1000
  const floorLossKwh = (floorAreaM2 * floorU * (hdd * 0.5) * 24) / 1000
  const glazingLossKwh = (totalGlazingM2 * glazingU * hdd * 24) / 1000

  // 5. Ventilation & Infiltration Loss
  const ach = plan.systems.insulation ? 0.8 : 2.5 // Air changes per hour
  const hrvEfficiency = plan.systems.climate ? 0.75 : 0.0
  const roomVolumeM3 = totalFloorAreaM2 * 2.5
  const ventVolumeFlowM3h = roomVolumeM3 * ach * (1 - hrvEfficiency)
  // Air heat capacity ≈ 0.33 Wh/m³·K
  const ventilationLossKwh = (ventVolumeFlowM3h * 0.33 * hdd * 24) / 1000

  // 6. Gains (Solar & Internal)
  const solarGainKwh = (totalGlazingM2 * shgc * annualSolarIrradianceKwhM2 * 0.45) // Effective solar utilization
  const internalGainsKwh = totalFloorAreaM2 * 18 // ~18 kWh/m²/yr body/appliances heat

  // 7. Heating & Cooling Net Demands (kWh/m²/yr)
  const totalHeatLossKwh = wallLossKwh + roofLossKwh + floorLossKwh + glazingLossKwh + ventilationLossKwh
  const netHeatingKwh = Math.max(0, totalHeatLossKwh - solarGainKwh - internalGainsKwh)
  const heatingDemandKwhPerM2Yr = netHeatingKwh / totalFloorAreaM2

  const rawCoolingKwh = ((cdd * totalGlazingM2 * shgc * 15) / 1000) + (internalGainsKwh * 0.4)
  const coolingDemandKwhPerM2Yr = Math.max(0, rawCoolingKwh / totalFloorAreaM2)

  const lightingEquipmentKwhPerM2Yr = plan.systems.lighting ? 12 : 22 // Efficient LED vs standard

  // 8. Solar PV Generation Yield
  const solarPvGenerationKwhPerM2Yr = plan.systems.solar
    ? (roofAreaM2 * 0.5 * annualSolarIrradianceKwhM2 * 0.18) / totalFloorAreaM2 // 50% roof covered in 18% efficiency panels
    : 0

  const grossEuiKwhPerM2Yr = heatingDemandKwhPerM2Yr + coolingDemandKwhPerM2Yr + lightingEquipmentKwhPerM2Yr
  const netEuiKwhPerM2Yr = Math.max(0, grossEuiKwhPerM2Yr - solarPvGenerationKwhPerM2Yr)

  // 9. Energy Rating Class
  let energyRating: EnergySimulationResult['energyRating'] = 'G'
  if (netEuiKwhPerM2Yr < 15) energyRating = 'A+'
  else if (netEuiKwhPerM2Yr < 40) energyRating = 'A'
  else if (netEuiKwhPerM2Yr < 75) energyRating = 'B'
  else if (netEuiKwhPerM2Yr < 110) energyRating = 'C'
  else if (netEuiKwhPerM2Yr < 150) energyRating = 'D'
  else if (netEuiKwhPerM2Yr < 200) energyRating = 'E'
  else if (netEuiKwhPerM2Yr < 260) energyRating = 'F'

  // 10. Operational Carbon & Payback Period
  // Grid carbon intensity ≈ 0.45 kgCO₂e/kWh
  const annualOperationalCarbonKg = netEuiKwhPerM2Yr * totalFloorAreaM2 * 0.45

  // Payback calculation: Extra embodied carbon of upgraded insulation/solar divided by annual carbon savings
  const baselineEui = 180 // Typical uninsulated building EUI
  const annualCarbonSavedKg = Math.max(1, (baselineEui - netEuiKwhPerM2Yr) * totalFloorAreaM2 * 0.45)
  const totalEmbodiedCarbonKg = (assemblies.wall.embodiedCarbonKgPerM2 + assemblies.roof.embodiedCarbonKgPerM2) * totalFloorAreaM2
  const carbonNeutralityPaybackYears = parseFloat((totalEmbodiedCarbonKg / annualCarbonSavedKg).toFixed(1))

  return {
    heatingDemandKwhPerM2Yr: parseFloat(heatingDemandKwhPerM2Yr.toFixed(1)),
    coolingDemandKwhPerM2Yr: parseFloat(coolingDemandKwhPerM2Yr.toFixed(1)),
    lightingEquipmentKwhPerM2Yr: parseFloat(lightingEquipmentKwhPerM2Yr.toFixed(1)),
    solarPvGenerationKwhPerM2Yr: parseFloat(solarPvGenerationKwhPerM2Yr.toFixed(1)),
    grossEuiKwhPerM2Yr: parseFloat(grossEuiKwhPerM2Yr.toFixed(1)),
    netEuiKwhPerM2Yr: parseFloat(netEuiKwhPerM2Yr.toFixed(1)),
    energyRating,
    annualOperationalCarbonKg: parseFloat(annualOperationalCarbonKg.toFixed(0)),
    carbonNeutralityPaybackYears,
    breakdown: {
      wallLossKwh: parseFloat(wallLossKwh.toFixed(0)),
      roofLossKwh: parseFloat(roofLossKwh.toFixed(0)),
      floorLossKwh: parseFloat(floorLossKwh.toFixed(0)),
      glazingLossKwh: parseFloat(glazingLossKwh.toFixed(0)),
      ventilationLossKwh: parseFloat(ventilationLossKwh.toFixed(0)),
      solarGainKwh: parseFloat(solarGainKwh.toFixed(0)),
      internalGainsKwh: parseFloat(internalGainsKwh.toFixed(0)),
    },
  }
}
