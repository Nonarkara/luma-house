import { lazy, Suspense, useId, useLayoutEffect, useRef, useState } from 'react'
import type { PlanState } from '../types'
import type { StudioTheme } from '../design/themes'
import { MeasuredComparison } from './MeasuredComparison'
const Comparison3D = lazy(() => import('./Comparison3D'))

export function VisualComparison({ baseline, proposed, theme, sunAzimuth, sunAltitude, baselineLabel = 'Plan A', proposedLabel = 'Plan B' }: {
  baseline: PlanState; proposed: PlanState; theme: StudioTheme; sunAzimuth: number; sunAltitude: number; baselineLabel?: string; proposedLabel?: string
}) {
  const [mode, setMode] = useState<'plan' | '3d'>('plan')
  const content = useRef<HTMLDivElement>(null), reveal = useRef(false), id = useId()
  const choose = (next: 'plan' | '3d') => {
    if (next === mode) {
      content.current?.focus({ preventScroll: true })
      content.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
    } else { reveal.current = true; setMode(next) }
  }
  useLayoutEffect(() => {
    if (!reveal.current) return
    reveal.current = false
    content.current?.focus({ preventScroll: true })
    content.current?.scrollIntoView({ block: 'start', behavior: 'instant' })
  }, [mode])
  return <section className="visual-comparison" aria-label="Visual design comparison">
    <div className="comparison-view-controls" role="group" aria-label="Comparison representation"><button type="button" aria-pressed={mode === 'plan'} aria-controls={id} onClick={() => choose('plan')}>Measured plans</button><button type="button" aria-pressed={mode === '3d'} aria-controls={id} onClick={() => choose('3d')}>3D comparison</button></div>
    <div ref={content} id={id} tabIndex={-1} role="region" aria-label={mode === 'plan' ? 'Measured comparison preview' : '3D comparison preview'}>
    {mode === 'plan' ? <><MeasuredComparison baseline={baseline} proposed={proposed} baselineLabel={baselineLabel} proposedLabel={proposedLabel} /><p>Same metre scale and north-west origin. Numbers identify rooms in the key. Accent outlines mark changed furniture. Footprints use calibrated dimensions; walls assume 150 mm.</p></> : <Suspense fallback={<p role="status">Loading local 3D comparison…</p>}><Comparison3D baseline={baseline} proposed={proposed} theme={theme} sunAzimuth={sunAzimuth} sunAltitude={sunAltitude} baselineLabel={baselineLabel} proposedLabel={proposedLabel} /></Suspense>}
    </div>
  </section>
}
