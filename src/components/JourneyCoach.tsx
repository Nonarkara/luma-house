import React from 'react'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import type { CoachCopy } from '../journey/stages'

export const JourneyCoach = React.memo(function JourneyCoach({
  coach,
  onAction,
  onDismiss,
  dismissed,
}: {
  coach: CoachCopy
  onAction: () => void
  onDismiss: () => void
  dismissed: boolean
}) {
  if (dismissed) return null

  return (
    <aside className="journey-coach" aria-label="Next design decision">
      <div className="journey-coach-icon" aria-hidden="true">
        <Sparkles />
      </div>
      <div className="journey-coach-copy">
        <p className="eyebrow">{coach.why}</p>
        <strong>{coach.title}</strong>
        <p>{coach.body}</p>
      </div>
      <div className="journey-coach-actions">
        <button type="button" className="button primary" onClick={onAction}>
          {coach.cta} <ArrowRight />
        </button>
        <button type="button" className="journey-coach-dismiss" onClick={onDismiss} aria-label="Hide coach for now">
          <X />
        </button>
      </div>
    </aside>
  )
})
