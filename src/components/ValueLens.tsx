import React from 'react'
import { BrickWall, CircleHelp, Eye, Route, SunMedium, Wind, X } from 'lucide-react'
import type { HeatFlowSnapshot, RoomDaylightPotential, RoomEgressRoute, RoomWindPotential } from '../analysis'
import { formatCurrency } from '../plan'

export type ValueLensMode = 'off' | 'daylight' | 'shade' | 'air' | 'escape' | 'shell'

const LENSES: Array<{ id: Exclude<ValueLensMode, 'off'>; label: string; icon: typeof Eye }> = [
  { id: 'daylight', label: 'Windows', icon: Eye },
  { id: 'shade', label: 'Shade', icon: SunMedium },
  { id: 'air', label: 'Air', icon: Wind },
  { id: 'escape', label: 'Escape', icon: Route },
  { id: 'shell', label: 'Envelope', icon: BrickWall },
]

function watts(value: number): string {
  const absolute = Math.max(0, value)
  return absolute >= 1000 ? `${(absolute / 1000).toFixed(1)} kW` : `${Math.round(absolute)} W`
}

interface LensCopy {
  eyebrow: string
  metric: string
  unit: string
  verdict: string
  explanation: string
  experience: string
  technical: string
  expense: string
  worth: string
  confidence: string
  method: React.ReactNode
}

