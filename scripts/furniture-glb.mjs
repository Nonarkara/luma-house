/**
 * Measure a furniture GLB and normalise it in place.
 *
 * Reading geometry here is deliberately not done with three.js. The catalogue is
 * Draco-compressed, and decoding it in node means shimming `Worker`,
 * `ProgressEvent`, `self.URL` and a loopback decoder server — four browser
 * globals that each fail silently and unhelpfully. Instead:
 *
 *   1. `gltf-transform` decodes Draco and reserialises a plain GLB. It already
 *      does this correctly, on every platform, with no shims.
 *   2. This script reads the POSITION accessors directly. No workers, no fetch,
 *      no globals.
 *   3. The normalisation matrix is written back with a surgical JSON edit, so
 *      textures and the original compressed payloads survive byte-identical.
 *
 * The contract this exists to protect: the manifest numbers are generated from
 * the geometry, so the rectangle the 2D plan draws, the volume the axonometric
 * sheet extrudes, the dimension the A4 study sheet prints at physical scale and
 * the mesh the 3D view loads are one measurement, not four.
 *
 * Usage:
 *   node scripts/furniture-glb.mjs <in.glb> --out public/furniture/models/x.glb \
 *     --id x --shape seat --label "X" --credit "..." --license CC0-1.0 --source "..."
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { dirname, basename } from 'node:path'
import { execFileSync } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const GLB_MAGIC = 0x46546c67
const CHUNK_JSON = 0x4e4f534a
const CHUNK_BIN = 0x004e4942

/* ------------------------------------------------------------------ *
 * GLB container
 * ------------------------------------------------------------------ */

/** Split a GLB into its JSON and BIN chunks without decoding geometry. */
export function readGlbChunks(buffer) {
  if (buffer.readUInt32LE(0) !== GLB_MAGIC) throw new Error('not a GLB: bad magic')
  const total = buffer.readUInt32LE(8)
  let offset = 12
  let json = null
  let bin = null
  while (offset < total) {
    const length = buffer.readUInt32LE(offset)
    const type = buffer.readUInt32LE(offset + 4)
    const body = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === CHUNK_JSON) json = JSON.parse(body.toString('utf8'))
    else if (type === CHUNK_BIN) bin = body
    offset += 8 + length + ((4 - (length % 4)) % 4)
  }
  if (!json) throw new Error('GLB has no JSON chunk')
  return { json, bin }
}

/**
 * Rebuild a GLB from its chunks.
 *
 * A glTF JSON chunk is measured in **bytes**, but `String.length` counts UTF-16
 * code units. Any multi-byte character — a `©` in a copyright field, an author
 * name in CJK, an em dash — makes the byte length larger than the string length,
 * which truncates the JSON and produces a file no other tool can read. This is
 * not hypothetical: SheenWoodLeatherSofa carries a `©` and was silently
 * corrupted by the string-length version of this function. The pad is computed
 * from the encoded byte length, never the string length.
 */
export function writeGlbChunks(json, bin) {
  const jsonBytes = Buffer.from(JSON.stringify(json), 'utf8')
  const jsonPad = (4 - (jsonBytes.length % 4)) % 4
  const jsonSpace = Buffer.alloc(jsonBytes.length + jsonPad, 0x20)
  jsonBytes.copy(jsonSpace)
  const binPad = bin ? (4 - (bin.length % 4)) % 4 : 0
  const binSpace = bin ? Buffer.alloc(bin.length + binPad) : Buffer.alloc(0)
  if (bin) bin.copy(binSpace)

  const total = 12 + 8 + jsonSpace.length + (bin ? 8 + binSpace.length : 0)
  const out = Buffer.alloc(total)
  out.writeUInt32LE(GLB_MAGIC, 0)
  out.writeUInt32LE(2, 4)
  out.writeUInt32LE(total, 8)
  out.writeUInt32LE(jsonSpace.length, 12)
  out.writeUInt32LE(CHUNK_JSON, 16)
  jsonSpace.copy(out, 20)
  if (bin) {
    const cursor = 20 + jsonSpace.length
    out.writeUInt32LE(binSpace.length, cursor)
    out.writeUInt32LE(CHUNK_BIN, cursor + 4)
    binSpace.copy(out, cursor + 8)
  }
  return out
}

/* ------------------------------------------------------------------ *
 * Accessor reading
 * ------------------------------------------------------------------ */

