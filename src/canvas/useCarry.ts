import { useCallback, useEffect, useRef, useState } from 'react'
import { findFurniturePlacementAt } from './furniturePlacement'
import { clientToPercent } from './geometry'
import type { FurnitureChoice } from './furnitureReplacement'
import type { Furniture, Opening, PlanState } from '../types'
import type { RefObject } from 'react'

/**
 * Carrying something from a palette into the drawing.
 *
 * The studio is used with a finger as much as with a mouse, so this is built
 * on pointer events rather than HTML drag-and-drop: press a window, a door or
 * a piece of furniture, move, and let go over the plan. The thing follows the
 * pointer, the plan says where it would land, and letting go puts it there.
 */
export type CarryPayload =
  | { kind: 'opening'; type: 'window' | 'door' }
  | { kind: 'furniture'; choice: FurnitureChoice; label: string }

export interface CarryPoint {
  x: number
  y: number
}

export interface CarryPreview {
  kind: 'opening' | 'furniture'
  opening?: Opening
  item?: Furniture
}

interface UseCarryOptions {
  plan: PlanState
  stageRef: RefObject<HTMLDivElement | null>
  /** Where an opening would land for a pointer at these client coordinates. */
  placeOpeningAt: (clientX: number, clientY: number) => Opening | null
  /** Commit a change to the plan. */
  commit: (next: PlanState | ((current: PlanState) => PlanState), label?: string) => void
  /** Say what happened. */
  onToast: (message: string) => void
}

const DRAG_THRESHOLD_PX = 4

export function useCarry({ plan, stageRef, placeOpeningAt, commit, onToast }: UseCarryOptions) {
  const [payload, setPayload] = useState<CarryPayload | null>(null)
  const [point, setPoint] = useState<CarryPoint | null>(null)
  const [preview, setPreview] = useState<CarryPreview | null>(null)
  const startRef = useRef<CarryPoint | null>(null)
  const movedRef = useRef(false)
  const pointerRef = useRef<number | null>(null)
  const suppressClickRef = useRef(false)

  useEffect(() => {
    // A drag can return to its source and still generate a native click.
    // Consume that gesture's click before React can add/place a second item.
    // Fresh pointer presses clear stale suppression; keyboard clicks stay native.
    const onDown = () => { suppressClickRef.current = false }
    const onClick = (event: MouseEvent) => {
      if (!suppressClickRef.current || event.detail === 0) return
      suppressClickRef.current = false
      event.preventDefault()
      event.stopImmediatePropagation()
    }
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('click', onClick, true)
    return () => {
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('click', onClick, true)
    }
  }, [])

  /** Begin carrying. A press that never moves is a tap, and the tap belongs to
   *  the button that was pressed — the caller keeps that behaviour. */
  const begin = useCallback((next: CarryPayload, clientX: number, clientY: number, pointerId: number) => {
    if (pointerRef.current !== null) return
    pointerRef.current = pointerId
    startRef.current = { x: clientX, y: clientY }
    movedRef.current = false
    setPoint({ x: clientX, y: clientY })
    setPreview(null)
    setPayload(next)
  }, [])

  const cancel = useCallback(() => {
    if (pointerRef.current !== null) suppressClickRef.current = true
    pointerRef.current = null
    startRef.current = null
    movedRef.current = false
    setPayload(null)
    setPoint(null)
    setPreview(null)
  }, [])

  useEffect(() => {
    if (!payload) return

    const sheetPoint = (clientX: number, clientY: number) => {
      const bounds = stageRef.current?.getBoundingClientRect()
      if (!bounds) return null
      return clientToPercent(clientX, clientY, bounds)
    }

    const onMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerRef.current) return
      const start = startRef.current
      if (start && (Math.abs(event.clientX - start.x) > DRAG_THRESHOLD_PX || Math.abs(event.clientY - start.y) > DRAG_THRESHOLD_PX)) {
        movedRef.current = true
      }
      setPoint({ x: event.clientX, y: event.clientY })
      if (payload.kind === 'opening') {
        setPreview((current) => {
          const opening = placeOpeningAt(event.clientX, event.clientY)
          if (current?.kind === 'opening' && current.opening?.x === opening?.x && current.opening?.y === opening?.y) return current
          return opening ? { kind: 'opening', opening } : null
        })
        return
      }
      const at = sheetPoint(event.clientX, event.clientY)
      if (!at) {
        setPreview(null)
        return
      }
      const item: Furniture = { id: '__carry_trial__', kind: payload.choice.kind, label: payload.choice.label, wM: payload.choice.wM, dM: payload.choice.dM, ...(payload.choice.assetId ? { assetId: payload.choice.assetId } : {}), x: 0, y: 0, rotated: false }
      const placed = findFurniturePlacementAt(plan, item, at)
      setPreview((current) => {
        if (current?.kind === 'furniture' && current.item?.x === placed?.item.x && current.item?.y === placed?.item.y) return current
        return placed ? { kind: 'furniture', item: placed.item } : null
      })
    }

    const onUp = (event: PointerEvent) => {
      if (event.pointerId !== pointerRef.current) return
      const moved = movedRef.current
      cancel()
      if (!moved) suppressClickRef.current = false
      if (!moved) return

      if (payload.kind === 'opening') {
        const opening = placeOpeningAt(event.clientX, event.clientY)
        if (!opening) {
          onToast('Let go on a wall long enough for the full opening')
          return
        }
        commit((current) => ({ ...current, openings: [...current.openings, opening] }), `Place ${opening.type}`)
        onToast(`${opening.type === 'window' ? 'Window' : 'Door'} placed`)
        return
      }

      const at = sheetPoint(event.clientX, event.clientY)
      if (!at) {
        onToast('Drop it on the plan')
        return
      }
      const item: Furniture = { id: `f-${crypto.randomUUID()}`, kind: payload.choice.kind, label: payload.choice.label, wM: payload.choice.wM, dM: payload.choice.dM, ...(payload.choice.assetId ? { assetId: payload.choice.assetId } : {}), x: 0, y: 0, rotated: false }
      const placed = findFurniturePlacementAt(plan, item, at)
      if (!placed) {
        onToast(plan.rooms.length ? 'No clear space at real size there' : 'Draw a room before adding furniture')
        return
      }
      commit((current) => ({ ...current, furniture: [...current.furniture, { ...placed.item, id: item.id }] }), 'Place furniture')
      onToast(placed.exact
        ? `${payload.label} placed at real size in ${placed.room.name}`
        : `${payload.label} placed at the nearest clear space in ${placed.room.name}`)
    }

    // A cancelled pointer (the browser took the touch for a scroll, a call came
    // in) is not a drop: it carries no position and must place nothing.
    const onCancel = (event: PointerEvent) => {
      if (event.pointerId === pointerRef.current) cancel()
    }
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') cancel() }
    const onVisibility = () => { if (document.hidden) cancel() }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
    window.addEventListener('keydown', onKeyDown, true)
    window.addEventListener('blur', cancel)
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      window.removeEventListener('keydown', onKeyDown, true)
      window.removeEventListener('blur', cancel)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [payload, plan, stageRef, placeOpeningAt, commit, onToast, cancel])

  return { payload, point, preview, begin, cancel }
}
