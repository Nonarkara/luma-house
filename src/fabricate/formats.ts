// Mesh file writers: binary STL, 3MF (stored zip) and GLB.
// Adapted from earthtojake/text-to-cad, packages/core/src/lib/export/meshFormats.js
// and packageMeshExport.js — MIT License, Copyright (c) 2026 Thompson Labs LLC.
// Ported to TypeScript and reduced to what designon exports; no third-party code.

/** One coloured part: a flat list of triangles, 9 numbers per triangle. */
export interface MeshPart {
  name: string
  color: string
  positions: number[]
}

const encoder = new TextEncoder()

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((sum, p) => sum + p.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const p of parts) {
    out.set(p, offset)
    offset += p.length
  }
  return out
}

export function triangleNormal(p: ArrayLike<number>, o: number): [number, number, number] {
  const ux = p[o + 3] - p[o], uy = p[o + 4] - p[o + 1], uz = p[o + 5] - p[o + 2]
  const vx = p[o + 6] - p[o], vy = p[o + 7] - p[o + 1], vz = p[o + 8] - p[o + 2]
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  const length = Math.sqrt(nx * nx + ny * ny + nz * nz)
  return length > 1e-12 ? [nx / length, ny / length, nz / length] : [0, 0, 1]
}

/** Binary STL. STL has no units; slicers read the numbers as millimetres. */
export function meshToBinaryStl(parts: MeshPart[], name = 'designon'): Uint8Array {
  const positions = parts.flatMap((p) => p.positions)
  const triangles = Math.floor(positions.length / 9)
  const bytes = new Uint8Array(84 + triangles * 50)
  const view = new DataView(bytes.buffer)
  bytes.set(encoder.encode(`designon ${name}`.slice(0, 80)), 0)
  view.setUint32(80, triangles, true)
  let offset = 84
  for (let t = 0; t < triangles; t += 1) {
    const o = t * 9
    for (const c of triangleNormal(positions, o)) { view.setFloat32(offset, c, true); offset += 4 }
    for (let v = 0; v < 9; v += 1) { view.setFloat32(offset, positions[o + v], true); offset += 4 }
    view.setUint16(offset, 0, true)
    offset += 2
  }
  return bytes
}

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    let c = (crc ^ byte) & 0xff
    for (let bit = 0; bit < 8; bit += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = c ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** Uncompressed zip with a fixed DOS timestamp, so the same plan writes the same bytes. */
export function zipStore(files: Array<{ name: string; body: string | Uint8Array }>): Uint8Array {
  const local: Uint8Array[] = []
  const central: Uint8Array[] = []
  let offset = 0
  const dosDate = (1 << 5) | 1
  for (const file of files) {
    const name = encoder.encode(file.name)
    const body = typeof file.body === 'string' ? encoder.encode(file.body) : file.body
    const crc = crc32(body)
    const head = new Uint8Array(30)
    const h = new DataView(head.buffer)
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(12, dosDate, true)
    h.setUint32(14, crc, true); h.setUint32(18, body.length, true); h.setUint32(22, body.length, true)
    h.setUint16(26, name.length, true)
    local.push(head, name, body)
    const dir = new Uint8Array(46)
    const d = new DataView(dir.buffer)
    d.setUint32(0, 0x02014b50, true); d.setUint16(4, 20, true); d.setUint16(6, 20, true); d.setUint16(14, dosDate, true)
    d.setUint32(16, crc, true); d.setUint32(20, body.length, true); d.setUint32(24, body.length, true)
    d.setUint16(28, name.length, true); d.setUint32(42, offset, true)
    central.push(dir, name)
    offset += head.length + name.length + body.length
  }
  const directory = concat(central)
  const end = new Uint8Array(22)
  const e = new DataView(end.buffer)
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true)
  e.setUint32(12, directory.length, true); e.setUint32(16, offset, true)
  return concat([...local, directory, end])
}

