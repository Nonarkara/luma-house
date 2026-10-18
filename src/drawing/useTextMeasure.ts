import { useEffect, useMemo, useState } from 'react'
import type { MeasureText } from './labels'

/** Measure the same loaded font and glyph ink that SVG will paint. */
export function useTextMeasure(font: string): MeasureText | undefined {
  const [revision, setRevision] = useState(0)
  useEffect(() => {
    let active = true
    const refresh = () => {
      if (active) setRevision(value => value + 1)
    }
    // A failed download still leaves a rendered fallback font to measure.
    void document.fonts.load(`10px ${font}`).then(refresh, refresh)
    return () => { active = false }
  }, [font])
  return useMemo(() => {
    if (typeof document === 'undefined') return undefined
    const context = document.createElement('canvas').getContext('2d')
    if (!context) return undefined
    const cache = new Map<string, ReturnType<MeasureText>>()
    return line => {
      const key = `${revision}|${line.fontSize}|${line.text}`
      const cached = cache.get(key)
      if (cached) return cached
      context.font = `${line.fontSize}px ${font}`
      const value = context.measureText(line.text)
      const metrics = { width: value.width, left: -value.actualBoundingBoxLeft,
        right: value.actualBoundingBoxRight, ascent: value.actualBoundingBoxAscent,
        descent: value.actualBoundingBoxDescent }
      cache.set(key, metrics)
      return metrics
    }
  }, [font, revision])
}
