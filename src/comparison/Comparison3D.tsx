import { useMemo, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { Line, OrbitControls } from '@react-three/drei'
import { PCFShadowMap, Vector3 } from 'three'
import type { OrbitControls as OrbitControl } from 'three-stdlib'
import { themeTokens, type StudioTheme } from '../design/themes'
import { RoomVolume, OpeningPanel, FurniturePiece, SunLight } from '../canvas/Spatial3D'
import { CameraRig } from '../study/CameraRig'
import { modelBounds, physicalGeometryKey } from '../study/geometry'
import type { PlanState } from '../types'
import { comparisonFrame, furnitureChangeIds } from './geometry'
import { morphCoverage, morphPlan } from './morph'
import { furnitureRectFor, siteOf } from '../plan'

const ignoreSelection = () => {}

/** One canvas, camera and crop for both alternatives. Switching geometry never
 * changes the frame plan given to CameraRig. No edit callback reaches the app. */
export default function Comparison3D({ baseline, proposed, theme, sunAzimuth, sunAltitude, baselineLabel = 'Plan A', proposedLabel = 'Plan B' }: {
  baseline: PlanState; proposed: PlanState; theme: StudioTheme; sunAzimuth: number; sunAltitude: number; baselineLabel?: string; proposedLabel?: string
}) {
  const frame = useMemo(() => comparisonFrame(baseline, proposed), [baseline, proposed])
  const [side, setSide] = useState<'a' | 'b' | 'morph'>('b')
  const [morphAt, setMorphAt] = useState(0.5)
  const [preset, setPreset] = useState<'axonometric' | 'topdown'>('axonometric')
  const [cut, setCut] = useState(1.4)
  const [error, setError] = useState('')
  const controls = useRef<OrbitControl>(null), shell = useRef<HTMLDivElement>(null)
  const colors = themeTokens(theme)
  const morphed = useMemo(() => (side === 'morph' ? morphPlan(baseline, proposed, morphAt) : null), [side, baseline, proposed, morphAt])
  const coverage = useMemo(() => morphCoverage(baseline, proposed), [baseline, proposed])
  const plan = morphed ?? (side === 'a' ? baseline : proposed)
  const site = siteOf(plan)
  const centre = modelBounds(frame.framing).getCenter(new Vector3())
  const target = useMemo(() => [centre.x, centre.y, centre.z] as [number, number, number], [centre.x, centre.y, centre.z])
  const key = physicalGeometryKey(plan) + `|frame:${frame.site.w},${frame.site.h}`
  const changes = useMemo(() => furnitureChangeIds(baseline, proposed), [baseline, proposed])
  const changed = new Set([...changes.changed, ...(side === 'a' ? changes.removed : changes.added)])
  const caption = side === 'morph'
    ? `${Math.round(morphAt * 100)}% toward ${proposedLabel}`
    : side === 'a' ? baselineLabel : proposedLabel
  const saveImage = () => {
    try {
      const canvas = shell.current?.querySelector('canvas')
      if (!canvas) throw new Error('not ready')
      const link = document.createElement('a')
      link.download = `designon-comparison-plan-${side}.png`
      link.href = canvas.toDataURL('image/png'); link.click(); setError('')
    } catch { setError('Could not save this view. Try again once the model is visible.') }
  }
  return <div className="comparison-3d" ref={shell} data-side={side} data-projection="orthographic">
    <div className="comparison-view-controls" role="group" aria-label="3D comparison controls">
      <button type="button" aria-pressed={side === 'a'} onClick={() => setSide('a')}>{baselineLabel}</button>
      <button type="button" aria-pressed={side === 'b'} onClick={() => setSide('b')}>{proposedLabel}</button>
      <button type="button" aria-pressed={side === 'morph'} onClick={() => setSide('morph')}>Morph</button>
      {side === 'morph' && <label>Morph <input type="range" aria-label="Morph between alternatives" min="0" max="1" step="0.01" value={morphAt} onChange={e => setMorphAt(Number(e.target.value))} />{Math.round(morphAt * 100)}%</label>}
      <button type="button" aria-pressed={preset === 'axonometric'} onClick={() => setPreset('axonometric')}>Parallel 3D</button>
      <button type="button" aria-pressed={preset === 'topdown'} onClick={() => setPreset('topdown')}>North-up 3D</button>
      <label>Wall cut <input type="range" aria-label="Comparison wall cut" min=".5" max="4.5" step=".1" value={cut} onChange={e => setCut(Number(e.target.value))} />{cut.toFixed(1)} m</label>
      <button type="button" onClick={saveImage}>Save comparison PNG</button>
    </div>
    <div className="comparison-3d-viewport" role="img" aria-label={`Local 3D comparison: ${caption}; same camera and sunlight`}>
      <Canvas shadows={{ type: PCFShadowMap }} dpr={1} frameloop="demand" gl={{ antialias: true, preserveDrawingBuffer: true }} camera={{ position: [12, 9, 12], fov: 45 }}>
        <color attach="background" args={[colors['--studio-support']]} />
        <SunLight azimuth={sunAzimuth} altitude={sunAltitude} site={frame.site} shadows geometryKey={key} />
        <CameraRig plan={frame.framing} preset={preset} walking={false} touring={false} request={null} controlsRef={controls} />
        <OrbitControls ref={controls} makeDefault enableDamping={false} target={target} enableRotate={preset !== 'topdown'} maxPolarAngle={preset === 'topdown' ? Math.PI : Math.PI * .49} minZoom={.1} maxZoom={30} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow><planeGeometry args={[frame.site.w + 12, frame.site.h + 12]} /><meshStandardMaterial color={colors['--studio-ground']} roughness={.95} /></mesh>
        <group position={[(site.w - frame.site.w) / 2, 0, (site.h - frame.site.h) / 2]}>
        {plan.rooms.map(room => <RoomVolume key={room.id} room={room} plan={plan} site={site} isSelected={false} onSelectRoom={ignoreSelection} sectionHeight={cut} wireframe={false} edgeColor={colors['--studio-ink']} architectural />)}
        {plan.openings.map(opening => <OpeningPanel key={opening.id} opening={opening} site={site} sectionHeight={cut} wireframe={false} edgeColor={colors['--studio-ink']} architectural />)}
        {plan.furniture.map(item => <FurniturePiece key={item.id} item={item} site={site} sectionHeight={cut} wireframe={false} edgeColor={colors['--studio-ink']} architectural />)}
        {plan.furniture.filter(f => changed.has(f.id)).map(f => {
          const r = furnitureRectFor(f, site), x = r.x / 100 * site.w - site.w / 2, z = r.y / 100 * site.h - site.h / 2
          const w = r.w / 100 * site.w, h = r.h / 100 * site.h
          return <Line key={`change-${f.id}`} points={[[x, .115, z], [x + w, .115, z], [x + w, .115, z + h], [x, .115, z + h], [x, .115, z]]} color={theme.action} lineWidth={2} depthTest={false} />
        })}
        </group>
      </Canvas>
    </div>
    <p>Read-only local geometry · drag to orbit, scroll to zoom. A/B keeps this camera and sun. Accent floor outlines mark changed furniture. Full-height walls cast shadows; roof hidden. Furniture is schematic. PNG saves the full frame without fitting each option separately.</p>
    {side === 'morph' && <p>Morph slides {coverage.continuous} measured element{coverage.continuous === 1 ? '' : 's'} between the two plans at a fixed camera and sun.
      {coverage.swapped > 0 && <> {coverage.swapped} cannot interpolate — added, removed, or changed between plans — so {coverage.swapped === 1 ? 'it switches' : 'they switch'} at the midpoint rather than sliding from nowhere.</>}
      Rotation is a 90° turn, not a value on a line, so it switches at the midpoint too. Every number between the ends is a straight line between two numbers you or the drawing already fixed.</p>}
    {(baseline.walls?.length || proposed.walls?.length) ? <p>Unfinished pencil walls have no modeled height and are shown only in Measured plans.</p> : null}
    {error && <p role="alert">{error}</p>}
  </div>
}
