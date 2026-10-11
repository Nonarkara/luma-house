import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ABComparisonModal } from './ABComparisonModal'
import { comparePlans } from '../analysis/abComparison'
import { chinaApartmentPlan } from '../mockups/chinaApartment'

describe('signed heat comparison', () => {
  for (const outsideC of [5, 40]) {
    it(`reports signed thermal differences without a better/worse grade at ${outsideC}°C`, () => {
      const baseline = { ...chinaApartmentPlan, systems: { ...chinaApartmentPlan.systems, insulation: false } }
      const proposed = { ...chinaApartmentPlan, systems: { ...chinaApartmentPlan.systems, insulation: true } }
      const result = comparePlans(baseline, proposed, { label: 'Selected night conditions', sunAzimuth: 180, sunAltitude: -20, outsideC, windFrom: 180, windSpeed: 0 })
      expect(result.delta.netHeatWatts).not.toBe(0)
      expect(result.baseline.netHeatWatts < 0).toBe(outsideC === 5)
      const html = renderToStaticMarkup(<ABComparisonModal result={result} baselineName="A" proposedName="B" onClose={() => {}} />)
      const thermal = html.slice(html.indexOf('Net Heat Flow (signed)'), html.indexOf('Avg Room Air Exchange'))
      expect(thermal).toContain('class="delta-neutral"')
      expect(thermal).not.toContain('delta-tag good')
      expect(thermal).not.toContain('delta-tag warn')
      expect(thermal).toContain(result.delta.netHeatWatts.toFixed(1))
      expect(html).toContain('negative heat flow leaves it')
    })
  }
})
