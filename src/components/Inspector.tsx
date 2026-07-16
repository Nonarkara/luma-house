import React from 'react'
import {
  ArrowRight,
  Check,
  CircleDollarSign,
  CloudSun,
  Download,
  Grid2X2,
  ImagePlus,
  Layers3,
  Lightbulb,
  PanelLeftClose,
  RotateCcw,
  Sun,
  Trash2,
  Upload,
  Wind,
  X,
} from 'lucide-react'
import { IconButton, Toggle } from './ui'
import { formatTHB, roomArea } from '../plan'
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
  lightScore: number
  location: string
  setLocation: (loc: string) => void
  locations: Record<string, { label: string, latitude: number }>
  hour: number
  setHour: (hour: number) => void
  day: number
  setDay: (day: number) => void
  setActiveTool: (tool: PlanTool) => void
  budget: { area: number; subtotal: number; total: number; items: { label: string; amount: number }[] }
  exportPlan: () => void
  variants: Array<{ name: string; note: string; rooms: Room[] }>
  snapGrid: boolean
  setSnapGrid: React.Dispatch<React.SetStateAction<boolean>>
  showGrid: boolean
  setShowGrid: React.Dispatch<React.SetStateAction<boolean>>
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
  lightScore,
  location,
  setLocation,
  locations,
  hour,
  setHour,
  day,
  setDay,
  setActiveTool,
  budget,
  exportPlan,
  variants,
  snapGrid,
  setSnapGrid,
  showGrid,
  setShowGrid,
}: InspectorProps) {
  if (!inspectorOpen) return null

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
            <p className="section-intro">Limited Gemini concept renders from this plan. Concept only — not a photograph of a real building.</p>
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
            <div className="score-ring" style={{ '--score': `${lightScore * 3.6}deg` } as React.CSSProperties}>
              <strong>{lightScore}</strong><span>/ 100</span>
            </div>
            <div>
              <p className="eyebrow">Daylight quality</p>
              <h3>Warm, balanced light</h3>
              <p>Good afternoon protection with useful north light.</p>
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
          <section className="insight-card">
            <CloudSun />
            <div>
              <strong>West terrace is doing its job</strong>
              <p>At {hour}:00, the 2.8 m overhang protects the living space while the courtyard remains luminous.</p>
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

      {!settingsOpen && mode === 'systems' && (
        <div className="inspector-content">
          <section className="energy-hero">
            <div>
              <p className="eyebrow">Predicted reduction</p>
              <strong>−{Math.min(68, (plan.systems.solar ? 26 : 0) + (plan.systems.insulation ? 18 : 0) + (plan.systems.climate ? 13 : 0) + (plan.systems.lighting ? 7 : 0))}%</strong>
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
                <span><b>0{index + 1}</b>{item.label}</span>
                <strong>{formatTHB(item.amount)}</strong>
              </div>
            ))}
            <div className="cost-subtotal">
              <span>Subtotal</span><strong>{formatTHB(budget.subtotal)}</strong>
            </div>
          </section>
          <section className="insight-card">
            <CircleDollarSign />
            <div>
              <strong>Compact plan saves ~฿640k</strong>
              <p>Apply “Compact shade” to reduce envelope, structure, and conditioned area together.</p>
              <button type="button" onClick={() => applyVariant(2)}>
                Apply direction <ArrowRight />
              </button>
            </div>
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