const COMPONENT_BYTES = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 }
const TYPE_COUNTS = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16, MAT3: 9 }

/** Read accessor `index` as a flat Float64Array plus its component count. */
export function readAccessor(json, bin, index) {
  const accessor = json.accessors[index]
  if (!accessor) throw new Error(`no accessor ${index}`)
  const components = TYPE_COUNTS[accessor.type]
  const bytes = COMPONENT_BYTES[accessor.componentType]
  if (!bytes || !components) throw new Error(`unsupported accessor type ${accessor.type}`)
  const view = json.bufferViews[accessor.bufferView]
  if (!view) throw new Error(`accessor ${index} references a missing bufferView`)
  // In glTF the element stride is declared on the *bufferView*, not on the
  // accessor. Reading `accessor.byteStride` yields undefined, the fallback packs
  // vertices at 12 bytes, and every vertex of an interleaved buffer lands in the
  // middle of its neighbours — which silently produces plausible-looking but
  // completely wrong geometry.
  const stride = view.byteStride ?? components * bytes
  const base = (view.byteOffset ?? 0) + (accessor.byteOffset ?? 0)
  const dataView = new DataView(bin.buffer, bin.byteOffset, bin.byteLength)
  const read = {
    5120: (at) => dataView.getInt8(at),
    5121: (at) => dataView.getUint8(at),
    5122: (at) => dataView.getInt16(at, true),
    5123: (at) => dataView.getUint16(at, true),
    5125: (at) => dataView.getUint32(at, true),
    5126: (at) => dataView.getFloat32(at, true),
  }[accessor.componentType]
  const out = new Float64Array(accessor.count * components)
  for (let element = 0; element < accessor.count; element += 1) {
    for (let component = 0; component < components; component += 1) {
      out[element * components + component] = read(base + element * stride + component * bytes)
    }
  }
  return { values: out, components, count: accessor.count }
}

const IDENTITY = new Float64Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1])

/** Column-major 4x4 multiply: a · b. */
function multiply(a, b) {
  const out = new Float64Array(16)
  for (let col = 0; col < 4; col += 1) {
    for (let row = 0; row < 4; row += 1) {
      let sum = 0
      for (let k = 0; k < 4; k += 1) sum += a[k * 4 + row] * b[col * 4 + k]
      out[col * 4 + row] = sum
    }
  }
  return out
}

/**
 * Local matrix of a node.
 *
 * glTF allows either `matrix` **or** the TRS triple — never both. Reading only
 * `matrix` silently drops every translation in a file that uses the TRS form,
 * which is what `gltf-transform` writes; the mesh then appears collapsed onto the
 * origin and every measured dimension comes out wrong. Both forms are honoured
 * here, `matrix` first because the spec forbids combining them.
 */
function nodeMatrix(node) {
  if (node.matrix) return Float64Array.from(node.matrix)
  const [x, y, z, w] = node.rotation ?? [0, 0, 0, 1]
  const [sx, sy, sz] = node.scale ?? [1, 1, 1]
  const [tx, ty, tz] = node.translation ?? [0, 0, 0]
  // Quaternion to rotation matrix, then scale, then translate. Column-major.
  const x2 = x + x, y2 = y + y, z2 = z + z
  const xx = x * x2, xy = x * y2, xz = x * z2
  const yy = y * y2, yz = y * z2, zz = z * z2
  const wx = w * x2, wy = w * y2, wz = w * z2
  return new Float64Array([
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ])
}

/**
 * World-space bounds over every mesh, honouring nested node transforms.
 *
 * This is the function the test suite re-runs against the shipped files to prove
 * the drawing still agrees with the render.
 */
export function worldBounds(json, bin) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const visit = (index, parent) => {
    const node = json.nodes?.[index]
    if (!node) return
    const world = multiply(parent, nodeMatrix(node))
    if (node.mesh !== undefined) {
      for (const primitive of json.meshes[node.mesh].primitives ?? []) {
        const position = primitive.attributes?.POSITION
        if (position === undefined) continue
        const { values, components, count } = readAccessor(json, bin, position)
        for (let element = 0; element < count; element += 1) {
          const x = values[element * components]
          const y = values[element * components + 1]
          const z = values[element * components + 2]
          const wx = world[0] * x + world[4] * y + world[8] * z + world[12]
          const wy = world[1] * x + world[5] * y + world[9] * z + world[13]
          const wz = world[2] * x + world[6] * y + world[10] * z + world[14]
          if (wx < min[0]) min[0] = wx
          if (wy < min[1]) min[1] = wy
          if (wz < min[2]) min[2] = wz
          if (wx > max[0]) max[0] = wx
          if (wy > max[1]) max[1] = wy
          if (wz > max[2]) max[2] = wz
        }
      }
    }
    for (const child of node.children ?? []) visit(child, world)
  }
  for (const index of json.scenes?.[0]?.nodes ?? []) visit(index, IDENTITY)
  if (min[0] === Infinity) throw new Error('no POSITION accessors found in this asset')
  return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] }
}

