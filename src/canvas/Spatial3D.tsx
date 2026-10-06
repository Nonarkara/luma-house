import { clockLabel } from '../location/solar'
import { themeTokens, type StudioTheme } from '../design/themes'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Edges, Grid, Html, OrbitControls, PivotControls, PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'

/**
 * Wireframe rendering — every architectural surface draws as a low-opacity paper
 * fill plus sharp ink-coloured line edges. Per-room fill is just enough to
 * read volume; the edges carry the drawing. Toggle to the legacy solid
 * dollhouse look from the toolbar.
 */
const WIREFILL_OPACITY = 0.18
const WIREEDGE_COLOR = '#0e1014' // Axiom ink
const WIREFILL_COLOR = '#faf7f1' // Axiom paper
import { furnitureRectFor, roomHeight, siteOf, sunVector } from '../plan'
import type { Furniture, FurnitureKind, Opening, PlanState, Room, SiteSpec } from '../types'
import { windFlowPotential } from '../analysis'
import type { Compass } from '../analysis'
import type { CameraWaypoint } from '../tour/guidedTour'
import { nextWalkPosition } from './walkNavigation'
import { openingDimensions } from '../openingGeometry'
import { solarShadowCamera, windowSunRay } from './solarScene'
import { Roof3D } from './Roof3D'
import { ROOF_STYLES, type RoofStyle } from './roofGeometry'
import type { OrbitControls as OrbitControl } from 'three-stdlib'
import { CameraRig } from '../study/CameraRig'
import { StudyPanel } from '../study/StudyPanel'
import { cutPart, modelBounds, physicalGeometryKey, wallParts } from '../study/geometry'
import type { DisplayStyle, StudyCamera, StudyCapture, StudyScene, StudySettings } from '../study/types'
import type { ProjectLocation } from '../types'

const HEIGHT_MIN = 2.2
const HEIGHT_MAX = 4.5
const HEIGHT_STEP = 0.1
const HEIGHT_SNAP = 0.05

const WALL_THICKNESS = 0.15
const FLOOR_THICKNESS = 0.1
const TERRACE_THICKNESS = 0.12

const FURNITURE_HEIGHTS: Record<FurnitureKind, number> = {
  bed: 0.55,
  sofa: 0.8,
  dining: 0.75,
  wardrobe: 2.0,
  desk: 0.75,
  wc: 0.42,
}

export type CameraPreset = 'orbit' | 'axonometric' | 'topdown'

// Percent plan coords → meters, centered at the scene origin. Y is up.
function toMeters(xPct: number, yPct: number, site: SiteSpec): { mx: number; mz: number } {
  return {
    mx: (xPct / 100) * site.w - site.w / 2,
    mz: (yPct / 100) * site.h - site.h / 2,
  }
}

function roomFootprint(room: Room, site: SiteSpec) {
  const nw = toMeters(room.x, room.y, site)
  const se = toMeters(room.x + room.w, room.y + room.h, site)
  return {
    cx: (nw.mx + se.mx) / 2,
    cz: (nw.mz + se.mz) / 2,
    width: se.mx - nw.mx,
    depth: se.mz - nw.mz,
    minX: nw.mx,
    maxX: se.mx,
    minZ: nw.mz,
    maxZ: se.mz,
  }
}

function clampHeight(value: number): number {
  const clamped = Math.max(HEIGHT_MIN, Math.min(HEIGHT_MAX, value))
  return Math.round(clamped / HEIGHT_SNAP) * HEIGHT_SNAP
}

function Wall({
  position,
  size,
  emissiveIntensity,
  onClick,
  wireframe,
  edgeColor,
  sectionHeight,
  architectural = false,
}: {
  architectural?: boolean
  position: [number, number, number]
  size: [number, number, number]
  emissiveIntensity: number
  onClick: (event: ThreeEvent<MouseEvent>) => void
  wireframe: boolean
  edgeColor: string
  sectionHeight?: number
}) {
  const cut = cutPart({ key: 'wall', position, size }, sectionHeight ?? Infinity)
  const visibleHeight = cut.height
  return (
    <group>
      <mesh position={position} castShadow raycast={() => {}}>
        <boxGeometry args={size} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
      {visibleHeight > 0 && <mesh position={[position[0], cut.y, position[2]]} receiveShadow onClick={onClick}>
      <boxGeometry args={[size[0], visibleHeight, size[2]]} />
      <meshStandardMaterial
        color={wireframe || architectural ? WIREFILL_COLOR : '#dfe0da'}
        roughness={0.9}
        metalness={0}
        emissive="#f59e0b"
        emissiveIntensity={emissiveIntensity}
        transparent={wireframe}
        depthWrite={!wireframe}
        opacity={wireframe ? WIREFILL_OPACITY : 1}
      />
      {(wireframe || architectural) && <Edges color={edgeColor} threshold={1} lineWidth={architectural ? 1.4 : 1} />}
    </mesh>}
      {architectural && cut.capped && <mesh position={[position[0], sectionHeight! + 0.002, position[2]]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => {}}>
        <planeGeometry args={[size[0], size[2]]} />
        <meshBasicMaterial color={edgeColor} side={THREE.DoubleSide} />
        <Edges color={edgeColor} lineWidth={2.5} />
      </mesh>}
    </group>
  )
}

