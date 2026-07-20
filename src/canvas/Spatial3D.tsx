import { useCallback, useMemo, useRef } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { Edges, Grid, Html, OrbitControls, PivotControls } from '@react-three/drei'
import type * as THREE from 'three'
import { furnitureRectFor, roomHeight, siteOf, sunVector } from '../plan'
import type { Furniture, FurnitureKind, Opening, PlanState, Room, SiteSpec } from '../types'
import { openingsForRoomWall } from '../analysis/walls'
import type { Compass } from '../analysis'

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
}: {
  room: Room
  plan: PlanState
  site: SiteSpec
  isSelected: boolean
  onSelectRoom: (id: string | null) => void
}) {
  const footprint = useMemo(() => roomFootprint(room, site), [room, site])
  const height = roomHeight(room)

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
  const width = isWindow ? 1.6 : 0.9
  const height = isWindow ? 1.2 : 2.1
  const y = isWindow ? FLOOR_THICKNESS + 0.9 + height / 2 : FLOOR_THICKNESS + height / 2
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
}) {
  const site = useMemo(() => siteOf(plan), [plan])
  const selected = useMemo(
    () => (ghost ? null : plan.rooms.find((room) => room.id === selectedRoom) ?? null),
    [ghost, plan.rooms, selectedRoom],
  )

  const handleGroundClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      onSelectRoom(null)
    },
    [onSelectRoom],
  )

  return (
    <div className="spatial3d-shell">
    <Canvas
      shadows
      dpr={[1, 2]}
      camera={{ position: [12, 9, 12], fov: 45 }}
      onPointerMissed={() => onSelectRoom(null)}
    >
      <color attach="background" args={['#0d0f13']} />
      <SunLight azimuth={sunAzimuth} altitude={sunAltitude} />
      <OrbitControls
        makeDefault
        enableDamping
        maxPolarAngle={Math.PI * 0.49}
        minDistance={3}
        maxDistance={40}
        target={[0, 1, 0]}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={handleGroundClick}>
        <planeGeometry args={[Math.max(20, site.w + 6), Math.max(16, site.h + 6)]} />
        <meshStandardMaterial color="#14161b" roughness={0.95} metalness={0} />
      </mesh>
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
                <Edges color="#a3ff00" />
              </mesh>
            )
          })
        : plan.rooms.map((room) => (
            <RoomVolume key={room.id} room={room} plan={plan} site={site} isSelected={room.id === selectedRoom} onSelectRoom={onSelectRoom} />
          ))}
      {!ghost && plan.openings.map((opening) => (
        <OpeningPanel key={opening.id} opening={opening} site={site} />
      ))}
      {!ghost && plan.furniture.map((item) => (
        <FurniturePiece key={item.id} item={item} site={site} />
      ))}

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
      <div className="spatial-orbit-note">Drag to orbit · scroll to zoom · select a room to edit height</div>
    </div>
  )
}
