import React from 'react'
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  CloudSun,
  Download,
  Flame,
  Grid2X2,
  ImagePlus,
  Layers3,
  Leaf,
  Lightbulb,
  PanelLeftClose,
  RotateCcw,
  Sun,
  Thermometer,
  Trash2,
  Upload,
  Wind,
  X,
  Zap,
} from 'lucide-react'
import { IconButton, Toggle } from './ui'
import { estimateEnergySavings, formatTHB, roomArea } from '../plan'
import type { CarbonLine, SunPatch } from '../plan'
import { automationRules, lightingChannels, lightingScenes } from '../mockups/completeHouse'
import type { AnalysisResult, Suggestion } from '../analysis'
import type { PlanState, PlanTool, Room, WorkspaceMode } from '../types'

export interface InspectorProps {
  mode: WorkspaceMode
  settingsOpen: boolean
  setSettingsOpen: (open: boolean) => void
  inspectorOpen: boolean
  setInspectorOpen: (open: boolean) => void
  plan: PlanState
  commit: (next: PlanState | ((current: PlanState) => PlanState)) => void
  resetPlan: () => void
  sketchUrl: string | null
  setSketchUrl: (url: string | null) => void
  fileInputRef: React.RefObject<HTMLInputElement>
  handleSketch: (event: React.ChangeEvent<HTMLInputElement>) => void
  runConceptRender: () => void
  isRendering: boolean
  quotaLeft: number
  conceptImages: string[]
  room?: Room
  deleteRoom: () => void
  updateRoom: (updates: Partial<Room>) => void
  applyVariant: (index: number) => void
  patches: SunPatch[]
  directSunM2: number
  location: string
  setLocation: (loc: string) => void
  locations: Record<string, { label: string, latitude: number }>
  hour: number
  setHour: (hour: number) => void
  day: number
  setDay: (day: number) => void
  setActiveTool: (tool: PlanTool) => void
  budget: { area: number; subtotal: number; total: number; items: { label: string; amount: number; quantity: number; unit: string; rate: number }[] }
  carbon: { lines: CarbonLine[]; totalKg: number; kgPerM2: number }
  importProject: (event: React.ChangeEvent<HTMLInputElement>) => void
  exportPlan: () => void
  variants: Array<{ name: string; note: string; rooms: Room[] }>
  snapGrid: boolean
  setSnapGrid: React.Dispatch<React.SetStateAction<boolean>>
  showGrid: boolean
  setShowGrid: React.Dispatch<React.SetStateAction<boolean>>
  climateResult: AnalysisResult
  applySuggestion: (suggestion: Suggestion) => void
  styleKeywords: string
  setStyleKeywords: React.Dispatch<React.SetStateAction<string>>
}

