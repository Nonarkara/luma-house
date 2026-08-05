import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Edges, Grid, Html, OrbitControls, PivotControls, PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import { furnitureRectFor, roomHeight, siteOf, sunVector } from '../plan'
import type { Furniture, FurnitureKind, Opening, PlanState, Room, SiteSpec } from '../types'
import { openingsForRoomWall, roomsForOpening } from '../analysis/walls'
import { windFlowPotential } from '../analysis'
import type { Compass } from '../analysis'
import type { CameraWaypoint } from '../tour/guidedTour'
import { nextWalkPosition } from './walkNavigation'
import { Roof3D } from './Roof3D'

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
}: {
  position: [number, number, number]
  size: [number, number, number]
  emissiveIntensity: number
  onClick: (event: ThreeEvent<MouseEvent>) => void
}) {
  return (
    <mesh position={position} castShadow receiveShadow onClick={onClick}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color="#dfe0da"
        roughness={0.9}
        metalness={0}
        emissive="#f59e0b"
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  )
}

type Footprint = ReturnType<typeof roomFootprint>

function SegmentedWall({
  compass,
  footprint,
  height,
  openings,
  site,
  emissiveIntensity,
  onClick,
}: {
  compass: Compass
  footprint: Footprint
  height: number
  openings: Opening[]
  site: SiteSpec
  emissiveIntensity: number
  onClick: (event: ThreeEvent<MouseEvent>) => void
}) {
  const horizontal = compass === 'N' || compass === 'S'
  const wallStart = horizontal ? footprint.minX : footprint.minZ
  const wallEnd = horizontal ? footprint.maxX : footprint.maxZ
  const fixed = horizontal
    ? (compass === 'N' ? footprint.minZ : footprint.maxZ)
    : (compass === 'W' ? footprint.minX : footprint.maxX)

  const cuts = openings
    .map((opening) => {
      const center = toMeters(opening.x, opening.y, site)
      const centerAxis = horizontal ? center.mx : center.mz
      const width = opening.type === 'window' ? 1.6 : 0.9
      return {
        opening,
        start: Math.max(wallStart, centerAxis - width / 2),
        end: Math.min(wallEnd, centerAxis + width / 2),
      }
    })
    .filter((cut) => cut.end - cut.start > 0.05)
    .sort((a, b) => a.start - b.start)

  const pieces: Array<{ key: string; start: number; length: number; y: number; h: number }> = []
  let cursor = wallStart
  cuts.forEach((cut, index) => {
    if (cut.start > cursor) {
      pieces.push({ key: `pier-${index}`, start: cursor, length: cut.start - cursor, y: 0, h: height })
    }
    const sill = cut.opening.type === 'window' ? 0.9 : 0
    const openingHeight = cut.opening.type === 'window' ? 1.2 : 2.1
    const width = cut.end - cut.start
    if (sill > 0) pieces.push({ key: `sill-${cut.opening.id}`, start: cut.start, length: width, y: 0, h: sill })
    const headStart = Math.min(height, sill + openingHeight)
    if (height > headStart) pieces.push({ key: `head-${cut.opening.id}`, start: cut.start, length: width, y: headStart, h: height - headStart })
    cursor = Math.max(cursor, cut.end)
  })
  if (cursor < wallEnd) pieces.push({ key: 'pier-end', start: cursor, length: wallEnd - cursor, y: 0, h: height })

  if (pieces.length === 0) {
    pieces.push({ key: 'whole', start: wallStart, length: wallEnd - wallStart, y: 0, h: height })
  }

  return (
    <group>
      {pieces.map((piece) => (
        <Wall
          key={piece.key}
          position={horizontal
            ? [piece.start + piece.length / 2, FLOOR_THICKNESS + piece.y + piece.h / 2, fixed]
            : [fixed, FLOOR_THICKNESS + piece.y + piece.h / 2, piece.start + piece.length / 2]}
          size={horizontal ? [piece.length, piece.h, WALL_THICKNESS] : [WALL_THICKNESS, piece.h, piece.length]}
          emissiveIntensity={emissiveIntensity}
          onClick={onClick}
        />
      ))}
    </group>
  )
}

