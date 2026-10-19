import { useI18n } from '../i18n'
import { evaluateScenario, type ClimateScenario } from '../scenarios/climateScenarios'
import type { PlanState } from '../types'

export function ScenarioPickerModal({
  scenarios,
  activeScenarioId,
  plan,
  latitude,
  locationLabel,
  onSelectScenario,
  onClose,
}: {
  scenarios: ClimateScenario[]
  activeScenarioId: string | null
  plan: PlanState
  latitude: number
  locationLabel: string
  onSelectScenario: (scenario: ClimateScenario) => void
  onClose: () => void
}) {
  const { tr } = useI18n()
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="scenario-modal" role="dialog" aria-modal="true" aria-labelledby="scenario-title" onClick={(event) => event.stopPropagation()}>
        <div className="scenario-modal-header">
          <div>
            <p className="eyebrow">{tr('What-if inputs')} · {locationLabel}</p>
            <h2 id="scenario-title">{tr('Test the same drawing in another condition')}</h2>
            <p>{tr('These are comparison inputs, not weather records or code simulations.')}</p>
          </div>
          <button type="button" className="icon-btn-close" onClick={onClose} aria-label={tr('Close modal')}>
            {tr('Close')}
          </button>
        </div>

        <div className="scenario-grid">
          {scenarios.map((scenario) => {
            const isActive = scenario.id === activeScenarioId
            const evaluation = evaluateScenario(scenario, plan, latitude)

            return (
              <button
                type="button"
                key={scenario.id}
                className={`scenario-card ${isActive ? 'active' : ''}`}
                onClick={() => onSelectScenario(scenario)}
              >
                <div className="scenario-card-top">
                  <span className={`scenario-badge status-${evaluation.status.toLowerCase()}`}>
                    {tr(evaluation.status)}
                  </span>
                </div>

                <h3 className="scenario-title">{tr(scenario.name)}</h3>
                <div className="scenario-tagline">{tr(scenario.tagline)}</div>
                <p className="scenario-desc">{tr(scenario.description)}</p>

                <div className="scenario-headline">{tr(evaluation.headline)}</div>

                <div className="scenario-metrics">
                  {evaluation.metrics.map((m) => (
                    <div key={m.label} className="scenario-metric-item">
                      <span>{tr(m.label)}</span>
                      <strong>{m.value}</strong>
                    </div>
                  ))}
                </div>

                <div className="scenario-action-bar">
                  {isActive ? (
                    <span className="active-pill">{tr('Active')}</span>
                  ) : (
                    <span className="run-scenario-btn">{tr('Apply inputs')}</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </section>
    </div>
  )
}
