import {
  ArrowRight,
  Box,
  Check,
  ChevronDown,
  CircleDollarSign,
  CloudSun,
  Copy,
  DoorOpen,
  Download,
  Grid2X2,
  Home,
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
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent } from 'react'
import {
  calculateBudget,
  estimateEnergySavings,
  formatTHB,
  initialPlan,
  roomArea,
  solarPosition,
  variants,
} from './plan'
import type { CanvasView, Opening, PlanState, Room, RoomKind, WorkspaceMode } from './types'

const STORAGE_KEY = 'luma-house:river-courtyard'

const locations = {
  Bangkok: { latitude: 13.7563, label: 'Bangkok, TH' },
  'Chiang Mai': { latitude: 18.7883, label: 'Chiang Mai, TH' },
  Phuket: { latitude: 7.8804, label: 'Phuket, TH' },
  Singapore: { latitude: 1.3521, label: 'Singapore, SG' },
}

const modeItems: Array<{ id: WorkspaceMode; label: string; icon: typeof Home }> = [
  { id: 'plan', label: 'Plan', icon: Grid2X2 },
  { id: 'light', label: 'Light', icon: Sun },
  { id: 'systems', label: 'Systems', icon: Zap },
  { id: 'budget', label: 'Budget', icon: CircleDollarSign },
]

const roomColors: Record<RoomKind, string> = {
  living: '#e9e0cd',
  kitchen: '#d7dfce',
  bedroom: '#e4d9d3',
  bathroom: '#d9e2e0',
  studio: '#e8e4d6',
  terrace: '#dce8d1',
}

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

function FloorPlan({
  plan,
  selectedRoom,
  activeTool,
  sketchUrl,
  showSun,
  sunAngle,
  onRoomPointerDown,
  onRoomPointerMove,
  onRoomPointerUp,
  onCanvasClick,
}: {
  plan: PlanState
  selectedRoom: string | null
  activeTool: 'select' | 'window' | 'door'
  sketchUrl: string | null
  showSun: boolean
  sunAngle: number
  onRoomPointerDown: (event: PointerEvent<HTMLButtonElement>, room: Room) => void
  onRoomPointerMove: (event: PointerEvent<HTMLButtonElement>) => void
  onRoomPointerUp: (event: PointerEvent<HTMLButtonElement>) => void
  onCanvasClick: (event: React.MouseEvent<HTMLDivElement>) => void
}) {
  const rayX = Math.max(1, Math.min(99, 50 + 72 * Math.sin((sunAngle * Math.PI) / 180)))
  const rayY = Math.max(1, Math.min(99, 50 - 72 * Math.cos((sunAngle * Math.PI) / 180)))

  return (
    <div className={`plan-canvas tool-${activeTool}`} onClick={onCanvasClick} data-testid="plan-canvas">
      {sketchUrl && <img className="sketch-underlay" src={sketchUrl} alt="Uploaded sketch tracing layer" />}
      <div className="north-mark" aria-label="North points upward"><ArrowRight /> <span>N</span></div>
      <div className="scale-label">1:100 <span>•</span> 14 × 10 m site</div>
      {showSun && (
        <svg className="sun-overlay" viewBox="0 0 100 100" preserveAspectRatio="none" fill="none" aria-hidden="true">
          {[-18, -9, 0, 9, 18].map((offset) => (
            <line key={offset} x1={rayX + offset} y1={rayY} x2={50 + offset * .25} y2="50" stroke="#e2b53e" strokeOpacity=".48" strokeWidth=".55" vectorEffect="non-scaling-stroke" />
          ))}
          <circle cx={rayX} cy={rayY} r="2.3" fill="#f3c84a" />
        </svg>
      )}
      {plan.rooms.map((room) => (
        <button
          key={room.id}
          className={`room room-${room.kind} ${selectedRoom === room.id ? 'is-selected' : ''}`}
          style={{ left: `${room.x}%`, top: `${room.y}%`, width: `${room.w}%`, height: `${room.h}%`, background: roomColors[room.kind] }}
          onPointerDown={(event) => onRoomPointerDown(event, room)}
          onPointerMove={onRoomPointerMove}
          onPointerUp={onRoomPointerUp}
          onClick={(event) => event.stopPropagation()}
          aria-label={`${room.name}, ${roomArea(room).toFixed(1)} square meters`}
        >
          <span className="room-name">{room.name}</span>
          <span className="room-area">{roomArea(room).toFixed(1)} m²</span>
          {selectedRoom === room.id && <span className="resize-corner" aria-hidden="true" />}
        </button>
      ))}
      {plan.openings.map((opening) => (
        <span
          key={opening.id}
          className={`opening opening-${opening.type} rotate-${opening.rotation}`}
          style={{ left: `${opening.x}%`, top: `${opening.y}%` }}
          title={opening.type}
        >
          {opening.type === 'door' && <i />}
        </span>
      ))}
      <div className="dimension dimension-x"><span>14,000</span></div>
      <div className="dimension dimension-y"><span>10,000</span></div>
    </div>
  )
}

