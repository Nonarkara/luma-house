/** Exact union of axis-aligned boxes. Only the exterior surface is emitted;
 * coordinate subdivision keeps adjacent faces conforming at wall junctions. */
export type SolidBox = [number, number, number, number, number, number]
const MAX_CELLS = 2_000_000
export function unionBoxes(boxes: SolidBox[]): number[] {
  if (!boxes.length) return []
  const axes = [0, 1, 2].map(axis => [...new Set(boxes.flatMap(b => [b[axis], b[axis + 3]]).map(v => Number(v.toFixed(8))))].sort((a, b) => a - b))
  const [xs, ys, zs] = axes
  const nx = xs.length - 1, ny = ys.length - 1, nz = zs.length - 1
  if (nx * ny * nz > MAX_CELLS) throw new Error('This model has too many wall intersections to export safely. Simplify the plan before exporting.')
  const cells = new Uint8Array(nx * ny * nz)
  const maps = axes.map(values => new Map(values.map((v, i) => [v, i])))
  const index = (x: number, y: number, z: number) => x + nx * (y + ny * z)
  for (const box of boxes) {
    const lo = [0, 1, 2].map(a => maps[a].get(Number(box[a].toFixed(8)))!)
    const hi = [0, 1, 2].map(a => maps[a].get(Number(box[a + 3].toFixed(8)))!)
    for (let z = lo[2]; z < hi[2]; z++) for (let y = lo[1]; y < hi[1]; y++) cells.fill(1, index(lo[0], y, z), index(hi[0], y, z))
  }
  const occupied = (x: number, y: number, z: number) => x >= 0 && x < nx && y >= 0 && y < ny && z >= 0 && z < nz && cells[index(x, y, z)] === 1
  const out: number[] = []
  const quads = [[0, 3, 2, 1], [4, 5, 6, 7], [0, 1, 5, 4], [2, 3, 7, 6], [1, 2, 6, 5], [3, 0, 4, 7]]
  const neighbors = [[0, 0, -1], [0, 0, 1], [0, -1, 0], [0, 1, 0], [1, 0, 0], [-1, 0, 0]]
  for (let z = 0; z < nz; z++) for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
    if (!occupied(x, y, z)) continue
    const v = [[xs[x], ys[y], zs[z]], [xs[x + 1], ys[y], zs[z]], [xs[x + 1], ys[y + 1], zs[z]], [xs[x], ys[y + 1], zs[z]],
      [xs[x], ys[y], zs[z + 1]], [xs[x + 1], ys[y], zs[z + 1]], [xs[x + 1], ys[y + 1], zs[z + 1]], [xs[x], ys[y + 1], zs[z + 1]]]
    neighbors.forEach(([dx, dy, dz], face) => {
      if (occupied(x + dx, y + dy, z + dz)) return
      const [a, b, c, d] = quads[face]
      out.push(...v[a], ...v[b], ...v[c], ...v[a], ...v[c], ...v[d])
    })
  }
  return out
}
