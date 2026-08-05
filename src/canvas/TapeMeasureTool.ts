export interface MeasurePoint {
  x: number // percentage 0..100
  y: number // percentage 0..100
}

export interface MeasureLine {
  start: MeasurePoint
  end: MeasurePoint
  distanceMeters: number
  distanceFeet: number
}

/**
 * Calculates Euclidean distance between 2 percentage points on a site.
 */
export function calculateMeasureDistance(
  start: MeasurePoint,
  end: MeasurePoint,
  siteWidthMeters: number,
  siteHeightMeters: number,
): MeasureLine {
  const dxM = ((end.x - start.x) / 100) * siteWidthMeters
  const dyM = ((end.y - start.y) / 100) * siteHeightMeters
  const distanceMeters = Math.sqrt(dxM * dxM + dyM * dyM)
  const distanceFeet = distanceMeters * 3.28084

  return {
    start,
    end,
    distanceMeters: parseFloat(distanceMeters.toFixed(2)),
    distanceFeet: parseFloat(distanceFeet.toFixed(2)),
  }
}
