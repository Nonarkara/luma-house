import {
  ArrowRight,
  Check,
  ChevronDown,
  CircleDollarSign,
  CloudSun,
  Copy,
  DoorOpen,
  Download,
  Grid2X2,
  ImagePlus,
  Layers3,
  Lightbulb,
  MapPin,
  Menu,
  MousePointer2,
  PanelLeftClose,
  Plus,
  Redo2,
  RotateCcw,
  Ruler,
  Send,
  Settings2,
  Sparkles,
  Sun,
  Trash2,
  Undo2,
  Upload,
  Wind,
  X,
  Zap,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { FloorPlan } from './canvas/FloorPlan'
import { SpatialView } from './canvas/SpatialView'
import { useCanvasViewport } from './canvas/useCanvasViewport'
import { useRoomGestures } from './canvas/useRoomGestures'
import { generateConceptPhoto } from './concept/generateConcept'
import { getQuotaRemaining, getSavedConceptImages } from './concept/renderQuota'
import {
  calculateBudget,
  estimateEnergySavings,
  formatTHB,
  initialPlan,
  roomArea,
  solarPosition,
  variants,
} from './plan'
import type { CanvasView, PlanState, Room, WorkspaceMode } from './types'

const STORAGE_KEY = 'luma-house:river-courtyard'

const locations = {
  Bangkok: { latitude: 13.7563, label: 'Bangkok, TH' },
  'Chiang Mai': { latitude: 18.7883, label: 'Chiang Mai, TH' },
  Phuket: { latitude: 7.8804, label: 'Phuket, TH' },
  Singapore: { latitude: 1.3521, label: 'Singapore, SG' },
}

const modeItems: Array<{ id: WorkspaceMode; label: string; icon: typeof Grid2X2 }> = [
  { id: 'plan', label: 'Plan', icon: Grid2X2 },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'systems', label: 'Systems', icon: Zap },
  { id: 'budget', label: 'Budget', icon: CircleDollarSign },
]

function readSavedPlan(): PlanState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved ? (JSON.parse(saved) as PlanState) : initialPlan
  } catch {
    return initialPlan
  }
}

function Logo() {
  return (
    <div className="brand" aria-label="Luma House">
      <span className="brand-mark"><span /></span>
      <span>Luma<span className="brand-light">/house</span></span>
    </div>
  )
}

function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  className = '',
}: {
  label: string
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  className?: string
}) {
  return (
    <button className={`icon-button ${className}`} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      {children}
    </button>
  )
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <button className={`toggle ${checked ? 'is-on' : ''}`} role="switch" aria-checked={checked} aria-label={label} onClick={onChange}>
      <span />
    </button>
  )
}

