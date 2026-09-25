import type { Opening } from './types'

/** Width, height, sill and head describe one aperture in every view. */
export function openingDimensions(opening: Opening) {
  const window = opening.type === 'window'
  const width = opening.widthM ?? (window ? 1.6 : 0.9)
  const sill = opening.sillHeightM ?? (window ? 0.9 : 0)
  const height = opening.heightM ?? (opening.headHeightM !== undefined ? Math.max(0.1, opening.headHeightM - sill) : window ? 1.2 : 2.1)
  return { width, height, sill, head: sill + height }
}

export function updateOpeningDimensions(opening: Opening, updates: Partial<Opening>): Opening {
  const next = { ...opening, ...updates }
  if (updates.headHeightM !== undefined && updates.heightM === undefined) {
    next.heightM = Math.max(0.1, updates.headHeightM - openingDimensions(next).sill)
  }
  if (updates.heightM !== undefined || updates.headHeightM !== undefined || updates.sillHeightM !== undefined) {
    next.headHeightM = openingDimensions(next).head
  }
  return next
}