/**
 * Bounds for an optimized GLB without decoding compressed vertex buffers.
 *
 * glTF requires POSITION accessors to carry min/max values. Transforming the
 * eight corners of those local boxes through the node hierarchy gives the
 * shipped world envelope for these static catalogue meshes. This makes the
 * release test deterministic and offline: it verifies the optimized files,
 * not a pre-compression intermediate, without downloading a decoder in CI.
 */
export function worldBoundsFromAccessorBounds(json) {
  const min = [Infinity, Infinity, Infinity]
  const max = [-Infinity, -Infinity, -Infinity]
  const expand = (x, y, z, world) => {
    const point = [
      world[0] * x + world[4] * y + world[8] * z + world[12],
      world[1] * x + world[5] * y + world[9] * z + world[13],
      world[2] * x + world[6] * y + world[10] * z + world[14],
    ]
    for (let axis = 0; axis < 3; axis += 1) {
      if (point[axis] < min[axis]) min[axis] = point[axis]
      if (point[axis] > max[axis]) max[axis] = point[axis]
    }
  }
  const visit = (index, parent) => {
    const node = json.nodes?.[index]
    if (!node) return
    const world = multiply(parent, nodeMatrix(node))
    if (node.mesh !== undefined) {
      for (const primitive of json.meshes?.[node.mesh]?.primitives ?? []) {
        const position = primitive.attributes?.POSITION
        if (position === undefined) continue
        const accessor = json.accessors?.[position]
        if (!accessor?.min || !accessor?.max) {
          throw new Error(`POSITION accessor ${position} has no min/max bounds`)
        }
        const normalise = (value) => {
          if (!accessor.normalized) return value
          if (accessor.componentType === 5120) return Math.max(value / 127, -1)
          if (accessor.componentType === 5121) return value / 255
          if (accessor.componentType === 5122) return Math.max(value / 32767, -1)
          if (accessor.componentType === 5123) return value / 65535
          return value
        }
        const localMin = accessor.min.map(normalise)
        const localMax = accessor.max.map(normalise)
        for (const x of [localMin[0], localMax[0]]) {
          for (const y of [localMin[1], localMax[1]]) {
            for (const z of [localMin[2], localMax[2]]) expand(x, y, z, world)
          }
        }
      }
    }
    for (const child of node.children ?? []) visit(child, world)
  }
  const activeScene = json.scenes?.[json.scene ?? 0]
  for (const index of activeScene?.nodes ?? []) visit(index, IDENTITY)
  if (min[0] === Infinity) throw new Error('no bounded POSITION accessors found in this asset')
  return { min, max, size: [max[0] - min[0], max[1] - min[1], max[2] - min[2]] }
}

/* ------------------------------------------------------------------ *
 * Normalisation
 * ------------------------------------------------------------------ */

/**
 * Column-major T · S matrix that fits an asset onto a drawn footprint, centres
 * the footprint on the origin and seats the base on y=0.
 */
export function normaliseMatrix(bounds, widthM, depthM) {
  const [sizeX, , sizeZ] = bounds.size
  const scale = Math.min(widthM / sizeX, depthM / sizeZ)
  const centreX = (bounds.max[0] + bounds.min[0]) / 2
  const centreZ = (bounds.max[2] + bounds.min[2]) / 2
  return {
    scale,
    matrix: [
      scale, 0, 0, 0,
      0, scale, 0, 0,
      0, 0, scale, 0,
      -centreX * scale, -bounds.min[1] * scale, -centreZ * scale, 1,
    ],
  }
}

/**
 * Wrap every scene root in one node carrying the normalisation matrix. The node
 * is named so re-running composes a relative adjustment without nesting or
 * renumbering any node.
 */