function App() {
  const [plan, setPlan] = useState<PlanState>(readSavedPlan)
  const [past, setPast] = useState<PlanState[]>([])
  const [future, setFuture] = useState<PlanState[]>([])
  const [mode, setMode] = useState<WorkspaceMode>('plan')
  const [view, setView] = useState<CanvasView>('plan')
  const [selectedRoom, setSelectedRoom] = useState<string | null>('living')
  const [selectedOpening, setSelectedOpening] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<'select' | 'window' | 'door'>('select')
  const [location, setLocation] = useState<keyof typeof locations>('Bangkok')
  const [hour, setHour] = useState(15)
  const [day, setDay] = useState(196)
  const [sketchUrl, setSketchUrl] = useState<string | null>(null)
  const [assistantText, setAssistantText] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [inspectorOpen, setInspectorOpen] = useState(true)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [snapGrid, setSnapGrid] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [lastSaved, setLastSaved] = useState('Saved')
  const [conceptImages, setConceptImages] = useState<string[]>(() => getSavedConceptImages())
  const [quotaLeft, setQuotaLeft] = useState(() => getQuotaRemaining())
  const [isRendering, setIsRendering] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null!)
  const stageRef = useRef<HTMLDivElement>(null!)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const panMovedRef = useRef(false)

  const {
    viewport,
    zoomPercent,
    zoomIn,
    zoomOut,
    resetView,
    onWheel,
    onViewportPointerDown,
    onViewportPointerMove,
    onViewportPointerUp,
  } = useCanvasViewport(frameRef)

  const budget = useMemo(() => calculateBudget(plan), [plan])
  const sun = useMemo(() => solarPosition(locations[location].latitude, day, hour), [location, day, hour])
  const energySaving = estimateEnergySavings(plan.systems)
  const lightScore = Math.min(96, 48 + plan.openings.filter((item) => item.type === 'window').length * 7 + (plan.systems.lighting ? 6 : 0))
  const room = plan.rooms.find((item) => item.id === selectedRoom)

  const commitSnapshot = (snapshot: PlanState) => {
    setPast((items) => [...items.slice(-29), snapshot])
    setFuture([])
  }

  const {
    onRoomPointerDown,
    onOpeningPointerDown,
    onGesturePointerMove,
    onGesturePointerUp,
    placeOpeningAt,
    isGesturing,
  } = useRoomGestures({
    plan,
    setPlan,
    commitSnapshot,
    setSelectedRoom,
    setSelectedOpening,
    activeTool,
    snapGrid,
    stageRef,
  })

  useEffect(() => {
    setLastSaved('Saving…')
    const timeout = window.setTimeout(() => {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(plan))
      setLastSaved('Saved locally')
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [plan])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const commit = (next: PlanState | ((current: PlanState) => PlanState)) => {
    setPast((items) => [...items.slice(-29), plan])
    setPlan((current) => (typeof next === 'function' ? next(current) : next))
    setFuture([])
  }

  const undo = () => {
    const previous = past[past.length - 1]
    if (!previous) return
    setFuture((items) => [plan, ...items])
    setPlan(previous)
    setPast((items) => items.slice(0, -1))
  }

  const redo = () => {
    const next = future[0]
    if (!next) return
    setPast((items) => [...items, plan])
    setPlan(next)
    setFuture((items) => items.slice(1))
  }

  const handleCanvasPointerDown = (event: ReactPointerEvent) => {
    if (activeTool !== 'select') return
    const target = event.target as HTMLElement
    const isBackground =
      target === event.currentTarget ||
      target.classList.contains('plan-stage') ||
      target.classList.contains('plan-canvas') ||
      target.classList.contains('sketch-underlay') ||
      target.classList.contains('north-mark') ||
      target.classList.contains('scale-label') ||
      target.classList.contains('dimension') ||
      target.classList.contains('sun-overlay')
    if (!isBackground) return
    panMovedRef.current = false
    onViewportPointerDown(event)
  }

  const handleCanvasPointerMove = (event: ReactPointerEvent) => {
    onViewportPointerMove(event)
    if (Math.abs(event.movementX) + Math.abs(event.movementY) > 2) panMovedRef.current = true
  }

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (panMovedRef.current || isGesturing()) return
    if (activeTool === 'select') {
      if (event.target === event.currentTarget || (event.target as HTMLElement).classList.contains('plan-canvas')) {
        setSelectedRoom(null)
        setSelectedOpening(null)
      }
      return
    }
    const opening = placeOpeningAt(event.clientX, event.clientY)
    if (!opening) return
    commit((current) => ({ ...current, openings: [...current.openings, opening] }))
    setActiveTool('select')
    setToast(`${opening.type === 'window' ? 'Window' : 'Door'} placed`)
  }

  const addRoom = () => {
    const index = plan.rooms.length + 1
    const id = `room-${Date.now()}`
    commit((current) => ({
      ...current,
      rooms: [...current.rooms, { id, name: `Flexible room ${index}`, kind: 'studio', x: 30, y: 30, w: 25, h: 24 }],
    }))
    setSelectedRoom(id)
  }

  const deleteRoom = () => {
    if (!selectedRoom) return
    commit((current) => ({ ...current, rooms: current.rooms.filter((item) => item.id !== selectedRoom) }))
    setSelectedRoom(null)
  }

  const updateRoom = (updates: Partial<Room>) => {
    if (!selectedRoom) return
    commit((current) => ({
      ...current,
      rooms: current.rooms.map((item) => (item.id === selectedRoom ? { ...item, ...updates } : item)),
    }))
  }

  const handleSketch = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setSketchUrl(String(reader.result))
      setToast('Sketch added as underlay')
    }
    reader.readAsDataURL(file)
  }

  const applyVariant = (index: number) => {
    commit((current) => ({ ...current, rooms: variants[index].rooms.map((item) => ({ ...item })) }))
    setToast(`${variants[index].name} applied`)
  }

  const resetPlan = () => {
    commit(initialPlan)
    setSelectedRoom('living')
    setSelectedOpening(null)
    resetView()
    setToast('Plan reset to starting courtyard')
  }

  const runQuickAction = () => {
    const prompt = assistantText.trim().toLowerCase()
    if (!prompt) return
    if (prompt.includes('bright') || prompt.includes('window') || prompt.includes('light')) {
      commit((current) => ({
        ...current,
        openings: [...current.openings, { id: `w-${Date.now()}`, type: 'window', x: 36, y: 6, rotation: 0 }],
      }))
      setMode('light')
      setToast('Added a north window and opened the light study')
    } else if (prompt.includes('bedroom') || prompt.includes('room')) {
      addRoom()
      setToast('Added a flexible room to the plan')
    } else if (prompt.includes('cost') || prompt.includes('budget')) {
      setMode('budget')
      setToast('Opened the live cost plan')
    } else if (prompt.includes('energy') || prompt.includes('smart')) {
      setMode('systems')
      setToast('Opened intelligent systems')
    } else if (prompt.includes('photo') || prompt.includes('render') || prompt.includes('image')) {
      setView('spatial')
      void runConceptRender()
    } else {
      setToast('Quick actions: “brighter”, “add room”, “budget”, “energy”, or “concept photo”')
    }
    setAssistantText('')
  }

  const runConceptRender = async () => {
    if (isRendering) return
    if (quotaLeft <= 0) {
      setToast('Daily concept limit reached (3/day)')
      return
    }
    setIsRendering(true)
    setView('spatial')
    try {
      const result = await generateConceptPhoto({
        plan,
        locationLabel: locations[location].label,
        hour,
      })
      setConceptImages((items) => [result.imageDataUrl, ...items].slice(0, 12))
      setQuotaLeft(result.remaining)
      setToast(`Concept photo ready · ${result.remaining} left today`)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Concept render failed')
    } finally {
      setIsRendering(false)
    }
  }

  const exportPlan = () => {
    const blob = new Blob([JSON.stringify({ project: 'River Courtyard House', exportedAt: new Date().toISOString(), plan, budget }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'river-courtyard-house.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setToast('Project file exported')
  }

  const viewportStyle = {
    transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
    transformOrigin: 'center center',
  }

  return (
    <div className={`app-shell ${inspectorOpen ? '' : 'inspector-collapsed'}`}>
      <header className="topbar">
        <div className="topbar-left">
          <IconButton label="Open navigation" className="mobile-menu" onClick={() => setMobileNavOpen((open) => !open)}><Menu /></IconButton>
          <Logo />
          <span className="top-divider" />
          <button className="project-picker" type="button">
            <span><strong>River Courtyard House</strong><small>{lastSaved}</small></span>
            <ChevronDown />
          </button>
        </div>
        <div className="top-actions">
          <button className="button secondary" type="button" onClick={() => navigator.clipboard?.writeText(window.location.href).then(() => setToast('Project link copied'))}><Copy /> Share</button>
          <button className="button primary" type="button" onClick={exportPlan}><Download /> Export</button>
        </div>
      </header>

      <div className="workspace">
        <nav className={`side-nav ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Design stages">
          <div className="nav-primary">
            {modeItems.map((item) => {
              const Icon = item.icon
              return (
                <button key={item.id} type="button" className={mode === item.id ? 'active' : ''} onClick={() => { setMode(item.id); setMobileNavOpen(false); setSettingsOpen(false) }}>
                  <Icon /><span>{item.label}</span>
                </button>
              )
            })}
          </div>
          <div className="nav-secondary">
            <button type="button" className={settingsOpen ? 'active' : ''} onClick={() => { setSettingsOpen(true); setMobileNavOpen(false) }}>
              <Settings2 /><span>Settings</span>
            </button>
          </div>
        </nav>

        <main className="design-stage">
          <div className="stage-head">
            <div>
              <p className="eyebrow">Concept 03 <span>•</span> Residential</p>
              <h1>River Courtyard</h1>
            </div>
            <div className="stage-meta">
              <span><MapPin /> {locations[location].label}</span>
              <span><Ruler /> {budget.area.toFixed(1)} m²</span>
            </div>
          </div>

          <div className="canvas-toolbar" aria-label="Plan tools">
            <div className="tool-group">
              <IconButton label="Select and move" className={activeTool === 'select' ? 'active' : ''} onClick={() => setActiveTool('select')}><MousePointer2 /></IconButton>
              <IconButton label="Add room" onClick={addRoom}><Plus /></IconButton>
              <IconButton label="Place window" className={activeTool === 'window' ? 'active' : ''} onClick={() => setActiveTool('window')}><PanelLeftClose /></IconButton>
              <IconButton label="Place door" className={activeTool === 'door' ? 'active' : ''} onClick={() => setActiveTool('door')}><DoorOpen /></IconButton>
            </div>
            <div className="view-switch" role="group" aria-label="View mode">
              <button type="button" className={view === 'plan' ? 'active' : ''} onClick={() => setView('plan')}>Plan</button>
              <button type="button" className={view === 'spatial' ? 'active' : ''} onClick={() => setView('spatial')}>Spatial</button>
            </div>
            <div className="tool-group history-tools">
              <IconButton label="Undo" onClick={undo} disabled={!past.length}><Undo2 /></IconButton>
              <IconButton label="Redo" onClick={redo} disabled={!future.length}><Redo2 /></IconButton>
              <IconButton label="Concept photo" onClick={() => void runConceptRender()} disabled={isRendering || quotaLeft <= 0}><ImagePlus /></IconButton>
            </div>
          </div>

          <section className="canvas-frame" ref={frameRef} aria-label="House design canvas" onWheel={onWheel}>
            {view === 'plan' ? (
              <FloorPlan
                plan={plan}
                selectedRoom={selectedRoom}
                selectedOpening={selectedOpening}
                activeTool={activeTool}
                sketchUrl={sketchUrl}
                showSun={mode === 'light'}
                sunAngle={sun.azimuth}
                showGrid={showGrid}
                viewportStyle={viewportStyle}
                onRoomPointerDown={onRoomPointerDown}
                onOpeningPointerDown={onOpeningPointerDown}
                onGesturePointerMove={onGesturePointerMove}
                onGesturePointerUp={onGesturePointerUp}
                onCanvasPointerDown={handleCanvasPointerDown}
                onCanvasPointerMove={handleCanvasPointerMove}
                onCanvasPointerUp={onViewportPointerUp}
                onCanvasClick={handleCanvasClick}
                stageRef={stageRef}
              />
            ) : (
              <div className="spatial-wrap">
                <SpatialView plan={plan} />
                {(conceptImages.length > 0 || isRendering) && (
                  <div className="concept-strip" aria-live="polite">
                    {isRendering && <div className="concept-loading"><RotateCcw className="spin" /> Rendering concept…</div>}
                    {conceptImages.slice(0, 3).map((src, index) => (
                      <figure key={`${index}-${src.slice(0, 24)}`}>
                        <img src={src} alt={`Concept visualization ${index + 1}`} />
                        <figcaption>Concept only — not a photo of a real building</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </div>
            )}
            {mode === 'light' && view === 'plan' && (
              <div className="sun-status">
                <Sun /><span><strong>{hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}</strong><small>{sun.altitude.toFixed(0)}° altitude • {sun.azimuth.toFixed(0)}° azimuth</small></span>
              </div>
            )}
            {view === 'plan' && (
              <div className="zoom-control">
                <button type="button" onClick={zoomOut} aria-label="Zoom out">−</button>
                <button type="button" className="zoom-label" onClick={resetView} aria-label="Reset view">{zoomPercent}%</button>
                <button type="button" onClick={zoomIn} aria-label="Zoom in">+</button>
              </div>
            )}
          </section>

          <div className="assistant-bar">
            <div className="assistant-symbol"><Sparkles /></div>
            <input
              value={assistantText}
              onChange={(event) => setAssistantText(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && runQuickAction()}
              placeholder="Quick actions: brighter, add room, budget, concept photo…"
              aria-label="Quick plan actions"
            />
            <span className="assistant-example">Keyword shortcuts — not a live model</span>
            <IconButton label="Run quick action" onClick={runQuickAction}><Send /></IconButton>
          </div>
        </main>

        {inspectorOpen && (
          <aside className="inspector">
            <div className="inspector-head">
              <div>
                <p className="eyebrow">{settingsOpen ? 'workspace' : mode}</p>
                <h2>{settingsOpen ? 'Settings' : mode === 'plan' ? 'Plan intelligence' : mode === 'light' ? 'Daylight study' : mode === 'systems' ? 'Intelligent space' : 'Live cost plan'}</h2>
              </div>
              <IconButton label="Collapse inspector" onClick={() => setInspectorOpen(false)}><X /></IconButton>
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
                  <button className="button secondary full" type="button" onClick={resetPlan}><RotateCcw /> Reset plan</button>
                  <button className="button dark full" type="button" onClick={() => setSettingsOpen(false)}>Back to {mode}</button>
                </section>
              </div>
            )}

            {!settingsOpen && mode === 'plan' && (
              <div className="inspector-content">
                <section className="upload-card">
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleSketch} hidden />
                  {sketchUrl ? <img src={sketchUrl} alt="Uploaded house plan sketch" /> : <div className="upload-icon"><ImagePlus /></div>}
                  <div>
                    <h3>{sketchUrl ? 'Underlay active' : 'Start from a sketch'}</h3>
                    <p>Paper, photo, or rough plan. Shown as a tracing underlay — not auto-traced into walls.</p>
                  </div>
                  <button className="button dark full" type="button" onClick={() => fileInputRef.current?.click()}>
                    <Upload /> {sketchUrl ? 'Replace underlay' : 'Upload plan'}
                  </button>
                  {sketchUrl && <button className="text-button" type="button" onClick={() => setSketchUrl(null)}>Remove underlay</button>}
                </section>

                <section className="panel-section">
                  <div className="section-title"><h3>Concept photo</h3><span className="badge">{quotaLeft} left</span></div>
                  <p className="section-intro">Limited Gemini concept renders from this plan. Concept only — not a photograph of a real building.</p>
                  <button className="button primary full" type="button" onClick={() => void runConceptRender()} disabled={isRendering || quotaLeft <= 0}>
                    {isRendering ? <><RotateCcw className="spin" /> Rendering…</> : <><ImagePlus /> Generate concept</>}
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
                    <div className="section-title"><h3>Selected room</h3><IconButton label="Delete room" onClick={deleteRoom}><Trash2 /></IconButton></div>
                    <label className="field-label">Name<input value={room.name} onChange={(event) => updateRoom({ name: event.target.value })} /></label>
                    <div className="split-fields">
                      <label className="field-label">Width <input type="number" value={Math.round(room.w)} min="12" max="90" onChange={(event) => updateRoom({ w: Number(event.target.value) })} /><span>%</span></label>
                      <label className="field-label">Depth <input type="number" value={Math.round(room.h)} min="12" max="90" onChange={(event) => updateRoom({ h: Number(event.target.value) })} /><span>%</span></label>
                    </div>
                    <div className="room-stat"><span>Internal area</span><strong>{roomArea(room).toFixed(1)} m²</strong></div>
                  </section>
                )}

                <section className="panel-section">
                  <div className="section-title"><div><p className="eyebrow">Generated directions</p><h3>Three ways to live here</h3></div><Sparkles /></div>
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
                  <div className="score-ring" style={{ '--score': `${lightScore * 3.6}deg` } as React.CSSProperties}><strong>{lightScore}</strong><span>/ 100</span></div>
                  <div><p className="eyebrow">Daylight quality</p><h3>Warm, balanced light</h3><p>Good afternoon protection with useful north light.</p></div>
                </section>
                <section className="panel-section">
                  <label className="field-label">Project location
                    <select value={location} onChange={(event) => setLocation(event.target.value as keyof typeof locations)}>
                      {Object.keys(locations).map((item) => <option key={item}>{item}</option>)}
                    </select>
                  </label>
                  <label className="range-label"><span><strong>Time of day</strong><b>{hour}:00</b></span><input type="range" min="6" max="18" value={hour} onChange={(event) => setHour(Number(event.target.value))} /></label>
                  <label className="range-label"><span><strong>Day of year</strong><b>{day}</b></span><input type="range" min="1" max="365" value={day} onChange={(event) => setDay(Number(event.target.value))} /></label>
                </section>
                <section className="insight-card"><CloudSun /><div><strong>West terrace is doing its job</strong><p>At {hour}:00, the 2.8 m overhang protects the living space while the courtyard remains luminous.</p></div></section>
                <section className="panel-section">
                  <div className="section-title"><h3>Openings</h3><span className="badge">{plan.openings.length}</span></div>
                  <button className="button secondary full" type="button" onClick={() => setActiveTool('window')}><PanelLeftClose /> Place a window</button>
                </section>
              </div>
            )}

            {!settingsOpen && mode === 'systems' && (
              <div className="inspector-content">
                <section className="energy-hero">
                  <div><p className="eyebrow">Predicted reduction</p><strong>−{energySaving}%</strong><span>annual energy use</span></div>
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
                    <Toggle label={title} checked={plan.systems[key]} onChange={() => commit((current) => ({ ...current, systems: { ...current.systems, [key]: !current.systems[key] } }))} />
                  </section>
                ))}
                <section className="insight-card green"><Check /><div><strong>Passive before powered</strong><p>The current orientation and envelope remove most of the cooling load before equipment is added.</p></div></section>
              </div>
            )}

            {!settingsOpen && mode === 'budget' && (
              <div className="inspector-content">
                <section className="budget-hero">
                  <p className="eyebrow">Concept estimate • ±15%</p>
                  <strong>{formatTHB(budget.total)}</strong>
                  <span>{formatTHB(budget.total / budget.area)} / m² <b>incl. 10% contingency</b></span>
                </section>
                <section className="panel-section cost-list">
                  <div className="section-title"><h3>Bill of quantities</h3><span className="badge">Live</span></div>
                  {budget.items.map((item, index) => (
                    <div className="cost-row" key={item.label}>
                      <i style={{ width: `${(item.amount / Math.max(...budget.items.map((entry) => entry.amount))) * 100}%` }} />
                      <span><b>0{index + 1}</b>{item.label}</span><strong>{formatTHB(item.amount)}</strong>
                    </div>
                  ))}
                  <div className="cost-subtotal"><span>Subtotal</span><strong>{formatTHB(budget.subtotal)}</strong></div>
                </section>
                <section className="insight-card"><CircleDollarSign /><div><strong>Compact plan saves ~฿640k</strong><p>Apply “Compact shade” to reduce envelope, structure, and conditioned area together.</p><button type="button" onClick={() => applyVariant(2)}>Apply direction <ArrowRight /></button></div></section>
                <button className="button dark full" type="button" onClick={exportPlan}><Download /> Export project + BOQ</button>
                <p className="legal-note">Concept estimate only. Local professionals must verify structure, code, quantities, and procurement before construction.</p>
              </div>
            )}
          </aside>
        )}

        {!inspectorOpen && (
          <button className="inspector-reopen" type="button" onClick={() => setInspectorOpen(true)}>
            Plan panel
          </button>
        )}
      </div>
      {toast && <div className="toast" role="status"><Check /> {toast}</div>}
    </div>
  )
}

export default App
