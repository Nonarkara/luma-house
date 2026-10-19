import React from 'react'
import type { EvaluatedStage } from '../journey/evaluateJourney'
import type { StageNav } from '../journey/stages'
import { useI18n } from '../i18n'

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
  const { tr } = useI18n()
  return (
    <div className="journey-rail-wrap">
      <div className="journey-progress" aria-hidden="true">
        <i style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <p className="journey-headline">{tr(headline)}</p>
      <div className="deliverable-rail journey-rail" aria-label={tr('Design decision sequence')} role="list">
        {stages.map((stage) => (
          <button
            key={stage.def.id}
            type="button"
            role="listitem"
            className={`journey-step is-${stage.status}${stage.complete ? ' is-complete' : ''}`}
            onClick={() => onGo(stage.def.nav, stage.def.id)}
            aria-current={stage.status === 'current' ? 'step' : undefined}
            title={`${tr(stage.def.label)}: ${tr(stage.metric)}`}
          >
            <span>
              {tr(stage.def.label)}
              <strong>{tr(stage.metric)}</strong>
            </span>
          </button>
        ))}
      </div>
    </div>
  )
})
