/**
 * Rebuild the furniture catalogue end to end.
 *
 *   1. normalise each source GLB: measure the real footprint, seat the base on
 *      y=0, centre it, and write the transform back surgically
 *   2. compress with Meshopt geometry + WebP textures
 *   3. emit the catalogue manifest with byte-exact sizes
 *
 * Run with `node scripts/build-furniture-catalog.mjs`. It needs the source
 * assets present in `scripts/furniture-src/`; the compressed output and the
 * manifest land in `public/furniture/`.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { dirname, join, basename, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SRC_DIR = join(HERE, 'furniture-src')
const WORK_DIR = join(HERE, '.furniture-work')
const OUT_DIR = join(ROOT, 'public/furniture/models')
const MANIFEST = join(ROOT, 'src/catalog/furnitureCatalog.generated.ts')

/**
 * Footprint bands, in metres, per shape class.
 *
 * A real mesh is only drawn where it plausibly *is* the object being drawn. A
 * 0.83 m chair scaled onto a 2.2 m sofa footprint is not a sofa, it is a chair
 * you could sit on from across the room — and it would pass every type check,
 * every lint rule and the full test suite while looking absurd on screen. So a
 * piece outside its mesh's band draws its measured box instead, which is honest
 * and is exactly what the plan already showed.
 */
const BANDS = {
  seat: { serves: ['chair'], w: [0.55, 1.15], d: [0.5, 1.15] },
  sofa: { serves: ['sofa'], w: [1.5, 3.2], d: [0.7, 1.3] },
  decor: { serves: ['decor'], w: [0.1, 0.65], d: [0.1, 0.65] },
}

/**
 * The catalogue. Every entry records the licence and credit required by the
 * asset's own terms; see `docs/FURNITURE-CATALOGUE.md`.
 */
const CATALOGUE = [
  {
    id: 'sheen-chair',
    shape: 'seat',
    label: 'Sheen chair',
    source: 'SheenChair.glb',
    credit: 'Wayfair, LLC, 2020',
    license: 'CC0-1.0',
    url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenChair',
  },
  {
    id: 'damask-chair',
    shape: 'seat',
    label: 'Damask chair',
    source: 'ChairDamaskPurplegold.glb',
    credit: 'Wayfair, 2021',
    license: 'CC-BY-4.0',
    url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/ChairDamaskPurplegold',
  },
  {
    id: 'glam-velvet-sofa',
    shape: 'sofa',
    label: 'Velvet sofa',
    source: 'GlamVelvetSofa.glb',
    credit: 'Wayfair, LLC, 2021',
    license: 'CC-BY-4.0',
    url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlamVelvetSofa',
  },
  {
    id: 'wood-leather-sofa',
    shape: 'sofa',
    label: 'Wood and leather sofa',
    source: 'SheenWoodLeatherSofa.glb',
    credit: 'Darmstadt Graphics Group GmbH, 2024',
    license: 'CC-BY-4.0',
    url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/SheenWoodLeatherSofa',
  },
  {
    id: 'glass-vase',
    shape: 'decor',
    label: 'Glass vase with flowers',
    source: 'GlassVaseFlowers.glb',
    credit: 'Public, 2023',
    license: 'CC0-1.0',
    url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/GlassVaseFlowers',
  },
  {
    id: 'lantern',
    shape: 'decor',
    label: 'Wooden lantern',
    source: 'Lantern.glb',
    credit: 'Microsoft, 2017; Frank Galligan, 2018',
    license: 'CC0-1.0',
    url: 'https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/Lantern',
    // The lantern mesh is authored as a 15 m street light. This is the maximum
    // domestic footprint envelope; uniform scaling preserves its aspect ratio,
    // and the generated manifest records the resulting measured footprint.
    widthM: 0.36,
    depthM: 0.36,
  },
]

const TEXTURE_SIZE = 1024

