import { useCallback, useMemo, useRef } from 'react'
import { Canvas, type ThreeEvent } from '@react-three/fiber'
import { Grid, Html, OrbitControls, PivotControls } from '@react-three/drei'
import type * as THREE from 'three'
import { SITE_HEIGHT_METERS, SITE_WIDTH_METERS, furnitureRect, roomHeight, sunVector } from '../plan'
import type { Furniture, FurnitureKind, Opening, PlanState, Room } from '../types'

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
function toMeters(xPct: number, yPct: number): { mx: number; mz: number } {
  return {
    mx: (xPct / 100) * SITE_WIDTH_METERS - SITE_WIDTH_METERS / 2,
    mz: (yPct / 100) * SITE_HEIGHT_METERS - SITE_HEIGHT_METERS / 2,
  }
}

function roomFootprint(room: Room) {
  const nw = toMeters(room.x, room.y)
  const se = toMeters(room.x + room.w, room.y + room.h)
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
        emissive="#a3ff00"
        emissiveIntensity={emissiveIntensity}
      />
    </mesh>
  )
}

function RoomVolume({
  room,
  isSelected,
  onSelectRoom,
}: {
  room: Room
  isSelected: boolean
  onSelectRoom: (id: string | null) => void
}) {
  const footprint = useMemo(() => roomFootprint(room), [room])
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

  const wallY = FLOOR_THICKNESS + height / 2
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
      <Wall
        position={[footprint.cx, wallY, footprint.minZ]}
        size={[footprint.width, height, WALL_THICKNESS]}
        emissiveIntensity={emissiveIntensity}
        onClick={handleSelect}
      />
      <Wall
        position={[footprint.cx, wallY, footprint.maxZ]}
        size={[footprint.width, height, WALL_THICKNESS]}
        emissiveIntensity={emissiveIntensity}
        onClick={handleSelect}
      />
      <Wall
        position={[footprint.minX, wallY, footprint.cz]}
        size={[WALL_THICKNESS, height, footprint.depth]}
        emissiveIntensity={emissiveIntensity}
        onClick={handleSelect}
      />
      <Wall
        position={[footprint.maxX, wallY, footprint.cz]}
        size={[WALL_THICKNESS, height, footprint.depth]}
        emissiveIntensity={emissiveIntensity}
        onClick={handleSelect}
      />
    </group>
  )
}

function OpeningPanel({ opening }: { opening: Opening }) {
  const { mx, mz } = toMeters(opening.x, opening.y)
  const isWindow = opening.type === 'window'
  const width = isWindow ? 1.6 : 0.9
  const height = isWindow ? 1.2 : 2.1
  const y = isWindow ? FLOOR_THICKNESS + 0.9 + height / 2 : FLOOR_THICKNESS + height / 2
  const size: [number, number, number] =
    opening.rotation === 0 ? [width, height, WALL_THICKNESS] : [WALL_THICKNESS, height, width]
  const color = isWindow ? '#58a6ff' : '#fb923c'

  return (
    <mesh position={[mx, y, mz]}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={0.9}
        metalness={0}
        emissive={isWindow ? color : '#000000'}
        emissiveIntensity={isWindow ? 0.25 : 0}
      />
    </mesh>
  )
}

function FurniturePiece({ item }: { item: Furniture }) {
  const rect = useMemo(() => furnitureRect(item), [item])
  const widthM = (rect.w / 100) * SITE_WIDTH_METERS
  const depthM = (rect.h / 100) * SITE_HEIGHT_METERS
  const { mx, mz } = toMeters(rect.x + rect.w / 2, rect.y + rect.h / 2)
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
  onSetWallHeight,
}: {
  room: Room
  onSetWallHeight: (roomId: string, height: number) => void
}) {
  const footprint = useMemo(() => roomFootprint(room), [room])
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
}: {
  plan: PlanState
  sunAzimuth: number
  sunAltitude: number
  selectedRoom: string | null
  onSelectRoom: (id: string | null) => void
  onSetWallHeight: (roomId: string, height: number) => void
}) {
  const selected = useMemo(
    () => plan.rooms.find((room) => room.id === selectedRoom) ?? null,
    [plan.rooms, selectedRoom],
  )

  const handleGroundClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      event.stopPropagation()
      onSelectRoom(null)
    },
    [onSelectRoom],
  )

  return (
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
        <planeGeometry args={[20, 16]} />
        <meshStandardMaterial color="#14161b" roughness={0.95} metalness={0} />
      </mesh>
      <Grid
        position={[0, 0.005, 0]}
        args={[20, 16]}
        cellColor="#1f232b"
        sectionColor="#2a2f3a"
        fadeDistance={30}
        infiniteGrid={false}
      />

      {plan.rooms.map((room) => (
        <RoomVolume key={room.id} room={room} isSelected={room.id === selectedRoom} onSelectRoom={onSelectRoom} />
      ))}
      {plan.openings.map((opening) => (
        <OpeningPanel key={opening.id} opening={opening} />
      ))}
      {plan.furniture.map((item) => (
        <FurniturePiece key={item.id} item={item} />
      ))}

      {selected && <HeightHandle room={selected} onSetWallHeight={onSetWallHeight} />}

      <Html position={[0, 0.1, -6]} center>
        <span className="spatial-north-label">N</span>
      </Html>
    </Canvas>
  )
}
