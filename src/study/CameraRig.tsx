import { useLayoutEffect, useMemo, useRef, type MutableRefObject, type RefObject } from 'react'
import { useThree } from '@react-three/fiber'
import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three'
import type { OrbitControls } from 'three-stdlib'
import type { PlanState } from '../types'
import { drawingCamera, modelBounds } from './geometry'
import type { DrawingPreset, ReadyStudyCapture, StudyCamera, StudyCapture, StudyTime } from './types'

export function CameraRig({ plan, preset, walking, touring, request, controlsRef, captureRef, time, fitVersion = 0 }: {
  plan: PlanState; preset: DrawingPreset; walking: boolean; touring: boolean
  request: { id: number; camera: StudyCamera } | null
  controlsRef: RefObject<OrbitControls>
  captureRef?: MutableRefObject<ReadyStudyCapture | null>
  time?: StudyTime
  fitVersion?: number
}) {
  const { size, get, set, invalidate } = useThree()
  // R3F must not replace a physical orthographic frustum with viewport pixels
  // during resize; this rig owns projection updates for both cameras.
  const perspective = useMemo(() => Object.assign(new PerspectiveCamera(45, 1, 0.01, 10000), { manual: true }), [])
  const parallel = useMemo(() => Object.assign(new OrthographicCamera(-1, 1, 1, -1, 0.01, 10000), { manual: true }), [])
  const aspect = Math.max(0.1, size.width / Math.max(1, size.height))
  const aspectRef = useRef(aspect)
  aspectRef.current = aspect
  const projection = walking || touring ? 'perspective' : request?.camera.projection ?? (preset === 'orbit' ? 'perspective' : 'orthographic')
  const active = projection === 'orthographic' ? parallel : perspective
  // Furniture and opening edits invalidate shadows, not the user's camera.
  const bounds = modelBounds(plan)
  const framingKey = JSON.stringify([bounds.min.toArray(), bounds.max.toArray()])
  const planRef = useRef(plan)
  planRef.current = plan

  useLayoutEffect(() => {
    const old = get().camera
    set({ camera: active })
    return () => { set({ camera: old }) }
  }, [active, get, set])

  useLayoutEffect(() => {
    const model = planRef.current
    const aspect = aspectRef.current
    let target: [number, number, number]
    if (request && !walking && !touring) {
      const c = request.camera
      target = c.target
      active.position.fromArray(c.position); active.up.fromArray(c.up); active.zoom = c.zoom
      if (active instanceof PerspectiveCamera) { active.fov = c.fov; active.aspect = aspect }
      else {
        active.top = c.fieldHeight / 2; active.bottom = -c.fieldHeight / 2
        active.left = -c.fieldHeight * aspect / 2; active.right = c.fieldHeight * aspect / 2
      }
    } else if (active instanceof OrthographicCamera) {
      const frame = drawingCamera(model, preset === 'topdown' ? 'topdown' : 'axonometric', aspect)
      active.copy(frame.camera)
      target = frame.target
    } else {
      const box = modelBounds(model), center = box.getCenter(new Vector3())
      const extent = Math.max(...box.getSize(new Vector3()).toArray(), 3)
      target = center.toArray() as [number, number, number]
      active.up.set(0, 1, 0); active.zoom = 1; active.fov = 45; active.aspect = aspect
      active.position.copy(center).add(new Vector3(1, 0.9, 1).normalize().multiplyScalar(extent * 1.9 / Math.min(aspect, 1.4)))
    }
    active.lookAt(new Vector3(...target)); active.updateProjectionMatrix(); active.updateMatrixWorld()
    if (controlsRef.current) { controlsRef.current.target.fromArray(target); controlsRef.current.update() }
    invalidate()
  }, [active, preset, framingKey, request, walking, touring, fitVersion, controlsRef, invalidate])

  useLayoutEffect(() => {
    // A selection row or window resize changes projection, not viewpoint.
    if (active instanceof PerspectiveCamera) active.aspect = aspect
    else { active.left = -active.top * aspect; active.right = active.top * aspect }
    active.updateProjectionMatrix(); invalidate()
  }, [active, aspect, invalidate])

  useLayoutEffect(() => {
    if (!captureRef || !time) return // Read-only comparisons need a camera, not saved-view capture.
    const capture = async (): Promise<StudyCapture> => {
      // OrbitControls can stop requesting frames with a tiny inertial delta
      // still pending. Flush it once so later edits or sun captures cannot
      // advance the viewpoint after we have recorded it.
      const controls = controlsRef.current
      if (controls) {
        const damping = controls.enableDamping
        controls.enableDamping = false; controls.update(); controls.enableDamping = damping
      }
      invalidate()
      await new Promise<void>(resolve => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
      const state = get()
      // Capture an actual completed scene frame, even when the viewport was idle.
      state.gl.render(state.scene, state.camera)
      const c = state.camera
      const image = document.createElement('canvas')
      const canvas = state.gl.domElement, width = canvas.width, height = canvas.height
      // Keep the model legible in a small preview of a very wide viewport.
      // Crop existing pixels only; the saved camera remains the original one.
      let cropWidth = width, cropHeight = height, left = 0, top = 0
      if (c instanceof OrthographicCamera) {
        const box = modelBounds(planRef.current), center = box.getCenter(new Vector3()).project(c)
        let x0 = width, x1 = 0, y0 = height, y1 = 0
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
          const p = new Vector3(x, y, z).project(c)
          const px = (p.x + 1) * width / 2, py = (1 - p.y) * height / 2
          x0 = Math.min(x0, px); x1 = Math.max(x1, px); y0 = Math.min(y0, py); y1 = Math.max(y1, py)
        }
        cropWidth = Math.min(width, Math.max((x1 - x0) * 1.3, height * 1.6))
        cropHeight = Math.min(height, Math.max((y1 - y0) * 1.3, cropWidth / 1.8))
        left = Math.max(0, Math.min(width - cropWidth, (center.x + 1) * width / 2 - cropWidth / 2))
        top = Math.max(0, Math.min(height - cropHeight, (1 - center.y) * height / 2 - cropHeight / 2))
      }
      const scale = Math.min(1, 720 / Math.max(cropWidth, cropHeight))
      image.width = Math.round(cropWidth * scale); image.height = Math.round(cropHeight * scale)
      const context = image.getContext('2d')
      if (!context || !image.width || !image.height) throw new Error('The 3D view is not ready to capture.')
      context.drawImage(canvas, left, top, cropWidth, cropHeight, 0, 0, image.width, image.height)
      const target = controlsRef.current?.target ?? modelBounds(planRef.current).getCenter(new Vector3())
      return { image: image.toDataURL('image/jpeg', 0.8), camera: {
        projection: c instanceof OrthographicCamera ? 'orthographic' : 'perspective',
        position: c.position.toArray() as [number, number, number], target: target.toArray() as [number, number, number],
        up: c.up.toArray() as [number, number, number], zoom: c.zoom,
        fov: c instanceof PerspectiveCamera ? c.fov : 45, fieldHeight: c instanceof OrthographicCamera ? c.top - c.bottom : 1,
      } }
    }
    const ready = { time: { day: time.day, hour: time.hour, year: time.year }, capture }
    captureRef.current = ready
    return () => { if (captureRef.current === ready) captureRef.current = null }
  }, [captureRef, controlsRef, get, invalidate, time])
  return null
}