type Footprint = ReturnType<typeof roomFootprint>

function SegmentedWall({ compass, room, plan, emissiveIntensity, onClick, wireframe, edgeColor, sectionHeight, architectural }: {
  compass: Compass; room: Room; plan: PlanState; emissiveIntensity: number
  onClick: (event: ThreeEvent<MouseEvent>) => void; wireframe: boolean
  edgeColor: string; sectionHeight?: number; architectural: boolean
}) {
  return <group>{wallParts(room, compass, plan).map(piece => <Wall
    key={piece.key} position={piece.position} size={piece.size}
    emissiveIntensity={emissiveIntensity} onClick={onClick} wireframe={wireframe}
    edgeColor={edgeColor} sectionHeight={sectionHeight} architectural={architectural}
  />)}</group>
}

function RoomVolume({
  room,
  plan,
  site,
  isSelected,
  onSelectRoom,
  sectionHeight,
  wireframe,
  edgeColor,
  architectural,
}: {
  architectural: boolean
  room: Room
  plan: PlanState
  site: SiteSpec
  isSelected: boolean
  onSelectRoom: (id: string | null) => void
  sectionHeight?: number
  wireframe: boolean
  edgeColor: string
}) {
  const footprint = useMemo(() => roomFootprint(room, site), [room, site])
  const fullHeight = roomHeight(room)

  const handleSelect = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      onSelectRoom(room.id)
    },
    [onSelectRoom, room.id],
  )

  if (room.kind === 'terrace') {
    return (
      <mesh
        position={[footprint.cx, TERRACE_THICKNESS / 2, footprint.cz]}
        receiveShadow
        onClick={handleSelect}
      >
        <boxGeometry args={[footprint.width, TERRACE_THICKNESS, footprint.depth]} />
        <meshStandardMaterial
          color={wireframe || architectural ? WIREFILL_COLOR : '#23262d'}
          roughness={0.9}
          metalness={0}
          transparent={false}
          opacity={1}
        />
        {(wireframe || architectural) && <Edges color={edgeColor} threshold={1} lineWidth={architectural ? 1.3 : 1} />}
      </mesh>
    )
  }

  const emissiveIntensity = isSelected ? 0.12 : 0

  return (
    <group>
      <mesh position={[footprint.cx, FLOOR_THICKNESS + fullHeight + 0.05, footprint.cz]} castShadow raycast={() => {}}>
        <boxGeometry args={[footprint.width, 0.1, footprint.depth]} />
        <meshBasicMaterial colorWrite={false} depthWrite={false} />
      </mesh>
      <mesh
        position={[footprint.cx, FLOOR_THICKNESS / 2, footprint.cz]}
        receiveShadow
        onClick={handleSelect}
      >
        <boxGeometry args={[footprint.width, FLOOR_THICKNESS, footprint.depth]} />
        <meshStandardMaterial
          color={wireframe || architectural ? WIREFILL_COLOR : (room.kind === 'bathroom' ? '#2a2c30' : '#1b1e24')}
          roughness={0.9}
          metalness={0}
          transparent={false}
          opacity={1}
        />
        {(wireframe || architectural) && <Edges color={edgeColor} threshold={1} lineWidth={architectural ? 1.3 : 1} />}
      </mesh>
      {(['N', 'S', 'W', 'E'] as Compass[]).map((compass) => (
        <SegmentedWall
          key={compass}
          compass={compass}
          room={room}
          plan={plan}
          architectural={architectural}
          emissiveIntensity={emissiveIntensity}
          onClick={handleSelect}
          wireframe={wireframe}
          edgeColor={edgeColor}
          sectionHeight={sectionHeight}
        />
      ))}
    </group>
  )
}

