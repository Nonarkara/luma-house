import * as THREE from 'three'

export type RoofStyle = 'flat' | 'gable' | 'shed' | 'green'

export const ROOF_STYLES: RoofStyle[] = ['flat', 'gable', 'shed', 'green']

/**
 * A gable roof's ridge runs along the building's longer plan axis; the two
 * slopes span the shorter axis. Pure so the orientation logic is testable
 * without a WebGL context.
 */
export function gableRidgeAxis(width: number, depth: number): { ridgeAlongX: boolean; span: number; ridgeLength: number } {
  const ridgeAlongX = width >= depth
  return {
    ridgeAlongX,
    span: ridgeAlongX ? depth : width,
    ridgeLength: ridgeAlongX ? width : depth,
  }
}

/** Triangular-prism gable geometry: two slopes meeting at a ridge, closed
 * triangular gable ends — an honest volume, not a hip-roof cone standing in
 * for it. ~35% rise/span ratio is an ordinary residential pitch (~35°). */
export function buildGableGeometry(width: number, depth: number): THREE.BufferGeometry {
  const { ridgeAlongX, span, ridgeLength } = gableRidgeAxis(width, depth)
  const rise = span * 0.35
  const half = span / 2

  const shape = new THREE.Shape()
  shape.moveTo(-half, 0)
  shape.lineTo(0, rise)
  shape.lineTo(half, 0)
  shape.closePath()

  const geometry = new THREE.ExtrudeGeometry(shape, { depth: ridgeLength, bevelEnabled: false })
  geometry.translate(0, 0, -ridgeLength / 2)
  if (ridgeAlongX) geometry.rotateY(Math.PI / 2)
  return geometry
}
