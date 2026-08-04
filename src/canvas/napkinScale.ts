import type { SiteSpec } from '../types'

export interface Point2D {
  x: number
  y: number
}

export interface NapkinCalibrationLine {
  p1: Point2D
  p2: Point2D
}

/**
 * Calculates new site width & depth meters based on a reference line drawn
 * over a napkin sketch and its known real-world length.
 */
export function calibrateSiteFromNapkinLine(
  site: SiteSpec,
  line: NapkinCalibrationLine,
  knownMeters: number,
): { newSite: SiteSpec; scaleRatio: number } {
  if (!Number.isFinite(knownMeters) || knownMeters <= 0) {
    return { newSite: site, scaleRatio: 1 }
  }

  const dxMeters = ((line.p2.x - line.p1.x) / 100) * site.w
  const dyMeters = ((line.p2.y - line.p1.y) / 100) * site.h
  const measuredMeters = Math.hypot(dxMeters, dyMeters)

  if (measuredMeters <= 0.001) {
    return { newSite: site, scaleRatio: 1 }
  }

  const scaleRatio = knownMeters / measuredMeters
  const newW = Math.min(200, Math.max(2, site.w * scaleRatio))
  const newH = Math.min(200, Math.max(2, site.h * scaleRatio))

  return {
    newSite: {
      ...site,
      w: newW,
      h: newH,
      unit: Math.min(site.unit, newW, newH),
    },
    scaleRatio,
  }
}