function OpeningPanel({ opening, site, wireframe, edgeColor, architectural, sectionHeight }: { opening: Opening; site: SiteSpec; wireframe: boolean; edgeColor: string; architectural: boolean; sectionHeight: number }) {
  const { mx, mz } = toMeters(opening.x, opening.y, site)
  const isWindow = opening.type === 'window'
  const { width, height: fullHeight, sill } = openingDimensions(opening)
  const height = Math.max(0, Math.min(fullHeight, sectionHeight - FLOOR_THICKNESS - sill))
  if (height <= 0) return null
  const y = FLOOR_THICKNESS + sill + height / 2
  const size: [number, number, number] =
    opening.rotation === 0 ? [width, height, WALL_THICKNESS] : [WALL_THICKNESS, height, width]
  const color = isWindow ? '#38444d' : '#8a4c16'

  return (
    <mesh position={[mx, y, mz]}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={wireframe || architectural ? WIREFILL_COLOR : color}
        roughness={0.9}
        metalness={0}
        transparent={wireframe || isWindow}
        opacity={wireframe ? WIREFILL_OPACITY : (isWindow ? 0.42 : 1)}
        emissive={isWindow ? '#f59e0b' : '#000000'}
        emissiveIntensity={isWindow ? 0.06 : 0}
      />
      {(wireframe || architectural) && <Edges color={edgeColor} threshold={1} lineWidth={1} />}
    </mesh>
  )
}


function FurniturePiece({ item, site, wireframe, edgeColor, architectural, sectionHeight }: { item: Furniture; site: SiteSpec; wireframe: boolean; edgeColor: string; architectural: boolean; sectionHeight: number }) {
  const rect = useMemo(() => furnitureRectFor(item, site), [item, site])
  const widthM = (rect.w / 100) * site.w
  const depthM = (rect.h / 100) * site.h
  const { mx, mz } = toMeters(rect.x + rect.w / 2, rect.y + rect.h / 2, site)
  const fullHeight = FURNITURE_HEIGHTS[item.kind]
  const height = Math.max(0, Math.min(fullHeight, sectionHeight - FLOOR_THICKNESS))

  return (
    <group>
    <mesh position={[mx, FLOOR_THICKNESS + fullHeight / 2, mz]} castShadow raycast={() => {}}>
      <boxGeometry args={[widthM, fullHeight, depthM]} /><meshBasicMaterial colorWrite={false} depthWrite={false} />
    </mesh>
    <mesh position={[mx, FLOOR_THICKNESS + height / 2, mz]}>
      <boxGeometry args={[widthM, height, depthM]} />
      <meshStandardMaterial
        color={wireframe || architectural ? WIREFILL_COLOR : '#8b8f98'}
        roughness={0.9}
        metalness={0}
        transparent={wireframe}
        opacity={wireframe ? WIREFILL_OPACITY : 1}
      />
      {(wireframe || architectural) && <Edges color={edgeColor} threshold={1} lineWidth={architectural ? 0.7 : 1} />}
    </mesh>
    </group>
  )
}

function VectorLine({
  start,
  end,
  color,
  opacity,
}: {
  start: [number, number, number]
  end: [number, number, number]
  color: string
  opacity: number
}) {
  const lineObj = useMemo(() => {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(...start),
      new THREE.Vector3(...end),
    ])
    const mat = new THREE.LineBasicMaterial({ color, transparent: true, opacity, linewidth: 2 })
    return new THREE.Line(geo, mat)
  }, [start, end, color, opacity])

  useEffect(() => () => {
    lineObj.geometry.dispose()
    ;(lineObj.material as THREE.Material).dispose()
  }, [lineObj])

  return <primitive object={lineObj} />
}

function SunRayVectors({
  plan,
  azimuth,
  altitude,
}: {
  plan: PlanState
  azimuth: number
  altitude: number
}) {
  if (altitude <= 2) return null
  return (
    <group>
      {plan.openings.map(opening => {
        const ray = windowSunRay(plan, opening, azimuth, altitude)
        return ray ? <VectorLine key={opening.id} start={ray.start} end={ray.end} color="#f59e0b" opacity={0.65} /> : null
      })}
    </group>
  )
}

function wallPoint(footprint: Footprint, compass: Compass): [number, number, number] {
  const y = FLOOR_THICKNESS + 1.2
  if (compass === 'N') return [footprint.cx, y, footprint.minZ]
  if (compass === 'S') return [footprint.cx, y, footprint.maxZ]
  if (compass === 'W') return [footprint.minX, y, footprint.cz]
  return [footprint.maxX, y, footprint.cz]
}

