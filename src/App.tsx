import { CityPicker } from './components/CityPicker'
import { SunChart } from './canvas/SunChart'
import { locationForTimeZone } from './location/timeZoneLocation'
import { sanitizeLocation, starterLocations } from './location/locations'
import { citySunPosition, clockLabel, normalizedCivilHour } from './location/solar'
import type { ProjectLocation } from './types'
import type { StudyScene } from './study/types'
import { readTheme, saveTheme } from './design/themes'
import { ThemePicker } from './components/ThemePicker'
import { traceSiteFromImage } from './concept/reviewTrace'
import { LayoutPresetDialog } from './components/LayoutPresetDialog'
import { TraceReview, type PendingTrace } from './components/TraceReview'
import { updateOpeningDimensions } from './openingGeometry'
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { AppWindow, Armchair, Check, DoorOpen, ImagePlus, MapPin, MousePointer2, Pencil, Redo2, RotateCcw, RotateCw, Ruler, Sun, Trash2, Undo2 } from 'lucide-react'
import { FloorPlan } from './canvas/FloorPlan'
import { RenderGallery } from './canvas/RenderGallery'
import { contentBox, useCanvasViewport } from './canvas/useCanvasViewport'
import { useRoomGestures } from './canvas/useRoomGestures'
import { appendStrokePoint, clientToPercent, moveOpening, moveRoom, type StrokePoint } from './canvas/geometry'
import { applyNapkinStroke } from './canvas/napkinStroke'
import { calculateMeasureDistance } from './canvas/TapeMeasureTool'
import { calibrateSiteFromNapkinLine, type NapkinCalibrationLine } from './canvas/napkinScale'
import { clearInvalidStatements, parseLengthMetres, recalibratePlan, setRoomSizeM, sizeRefusalMessage, type SizeAxis } from './canvas/roomSize'
import { prepareFurnitureReplacement, type FurnitureChoice } from './canvas/furnitureReplacement'
import { findFurniturePlacement, furnitureBounds, moveFurnitureTo, rotateFurnitureAtCentre } from './canvas/furniturePlacement'
import { generateConceptPhoto } from './concept/generateConcept'
import { getQuotaRemaining, getSavedConceptImages } from './concept/renderQuota'
import { calibrateSiteFromRoom, defaultSite, furnitureCatalog, furnitureDoorConflicts, furnitureLabelFor, furnitureRectFor, furnitureSpecFor, roomAreaFor, roomOverlaps, siteOf, sunPatches } from './plan'
import { interiorBoq } from './boq/interiorBoq'
import { tracePlanFromImage } from './concept/tracePlan'
import type { SiteSpec } from './types'
import {
  CHINA_PROJECT_KEY,
  CHINA_PROJECT_NAME,
  calculateChinaApartmentBudget,
  chinaApartmentPlan,
  chinaApartmentVariants,
  chinaLightingChannels,
  isAuthoredChinaApartment,
  estimateApartmentCarbon,
} from './mockups/chinaApartment'
import { buildShareUrl, decodePlanFromHash, sanitizePlan, MAX_PROJECT_BYTES } from './sharePlan'
import { analyze, analyzeAirQuality, daylightPotential, egressRoutes, heatFlowSnapshot, simulateEnergy, windFlowPotential } from './analysis'
import type { AnalysisResult, Suggestion } from './analysis'
import type { CanvasView, Furniture, FurnitureKind, PlanState, PlanTool, Room, WorkspaceMode } from './types'
import { TopBar } from './components/TopBar'
import { AssistantBar } from './components/AssistantBar'
import { Inspector } from './components/Inspector'
import { JourneyRail } from './components/JourneyRail'
import { PlanRoomKey } from './components/PlanRoomKey'
import { FloatingToolbar } from './components/FloatingToolbar'
import { ContextualActionBar } from './components/ContextualActionBar'
import { FurnitureCatalogDrawer } from './components/FurnitureCatalogDrawer'
import { WelcomeGate } from './components/WelcomeGate'
import { WebAppAccess } from './components/WebAppAccess'
import { ExportDialog } from './components/ExportDialog'
import { ScienceDock } from './components/ScienceDock'
import { ValueLens, type ValueLensMode } from './components/ValueLens'
import { IconButton } from './components/ui'
import { evaluateJourney } from './journey/evaluateJourney'
import {
  readVisited,
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
import { applyRoomOption } from './options/roomOptions'
import type { CurrencyCode, Opening } from './types'
import { pinBaseline, restoreBaseline } from './comparison/baseline'
import { readString, storageIsPersistent } from './storage/keys'
import { checkPlan, exteriorDoorPlacement, type CodeIssue as StandardsCodeIssue } from './codes/checkPlan'

const RoomOptionsDialog = lazy(() => import('./components/RoomOptionsDialog'))
const DRAW_HINT = 'Line = wall · tick on a wall = door or window · box = room or furniture'

/**
 * Every tool says what it does, and the hint is always on screen.
 *
 * The Window and Door tools used to say nothing at all, so the only way to
 * learn that a click on a wall places an opening was to guess and then see
 * what happened. A tool that cannot explain itself makes the whole task a
 * guess. The line is also a fixed row in the drawing: it never appears and
 * disappears, so switching tools never moves the drawing under the hand.
 */
const TOOL_HINTS: Record<PlanTool, { Icon: typeof Pencil; text: string }> = {
  select: { Icon: MousePointer2, text: 'Click a room, door or window to select it' },
  draw: { Icon: Pencil, text: DRAW_HINT },
  window: { Icon: AppWindow, text: 'Click a wall to place a window' },
  door: { Icon: DoorOpen, text: 'Click a wall to place a door' },
}

/** The tape measure and the furniture tray are modes too, and the line that
 *  explains the canvas has to follow them. Armed with the measure, the canvas
 *  was still saying "click a wall to place a window". */
const MEASURE_HINT: { Icon: typeof Pencil; text: string } = {
  Icon: Ruler,
  text: 'Drag along a wall whose real length you know',
}
const FURNITURE_HINT: { Icon: typeof Pencil; text: string } = {
  Icon: Pencil,
  text: 'Pick a piece to place it in the plan at its real size',
}

/** Explicit entry state survives reload; shared drawings open directly. */
function guideIsOpen(): boolean {
  const query = new URLSearchParams(window.location.search)
  if (query.get('guide') === '1') return true
  return query.get('studio') !== '1' && !decodePlanFromHash(window.location.hash)
}

function setEntryRoute(entry: 'guide' | 'studio') {
  const url = new URL(window.location.href)
  url.searchParams.delete(entry === 'guide' ? 'studio' : 'guide')
  url.searchParams.set(entry, '1')
  window.history.replaceState(null, '', url)
}

/** A truly blank plan — the napkin / tissue-paper starting point. */
function blankPlan(): PlanState {
  return {
    rooms: [],
    openings: [],
    furniture: [],
    walls: [],
    systems: { solar: false, insulation: false, climate: false, lighting: false },
    site: defaultSite(),
    location: locationForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone),
  }
}

function readSavedPlan(): PlanState {
  // Priority: share link in the URL hash, then the user's draft, then a blank napkin.
  if (typeof window !== 'undefined') {
    const shared = decodePlanFromHash(window.location.hash)
    if (shared) return { ...shared, location: shared.location ?? starterLocations[0] }
  }
  try {
    const saved = localStorage.getItem(CHINA_PROJECT_KEY)
    if (!saved) return blankPlan()
    const next = sanitizePlan(JSON.parse(saved)) ?? blankPlan()
    if (isAuthoredChinaApartment(next) && !next.location && !next.studyScenes?.length && !next.comparison) return blankPlan()
    return { ...next, location: next.location ?? starterLocations[0] }
  } catch {
    return blankPlan()
  }
}

