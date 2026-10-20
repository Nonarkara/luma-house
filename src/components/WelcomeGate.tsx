import React, { useLayoutEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import { WebAppAccess } from './WebAppAccess'
import { GuideIllustration } from './GuideIllustration'
import { GUIDE_STEPS } from './guideSteps'
import { chinaApartmentPlan } from '../mockups/chinaApartment'
import { siteOf, totalAreaFor } from '../plan'
import './assembly-guide.css'

/** The sample's own figures, computed from the plan — never typed in by hand,
 *  so the title block cannot drift away from the model it describes. */
function sampleFacts() {
  const plan = chinaApartmentPlan
  const site = siteOf(plan)
  const rooms = plan.rooms
  const minX = Math.min(...rooms.map(room => room.x))
  const minY = Math.min(...rooms.map(room => room.y))
  const maxX = Math.max(...rooms.map(room => room.x + room.w))
  const maxY = Math.max(...rooms.map(room => room.y + room.h))
  const envelopeW = (maxX - minX) / 100 * site.w
  const envelopeD = (maxY - minY) / 100 * site.h
  return {
    envelope: `${envelopeW.toFixed(2)} × ${envelopeD.toFixed(2)} m`,
    area: `${totalAreaFor(rooms, site).toFixed(1)} m²`,
    programme: [
      `${rooms.length} spaces`,
      `${plan.openings.filter(opening => opening.type === 'door').length} doors`,
      `${plan.openings.filter(opening => opening.type === 'window').length} windows`,
    ].join(' · '),
  }
}

export const WelcomeGate = React.memo(function WelcomeGate({
  open,
  onStart,
  onSkip,
  onContinue,
  hasDrawing = false,
}: {
  open: boolean
  onStart: () => void
  onSkip: () => void
  onContinue: () => void
  hasDrawing?: boolean
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useRef<HTMLHeadingElement>(null)
  const facts = useMemo(sampleFacts, [])
  useLayoutEffect(() => {
    if (!open) return
    const node = dialog.current
    if (node && !node.open) node.showModal()
    title.current?.focus()
    return () => { node?.close() }
  }, [open])
  if (!open) return null

  return createPortal(
    <dialog ref={dialog} className="assembly-guide welcome-gate" aria-labelledby="welcome-title" aria-describedby="guide-lead"
      onCancel={event => { event.preventDefault(); onContinue() }}>
      <main className="guide-sheet">
        <header className="guide-header">
          <span className="guide-mark" aria-hidden="true" />
          <img src="./brand/designon-wordmark.png" alt="designon" width="150" height="35" />
          <span className="guide-header-meta">Local-first · no account · Plan / Spatial / Renders</span>
          <button type="button" className="guide-print" onClick={() => window.print()}>Print this sheet <span aria-hidden="true">↗</span></button>
        </header>

        <section className="guide-hero">
          <div className="guide-lede">
            <p className="guide-eyebrow">A spatial study system</p>
            <h1 id="welcome-title" ref={title} tabIndex={-1}>A home, from the first line.</h1>
            <p id="guide-lead" className="guide-lead">
              Draw a plan on a napkin, give it one real measurement, then move the sun across your own
              floor. Every number here is meant to be argued with.
            </p>
            <p className="guide-keyline">
              <span className="guide-chip guide-chip--red">Draw</span>
              <span className="guide-chip guide-chip--blue">Measure</span>
              <span className="guide-chip guide-chip--yellow">Sun</span>
            </p>
          </div>

          <figure className="guide-frame">
            <span className="guide-tick guide-tick--tl" aria-hidden="true" />
            <span className="guide-tick guide-tick--tr" aria-hidden="true" />
            <span className="guide-tick guide-tick--bl" aria-hidden="true" />
            <span className="guide-tick guide-tick--br" aria-hidden="true" />
            <GuideIllustration />
            <figcaption className="guide-caption">
              <span>Fig. 01 · South Light 50 · axonometric</span>
              <span>Not to scale — dimensions taken from the plan</span>
            </figcaption>
          </figure>
        </section>

        {/* Title block: the sample's own figures, computed from the plan. */}
        <dl className="guide-spec">
          <div className="guide-spec-row"><dt>Sample</dt><dd>South Light 50 · 向阳之家</dd></div>
          <div className="guide-spec-row"><dt>Envelope</dt><dd>{facts.envelope}</dd></div>
          <div className="guide-spec-row"><dt>Net area</dt><dd>{facts.area}</dd></div>
          <div className="guide-spec-row"><dt>Programme</dt><dd>{facts.programme}</dd></div>
        </dl>

        <ol className="guide-instructions" aria-label="Four steps to your first home study">
          {GUIDE_STEPS.map(step => (
            <li key={step.n} className={`guide-step guide-step--${step.tone}`}>
              <span className="guide-num">{step.n}</span>
              <div><h2>{step.title}</h2><p>{step.body}</p></div>
            </li>
          ))}
        </ol>

        <footer className="guide-footer">
          <div className="guide-entry">
            {hasDrawing && <button type="button" className="guide-secondary" onClick={onContinue}>Continue your drawing <span aria-hidden="true">→</span></button>}
            <button type="button" className={hasDrawing ? 'guide-secondary' : 'guide-primary'} onClick={onStart}>Start from a blank page <span aria-hidden="true">→</span></button>
            <button type="button" className="guide-sample" onClick={onSkip}>Explore the 50 m² sample</button>
          </div>
          <p className="guide-storage">Drawings stay in this browser. Use Share to move one. 3D, sunlight and study sheets run locally; AI photo tracing is optional.</p>
          <div className="guide-smallprint">
            <WebAppAccess />
            <details>
              <summary>About this sheet</summary>
              <p>Original designon artwork, drawn from our own 50 m² sample. Layout and palette follow Bauhaus primary-colour discipline; the annotation register follows a technical drawing sheet. No third-party artwork. Concept studies help you compare decisions — confirm dimensions and construction details before building.</p>
            </details>
          </div>
        </footer>
      </main>
    </dialog>, document.body,
  )
})
