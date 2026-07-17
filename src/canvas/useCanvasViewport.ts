import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type RefObject, type WheelEvent as ReactWheelEvent } from 'react'

export const MIN_ZOOM = 1
const MAX_ZOOM = 2.5
const ZOOM_STEP = 0.1

export interface ViewportState {
  zoom: number
  panX: number
  panY: number
}

function clampZoom(zoom: number) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
}

export function constrainViewport(viewport: ViewportState, width: number, height: number): ViewportState {
  const zoom = clampZoom(viewport.zoom)
  if (zoom === MIN_ZOOM) return { zoom, panX: 0, panY: 0 }

  const maxPanX = Math.max(0, (width * (zoom - 1)) / 2)
  const maxPanY = Math.max(0, (height * (zoom - 1)) / 2)
  return {
    zoom,
    panX: Math.max(-maxPanX, Math.min(maxPanX, viewport.panX)),
    panY: Math.max(-maxPanY, Math.min(maxPanY, viewport.panY)),
  }
}

export function useCanvasViewport(frameRef: RefObject<HTMLElement>) {
  const [viewport, setViewport] = useState<ViewportState>({ zoom: 1, panX: 0, panY: 0 })
  const panRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    originX: number
    originY: number
  } | null>(null)
  const pinchRef = useRef<{
    pointers: Map<number, { x: number; y: number }>
    startDistance: number
    startZoom: number
  } | null>(null)

  const zoomBy = useCallback((delta: number, originX?: number, originY?: number) => {
    setViewport((current) => {
      const nextZoom = clampZoom(current.zoom + delta)
      if (nextZoom === current.zoom) return current
      const frame = frameRef.current
      if (originX === undefined || originY === undefined) {
        return constrainViewport({ ...current, zoom: nextZoom }, frame?.clientWidth ?? 0, frame?.clientHeight ?? 0)
      }
      const scale = nextZoom / current.zoom
      return constrainViewport({
        zoom: nextZoom,
        panX: originX - (originX - current.panX) * scale,
        panY: originY - (originY - current.panY) * scale,
      }, frame?.clientWidth ?? 0, frame?.clientHeight ?? 0)
    })
  }, [frameRef])

  const zoomIn = useCallback(() => zoomBy(ZOOM_STEP), [zoomBy])
  const zoomOut = useCallback(() => zoomBy(-ZOOM_STEP), [zoomBy])
  const resetView = useCallback(() => setViewport({ zoom: 1, panX: 0, panY: 0 }), [])

  const onWheel = useCallback(
    (event: ReactWheelEvent) => {
      event.preventDefault()
      const frame = frameRef.current
      if (!frame) return
      const bounds = frame.getBoundingClientRect()
      const originX = event.clientX - bounds.left
      const originY = event.clientY - bounds.top
      const delta = event.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP
      zoomBy(delta, originX, originY)
    },
    [frameRef, zoomBy],
  )

  const beginPan = useCallback(
    (event: ReactPointerEvent) => {
      if (event.button !== 0 || viewport.zoom <= MIN_ZOOM) return
      panRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: viewport.panX,
        originY: viewport.panY,
      }
      event.currentTarget.setPointerCapture(event.pointerId)
    },
    [viewport.panX, viewport.panY, viewport.zoom],
  )

  const movePan = useCallback((event: ReactPointerEvent) => {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    const frame = frameRef.current
    setViewport((current) => constrainViewport({
      ...current,
      panX: pan.originX + (event.clientX - pan.startX),
      panY: pan.originY + (event.clientY - pan.startY),
    }, frame?.clientWidth ?? 0, frame?.clientHeight ?? 0))
  }, [frameRef])

  const endPan = useCallback((event: ReactPointerEvent) => {
    const pan = panRef.current
    if (!pan || pan.pointerId !== event.pointerId) return
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* already released */
    }
    panRef.current = null
  }, [])

  const onViewportPointerDown = useCallback(
    (event: ReactPointerEvent) => {
      const pinch = pinchRef.current
      if (!pinch) {
        pinchRef.current = {
          pointers: new Map([[event.pointerId, { x: event.clientX, y: event.clientY }]]),
          startDistance: 0,
          startZoom: viewport.zoom,
        }
        beginPan(event)
        return
      }

      pinch.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      if (pinch.pointers.size === 2) {
        panRef.current = null
        const pts = [...pinch.pointers.values()]
        const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
        pinch.startDistance = distance
        pinch.startZoom = viewport.zoom
      }
    },
    [beginPan, viewport.zoom],
  )

  const onViewportPointerMove = useCallback(
    (event: ReactPointerEvent) => {
      const pinch = pinchRef.current
      if (pinch?.pointers.has(event.pointerId)) {
        pinch.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY })
      }

      if (pinch && pinch.pointers.size === 2 && pinch.startDistance > 0) {
        const pts = [...pinch.pointers.values()]
        const distance = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)
        const nextZoom = clampZoom(pinch.startZoom * (distance / pinch.startDistance))
        const frame = frameRef.current
        if (frame) {
          const bounds = frame.getBoundingClientRect()
          const midX = (pts[0].x + pts[1].x) / 2 - bounds.left
          const midY = (pts[0].y + pts[1].y) / 2 - bounds.top
          setViewport((current) => {
            const scale = nextZoom / current.zoom
            return constrainViewport({
              zoom: nextZoom,
              panX: midX - (midX - current.panX) * scale,
              panY: midY - (midY - current.panY) * scale,
            }, bounds.width, bounds.height)
          })
        }
        return
      }

      movePan(event)
    },
    [frameRef, movePan],
  )

  const onViewportPointerUp = useCallback(
    (event: ReactPointerEvent) => {
      const pinch = pinchRef.current
      pinch?.pointers.delete(event.pointerId)
      if (pinch && pinch.pointers.size < 2) {
        pinch.startDistance = 0
      }
      if (pinch && pinch.pointers.size === 0) {
        pinchRef.current = null
      }
      endPan(event)
    },
    [endPan],
  )

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const prevent = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) > 0) event.preventDefault()
    }
    frame.addEventListener('wheel', prevent, { passive: false })
    return () => frame.removeEventListener('wheel', prevent)
  }, [frameRef])

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const fitToBounds = () => {
      setViewport((current) => constrainViewport(current, frame.clientWidth, frame.clientHeight))
    }
    fitToBounds()
    const observer = new ResizeObserver(fitToBounds)
    observer.observe(frame)
    return () => observer.disconnect()
  }, [frameRef])

  return {
    viewport,
    zoomPercent: Math.round(viewport.zoom * 100),
    canZoomIn: viewport.zoom < MAX_ZOOM,
    canZoomOut: viewport.zoom > MIN_ZOOM,
    zoomIn,
    zoomOut,
    resetView,
    onWheel,
    onViewportPointerDown,
    onViewportPointerMove,
    onViewportPointerUp,
  }
}