function AirflowPathVectors({
  plan,
  site,
  windFrom,
  windSpeed,
}: {
  plan: PlanState
  site: SiteSpec
  windFrom: number
  windSpeed: number
}) {
  const paths = useMemo(
    () => windFlowPotential(plan, windFrom, windSpeed).filter((room) => room.mode === 'through-flow' && room.inlet && room.outlet),
    [plan, windFrom, windSpeed],
  )

  return (
    <group>
      {paths.map((path) => {
        const footprint = roomFootprint(path.room, site)
        const start = wallPoint(footprint, path.inlet!)
        const end = wallPoint(footprint, path.outlet!)
        return <VectorLine key={`air-${path.room.id}`} start={start} end={end} color="#f59e0b" opacity={0.9} />
      })}
    </group>
  )
}


function SunLight({ azimuth, altitude, site, shadows, geometryKey }: { azimuth: number; altitude: number; site: SiteSpec; shadows: boolean; geometryKey: string }) {
  const light = useRef<THREE.DirectionalLight>(null)
  const invalidate = useThree(state => state.invalidate)
  useLayoutEffect(() => {
    if (light.current) light.current.shadow.needsUpdate = true
    invalidate()
  }, [geometryKey, azimuth, altitude, shadows, invalidate])
  const direction = useMemo(() => sunVector(azimuth, altitude), [azimuth, altitude])
  const isNight = altitude <= 0
  const shadow = solarShadowCamera(site)
  const distance = shadow.distance
  const position: [number, number, number] = [direction.x * distance, direction.y * distance, direction.z * distance]

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight
        ref={light}
        shadow-autoUpdate={false}
        position={position}
        intensity={isNight ? 0 : 2.2}
        castShadow={!isNight && shadows}
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0001}
        shadow-normalBias={0.025}
        shadow-camera-near={0.1}
        shadow-camera-far={shadow.far}
        shadow-camera-left={shadow.left}
        shadow-camera-right={shadow.right}
        shadow-camera-top={shadow.top}
        shadow-camera-bottom={shadow.bottom}
      />
    </>
  )
}

function HeightHandle({
  room,
  site,
  onSetWallHeight,
}: {
  room: Room
  site: SiteSpec
  onSetWallHeight: (roomId: string, height: number) => void
}) {
  const footprint = useMemo(() => roomFootprint(room, site), [room, site])
  const height = roomHeight(room)
  const startHeightRef = useRef(height)

  const handleDragStart = useCallback(() => {
    startHeightRef.current = roomHeight(room)
  }, [room])

  const handleDrag = useCallback(
    (_l: THREE.Matrix4, _deltaL: THREE.Matrix4, _w: THREE.Matrix4, deltaW: THREE.Matrix4) => {
      const deltaY = deltaW.elements[13]
      onSetWallHeight(room.id, clampHeight(startHeightRef.current + deltaY))
    },
    [onSetWallHeight, room.id],
  )

  const step = useCallback(
    (delta: number) => {
      onSetWallHeight(room.id, clampHeight(roomHeight(room) + delta))
    },
    [onSetWallHeight, room],
  )

  return (
    <group position={[footprint.cx, height, footprint.cz]}>
      <PivotControls
        activeAxes={[false, true, false]}
        disableRotations
        disableScaling
        depthTest={false}
        scale={1.2}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
      />
      <Html center position={[0, 0.6, 0]}>
        <div className="spatial-chip">
          <strong>{room.name}</strong>
          <span>{height.toFixed(2)} m</span>
          <div className="spatial-chip-controls">
            <button type="button" onClick={() => step(-HEIGHT_STEP)} aria-label="Lower wall height">−</button>
            <button type="button" onClick={() => step(HEIGHT_STEP)} aria-label="Raise wall height">+</button>
          </div>
        </div>
      </Html>
    </group>
  )
}

