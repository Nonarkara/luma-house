import type { PlanState } from '../types'
import { calculateChinaApartmentBudget } from '../mockups/chinaApartment'
import { estimateApartmentCarbon } from '../mockups/chinaApartment'
import { daylightPotential } from './daylight'
import { heatFlowSnapshot } from './heatFlow'
import { windFlowPotential } from './windFlow'


export interface ABComparisonResult {
  baseline: {
    areaM2: number
    totalCost: number
    carbonKg: number
    daylightCoveragePct: number
    netHeatWatts: number
    avgAch: number
  }
  proposed: {
    areaM2: number
    totalCost: number
    carbonKg: number
    daylightCoveragePct: number
    netHeatWatts: number
    avgAch: number
  }
  delta: {
    areaM2: number
    totalCost: number
    carbonKg: number
    daylightCoveragePct: number
    netHeatWatts: number
    avgAch: number
  }
}

export function comparePlans(baseline: PlanState, proposed: PlanState): ABComparisonResult {
  const getMetrics = (plan: PlanState) => {
    const b = calculateChinaApartmentBudget(plan)
    const c = estimateApartmentCarbon(plan)
    const dl = daylightPotential(plan)
    const h = heatFlowSnapshot({ plan, sunAzimuth: 180, sunAltitude: 45, outsideC: 34 })
    const w = windFlowPotential(plan, 180, 3.5)

    const avgDlCoverage =
      dl.length > 0 ? (dl.reduce((sum, d) => sum + d.planCoverage, 0) / dl.length) * 100 : 0
    const avgAch =
      w.length > 0 ? w.reduce((sum, item) => sum + (item.ach ?? 0), 0) / w.length : 0

    return {
      areaM2: b.area,
      totalCost: b.total,
      carbonKg: c.totalKg,
      daylightCoveragePct: avgDlCoverage,
      netHeatWatts: h.netW,
      avgAch,
    }
  }

  const baseMetrics = getMetrics(baseline)
  const propMetrics = getMetrics(proposed)

  return {
    baseline: baseMetrics,
    proposed: propMetrics,
    delta: {
      areaM2: propMetrics.areaM2 - baseMetrics.areaM2,
      totalCost: propMetrics.totalCost - baseMetrics.totalCost,
      carbonKg: propMetrics.carbonKg - baseMetrics.carbonKg,
      daylightCoveragePct: propMetrics.daylightCoveragePct - baseMetrics.daylightCoveragePct,
      netHeatWatts: propMetrics.netHeatWatts - baseMetrics.netHeatWatts,
      avgAch: propMetrics.avgAch - baseMetrics.avgAch,
    },
  }
}