function App() {
  const [theme, setTheme] = useState(readTheme)
  const [plan, setPlan] = useState<PlanState>(readSavedPlan)
  const [past, setPast] = useState<Array<{ state: PlanState; label: string; sketchUrl: string | null }>>([])
  const [future, setFuture] = useState<Array<{ state: PlanState; label: string; sketchUrl: string | null }>>([])
  const [mode, setMode] = useState<WorkspaceMode>('plan')
  const [view, setView] = useState<CanvasView>('plan')
  const [selectedRoom, setSelectedRoom] = useState<string | null>(null)
  const [selectedOpening, setSelectedOpening] = useState<string | null>(null)
  const [selectedFurniture, setSelectedFurniture] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<PlanTool>(() => (readSavedPlan().rooms.length === 0 ? 'draw' : 'select'))
  const [furnitureTrayOpen, setFurnitureTrayOpen] = useState(false)
  const [draftStroke, setDraftStroke] = useState<StrokePoint[] | null>(null)
  const [rulerArmed, setRulerArmed] = useState(false)
  const [rulerLine, setRulerLine] = useState<NapkinCalibrationLine | null>(null)
  const [rulerMeters, setRulerMeters] = useState('')
  // Fresh plans persist the browser-zone default; legacy plans retain Shanghai.
  const projectLocation = plan.location ?? starterLocations[0]
  const [locationOpen, setLocationOpen] = useState(false)
  const [styleKeywords, setStyleKeywords] = useState<string>(() => readString('style-keywords:shanghai-50', 'luma-style-keywords:shanghai-50') || SAMPLE_STYLE_KEYWORDS)
  const [hour, setHour] = useState(10)
  const [day, setDay] = useState(355)
  const [studyYear, setStudyYear] = useState(() => new Date().getFullYear())
  const [outsideC, setOutsideC] = useState(34)
  const [valueLens, setValueLens] = useState<ValueLensMode>('off')
  const [windFrom, setWindFrom] = useState(180)
  const [windSpeed, setWindSpeed] = useState(3)
  const [sketchUrl, setSketchUrl] = useState<string | null>(null)
  const [assistantText, setAssistantText] = useState('')
  const [toast, setToast] = useState<string | null>(null)
  useEffect(() => {
    const actual = normalizedCivilHour(projectLocation, day, hour, studyYear)
    if (actual === hour) return
    if (actual > 24) { setDay(current => current + 1); setHour(actual - 24) }
    else setHour(actual)
    setToast(`That clock time is skipped by daylight saving in ${projectLocation.name}. Showing ${clockLabel(actual > 24 ? actual - 24 : actual)}.`)
  }, [projectLocation, day, hour, studyYear])
  const [inspectorOpen, setInspectorOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [snapGrid, setSnapGrid] = useState(true)
  const [showGrid, setShowGrid] = useState(true)
  const [lastSaved, setLastSaved] = useState('Saved')
  const [conceptImages, setConceptImages] = useState<string[]>(() => getSavedConceptImages())
  const [quotaLeft, setQuotaLeft] = useState(() => getQuotaRemaining())
  const [isRendering, setIsRendering] = useState(false)
  const [visitedStages, setVisitedStages] = useState<Set<JourneyStageId>>(() => readVisited())
  // Someone who opens a shared link came to see a drawing, not to be greeted.
  // Root is the instruction sheet. Saved work has a resume action; shared
  // drawings bypass it and keep their imported content intact.
  const [welcomeOpen, setWelcomeOpen] = useState(guideIsOpen)
  const [tourChapterIndex, setTourChapterIndex] = useState<number | null>(null)
  const [scenariosOpen, setScenariosOpen] = useState(false)
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null)
  const [walkMode, setWalkMode] = useState(false)
  /** Live room rect being dragged, for the in-canvas dimension readout. */
  const [liveDragRect, setLiveDragRect] = useState<{ id: string; x: number; y: number; w: number; h: number } | null>(null)
  const [alignGuides, setAlignGuides] = useState<{ x: number[]; y: number[] } | null>(null)
  const [shortcutsOpen, setShortcutsOpen] = useState(false)
  const [currency, setCurrency] = useState<CurrencyCode>('CNY')
  const pinnedBaseline = plan.comparison
  const [abComparisonModalOpen, setABComparisonModalOpen] = useState(false)
  const [roomOptionsOpen, setRoomOptionsOpen] = useState(false)
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
  // Tape measure tool state — first click sets the start, second click sets the
  // end and freezes the line. Mouse-move previews a live endpoint.
  const [measureStart, setMeasureStart] = useState<{ x: number; y: number } | null>(null)
  const [measureEnd, setMeasureEnd] = useState<{ x: number; y: number } | null>(null)

  const {
    viewport,
    zoomPercent,
    canZoomIn,
    canZoomOut,
    zoomIn,
    zoomOut,
    resetView,
    fitToContent,
    onWheel,
    onViewportPointerDown,
    onViewportPointerMove,
    onViewportPointerUp,
  } = useCanvasViewport(frameRef)

  // Frame the building, not the whole sheet: on first load and whenever a
  // whole plan arrives (sample, accepted trace, import), and from Fit.
  const [exportOpen, setExportOpen] = useState(false)
  const [fitRequest, setFitRequest] = useState(1)
  const [fitting, setFitting] = useState(false)
  const fitRoomsRef = useRef(plan.rooms)
  fitRoomsRef.current = plan.rooms
  const fitBuilding = useCallback(() => {
    if (!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) setFitting(true)
    fitToContent(contentBox(fitRoomsRef.current))
    window.setTimeout(() => setFitting(false), 320)
  }, [fitToContent])
  useEffect(() => {
    if (!fitRequest) return
    const frame = requestAnimationFrame(() => fitBuilding())
    return () => cancelAnimationFrame(frame)
  }, [fitRequest, fitBuilding])

  const budget = useMemo(() => calculateChinaApartmentBudget(plan), [plan])
  const site = useMemo<SiteSpec>(() => siteOf(plan), [plan])
  const sun = useMemo(() => citySunPosition(projectLocation, day, hour, studyYear), [projectLocation, day, hour, studyYear])
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
    () => analyze({ plan, location: projectLocation }),
    [plan, projectLocation],
  )
  const codeIssues = useMemo(() => checkPlan(plan), [plan])
  const energySimulation = useMemo(() => simulateEnergy(plan, projectLocation.latitude), [plan, projectLocation])
  const airQualityReport = useMemo(() => analyzeAirQuality(plan), [plan])
  const carbon = useMemo(() => estimateApartmentCarbon(plan), [plan])
  const overlaps = useMemo(() => roomOverlaps(plan.rooms), [plan.rooms])

  const interior = useMemo(() => interiorBoq(plan, site, currency), [plan, site, currency])
  const [presetOpen, setPresetOpen] = useState(false)
  const [pendingTrace, setPendingTrace] = useState<PendingTrace | null>(null)
  const traceRequest = useRef<AbortController | null>(null)
  useEffect(() => () => traceRequest.current?.abort(), [])
  const [isTracing, setIsTracing] = useState(false)
  const [traceNote, setTraceNote] = useState<string | null>(null)
  const [isCatalogOpen, setIsCatalogOpen] = useState(false)
  const [catalogInspect, setCatalogInspect] = useState(false)
  const [catalogRoom, setCatalogRoom] = useState<string | null>(null)
  const [replacementId, setReplacementId] = useState<string | null>(null)
  const [replacementChoice, setReplacementChoice] = useState<FurnitureChoice | null>(null)
  const replacementResult = useMemo(() => replacementId && replacementChoice ? prepareFurnitureReplacement(plan, replacementId, replacementChoice) : null, [plan, replacementId, replacementChoice])
  const catalogPreviewPlan = useMemo(() => isCatalogOpen && replacementResult?.item ? { ...plan, furniture: plan.furniture.map(item => item.id === replacementId ? replacementResult.item : item) } : plan, [isCatalogOpen, plan, replacementId, replacementResult])
  const closeCatalog = useCallback(() => {
    setIsCatalogOpen(false); setCatalogInspect(false); setReplacementId(null); setReplacementChoice(null)
  }, [])
  const openCatalog = useCallback((replace = false) => {
    setCatalogInspect(false)
    setReplacementId(replace ? selectedFurniture : null)
    setReplacementChoice(null)
    const item = plan.furniture.find(piece => piece.id === selectedFurniture)
    const rect = item ? furnitureRectFor(item, siteOf(plan)) : null
    const owner = rect ? plan.rooms.find(room => rect.x + rect.w / 2 >= room.x && rect.x + rect.w / 2 <= room.x + room.w && rect.y + rect.h / 2 >= room.y && rect.y + rect.h / 2 <= room.y + room.h) : null
    setCatalogRoom(selectedRoom ?? owner?.id ?? null)
    setIsCatalogOpen(true)
  }, [plan, selectedFurniture, selectedRoom])
  const [isMeasuring, setIsMeasuring] = useState(false)
  // The line that explains the canvas follows the canvas, not the last tool
  // that was pressed: armed with the tape measure it used to go on saying
  // "click a wall to place a window".
  const toolHint = rulerArmed || isMeasuring ? MEASURE_HINT : furnitureTrayOpen ? FURNITURE_HINT : TOOL_HINTS[activeTool]
  const isEmpty = plan.rooms.length === 0
  const hasNapkinWalls = (plan.walls?.length ?? 0) > 0
  const isAuthoredSample = isAuthoredChinaApartment(plan)
  const projectTitle = isAuthoredSample ? CHINA_PROJECT_NAME : 'Untitled sketch'

  const commit = useCallback((next: PlanState | ((current: PlanState) => PlanState), label = 'Edit') => {
    setPast((items) => [...items.slice(-29), { state: plan, label, sketchUrl }])
    setPlan((current) => {
      const candidate = typeof next === 'function' ? next(current) : next
      return clearInvalidStatements(candidate, siteOf(candidate))
    })
    setFuture([])
  }, [plan, sketchUrl])

  const handleApplyStandardsIssue = useCallback((issue: StandardsCodeIssue) => {
    const action = issue.fixAction
    if (!action) return
    if (action.type === 'enlarge_opening') {
      commit((current) => ({
        ...current,
        openings: current.openings.map((o) =>
          o.id === action.openingId ? { ...o, widthM: Math.max(0.9, o.widthM ?? 0.9) } : o,
        ),
      }), 'Resize door to ADA clear width')
      setToast('Door widened to 0.9 m — undo if unwanted')
      return
    }
    if (action.type === 'set_ceiling') {
      commit((current) => ({
        ...current,
        rooms: current.rooms.map((r) =>
          r.id === action.roomId ? { ...r, wallHeight: action.meters } : r,
        ),
      }), `Set ceiling ${action.meters.toFixed(2)} m`)
      setToast(`Ceiling raised to ${action.meters.toFixed(2)} m — undo if unwanted`)
      return
    }
    if (action.type === 'add_exterior_door') {
      // Derive the placement before the updater — the updater stays pure and
      // toasts fire once, not inside setPlan (StrictMode runs updaters twice).
      const placement = exteriorDoorPlacement(plan, action.roomId)
      if (!placement) {
        setToast('No exterior wall on that room — connect it through a door to a room that has one')
        return
      }
      const newOpening: Opening = {
        id: `code-door-${Date.now()}`,
        type: 'door',
        x: placement.x,
        y: placement.y,
        rotation: placement.rotation,
        widthM: 0.9,
        heightM: 2.1,
      }
      commit((current) => ({ ...current, openings: [...current.openings, newOpening] }), 'Add egress door')
      setToast(placement.crowded
        ? `Every ${placement.compass}-wall slot was taken — door added at the midpoint, drag it clear`
        : `Exterior door added on the ${placement.compass} wall — undo if unwanted`)
    }
  }, [commit, plan])

  const updateOpening = useCallback((id: string, updates: Partial<Opening>) => {
    commit((current) => ({
      ...current,
      openings: current.openings.map((o) => (o.id === id ? updateOpeningDimensions(o, updates) : o)),
    }), 'Adjust opening')
  }, [commit])

  const handlePinBaseline = useCallback(() => {
    commit(current => pinBaseline(current), 'Pin Plan A')
    setToast('Plan A pinned as baseline! Modify your drawing to compare Plan B side-by-side.')
  }, [commit])

  const handleOpenABComparison = useCallback(() => {
    if (!pinnedBaseline) return
    setABComparisonModalOpen(true)
  }, [pinnedBaseline])

  const handleApplyProposedAsBaseline = useCallback(() => {
    if (!pinnedBaseline) return
    commit(current => pinBaseline(current, pinnedBaseline.baselineName), 'Pin Plan B as Plan A')
    setToast('Plan B promoted to new baseline Plan A!')
  }, [commit, pinnedBaseline])

  const handleRestoreBaseline = useCallback(() => {
    if (!pinnedBaseline) return
    commit(restoreBaseline, 'Restore Plan A')
    setSelectedRoom(null); setSelectedOpening(null); setSelectedFurniture(null)
    setFitRequest(n => n + 1)
    setABComparisonModalOpen(false)
    setToast('Plan A restored — Undo returns to Plan B.')
  }, [commit, pinnedBaseline])

  const comparisonConditionsLabel = `${projectLocation.label} · ${new Date(Date.UTC(studyYear, 0, day)).toISOString().slice(0, 10)} · ${clockLabel(hour)} · ${projectLocation.timezone}`

  const abComparisonResult = useMemo(() => {
    if (!pinnedBaseline) return null
    return comparePlans(pinnedBaseline.baselinePlan, plan, {
      label: comparisonConditionsLabel,
      sunAzimuth: sun.azimuth, sunAltitude: sun.altitude, outsideC, windFrom, windSpeed,
    })
  }, [pinnedBaseline, plan, comparisonConditionsLabel, sun.azimuth, sun.altitude, outsideC, windFrom, windSpeed])


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
    closeCatalog()
    if (nav.inspector !== undefined) setInspectorOpen(nav.inspector)
    setSettingsOpen(false)
    if (nav.mode) setMode(nav.mode)
    if (nav.view) setView(nav.view)
    if (nav.tool) setActiveTool(nav.tool)
  }, [closeCatalog])

  const commitSnapshot = useCallback((snapshot: PlanState, label = 'Auto-save') => {
    setPast((items) => [...items.slice(-29), { state: snapshot, label, sketchUrl }])
    setPlan(current => clearInvalidStatements(current, siteOf(current)))
    setFuture([])
  }, [sketchUrl])

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
    onGuides: setAlignGuides,
  })

  useEffect(() => {
    setLastSaved('Saving…')
    // A share link is an import, not a permanent override of later local edits.
    if (window.location.hash.startsWith('#plan=')) {
      const url = new URL(window.location.href)
      url.hash = ''
      url.searchParams.delete('guide')
      url.searchParams.set('studio', '1')
      window.history.replaceState(null, '', url)
    }
    const save = () => {
      try {
        localStorage.setItem(CHINA_PROJECT_KEY, JSON.stringify(plan))
        // Never claim a save that did not happen. Without storage the plan lives
        // only in memory and in the Share link, and the user must be told.
        setLastSaved(storageIsPersistent() ? 'Saved locally' : 'Not saved — use Share to keep it')
      } catch { setLastSaved('Not saved — use Share to keep it') }
    }
    const timeout = window.setTimeout(save, 300)
    // Finish a pending edit before a quick reload or navigation can discard
    // the debounce timer. This also preserves the latest chosen city.
    window.addEventListener('pagehide', save)
    return () => {
      window.clearTimeout(timeout)
      window.removeEventListener('pagehide', save)
    }
  }, [plan])

  useEffect(() => {
    try { localStorage.setItem('designon:style-keywords:shanghai-50', styleKeywords) } catch { /* private mode or quota */ }
  }, [styleKeywords])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(null), 2600)
    return () => window.clearTimeout(timeout)
  }, [toast])

  const undo = useCallback(() => {
    const previous = past[past.length - 1]
    if (!previous) return
    setFuture((items) => [{ state: plan, label: previous.label, sketchUrl }, ...items])
    setPlan(previous.state)
    setSketchUrl(previous.sketchUrl)
    setTraceNote(null)
    setPast((items) => items.slice(0, -1))
    setToast(`Undid: ${previous.label}`)
  }, [past, plan, sketchUrl])

  const redo = useCallback(() => {
    const next = future[0]
    if (!next) return
    setPast((items) => [...items, { state: plan, label: next.label, sketchUrl }])
    setPlan(next.state)
    setSketchUrl(next.sketchUrl)
    setTraceNote(null)
    setFuture((items) => items.slice(1))
  }, [future, plan, sketchUrl])

  const applyRulerCalibration = useCallback(() => {
    const meters = Number(rulerMeters)
    if (!rulerLine) return
    if (!Number.isFinite(meters) || meters <= 0) {
      setToast('Type the real length of that line in meters')
      return
    }
    const { newSite, scaleRatio } = calibrateSiteFromNapkinLine(site, rulerLine, meters)
    const calibrated = recalibratePlan(plan, site, newSite)
    if (!calibrated) { setToast('Scale unchanged — a stated room measurement would not fit in that field.'); return }
    commit(calibrated, 'Calibrate scale')
    rulerLineRef.current = null
    setRulerLine(null)
    setRulerMeters('')
    setToast(`Scale calibrated ×${scaleRatio.toFixed(2)} — site is now ${newSite.w.toFixed(1)} × ${newSite.h.toFixed(1)} m`)
  }, [commit, rulerLine, rulerMeters, site, plan])

  const cancelRulerCalibration = useCallback(() => {
    rulerLineRef.current = null
    setRulerLine(null)
    setRulerMeters('')
    setRulerArmed(false)
  }, [])

  const finalizeRulerLine = useCallback(() => {
    rulerPointerRef.current = null
    setRulerArmed(false)
    const line = rulerLineRef.current
    const lengthPct = line ? Math.hypot(line.p2.x - line.p1.x, line.p2.y - line.p1.y) : 0
    if (!line || lengthPct < 2) {
      rulerLineRef.current = null
      setRulerLine(null)
      setToast('Drag a longer line along a wall you know the length of')
    }
  }, [])

  const finalizeDrawnRoom = useCallback(() => {
    drawPointerRef.current = null
    const points = strokePointsRef.current
    strokePointsRef.current = []
    setDraftStroke(null)
    const result = applyNapkinStroke(plan, points, site)
    if (!result.plan) {
      setToast(result.toast)
      return
    }
    commit(result.plan, result.label)
    setSelectedRoom(result.selectRoom ?? null)
    setSelectedOpening(result.selectOpening ?? null)
    setSelectedFurniture(result.selectFurniture ?? null)
    setMode('plan')
    if (result.selectRoom) setSettingsOpen(false)
    setToast(result.toast)
  }, [commit, plan, site])

  const handleCanvasPointerDown = useCallback((event: ReactPointerEvent) => {
    // "The pointer moved" is a fact about one interaction, so it starts again
    // at every press. A drag that happened earlier must not veto a click that
    // happens now.
    panMovedRef.current = false
    if (rulerArmed) {
      if (rulerPointerRef.current !== null) return
      const bounds = stageRef.current?.getBoundingClientRect()
      if (!bounds) return
      const point = clientToPercent(event.clientX, event.clientY, bounds)
      if (!point) return
      rulerPointerRef.current = event.pointerId
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Synthetic pointers (tests) have no active pointer to capture.
      }
      rulerLineRef.current = { p1: point, p2: point }
      setRulerLine(rulerLineRef.current)
      return
    }
    if (activeTool === 'draw') {
      if (drawPointerRef.current !== null) return
      const bounds = stageRef.current?.getBoundingClientRect()
      if (!bounds) return
      const point = clientToPercent(event.clientX, event.clientY, bounds)
      if (!point) return
      drawPointerRef.current = event.pointerId
      try {
        event.currentTarget.setPointerCapture(event.pointerId)
      } catch {
        // Synthetic pointers (tests) have no active pointer to capture.
      }
      strokePointsRef.current = [point]
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
    // Tape measure live preview — update the endpoint while the user moves
    if (isMeasuring && measureStart) {
      const bounds = stageRef.current?.getBoundingClientRect()
      if (bounds) {
        const point = clientToPercent(event.clientX, event.clientY, bounds)
        if (point) setMeasureEnd(point)
      }
    }
    if (rulerPointerRef.current === event.pointerId) {
      const bounds = stageRef.current?.getBoundingClientRect()
      if (!bounds || !rulerLineRef.current) return
      const point = clientToPercent(event.clientX, event.clientY, bounds)
      if (!point) return
      rulerLineRef.current = { ...rulerLineRef.current, p2: point }
      setRulerLine(rulerLineRef.current)
      return
    }
    if (drawPointerRef.current === event.pointerId) {
      const bounds = stageRef.current?.getBoundingClientRect()
      if (!bounds) return
      const point = clientToPercent(event.clientX, event.clientY, bounds)
      if (!point) return
      strokePointsRef.current = appendStrokePoint(strokePointsRef.current, point)
      setDraftStroke(strokePointsRef.current)
      return
    }
    onViewportPointerMove(event)
    // "The pointer moved" has to mean moved *while the button was down* — a
    // drag, not a hover. Raising the flag on a hover meant that moving the
    // mouse to a wall was enough to make the next click look like a drag, and
    // the Window and Door tools silently did nothing: the tool said "click a
    // wall to place a window" and the click was swallowed.
    if (event.buttons !== 0 && Math.abs(event.movementX) + Math.abs(event.movementY) > 2) {
      panMovedRef.current = true
    }
  }, [isGesturing, isMeasuring, measureStart, onViewportPointerMove, plan.rooms, selectedRoom])

  const handleCanvasPointerUp = useCallback((event: ReactPointerEvent) => {
    setLiveDragRect(null)
    if (rulerPointerRef.current === event.pointerId) {
      finalizeRulerLine()
      return
    }
    if (drawPointerRef.current === event.pointerId) {
      finalizeDrawnRoom()
      return
    }
    onViewportPointerUp(event)
  }, [finalizeDrawnRoom, finalizeRulerLine, onViewportPointerUp])

  const handleCanvasPointerCancel = useCallback((event: ReactPointerEvent) => {
    setLiveDragRect(null)
    if (rulerPointerRef.current === event.pointerId) {
      finalizeRulerLine()
    }
    if (drawPointerRef.current === event.pointerId) {
      finalizeDrawnRoom()
    }
    onViewportPointerUp(event)
  }, [finalizeDrawnRoom, finalizeRulerLine, onViewportPointerUp])

  const handleCanvasClick = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    if (panMovedRef.current || isGesturing()) return

    // Tape measure: first click sets the start, second click sets the end
    // and freezes the line. A third click starts a new measurement.
    if (isMeasuring) {
      const bounds = stageRef.current?.getBoundingClientRect()
      if (!bounds) return
      const point = clientToPercent(event.clientX, event.clientY, bounds)
      if (!point) return
      if (!measureStart) {
        setMeasureStart(point)
        setMeasureEnd(point)
        setToast('Click again to set the end point')
      } else {
        setMeasureEnd(point)
        const line = calculateMeasureDistance(measureStart, point, site.w, site.h)
        setToast(`Distance: ${line.distanceMeters.toFixed(2)} m (${line.distanceFeet.toFixed(2)} ft)`)
        // Reset start so the next click starts a new measurement
        setMeasureStart(null)
      }
      return
    }

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
  }, [activeTool, commit, isGesturing, isMeasuring, measureStart, placeOpeningAt, site.h, site.w])

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

  /**
   * State a room's real width or depth. The far edge of the room moves to the
   * length that was given; the edge it was drawn from stays where it was. A
   * length that cannot be drawn is refused and the plan does not change — and
   * the room says why.
   */
  const stateRoomSize = useCallback((roomId: string, axis: SizeAxis, text: string): boolean => {
    const target = plan.rooms.find((item) => item.id === roomId)
    if (!target) return false
    const metres = parseLengthMetres(text)
    if (metres === null) {
      setToast(sizeRefusalMessage('not-a-number', axis, site))
      return false
    }
    const outcome = setRoomSizeM(target, site, axis, metres)
    if (!outcome.changed) {
      setToast(sizeRefusalMessage(outcome.refusal ?? 'not-a-number', axis, site))
      return false
    }
    commit((current) => ({
      ...current,
      rooms: current.rooms.map((item) => (item.id === roomId ? outcome.room : item)),
    }), `State the real ${axis === 'w' ? 'width' : 'depth'}`)
    setSelectedRoom(roomId)
    return true
  }, [commit, plan.rooms, site])

  const setWallHeight = useCallback((roomId: string, height: number) => {
    const rounded = Math.round(Math.min(4.5, Math.max(2.2, height)) * 20) / 20
    commit((current) => ({
      ...current,
      rooms: current.rooms.map((item) => (item.id === roomId ? { ...item, wallHeight: rounded } : item)),
    }))
  }, [commit])

  const addFurniture = useCallback((kind: FurnitureKind, label?: string, size?: { wM: number; dM: number }, assetId?: string) => {
    const item: Furniture = { id: `f-${crypto.randomUUID()}`, kind, label, ...size, ...(assetId ? { assetId } : {}), x: 0, y: 0, rotated: false }
    const placed = findFurniturePlacement(plan, item, isCatalogOpen ? catalogRoom : selectedRoom)
    if (!placed) {
      setToast(plan.rooms.length ? 'Could not find clear space at real size. Choose a larger room or move existing furniture.' : 'Draw a room before adding furniture.')
      return false
    }
    commit(current => ({ ...current, furniture: [...current.furniture, placed.item] }), 'Place furniture')
    setSelectedRoom(null)
    setSelectedOpening(null)
    setSelectedFurniture(item.id)
    setFurnitureTrayOpen(false)
    closeCatalog()
    setToast(`${label ?? furnitureCatalog[kind].label} placed at real size in ${placed.room.name}`)
    return true
  }, [catalogRoom, closeCatalog, commit, isCatalogOpen, plan, selectedRoom])

  const applyReplacement = useCallback(() => {
    if (!replacementId || !replacementChoice) return
    const result = prepareFurnitureReplacement(plan, replacementId, replacementChoice)
    if (!result.item) { setToast(result.error); return }
    commit(current => ({ ...current, furniture: current.furniture.map(item => item.id === replacementId ? result.item : item) }), 'Replace furniture')
    setSelectedFurniture(replacementId); setSelectedRoom(null); setSelectedOpening(null)
    closeCatalog()
    setToast(`${result.item.label} applied at real size — Undo restores the previous piece`)
  }, [closeCatalog, commit, plan, replacementChoice, replacementId])

  const rotateFurniture = useCallback(() => {
    const target = plan.furniture.find(item => item.id === selectedFurniture)
    if (!target) return
    if (!rotateFurnitureAtCentre(target, site, furnitureBounds(plan, target))) {
      setToast(`${furnitureLabelFor(target)} cannot turn here without passing through a wall.`)
      return
    }
    commit((current) => ({
      ...current,
      furniture: current.furniture.map((item) => {
        if (item.id !== selectedFurniture) return item
        return rotateFurnitureAtCentre(item, site, furnitureBounds(current, item)) ?? item
      }),
    }))
  }, [commit, plan, selectedFurniture, site])

  const moveSpatialFurniture = useCallback((id: string, x: number, y: number) => {
    const item = plan.furniture.find(piece => piece.id === id)
    if (!item) return
    const moved = moveFurnitureTo(item, x, y, site, furnitureBounds(plan, item))
    if (!moved || (moved.x === item.x && moved.y === item.y)) return
    commit(current => ({ ...current, furniture: current.furniture.map(piece => piece.id === id ? moved : piece) }), 'Move furniture in 3D')
  }, [commit, plan, site])

  const duplicateFurniture = useCallback(() => {
    if (!furnitureItem) return
    const rect = furnitureRectFor(furnitureItem, site)
    const owningRoom = plan.rooms.find(room => rect.x + rect.w / 2 >= room.x && rect.x + rect.w / 2 <= room.x + room.w && rect.y + rect.h / 2 >= room.y && rect.y + rect.h / 2 <= room.y + room.h)
    const placed = findFurniturePlacement(plan, { ...furnitureItem, id: `f-${crypto.randomUUID()}` }, owningRoom?.id)
    if (!placed) { setToast('Could not find clear space for a copy at real size. Move existing furniture first.'); return }
    commit(current => ({ ...current, furniture: [...current.furniture, placed.item] }), 'Duplicate furniture')
    setSelectedFurniture(placed.item.id)
    setToast(`${furnitureLabelFor(placed.item)} copied into ${placed.room.name}`)
  }, [commit, furnitureItem, plan, site])

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
    if (file.size > MAX_PROJECT_BYTES) {
      setToast('Project file is too large (maximum 2 MB)')
      return
    }
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
        const wrapperLocation = typeof parsed === 'object' && parsed !== null && 'location' in parsed
          ? sanitizeLocation((parsed as { location: unknown }).location) : undefined
        commit({ ...next, location: next.location ?? wrapperLocation ?? starterLocations[0] }, 'Import project')
        setSelectedRoom(next.rooms[0]?.id ?? null)
        setSelectedOpening(null)
        setSelectedFurniture(null)
        setToast('Project imported')
        setFitRequest((n) => n + 1)
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
      if (isCatalogOpen) return // Catalogue keys must not edit the accepted drawing underneath a trial.
      const target = event.target as HTMLElement | null
      if (target?.closest('dialog')) return
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

      // Tool shortcuts — V/W/O/D/M/S, advertised by the FloatingToolbar.
      // Walk mode owns WASD; skip plan-tool bindings so W does not switch to Draw.
      if (!walkMode) {
        const toolKey = event.key.toLowerCase()
        if (toolKey === 'v') { event.preventDefault(); setActiveTool('select'); return }
        if (toolKey === 'w') { event.preventDefault(); setActiveTool('draw'); return }
        if (toolKey === 'o') { event.preventDefault(); setActiveTool('window'); return }
        if (toolKey === 'd') { event.preventDefault(); setActiveTool('door'); return }
        if (toolKey === 'm') { event.preventDefault(); setIsMeasuring((prev) => !prev); return }
        if (toolKey === 's') {
          event.preventDefault()
          setPresetOpen(true)
          return
        }
      }

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
        setIsMeasuring(false)
        setMeasureStart(null)
        setMeasureEnd(null)
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
          const item = plan.furniture.find(piece => piece.id === selectedFurniture)
          if (!item) return
          const moved = moveFurnitureTo(item, item.x + dx, item.y + dy, site, furnitureBounds(plan, item))
          if (!moved || (moved.x === item.x && moved.y === item.y)) return
          commit((current) => ({
            ...current,
            furniture: current.furniture.map(piece => piece.id === selectedFurniture ? moved : piece),
          }), 'Nudge furniture')
        }
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [commit, deleteFurniture, deleteOpening, deleteRoom, isCatalogOpen, plan, redo, selectedFurniture, selectedOpening, selectedRoom, site, undo, walkMode])

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
    commit({ ...chinaApartmentPlan, location: starterLocations[0] }, 'Restore sample apartment')
    setSelectedRoom('living')
    setSelectedOpening(null)
    setFitRequest((n) => n + 1)
    setStyleKeywords(SAMPLE_STYLE_KEYWORDS)
    setToast('Shanghai 50 m² apartment restored')
  }, [commit])

  // Start from a truly blank napkin — empty dotted canvas.
  const startBlank = useCallback(() => {
    commit({ ...blankPlan(), location: projectLocation }, 'Start blank canvas')
    setSelectedRoom(null)
    setSelectedOpening(null)
    setSelectedFurniture(null)
    setActiveTool('draw')
    resetView()
    setTraceNote(null)
    setStyleKeywords('')
    setToast('Blank canvas — draw a room or upload a plan to trace')
  }, [commit, resetView, projectLocation])

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
    // This axis is the new scale reference, so it explicitly supersedes its
    // previous statement. Other stated room axes retain their physical size.
    const referencePlan = { ...plan, rooms: plan.rooms.map(item => item.id === selected.id
      ? { ...item, statedSize: { ...item.statedSize, [axis]: undefined } } : item) }
    const calibrated = recalibratePlan(referencePlan, siteOf(plan), calibrateSiteFromRoom(siteOf(plan), selected, axis, knownMeters))
    if (!calibrated) { setToast('Scale unchanged — a stated room measurement would not fit in that field.'); return }
    const reference = calibrated.rooms.find(item => item.id === selected.id)!
    const stated = setRoomSizeM(reference, siteOf(calibrated), axis, knownMeters)
    if (stated.refusal) { setToast('Scale unchanged — the reference measurement would not fit.'); return }
    calibrated.rooms = calibrated.rooms.map(item => item.id === selected.id ? stated.room : item)
    commit(calibrated)
    setToast(`Whole drawing calibrated from ${knownMeters.toFixed(1)} m ${axis === 'w' ? 'width' : 'depth'}`)
  }, [commit, plan, selectedRoom])

  /**
   * Start a fresh napkin. This is the second-visit path: without it a returning
   * user had no way to begin another drawing, because the welcome gate only
   * shows once and the blank-canvas button lived inside a default-closed panel.
   * Clears the previous photo underlay too, so a new sketch never inherits the
   * last trace's drawing. Goes through commit, so undo brings it all back.
   */
  const newSketch = useCallback(() => {
    startBlank()
    setSketchUrl(null)
    setSelectedRoom(null)
    setToast('Fresh napkin — draw it, or upload a photo to trace')
  }, [startBlank])

  const enterStudio = useCallback(() => {
    writeWelcomeDismissed()
    setWelcomeOpen(false)
    setEntryRoute('studio')
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>('.view-switch button.active')?.focus())
  }, [])

  // AI trace: read a plan from an uploaded image via the Gemini vision worker.
  const traceFileInputRef = useRef<HTMLInputElement>(null)
  const traceImage = useRef<string | null>(null)
  const cancelTrace = useCallback(() => {
    traceRequest.current?.abort()
    traceRequest.current = null
    setIsTracing(false)
    setPendingTrace(null)
  }, [])
  /** Kept so a failed or timed-out trace can be retried without re-picking the file. */
  const startTrace = useCallback(async (image: string) => {
    traceRequest.current?.abort()
    const controller = new AbortController()
    traceRequest.current = controller
    setIsTracing(true)
    setPendingTrace({ image, plan: null, note: '' })
    try {
      const source = new Image()
      source.src = image
      await source.decode()
      if (traceRequest.current !== controller) return
      const field = traceSiteFromImage(source.naturalWidth, source.naturalHeight)
      const result = await tracePlanFromImage({ imageDataUrl: image, siteW: field.w, siteH: field.h, signal: controller.signal })
      if (traceRequest.current !== controller) return
      setQuotaLeft(result.remaining)
      setPendingTrace({ image, plan: result.plan, note: result.note })
    } catch (error) {
      if (traceRequest.current !== controller) return
      setPendingTrace({ image, plan: null, note: '', error: error instanceof Error ? error.message : 'Plan trace failed' })
    } finally {
      if (traceRequest.current === controller) setIsTracing(false)
    }
  }, [])
  const runTrace = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024) {
      setToast('Choose a PNG, JPEG or WebP floor plan under 10 MB')
      return
    }
    if (quotaLeft <= 0) { setToast('Daily AI limit reached (3/day)'); return }
    const reader = new FileReader()
    reader.onerror = () => { setToast('Could not read that image') }
    reader.onload = () => { traceImage.current = String(reader.result); startTrace(traceImage.current) }
    reader.readAsDataURL(file)
  }, [quotaLeft, startTrace])
  const retryTrace = useCallback(() => {
    if (isTracing || !traceImage.current) return
    if (quotaLeft <= 0) { setToast('Daily AI limit reached (3/day)'); return }
    startTrace(traceImage.current)
  }, [isTracing, quotaLeft, startTrace])
  const acceptTrace = (next: PlanState) => {
    if (!pendingTrace || isTracing) return
    commit({ ...next, location: projectLocation, studyScenes: plan.studyScenes, comparison: plan.comparison }, 'Accept calibrated trace')
    setSketchUrl(pendingTrace.image)
    setSelectedRoom(next.rooms[0]?.id ?? null)
    setSelectedOpening(null)
    setSelectedFurniture(null)
    setMode('plan')
    setView('plan')
    setSettingsOpen(false)
    setInspectorOpen(true)
    setStyleKeywords('')
    setTraceNote('Accepted AI draft. Check room boundaries, openings and assumed dimensions before analysis.')
    setFitRequest((n) => n + 1)
    setToast('Calibrated draft accepted — undo restores the previous plan')
    cancelTrace()
  }

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
        locationLabel: projectLocation.label,
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
  }, [hour, isRendering, projectLocation, plan, quotaLeft, styleKeywords])

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
    } else if (prompt.includes('render') || prompt.includes('wireframe') || prompt.includes('3d') || prompt.includes('shadow')) {
      setView('spatial')
      setToast('Local 3D light study opened — no AI request')
    } else if (prompt.includes('photo') || prompt.includes('image')) {
      setView('spatial')
      void runConceptRender()
    } else {
      setToast('Quick actions: “brighter”, “add room”, “budget”, “energy”, or “concept photo”')
    }
    setAssistantText('')
  }, [addRoom, assistantText, commit, plan.rooms, runConceptRender, selectedRoom, site])

  const exportPlan = useCallback(() => {
    const blob = new Blob([JSON.stringify({
      project: projectTitle,
      location: projectLocation,
      orientation: 'North up',
      exportedAt: new Date().toISOString(),
      plan,
      budget,
      carbon,
      lightingChannels: isAuthoredSample ? chinaLightingChannels : [],
    }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = isAuthoredSample ? 'south-light-shanghai-50.json' : 'designon-sketch.json'
    anchor.click()
    URL.revokeObjectURL(url)
    setToast('Project file exported')
  }, [budget, carbon, isAuthoredSample, projectLocation, plan, projectTitle])

  const viewportStyle = useMemo(() => ({
    transform: `translate(${viewport.panX}px, ${viewport.panY}px) scale(${viewport.zoom})`,
    transformOrigin: 'center center',
    transition: fitting ? 'transform 280ms cubic-bezier(0.2, 0.8, 0.2, 1)' : undefined,
  }), [viewport.panX, viewport.panY, viewport.zoom, fitting])

  const localLightControls = (
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
  )

  const localSpatialView = (footer?: ReactNode) => (
    <Suspense fallback={<div className="spatial-note">Loading 3D…</div>}>
      <Spatial3D
        theme={theme}
        plan={catalogPreviewPlan}
        previewingFurniture={catalogPreviewPlan !== plan}
        footer={footer}
        trialControls={catalogInspect && replacementResult?.item && <div className="spatial-trial-controls" aria-label="Replacement preview actions">
          <strong>{replacementChoice?.label}</strong><span>{replacementChoice?.wM.toFixed(2)} × {replacementChoice?.dM.toFixed(2)} m</span>
          <button type="button" onClick={() => setCatalogInspect(false)}>Back to choices</button>
          <button type="button" onClick={applyReplacement}>Apply replacement</button>
          <button type="button" onClick={closeCatalog}>Cancel</button>
          <small role="status">Replacement preview only. Apply updates the drawing and technical checks.</small>
        </div>}
        sunAzimuth={sun.azimuth}
        sunAltitude={sun.altitude}
        selectedRoom={selectedRoom}
        onSelectRoom={id => { if (catalogPreviewPlan === plan) setSelectedRoom(id) }}
        selectedFurniture={selectedFurniture}
        onSelectFurniture={id => { if (catalogPreviewPlan !== plan) return; setSelectedFurniture(id); setSelectedRoom(null); setSelectedOpening(null) }}
        onMoveFurniture={moveSpatialFurniture}
        onRotateFurniture={rotateFurniture}
        onDuplicateFurniture={duplicateFurniture}
        onDeleteFurniture={deleteFurniture}
        onOpenFurnitureCatalog={() => openCatalog()}
        onReplaceFurniture={() => openCatalog(true)}
        onSetWallHeight={setWallHeight}
        hour={hour}
        day={day}
        locationLabel={projectLocation.label}
        ghost={isEmpty}
        location={projectLocation}
        projectTitle={projectTitle}
        year={studyYear}
        onStudyTimeChange={(d: number, h: number, y: number) => { setDay(d); setHour(h); setStudyYear(y) }}
        onScenesChange={(scenes: StudyScene[]) => commit(current => ({ ...current, studyScenes: scenes.length ? scenes : undefined }), 'Save study views')}
        onRecallScene={(scene: StudyScene) => {
          setDay(scene.day); setHour(scene.hour); setStudyYear(scene.year)
          setWalkMode(false); setTourChapterIndex(null); setSelectedRoom(null)
          if (JSON.stringify(scene.location) !== JSON.stringify(projectLocation)) commit(current => ({ ...current, location: scene.location }), 'Recall study location')
        }}
        tourWaypoint={tourChapterIndex !== null ? tourChapters[tourChapterIndex]?.camera : null}
        walkMode={walkMode}
        onToggleWalkMode={() => setWalkMode((prev) => !prev)}
        onStartTour={() => { setTourChapterIndex(0); setSelectedRoom(null); setWalkMode(false); setToast('Your drawing in 3D · 1 of 4') }}
        onOpenScenarios={() => { setSelectedRoom(null); setScenariosOpen(true) }}
        windFrom={windFrom}
        windSpeed={windSpeed}
      />
    </Suspense>
  )

  return (
    <div className="app-shell">
      <input ref={traceFileInputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={runTrace} hidden />
      {presetOpen && <LayoutPresetDialog onClose={() => setPresetOpen(false)} onApply={next => {
        commit(current => ({ ...next, location: projectLocation, studyScenes: current.studyScenes, comparison: current.comparison }), 'Apply layout preset')
        setSelectedRoom(next.rooms[0]?.id ?? null)
        setSelectedOpening(null)
        setSelectedFurniture(null)
        setSketchUrl(null)
        setStyleKeywords('')
        setPresetOpen(false)
        setToast('Layout preset applied — undo restores the previous plan')
      }} />}
      {exportOpen && <ExportDialog
        plan={plan}
        baseName={isAuthoredSample ? 'south-light-shanghai-50' : 'designon-sketch'}
        onClose={() => setExportOpen(false)}
        onExportProject={exportPlan}
        onDone={(message) => { setToast(message); setExportOpen(false) }}
      />}
      {pendingTrace && <TraceReview draft={pendingTrace} busy={isTracing} onCancel={cancelTrace} onAccept={acceptTrace} onRetry={retryTrace} />}
      <TopBar
        projectName={projectTitle}
        lastSaved={lastSaved}
        inspectorOpen={inspectorOpen}
        onToggleInspector={() => setInspectorOpen((open) => !open)}
        onOpenSettings={() => {
          setSettingsOpen(true)
          setInspectorOpen(true)
        }}
        exportPlan={() => setExportOpen(true)}
        sharePlan={shareProject}
        onNewSketch={newSketch}
        onOpenGuide={() => { setEntryRoute('guide'); setWelcomeOpen(true) }}
        onOpenShortcuts={() => setShortcutsOpen((prev) => !prev)}
        onToggleCatalog={() => isCatalogOpen ? closeCatalog() : openCatalog()}
        center={<div className="view-switch" role="group" aria-label="View mode">
          <button type="button" className={view === 'plan' ? 'active' : ''} onClick={() => { closeCatalog(); setView('plan') }}>Plan</button>
          <button type="button" className={view === 'spatial' ? 'active' : ''} onClick={() => setView('spatial')}>Spatial</button>
          <button type="button" className={view === 'renders' ? 'active' : ''} onClick={() => { closeCatalog(); setInspectorOpen(false); setView('renders') }}>Renders</button>
        </div>}
        actions={<div className="tool-group history-tools">
          <IconButton label="Undo" onClick={undo} disabled={!past.length}><Undo2 /></IconButton>
          <IconButton label="Redo" onClick={redo} disabled={!future.length}><Redo2 /></IconButton>
          <IconButton label="Concept photo" onClick={() => void runConceptRender()} disabled={isRendering || quotaLeft <= 0}><ImagePlus /></IconButton>
        </div>}
        meta={<>
          <span className="stage-area"><Ruler /> {budget.area.toFixed(1)} m²</span>
          <button type="button" className="location-toggle" title={projectLocation.label} aria-label={`${projectLocation.label} · Change city`} aria-expanded={locationOpen} onClick={() => setLocationOpen(open => !open)}><MapPin /><span>{projectLocation.name}</span></button>
        </>}
        onChangeLocation={() => setLocationOpen(true)}
        locationName={projectLocation.name}
        menuExtra={<>
          <ThemePicker theme={theme} onChange={next => { saveTheme(next); setTheme(next) }} />
          <WebAppAccess />
        </>}
      />

      <div className="workspace">
        <main className="design-stage">
          {locationOpen && <section className="location-workspace" aria-label="Project location and sun chart">
            <button className="location-close" type="button" onClick={() => setLocationOpen(false)}>Close city search</button>
            <CityPicker location={projectLocation} onChange={(next: ProjectLocation) => commit(current => ({ ...current, location: next }), 'Change project location')} />
            <SunChart latitude={projectLocation.latitude} location={projectLocation} day={day} hour={hour} year={studyYear} locationLabel={projectLocation.label} />
          </section>}

          <JourneyRail
            stages={journey.stages}
            progress={journey.progress}
            headline={journey.headline}
            onGo={(nav, stageId) => {
              markVisited(stageId as JourneyStageId)
              goToStage(nav)
            }}
          />

          <div className="canvas-tools" aria-label="Plan tools">
            {view === 'plan' && (
              <FloatingToolbar
                activeTool={activeTool}
                setActiveTool={(tool) => { setIsMeasuring(false); setActiveTool(tool) }}
                isMeasuring={isMeasuring}
                onToggleMeasure={() => setIsMeasuring(!isMeasuring)}
                onSynthesize={() => setPresetOpen(true)}
                onAddRoom={addRoom}
                onFurniture={() => setFurnitureTrayOpen((open) => !open)}
                furnitureOpen={furnitureTrayOpen}
              />
            )}
            {view === 'plan' && <button type="button" className="room-options-launch" disabled={isEmpty} onClick={() => setRoomOptionsOpen(true)}>Room options</button>}
            <div className="dock-history" aria-label="History">
              <IconButton label="Undo" onClick={undo} disabled={!past.length}><Undo2 /></IconButton>
              <IconButton label="Redo" onClick={redo} disabled={!future.length}><Redo2 /></IconButton>
            </div>
          </div>

          {view === 'plan' && (room || selectedOpening) && (
            <div className="canvas-selection">
              <ContextualActionBar
                room={room}
                opening={plan.openings.find((item) => item.id === selectedOpening)}
                site={site}
                onUpdateRoom={(updates) => updateRoom(updates)}
                onStateRoomSize={(axis, text) => stateRoomSize(room?.id ?? '', axis, text)}
                onDeleteRoom={() => deleteRoom()}
                onUpdateOpening={(id, updates) => updateOpening(id, updates)}
                onDeleteOpening={() => deleteOpening()}
              />
            </div>
          )}

          <section className={`canvas-frame${view === 'plan' ? ' is-plan' : ''}`} ref={frameRef} aria-label="House design canvas" onWheel={onWheel}>
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
                alignGuides={alignGuides}
                measureStart={measureStart}
                measureEnd={measureEnd}
                onRoomPointerDown={onRoomPointerDown}
                onRoomSelect={room => { setSelectedRoom(room.id); setSelectedOpening(null); setSelectedFurniture(null) }}
                onOpeningPointerDown={onOpeningPointerDown}
                onFurniturePointerDown={onFurniturePointerDown}
                onGesturePointerMove={onGesturePointerMove}
                onGesturePointerUp={onGesturePointerUp}
                onCanvasPointerDown={handleCanvasPointerDown}
                onCanvasPointerMove={handleCanvasPointerMove}
                onCanvasPointerUp={handleCanvasPointerUp}
                onCanvasPointerCancel={handleCanvasPointerCancel}
                onCanvasClick={handleCanvasClick}
                stageRef={stageRef}
              />
            ) : view === 'spatial' ? (
              <div className="spatial-wrap">
                {localSpatialView(localLightControls)}
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
                localView={localSpatialView()}
                localControls={!isEmpty && localLightControls}
                onRequestConcept={() => void runConceptRender()}
                isRendering={isRendering}
                quotaLeft={quotaLeft}
              />
            )}
            {view !== 'renders' && !isEmpty && (
              // The 3D view carries the snapshot on its own surface, so it does
              // not also stand it up as a separate row of the stage.
              view === 'spatial' ? null : (mode === 'light' && valueLens === 'off') ? localLightControls : valueLens === 'off' ? (
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
                <small className="site-dim">{site.w.toFixed(1)} × {site.h.toFixed(1)} m site</small>
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
            {view === 'plan' && isEmpty && !hasNapkinWalls && !draftStroke && !rulerArmed && !rulerLine && (
              <div className="canvas-empty">
                <Pencil />
                <h3>Draw like a napkin</h3>
                <p>A line is a wall. A tick on a wall is a door or a window. A box is a room — draw a bed inside it, or a WC in a small bath.</p>
                <div style={{ display: 'flex', gap: 8, pointerEvents: 'auto', flexWrap: 'wrap', justifyContent: 'center' }}>
                  <button className="button primary small" type="button" onClick={() => setActiveTool('draw')}>Draw a room</button>
                  <button className="button secondary small" type="button" onClick={() => traceFileInputRef.current?.click()} disabled={isTracing || quotaLeft <= 0}>
                    {isTracing ? 'Tracing…' : 'Upload plan → trace with AI'}
                  </button>
                  <button className="button secondary small" type="button" onClick={resetPlan}>Load sample</button>
                </div>

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
            {view === 'plan' && (
              <div className="draw-hint" role="status" style={{ visibility: draftStroke ? 'hidden' : undefined }}>
                <toolHint.Icon /> {toolHint.text}
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
                  <strong>{furnitureLabelFor(furnitureItem)}</strong>
                  <small>
                    {(() => {
                      const spec = furnitureSpecFor(furnitureItem)
                      return furnitureItem.rotated
                        ? `${spec.d} × ${spec.w} m`
                        : `${spec.w} × ${spec.d} m`
                    })()}
                    {furnitureConflicts.has(furnitureItem.id) ? ' · blocks a door swing' : ''}
                  </small>
                </span>
                <IconButton label="Replace furniture" onClick={() => openCatalog(true)}><Armchair /></IconButton>
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
            <FurnitureCatalogDrawer key={replacementId ?? 'add'}
              open={isCatalogOpen}
              onClose={closeCatalog}
              onAddFurniture={addFurniture}
              plan={plan} roomId={catalogRoom} onRoomChange={setCatalogRoom}
              replacementId={replacementId} replacementChoice={replacementChoice}
              onPreviewReplacement={choice => { setReplacementChoice(choice); if (choice && replacementId && prepareFurnitureReplacement(plan, replacementId, choice).item) setView('spatial') }} onApplyReplacement={applyReplacement}
              inspecting={catalogInspect} onInspectReplacement={() => { setCatalogInspect(true); setView('spatial') }}
            />

            {view === 'plan' && (
              <div className="zoom-control">
                <button type="button" onClick={zoomOut} aria-label="Zoom out" disabled={!canZoomOut}>−</button>
                <button type="button" className="zoom-label" onClick={fitBuilding} aria-label="Fit the building to the view" title="Fit the building to the view">{zoomPercent === 100 ? 'Fit' : `${zoomPercent}%`}</button>
                <button type="button" onClick={zoomIn} aria-label="Zoom in" disabled={!canZoomIn}>+</button>
              </div>
            )}
            {view === 'plan' && <PlanRoomKey rooms={plan.rooms} site={site} selectedRoom={selectedRoom}
              onSelect={room => { setSelectedRoom(room.id); setSelectedOpening(null); setSelectedFurniture(null) }} />}
            {toast && <div className="toast" role="status"><Check /> {toast}</div>}
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
          isAuthoredSample={isAuthoredSample}
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
          onStateRoomSize={(axis, text) => stateRoomSize(room?.id ?? '', axis, text)}
          calibrateRoomFromDimension={calibrateRoomFromDimension}
          applyVariant={applyVariant}
          patches={patches}
          directSunM2={directSunM2}
          projectLocation={projectLocation}
          setProjectLocation={next => commit(current => ({ ...current, location: next }), 'Change project location')}
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
          onOpenPresets={() => setPresetOpen(true)}
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
          standardsIssues={codeIssues}
          onApplyStandardsIssue={handleApplyStandardsIssue}
          energySimulation={energySimulation}
          airQualityReport={airQualityReport}
        />
      </div>
      <WelcomeGate
        open={welcomeOpen}
        hasDrawing={!!sketchUrl || plan.rooms.length > 0 || (plan.walls?.length ?? 0) > 0}
        onContinue={enterStudio}
        onStart={() => {
          enterStudio()
          newSketch()
          goToStage({ mode: 'plan', view: 'plan', tool: 'draw', inspector: false })
          setToast('Blank page ready — draw one room with your finger or mouse')
        }}
        onSkip={() => {
          enterStudio()
          resetPlan()
          setSketchUrl(null)
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
          latitude={projectLocation.latitude}
          locationLabel={projectLocation.label}
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
          baselinePlan={pinnedBaseline.baselinePlan}
          proposedPlan={plan}
          theme={theme}
          baselineName={pinnedBaseline.baselineName}
          proposedName="Proposed Iteration (Plan B)"
          onClose={() => setABComparisonModalOpen(false)}
          onApplyProposedAsBaseline={handleApplyProposedAsBaseline}
          onRestoreBaseline={handleRestoreBaseline}
        />
      )}

      {roomOptionsOpen && <Suspense fallback={<div role="status" className="toast toast-modal">Loading room options…</div>}><RoomOptionsDialog
        plan={plan}
        theme={theme}
        sunAzimuth={sun.azimuth}
        sunAltitude={sun.altitude}
        conditionsLabel={comparisonConditionsLabel}
        initialRoomId={selectedRoom}
        onClose={() => setRoomOptionsOpen(false)}
        onApply={(selected, option) => {
          const next = applyRoomOption(plan, selected, option)
          if (!next) { setToast('This option is no longer valid. Reopen room options to compare the current drawing.'); return }
          commit(next, `Apply ${option.title} in ${selected.name}`)
          setRoomOptionsOpen(false)
          setToast(`${option.title} applied — Undo restores the previous arrangement. Open Spatial for sun and shadows.`)
        }}
      /></Suspense>}

    </div>
  )
}


export default App
