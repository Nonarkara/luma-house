import { BufferGeometry, DoubleSide, Float32BufferAttribute, Mesh, MeshBasicMaterial, Raycaster, Vector3 } from 'three'
/** Independent ray/triangle parity test, away from surface boundaries. */
export function containsPoint(positions: number[], point: [number, number, number]): boolean {
  const geometry = new BufferGeometry().setAttribute('position', new Float32BufferAttribute(positions, 3))
  const material = new MeshBasicMaterial({ side: DoubleSide })
  const mesh = new Mesh(geometry, material)
  mesh.updateMatrixWorld()
  const hits = new Raycaster(new Vector3(...point), new Vector3(0.337, 0.511, 1).normalize()).intersectObject(mesh)
  const distances = hits.map(hit => hit.distance).filter((d, i, all) => i === 0 || Math.abs(d - all[i - 1]) > 1e-6)
  geometry.dispose(); material.dispose()
  return distances.length % 2 === 1
}
