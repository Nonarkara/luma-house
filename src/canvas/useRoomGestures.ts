import { useCallback, useEffect, useRef, type PointerEvent as ReactPointerEvent, type RefObject } from 'react'
import type { Opening, PlanState, Room } from '../types'
import {
  clientToPercent,
  moveOpening,
  moveRoom,
  resizeRoom,
  scaleRoomFromCenter,
  type ResizeHandle,
} from './geometry'

type GestureKind = 'move-room' | 'resize-room' | 'pinch-room' | 'move-opening'

interface ActiveGesture {
  kind: GestureKind
  pointerIds: number[]
  points: Map<number, { x: number; y: number }>
  originX: number
  originY: number
  snapshot: PlanState
  roomId?: string
  openingId?: string
  handle?: ResizeHandle
  startRoom?: Room
  startOpening?: Opening
  startDistance?: number
}

export function useRoomGestures({
  plan,
  setPlan,
  commitSnapshot,
  setSelectedRoom,
  setSelectedOpening,
  activeTool,
  snapGrid,
  stageRef,
}: {
  plan: PlanState
  setPlan: (updater: PlanState | ((current: PlanState) => PlanState)) => void
  commitSnapshot: (snapshot: PlanState) => void
  setSelectedRoom: (id: string | null) => void
  setSelectedOpening: (id: string | null) => void
  activeTool: 'select' | 'window' | 'door'
  snapGrid: boolean
  stageRef: RefObject<HTMLElement>
}) {
  const gestureRef = useRef<ActiveGesture | null>(null)
  const planRef = useRef(plan)
  const snapRef = useRef(snapGrid)
  planRef.current = plan
  snapRef.current = snapGrid

  const stageBounds = useCallback(() => stageRef.current?.getBoundingClientRect() ?? null, [stageRef])

  const applyPointer = useCallback(
    (pointerId: number, clientX: number, clientY: number) => {
      const gesture = gestureRef.current
      const bounds = stageBounds()
      if (!gesture || !bounds || !gesture.points.has(pointerId)) return

      gesture.points.set(pointerId, { x: clientX, y: clientY })

      if (gesture.kind === 'pinch-room' && gesture.roomId && gesture.startRoom && gesture.startDistance) {
        const pts = [...gesture.points.values()]
        if (pts.length < 2) return
        const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
        const scale = distance / gesture.startDistance
        const next = scaleRoomFromCenter(gesture.startRoom, scale, snapRef.current)
        setPlan((current) => ({
          ...current,
          rooms: current.rooms.map((item) => (item.id === gesture.roomId ? { ...item, ...next } : item)),
        }))
        return
      }

      const dx = ((clientX - gesture.originX) / bounds.width) * 100
      const dy = ((clientY - gesture.originY) / bounds.height) * 100

      if (gesture.kind === 'move-room' && gesture.roomId && gesture.startRoom) {
        const next = moveRoom(gesture.startRoom, dx, dy, snapRef.current)
        setPlan((current) => ({
          ...current,
          rooms: current.rooms.map((item) => (item.id === gesture.roomId ? { ...item, ...next } : item)),
        }))
        return
      }

      if (gesture.kind === 'resize-room' && gesture.roomId && gesture.startRoom && gesture.handle) {
        const next = resizeRoom(gesture.startRoom, gesture.handle, dx, dy, snapRef.current)
        setPlan((current) => ({
          ...current,
          rooms: current.rooms.map((item) => (item.id === gesture.roomId ? { ...item, ...next } : item)),
        }))
        return
      }

      if (gesture.kind === 'move-opening' && gesture.openingId && gesture.startOpening) {
        const next = moveOpening(gesture.startOpening, dx, dy, snapRef.current)
        setPlan((current) => ({
          ...current,
          openings: current.openings.map((item) => (item.id === gesture.openingId ? next : item)),
        }))
      }
    },
    [setPlan, stageBounds],
  )

  const endPointer = useCallback(
    (pointerId: number) => {
      const gesture = gestureRef.current
      if (!gesture) return
      gesture.points.delete(pointerId)
      gesture.pointerIds = gesture.pointerIds.filter((id) => id !== pointerId)
      if (gesture.pointerIds.length === 0) {
        commitSnapshot(gesture.snapshot)
        gestureRef.current = null
      } else if (gesture.kind === 'pinch-room') {
        gesture.kind = 'move-room'
        const remaining = gesture.points.get(gesture.pointerIds[0])
        if (remaining) {
          gesture.originX = remaining.x
          gesture.originY = remaining.y
          gesture.startRoom = planRef.current.rooms.find((item) => item.id === gesture.roomId)
        }
      }
    },
    [commitSnapshot],
  )

  useEffect(() => {
    const onMove = (event: PointerEvent) => applyPointer(event.pointerId, event.clientX, event.clientY)
    const onUp = (event: PointerEvent) => endPointer(event.pointerId)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
  }, [applyPointer, endPointer])

  const onRoomPointerDown = useCallback(
    (event: ReactPointerEvent, room: Room, handle?: ResizeHandle) => {
      event.stopPropagation()
      setSelectedRoom(room.id)
      setSelectedOpening(null)
      if (activeTool !== 'select') return

      const existing = gestureRef.current
      if (existing?.kind === 'move-room' && existing.roomId === room.id && !handle) {
        existing.pointerIds.push(event.pointerId)
        existing.points.set(event.pointerId, { x: event.clientX, y: event.clientY })
        if (existing.pointerIds.length === 2) {
          const pts = [...existing.points.values()]
          existing.kind = 'pinch-room'
          existing.startDistance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
          existing.startRoom = planRef.current.rooms.find((item) => item.id === room.id) ?? room
        }
        return
      }

      gestureRef.current = {
        kind: handle ? 'resize-room' : 'move-room',
        pointerIds: [event.pointerId],
        points: new Map([[event.pointerId, { x: event.clientX, y: event.clientY }]]),
        originX: event.clientX,
        originY: event.clientY,
        snapshot: planRef.current,
        roomId: room.id,
        handle,
        startRoom: room,
      }
    },
    [activeTool, setSelectedOpening, setSelectedRoom],
  )

  const onOpeningPointerDown = useCallback(
    (event: ReactPointerEvent, opening: Opening) => {
      event.stopPropagation()
      setSelectedOpening(opening.id)
      setSelectedRoom(null)
      if (activeTool !== 'select') return
      gestureRef.current = {
        kind: 'move-opening',
        pointerIds: [event.pointerId],
        points: new Map([[event.pointerId, { x: event.clientX, y: event.clientY }]]),
        originX: event.clientX,
        originY: event.clientY,
        snapshot: planRef.current,
        openingId: opening.id,
        startOpening: opening,
      }
    },
    [activeTool, setSelectedOpening, setSelectedRoom],
  )

  const onGesturePointerMove = useCallback(
    (event: ReactPointerEvent) => {
      applyPointer(event.pointerId, event.clientX, event.clientY)
    },
    [applyPointer],
  )

  const onGesturePointerUp = useCallback(
    (event: ReactPointerEvent) => {
      endPointer(event.pointerId)
    },
    [endPointer],
  )

  const placeOpeningAt = useCallback(
    (clientX: number, clientY: number) => {
      const bounds = stageBounds()
      if (!bounds || activeTool === 'select') return null
      const { x, y } = clientToPercent(clientX, clientY, bounds)
      const rotation: 0 | 90 = Math.min(y, 100 - y) < Math.min(x, 100 - x) ? 0 : 90
      return {
        id: `${activeTool}-${Date.now()}`,
        type: activeTool,
        x,
        y,
        rotation,
      } satisfies Opening
    },
    [activeTool, stageBounds],
  )

  return {
    onRoomPointerDown,
    onOpeningPointerDown,
    onGesturePointerMove,
    onGesturePointerUp,
    placeOpeningAt,
    isGesturing: () => gestureRef.current !== null,
  }
}
