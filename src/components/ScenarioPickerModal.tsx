import { Check, Gauge, Play, Sun, SunDim, Wind, X } from 'lucide-react'
import { evaluateScenario, type ClimateScenario } from '../scenarios/climateScenarios'
import type { PlanState } from '../types'

const ICON_MAP = {
  Sun: Sun,
  SunDim: SunDim,
  Wind: Wind,
  Gauge,
}

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
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="scenario-modal" role="dialog" aria-modal="true" aria-labelledby="scenario-title" onClick={(event) => event.stopPropagation()}>
        <div className="scenario-modal-header">
          <div>
            <p className="eyebrow">What-if inputs · {locationLabel}</p>
            <h2 id="scenario-title">Test the same drawing in another condition</h2>
            <p>These are comparison inputs, not weather records or code simulations.</p>
          </div>
          <button type="button" className="icon-btn-close" onClick={onClose} aria-label="Close modal">
            <X />
          </button>
        </div>

        <div className="scenario-grid">
          {scenarios.map((scenario) => {
            const IconComp = ICON_MAP[scenario.icon as keyof typeof ICON_MAP] ?? Sun
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
                  <div className="scenario-icon-wrapper">
                    <IconComp />
                  </div>
                  <span className={`scenario-badge status-${evaluation.status.toLowerCase()}`}>
                    {evaluation.status}
                  </span>
                </div>

                <h3 className="scenario-title">{scenario.name}</h3>
                <div className="scenario-tagline">{scenario.tagline}</div>
                <p className="scenario-desc">{scenario.description}</p>

                <div className="scenario-headline">{evaluation.headline}</div>

                <div className="scenario-metrics">
                  {evaluation.metrics.map((m) => (
                    <div key={m.label} className="scenario-metric-item">
                      <span>{m.label}</span>
                      <strong>{m.value}</strong>
                    </div>
                  ))}
                </div>

                <div className="scenario-action-bar">
                  {isActive ? (
                    <span className="active-pill">
                      <Check />
                      Active
                    </span>
                  ) : (
                    <span className="run-scenario-btn"><Play /> Apply inputs</span>
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
