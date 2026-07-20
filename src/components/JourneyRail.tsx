import React from 'react'
import { Check } from 'lucide-react'
import type { EvaluatedStage } from '../journey/evaluateJourney'
import type { StageNav } from '../journey/stages'

export const JourneyRail = React.memo(function JourneyRail({
  stages,
  progress,
  headline,
  onGo,
}: {
  stages: EvaluatedStage[]
  progress: number
  headline: string
  onGo: (nav: StageNav, stageId: string) => void
}) {
  return (
    <div className="journey-rail-wrap">
      <div className="journey-progress" aria-hidden="true">
        <i style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <p className="journey-headline">{headline}</p>
      <div className="deliverable-rail journey-rail" aria-label="Design decision sequence" role="list">
        {stages.map((stage) => (
          <button
            key={stage.def.id}
            type="button"
            role="listitem"
            className={`journey-step is-${stage.status}${stage.complete ? ' is-complete' : ''}`}
            onClick={() => onGo(stage.def.nav, stage.def.id)}
            aria-current={stage.status === 'current' ? 'step' : undefined}
          >
            <small>
              {stage.complete ? <Check aria-hidden="true" /> : stage.def.step}
            </small>
            <span>
              {stage.def.label}
              <strong>{stage.metric}</strong>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
})