function RoomVolume({
  room,
  plan,
  site,
  isSelected,
  onSelectRoom,
  sectionHeight,
}: {
  room: Room
  plan: PlanState
  site: SiteSpec
  isSelected: boolean
  onSelectRoom: (id: string | null) => void
  sectionHeight?: number
}) {
  const footprint = useMemo(() => roomFootprint(room, site), [room, site])
  const fullHeight = roomHeight(room)
  const height = sectionHeight !== undefined && sectionHeight < fullHeight ? sectionHeight : fullHeight

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
        <meshStandardMaterial color="#23262d" roughness={0.9} metalness={0} />
      </mesh>
    )
  }

  const emissiveIntensity = isSelected ? 0.12 : 0

  return (
    <group>
      <mesh
        position={[footprint.cx, FLOOR_THICKNESS / 2, footprint.cz]}
        receiveShadow
        onClick={handleSelect}
      >
        <boxGeometry args={[footprint.width, FLOOR_THICKNESS, footprint.depth]} />
        <meshStandardMaterial color="#1b1e24" roughness={0.9} metalness={0} />
      </mesh>
      {(['N', 'S', 'W', 'E'] as Compass[]).map((compass) => (
        <SegmentedWall
          key={compass}
          compass={compass}
          footprint={footprint}
          height={height}
          openings={openingsForRoomWall(plan, room.id, compass)}
          site={site}
          emissiveIntensity={emissiveIntensity}
          onClick={handleSelect}
        />
      ))}
    </group>
  )
}

function OpeningPanel({ opening, site }: { opening: Opening; site: SiteSpec }) {
  const { mx, mz } = toMeters(opening.x, opening.y, site)
  const isWindow = opening.type === 'window'
  const width = opening.widthM ?? (isWindow ? 1.6 : 0.9)
  const height = opening.heightM ?? (isWindow ? 1.2 : 2.1)
  const sill = opening.sillHeightM ?? (isWindow ? 0.9 : 0)
  const y = FLOOR_THICKNESS + sill + height / 2
  const size: [number, number, number] =
    opening.rotation === 0 ? [width, height, WALL_THICKNESS] : [WALL_THICKNESS, height, width]
  const color = isWindow ? '#38444d' : '#f59e0b'

  return (
    <mesh position={[mx, y, mz]}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.9}
        metalness={0}
        transparent={isWindow}
        opacity={isWindow ? 0.42 : 1}
        emissive={isWindow ? '#f59e0b' : '#000000'}
        emissiveIntensity={isWindow ? 0.06 : 0}
      />
    </mesh>
  )
}