export function applyNormalisation(json, matrix) {
  json.nodes ??= []
  const scene = json.scenes[json.scene ?? 0]
  if (!scene) throw new Error('No active scene to normalise')
  const root = scene.nodes?.length === 1 ? json.nodes[scene.nodes[0]] : null
  if (root?.name === 'designonNormalise') {
    // New bounds already include this wrapper: compose the relative adjustment.
    root.matrix = Array.from(multiply(matrix, nodeMatrix(root)))
    return scene.nodes[0]
  }
  // Keep node indices stable: scenes, skins and animations may reference them.
  const index = json.nodes.length
  json.nodes.push({ name: 'designonNormalise', matrix, children: [...(scene.nodes ?? [])] })
  scene.nodes = [index]
  return index
}

/* ------------------------------------------------------------------ *
 * Draco decoding
 * ------------------------------------------------------------------ */

/**
 * Decode a Draco-compressed GLB into plain geometry, so `worldBounds` can read
 * it. Delegated to gltf-transform, which already handles Draco on every
 * platform without browser shims.
 */
export function decodeDraco(inputPath) {
  const scratch = mkdtempSync(join(tmpdir(), 'furniture-decode-'))
  const out = join(scratch, 'decoded.glb')
  try {
    execFileSync(
      'npx',
      ['--yes', '@gltf-transform/cli@4.1.0', 'copy', inputPath, out],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    )
    return readGlbChunks(readFileSync(out))
  } finally {
    execFileSync('rm', ['-rf', scratch], { stdio: 'ignore' })
  }
}

/**
 * Load a GLB's geometry for measurement, transparently decoding Draco when the
 * asset is compressed.
 */
export function loadGeometry(inputPath) {
  const { json, bin } = readGlbChunks(readFileSync(inputPath))
  const compressed = (json.extensionsRequired ?? []).some((name) =>
    name === 'KHR_draco_mesh_compression',
  )
  if (!compressed) return { json, bin, compressed }
  const decoded = decodeDraco(inputPath)
  return { ...decoded, compressed: true }
}

/* ------------------------------------------------------------------ *
 * CLI
 * ------------------------------------------------------------------ */

function parseArgs(argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token.startsWith('--')) args[token.slice(2)] = argv[++i]
    else args._.push(token)
  }
  return args
}

function main() {
  const args = parseArgs(process.argv.slice(2))
  const [input] = args._
  if (!input || !args.out || !args.id) {
    console.error('usage: furniture-glb <in.glb> --out <path> --id <id> --shape <shape> --label <label>')
    process.exit(1)
  }

  const { json, bin } = loadGeometry(input)
  const bounds = worldBounds(json, bin)

  const widthM = args.widthM ? Number(args.widthM) : bounds.size[0]
  const depthM = args.depthM ? Number(args.depthM) : bounds.size[2]
  const { scale, matrix } = normaliseMatrix(bounds, widthM, depthM)

  // Write the transform into the original container, so textures and the
  // shipped Draco payloads are untouched.
  const original = readGlbChunks(readFileSync(input))
  applyNormalisation(original.json, matrix)
  const out = writeGlbChunks(original.json, original.bin)
  mkdirSync(dirname(args.out), { recursive: true })
  writeFileSync(args.out, out)

  const manifest = {
    id: args.id,
    shape: args.shape,
    label: args.label,
    // Rounded to centimetres because the drawing labels centimetres.
    widthM: Math.round(bounds.size[0] * scale * 100) / 100,
    depthM: Math.round(bounds.size[2] * scale * 100) / 100,
    heightM: Math.round(bounds.size[1] * scale * 100) / 100,
    file: basename(args.out),
    credit: args.credit ?? '',
    license: args.license ?? '',
    source: args.source ?? '',
  }
  writeFileSync(`${args.out}.json`, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(
    `${args.id}: ${(bounds.size[0] * 1000).toFixed(0)}×${(bounds.size[2] * 1000).toFixed(0)}×${(bounds.size[1] * 1000).toFixed(0)} mm` +
    ` ×${scale.toFixed(4)}  →  ${manifest.widthM}×${manifest.depthM}×${manifest.heightM} m` +
    `  (${(out.length / 1024).toFixed(0)} KB)`,
  )
  return manifest
}

if (import.meta.url === `file://${process.argv[1]}`) main()
