import { lazy, Suspense, useState } from 'react'
import type { PlanState } from '../types'
import type { StudioTheme } from '../design/themes'
import { MeasuredComparison } from './MeasuredComparison'
const Comparison3D = lazy(() => import('./Comparison3D'))

export function VisualComparison({ baseline, proposed, theme, sunAzimuth, sunAltitude, baselineLabel = 'Plan A', proposedLabel = 'Plan B' }: {
  baseline: PlanState; proposed: PlanState; theme: StudioTheme; sunAzimuth: number; sunAltitude: number; baselineLabel?: string; proposedLabel?: string
}) {
  const [mode, setMode] = useState<'plan' | '3d'>('plan')
  return <section className="visual-comparison" aria-label="Visual design comparison">
    <div className="comparison-view-controls" role="group" aria-label="Comparison representation"><button type="button" aria-pressed={mode === 'plan'} onClick={() => setMode('plan')}>Measured plans</button><button type="button" aria-pressed={mode === '3d'} onClick={() => setMode('3d')}>3D comparison</button></div>
    {mode === 'plan' ? <><MeasuredComparison baseline={baseline} proposed={proposed} baselineLabel={baselineLabel} proposedLabel={proposedLabel} /><p>Same metre scale and north-west origin. Numbers identify rooms in the key. Accent outlines mark changed furniture. Footprints use calibrated dimensions; walls assume 150 mm.</p></> : <Suspense fallback={<p role="status">Loading local 3D comparison…</p>}><Comparison3D baseline={baseline} proposed={proposed} theme={theme} sunAzimuth={sunAzimuth} sunAltitude={sunAltitude} baselineLabel={baselineLabel} proposedLabel={proposedLabel} /></Suspense>}
  </section>
}