function sh(args, cwd = ROOT) {
  return execFileSync(args[0], args.slice(1), { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
}

async function main() {
  if (!existsSync(SRC_DIR)) {
    console.error(`Missing ${SRC_DIR}. See docs/FURNITURE-CATALOGUE.md for the download list.`)
    process.exit(1)
  }
  const available = new Set(readdirSync(SRC_DIR))
  mkdirSync(WORK_DIR, { recursive: true })
  mkdirSync(OUT_DIR, { recursive: true })

  const { loadGeometry, worldBounds } = await import('./furniture-glb.mjs')
  const entries = []

  for (const item of CATALOGUE) {
    if (!available.has(item.source)) {
      console.warn(`skip ${item.id}: ${item.source} not in furniture-src`)
      continue
    }
    const input = join(SRC_DIR, item.source)
    const normalised = join(WORK_DIR, `${item.id}.glb`)

    // Measure the source before anything touches it, so the manifest dimensions
    // are a fact about the geometry rather than a number we typed.
    const { json, bin } = loadGeometry(input)
    const bounds = worldBounds(json, bin)

    if (item.widthM !== undefined || item.depthM !== undefined) {
      // Only the lantern is redrawn onto a domestic footprint. Flag it so a
      // silent mismatch here can never be mistaken for a measurement.
      console.log(
        `  ${item.id} authored at ${bounds.size[0].toFixed(2)}×${bounds.size[2].toFixed(2)} m` +
        `, redrawn onto ${item.widthM}×${item.depthM} m`,
      )
    }

    sh([
      'node',
      join(HERE, 'furniture-glb.mjs'),
      input,
      '--out',
      normalised,
      '--id',
      item.id,
      '--shape',
      item.shape,
      '--label',
      item.label,
      '--credit',
      item.credit,
      '--license',
      item.license,
      '--source',
      item.url,
      ...(item.widthM ? ['--widthM', String(item.widthM)] : []),
      ...(item.depthM ? ['--depthM', String(item.depthM)] : []),
    ])

    // Meshopt + WebP stays compact without requiring a network-fetched decoder;
    // drei ships the Meshopt decoder inside the lazy 3D chunk.
    sh([
      'npx',
      '--yes',
      '@gltf-transform/cli@4.1.0',
      'optimize',
      normalised,
      join(WORK_DIR, `${item.id}.min.glb`),
      '--compress',
      'meshopt',
      '--texture-compress',
      'webp',
      '--texture-size',
      String(TEXTURE_SIZE),
    ])

    const file = `${item.id}.glb`
    const outPath = join(OUT_DIR, file)
    writeFileSync(outPath, readFileSync(join(WORK_DIR, `${item.id}.min.glb`)))

    const measured = JSON.parse(readFileSync(`${normalised}.json`, 'utf8'))
    const band = BANDS[item.shape]
    if (!band) throw new Error(`${item.id}: unknown shape class "${item.shape}"`)
    // The mesh must actually fit the band it claims, or the band is a lie.
    if (measured.widthM > band.w[1] || measured.depthM > band.d[1]) {
      throw new Error(
        `${item.id} measures ${measured.widthM}×${measured.depthM} m, which overruns` +
        ` the ${item.shape} band ${band.w[1]}×${band.d[1]} m`,
      )
    }
    entries.push({
      id: item.id,
      shape: item.shape,
      serves: band.serves,
      bandM: band,
      label: item.label,
      widthM: measured.widthM,
      depthM: measured.depthM,
      heightM: measured.heightM,
      file: `furniture/models/${file}`,
      bytes: statSync(outPath).size,
      credit: item.credit,
      license: item.license,
      source: item.url,
    })
    console.log(
      `  ${item.id.padEnd(20)} ${String(measured.widthM).padStart(5)}×${String(measured.depthM).padStart(5)}×${String(measured.heightM).padStart(5)} m  ${(statSync(outPath).size / 1024).toFixed(0).padStart(5)} KB`,
    )
  }

  writeFileSync(MANIFEST, renderManifest(entries))
  const total = entries.reduce((sum, entry) => sum + entry.bytes, 0)
  console.log(`\n${entries.length} assets, ${(total / 1024 / 1024).toFixed(2)} MB total (lazy-loaded, never in first paint)`)
  console.log(`manifest → ${basename(MANIFEST)}`)
}

function renderManifest(entries) {
  const body = entries
    .map(
      (entry) => `  {
    id: ${JSON.stringify(entry.id)},
    shape: ${JSON.stringify(entry.shape)},
    serves: [${entry.serves.map((k) => `'${k}'`).join(', ')}],
    bandM: {
      w: [${entry.bandM.w.join(', ')}],
      d: [${entry.bandM.d.join(', ')}],
    },
    label: ${JSON.stringify(entry.label)},
    widthM: ${entry.widthM},
    depthM: ${entry.depthM},
    heightM: ${entry.heightM},
    file: ${JSON.stringify(entry.file)},
    bytes: ${entry.bytes},
    credit: ${JSON.stringify(entry.credit)},
    license: ${JSON.stringify(entry.license)},
    source: ${JSON.stringify(entry.source)},
  },`,
    )
    .join('\n')
  return `/**
 * GENERATED by scripts/build-furniture-catalog.mjs — do not edit by hand.
 *
 * Regenerate with:
 *   node scripts/build-furniture-catalog.mjs
 *
 * These numbers are measured from the shipped geometry, not typed in. The 2D
 * plan draws them, the axonometric sheet extrudes them, the A4 study sheet
 * prints them at physical scale, and the 3D view fits the mesh onto them.
 * \`furnitureAssets.test.ts\` re-measures every GLB to prove the four layers
 * still agree.
 *
 * \`serves\` and \`bandM\` are what keep the render honest: a mesh only draws where
 * it is still plausibly the object being drawn. Outside its band a piece draws
 * its measured box instead, which is true by construction.
 */

import type { FurnitureAsset } from './furnitureAssets'

export const GENERATED_FURNITURE_ASSETS: readonly FurnitureAsset[] = [
${body}
]
`
}

if (import.meta.url === `file://${process.argv[1]}`) await main()