function FurniturePiece({ item, site }: { item: Furniture; site: SiteSpec }) {
  const rect = useMemo(() => furnitureRectFor(item, site), [item, site])
  const widthM = (rect.w / 100) * site.w
  const depthM = (rect.h / 100) * site.h
  const { mx, mz } = toMeters(rect.x + rect.w / 2, rect.y + rect.h / 2, site)
  const height = FURNITURE_HEIGHTS[item.kind]

  return (
    <mesh position={[mx, FLOOR_THICKNESS + height / 2, mz]} castShadow>
      <boxGeometry args={[widthM, height, depthM]} />
      <meshStandardMaterial color="#8b8f98" roughness={0.9} metalness={0} />
    </mesh>
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
  site,
  azimuth,
  altitude,
}: {
  plan: PlanState
  site: SiteSpec
  azimuth: number
  altitude: number
}) {
  const dir = useMemo(() => sunVector(azimuth, altitude), [azimuth, altitude])
  if (altitude <= 0) return null

  return (
    <group>
      {plan.openings.filter((opening) => opening.type === 'window' && roomsForOpening(plan, opening).length === 1).map((op) => {
        const { mx, mz } = toMeters(op.x, op.y, site)
        const y = FLOOR_THICKNESS + 1.5

        const start: [number, number, number] = [mx + dir.x * 6, y + dir.y * 6, mz + dir.z * 6]
        const end: [number, number, number] = [mx, y, mz]

        return <VectorLine key={op.id} start={start} end={end} color="#f59e0b" opacity={0.65} />
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


function SunLight({ azimuth, altitude }: { azimuth: number; altitude: number }) {
  const direction = useMemo(() => sunVector(azimuth, altitude), [azimuth, altitude])
  const isNight = altitude <= 0
  const position: [number, number, number] = [direction.x * 25, direction.y * 25, direction.z * 25]

  return (
    <>
      <ambientLight intensity={0.35} />
      <directionalLight
        position={position}
        intensity={isNight ? 0.15 : 1.6}
        castShadow={!isNight}
        shadow-mapSize={[1024, 1024]}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={12}
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
  preset,
  waypoint,
  controlsRef,
}: {
  preset: CameraPreset
  waypoint?: CameraWaypoint | null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  controlsRef: React.RefObject<any>
}) {
  const { camera } = useThree()

  useFrame(() => {
    if (waypoint) {
      const targetPos = new THREE.Vector3(...waypoint.position)
      const targetLook = new THREE.Vector3(...waypoint.target)
      camera.position.lerp(targetPos, 0.08)
      if (controlsRef.current?.target) {
        controlsRef.current.target.lerp(targetLook, 0.08)
        controlsRef.current.update()
      }
      if (camera instanceof THREE.PerspectiveCamera) {
        camera.fov += (waypoint.fov - camera.fov) * 0.08
        camera.updateProjectionMatrix()
      }
    } else if (preset === 'axonometric') {
      camera.position.lerp(new THREE.Vector3(16, 16, 16), 0.08)
      if (controlsRef.current?.target) {
        controlsRef.current.target.lerp(new THREE.Vector3(0, 1, 0), 0.08)
        controlsRef.current.update()
      }
    } else if (preset === 'topdown') {
      camera.position.lerp(new THREE.Vector3(0, 24, 0.001), 0.08)
      if (controlsRef.current?.target) {
        controlsRef.current.target.lerp(new THREE.Vector3(0, 0, 0), 0.08)
        controlsRef.current.update()
      }
    }
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
  const { camera } = useThree()
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

    const onKeyDown = (event: KeyboardEvent) => activeKeys.add(event.code)
    const onKeyUp = (event: KeyboardEvent) => activeKeys.delete(event.code)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      activeKeys.clear()
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [active, camera, plan.rooms, selectedRoom, site])

  useFrame((_state, delta) => {
    if (!active) return
    camera.getWorldDirection(direction.current)
    direction.current.y = 0
    direction.current.normalize()
    const next = nextWalkPosition(
      camera.position,
      direction.current,
      pressed.current,
      delta * 2.2,
      { halfWidth: site.w / 2, halfDepth: site.h / 2 },
    )
    camera.position.x = next.x
    camera.position.z = next.z
    camera.position.y = 1.6
  })

  return null
}

export default function Spatial3D({
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
}: {
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
  const site = useMemo(() => siteOf(plan), [plan])
  const selected = useMemo(
    () => (ghost ? null : plan.rooms.find((room) => room.id === selectedRoom) ?? null),
    [ghost, plan.rooms, selectedRoom],
  )

  const [preset, setPreset] = useState<CameraPreset>('orbit')
  const [showSunRays, setShowSunRays] = useState(true)
  const [showAirPaths, setShowAirPaths] = useState(false)
  const [showRoof, setShowRoof] = useState(false)
  // Section plane height in meters — anything above this Y is clipped in the
  // 3D view, which makes it easy to read the plan by slicing through the
  // walls. Default 4.5 m = no clipping (most single-storey plans).
  const [sectionHeight, setSectionHeight] = useState(4.5)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const controlsRef = useRef<any>(null)

  const handleGroundClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      onSelectRoom(null)
    },
    [onSelectRoom],
  )

  return (
    <div className="spatial3d-shell">
      <div className="spatial-toolbar">
        <div className="preset-group">
          <button
            type="button"
            className={`spatial-tb-btn ${preset === 'orbit' && !walkMode ? 'active' : ''}`}
            onClick={() => { setPreset('orbit'); if (walkMode && onToggleWalkMode) onToggleWalkMode() }}
          >
            3D Orbit
          </button>
          <button
            type="button"
            className={`spatial-tb-btn ${preset === 'axonometric' ? 'active' : ''}`}
            onClick={() => { setPreset('axonometric'); if (walkMode && onToggleWalkMode) onToggleWalkMode() }}
          >
            Axonometric
          </button>
          <button
            type="button"
            className={`spatial-tb-btn ${preset === 'topdown' ? 'active' : ''}`}
            onClick={() => { setPreset('topdown'); if (walkMode && onToggleWalkMode) onToggleWalkMode() }}
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
            onClick={() => setShowRoof(!showRoof)}
          >
            3D Roof
          </button>

          <div className="spatial-section">
            <span className="spatial-section-label">Section Cut</span>
            <input
              type="range"
              className="spatial-section-range"
              min="0.5"
              max="4.5"
              step="0.1"
              value={sectionHeight}
              onChange={(event) => setSectionHeight(Number(event.target.value))}
              title={`3D section cut at ${sectionHeight.toFixed(1)} m — anything above is clipped`}
              aria-label="3D section cut height"
            />
            <span className="spatial-section-value">{sectionHeight.toFixed(1)} m</span>
          </div>
        </div>
      </div>

      <Canvas
        shadows="basic"
        dpr={[1, 2]}
        camera={{ position: [12, 9, 12], fov: 45 }}
        onPointerMissed={() => onSelectRoom(null)}
      >
        <color attach="background" args={['#0d0f13']} />
        <SunLight azimuth={sunAzimuth} altitude={sunAltitude} />
        <CameraController
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
            maxPolarAngle={Math.PI * 0.49}
            minDistance={3}
            maxDistance={40}
            target={[0, 1, 0]}
          />
        )}

        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={handleGroundClick}>
          <planeGeometry args={[Math.max(20, site.w + 6), Math.max(16, site.h + 6)]} />
          <meshStandardMaterial color="#14161b" roughness={0.95} metalness={0} />
        </mesh>

        {/* Section-cut plane — a translucent amber disc at sectionHeight that
            signals "anything above this height is conceptually clipped". The
            geometry below the plane stays visible; the plane is a visual
            indicator + can be used to read interior volumes. */}
        {sectionHeight < 4.4 && (
          <mesh position={[0, sectionHeight, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={1}>
            <planeGeometry args={[Math.max(20, site.w + 6), Math.max(16, site.h + 6)]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.18} depthWrite={false} />
          </mesh>
        )}
        <Grid
          position={[0, 0.005, 0]}
          args={[Math.max(20, site.w + 6), Math.max(16, site.h + 6)]}
          cellColor="#1f232b"
          sectionColor="#2a2f3a"
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
                  <Edges color="#f59e0b" />
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
                sectionHeight={sectionHeight}
              />
            ))}
        {!ghost && plan.openings.map((opening) => (
          <OpeningPanel key={opening.id} opening={opening} site={site} />
        ))}
        {!ghost && plan.furniture.map((item) => (
          <FurniturePiece key={item.id} item={item} site={site} />
        ))}

        {!ghost && showSunRays && (
          <SunRayVectors plan={plan} site={site} azimuth={sunAzimuth} altitude={sunAltitude} />
        )}
        {!ghost && showAirPaths && (
          <AirflowPathVectors plan={plan} site={site} windFrom={windFrom} windSpeed={windSpeed} />
        )}
        <Roof3D plan={plan} site={site} visible={showRoof} />

        {selected && <HeightHandle room={selected} site={site} onSetWallHeight={onSetWallHeight} />}

        <Html position={[0, 0.1, -6]} center>
          <span className="spatial-north-label">N</span>
        </Html>
      </Canvas>

      <div className="spatial-sun-hud" aria-live="polite">
        <span className="sun-orb" />
        <div>
          <small>Live solar model · day {day}</small>
          <strong>{hour}:00 · {sunAltitude.toFixed(1)}° altitude</strong>
          <em>{sunAzimuth.toFixed(1)}° azimuth · {locationLabel}</em>
        </div>
      </div>
      <div className="spatial-orbit-note">
        {walkMode
          ? 'Eye-level walk · click model to look · WASD moves · Esc exits · concept view has no wall collision'
          : 'Drag to orbit · scroll to zoom · select a room to edit height'}
      </div>
    </div>
  )
}
