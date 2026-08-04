import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { Armchair, Check, DoorOpen, ImagePlus, MapPin, MousePointer2, PanelLeftClose, Pencil, Plus, Redo2, RotateCcw, RotateCw, Ruler, Sun, Trash2, Undo2 } from 'lucide-react'
import { FloorPlan } from './canvas/FloorPlan'
import { RenderGallery } from './canvas/RenderGallery'
import { useCanvasViewport } from './canvas/useCanvasViewport'
import { useRoomGestures } from './canvas/useRoomGestures'
import { clientToPercent, moveOpening, moveRoom, strokeToRoomRect, type StrokePoint } from './canvas/geometry'
import { calibrateSiteFromNapkinLine, type NapkinCalibrationLine } from './canvas/napkinScale'
import { generateConceptPhoto } from './concept/generateConcept'
import { getQuotaRemaining, getSavedConceptImages } from './concept/renderQuota'
import { calibrateSiteFromRoom, defaultSite, furnitureCatalog, furnitureDoorConflicts, furnitureRectFor, roomAreaFor, roomOverlaps, siteOf, solarPosition, sunPatches, locations } from './plan'
import { interiorBoq } from './boq/interiorBoq'
import { tracePlanFromImage } from './concept/tracePlan'
import type { SiteSpec } from './types'

/** A truly blank plan — the napkin / tissue-paper starting point. */
function blankPlan(): PlanState {
  return {
    rooms: [],
    openings: [],
    furniture: [],
    systems: { solar: false, insulation: false, climate: false, lighting: false },
    site: defaultSite(),
  }
}
import {
  CHINA_PROJECT_KEY,
  CHINA_PROJECT_LOCATION,
  CHINA_PROJECT_NAME,
  calculateChinaApartmentBudget,
  chinaApartmentPlan,
  chinaApartmentVariants,
  chinaLightingChannels,
  estimateApartmentCarbon,
} from './mockups/chinaApartment'
import { buildShareUrl, decodePlanFromHash, sanitizePlan } from './sharePlan'
import { analyze, analyzeBuildingCode, daylightPotential, egressRoutes, heatFlowSnapshot, windFlowPotential, type CodeIssue } from './analysis'
import type { AnalysisResult, Suggestion } from './analysis'
import type { CanvasView, FurnitureKind, PlanState, PlanTool, Room, WorkspaceMode } from './types'
import { TopBar } from './components/TopBar'
import { AssistantBar } from './components/AssistantBar'
import { Inspector } from './components/Inspector'
import { JourneyRail } from './components/JourneyRail'
import { WelcomeGate } from './components/WelcomeGate'
import { ScienceDock } from './components/ScienceDock'
import { ValueLens, type ValueLensMode } from './components/ValueLens'
import { IconButton } from './components/ui'
import { evaluateJourney } from './journey/evaluateJourney'
import {
  readVisited,
  readWelcomeDismissed,
  stageFromVisit,
  writeVisited,
  writeWelcomeDismissed,
  type JourneyStageId,
  type StageNav,
} from './journey/stages'

const Spatial3D = lazy(() => import('./canvas/Spatial3D'))
const SAMPLE_STYLE_KEYWORDS = 'contemporary Shanghai, custom elm joinery, mineral plaster, linen screens, quiet craftsmanship'

import { createGuidedTour } from './tour/guidedTour'
import { CLIMATE_SCENARIOS } from './scenarios/climateScenarios'
import { GuidedTourOverlay } from './components/GuidedTourOverlay'
import { ScenarioPickerModal } from './components/ScenarioPickerModal'
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal'
import { comparePlans } from './analysis/abComparison'
import { ABComparisonModal } from './components/ABComparisonModal'
import type { ABComparisonState, CurrencyCode, Opening } from './types'
import { readString } from './storage/keys'


function readSavedPlan(): PlanState {
  // Priority: share link in the URL hash, then the local draft, then the demo plan.
  if (typeof window !== 'undefined') {
    const shared = decodePlanFromHash(window.location.hash)
    if (shared) return shared
  }
  try {
    const saved = localStorage.getItem(CHINA_PROJECT_KEY)
    if (!saved) return chinaApartmentPlan
    return sanitizePlan(JSON.parse(saved)) ?? chinaApartmentPlan
  } catch {
    return chinaApartmentPlan
  }
}