const xml = (value: string) => value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** 3MF in millimetres, one coloured object per part — what Bambu, Prusa and Cura open natively. */
export function meshTo3mf(parts: MeshPart[], name = 'designon'): Uint8Array {
  const materials = parts.map((p, i) => `      <base name="${xml(p.name)}-${i}" displaycolor="${xml(p.color.toUpperCase())}FF"/>`).join('\n')
  const objects: string[] = []
  const items: string[] = []
  parts.forEach((part, index) => {
    const vertices: string[] = []
    const triangles: string[] = []
    const seen = new Map<string, number>()
    const id = (x: number, y: number, z: number) => {
      const key = `${x}:${y}:${z}`
      let found = seen.get(key)
      if (found === undefined) {
        found = seen.size
        seen.set(key, found)
        vertices.push(`        <vertex x="${x}" y="${y}" z="${z}"/>`)
      }
      return found
    }
    const p = part.positions
    for (let k = 0; k < p.length; k += 9) {
      const a = id(p[k], p[k + 1], p[k + 2])
      const b = id(p[k + 3], p[k + 4], p[k + 5])
      const c = id(p[k + 6], p[k + 7], p[k + 8])
      if (a !== b && b !== c && c !== a) triangles.push(`        <triangle v1="${a}" v2="${b}" v3="${c}"/>`)
    }
    const objectId = index + 2
    objects.push(
      `    <object id="${objectId}" name="${xml(part.name)}" type="model" pid="1" pindex="${index}">\n      <mesh>\n        <vertices>\n${vertices.join('\n')}\n        </vertices>\n        <triangles>\n${triangles.join('\n')}\n        </triangles>\n      </mesh>\n    </object>`,
    )
    items.push(`    <item objectid="${objectId}"/>`)
  })
  const model = `<?xml version="1.0" encoding="UTF-8"?>
<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02">
  <metadata name="Title">${xml(name)}</metadata>
  <metadata name="Application">designon</metadata>
  <resources>
    <basematerials id="1">
${materials}
    </basematerials>
${objects.join('\n')}
  </resources>
  <build>
${items.join('\n')}
  </build>
</model>
`
  const contentTypes = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/>
</Types>
`
  const rels = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/>
</Relationships>
`
  return zipStore([
    { name: '[Content_Types].xml', body: contentTypes },
    { name: '_rels/.rels', body: rels },
    { name: '3D/3dmodel.model', body: model },
  ])
}

function hexToRgb01(hex: string): [number, number, number] {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex)
  if (!m) return [0.8, 0.8, 0.8]
  const n = parseInt(m[1], 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

/** GLB in metres, Y up, as glTF requires. Input is Z-up (x east, y north, z up). */
export function meshToGlb(parts: MeshPart[], name = 'designon'): Uint8Array {
  const chunks: Uint8Array[] = []
  const bufferViews: object[] = []
  const accessors: object[] = []
  const meshes: object[] = []
  const nodes: object[] = []
  const materials: object[] = []
  let byteOffset = 0
  parts.forEach((part, index) => {
    const count = part.positions.length / 3
    const pos = new Float32Array(part.positions.length)
    const nor = new Float32Array(part.positions.length)
    const min = [Infinity, Infinity, Infinity]
    const max = [-Infinity, -Infinity, -Infinity]
    for (let i = 0; i < count; i += 1) {
      // (x, y_north, z_up) → glTF (x, z_up, -y_north): a rotation, so winding holds.
      const x = part.positions[i * 3], y = part.positions[i * 3 + 1], z = part.positions[i * 3 + 2]
      const v = [x, z, -y]
      v.forEach((c, k) => { pos[i * 3 + k] = c; min[k] = Math.min(min[k], c); max[k] = Math.max(max[k], c) })
    }
    for (let t = 0; t < count / 3; t += 1) {
      const n = triangleNormal(pos, t * 9)
      for (let k = 0; k < 3; k += 1) nor.set(n, t * 9 + k * 3)
    }
    for (const array of [pos, nor]) {
      const bytes = new Uint8Array(array.buffer)
      chunks.push(bytes)
      bufferViews.push({ buffer: 0, byteOffset, byteLength: bytes.length, target: 34962 })
      byteOffset += bytes.length
    }
    accessors.push(
      { bufferView: index * 2, componentType: 5126, count, type: 'VEC3', min, max },
      { bufferView: index * 2 + 1, componentType: 5126, count, type: 'VEC3' },
    )
    const [r, g, b] = hexToRgb01(part.color)
    materials.push({ name: part.name, pbrMetallicRoughness: { baseColorFactor: [r, g, b, 1], metallicFactor: 0, roughnessFactor: 0.9 } })
    meshes.push({ name: part.name, primitives: [{ attributes: { POSITION: index * 2, NORMAL: index * 2 + 1 }, material: index }] })
    nodes.push({ name: part.name, mesh: index })
  })
  const bin = concat(chunks)
  const gltf = {
    asset: { version: '2.0', generator: 'designon' },
    scene: 0,
    scenes: [{ name, nodes: nodes.map((_, i) => i) }],
    nodes, meshes, materials, accessors, bufferViews,
    buffers: [{ byteLength: bin.length }],
  }
  const pad = (bytes: Uint8Array, fill: number) => {
    const length = Math.ceil(bytes.length / 4) * 4
    const out = new Uint8Array(length).fill(fill)
    out.set(bytes)
    return out
  }
  const json = pad(encoder.encode(JSON.stringify(gltf)), 0x20)
  const binPadded = pad(bin, 0)
  const header = new Uint8Array(12)
  const hv = new DataView(header.buffer)
  hv.setUint32(0, 0x46546c67, true); hv.setUint32(4, 2, true)
  hv.setUint32(8, 12 + 8 + json.length + 8 + binPadded.length, true)
  const chunkHead = (length: number, type: number) => {
    const c = new Uint8Array(8)
    const cv = new DataView(c.buffer)
    cv.setUint32(0, length, true); cv.setUint32(4, type, true)
    return c
  }
  return concat([header, chunkHead(json.length, 0x4e4f534a), json, chunkHead(binPadded.length, 0x004e4942), binPadded])
}