function CameraController({
  walking,
  preset,
  waypoint,
  controlsRef,
}: {
  walking: boolean
  preset: CameraPreset
  waypoint?: CameraWaypoint | null
  controlsRef: React.RefObject<OrbitControl>
}) {
  const { camera, invalidate } = useThree()
  useEffect(() => { invalidate() }, [preset, waypoint, walking, invalidate])
  useFrame(() => {
    if (walking) return
    const position = waypoint?.position ?? null
    if (!position) return
    const targetPos = new THREE.Vector3(...position as [number, number, number])
    const targetLook = new THREE.Vector3(...(waypoint?.target ?? (preset === 'topdown' ? [0, 0, 0] : [0, 1, 0])) as [number, number, number])
    const moving = camera.position.distanceTo(targetPos) > 0.005 ||
      (controlsRef.current?.target?.distanceTo(targetLook) ?? 0) > 0.005 ||
      (waypoint && camera instanceof THREE.PerspectiveCamera && Math.abs(camera.fov - waypoint.fov) > 0.01)
    if (!moving) return
    camera.position.lerp(targetPos, 0.08)
    if (controlsRef.current?.target) {
      controlsRef.current.target.lerp(targetLook, 0.08)
      controlsRef.current.update()
    }
    if (waypoint && camera instanceof THREE.PerspectiveCamera) {
      camera.fov += (waypoint.fov - camera.fov) * 0.08
      camera.updateProjectionMatrix()
    }
    invalidate()
  })

  return null
}

