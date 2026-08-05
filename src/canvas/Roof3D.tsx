import type { ThreeEvent } from '@react-three/fiber'
import type { PlanState, SiteSpec } from '../types'

export type RoofStyle = 'flat' | 'gable' | 'shed' | 'green'

interface Roof3DProps {
  plan: PlanState
  site: SiteSpec
  style?: RoofStyle
  visible?: boolean
  onClick?: (event: ThreeEvent<MouseEvent>) => void
}

function toMeters(xPct: number, yPct: number, site: SiteSpec): { mx: number; mz: number } {
  return {
    mx: (xPct / 100) * site.w - site.w / 2,
    mz: (yPct / 100) * site.h - site.h / 2,
  }
}

export function Roof3D({ plan, site, style = 'flat', visible = true, onClick }: Roof3DProps) {
  if (!visible || plan.rooms.length === 0) return null

  // Compute bounding box envelope of all rooms
  let minX = Infinity
  let maxX = -Infinity
  let minZ = Infinity
  let maxZ = -Infinity
  let maxHeight = 2.5

  for (const r of plan.rooms) {
    if (r.kind === 'terrace') continue
    const nw = toMeters(r.x, r.y, site)
    const se = toMeters(r.x + r.w, r.y + r.h, site)
    minX = Math.min(minX, nw.mx)
    maxX = Math.max(maxX, se.mx)
    minZ = Math.min(minZ, nw.mz)
    maxZ = Math.max(maxZ, se.mz)
    maxHeight = Math.max(maxHeight, r.wallHeight ?? 2.5)
  }

  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null

  // Add 0.6m eave overhang
  const EAVE = 0.6
  const width = maxX - minX + EAVE * 2
  const depth = maxZ - minZ + EAVE * 2
  const cx = (minX + maxX) / 2
  const cz = (minZ + maxZ) / 2
  const basePosY = maxHeight + 0.1

  return (
    <group position={[cx, basePosY, cz]} onClick={onClick}>
      {style === 'flat' || style === 'green' ? (
        <>
          {/* Main Flat Roof Slab */}
          <mesh position={[0, 0.05, 0]} castShadow receiveShadow>
            <boxGeometry args={[width, 0.12, depth]} />
            <meshStandardMaterial
              color={style === 'green' ? '#3f6212' : '#334155'}
              roughness={0.8}
              metalness={0.1}
            />
          </mesh>

          {/* Low Parapet Perimeter Cap */}
          <mesh position={[0, 0.2, 0]}>
            <boxGeometry args={[width + 0.1, 0.18, depth + 0.1]} />
            <meshStandardMaterial color="#475569" roughness={0.7} />
          </mesh>

          {/* Rooftop Solar PV Panels Array if Solar System is active */}
          {plan.systems.solar && (
            <group position={[0, 0.15, 0]}>
              <mesh position={[-width * 0.2, 0.02, 0]} rotation={[-0.25, 0, 0]}>
                <boxGeometry args={[width * 0.4, 0.04, depth * 0.5]} />
                <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
              </mesh>
              <mesh position={[width * 0.2, 0.02, 0]} rotation={[-0.25, 0, 0]}>
                <boxGeometry args={[width * 0.4, 0.04, depth * 0.5]} />
                <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.1} />
              </mesh>
            </group>
          )}
        </>
      ) : style === 'shed' ? (
        // Shed Monopitch Roof (Sloped from North to South)
        <mesh position={[0, 0.4, 0]} rotation={[0.15, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[width, 0.12, depth * 1.05]} />
          <meshStandardMaterial color="#1e293b" roughness={0.4} metalness={0.6} />
        </mesh>
      ) : (
        // Gable Pitch Roof
        <mesh position={[0, 0.6, 0]} rotation={[0, 0, 0]} castShadow receiveShadow>
          <coneGeometry args={[Math.max(width, depth) * 0.6, 1.2, 4]} />
          <meshStandardMaterial color="#78350f" roughness={0.7} />
        </mesh>
      )}
    </group>
  )
}
