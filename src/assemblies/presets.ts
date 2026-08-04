import type { Assembly } from './types'

/**
 * Assembly presets. Each is a real composition with layers in order outside → in.
 * The Inspector will show these first; users can then edit layers.
 *
 * R-value targets (imperial total):
 *   - tropical-humid walls: R-8 to R-12 (mass + light insulation)
 *   - hot-arid walls: R-10 to R-14 (high mass, moderate insulation)
 *   - cold-temperate walls: R-30+ (heavy insulation)
 *   - high-altitude walls: R-18+ (sun + cool nights)
 */
export const ASSEMBLY_PRESETS: Record<string, Assembly> = {
  // ----- Walls -----
  'wall-tropical-block': {
    id: 'wall-tropical-block',
    label: 'Tropical — AAC block + light insulation',
    kind: 'wall',
    principle: 'Lighter than cast concrete, better drying after rain, decent R for tropical climates.',
    layers: [
      { materialId: 'cement-plaster', thicknessMm: 15 },
      { materialId: 'aac-block', thicknessMm: 200 },
      { materialId: 'air-cavity', thicknessMm: 25 },
      { materialId: 'fiberglass-batt', thicknessMm: 50 },
      { materialId: 'cement-plaster', thicknessMm: 15 },
    ],
  },
  'wall-mass-tropical': {
    id: 'wall-mass-tropical',
    label: 'Tropical mass — laterite + insulation cavity',
    kind: 'wall',
    principle: 'High mass to flatten the diurnal swing, cavity insulation for daily-cycle resistance.',
    layers: [
      { materialId: 'cement-plaster', thicknessMm: 15 },
      { materialId: 'laterite', thicknessMm: 200 },
      { materialId: 'air-cavity', thicknessMm: 50 },
      { materialId: 'mineral-wool', thicknessMm: 50 },
      { materialId: 'gypsum', thicknessMm: 12 },
    ],
  },
  'wall-timber-frame': {
    id: 'wall-timber-frame',
    label: 'Timber frame — softwood + cellulose',
    kind: 'wall',
    principle: 'Light, low-carbon, fast to build. Suits mixed climates with good eave depth.',
    layers: [
      { materialId: 'cement-plaster', thicknessMm: 15 },
      { materialId: 'plywood', thicknessMm: 12 },
      { materialId: 'cellulose', thicknessMm: 140 },
      { materialId: 'timber-softwood', thicknessMm: 25 },
      { materialId: 'gypsum', thicknessMm: 12 },
    ],
  },
  'wall-cold-cavity': {
    id: 'wall-cold-cavity',
    label: 'Cold climate — timber + deep cavity',
    kind: 'wall',
    principle: 'R-30+ walls, vapour-permeable outside, vapour-tight inside. Standard cold-temperate assembly.',
    layers: [
      { materialId: 'gypsum', thicknessMm: 12 },
      { materialId: 'poly', thicknessMm: 0 }, // vapour barrier — represented as zero-thickness
      { materialId: 'plywood', thicknessMm: 12 },
      { materialId: 'mineral-wool', thicknessMm: 200 },
      { materialId: 'plywood', thicknessMm: 12 },
      { materialId: 'cement-plaster', thicknessMm: 15 },
    ],
  },
  'wall-rammed-earth': {
    id: 'wall-rammed-earth',
    label: 'Rammed earth (thick mass)',
    kind: 'wall',
    principle: 'Hot-arid signature. Very low embodied carbon. Massive diurnal flywheel.',
    layers: [
      { materialId: 'cement-plaster', thicknessMm: 15 },
      { materialId: 'rammed-earth', thicknessMm: 450 },
      { materialId: 'lime-plaster', thicknessMm: 15 },
    ],
  },
  'wall-brick-cavity': {
    id: 'wall-brick-cavity',
    label: 'Brick cavity — tropical',
    kind: 'wall',
    principle: 'Two brick wythes with an air gap. Common SE Asia residential pattern.',
    layers: [
      { materialId: 'brick', thicknessMm: 105 },
      { materialId: 'air-cavity', thicknessMm: 50 },
      { materialId: 'brick', thicknessMm: 105 },
      { materialId: 'cement-plaster', thicknessMm: 15 },
    ],
  },

  // ----- Roofs -----
  'roof-tile-on-air': {
    id: 'roof-tile-on-air',
    label: 'Clay tile on air (tropical mass roof)',
    kind: 'roof',
    principle: 'Heavy tile stays cool overnight, ventilates heat out by day. Low-tech, durable.',
    layers: [
      { materialId: 'clay-tile-roof', thicknessMm: 20 },
      { materialId: 'air-cavity', thicknessMm: 100 },
      { materialId: 'cement-plaster', thicknessMm: 15 },
    ],
  },
  'roof-insulated-cold': {
    id: 'roof-insulated-cold',
    label: 'Insulated cold roof',
    kind: 'roof',
    principle: 'Continuous insulation above the deck. Avoids thermal bridging at rafters.',
    layers: [
      { materialId: 'metal-roof', thicknessMm: 1 },
      { materialId: 'air-cavity', thicknessMm: 50 },
      { materialId: 'pir', thicknessMm: 150 },
      { materialId: 'plywood', thicknessMm: 12 },
      { materialId: 'gypsum', thicknessMm: 12 },
    ],
  },
  'roof-tropical-mass': {
    id: 'roof-tropical-mass',
    label: 'Tropical mass — concrete + insulation',
    kind: 'roof',
    principle: 'Cast concrete damps diurnal swing; insulation on top keeps solar gain out.',
    layers: [
      { materialId: 'cement-plaster', thicknessMm: 15 },
      { materialId: 'concrete-cast', thicknessMm: 120 },
      { materialId: 'xps', thicknessMm: 80 },
      { materialId: 'cement-plaster', thicknessMm: 15 },
    ],
  },
  'roof-lightweight-tropical': {
    id: 'roof-lightweight-tropical',
    label: 'Lightweight tropical — metal + radiant barrier',
    kind: 'roof',
    principle: 'Cheap, fast, low embodied carbon. Reflects the sun. Lighter, less mass — pair with mass walls.',
    layers: [
      { materialId: 'metal-roof', thicknessMm: 1 },
      { materialId: 'air-cavity', thicknessMm: 50 },
      { materialId: 'xps', thicknessMm: 50 },
      { materialId: 'plywood', thicknessMm: 12 },
    ],
  },

  // ----- Floors -----
  'floor-concrete-slab': {
    id: 'floor-concrete-slab',
    label: 'Concrete slab on grade',
    kind: 'floor',
    principle: 'Direct contact with ground — useful thermal mass in hot climates, a heat loss in cold.',
    layers: [
      { materialId: 'cement-plaster', thicknessMm: 15 },
      { materialId: 'concrete-cast', thicknessMm: 100 },
      { materialId: 'xps', thicknessMm: 50 },
    ],
  },
  'floor-timber-raised': {
    id: 'floor-timber-raised',
    label: 'Timber raised floor',
    kind: 'floor',
    principle: 'Ventilated crawlspace. Lets the ground moisture out, holds insulation in.',
    layers: [
      { materialId: 'timber-softwood', thicknessMm: 25 },
      { materialId: 'air-cavity', thicknessMm: 200 },
      { materialId: 'mineral-wool', thicknessMm: 100 },
      { materialId: 'plywood', thicknessMm: 18 },
    ],
  },
  'floor-mass-insulated': {
    id: 'floor-mass-insulated',
    label: 'Mass-insulated slab (cold climate)',
    kind: 'floor',
    principle: 'R-20 under the slab. Edge insulation mandatory to prevent perimeter freeze.',
    layers: [
      { materialId: 'cement-plaster', thicknessMm: 15 },
      { materialId: 'concrete-cast', thicknessMm: 100 },
      { materialId: 'xps', thicknessMm: 100 },
    ],
  },
}

export function getAssemblyPreset(id: string): Assembly {
  const a = ASSEMBLY_PRESETS[id]
  if (!a) throw new Error(`Unknown assembly preset: ${id}`)
  return a
}
