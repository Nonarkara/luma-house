import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Armchair, Check, DoorOpen, ImagePlus, MapPin, MousePointer2, PanelLeftClose, Pencil, Plus, Redo2, RotateCcw, RotateCw, Ruler, Sun, Trash2, Undo2 } from 'lucide-react'
import { FloorPlan } from './canvas/FloorPlan'
import { RenderGallery } from './canvas/RenderGallery'
import { useCanvasViewport } from './canvas/useCanvasViewport'
import { useRoomGestures } from './canvas/useRoomGestures'
import { clientToPercent, moveOpening, moveRoom, strokeToRoomRect, type StrokePoint } from './canvas/geometry'
import { generateConceptPhoto } from './concept/generateConcept'
import { getQuotaRemaining, getSavedConceptImages } from './concept/renderQuota'
import { SITE_HEIGHT_METERS, SITE_WIDTH_METERS, calculateBudget, estimateEmbodiedCarbon, furnitureCatalog, furnitureDoorConflicts, furnitureRect, roomArea, roomOverlaps, solarPosition, sunPatches, locations } from './plan'
import { COMPLETE_PROJECT_KEY, COMPLETE_PROJECT_LOCATION, COMPLETE_PROJECT_NAME, completeHousePlan, completeHouseVariants, lightingChannels } from './mockups/completeHouse'
import { buildShareUrl, decodePlanFromHash, sanitizePlan } from './sharePlan'
import { analyze } from './analysis'
import type { AnalysisResult, Suggestion } from './analysis'
import type { CanvasView, FurnitureKind, PlanState, PlanTool, Room, WorkspaceMode } from './types'
import { TopBar } from './components/TopBar'
import { SideNav } from './components/SideNav'
import { AssistantBar } from './components/AssistantBar'
import { Inspector } from './components/Inspector'
import { IconButton } from './components/ui'

const Spatial3D = lazy(() => import('./canvas/Spatial3D'))

function readSavedPlan(): PlanState {
  // Priority: share link in the URL hash, then the local draft, then the demo plan.
  if (typeof window !== 'undefined') {
    const shared = decodePlanFromHash(window.location.hash)
    if (shared) return shared
  }
  try {
    const saved = localStorage.getItem(COMPLETE_PROJECT_KEY)
    if (!saved) return completeHousePlan
    return sanitizePlan(JSON.parse(saved)) ?? completeHousePlan
  } catch {
    return completeHousePlan
  }
}