export const Inspector = React.memo(function Inspector({
  mode,
  settingsOpen,
  setSettingsOpen,
  inspectorOpen,
  setInspectorOpen,
  plan,
  commit,
  resetPlan,
  sketchUrl,
  setSketchUrl,
  fileInputRef,
  handleSketch,
  runConceptRender,
  isRendering,
  quotaLeft,
  conceptImages,
  room,
  deleteRoom,
  updateRoom,
  applyVariant,
  patches,
  directSunM2,
  location,
  setLocation,
  locations,
  hour,
  setHour,
  day,
  setDay,
  setActiveTool,
  budget,
  carbon,
  importProject,
  exportPlan,
  variants,
  snapGrid,
  setSnapGrid,
  showGrid,
  setShowGrid,
  climateResult,
  applySuggestion,
  styleKeywords,
  setStyleKeywords,
}: InspectorProps) {
  const [lightingLevels, setLightingLevels] = React.useState<Record<string, number>>(() => ({ ...lightingScenes.Entertain }))
  const [activeLightingScene, setActiveLightingScene] = React.useState('Entertain')
  const importInputRef = React.useRef<HTMLInputElement>(null)

  if (!inspectorOpen) return null

  const directSunPercent = Math.round((100 * directSunM2) / Math.max(1, budget.area))

  return (
    <aside className="inspector">
      <div className="inspector-head">
        <div>
          <p className="eyebrow">{settingsOpen ? 'workspace' : mode}</p>
          <h2>
            {settingsOpen
              ? 'Settings'
              : mode === 'plan'
              ? 'Plan intelligence'
              : mode === 'light'
              ? 'Daylight study'
              : mode === 'climate'
              ? 'Climate performance'
              : mode === 'systems'
              ? 'Intelligent space'
              : 'Live cost plan'}
          </h2>
        </div>
        <IconButton label="Collapse inspector" onClick={() => setInspectorOpen(false)}>
          <X />
        </IconButton>
      </div>

      {settingsOpen && (
        <div className="inspector-content">
          <section className="panel-section" style={{ borderTop: 0, paddingTop: 0 }}>
            <div className="system-row">
              <span className="system-icon"><Grid2X2 /></span>
              <div><strong>Snap to grid</strong><small>1% steps while dragging</small></div>
              <span />
              <Toggle label="Snap to grid" checked={snapGrid} onChange={() => setSnapGrid((value) => !value)} />
            </div>
            <div className="system-row">
              <span className="system-icon"><Layers3 /></span>
              <div><strong>Show grid</strong><small>Site module lines</small></div>
              <span />
              <Toggle label="Show grid" checked={showGrid} onChange={() => setShowGrid((value) => !value)} />
            </div>
            <button className="button secondary full" type="button" onClick={resetPlan}>
              <RotateCcw /> Reset plan
            </button>
            <input ref={importInputRef} type="file" accept="application/json,.json" onChange={importProject} hidden />
            <button className="button secondary full" type="button" onClick={() => importInputRef.current?.click()}>
              <Upload /> Import project JSON
            </button>
            <button className="button dark full" type="button" onClick={() => setSettingsOpen(false)}>
              Back to {mode}
            </button>
          </section>
        </div>
      )}

      {!settingsOpen && mode === 'plan' && (
        <div className="inspector-content">
          <section className="upload-card">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleSketch} hidden />
            {sketchUrl ? (
              <img src={sketchUrl} alt="Uploaded house plan sketch" />
            ) : (
              <div className="upload-icon"><ImagePlus /></div>
            )}
            <div>
              <h3>{sketchUrl ? 'Underlay active' : 'Start from a sketch'}</h3>
              <p>Paper, photo, or rough plan. Shown as a tracing underlay — not auto-traced into walls.</p>
            </div>
            <button className="button dark full" type="button" onClick={() => fileInputRef.current?.click()}>
              <Upload /> {sketchUrl ? 'Replace underlay' : 'Upload plan'}
            </button>
            {sketchUrl && (
              <button className="text-button" type="button" onClick={() => setSketchUrl(null)}>
                Remove underlay
              </button>
            )}
          </section>

          <section className="panel-section">
            <div className="section-title">
              <h3>Concept photo</h3>
              <span className="badge">{quotaLeft} left</span>
            </div>
            <p className="section-intro">Style keywords feed the concept render and the live finish estimate below.</p>
            <label className="field-label" style={{ marginBottom: 12 }}>
              Style & interior keywords
              <input
                type="text"
                placeholder="e.g. cozy tropical cabin, warm wood, minimalist"
                value={styleKeywords}
                onChange={(e) => setStyleKeywords(e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
              />
            </label>
            <button
              className="button primary full"
              type="button"
              onClick={() => runConceptRender()}
              disabled={isRendering || quotaLeft <= 0}
            >
              {isRendering ? (
                <><RotateCcw className="spin" /> Rendering…</>
              ) : (
                <><ImagePlus /> Generate concept</>
              )}
            </button>
            {conceptImages[0] && (
              <figure className="concept-preview">
                <img src={conceptImages[0]} alt="Latest concept visualization" />
                <figcaption>Latest concept · {conceptImages.length} saved today</figcaption>
              </figure>
            )}
          </section>

          {room && (
            <section className="panel-section">
              <div className="section-title">
                <h3>Selected room</h3>
                <IconButton label="Delete room" onClick={deleteRoom}><Trash2 /></IconButton>
              </div>
              <label className="field-label">
                Name
                <input value={room.name} onChange={(event) => updateRoom({ name: event.target.value })} />
              </label>
              <div className="split-fields">
                <label className="field-label">
                  Width <input type="number" value={Math.round(room.w)} min="12" max="90" onChange={(event) => updateRoom({ w: Number(event.target.value) })} /><span>%</span>
                </label>
                <label className="field-label">
                  Depth <input type="number" value={Math.round(room.h)} min="12" max="90" onChange={(event) => updateRoom({ h: Number(event.target.value) })} /><span>%</span>
                </label>
              </div>
              <div className="room-stat">
                <span>Internal area</span><strong>{roomArea(room).toFixed(1)} m²</strong>
              </div>
            </section>
          )}

          <section className="panel-section">
            <div className="section-title">
              <div>
                <p className="eyebrow">Generated directions</p>
                <h3>Three ways to live here</h3>
              </div>
            </div>
            <div className="variant-list">
              {variants.map((variant, index) => (
                <button key={variant.name} type="button" onClick={() => applyVariant(index)}>
                  <span className={`variant-thumb variant-${index}`}><i /><i /><i /></span>
                  <span><strong>{variant.name}</strong><small>{variant.note}</small></span>
                  <ArrowRight />
                </button>
              ))}
            </div>
          </section>
        </div>
      )}

      {!settingsOpen && mode === 'light' && (
        <div className="inspector-content">
          <section className="score-card light-card">
            <div className="score-ring" style={{ '--score': `${directSunPercent * 3.6}deg` } as React.CSSProperties}>
              <strong>{directSunPercent}</strong><span>% of floor</span>
            </div>
            <div>
              <p className="eyebrow">Direct sun now</p>
              <h3>≈ {directSunM2.toFixed(1)} m² in direct light</h3>
              <p>Estimated from {patches.length} window{patches.length === 1 ? '' : 's'} at this hour. Diffuse light not included.</p>
            </div>
          </section>
          <section className="panel-section">
            <label className="field-label">
              Project location
              <select value={location} onChange={(event) => setLocation(event.target.value)}>
                {Object.keys(locations).map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
            </label>
            <label className="range-label">
              <span><strong>Time of day</strong><b>{hour}:00</b></span>
              <input type="range" min="6" max="18" value={hour} onChange={(event) => setHour(Number(event.target.value))} />
            </label>
            <label className="range-label">
              <span><strong>Day of year</strong><b>{day}</b></span>
              <input type="range" min="1" max="365" value={day} onChange={(event) => setDay(Number(event.target.value))} />
            </label>
          </section>
          <section className="panel-section lighting-schedule">
            <div className="section-title">
              <div><p className="eyebrow">Control schedule</p><h3>Six lighting channels</h3></div>
              <span className="badge">204 W</span>
            </div>
            <div className="scene-buttons" aria-label="Lighting scenes">
              {Object.entries(lightingScenes).map(([scene, levels]) => (
                <button
                  key={scene}
                  type="button"
                  className={activeLightingScene === scene ? 'active' : ''}
                  onClick={() => { setActiveLightingScene(scene); setLightingLevels(levels) }}
                >
                  {scene}
                </button>
              ))}
            </div>
            <div className="channel-list">
              {lightingChannels.map((channel) => (
                <label key={channel.id} className="channel-row">
                  <span className="channel-code">{channel.circuit}</span>
                  <span><strong>{channel.name}</strong><small>{channel.zone} · {channel.loadWatts} W · {channel.control}</small></span>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={lightingLevels[channel.id] ?? 0}
                    onChange={(event) => { setActiveLightingScene('Custom'); setLightingLevels((levels) => ({ ...levels, [channel.id]: Number(event.target.value) })) }}
                    aria-label={`${channel.name} level`}
                  />
                  <b>{lightingLevels[channel.id] ?? 0}%</b>
                </label>
              ))}
            </div>
          </section>
          <section className="insight-card">
            <CloudSun />
            <div>
              {patches.length > 0 ? (
                <>
                  <strong>Sun reaches {new Set(patches.map((patch) => patch.roomId)).size} room(s)</strong>
                  <p>Drag windows or change the hour to move the light.</p>
                </>
              ) : (
                <>
                  <strong>No direct sun right now</strong>
                  <p>The sun is below the horizon or no window faces it. Try another hour.</p>
                </>
              )}
            </div>
          </section>
          <section className="panel-section">
            <div className="section-title">
              <h3>Openings</h3>
              <span className="badge">{plan.openings.length}</span>
            </div>
            <button className="button secondary full" type="button" onClick={() => setActiveTool('window')}>
              <PanelLeftClose /> Place a window
            </button>
          </section>
        </div>
      )}

      {!settingsOpen && mode === 'climate' && (
        <div className="inspector-content">
          <section className="score-card climate-card">
            <div className="climate-overall">
              <strong>{climateResult.scores.overall}</strong>
              <span>overall</span>
            </div>
            <div className="climate-scores">
              <div><Wind /><strong>{climateResult.scores.ventilation}</strong><span>Ventilation</span></div>
              <div><Sun /><strong>{climateResult.scores.solarGain}</strong><span>Solar balance</span></div>
              <div><Leaf /><strong>{climateResult.scores.shade}</strong><span>Shade</span></div>
            </div>
          </section>

          <p className="section-intro">
            Directional model from wall orientation, daily sun exposure, and cross-ventilation at{' '}
            <strong>{climateResult.location}</strong>. Annual overheating samples one day per month, 07:00–19:00.
            Not a substitute for EnergyPlus — but the hot room shows up fast.
          </p>

          <section className="panel-section">
            <div className="section-title"><h3>Room diagnostics</h3></div>
            {climateResult.rooms.map((rc) => {
              const sevLabel =
                rc.severity >= 3 ? 'Critical' : rc.severity === 2 ? 'Recommended' : rc.severity === 1 ? 'Nice-to-have' : 'Comfortable'
              const sevClass = rc.severity >= 3 ? 'sev-3' : rc.severity === 2 ? 'sev-2' : rc.severity === 1 ? 'sev-1' : 'sev-0'
              return (
                <div key={rc.room.id} className={`climate-room ${sevClass}`}>
                  <div className="climate-room-head">
                    <strong>{rc.room.name}</strong>
                    <span className={`sev-badge ${sevClass}`}>{sevLabel}</span>
                  </div>
                  <div className="climate-room-stats">
                    <span><Thermometer /> {rc.peakIndoorC.toFixed(0)}°C peak</span>
                    <span><Zap /> +{rc.deltaC.toFixed(1)}°C over outdoor</span>
                    <span><Wind /> {Math.round(rc.crossVentilation * 100)}% vent</span>
                    <span className={rc.overheatingHours > 0 ? 'overheat-stat' : ''}>
                      <Flame /> {rc.overheatingHours > 0 ? `${rc.overheatingHours} h/yr >30°C` : 'No overheating'}
                    </span>
                  </div>
                  <small>{rc.ventilationNote}</small>
                </div>
              )
            })}
          </section>

          <section className="panel-section">
            <div className="section-title">
              <h3>Suggestions</h3>
              <span className="badge">{climateResult.suggestions.length}</span>
            </div>
            {climateResult.suggestions.length === 0 && (
              <p className="section-intro">No critical issues detected — a solid passive starting point.</p>
            )}
            {climateResult.suggestions.map((suggestion, index) => {
              const icon =
                suggestion.kind === 'ventilation' ? <Wind /> :
                suggestion.kind === 'shading' ? <Sun /> :
                suggestion.kind === 'insulation' ? <Thermometer /> :
                suggestion.kind === 'orientation' ? <Leaf /> :
                <Lightbulb />
              const sevClass = suggestion.severity === 3 ? 'sev-3' : suggestion.severity === 2 ? 'sev-2' : 'sev-1'
              const roomName = suggestion.roomId ? plan.rooms.find((r) => r.id === suggestion.roomId)?.name : null
              return (
                <div key={`${suggestion.title}-${index}`} className={`suggestion-card ${sevClass}`}>
                  <span className="suggestion-icon">{icon}</span>
                  <div>
                    <strong>{suggestion.title}</strong>
                    <p>{suggestion.body}</p>
                    {roomName && <small>Room: {roomName}</small>}
                  </div>
                  {suggestion.action && (
                    <button type="button" className="button primary small" onClick={() => applySuggestion(suggestion)}>
                      Apply <ArrowRight />
                    </button>
                  )}
                </div>
              )
            })}
          </section>
        </div>
      )}

      {!settingsOpen && mode === 'systems' && (
        <div className="inspector-content">
          <section className="energy-hero">
            <div>
              <p className="eyebrow">Predicted reduction</p>
              <strong>−{estimateEnergySavings(plan.systems)}%</strong>
              <span>annual energy use</span>
            </div>
            <div className="energy-bars"><i /><i /><i /><i /><i /></div>
          </section>
          <p className="section-intro">Choose the systems worth making invisible. Optimization first; automation second.</p>
          {([
            ['solar', Sun, 'Solar production', '7.2 kWp roof array', '−26%'],
            ['insulation', Layers3, 'High-performance shell', 'Low-E glass + roof R-30', '−18%'],
            ['climate', Wind, 'Adaptive climate', 'Room-by-room comfort', '−13%'],
            ['lighting', Lightbulb, 'Circadian lighting', 'Presence + daylight aware', '−7%'],
          ] as const).map(([key, Icon, title, note, saving]) => (
            <section className="system-row" key={key}>
              <span className="system-icon"><Icon /></span>
              <div><strong>{title}</strong><small>{note}</small></div>
              <span className="saving">{saving}</span>
              <Toggle
                label={title}
                checked={plan.systems[key]}
                onChange={() =>
                  commit((current) => ({
                    ...current,
                    systems: { ...current.systems, [key]: !current.systems[key] },
                  }))
                }
              />
            </section>
          ))}
          <section className="insight-card green">
            <Check />
            <div>
              <strong>Passive before powered</strong>
              <p>The current orientation and envelope remove most of the cooling load before equipment is added.</p>
            </div>
          </section>
          <section className="panel-section system-summary">
            <div className="section-title"><h3>Installed capacity</h3><span className="badge">Coordinated</span></div>
            <div className="system-metrics">
              <span><strong>7.2 kWp</strong><small>solar array</small></span>
              <span><strong>13.5 kWh</strong><small>battery</small></span>
              <span><strong>3 zones</strong><small>heat-pump</small></span>
              <span><strong>6</strong><small>DALI channels</small></span>
            </div>
          </section>
          <section className="panel-section automation-list">
            <div className="section-title"><h3>Automation rules</h3><span className="badge">4 active</span></div>
            {automationRules.map((rule, index) => (
              <div className="automation-row" key={rule.name}>
                <span>0{index + 1}</span>
                <div><strong>{rule.name}</strong><small>{rule.trigger}</small><p>{rule.action}</p></div>
                <i />
              </div>
            ))}
          </section>
        </div>
      )}

      {!settingsOpen && mode === 'budget' && (
        <div className="inspector-content">
          <section className="budget-hero">
            <p className="eyebrow">Concept estimate • ±15%</p>
            <strong>{formatTHB(budget.total)}</strong>
            <span>{formatTHB(budget.total / Math.max(1, budget.area))} / m² <b>incl. 10% contingency</b></span>
          </section>
          <section className="panel-section cost-list">
            <div className="section-title">
              <h3>Bill of quantities</h3>
              <span className="badge">Live</span>
            </div>
            {budget.items.map((item, index) => (
              <div className="cost-row" key={item.label}>
                <i style={{ width: `${(item.amount / Math.max(1, ...budget.items.map((entry) => entry.amount))) * 100}%` }} />
                <span><b>{String(index + 1).padStart(2, '0')}</b><span>{item.label}<small>{item.quantity.toFixed(item.unit === 'm²' ? 1 : 0)} {item.unit} × {formatTHB(item.rate)}</small></span></span>
                <strong>{formatTHB(item.amount)}</strong>
              </div>
            ))}
            <div className="cost-subtotal">
              <span>Subtotal</span><strong>{formatTHB(budget.subtotal)}</strong>
            </div>
          </section>
          <section className="panel-section carbon-list">
            <div className="section-title">
              <h3>Embodied carbon</h3>
              <span className="badge carbon-badge">{(carbon.totalKg / 1000).toFixed(1)} t CO₂e</span>
            </div>
            {carbon.lines.map((line) => (
              <div className="carbon-row" key={line.label}>
                <span>{line.label}<small>{line.basis}</small></span>
                <strong>{line.kgCO2e >= 1000 ? `${(line.kgCO2e / 1000).toFixed(1)} t` : `${Math.round(line.kgCO2e)} kg`}</strong>
              </div>
            ))}
            <div className="cost-subtotal">
              <span>Per m² of floor</span><strong>{Math.round(carbon.kgPerM2)} kg CO₂e</strong>
            </div>
            <p className="legal-note">Concept-level factors in the spirit of the ICE Database. Product-specific EPDs replace these at tender.</p>
          </section>
          <section className="insight-card">
            <CircleDollarSign />
            <div>
              <strong>100 m² is the cost anchor</strong>
              <p>Every authored direction preserves the same measured area, so cost changes reflect specification—not hidden floor growth.</p>
              <button type="button" onClick={() => applyVariant(2)}>
                Compare work-from-garden <ArrowRight />
              </button>
            </div>
          </section>
          
          <section className="panel-section">
            <label className="field-label">
              Style & finish keywords
              <input
                type="text"
                placeholder="e.g. luxury gold marble, minimalist cozy"
                value={styleKeywords}
                onChange={(e) => setStyleKeywords(e.target.value)}
                style={{ width: '100%', marginTop: 4 }}
              />
            </label>
            <p className="legal-note" style={{ marginTop: 6, fontSize: '10.5px', lineHeight: '1.4' }}>
              Keywords like <strong>luxury</strong>, <strong>marble</strong>, or <strong>premium</strong> scale finishes up.
              <strong>Smart</strong> or <strong>digital</strong> scale automation.
              <strong>Minimalist</strong> or <strong>cozy</strong> scale finishes down.
            </p>
          </section>

          <button className="button dark full" type="button" onClick={exportPlan}>
            <Download /> Export project + BOQ
          </button>
          <p className="legal-note">Concept estimate only. Local professionals must verify structure, code, quantities, and procurement before construction.</p>
        </div>
      )}
    </aside>
  )
})