function WalkController({
  active,
  plan,
  site,
  selectedRoom,
}: {
  active: boolean
  plan: PlanState
  site: SiteSpec
  selectedRoom: string | null
}) {
  const { camera, invalidate } = useThree()
  const pressed = useRef(new Set<string>())
  const direction = useRef(new THREE.Vector3())

  useEffect(() => {
    if (!active) return
    const activeKeys = pressed.current
    const room = plan.rooms.find((item) => item.id === selectedRoom) ?? plan.rooms[0]
    if (room) {
      const footprint = roomFootprint(room, site)
      camera.position.set(footprint.cx, 1.6, footprint.cz)
    } else {
      camera.position.set(0, 1.6, 0)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (!['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(event.code) || (event.target instanceof HTMLElement && (event.target.matches('input, textarea, select') || event.target.isContentEditable))) return
      activeKeys.add(event.code); invalidate()
    }
    const onKeyUp = (event: KeyboardEvent) => activeKeys.delete(event.code)
    window.addEventListener('keydown', onKeyDown)
    const onBlur = () => activeKeys.clear()
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    invalidate()
    return () => {
      activeKeys.clear()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [active, camera, plan.rooms, selectedRoom, site, invalidate])

  useFrame((_state, delta) => {
    if (!active) return
    camera.getWorldDirection(direction.current)
    direction.current.y = 0
    direction.current.normalize()
    const next = nextWalkPosition(
      camera.position,
      direction.current,
      pressed.current,
      Math.min(delta, 0.05) * 2.2,
      { halfWidth: site.w / 2, halfDepth: site.h / 2 },
    )
    camera.position.x = next.x
    camera.position.z = next.z
    camera.position.y = 1.6
    if (pressed.current.size > 0) invalidate()
  })

  return null
}

export default function Spatial3D({
  theme,
  plan,
  sunAzimuth,
  sunAltitude,
  selectedRoom,
  onSelectRoom,
  onSetWallHeight,
  hour,
  day,
  locationLabel,
  ghost = false,
  tourWaypoint,
  walkMode = false,
  onToggleWalkMode,
  onStartTour,
  onOpenScenarios,
  windFrom = 180,
  windSpeed = 3,
  projectTitle, location, year, onScenesChange, onRecallScene, onStudyTimeChange,

}: {
  projectTitle: string
  location: ProjectLocation
  year: number
  onScenesChange: (scenes: StudyScene[]) => void
  onRecallScene: (scene: StudyScene) => void
  onStudyTimeChange: (day: number, hour: number, year: number) => void
  theme: StudioTheme
  plan: PlanState
  sunAzimuth: number
  sunAltitude: number
  selectedRoom: string | null
  onSelectRoom: (id: string | null) => void
  onSetWallHeight: (roomId: string, height: number) => void
  hour: number
  day: number
  locationLabel: string
  /** Render the plan as a translucent demo massing — no selection, no editing. */
  ghost?: boolean
  tourWaypoint?: CameraWaypoint | null
  walkMode?: boolean
  onToggleWalkMode?: () => void
  onStartTour?: () => void
  onOpenScenarios?: () => void
  windFrom?: number
  windSpeed?: number
}) {
  const colors = themeTokens(theme)
  const site = useMemo(() => siteOf(plan), [plan])
  const edgeColor = colors['--studio-ink'] ?? WIREEDGE_COLOR
  const selected = useMemo(
    () => (ghost ? null : plan.rooms.find((room) => room.id === selectedRoom) ?? null),
    [ghost, plan.rooms, selectedRoom],
  )

  const [displayStyle, setDisplayStyle] = useState<DisplayStyle>('architectural')
  const wireframe = displayStyle === 'wireframe'
  const architectural = displayStyle === 'architectural'
  const [showShadows, setShowShadows] = useState(true)
  const shellRef = useRef<HTMLDivElement>(null)
  const [exportError, setExportError] = useState('')
  const downloadView = () => {
    const canvas = shellRef.current?.querySelector('canvas')
    if (!canvas) return
    try {
      const link = document.createElement('a')
      link.download = `designon-${hour}h-${displayStyle}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
      setExportError('')
    } catch { setExportError('Could not export this view. Try another browser.') }
  }
  const [preset, setPreset] = useState<CameraPreset>('axonometric')
  const [showSunRays, setShowSunRays] = useState(true)
  const [showAirPaths, setShowAirPaths] = useState(false)
  const [showRoof, setShowRoof] = useState(false)
  const [roofStyle, setRoofStyle] = useState<RoofStyle>('flat')
  // Section plane height in meters — anything above this Y is clipped in the
  // 3D view, which makes it easy to read the plan by slicing through the
  // walls. Default 4.5 m = no clipping (most single-storey plans).
  const [sectionHeight, setSectionHeight] = useState(1.4)
  const controlsRef = useRef<OrbitControl>(null)
  const captureRef = useRef<(() => Promise<StudyCapture>) | null>(null)
  const [cameraRequest, setCameraRequest] = useState<{ id: number; camera: StudyCamera } | null>(null)
  const geometryKey = physicalGeometryKey(plan, roofStyle)
  const { rooms: frameRooms, site: frameSite } = plan
  const target = useMemo(() => cameraRequest?.camera.target ?? modelBounds({ rooms: frameRooms, site: frameSite }).getCenter(new THREE.Vector3()).toArray() as [number, number, number], [cameraRequest, frameRooms, frameSite])
  const settings: StudySettings = { preset, style: displayStyle, sectionHeight, roofStyle, showRoof, shadows: showShadows, sunRays: showSunRays, airPaths: showAirPaths }
  const applyScene = (scene: StudyScene) => {
    const s = scene.settings
    setPreset(s.preset); setDisplayStyle(s.style); setSectionHeight(s.sectionHeight)
    setRoofStyle(s.roofStyle); setShowRoof(s.showRoof); setShowShadows(s.shadows)
    setShowSunRays(s.sunRays); setShowAirPaths(s.airPaths)
    setCameraRequest({ id: Date.now(), camera: scene.camera })
    onRecallScene(scene)
  }
  const captureView = async () => {
    if (!captureRef.current) throw new Error('The 3D view is still loading.')
    return captureRef.current()
  }
  const visibleCut = walkMode || tourWaypoint ? 6 : sectionHeight

  const handleGroundClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      onSelectRoom(null)
    },
    [onSelectRoom],
  )

  return (
    <div className="spatial3d-shell" ref={shellRef} aria-label="Local 3D light study" data-style={displayStyle} data-projection={walkMode || tourWaypoint ? 'perspective' : cameraRequest?.camera.projection ?? (preset === 'orbit' ? 'perspective' : 'orthographic')}>
      <div className="spatial-toolbar">
        <div className="preset-group">
          <button
            type="button"
            className={`spatial-tb-btn ${preset === 'orbit' && !walkMode ? 'active' : ''}`}
            onClick={() => { setCameraRequest(null); setPreset('orbit'); if (walkMode && onToggleWalkMode) onToggleWalkMode() }}
          >
            3D Orbit
          </button>
          <button
            type="button"
            className={`spatial-tb-btn ${preset === 'axonometric' ? 'active' : ''}`}
            onClick={() => { setCameraRequest(null); setPreset('axonometric'); if (walkMode && onToggleWalkMode) onToggleWalkMode() }}
          >
            Axonometric
          </button>
          <button
            type="button"
            className={`spatial-tb-btn ${preset === 'topdown' ? 'active' : ''}`}
            onClick={() => { setCameraRequest(null); setPreset('topdown'); if (walkMode && onToggleWalkMode) onToggleWalkMode() }}
          >
            Top-Down
          </button>
          <button
            type="button"
            className={`spatial-tb-btn ${walkMode ? 'active' : ''}`}
            onClick={onToggleWalkMode}
          >
            Walk at 1.6 m
          </button>
        </div>

        <div className="vector-group">
          <button type="button" className={`spatial-tb-btn ${architectural ? 'active-layer' : ''}`} aria-pressed={architectural} onClick={() => setDisplayStyle('architectural')}>Architectural</button>
          <button type="button" className="spatial-tb-btn" onClick={onStartTour} disabled={ghost}>
            Tour
          </button>
          <button type="button" className="spatial-tb-btn" onClick={onOpenScenarios} disabled={ghost}>
            Conditions
          </button>
          <button
            type="button"
            className={`spatial-tb-btn toggle ${showSunRays ? 'active-layer' : ''}`}
            onClick={() => setShowSunRays(!showSunRays)}
          >
            Sun Rays
          </button>
          <button
            type="button"
            className={`spatial-tb-btn toggle ${showAirPaths ? 'active-layer' : ''}`}
            onClick={() => setShowAirPaths(!showAirPaths)}
          >
            Air Paths
          </button>
          <button
            type="button"
            className={`spatial-tb-btn toggle ${showRoof ? 'active-layer' : ''}`}
            onClick={() => { setShowRoof(!showRoof); if (!showRoof) setSectionHeight(4.5) }}
          >
            3D Roof
          </button>
          <button
              type="button"
              className={`spatial-tb-btn toggle ${wireframe ? 'active-layer' : ''}`}
              onClick={() => setDisplayStyle(wireframe ? 'solid' : 'wireframe')}
              aria-pressed={wireframe}
              title="Toggle architectural wireframe (sharp edges, paper fill) vs solid render"
            >
              Wireframe
            </button>
          <button type="button" className={`spatial-tb-btn toggle ${showShadows ? 'active-layer' : ''}`} aria-pressed={showShadows} onClick={() => setShowShadows(value => !value)}>Shadows</button>
          <button type="button" className="spatial-tb-btn" onClick={downloadView} disabled={ghost}>Save view PNG</button>
          {showRoof && (
            <button
              type="button"
              className="spatial-tb-btn"
              onClick={() => setRoofStyle(ROOF_STYLES[(ROOF_STYLES.indexOf(roofStyle) + 1) % ROOF_STYLES.length])}
              title="Cycle roof shape: flat, gable, shed, green"
            >
              Roof: {roofStyle}
            </button>
          )}

          <div className="spatial-section">
            <span className="spatial-section-label">Section Cut</span>
            <input
              type="range"
              className="spatial-section-range"
              min="0.5"
              max="4.5"
              step="0.1"
              value={sectionHeight}
              disabled={walkMode || !!tourWaypoint}
              onChange={(event) => setSectionHeight(Number(event.target.value))}
              title={`3D section cut at ${sectionHeight.toFixed(1)} m — anything above is clipped`}
              aria-label="3D section cut height"
            />
            <span className="spatial-section-value">{sectionHeight.toFixed(1)} m</span>
          </div>
        </div>
      </div>

      <Canvas
        shadows={{ type: THREE.PCFShadowMap }}
        gl={{ antialias: true, preserveDrawingBuffer: true }}
        dpr={1}
        frameloop="demand"
        camera={{ position: [12, 9, 12], fov: 45 }}
        onPointerMissed={() => onSelectRoom(null)}
      >
        <color attach="background" args={[colors['--studio-support']]} />
        <SunLight azimuth={sunAzimuth} altitude={sunAltitude} site={site} shadows={showShadows} geometryKey={geometryKey} />
        <CameraRig plan={plan} preset={preset} walking={walkMode} touring={!!tourWaypoint} request={cameraRequest} controlsRef={controlsRef} captureRef={captureRef} />
        <CameraController
          walking={walkMode}
          preset={preset}
          waypoint={tourWaypoint}
          controlsRef={controlsRef}
        />
        <WalkController active={walkMode} plan={plan} site={site} selectedRoom={selectedRoom} />

        {walkMode ? (
          <PointerLockControls />
        ) : (
          <OrbitControls
            ref={controlsRef}
            makeDefault
            enableDamping
            maxPolarAngle={tourWaypoint || preset === 'topdown' ? Math.PI : Math.PI * 0.49}
            minDistance={tourWaypoint ? 0.1 : 3}
            maxDistance={Math.max(40, Math.max(...modelBounds(plan).getSize(new THREE.Vector3()).toArray()) * 20)}
            target={target}
            enableRotate={preset !== 'topdown' || !!tourWaypoint}
            maxZoom={30}
            minZoom={0.1}
          />
        )}

        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={handleGroundClick}>
          <planeGeometry args={[Math.max(20, site.w + 6), Math.max(16, site.h + 6)]} />
          <meshStandardMaterial color={colors['--studio-ground']} roughness={0.95} metalness={0} />
        </mesh>

        {/* Section-cut plane — a translucent amber disc at sectionHeight that
            signals "anything above this height is conceptually clipped". The
            geometry below the plane stays visible; the plane is a visual
            indicator + can be used to read interior volumes. */}
        {!architectural && visibleCut < 4.4 && (
          <mesh position={[0, visibleCut, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
            <planeGeometry args={[Math.max(20, site.w + 6), Math.max(16, site.h + 6)]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.18} depthWrite={false} />
          </mesh>
        )}
        <Grid
          position={[0, 0.005, 0]}
          args={[Math.max(20, site.w + 6), Math.max(16, site.h + 6)]}
          cellColor={colors['--studio-grid']}
          sectionColor={colors['--studio-border']}
          fadeDistance={30}
          infiniteGrid={false}
        />

        {ghost
          ? plan.rooms.map((room) => {
              const fp = roomFootprint(room, site)
              const h = roomHeight(room)
              return (
                <mesh key={room.id} position={[fp.cx, h / 2, fp.cz]}>
                  <boxGeometry args={[fp.width, h, fp.depth]} />
                  <meshStandardMaterial color="#9aa3ad" transparent opacity={0.14} roughness={0.9} metalness={0} depthWrite={false} />
                  <Edges color={wireframe ? edgeColor : '#f59e0b'} />
                </mesh>
              )
            })
          : plan.rooms.map((room) => (
              <RoomVolume
                key={room.id}
                room={room}
                plan={plan}
                site={site}
                isSelected={room.id === selectedRoom}
                onSelectRoom={onSelectRoom}
                sectionHeight={visibleCut}
                architectural={architectural}
                wireframe={wireframe}
                edgeColor={edgeColor}
              />
            ))}
        {!ghost && plan.openings.map((opening) => (
          <OpeningPanel key={opening.id} opening={opening} site={site} wireframe={wireframe} edgeColor={edgeColor} architectural={architectural} sectionHeight={visibleCut} />
        ))}
        {!ghost && plan.furniture.map((item) => (
          <FurniturePiece key={item.id} item={item} site={site} wireframe={wireframe} edgeColor={edgeColor} architectural={architectural} sectionHeight={visibleCut} />
        ))}

        {!ghost && showSunRays && (
          <SunRayVectors plan={plan} azimuth={sunAzimuth} altitude={sunAltitude} />
        )}
        {!ghost && showAirPaths && (
          <AirflowPathVectors plan={plan} site={site} windFrom={windFrom} windSpeed={windSpeed} />
        )}
        <Roof3D plan={plan} site={site} visible={showRoof && visibleCut >= Math.max(0, ...plan.rooms.map(roomHeight)) + FLOOR_THICKNESS} style={roofStyle} />

        {selected && <HeightHandle room={selected} site={site} onSetWallHeight={onSetWallHeight} />}

        <Html position={[0, 0.1, -6]} center>
          <span className="spatial-north-label">N</span>
        </Html>
      </Canvas>

      <StudyPanel plan={plan} title={projectTitle} location={location} day={day} hour={hour} year={year} settings={settings}
        capture={captureView} restore={applyScene} onScenesChange={onScenesChange} onTimeChange={onStudyTimeChange} disabled={ghost || walkMode || !!tourWaypoint} />
      <div className="spatial-sun-hud" aria-live="polite">
        <span className="sun-orb" style={{ opacity: sunAltitude > 0 ? 1 : 0.25 }} />
        <div>
          <small>{displayStyle} · {year} · day {day} · local geometry</small>
          <strong>{clockLabel(hour)} · {sunAltitude.toFixed(1)}° altitude</strong>
          <em>{sunAzimuth.toFixed(1)}° azimuth · {locationLabel}</em>
        </div>
      </div>
      {exportError && <p role="alert" className="spatial-orbit-note">{exportError}</p>}
      <div className="spatial-orbit-note">
        {walkMode
          ? 'Eye-level walk · click model to look · WASD moves · Esc exits · concept view has no wall collision'
          : `${preset === 'topdown' ? 'North-up parallel view' : 'Drag to orbit'} · ${architectural ? 'cut faces filled · ' : ''}${showShadows ? 'full building in shadow model' : 'shadows off'}`}
      </div>
    </div>
  )
}