function App() {
  const [plan, setPlan] = useState<PlanState>(readSavedPlan)
  const [past, setPast] = useState<PlanState[]>([])
  const [future, setFuture] = useState<PlanState[]>([])
  const [mode, setMode] = useState<WorkspaceMode>('plan')
  const [view, setView] = useState<CanvasView>('plan')
  const [selectedRoom, setSelectedRoom] = useState<string | null>('living')
  const [selectedOpening, setSelectedOpening] = useState<string | null>(null)
  const [selectedFurniture, setSelectedFurniture] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<PlanTool>('select')
  const [furnitureTrayOpen, setFurnitureTrayOpen] = useState(false)
  const [draftStroke, setDraftStroke] = useState<StrokePoint[] | null>(null)
  const [location, setLocation] = useState<string>(COMPLETE_PROJECT_LOCATION)
  const [styleKeywords, setStyleKeywords] = useState<string>(() => localStorage.getItem('luma-style-keywords') || 'tropical modern, warm timber, light concrete, deep eaves')
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
  const drawPointerRef = useRef<number | null>(null)
  // Source of truth for the active stroke; draftStroke state only mirrors it for rendering.
  const strokePointsRef = useRef<StrokePoint[]>([])

  const {
    viewport,
    zoomPercent,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    resetView,
    onWheel,
    onViewportPointerDown,
    onViewportPointerMove,
    onViewportPointerUp,
  } = useCanvasViewport(frameRef)

  const budget = useMemo(() => calculateBudget(plan, styleKeywords), [plan, styleKeywords])
  const sun = useMemo(() => solarPosition(locations[location as keyof typeof locations].latitude, day, hour), [location, day, hour])
  const patches = useMemo(() => sunPatches(plan, sun.azimuth, sun.altitude), [plan, sun.azimuth, sun.altitude])
  const directSunM2 = Math.min(budget.area, patches.reduce((sum, patch) => sum + patch.areaM2, 0))
  const room = useMemo(() => plan.rooms.find((item) => item.id === selectedRoom), [plan.rooms, selectedRoom])
  const furnitureConflicts = useMemo(() => furnitureDoorConflicts(plan.furniture, plan.openings), [plan.furniture, plan.openings])
  const furnitureItem = useMemo(() => plan.furniture.find((item) => item.id === selectedFurniture), [plan.furniture, selectedFurniture])
  const climateResult = useMemo<AnalysisResult>(
    () => analyze({ plan, location: locations[location as keyof typeof locations] }),
    [plan, location],
  )
  const carbon = useMemo(() => estimateEmbodiedCarbon(plan), [plan])
  const overlaps = useMemo(() => roomOverlaps(plan.rooms), [plan.rooms])

  const commitSnapshot = useCallback((snapshot: PlanState) => {
    setPast((items) => [...items.slice(-29), snapshot])
    setFuture([])
  }, [])

  const {
    onRoomPointerDown,
    onOpeningPointerDown,
    onFurniturePointerDown,
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
    setSelectedFurniture,
    activeTool,
    snapGrid,
    stageRef,
  })

  useEffect(() => {
    setLastSaved('Saving…')
    const timeout = window.setTimeout(() => {
      localStorage.setItem(COMPLETE_PROJECT_KEY, JSON.stringify(plan))
      setLastSaved('Saved locally')
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [plan])

  useEffect(() => {
    localStorage.setItem('luma-style-keywords', styleKeywords)
  }, [styleKeywords])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const commit = useCallback((next: PlanState | ((current: PlanState) => PlanState)) => {
    setPast((items) => [...items.slice(-29), plan])
    setPlan((current) => (typeof next === 'function' ? next(current) : next))
    setFuture([])
  }, [plan])

  const undo = useCallback(() => {
    const previous = past[past.length - 1]
    if (!previous) return
    setFuture((items) => [plan, ...items])
    setPlan(previous)
    setPast((items) => items.slice(0, -1))
  }, [past, plan])

  const redo = useCallback(() => {
    const next = future[0]
    if (!next) return
    setPast((items) => [...items, plan])
    setPlan(next)
    setFuture((items) => items.slice(1))
  }, [future, plan])

  const handleCanvasPointerDown = useCallback((event: ReactPointerEvent) => {
    if (activeTool === 'draw') {
      if (drawPointerRef.current !== null) return
      const bounds = stageRef.current?.getBoundingClientRect()
      if (!bounds) return
      drawPointerRef.current = event.pointerId
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Synthetic pointers (tests) have no active pointer to capture.
      }
      strokePointsRef.current = [clientToPercent(event.clientX, event.clientY, bounds)]
      setDraftStroke(strokePointsRef.current)
      return
    }
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
  }, [activeTool, onViewportPointerDown])

  const handleCanvasPointerMove = useCallback((event: ReactPointerEvent) => {
    if (drawPointerRef.current === event.pointerId) {
      const bounds = stageRef.current?.getBoundingClientRect()
      if (!bounds) return
      strokePointsRef.current = [...strokePointsRef.current, clientToPercent(event.clientX, event.clientY, bounds)]
      setDraftStroke(strokePointsRef.current)
      return
    }
    onViewportPointerMove(event)
    if (Math.abs(event.movementX) + Math.abs(event.movementY) > 2) panMovedRef.current = true
  }, [onViewportPointerMove])

  const handleCanvasPointerUp = useCallback((event: ReactPointerEvent) => {
    if (drawPointerRef.current === event.pointerId) {
      drawPointerRef.current = null
      const rect = strokeToRoomRect(strokePointsRef.current)
      strokePointsRef.current = []
      setDraftStroke(null)
      if (!rect) {
        setToast('Sketch a rough room outline — it snaps to scale')
        return
      }
      const id = `room-${Date.now()}`
      const sketched: Room = { id, name: 'Sketched room', kind: 'studio', ...rect }
      commit((current) => ({ ...current, rooms: [...current.rooms, sketched] }))
      setSelectedRoom(id)
      setToast(`Room snapped to scale · ${roomArea(sketched).toFixed(1)} m²`)
      return
    }
    onViewportPointerUp(event)
  }, [commit, onViewportPointerUp])

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (panMovedRef.current || isGesturing()) return
    if (activeTool === 'draw') return
    if (activeTool === 'select') {
      if (event.target === event.currentTarget || (event.target as HTMLElement).classList.contains('plan-canvas')) {
        setSelectedRoom(null)
        setSelectedOpening(null)
        setSelectedFurniture(null)
      }
      return
    }
    const opening = placeOpeningAt(event.clientX, event.clientY)
    if (!opening) return
    commit((current) => ({ ...current, openings: [...current.openings, opening] }))
    setActiveTool('select')
    setToast(`${opening.type === 'window' ? 'Window' : 'Door'} placed`)
  }, [activeTool, commit, isGesturing, placeOpeningAt])

  const addRoom = useCallback(() => {
    const index = plan.rooms.length + 1
    const id = `room-${Date.now()}`
    commit((current) => ({
      ...current,
      rooms: [...current.rooms, { id, name: `Flexible room ${index}`, kind: 'studio', x: 30, y: 30, w: 25, h: 24 }],
    }))
    setSelectedRoom(id)
  }, [commit, plan.rooms.length])

  const deleteRoom = useCallback(() => {
    if (!selectedRoom) return
    commit((current) => ({ ...current, rooms: current.rooms.filter((item) => item.id !== selectedRoom) }))
    setSelectedRoom(null)
  }, [commit, selectedRoom])

  const updateRoom = useCallback((updates: Partial<Room>) => {
    if (!selectedRoom) return
    commit((current) => ({
      ...current,
      rooms: current.rooms.map((item) => (item.id === selectedRoom ? { ...item, ...updates } : item)),
    }))
  }, [commit, selectedRoom])

  const setWallHeight = useCallback((roomId: string, height: number) => {
    const rounded = Math.round(Math.min(4.5, Math.max(2.2, height)) * 20) / 20
    commit((current) => ({
      ...current,
      rooms: current.rooms.map((item) => (item.id === roomId ? { ...item, wallHeight: rounded } : item)),
    }))
  }, [commit])

  const addFurniture = useCallback((kind: FurnitureKind) => {
    const spec = furnitureCatalog[kind]
    const w = (spec.w / SITE_WIDTH_METERS) * 100
    const h = (spec.d / SITE_HEIGHT_METERS) * 100
    const id = `f-${Date.now()}`
    commit((current) => ({
      ...current,
      furniture: [...current.furniture, { id, kind, x: 50 - w / 2, y: 50 - h / 2, rotated: false }],
    }))
    setSelectedFurniture(id)
    setFurnitureTrayOpen(false)
    setToast(`${spec.label} placed at real size — drag it into a room`)
  }, [commit])

  const rotateFurniture = useCallback(() => {
    if (!selectedFurniture) return
    commit((current) => ({
      ...current,
      furniture: current.furniture.map((item) => {
        if (item.id !== selectedFurniture) return item
        const spec = furnitureCatalog[item.kind]
        const rotated = !item.rotated
        const w = ((rotated ? spec.d : spec.w) / SITE_WIDTH_METERS) * 100
        const h = ((rotated ? spec.w : spec.d) / SITE_HEIGHT_METERS) * 100
        return { ...item, rotated, x: Math.min(item.x, 100 - w), y: Math.min(item.y, 100 - h) }
      }),
    }))
  }, [commit, selectedFurniture])

  const deleteFurniture = useCallback(() => {
    if (!selectedFurniture) return
    commit((current) => ({ ...current, furniture: current.furniture.filter((item) => item.id !== selectedFurniture) }))
    setSelectedFurniture(null)
  }, [commit, selectedFurniture])

  const deleteOpening = useCallback(() => {
    if (!selectedOpening) return
    const kind = plan.openings.find((item) => item.id === selectedOpening)?.type ?? 'opening'
    commit((current) => ({ ...current, openings: current.openings.filter((item) => item.id !== selectedOpening) }))
    setSelectedOpening(null)
    setToast(`${kind === 'window' ? 'Window' : 'Door'} removed`)
  }, [commit, plan.openings, selectedOpening])

  const shareProject = useCallback(() => {
    const url = buildShareUrl(plan)
    window.history.replaceState(null, '', url)
    navigator.clipboard?.writeText(url).then(
      () => setToast('Link copied — it restores this exact plan'),
      () => setToast('Share link ready in the address bar'),
    )
  }, [plan])

  const importProject = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as unknown
        // Accept both raw plans and wrapped exports ({ plan, budget, … }).
        const candidate =
          typeof parsed === 'object' && parsed !== null && 'plan' in parsed
            ? (parsed as { plan: unknown }).plan
            : parsed
        const next = sanitizePlan(candidate)
        if (!next) {
          setToast('That file does not contain a valid Luma House plan')
          return
        }
        commit(next)
        setSelectedRoom(next.rooms[0].id)
        setSelectedOpening(null)
        setSelectedFurniture(null)
        setToast('Project imported')
      } catch {
        setToast('Could not read that project file')
      }
    }
    reader.readAsText(file)
  }, [commit])

  // Keyboard: Delete removes the selection, Ctrl/Cmd+Z history, Esc deselects,
  // arrows nudge. Inputs keep their native behavior.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return

      const meta = event.metaKey || event.ctrlKey
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
        return
      }
      if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault()
        redo()
        return
      }
      if (meta) return

      if (event.key === 'Escape') {
        setSelectedRoom(null)
        setSelectedOpening(null)
        setSelectedFurniture(null)
        setActiveTool('select')
        setFurnitureTrayOpen(false)
        return
      }
      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (selectedFurniture) { event.preventDefault(); deleteFurniture(); return }
        if (selectedOpening) { event.preventDefault(); deleteOpening(); return }
        if (selectedRoom) { event.preventDefault(); deleteRoom() }
        return
      }
      if (event.key.startsWith('Arrow')) {
        const step = event.shiftKey ? 5 : 1
        const dx = event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0
        const dy = event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0
        if (dx === 0 && dy === 0) return
        if (selectedRoom) {
          event.preventDefault()
          commit((current) => ({
            ...current,
            rooms: current.rooms.map((item) => (item.id === selectedRoom ? moveRoom(item, dx, dy, false) : item)),
          }))
        } else if (selectedOpening) {
          event.preventDefault()
          commit((current) => ({
            ...current,
            openings: current.openings.map((item) =>
              item.id === selectedOpening ? moveOpening(item, dx, dy, false, current.rooms) : item,
            ),
          }))
        } else if (selectedFurniture) {
          event.preventDefault()
          commit((current) => ({
            ...current,
            furniture: current.furniture.map((item) => {
              if (item.id !== selectedFurniture) return item
              const rect = furnitureRect(item)
              return {
                ...item,
                x: Math.max(0, Math.min(100 - rect.w, item.x + dx)),
                y: Math.max(0, Math.min(100 - rect.h, item.y + dy)),
              }
            }),
          }))
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [commit, deleteFurniture, deleteOpening, deleteRoom, redo, selectedFurniture, selectedOpening, selectedRoom, undo])

  const handleSketch = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setSketchUrl(String(reader.result))
      setToast('Sketch added as underlay')
    }
    reader.readAsDataURL(file)
  }, [])

  const applyVariant = useCallback((index: number) => {
    commit((current) => ({ ...current, rooms: completeHouseVariants[index].rooms.map((item) => ({ ...item })) }))
    setToast(`${completeHouseVariants[index].name} applied`)
  }, [commit])

  const applySuggestion = useCallback((suggestion: Suggestion) => {
    if (!suggestion.action || suggestion.action.type !== 'place-window') return
    const targetRoom = plan.rooms.find((r) => r.id === suggestion.roomId)
    if (!targetRoom) return
    const compass = suggestion.action.compass
    // Place a window at the midpoint of the target wall; E/W walls are vertical.
    const vertical = compass === 'W' || compass === 'E'
    const x = compass === 'W' ? targetRoom.x : compass === 'E' ? targetRoom.x + targetRoom.w : targetRoom.x + targetRoom.w / 2
    const y = compass === 'N' ? targetRoom.y : compass === 'S' ? targetRoom.y + targetRoom.h : targetRoom.y + targetRoom.h / 2
    const opening = { id: `w-${Date.now()}`, type: 'window' as const, x: Math.round(x), y: Math.round(y), rotation: (vertical ? 90 : 0) as 0 | 90 }
    commit((current) => ({ ...current, openings: [...current.openings, opening] }))
    setToast(`Window added — scores update live`)
  }, [commit, plan.rooms])

  const resetPlan = useCallback(() => {
    commit(completeHousePlan)
    setSelectedRoom('living')
    setSelectedOpening(null)
    resetView()
    setToast('Complete 100 m² house restored')
  }, [commit, resetView])

  const runConceptRender = useCallback(async () => {
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
        locationLabel: locations[location as keyof typeof locations].label,
        hour,
        styleKeywords,
      })
      setConceptImages((items) => [result.imageDataUrl, ...items].slice(0, 12))
      setQuotaLeft(result.remaining)
      setToast(`Concept photo ready · ${result.remaining} left today`)
    } catch (error) {
      setToast(error instanceof Error ? error.message : 'Concept render failed')
    } finally {
      setIsRendering(false)
    }
  }, [hour, isRendering, location, plan, quotaLeft, styleKeywords])

  const runQuickAction = useCallback(() => {
    const prompt = assistantText.trim().toLowerCase()
    if (!prompt) return
    if (prompt.includes('bright') || prompt.includes('window') || prompt.includes('light')) {
      // Put the window on the north wall of the selected (or largest) room so
      // the analysis actually credits it — a window off every wall is a lie.
      const target =
        plan.rooms.find((item) => item.id === selectedRoom) ??
        [...plan.rooms].sort((a, b) => roomArea(b) - roomArea(a))[0]
      if (!target) return
      commit((current) => ({
        ...current,
        openings: [
          ...current.openings,
          { id: `w-${Date.now()}`, type: 'window', x: Math.round(target.x + target.w / 2), y: Math.round(target.y), rotation: 0 },
        ],
      }))
      setMode('light')
      setToast(`North window added to ${target.name} — light study open`)
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
  }, [addRoom, assistantText, commit, plan.rooms, runConceptRender, selectedRoom])

  const exportPlan = useCallback(() => {
    const blob = new Blob([JSON.stringify({ project: COMPLETE_PROJECT_NAME, exportedAt: new Date().toISOString(), plan, budget, carbon, lightingChannels }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'lantern-courtyard-100.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setToast('Project file exported')
  }, [budget, carbon, plan])

  const viewportStyle = useMemo(() => ({
    transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
    transformOrigin: 'center center',
  }), [viewport.panX, viewport.panY, viewport.zoom])

  return (
    <div className={`app-shell ${inspectorOpen ? '' : 'inspector-collapsed'}`}>
      <TopBar
        projectName={COMPLETE_PROJECT_NAME}
        lastSaved={lastSaved}
        setMobileNavOpen={setMobileNavOpen}
        exportPlan={exportPlan}
        sharePlan={shareProject}
      />

      <div className="workspace">
        <SideNav 
          mode={mode} 
          setMode={setMode} 
          mobileNavOpen={mobileNavOpen} 
          setMobileNavOpen={setMobileNavOpen} 
          settingsOpen={settingsOpen} 
          setSettingsOpen={setSettingsOpen} 
        />

        <main className="design-stage">
          <div className="stage-head">
            <div>
              <p className="eyebrow">Complete house <span>•</span> 100 m² residential</p>
              <h1>{COMPLETE_PROJECT_NAME}</h1>
            </div>
            <div className="stage-meta">
              <span><MapPin /> {locations[location as keyof typeof locations].label}</span>
              <span><Ruler /> {budget.area.toFixed(1)} m²</span>
            </div>
          </div>

          <div className="deliverable-rail" aria-label="Design journey">
            <button type="button" className={mode === 'plan' && view === 'plan' ? 'active' : ''} onClick={() => { setInspectorOpen(true); setSettingsOpen(false); setMode('plan'); setView('plan'); setActiveTool('draw') }}><small>01</small><span>Draw<strong>{budget.area.toFixed(0)} m²</strong></span></button>
            <button type="button" className={view === 'spatial' ? 'active' : ''} onClick={() => { setInspectorOpen(true); setSettingsOpen(false); setMode('plan'); setView('spatial') }}><small>02</small><span>Model<strong>{plan.rooms.length} volumes</strong></span></button>
            <button type="button" className={mode === 'light' && view === 'plan' ? 'active' : ''} onClick={() => { setInspectorOpen(true); setSettingsOpen(false); setMode('light'); setView('plan') }}><small>03</small><span>Sun<strong>{sun.altitude.toFixed(0)}° now</strong></span></button>
            <button type="button" className={mode === 'climate' ? 'active' : ''} onClick={() => { setInspectorOpen(true); setSettingsOpen(false); setMode('climate'); setView('plan') }}><small>04</small><span>Advice<strong>{climateResult.scores.overall}/100</strong></span></button>
            <button type="button" className={mode === 'budget' ? 'active' : ''} onClick={() => { setInspectorOpen(true); setSettingsOpen(false); setMode('budget'); setView('plan') }}><small>05</small><span>Cost<strong>BOQ</strong></span></button>
            <button type="button" className={view === 'renders' ? 'active' : ''} onClick={() => { setSettingsOpen(false); setInspectorOpen(false); setView('renders') }}><small>06</small><span>Picture<strong>{conceptImages.length ? `${conceptImages.length} photo` : 'Massing'}</strong></span></button>
          </div>

          <div className="canvas-toolbar" aria-label="Plan tools">
            <div className="tool-group">
              <IconButton label="Select and move" className={activeTool === 'select' ? 'active' : ''} onClick={() => setActiveTool('select')}><MousePointer2 /></IconButton>
              <IconButton label="Sketch a room" className={activeTool === 'draw' ? 'active' : ''} onClick={() => setActiveTool(activeTool === 'draw' ? 'select' : 'draw')}><Pencil /></IconButton>
              <IconButton label="Add room" onClick={addRoom}><Plus /></IconButton>
              <IconButton label="Place window" className={activeTool === 'window' ? 'active' : ''} onClick={() => setActiveTool('window')}><PanelLeftClose /></IconButton>
              <IconButton label="Place door" className={activeTool === 'door' ? 'active' : ''} onClick={() => setActiveTool('door')}><DoorOpen /></IconButton>
              <IconButton label="Add furniture" className={furnitureTrayOpen ? 'active' : ''} onClick={() => setFurnitureTrayOpen((open) => !open)}><Armchair /></IconButton>
            </div>
            <div className="view-switch" role="group" aria-label="View mode">
              <button type="button" className={view === 'plan' ? 'active' : ''} onClick={() => setView('plan')}>Plan</button>
              <button type="button" className={view === 'spatial' ? 'active' : ''} onClick={() => setView('spatial')}>Spatial</button>
              <button type="button" className={view === 'renders' ? 'active' : ''} onClick={() => { setInspectorOpen(false); setView('renders') }}>Renders</button>
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
                selectedFurniture={selectedFurniture}
                furnitureConflicts={furnitureConflicts}
                overlaps={overlaps}
                draftStroke={draftStroke}
                activeTool={activeTool}
                sketchUrl={sketchUrl}
                showSun={mode === 'light'}
                sunAngle={sun.azimuth}
                sunPatchList={mode === 'light' ? patches : []}
                showGrid={showGrid}
                viewportStyle={viewportStyle}
                onRoomPointerDown={onRoomPointerDown}
                onOpeningPointerDown={onOpeningPointerDown}
                onFurniturePointerDown={onFurniturePointerDown}
                onGesturePointerMove={onGesturePointerMove}
                onGesturePointerUp={onGesturePointerUp}
                onCanvasPointerDown={handleCanvasPointerDown}
                onCanvasPointerMove={handleCanvasPointerMove}
                onCanvasPointerUp={handleCanvasPointerUp}
                onCanvasClick={handleCanvasClick}
                stageRef={stageRef}
              />
            ) : view === 'spatial' ? (
              <div className="spatial-wrap">
                <Suspense fallback={<div className="spatial-note">Loading 3D…</div>}>
                  <Spatial3D
                    plan={plan}
                    sunAzimuth={sun.azimuth}
                    sunAltitude={sun.altitude}
                    selectedRoom={selectedRoom}
                    onSelectRoom={setSelectedRoom}
                    onSetWallHeight={setWallHeight}
                  />
                </Suspense>
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
            ) : (
              <RenderGallery
                plan={plan}
                sun={sun}
                conceptImages={conceptImages}
                onRequestConcept={() => void runConceptRender()}
                isRendering={isRendering}
                quotaLeft={quotaLeft}
              />
            )}
            {mode === 'light' && view === 'plan' && (
              <div className="sun-status">
                <Sun /><span><strong>{hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? 'PM' : 'AM'}</strong><small>{sun.altitude.toFixed(0)}° altitude • {sun.azimuth.toFixed(0)}° azimuth</small></span>
              </div>
            )}
            {view === 'plan' && activeTool === 'draw' && !draftStroke && (
              <div className="draw-hint" role="status">
                <Pencil /> Draw a rough room with one finger — it snaps straight, to scale
              </div>
            )}
            {view === 'plan' && furnitureTrayOpen && (
              <div className="furniture-tray" aria-label="Add furniture at real size">
                {(Object.keys(furnitureCatalog) as FurnitureKind[]).map((kind) => (
                  <button key={kind} type="button" onClick={() => addFurniture(kind)}>
                    <strong>{furnitureCatalog[kind].label}</strong>
                    <small>{furnitureCatalog[kind].w} × {furnitureCatalog[kind].d} m</small>
                  </button>
                ))}
              </div>
            )}
            {view === 'plan' && furnitureItem && (
              <div className={`furniture-chip ${furnitureConflicts.has(furnitureItem.id) ? 'is-conflict' : ''}`} role="status">
                <span>
                  <strong>{furnitureCatalog[furnitureItem.kind].label}</strong>
                  <small>
                    {furnitureItem.rotated
                      ? `${furnitureCatalog[furnitureItem.kind].d} × ${furnitureCatalog[furnitureItem.kind].w} m`
                      : `${furnitureCatalog[furnitureItem.kind].w} × ${furnitureCatalog[furnitureItem.kind].d} m`}
                    {furnitureConflicts.has(furnitureItem.id) ? ' · blocks a door swing' : ''}
                  </small>
                </span>
                <IconButton label="Rotate furniture" onClick={rotateFurniture}><RotateCw /></IconButton>
                <IconButton label="Remove furniture" onClick={deleteFurniture}><Trash2 /></IconButton>
              </div>
            )}
            {view === 'plan' && selectedOpening && !furnitureItem && (
              <div className="furniture-chip" role="status">
                <span>
                  <strong>{plan.openings.find((item) => item.id === selectedOpening)?.type === 'door' ? 'Door' : 'Window'}</strong>
                  <small>Drag along the wall · Delete key removes</small>
                </span>
                <IconButton label="Remove opening" onClick={deleteOpening}><Trash2 /></IconButton>
              </div>
            )}
            {view === 'plan' && overlaps.size > 0 && (
              <div className="overlap-warning" role="alert">
                Rooms overlap — floor area is double-counted and climate analysis is unreliable
              </div>
            )}
            {view === 'plan' && (
              <div className="zoom-control">
                <button type="button" onClick={zoomOut} aria-label="Zoom out" disabled={!canZoomOut}>−</button>
                <button type="button" className="zoom-label" onClick={resetView} aria-label="Fit plan to view">{zoomPercent === 100 ? 'Fit' : `${zoomPercent}%`}</button>
                <button type="button" onClick={zoomIn} aria-label="Zoom in" disabled={!canZoomIn}>+</button>
              </div>
            )}
          </section>

          <AssistantBar 
            assistantText={assistantText} 
            setAssistantText={setAssistantText} 
            runQuickAction={runQuickAction} 
          />
        </main>

        <Inspector
          mode={mode}
          settingsOpen={settingsOpen}
          setSettingsOpen={setSettingsOpen}
          inspectorOpen={inspectorOpen}
          setInspectorOpen={setInspectorOpen}
          plan={plan}
          commit={commit}
          resetPlan={resetPlan}
          sketchUrl={sketchUrl}
          setSketchUrl={setSketchUrl}
          fileInputRef={fileInputRef}
          handleSketch={handleSketch}
          runConceptRender={runConceptRender}
          isRendering={isRendering}
          quotaLeft={quotaLeft}
          conceptImages={conceptImages}
          room={room}
          deleteRoom={deleteRoom}
          updateRoom={updateRoom}
          applyVariant={applyVariant}
          patches={patches}
          directSunM2={directSunM2}
          location={location}
          setLocation={setLocation}
          locations={locations}
          hour={hour}
          setHour={setHour}
          day={day}
          setDay={setDay}
          setActiveTool={setActiveTool}
          budget={budget}
          carbon={carbon}
          importProject={importProject}
          exportPlan={exportPlan}
          variants={completeHouseVariants}
          snapGrid={snapGrid}
          setSnapGrid={setSnapGrid}
          showGrid={showGrid}
          setShowGrid={setShowGrid}
          climateResult={climateResult}
          applySuggestion={applySuggestion}
          styleKeywords={styleKeywords}
          setStyleKeywords={setStyleKeywords}
        />

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