function App() {
  const [plan, setPlan] = useState<PlanState>(readSavedPlan)
  const [past, setPast] = useState<Array<{ state: PlanState; label: string }>>([])
  const [future, setFuture] = useState<Array<{ state: PlanState; label: string }>>([])
  const [mode, setMode] = useState<WorkspaceMode>('plan')
  const [view, setView] = useState<CanvasView>('plan')
  const [selectedRoom, setSelectedRoom] = useState<string | null>('living')
  const [selectedOpening, setSelectedOpening] = useState<string | null>(null)
  const [selectedFurniture, setSelectedFurniture] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<PlanTool>('select')
  const [furnitureTrayOpen, setFurnitureTrayOpen] = useState(false)
  const [draftStroke, setDraftStroke] = useState<StrokePoint[] | null>(null)
  const [rulerArmed, setRulerArmed] = useState(false)
  const [rulerLine, setRulerLine] = useState<NapkinCalibrationLine | null>(null)
  const [rulerMeters, setRulerMeters] = useState('')
  const [location, setLocation] = useState<string>(CHINA_PROJECT_LOCATION)
  const [styleKeywords, setStyleKeywords] = useState<string>(() => readString('style-keywords:shanghai-50', 'luma-style-keywords:shanghai-50') || SAMPLE_STYLE_KEYWORDS)
  const [hour, setHour] = useState(10)
  const [day, setDay] = useState(355)
  const [outsideC, setOutsideC] = useState(34)
  const [valueLens, setValueLens] = useState<ValueLensMode>('off')
  const [windFrom, setWindFrom] = useState(180)
  const [windSpeed, setWindSpeed] = useState(3)
  const [sketchUrl, setSketchUrl] = useState<string | null>(null)
  const [assistantText, setAssistantText] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [snapGrid, setSnapGrid] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [lastSaved, setLastSaved] = useState('Saved')
  const [conceptImages, setConceptImages] = useState<string[]>(() => getSavedConceptImages())
  const [quotaLeft, setQuotaLeft] = useState(() => getQuotaRemaining())
  const [isRendering, setIsRendering] = useState(false)
  const [visitedStages, setVisitedStages] = useState<Set<JourneyStageId>>(() => readVisited())
  const [welcomeOpen, setWelcomeOpen] = useState(() => !readWelcomeDismissed())
  const [tourChapterIndex, setTourChapterIndex] = useState<number | null>(null)
  const [scenariosOpen, setScenariosOpen] = useState(false)
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)
  const [walkMode, setWalkMode] = useState(false)
  /** Live room rect being dragged, for the in-canvas dimension readout. */
  const [liveDragRect, setLiveDragRect] = useState<{ id: string; x: number; y: number; w: number; h: number } | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [currency, setCurrency] = useState<CurrencyCode>('CNY')
  const [pinnedBaseline, setPinnedBaseline] = useState<ABComparisonState | null>(null)
  const [abComparisonModalOpen, setABComparisonModalOpen] = useState(false)
  const frameRef = useRef<HTMLDivElement>(null!)

  const stageRef = useRef<HTMLDivElement>(null!)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const panMovedRef = useRef(false)
  const drawPointerRef = useRef<number | null>(null)
  // Source of truth for the active stroke; draftStroke state only mirrors it for rendering.
  const strokePointsRef = useRef<StrokePoint[]>([])
  // Gesture truth lives in refs, not state closures (see tasks/lessons.md).
  const rulerPointerRef = useRef<number | null>(null)
  const rulerLineRef = useRef<NapkinCalibrationLine | null>(null)

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

  const budget = useMemo(() => calculateChinaApartmentBudget(plan), [plan])
  const site = useMemo<SiteSpec>(() => siteOf(plan), [plan])
  const sun = useMemo(() => solarPosition(locations[location as keyof typeof locations].latitude, day, hour), [location, day, hour])
  const patches = useMemo(() => sunPatches(plan, sun.azimuth, sun.altitude), [plan, sun.azimuth, sun.altitude])
  const directSunM2 = Math.min(budget.area, patches.reduce((sum, patch) => sum + patch.areaM2, 0))
  const heatFlow = useMemo(
    () => heatFlowSnapshot({ plan, sunAzimuth: sun.azimuth, sunAltitude: sun.altitude, outsideC }),
    [outsideC, plan, sun.altitude, sun.azimuth],
  )
  const baselineHeatFlow = useMemo(
    () => heatFlowSnapshot({ plan: { ...plan, systems: { ...plan.systems, insulation: false } }, sunAzimuth: sun.azimuth, sunAltitude: sun.altitude, outsideC }),
    [outsideC, plan, sun.altitude, sun.azimuth],
  )
  const upgradedHeatFlow = useMemo(
    () => heatFlowSnapshot({ plan: { ...plan, systems: { ...plan.systems, insulation: true } }, sunAzimuth: sun.azimuth, sunAltitude: sun.altitude, outsideC }),
    [outsideC, plan, sun.altitude, sun.azimuth],
  )
  const decisionAllowances = useMemo(() => {
    const baseline = calculateChinaApartmentBudget({ ...plan, systems: { ...plan.systems, insulation: false } })
    const envelope = calculateChinaApartmentBudget({ ...plan, systems: { ...plan.systems, insulation: true } })
    const withOpening = calculateChinaApartmentBudget({
      ...plan,
      openings: [...plan.openings, { id: '__allowance__', type: 'window' as const, x: -100, y: -100, rotation: 0 as const }],
    })
    return {
      opening: Math.max(0, withOpening.total - budget.total),
      envelope: Math.max(0, envelope.total - baseline.total),
    }
  }, [budget.total, plan])
  const daylight = useMemo(() => daylightPotential(plan), [plan])
  const daylightBandList = useMemo(() => daylight.flatMap((item) => item.bands), [daylight])
  const windRooms = useMemo(() => windFlowPotential(plan, windFrom, windSpeed), [plan, windFrom, windSpeed])
  const egressRooms = useMemo(() => egressRoutes(plan), [plan])
  const tourChapters = useMemo(
    () => createGuidedTour(plan, { sunAzimuth: sun.azimuth, sunAltitude: sun.altitude, outsideC, windFrom, windSpeed }),
    [outsideC, plan, sun.altitude, sun.azimuth, windFrom, windSpeed],
  )
  useEffect(() => {
    if (!activeScenarioId) return
    const active = CLIMATE_SCENARIOS.find((scenario) => scenario.id === activeScenarioId)
    if (!active) {
      setActiveScenarioId(null)
      return
    }
    const params = active.params
    if (day !== params.day || hour !== params.hour || outsideC !== params.outsideC || windFrom !== params.windFrom || windSpeed !== params.windSpeed) {
      setActiveScenarioId(null)
    }
  }, [activeScenarioId, day, hour, outsideC, windFrom, windSpeed])
  const room = useMemo(() => plan.rooms.find((item) => item.id === selectedRoom), [plan.rooms, selectedRoom])
  const furnitureConflicts = useMemo(() => furnitureDoorConflicts(plan.furniture, plan.openings, site), [plan.furniture, plan.openings, site])
  const furnitureItem = useMemo(() => plan.furniture.find((item) => item.id === selectedFurniture), [plan.furniture, selectedFurniture])
  const climateResult = useMemo<AnalysisResult>(
    () => analyze({ plan, location: locations[location as keyof typeof locations] }),
    [plan, location],
  )
  const codeReport = useMemo(() => analyzeBuildingCode(plan), [plan])
  const carbon = useMemo(() => estimateApartmentCarbon(plan), [plan])
  const overlaps = useMemo(() => roomOverlaps(plan.rooms), [plan.rooms])

  const interior = useMemo(() => interiorBoq(plan, site, currency), [plan, site, currency])
  const [isTracing, setIsTracing] = useState(false)
  const [traceNote, setTraceNote] = useState<string | null>(null)
  const isEmpty = plan.rooms.length === 0
  const isAuthoredSample = plan.rooms.length > 0 && plan.rooms.every((room) => chinaApartmentPlan.rooms.some((sampleRoom) => sampleRoom.id === room.id))
  const projectTitle = isAuthoredSample ? CHINA_PROJECT_NAME : 'Untitled sketch'

  const commit = useCallback((next: PlanState | ((current: PlanState) => PlanState), label = 'Edit') => {
    setPast((items) => [...items.slice(-29), { state: plan, label }])
    setPlan((current) => (typeof next === 'function' ? next(current) : next))
    setFuture([])
  }, [plan])
  const handleAutoFixCodeIssue = useCallback((issue: CodeIssue) => {
    if (issue.fixAction === 'set_ceiling_2_5m' && issue.roomId) {
      commit((current) => ({
        ...current,
        rooms: current.rooms.map((r) => (r.id === issue.roomId ? { ...r, wallHeight: 2.5 } : r)),
      }), 'Set ceiling 2.5 m')
      setToast('Ceiling raised to 2.5 m — undo if unwanted')
    } else if (issue.fixAction === 'fix_egress_window') {
      commit((current) => {
        if (issue.openingId) {
          return {
            ...current,
            openings: current.openings.map((op) =>
              op.id === issue.openingId ? { ...op, widthM: 1.6, heightM: 1.2, sillHeightM: 0.9, operableFraction: 0.5 } : op,
            ),
          }
        }
        if (issue.roomId) {
          const room = current.rooms.find((r) => r.id === issue.roomId)
          if (!room) return current
          const newWindow = {
            id: `egress-win-${Date.now()}`,
            type: 'window' as const,
            x: room.x + room.w / 2,
            y: room.y,
            rotation: 0 as const,
            widthM: 1.6,
            heightM: 1.2,
            sillHeightM: 0.9,
            operableFraction: 0.5,
          }
          return { ...current, openings: [...current.openings, newWindow] }
        }
        return current
      })
      setToast('Egress window sized to code — undo if unwanted')
    } else if (issue.fixAction === 'add_glazing' && issue.roomId) {
      commit((current) => {
        const room = current.rooms.find((r) => r.id === issue.roomId)
        if (!room) return current
        const newWindow = {
          id: `glaze-win-${Date.now()}`,
          type: 'window' as const,
          x: room.x + room.w / 2,
          y: room.y,
          rotation: 0 as const,
          widthM: 1.6,
          heightM: 1.2,
          sillHeightM: 0.9,
          operableFraction: 0.5,
        }
        return { ...current, openings: [...current.openings, newWindow] }
      })
      setToast('Window added for daylight — undo if unwanted')
    }
  }, [commit])

  const updateOpening = useCallback((id: string, updates: Partial<Opening>) => {
    commit((current) => ({
      ...current,
      openings: current.openings.map((o) => (o.id === id ? { ...o, ...updates } : o)),
    }), 'Adjust opening')
  }, [commit])

  const handlePinBaseline = useCallback(() => {
    setPinnedBaseline({
      baselinePlan: plan,
      baselineName: 'Pinned Baseline (Plan A)',
      pinnedAt: new Date().toLocaleTimeString(),
    })
    setToast('Plan A pinned as baseline! Modify your drawing to compare Plan B side-by-side.')
  }, [plan])

  const handleOpenABComparison = useCallback(() => {
    if (!pinnedBaseline) return
    setABComparisonModalOpen(true)
  }, [pinnedBaseline])

  const handleApplyProposedAsBaseline = useCallback(() => {
    if (!pinnedBaseline) return
    setPinnedBaseline({
      baselinePlan: plan,
      baselineName: 'Pinned Baseline (Plan A)',
      pinnedAt: new Date().toLocaleTimeString(),
    })
    setToast('Plan B promoted to new baseline Plan A!')
  }, [plan, pinnedBaseline])

  const abComparisonResult = useMemo(() => {
    if (!pinnedBaseline) return null
    return comparePlans(pinnedBaseline.baselinePlan, plan)
  }, [pinnedBaseline, plan])


  const journey = useMemo(
    () =>
      evaluateJourney({
        plan,
        areaM2: budget.area,
        hasConcept: conceptImages.length > 0,
        visited: visitedStages,
        mode,
        view,
      }),
    [budget.area, conceptImages.length, mode, plan, view, visitedStages],
  )

  const markVisited = useCallback((stageId: JourneyStageId) => {
    setVisitedStages((current) => {
      if (current.has(stageId)) return current
      const next = new Set(current)
      next.add(stageId)
      writeVisited(next)
      return next
    })
  }, [])

  useEffect(() => {
    markVisited(stageFromVisit(mode, view))
  }, [markVisited, mode, view])

  const prevDoneRef = useRef<number | null>(null)
  useEffect(() => {
    if (prevDoneRef.current === null) {
      prevDoneRef.current = journey.doneCount
      return
    }
    if (journey.doneCount > prevDoneRef.current) {
      const completed = journey.stages.filter((s) => s.complete)
      const justDone = completed[completed.length - 1]
      if (justDone) {
        setToast(`${justDone.def.label} locked in · ${journey.doneCount}/${journey.stages.length}`)
      }
    }
    prevDoneRef.current = journey.doneCount
  }, [journey.doneCount, journey.stages])

  const goToStage = useCallback((nav: StageNav) => {
    if (nav.inspector !== undefined) setInspectorOpen(nav.inspector)
    setSettingsOpen(false)
    if (nav.mode) setMode(nav.mode)
    if (nav.view) setView(nav.view)
    if (nav.tool) setActiveTool(nav.tool)
  }, [])

  const commitSnapshot = useCallback((snapshot: PlanState, label = 'Auto-save') => {
    setPast((items) => [...items.slice(-29), { state: snapshot, label }])
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
      localStorage.setItem(CHINA_PROJECT_KEY, JSON.stringify(plan))
      setLastSaved('Saved locally')
    }, 300)
    return () => window.clearTimeout(timeout)
  }, [plan])

  useEffect(() => {
    localStorage.setItem('designon:style-keywords:shanghai-50', styleKeywords)
  }, [styleKeywords])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const undo = useCallback(() => {
    const previous = past[past.length - 1]
    if (!previous) return
    setFuture((items) => [{ state: plan, label: previous.label }, ...items])
    setPlan(previous.state)
    setPast((items) => items.slice(0, -1))
    setToast(`Undid: ${previous.label}`)
  }, [past, plan])

  const redo = useCallback(() => {
    const next = future[0]
    if (!next) return
    setPast((items) => [...items, { state: plan, label: next.label }])
    setPlan(next.state)
    setFuture((items) => items.slice(1))
  }, [future, plan])

  const applyRulerCalibration = useCallback(() => {
    const meters = Number(rulerMeters)
    if (!rulerLine) return
    if (!Number.isFinite(meters) || meters <= 0) {
      setToast('Type the real length of that line in meters')
      return
    }
    const { newSite, scaleRatio } = calibrateSiteFromNapkinLine(site, rulerLine, meters)
    commit((current) => ({ ...current, site: newSite }), 'Calibrate scale')
    rulerLineRef.current = null
    setRulerLine(null)
    setRulerMeters('')
    setToast(`Scale calibrated ×${scaleRatio.toFixed(2)} — site is now ${newSite.w.toFixed(1)} × ${newSite.h.toFixed(1)} m`)
  }, [commit, rulerLine, rulerMeters, site])

  const cancelRulerCalibration = useCallback(() => {
    rulerLineRef.current = null
    setRulerLine(null)
    setRulerMeters('')
    setRulerArmed(false)
  }, [])

  const handleCanvasPointerDown = useCallback((event: ReactPointerEvent) => {
    if (rulerArmed) {
      if (rulerPointerRef.current !== null) return
      const bounds = stageRef.current?.getBoundingClientRect()
      if (!bounds) return
      rulerPointerRef.current = event.pointerId
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Synthetic pointers (tests) have no active pointer to capture.
      }
      const point = clientToPercent(event.clientX, event.clientY, bounds)
      rulerLineRef.current = { p1: point, p2: point }
      setRulerLine(rulerLineRef.current)
      return
    }
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
  }, [activeTool, onViewportPointerDown, rulerArmed])

  const handleCanvasPointerMove = useCallback((event: ReactPointerEvent) => {
    // Live room rect for the dimension readout in the canvas
    if (isGesturing() && selectedRoom) {
      const live = plan.rooms.find((r) => r.id === selectedRoom)
      if (live) {
        setLiveDragRect({ id: live.id, x: live.x, y: live.y, w: live.w, h: live.h })
      }
    }
    if (rulerPointerRef.current === event.pointerId) {
      const bounds = stageRef.current?.getBoundingClientRect()
      if (!bounds || !rulerLineRef.current) return
      rulerLineRef.current = { ...rulerLineRef.current, p2: clientToPercent(event.clientX, event.clientY, bounds) }
      setRulerLine(rulerLineRef.current)
      return
    }
    if (drawPointerRef.current === event.pointerId) {
      const bounds = stageRef.current?.getBoundingClientRect()
      if (!bounds) return
      strokePointsRef.current = [...strokePointsRef.current, clientToPercent(event.clientX, event.clientY, bounds)]
      setDraftStroke(strokePointsRef.current)
      return
    }
    onViewportPointerMove(event)
    if (Math.abs(event.movementX) + Math.abs(event.movementY) > 2) panMovedRef.current = true
  }, [isGesturing, onViewportPointerMove, plan.rooms, selectedRoom])

  const handleCanvasPointerUp = useCallback((event: ReactPointerEvent) => {
    setLiveDragRect(null)
    if (rulerPointerRef.current === event.pointerId) {
      rulerPointerRef.current = null
      setRulerArmed(false)
      const line = rulerLineRef.current
      const lengthPct = line ? Math.hypot(line.p2.x - line.p1.x, line.p2.y - line.p1.y) : 0
      if (!line || lengthPct < 2) {
        rulerLineRef.current = null
        setRulerLine(null)
        setToast('Drag a longer line along a wall you know the length of')
        return
      }
      // Line stays visible; the calibration chip asks for its real length.
      return
    }
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
      commit((current) => ({ ...current, rooms: [...current.rooms, sketched] }), 'Sketch room')
      setSelectedRoom(id)
      setMode('plan')
      setActiveTool('select')
      setSettingsOpen(false)
      setInspectorOpen(true)
      setToast(`Room drawn · enter one known dimension to calibrate the whole sketch`)
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
    commit((current) => ({ ...current, openings: [...current.openings, opening] }), `Place ${opening.type}`)
    setActiveTool('select')
    setToast(`${opening.type === 'window' ? 'Window' : 'Door'} placed`)
  }, [activeTool, commit, isGesturing, placeOpeningAt])

  const addRoom = useCallback(() => {
    const index = plan.rooms.length + 1
    const id = `room-${Date.now()}`
    commit((current) => ({
      ...current,
      rooms: [...current.rooms, { id, name: `Flexible room ${index}`, kind: 'studio', x: 30, y: 30, w: 25, h: 24 }],
    }), 'Add room')
    setSelectedRoom(id)
  }, [commit, plan.rooms.length])

  const deleteRoom = useCallback(() => {
    if (!selectedRoom) return
    commit((current) => ({ ...current, rooms: current.rooms.filter((item) => item.id !== selectedRoom) }), 'Delete room')
    setSelectedRoom(null)
  }, [commit, selectedRoom])

  const updateRoom = useCallback((updates: Partial<Room>) => {
    if (!selectedRoom) return
    commit((current) => ({
      ...current,
      rooms: current.rooms.map((item) => (item.id === selectedRoom ? { ...item, ...updates } : item)),
    }), 'Edit room')
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
    const w = (spec.w / site.w) * 100
    const h = (spec.d / site.h) * 100
    const id = `f-${Date.now()}`
    commit((current) => ({
      ...current,
      furniture: [...current.furniture, { id, kind, x: 50 - w / 2, y: 50 - h / 2, rotated: false }],
    }))
    setSelectedFurniture(id)
    setFurnitureTrayOpen(false)
    setToast(`${spec.label} placed at real size — drag it into a room`)
  }, [commit, site.h, site.w])

  const rotateFurniture = useCallback(() => {
    if (!selectedFurniture) return
    commit((current) => ({
      ...current,
      furniture: current.furniture.map((item) => {
        if (item.id !== selectedFurniture) return item
        const spec = furnitureCatalog[item.kind]
        const rotated = !item.rotated
        const w = ((rotated ? spec.d : spec.w) / site.w) * 100
        const h = ((rotated ? spec.w : spec.d) / site.h) * 100
        return { ...item, rotated, x: Math.min(item.x, 100 - w), y: Math.min(item.y, 100 - h) }
      }),
    }))
  }, [commit, selectedFurniture, site.h, site.w])

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
          setToast('That file does not contain a valid designon plan')
          return
        }
        commit(next, 'Import project')
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
        setTourChapterIndex(null)
        setScenariosOpen(false)
        setShortcutsOpen(false)
        setWalkMode(false)
        return
      }
      if (event.key.toLowerCase() === 't') {
        event.preventDefault()
        if (plan.rooms.length === 0) {
          setToast('Draw a room before starting the 3D tour')
          return
        }
        setView('spatial')
        setTourChapterIndex(0)
        setSelectedRoom(null)
        setWalkMode(false)
        setToast('Guided 3D Tour started — Chapter 1')
        return
      }
      if (event.key.toLowerCase() === 'g') {
        event.preventDefault()
        if (plan.rooms.length === 0) {
          setToast('Draw a room before entering walk mode')
          return
        }
        setView('spatial')
        setWalkMode((prev) => !prev)
        return
      }
      if (event.key === '?' || (event.shiftKey && event.key === '/')) {
        event.preventDefault()
        setShortcutsOpen((prev) => !prev)
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
              const rect = furnitureRectFor(item, site)
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
  }, [commit, deleteFurniture, deleteOpening, deleteRoom, plan.rooms.length, redo, selectedFurniture, selectedOpening, selectedRoom, site, undo])

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
    const variant = chinaApartmentVariants[index]
    if (!variant) return
    commit((current) => ({ ...current, rooms: variant.rooms.map((item) => ({ ...item })) }), 'Apply layout')
    setToast(`${variant.name} applied`)
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
    commit((current) => ({ ...current, openings: [...current.openings, opening] }), 'Apply suggestion')
    setToast(`Window added — scores update live`)
  }, [commit, plan.rooms])

  const resetPlan = useCallback(() => {
    commit(chinaApartmentPlan, 'Restore sample apartment')
    setSelectedRoom('living')
    setSelectedOpening(null)
    resetView()
    setStyleKeywords(SAMPLE_STYLE_KEYWORDS)
    setToast('Shanghai 50 m² apartment restored')
  }, [commit, resetView])

  // Start from a truly blank napkin — empty dotted canvas.
  const startBlank = useCallback(() => {
    commit(blankPlan(), 'Start blank canvas')
    setSelectedRoom(null)
    setSelectedOpening(null)
    setSelectedFurniture(null)
    setActiveTool('draw')
    resetView()
    setTraceNote(null)
    setStyleKeywords('')
    setToast('Blank canvas — draw a room or upload a plan to trace')
  }, [commit, resetView])

  // Adjustable scale: change the meters represented by one grid cell.
  const setSiteScale = useCallback((unit: number) => {
    const safe = Math.max(0.1, Math.min(Math.min(site.w, site.h), unit))
    commit((current) => ({ ...current, site: { ...siteOf(current), unit: safe } }), 'Set grid scale')
    setToast(`Grid scale set to ${safe} m / cell`)
  }, [commit, site])

  const calibrateRoomFromDimension = useCallback((axis: 'w' | 'h', knownMeters: number) => {
    if (!selectedRoom || !Number.isFinite(knownMeters) || knownMeters <= 0) return
    const selected = plan.rooms.find((item) => item.id === selectedRoom)
    if (!selected) return
    commit((current) => ({
      ...current,
      site: calibrateSiteFromRoom(siteOf(current), selected, axis, knownMeters),
    }))
    setToast(`Whole drawing calibrated from ${knownMeters.toFixed(1)} m ${axis === 'w' ? 'width' : 'depth'}`)
  }, [commit, plan.rooms, selectedRoom])

  // AI trace: read a plan from an uploaded image via the Gemini vision worker.
  const traceFileInputRef = useRef<HTMLInputElement>(null)
  const runTrace = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (quotaLeft <= 0) {
      setToast('Daily AI limit reached (3/day)')
      return
    }
    const reader = new FileReader()
    reader.onload = async () => {
      const imageDataUrl = String(reader.result)
      setSketchUrl(imageDataUrl) // show it as the underlay while tracing
      setIsTracing(true)
      try {
        const result = await tracePlanFromImage({ imageDataUrl, siteW: site.w, siteH: site.h })
        commit(result.plan, 'Trace plan from photo')
        setSelectedRoom(result.plan.rooms[0]?.id ?? null)
        setMode('plan')
        setSettingsOpen(false)
        setInspectorOpen(true)
        setStyleKeywords('')
        setQuotaLeft(result.remaining)
        setTraceNote(`${result.note} Scale is assumed until you enter one known room dimension.`)
        setToast(`AI found ${result.plan.rooms.length} rooms · ${result.remaining} AI use${result.remaining === 1 ? '' : 's'} left today`)
      } catch (error) {
        setToast(error instanceof Error ? error.message : 'Plan trace failed')
      } finally {
        setIsTracing(false)
      }
    }
    reader.readAsDataURL(file)
  }, [commit, quotaLeft, site.h, site.w])

  const runConceptRender = useCallback(async () => {
    if (isRendering) return
    if (quotaLeft <= 0) {
      setToast('Daily AI limit reached (3/day)')
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
        [...plan.rooms].sort((a, b) => roomAreaFor(b, site) - roomAreaFor(a, site))[0]
      if (!target) return
      commit((current) => ({
        ...current,
        openings: [
          ...current.openings,
          { id: `w-${Date.now()}`, type: 'window', x: Math.round(target.x + target.w / 2), y: Math.round(target.y), rotation: 0 },
        ],
      }), 'Add north window')
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
  }, [addRoom, assistantText, commit, plan.rooms, runConceptRender, selectedRoom, site])

  const exportPlan = useCallback(() => {
    const blob = new Blob([JSON.stringify({ project: projectTitle, location: locations[location as keyof typeof locations], orientation: 'North up', exportedAt: new Date().toISOString(), plan, budget, carbon, lightingChannels: chinaLightingChannels }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = isAuthoredSample ? 'south-light-shanghai-50.json' : 'designon-sketch.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setToast('Project file exported')
  }, [budget, carbon, isAuthoredSample, location, plan, projectTitle])

  const viewportStyle = useMemo(() => ({
    transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
    transformOrigin: 'center center',
  }), [viewport.panX, viewport.panY, viewport.zoom])

  return (
    <div className="app-shell">
      <TopBar
        projectName={projectTitle}
        lastSaved={lastSaved}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((open) => !open)}
        onOpenSettings={() => {
          setSettingsOpen(true)
          setInspectorOpen(true)
        }}
        exportPlan={exportPlan}
        sharePlan={shareProject}
        onOpenShortcuts={() => setShortcutsOpen((prev) => !prev)}
      />

      <div className="workspace">
        <main className="design-stage">
          <div className="stage-head">
            <div>
              <p className="eyebrow">Decision sequence <span>•</span> {location} · north up</p>
              <h1>{projectTitle}</h1>
            </div>
            <div className="stage-meta">
              <span><MapPin /> {locations[location as keyof typeof locations].label}</span>
              <span><Ruler /> {budget.area.toFixed(1)} m²</span>
            </div>
          </div>

          <JourneyRail
            stages={journey.stages}
            progress={journey.progress}
            headline={journey.headline}
            onGo={(nav, stageId) => {
              markVisited(stageId as JourneyStageId)
              goToStage(nav)
            }}
          />

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
                showSun={mode === 'light' || valueLens === 'shade'}
                sunAngle={sun.azimuth}
                sunPatchList={mode === 'light' || valueLens === 'shade' ? patches : []}
                valueLens={valueLens}
                daylightBands={daylightBandList}
                windRooms={windRooms}
                egressRooms={egressRooms}
                showGrid={showGrid}
                gridCellX={(site.unit / site.w) * 100}
                gridCellY={(site.unit / site.h) * 100}
                viewportStyle={viewportStyle}
                napkinRuler={rulerLine}
                rulerArmed={rulerArmed}
                liveDragRect={liveDragRect}
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
                    plan={isEmpty ? chinaApartmentPlan : plan}
                    sunAzimuth={sun.azimuth}
                    sunAltitude={sun.altitude}
                    selectedRoom={selectedRoom}
                    onSelectRoom={setSelectedRoom}
                    onSetWallHeight={setWallHeight}
                    hour={hour}
                    day={day}
                    locationLabel={locations[location as keyof typeof locations].label}
                    ghost={isEmpty}
                    tourWaypoint={tourChapterIndex !== null ? tourChapters[tourChapterIndex]?.camera : null}
                    walkMode={walkMode}
                    onToggleWalkMode={() => setWalkMode((prev) => !prev)}
                    onStartTour={() => { setTourChapterIndex(0); setSelectedRoom(null); setWalkMode(false); setToast('Your drawing in 3D · 1 of 4') }}
                    onOpenScenarios={() => { setSelectedRoom(null); setScenariosOpen(true) }}
                    windFrom={windFrom}
                    windSpeed={windSpeed}
                  />
                </Suspense>
                {isEmpty && (
                  <div className="spatial-ghost-note" role="status">
                    <p>Draw a room in Plan to see it in 3D</p>
                    <button
                      className="button primary small"
                      type="button"
                      onClick={() => goToStage({ mode: 'plan', view: 'plan', tool: 'draw' })}
                    >
                      Go to Plan
                    </button>
                  </div>
                )}
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
            {view !== 'renders' && !isEmpty && (
              view === 'spatial' || (mode === 'light' && valueLens === 'off') ? (
                <ScienceDock
                  heat={heatFlow}
                  directSunM2={directSunM2}
                  floorAreaM2={budget.area}
                  hour={hour}
                  setHour={setHour}
                  day={day}
                  setDay={setDay}
                  outsideC={outsideC}
                  setOutsideC={setOutsideC}
                />
              ) : valueLens === 'off' ? (
                <button className="science-preview" type="button" onClick={() => setMode('light')}>
                  <span className="science-live" />
                  <span><small>Live sun + heat</small><strong>{Math.abs(heatFlow.netW) >= 1000 ? `${(Math.abs(heatFlow.netW) / 1000).toFixed(1)} kW` : `${Math.round(Math.abs(heatFlow.netW))} W`} {heatFlow.mode === 'heat-out' ? 'leaving' : 'entering'}</strong></span>
                  <Sun />
                </button>
              ) : null
            )}
            {view === 'plan' && !isEmpty && (
              <ValueLens
                active={valueLens}
                setActive={setValueLens}
                daylight={daylight}
                wind={windRooms}
                egress={egressRooms}
                currentHeat={heatFlow}
                baseHeat={baselineHeatFlow}
                upgradedHeat={upgradedHeatFlow}
                directSunM2={directSunM2}
                windFrom={windFrom}
                setWindFrom={setWindFrom}
                windSpeed={windSpeed}
                setWindSpeed={setWindSpeed}
                currency={budget.currency}
                openingAllowance={decisionAllowances.opening}
                envelopeAllowance={decisionAllowances.envelope}
                envelopeApplied={plan.systems.insulation}
                onToggleEnvelope={() => commit((current) => ({ ...current, systems: { ...current.systems, insulation: !current.systems.insulation } }))}
              />
            )}
            {view === 'plan' && (
              <div className="scale-chip" title="Grid scale — meters per cell">
                <Ruler />
                <input
                  type="number"
                  step="0.5"
                  min="0.1"
                  max={Math.min(site.w, site.h)}
                  value={site.unit}
                  onChange={(e) => setSiteScale(Number(e.target.value))}
                  aria-label="Grid cell size in meters"
                />
                <small>m / cell</small>
                <span>·</span>
                <small>{site.w.toFixed(1)} × {site.h.toFixed(1)} m site</small>
                <span>·</span>
                <button
                  type="button"
                  className={`ruler-arm ${rulerArmed ? 'active' : ''}`}
                  onClick={() => {
                    if (rulerArmed || rulerLine) {
                      cancelRulerCalibration()
                      return
                    }
                    setRulerArmed(true)
                    setToast('Drag along a wall whose real length you know')
                  }}
                >
                  {rulerArmed || rulerLine ? 'Cancel' : 'Calibrate'}
                </button>
              </div>
            )}
            {view === 'plan' && rulerLine && !rulerArmed && (
              <div className="ruler-chip" role="dialog" aria-label="Calibrate drawing scale">
                <span><strong>Real length</strong><small>of the line you drew</small></span>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={rulerMeters}
                  onChange={(event) => setRulerMeters(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Enter') applyRulerCalibration() }}
                  aria-label="Real length in meters"
                  autoFocus
                />
                <small>m</small>
                <button className="button primary" type="button" onClick={applyRulerCalibration}>Apply</button>
              </div>
            )}
            {view === 'plan' && isEmpty && !draftStroke && !rulerArmed && !rulerLine && (
              <div className="canvas-empty">
                <Pencil />
                <h3>Draw your first room</h3>
                <p>Sketch a rough rectangle with one finger — it snaps straight, to scale. Or upload an existing plan and let AI trace it.</p>
                <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button className="button primary small" type="button" onClick={() => setActiveTool('draw')}>Draw a room</button>
                  <button className="button secondary small" type="button" onClick={() => traceFileInputRef.current?.click()} disabled={isTracing || quotaLeft <= 0}>
                    {isTracing ? 'Tracing…' : 'Upload plan → trace with AI'}
                  </button>
                  <button className="button secondary small" type="button" onClick={resetPlan}>Load sample</button>
                </div>
                <input ref={traceFileInputRef} type="file" accept="image/*" onChange={runTrace} hidden />
              </div>
            )}
            {view === 'plan' && traceNote && (
              <div className="trace-note" role="status">
                {isTracing ? 'AI reading plan…' : traceNote}
                {!isTracing && <button className="text-button" style={{ marginLeft: 8 }} type="button" onClick={() => setTraceNote(null)}>Dismiss</button>}
              </div>
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
            hint={journey.coach.cta}
            cta={welcomeOpen ? undefined : journey.coach.cta}
            onCta={() => goToStage(journey.coach.nav)}
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
          calibrateRoomFromDimension={calibrateRoomFromDimension}
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
          variants={isAuthoredSample ? chinaApartmentVariants : []}
          snapGrid={snapGrid}
          setSnapGrid={setSnapGrid}
          showGrid={showGrid}
          setShowGrid={setShowGrid}
          climateResult={climateResult}
          applySuggestion={applySuggestion}
          styleKeywords={styleKeywords}
          setStyleKeywords={setStyleKeywords}
          site={site}
          interior={interior}
          startBlank={startBlank}
          runTrace={runTrace}
          traceFileInputRef={traceFileInputRef}
          isTracing={isTracing}
          selectedOpeningId={selectedOpening}
          updateOpening={updateOpening}
          deleteOpening={deleteOpening}
          currency={currency}
          setCurrency={setCurrency}
          onPinBaseline={handlePinBaseline}
          onOpenABComparison={handleOpenABComparison}
          hasBaselinePin={!!pinnedBaseline}
          codeReport={codeReport}
          onAutoFixCodeIssue={handleAutoFixCodeIssue}
        />
      </div>
      <WelcomeGate
        open={welcomeOpen}
        onStart={() => {
          writeWelcomeDismissed()
          setWelcomeOpen(false)
          startBlank()
          goToStage({ mode: 'plan', view: 'plan', tool: 'draw', inspector: false })
          setToast('Blank page ready — draw one room with your finger or mouse')
        }}
        onSkip={() => {
          writeWelcomeDismissed()
          setWelcomeOpen(false)
        }}
      />
      {tourChapterIndex !== null && (
        <GuidedTourOverlay
          chapter={tourChapters[tourChapterIndex]}
          totalChapters={tourChapters.length}
          onPrev={() => setTourChapterIndex((idx) => (idx !== null && idx > 0 ? idx - 1 : idx))}
          onNext={() => {
            if (tourChapterIndex + 1 < tourChapters.length) {
              setTourChapterIndex(tourChapterIndex + 1)
            } else {
              setTourChapterIndex(null)
              setToast('Guided 3D Tour finished!')
            }
          }}
          onExit={() => setTourChapterIndex(null)}
          onFocusRoom={(roomId) => setSelectedRoom(roomId)}
        />
      )}

      {scenariosOpen && (
        <ScenarioPickerModal
          scenarios={CLIMATE_SCENARIOS}
          activeScenarioId={activeScenarioId}
          plan={plan}
          latitude={locations[location as keyof typeof locations].latitude}
          locationLabel={locations[location as keyof typeof locations].label}
          onSelectScenario={(scenario) => {
            setActiveScenarioId(scenario.id)
            setDay(scenario.params.day)
            setHour(scenario.params.hour)
            setOutsideC(scenario.params.outsideC)
            setWindFrom(scenario.params.windFrom)
            setWindSpeed(scenario.params.windSpeed)
            setView('spatial')
            setScenariosOpen(false)
            setToast(`Scenario active: ${scenario.name}`)
          }}
          onClose={() => setScenariosOpen(false)}
        />
      )}

      {shortcutsOpen && (
        <KeyboardShortcutsModal onClose={() => setShortcutsOpen(false)} />
      )}

      {abComparisonModalOpen && abComparisonResult && pinnedBaseline && (
        <ABComparisonModal
          result={abComparisonResult}
          baselineName={pinnedBaseline.baselineName}
          proposedName="Proposed Iteration (Plan B)"
          onClose={() => setABComparisonModalOpen(false)}
          onApplyProposedAsBaseline={handleApplyProposedAsBaseline}
        />
      )}

      {toast && <div className="toast" role="status"><Check /> {toast}</div>}
    </div>
  )
}


export default App