function copyForLens({
  active,
  daylight,
  wind,
  egress,
  currentHeat,
  baseHeat,
  upgradedHeat,
  directSunM2,
  currency,
  openingAllowance,
  envelopeAllowance,
}: {
  active: Exclude<ValueLensMode, 'off'>
  daylight: RoomDaylightPotential[]
  wind: RoomWindPotential[]
  egress: RoomEgressRoute[]
  currentHeat: HeatFlowSnapshot
  baseHeat: HeatFlowSnapshot
  upgradedHeat: HeatFlowSnapshot
  directSunM2: number
  currency: string
  openingAllowance: number
  envelopeAllowance: number
}): LensCopy {
  const rooms = Math.max(1, daylight.length)
  if (active === 'daylight') {
    const coverage = daylight.reduce((sum, item) => sum + item.planCoverage, 0) / rooms
    const withoutWindows = daylight.filter((item) => item.exteriorWindowCount === 0).length
    return {
      eyebrow: 'Window placement · indicative plan reach',
      metric: `${Math.round(coverage * 100)}`,
      unit: '% of room plan',
      verdict: withoutWindows === 0 ? 'Good early coverage' : `${withoutWindows} room${withoutWindows === 1 ? '' : 's'} without exterior daylight`,
      explanation: 'Amber bands show how far ordinary window light may reach. Move a window and the result updates immediately.',
      experience: 'Higher windows spread light deeper; balanced placement reduces the cave-like dark back of a room.',
      technical: 'Reach uses 1.5 × a 2.1 m window-head height, centered on a 1.6 m opening with an indicative lateral spread. It is not a lux or glare simulation.',
      expense: `Relocating a drawn opening has no modeled BOQ delta. One added-opening unit allowance is ${formatCurrency(openingAllowance, currency)}; structure and façade repair are excluded.`,
      worth: 'When the occupied zone gains useful reach without creating direct glare, privacy loss, or excess solar load.',
      confidence: 'Reference rule',
      method: <><p>Sampled plan area inside a conservative window-centered reach zone. Glass transmittance, obstructions, sky, finishes, reveal depth and exact window size are not yet modeled.</p><a href="https://eta-publications.lbl.gov/sites/default/files/tips-for-daylighting-2013.pdf" target="_blank" rel="noreferrer">LBNL · Tips for Daylighting</a></>,
    }
  }
  if (active === 'shade') {
    const avoided = currentHeat.solarW * 0.8
    return {
      eyebrow: 'External shade · current sun position',
      metric: watts(avoided),
      unit: 'direct solar avoided',
      verdict: currentHeat.solarW > 500 ? 'High leverage now' : 'Limited benefit at this hour',
      explanation: `${directSunM2.toFixed(1)} m² of floor is in direct sun. The comparison assumes external shade blocks 80% of the direct beam only.`,
      experience: 'Exterior shade keeps the view and daylight more usable when it stops the hot beam before the glass.',
      technical: 'Horizontal overhangs suit high sun; east and west low-angle sun often needs fins, screens or vegetation.',
      expense: 'Medium · simple fixed shade; higher for operable screens, controls and façade access.',
      worth: 'When high-use hours overlap the direct beam; compare several seasons before blocking useful winter sun.',
      confidence: 'Current-hour comparison',
      method: <><p>800 W/m² clear-sky beam × glass area × SHGC × incidence, then an explicit 80% external-shade comparison. Clouds and surrounding buildings are excluded.</p><a href="https://www.nrel.gov/research/re-passive-solar.html" target="_blank" rel="noreferrer">NREL · Passive solar control</a></>,
    }
  }
  if (active === 'air') {
    const through = wind.filter((item) => item.mode === 'through-flow')
    return {
      eyebrow: 'Wind orientation · ideal open-window case',
      metric: `${through.length}/${wind.length}`,
      unit: 'rooms with a pressure path',
      verdict: through.length >= Math.ceil(wind.length * 0.7) ? 'Strong plan potential' : 'Openings or transfer paths need work',
      explanation: through.length > 0 ? 'Arrows reveal which rooms have inlet-to-outlet pressure separation. Turn the wind direction to test whether the plan is resilient.' : 'No room has two usable openings with enough pressure separation for this wind.',
      experience: 'A real breeze needs an inlet, an outlet and a clear path between them—not simply more glass.',
      technical: 'Pressure difference follows ΔCp × ½ρV²; airflow uses a series-opening discharge model. A continuous modeled door path is required, with every door assumed fully open.',
      expense: `Re-aligning a drawn opening has no modeled BOQ delta. One added-opening unit allowance is ${formatCurrency(openingAllowance, currency)} before structure, security, rain and screen details.`,
      worth: 'When pressure paths survive multiple common wind directions and outdoor air is actually comfortable enough to use.',
      confidence: 'Concept airflow',
      method: <><p>Representative façade pressure coefficients, operable area and an orifice-flow equation. Terrain, gusts, screens, insect mesh and internal resistance need later validation.</p><a href="https://nvlpubs.nist.gov/nistpubs/gcr/2001/gcr01-820.pdf" target="_blank" rel="noreferrer">NIST · Natural ventilation</a></>,
    }
  }
  if (active === 'escape') {
    const connected = egress.filter((item) => item.connected)
    const longest = Math.max(0, ...connected.map((item) => item.distanceM ?? 0))
    return {
      eyebrow: 'Getting out · door graph',
      metric: `${connected.length}/${egress.length}`,
      unit: 'rooms connected outdoors',
      verdict: connected.length === egress.length ? 'Every room has a modeled route' : 'Broken route needs attention',
      explanation: connected.length > 0 ? `Longest drawn centerline is about ${longest.toFixed(1)} m. Hatched rooms do not reach an exterior door in the model.` : 'No continuous door path reaches an exterior door.',
      experience: 'A legible route supports everyday movement as well as emergency escape; avoid hidden turns and blocked door swings.',
      technical: 'This checks connectivity and approximate centerline length only—not fire separation, width, accessibility or smoke.',
      expense: `Moving a drawn door has no modeled BOQ delta. One added-opening unit allowance is ${formatCurrency(openingAllowance, currency)} before fire, structure and approval scope.`,
      worth: 'Always resolve broken connectivity early; route length alone cannot prove life-safety compliance.',
      confidence: 'Geometry only',
      method: <><p>Shortest graph path through modeled doors to a door on an exterior wall. It is deliberately not labeled code-compliant.</p><a href="https://www.gov.uk/government/publications/fire-safety-approved-document-b" target="_blank" rel="noreferrer">Example authority · Approved Document B</a></>,
    }
  }

  const baseTransmission = Math.abs(baseHeat.wallW + baseHeat.openingW)
  const upgradedTransmission = Math.abs(upgradedHeat.wallW + upgradedHeat.openingW)
  const avoided = Math.max(0, baseTransmission - upgradedTransmission)
  return {
    eyebrow: 'Better installation · same weather snapshot',
    metric: watts(avoided),
    unit: 'transmission avoided',
    verdict: avoided > 1000 ? 'High envelope leverage' : avoided > 250 ? 'Useful, verify constructability' : 'Small in this snapshot',
    explanation: `Baseline ${watts(baseTransmission)} versus upgraded ${watts(upgradedTransmission)} through walls and openings at ${currentHeat.outsideC}°C outside.`,
    experience: 'A continuous thermal and air layer improves surface comfort and quiet—not only the energy number.',
    technical: 'Compares wall U 2.10→0.45 W/m²K. The installed result depends on gaps, compression, thermal bridges and moisture detailing.',
    expense: `${formatCurrency(envelopeAllowance, currency)} concept allowance in this BOQ, including contingency. It is area-scaled, not a quote.`,
    worth: 'When the avoided transmission is meaningful across representative hot and cold snapshots and the assembly can be installed continuously.',
    confidence: 'Assembly comparison',
    method: <><p>Steady-state transmission is U × exposed area × temperature difference. Roof, floor, infiltration and thermal bridges are intentionally excluded.</p><a href="https://bsesc.energy.gov/energy-basics/building-envelope-building-science-intro-heat-flow" target="_blank" rel="noreferrer">DOE · Envelope heat flow</a></>,
  }
}

