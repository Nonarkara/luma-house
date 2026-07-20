import React from 'react'
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  CloudSun,
  Compass,
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
  ShieldCheck,
  Thermometer,
  Trash2,
  Upload,
  Wind,
  X,
  Zap,
} from 'lucide-react'
import { IconButton, Toggle } from './ui'
import { formatCurrency, roomAreaFor, siteOf } from '../plan'
import type { CarbonLine, SunPatch } from '../plan'
import {
  apartmentSystems,
  chinaAutomationRules as automationRules,
  chinaLightingChannels as lightingChannels,
  chinaLightingScenes as lightingScenes,
  customInteriorSchedule,
  hygieneChecks,
  preferenceChecks,
} from '../mockups/chinaApartment'
import { buildDesignBrief, type AnalysisResult, type Suggestion } from '../analysis'
import type { PlanState, PlanTool, Room, SiteSpec, WorkspaceMode } from '../types'
import type { InteriorBoq } from '../boq/interiorBoq'
import { SunChart } from '../canvas/SunChart'

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
  budget: { area: number; currency: string; subtotal: number; contingencyRate: number; total: number; items: { label: string; amount: number; quantity: number; unit: string; rate: number }[] }
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
  site: SiteSpec
  interior: InteriorBoq
  startBlank: () => void
  runTrace: (event: React.ChangeEvent<HTMLInputElement>) => void
  traceFileInputRef: React.RefObject<HTMLInputElement>
  isTracing: boolean
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
  site,
  interior,
  startBlank,
  runTrace,
  traceFileInputRef,
  isTracing,
}: InspectorProps) {
  const [lightingLevels, setLightingLevels] = React.useState<Record<string, number>>(() => ({ ...lightingScenes.Entertain }))
  const [activeLightingScene, setActiveLightingScene] = React.useState('Entertain')
  const importInputRef = React.useRef<HTMLInputElement>(null)

  if (!inspectorOpen) return null

  const directSunPercent = Math.round((100 * directSunM2) / Math.max(1, budget.area))
  const brief = buildDesignBrief(plan, climateResult, styleKeywords)
  const lat = locations[location as keyof typeof locations]?.latitude ?? 13.7563
  const locationLabel = locations[location as keyof typeof locations]?.label ?? location

  const calibrateField = (axis: 'w' | 'h', value: number) => {
    if (!Number.isFinite(value) || value <= 0) return
    commit((current) => {
      const currentSite = siteOf(current)
      const next = { ...currentSite, [axis]: Math.min(200, value) }
      return { ...current, site: { ...next, unit: Math.min(next.unit, next.w, next.h) } }
    })
  }

  const applyBriefItem = (id: 'insulation' | 'digital' | 'solar') => {
    commit((current) => ({
      ...current,
      systems: {
        ...current.systems,
        ...(id === 'insulation' ? { insulation: true } : {}),
        ...(id === 'digital' ? { lighting: true, climate: true } : {}),
        ...(id === 'solar' ? { solar: true } : {}),
      },
    }))
  }

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
                  ? 'Shanghai sun study'
                  : mode === 'wellbeing'
                    ? 'Living logic'
                    : mode === 'climate'
                      ? 'Advice & climate'
                      : mode === 'systems'
                        ? 'Intelligent space'
                        : 'Detailed fit-out BOQ'}
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
          <section className="scale-calibration">
            <div>
              <p className="eyebrow">One shared scale</p>
              <h3>Calibrate the drawing field</h3>
              <p>These dimensions drive the plan, furniture, 3D model, heat flow and quantities together.</p>
            </div>
            <div className="calibration-fields">
              <label>Width <span><input aria-label="Drawing field width in meters" type="number" min="1" max="200" step="0.1" value={site.w} onChange={(event) => calibrateField('w', Number(event.target.value))} /> m</span></label>
              <label>Depth <span><input aria-label="Drawing field depth in meters" type="number" min="1" max="200" step="0.1" value={site.h} onChange={(event) => calibrateField('h', Number(event.target.value))} /> m</span></label>
            </div>
          </section>
          <section className="upload-card">
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleSketch} hidden />
            {sketchUrl ? (
              <img src={sketchUrl} alt="Uploaded house plan sketch" />
            ) : (
              <div className="upload-icon"><ImagePlus /></div>
            )}
            <div>
              <h3>{sketchUrl ? 'Underlay active' : 'Upload a plan to trace'}</h3>
              <p>Upload an existing plan photo and let AI read the rooms — or use it as a manual tracing underlay.</p>
            </div>
            <input ref={traceFileInputRef} type="file" accept="image/*" onChange={runTrace} hidden />
            <button
              className="button primary full"
              type="button"
              onClick={() => traceFileInputRef.current?.click()}
              disabled={isTracing || quotaLeft <= 0}
            >
              {isTracing ? (<><RotateCcw className="spin" /> AI reading plan…</>) : (<><ImagePlus /> Trace with AI</>)}
            </button>
            <button className="button secondary full" type="button" onClick={() => fileInputRef.current?.click()}>
              <Upload /> Manual underlay
            </button>
            {sketchUrl && (
              <button className="text-button" type="button" onClick={() => setSketchUrl(null)}>
                Remove underlay
              </button>
            )}
            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
              <button className="text-button" type="button" onClick={startBlank} style={{ flex: 1 }}>Blank canvas</button>
              <button className="text-button" type="button" onClick={resetPlan} style={{ flex: 1 }}>Load sample</button>
            </div>
            <p className="legal-note" style={{ marginTop: 4 }}>AI trace is a draft — verify walls and openings before costing.</p>
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
                  Width <input aria-label="Room width in meters" type="number" value={((room.w / 100) * site.w).toFixed(1)} min="0.5" max={site.w} step="0.1" onChange={(event) => updateRoom({ w: (Number(event.target.value) / site.w) * 100 })} /><span>m</span>
                </label>
                <label className="field-label">
                  Depth <input aria-label="Room depth in meters" type="number" value={((room.h / 100) * site.h).toFixed(1)} min="0.5" max={site.h} step="0.1" onChange={(event) => updateRoom({ h: (Number(event.target.value) / site.h) * 100 })} /><span>m</span>
                </label>
              </div>
              <div className="room-stat">
                <span>Internal area</span><strong>{roomAreaFor(room, site).toFixed(1)} m²</strong>
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
          <SunChart latitude={lat} day={day} hour={hour} locationLabel={locationLabel} />
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
            <div className="season-buttons" aria-label="Season presets">
              <button type="button" className={day === 355 ? 'active' : ''} onClick={() => setDay(355)}>Winter solstice</button>
              <button type="button" className={day === 80 ? 'active' : ''} onClick={() => setDay(80)}>Equinox</button>
              <button type="button" className={day === 172 ? 'active' : ''} onClick={() => setDay(172)}>Summer solstice</button>
            </div>
            <label className="range-label">
              <span><strong>Day of year</strong><b>{day}</b></span>
              <input type="range" min="1" max="365" value={day} onChange={(event) => setDay(Number(event.target.value))} />
            </label>
          </section>
          <section className="panel-section lighting-schedule">
            <div className="section-title">
              <div><p className="eyebrow">Control schedule</p><h3>Six lighting channels</h3></div>
              <span className="badge">{lightingChannels.reduce((sum, channel) => sum + channel.loadWatts, 0)} W</span>
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
          <p className="legal-note">Shanghai’s due-south planning reference window is 09:00–15:00. This interactive model is a design study; a formal sunlight report requires approved analysis software and local professional sign-off.</p>
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

      {!settingsOpen && mode === 'wellbeing' && (
        <div className="inspector-content">
          <section className="wellbeing-hero">
            <span><Compass /></span>
            <div>
              <p className="eyebrow">Resident preference overlay</p>
              <h3>South-facing, calm and legible</h3>
              <p>Feng Shui is treated here as a cultural and personal design brief—not as medical or building-science evidence.</p>
            </div>
          </section>

          <section className="panel-section check-schedule">
            <div className="section-title"><div><p className="eyebrow">Feng Shui brief</p><h3>Five preference checks</h3></div><span className="badge">5 / 5</span></div>
            {preferenceChecks.map((item) => (
              <article className="check-row" key={item.title}>
                <Check />
                <div><strong>{item.title}</strong><p>{item.detail}</p><small>{item.status}</small></div>
              </article>
            ))}
          </section>

          <section className="panel-section check-schedule hygiene-schedule">
            <div className="section-title"><div><p className="eyebrow">Hygiene engineering</p><h3>Five technical controls</h3></div><span className="badge">GB/T brief</span></div>
            {hygieneChecks.map((item) => (
              <article className="check-row" key={item.title}>
                <ShieldCheck />
                <div><strong>{item.title}</strong><p>{item.detail}</p></div>
              </article>
            ))}
          </section>

          <section className="panel-section interior-schedule">
            <div className="section-title"><div><p className="eyebrow">Made for this plan</p><h3>Custom interior schedule</h3></div><span className="badge">No flat-pack</span></div>
            {customInteriorSchedule.map((item) => (
              <article key={item.zone}>
                <span>{item.zone}</span>
                <div><strong>{item.element}</strong><p>{item.specification}</p></div>
              </article>
            ))}
          </section>

          <p className="legal-note">Cultural checks require discussion with the resident. Hygiene, ventilation, electrical and fire requirements require local professional verification.</p>
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

          <section className="design-brief">
            <p className="eyebrow">Design advice</p>
            <h3>{brief.headline}</h3>
            <p className="section-intro">{brief.summary}</p>
            <div className="brief-meta">
              <span>If you take the recommended stack: <strong>−{brief.projectedSavingsPct}%</strong> energy</span>
              <span>Concept score <strong>{climateResult.scores.overall}/100</strong></span>
            </div>
            {brief.items.map((item) => {
              const canApply = item.id === 'insulation' || item.id === 'digital' || item.id === 'solar'
              return (
                <article key={item.id} className={`brief-item ${item.active ? 'is-active' : ''} ${item.recommended ? 'is-recommended' : ''}`}>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.body}</p>
                    {item.energyDeltaPct > 0 && !item.active && <small>≈−{item.energyDeltaPct}% modeled energy</small>}
                  </div>
                  {!item.active && item.recommended && canApply && (
                    <button
                      type="button"
                      className="button primary small"
                      onClick={() => {
                        if (item.id === 'insulation' || item.id === 'digital' || item.id === 'solar') {
                          applyBriefItem(item.id)
                        }
                      }}
                    >
                      Add <ArrowRight />
                    </button>
                  )}
                  {item.active && <span className="brief-done"><Check /> On</span>}
                </article>
              )
            })}
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
              <strong>−{(plan.systems.solar ? 8 : 0) + (plan.systems.insulation ? 12 : 0) + (plan.systems.climate ? 13 : 0) + (plan.systems.lighting ? 7 : 0)}%</strong>
              <span>annual energy use</span>
            </div>
            <div className="energy-bars"><i /><i /><i /><i /><i /></div>
          </section>
          <p className="section-intro">Apartment-scale systems: clean air, low glare, local control and upgrades that do not assume ownership of the roof.</p>
          {([
            ['solar', Sun, 'Conditional solar share', '2.2 kWp common roof, subject to approval', '−8%'],
            ['insulation', Layers3, 'Glazing + air sealing', 'Secondary low-e panel + thermal curtains', '−12%'],
            ['climate', Wind, 'Clean-air climate', 'ERV filtration + two heat-pump zones', '−13%'],
            ['lighting', Lightbulb, 'Six-channel lighting', 'Presence, daylight and warm-dim scenes', '−7%'],
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
              <p>South solar access is managed with movable interior shading; filtration, air sealing and efficient equipment follow.</p>
            </div>
          </section>
          <section className="panel-section system-summary">
            <div className="section-title"><h3>Installed capacity</h3><span className="badge">Coordinated</span></div>
            <div className="system-metrics">
              <span><strong>2.2 kWp</strong><small>conditional roof share</small></span>
              <span><strong>150 m³/h</strong><small>filtered ERV</small></span>
              <span><strong>2 zones</strong><small>heat-pump</small></span>
              <span><strong>6</strong><small>DALI channels</small></span>
            </div>
          </section>
          <section className="panel-section apartment-system-list">
            <div className="section-title"><h3>Coordination schedule</h3><span className="badge">5 systems</span></div>
            {apartmentSystems.map((item) => (
              <div key={item.code}><span>{item.code}</span><p><strong>{item.title}</strong><small>{item.detail}</small></p></div>
            ))}
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
            <p className="eyebrow">{site.w.toFixed(1)} × {site.h.toFixed(1)} m site · {site.unit} m grid · ±15%</p>
            <strong>{formatCurrency(budget.total, budget.currency)}</strong>
            <span>{formatCurrency(budget.total / Math.max(1, budget.area), budget.currency)} / m² <b>incl. {Math.round(budget.contingencyRate * 100)}% contingency</b></span>
          </section>
          <section className="panel-section cost-list">
            <div className="section-title">
              <h3>Bill of quantities</h3>
              <span className="badge">Live</span>
            </div>
            {budget.items.map((item, index) => (
              <div className="cost-row" key={item.label}>
                <i style={{ width: `${(item.amount / Math.max(1, ...budget.items.map((entry) => entry.amount))) * 100}%` }} />
                <span><b>{String(index + 1).padStart(2, '0')}</b><span>{item.label}<small>{item.quantity.toFixed(item.unit === 'm²' ? 1 : 0)} {item.unit} × {formatCurrency(item.rate, budget.currency)}</small></span></span>
                <strong>{formatCurrency(item.amount, budget.currency)}</strong>
              </div>
            ))}
            <div className="cost-subtotal">
              <span>Subtotal</span><strong>{formatCurrency(budget.subtotal, budget.currency)}</strong>
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
          <section className="panel-section">
            <div className="section-title">
              <h3>Interior fit-out by room</h3>
              <span className="badge">{interior.categories.length} categories</span>
            </div>
            <p className="section-intro">Paints, tiles, skirting and openings costed from each room's measured area and wall height.</p>
            <div className="interior-boq">
              {interior.rooms.map((r) => (
                <div className="interior-boq-room" key={r.room.id}>
                  <div className="interior-boq-room-head">
                    <strong>{r.room.name}</strong>
                    <span>{r.floorM2.toFixed(1)} m² · {r.openings} openings</span>
                  </div>
                  {r.lines.map((line) => (
                    <div className="interior-boq-line" key={line.label}>
                      <span>{line.label}<small>{line.quantity.toFixed(line.unit === 'm²' ? 1 : 0)} {line.unit}</small></span>
                      <b>{formatCurrency(line.amount, 'THB')}</b>
                    </div>
                  ))}
                  <div className="interior-boq-line">
                    <span><strong style={{ color: '#fff' }}>Room subtotal</strong></span>
                    <b>{formatCurrency(r.subtotal, 'THB')}</b>
                  </div>
                </div>
              ))}
            </div>
            <div className="interior-boq-summary">
              <span>Interior fit-out total</span>
              <span>{formatCurrency(interior.total, 'THB')}</span>
            </div>
            <p className="legal-note">Per-room quantities are transparent; rates are concept-level and replaced by supplier quotes at tender.</p>
          </section>

          <section className="insight-card">
            <CircleDollarSign />
            <div>
              <strong>{budget.area.toFixed(1)} m² is the cost anchor</strong>
              <p>The BOQ is a renovation and fit-out estimate—not a new-build structure—and preserves the measured net floor area.</p>
              <button type="button" onClick={() => applyVariant(2)}>
                Compare work-from-home <ArrowRight />
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
              Design language feeds concept images. The detailed BOQ remains fixed to the authored Shanghai specification so visual adjectives cannot silently alter quantities.
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