function SpatialView({ plan }: { plan: PlanState }) {
  return (
    <div className="spatial-scene" aria-label="Conceptual spatial view">
      <div className="spatial-sun"><Sun /></div>
      <div className="spatial-board">
        {plan.rooms.map((room) => (
          <div
            key={room.id}
            className={`spatial-room spatial-${room.kind}`}
            style={{ left: `${room.x}%`, top: `${room.y}%`, width: `${room.w}%`, height: `${room.h}%`, background: roomColors[room.kind] }}
          >
            <span>{room.name}</span>
          </div>
        ))}
      </div>
      <div className="spatial-note"><Box /> Concept massing • 1:100</div>
    </div>
  )
}

function App() {
  const [plan, setPlan] = useState<PlanState>(readSavedPlan)
  const [past, setPast] = useState<PlanState[]>([])
  const [future, setFuture] = useState<PlanState[]>([])
  const [mode, setMode] = useState<WorkspaceMode>('plan')
  const [view, setView] = useState<CanvasView>('plan')
  const [selectedRoom, setSelectedRoom] = useState<string | null>('living')
  const [activeTool, setActiveTool] = useState<'select' | 'window' | 'door'>('select')
  const [location, setLocation] = useState<keyof typeof locations>('Bangkok')
  const [hour, setHour] = useState(15)
  const [day, setDay] = useState(196)
  const [sketchUrl, setSketchUrl] = useState<string | null>(null)
  const [isTracing, setIsTracing] = useState(false)
  const [assistantText, setAssistantText] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [lastSaved, setLastSaved] = useState('Saved')
  const canvasRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{
    id: string
    startX: number
    startY: number
    roomX: number
    roomY: number
    snapshot: PlanState
  } | null>(null)

  const budget = useMemo(() => calculateBudget(plan), [plan])
  const sun = useMemo(() => solarPosition(locations[location].latitude, day, hour), [location, day, hour])
  const energySaving = estimateEnergySavings(plan.systems)
  const lightScore = Math.min(96, 48 + plan.openings.filter((item) => item.type === 'window').length * 7 + (plan.systems.lighting ? 6 : 0))
  const room = plan.rooms.find((item) => item.id === selectedRoom)

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

  const handleRoomPointerDown = (event: PointerEvent<HTMLButtonElement>, targetRoom: Room) => {
    event.stopPropagation()
    setSelectedRoom(targetRoom.id)
    if (activeTool !== 'select') return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      id: targetRoom.id,
      startX: event.clientX,
      startY: event.clientY,
      roomX: targetRoom.x,
      roomY: targetRoom.y,
      snapshot: plan,
    }
  }

  const handleRoomPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    const canvas = canvasRef.current
    if (!drag || !canvas) return
    const bounds = canvas.getBoundingClientRect()
    const dx = ((event.clientX - drag.startX) / bounds.width) * 100
    const dy = ((event.clientY - drag.startY) / bounds.height) * 100
    setPlan((current) => ({
      ...current,
      rooms: current.rooms.map((item) =>
        item.id === drag.id
          ? { ...item, x: Math.max(0, Math.min(100 - item.w, drag.roomX + dx)), y: Math.max(0, Math.min(100 - item.h, drag.roomY + dy)) }
          : item,
      ),
    }))
  }

  const handleRoomPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current
    if (!drag) return
    event.currentTarget.releasePointerCapture(event.pointerId)
    setPast((items) => [...items.slice(-29), drag.snapshot])
    setFuture([])
    dragRef.current = null
  }

  const handleCanvasClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool === 'select' || event.target !== event.currentTarget) {
      if (event.target === event.currentTarget) setSelectedRoom(null)
      return
    }
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width) * 100
    const y = ((event.clientY - bounds.top) / bounds.height) * 100
    const rotation: 0 | 90 = Math.min(y, 100 - y) < Math.min(x, 100 - x) ? 0 : 90
    const opening: Opening = { id: `${activeTool}-${Date.now()}`, type: activeTool, x, y, rotation }
    commit((current) => ({ ...current, openings: [...current.openings, opening] }))
    setActiveTool('select')
    setToast(`${activeTool === 'window' ? 'Window' : 'Door'} placed`)
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
      rooms: current.rooms.map((item) => item.id === selectedRoom ? { ...item, ...updates } : item),
    }))
  }

  const handleSketch = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setSketchUrl(String(reader.result))
      setToast('Sketch added as a tracing layer')
    }
    reader.readAsDataURL(file)
  }

  const traceSketch = () => {
    if (!sketchUrl) {
      fileInputRef.current?.click()
      return
    }
    setIsTracing(true)
    window.setTimeout(() => {
      commit((current) => ({ ...current, rooms: variants[0].rooms.map((item) => ({ ...item })) }))
      setIsTracing(false)
      setToast('Plan traced — verify scale before construction')
    }, 900)
  }

  const applyVariant = (index: number) => {
    commit((current) => ({ ...current, rooms: variants[index].rooms.map((item) => ({ ...item })) }))
    setToast(`${variants[index].name} applied`)
  }

  const runAssistant = () => {
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
    } else {
      setToast('Try “make the living room brighter” or “show my budget”')
    }
    setAssistantText('')
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

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <IconButton label="Open navigation" className="mobile-menu" onClick={() => setMobileNavOpen((open) => !open)}><Menu /></IconButton>
          <Logo />
          <span className="top-divider" />
          <button className="project-picker">
            <span><strong>River Courtyard House</strong><small>{lastSaved}</small></span>
            <ChevronDown />
          </button>
        </div>
        <div className="top-actions">
          <div className="collaborators"><span>NS</span><span>SS</span><b>+2</b></div>
          <button className="button secondary" onClick={() => navigator.clipboard?.writeText(window.location.href).then(() => setToast('Project link copied'))}><Copy /> Share</button>
          <button className="button primary" onClick={exportPlan}><Download /> Export</button>
        </div>
      </header>

      <div className="workspace">
        <nav className={`side-nav ${mobileNavOpen ? 'is-open' : ''}`} aria-label="Design stages">
          <div className="nav-primary">
            {modeItems.map((item) => {
              const Icon = item.icon
              return (
                <button key={item.id} className={mode === item.id ? 'active' : ''} onClick={() => { setMode(item.id); setMobileNavOpen(false) }}>
                  <Icon /><span>{item.label}</span>
                </button>
              )
            })}
          </div>
          <div className="nav-secondary">
            <button><Layers3 /><span>Library</span></button>
            <button><Settings2 /><span>Settings</span></button>
          </div>
        </nav>

        <main className="design-stage">
          <div className="stage-head">
            <div>
              <p className="eyebrow">Concept 03 <span>•</span> Residential</p>
              <h1>Design with light, not guesswork.</h1>
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
              <button className={view === 'plan' ? 'active' : ''} onClick={() => setView('plan')}>Plan</button>
              <button className={view === 'spatial' ? 'active' : ''} onClick={() => setView('spatial')}>Spatial</button>
            </div>
            <div className="tool-group history-tools">
              <IconButton label="Undo" onClick={undo} disabled={!past.length}><Undo2 /></IconButton>
              <IconButton label="Redo" onClick={redo} disabled={!future.length}><Redo2 /></IconButton>
            </div>
          </div>

          <section className="canvas-frame" ref={canvasRef} aria-label="House design canvas">
            {view === 'plan' ? (
              <FloorPlan
                plan={plan}
                selectedRoom={selectedRoom}
                activeTool={activeTool}
                sketchUrl={sketchUrl}
                showSun={mode === 'light'}
                sunAngle={sun.azimuth}
                onRoomPointerDown={handleRoomPointerDown}
                onRoomPointerMove={handleRoomPointerMove}
                onRoomPointerUp={handleRoomPointerUp}
                onCanvasClick={handleCanvasClick}
              />
            ) : <SpatialView plan={plan} />}
            {mode === 'light' && (
              <div className="sun-status">
                <Sun /><span><strong>{hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}</strong><small>{sun.altitude.toFixed(0)}° altitude • {sun.azimuth.toFixed(0)}° azimuth</small></span>
              </div>
            )}
            <div className="zoom-control"><button>−</button><span>100%</span><button>+</button></div>
          </section>

          <div className="assistant-bar">
            <div className="assistant-symbol"><Sparkles /></div>
            <input
              value={assistantText}
              onChange={(event) => setAssistantText(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && runAssistant()}
              placeholder="Ask Luma to change the plan…"
              aria-label="Ask Luma to change the plan"
            />
            <span className="assistant-example">Try “make the living room brighter”</span>
            <IconButton label="Send design request" onClick={runAssistant}><Send /></IconButton>
          </div>
        </main>

        <aside className="inspector">
          <div className="inspector-head">
            <div><p className="eyebrow">{mode}</p><h2>{mode === 'plan' ? 'Plan intelligence' : mode === 'light' ? 'Daylight study' : mode === 'systems' ? 'Intelligent space' : 'Live cost plan'}</h2></div>
            <IconButton label="Collapse inspector"><X /></IconButton>
          </div>

          {mode === 'plan' && (
            <div className="inspector-content">
              <section className="upload-card">
                <input ref={fileInputRef} type="file" accept="image/*" onChange={handleSketch} hidden />
                {sketchUrl ? <img src={sketchUrl} alt="Uploaded house plan sketch" /> : <div className="upload-icon"><ImagePlus /></div>}
                <div><h3>{sketchUrl ? 'Sketch ready to trace' : 'Start from a sketch'}</h3><p>Paper, photo, or rough plan. Luma uses it as a measured tracing layer.</p></div>
                <button className="button dark full" onClick={traceSketch}>{isTracing ? <><RotateCcw className="spin" /> Tracing…</> : <><Upload /> {sketchUrl ? 'Trace sketch' : 'Upload plan'}</>}</button>
                {sketchUrl && <button className="text-button" onClick={() => setSketchUrl(null)}>Remove tracing layer</button>}
              </section>

              {room && (
                <section className="panel-section">
                  <div className="section-title"><h3>Selected room</h3><IconButton label="Delete room" onClick={deleteRoom}><Trash2 /></IconButton></div>
                  <label className="field-label">Name<input value={room.name} onChange={(event) => updateRoom({ name: event.target.value })} /></label>
                  <div className="split-fields">
                    <label className="field-label">Width <input type="number" value={room.w} min="10" max="90" onChange={(event) => updateRoom({ w: Number(event.target.value) })} /><span>%</span></label>
                    <label className="field-label">Depth <input type="number" value={room.h} min="10" max="90" onChange={(event) => updateRoom({ h: Number(event.target.value) })} /><span>%</span></label>
                  </div>
                  <div className="room-stat"><span>Internal area</span><strong>{roomArea(room).toFixed(1)} m²</strong></div>
                </section>
              )}

              <section className="panel-section">
                <div className="section-title"><div><p className="eyebrow">Generated directions</p><h3>Three ways to live here</h3></div><Sparkles /></div>
                <div className="variant-list">
                  {variants.map((variant, index) => (
                    <button key={variant.name} onClick={() => applyVariant(index)}>
                      <span className={`variant-thumb variant-${index}`}><i /><i /><i /></span>
                      <span><strong>{variant.name}</strong><small>{variant.note}</small></span>
                      <ArrowRight />
                    </button>
                  ))}
                </div>
              </section>
            </div>
          )}

          {mode === 'light' && (
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
                <button className="button secondary full" onClick={() => setActiveTool('window')}><PanelLeftClose /> Place a window</button>
              </section>
            </div>
          )}

          {mode === 'systems' && (
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

          {mode === 'budget' && (
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
              <section className="insight-card"><CircleDollarSign /><div><strong>Compact plan saves ~฿640k</strong><p>Apply “Compact shade” to reduce envelope, structure, and conditioned area together.</p><button onClick={() => applyVariant(2)}>Apply direction <ArrowRight /></button></div></section>
              <button className="button dark full" onClick={exportPlan}><Download /> Export project + BOQ</button>
              <p className="legal-note">Concept estimate only. Local professionals must verify structure, code, quantities, and procurement before construction.</p>
            </div>
          )}
        </aside>
      </div>
      {toast && <div className="toast" role="status"><Check /> {toast}</div>}
    </div>
  )
}

export default App