export const ValueLens = React.memo(function ValueLens({
  active,
  setActive,
  daylight,
  wind,
  egress,
  currentHeat,
  baseHeat,
  upgradedHeat,
  directSunM2,
  windFrom,
  setWindFrom,
  windSpeed,
  setWindSpeed,
  currency,
  openingAllowance,
  envelopeAllowance,
  envelopeApplied,
  onToggleEnvelope,
}: {
  active: ValueLensMode
  setActive: (mode: ValueLensMode) => void
  daylight: RoomDaylightPotential[]
  wind: RoomWindPotential[]
  egress: RoomEgressRoute[]
  currentHeat: HeatFlowSnapshot
  baseHeat: HeatFlowSnapshot
  upgradedHeat: HeatFlowSnapshot
  directSunM2: number
  windFrom: number
  setWindFrom: (degrees: number) => void
  windSpeed: number
  setWindSpeed: (speed: number) => void
  currency: string
  openingAllowance: number
  envelopeAllowance: number
  envelopeApplied: boolean
  onToggleEnvelope: () => void
}) {
  if (active === 'off') {
    return (
      <button className="value-lens-launch" type="button" onClick={() => setActive('daylight')}>
        <Eye />
        <span><small>Compare decisions</small><strong>Open value lens</strong></span>
      </button>
    )
  }

  const copy = copyForLens({ active, daylight, wind, egress, currentHeat, baseHeat, upgradedHeat, directSunM2, currency, openingAllowance, envelopeAllowance })

  return (
    <aside className="value-lens" aria-label="Design value lens">
      <header>
        <div><small>Value lens</small><strong>See the consequence on plan</strong></div>
        <button type="button" onClick={() => setActive('off')} aria-label="Close value lens"><X /></button>
      </header>
      <nav aria-label="Value lens layer">
        {LENSES.map(({ id, label, icon: Icon }) => (
          <button type="button" key={id} className={active === id ? 'active' : ''} onClick={() => setActive(id)}>
            <Icon /><span>{label}</span>
          </button>
        ))}
      </nav>
      <div className="value-lens-body">
        <p className="value-lens-eyebrow">{copy.eyebrow}</p>
        <div className="value-lens-result">
          <strong>{copy.metric}</strong>
          <span>{copy.unit}</span>
          <em>{copy.verdict}</em>
        </div>
        <p className="value-lens-explanation">{copy.explanation}</p>

        {active === 'shell' && (
          <button className="value-lens-apply" type="button" onClick={onToggleEnvelope}>
            {envelopeApplied ? 'Compare without upgrade' : 'Apply envelope upgrade'}
          </button>
        )}

        {active === 'air' && (
          <div className="wind-controls">
            <label>
              <span>Wind from</span>
              <input type="range" min="0" max="350" step="10" value={windFrom} onChange={(event) => setWindFrom(Number(event.target.value))} />
              <b>{windFrom}°</b>
            </label>
            <label>
              <span>Speed</span>
              <input type="range" min="0.5" max="8" step="0.5" value={windSpeed} onChange={(event) => setWindSpeed(Number(event.target.value))} />
              <b>{windSpeed.toFixed(1)} m/s</b>
            </label>
          </div>
        )}

        <dl className="value-lens-values">
          <div><dt>Worth it when</dt><dd>{copy.worth}</dd></div>
          <div><dt>Aesthetic + lived</dt><dd>{copy.experience}</dd></div>
          <div><dt>Technical</dt><dd>{copy.technical}</dd></div>
          <div><dt>Expense</dt><dd>{copy.expense}</dd></div>
        </dl>
        <details className="value-lens-method">
          <summary><CircleHelp /> Method <span>{copy.confidence}</span></summary>
          <div>{copy.method}</div>
        </details>
      </div>
    </aside>
  )
})
