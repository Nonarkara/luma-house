import type { MaterialSpec } from './types'

/**
 * Material catalog. Every entry is a generic spec — no brand names.
 * R-values are conservative mid-range values for the material class.
 * Embodied-carbon figures are order-of-magnitude from ICE / Athena 2018
 * and Bath university datasets, not EPDs.
 */
export const MATERIALS: Record<string, MaterialSpec> = {
  // ----- Concrete & masonry -----
  'concrete-cast': {
    id: 'concrete-cast',
    label: 'Cast concrete (dense)',
    family: 'concrete',
    rValuePerInch: 0.0625, // ~1.4 W/m·K — high mass, low R per inch
    embodiedCarbonKgPerM2PerCm: 1.2, // ~240 kgCO₂e/m³
    costThbPerM2PerCm: 95,
    caveat: 'Order-of-magnitude; varies with cement replacement and reinforcement.',
  },
  'aac-block': {
    id: 'aac-block',
    label: 'AAC block (autoclaved aerated)',
    family: 'masonry',
    rValuePerInch: 0.44, // ~7.7 W/m·K
    embodiedCarbonKgPerM2PerCm: 0.55,
    costThbPerM2PerCm: 90,
  },
  brick: {
    id: 'brick',
    label: 'Clay brick (single wythe)',
    family: 'masonry',
    rValuePerInch: 0.20,
    embodiedCarbonKgPerM2PerCm: 0.84,
    costThbPerM2PerCm: 65,
  },
  'rammed-earth': {
    id: 'rammed-earth',
    label: 'Rammed earth',
    family: 'earth',
    rValuePerInch: 0.18, // low R, but high thermal mass
    embodiedCarbonKgPerM2PerCm: 0.05,
    costThbPerM2PerCm: 30,
    caveat: 'Carbon is much lower than kiln-fired masonry; uses local soil.',
  },
  laterite: {
    id: 'laterite',
    label: 'Laterite block',
    family: 'masonry',
    rValuePerInch: 0.13,
    embodiedCarbonKgPerM2PerCm: 0.25,
    costThbPerM2PerCm: 28,
  },
  // ----- Timber -----
  'timber-softwood': {
    id: 'timber-softwood',
    label: 'Softwood timber',
    family: 'timber',
    rValuePerInch: 1.25,
    embodiedCarbonKgPerM2PerCm: 0.12,
    costThbPerM2PerCm: 35,
  },
  plywood: {
    id: 'plywood',
    label: 'Plywood sheathing',
    family: 'timber',
    rValuePerInch: 1.10,
    embodiedCarbonKgPerM2PerCm: 0.18,
    costThbPerM2PerCm: 22,
  },
  // ----- Insulation -----
  'fiberglass-batt': {
    id: 'fiberglass-batt',
    label: 'Fiberglass batt',
    family: 'insulation',
    rValuePerInch: 3.7, // R-3.7/in typical
    embodiedCarbonKgPerM2PerCm: 0.08,
    costThbPerM2PerCm: 12,
  },
  'mineral-wool': {
    id: 'mineral-wool',
    label: 'Mineral wool',
    family: 'insulation',
    rValuePerInch: 4.0,
    embodiedCarbonKgPerM2PerCm: 0.16,
    costThbPerM2PerCm: 22,
  },
  cellulose: {
    id: 'cellulose',
    label: 'Cellulose (recycled paper)',
    family: 'insulation',
    rValuePerInch: 3.5,
    embodiedCarbonKgPerM2PerCm: 0.04,
    costThbPerM2PerCm: 14,
  },
  eps: {
    id: 'eps',
    label: 'EPS (expanded polystyrene)',
    family: 'insulation',
    rValuePerInch: 4.0,
    embodiedCarbonKgPerM2PerCm: 0.30,
    costThbPerM2PerCm: 18,
    caveat: 'Blowing-agent GWP has fallen with newer EPS.',
  },
  xps: {
    id: 'xps',
    label: 'XPS (extruded polystyrene)',
    family: 'insulation',
    rValuePerInch: 5.0,
    embodiedCarbonKgPerM2PerCm: 0.50,
    costThbPerM2PerCm: 28,
  },
  pir: {
    id: 'pir',
    label: 'PIR / PUR foam',
    family: 'insulation',
    rValuePerInch: 6.5,
    embodiedCarbonKgPerM2PerCm: 0.55,
    costThbPerM2PerCm: 38,
  },
  // ----- Finishes -----
  'cement-plaster': {
    id: 'cement-plaster',
    label: 'Cement plaster',
    family: 'finish',
    rValuePerInch: 0.20,
    embodiedCarbonKgPerM2PerCm: 0.45,
    costThbPerM2PerCm: 22,
  },
  'lime-plaster': {
    id: 'lime-plaster',
    label: 'Lime plaster',
    family: 'finish',
    rValuePerInch: 0.30,
    embodiedCarbonKgPerM2PerCm: 0.18,
    costThbPerM2PerCm: 28,
  },
  gypsum: {
    id: 'gypsum',
    label: 'Gypsum board',
    family: 'finish',
    rValuePerInch: 0.45,
    embodiedCarbonKgPerM2PerCm: 0.16,
    costThbPerM2PerCm: 18,
  },
  'clay-tile-roof': {
    id: 'clay-tile-roof',
    label: 'Clay roof tile',
    family: 'finish',
    rValuePerInch: 0.25,
    embodiedCarbonKgPerM2PerCm: 0.50,
    costThbPerM2PerCm: 55,
  },
  'metal-roof': {
    id: 'metal-roof',
    label: 'Metal roofing (painted)',
    family: 'metal',
    rValuePerInch: 0.0, // negligible
    embodiedCarbonKgPerM2PerCm: 0.95,
    costThbPerM2PerCm: 40,
  },
  // ----- Glazing (per mm — note different unit, see caveat) -----
  'glass-single': {
    id: 'glass-single',
    label: 'Single glazing (3 mm)',
    family: 'glazing',
    rValuePerInch: 0.88, // U ≈ 5.7 W/m²·K
    embodiedCarbonKgPerM2PerCm: 0.0, // not used in this spec
    costThbPerM2PerCm: 0,
    caveat: 'Used directly, not as a layer in assemblies — the openings UI owns this.',
  },
  'glass-double-lowE': {
    id: 'glass-double-lowE',
    label: 'Double low-E (6/12/6)',
    family: 'glazing',
    rValuePerInch: 2.5, // U ≈ 1.4 W/m²·K
    embodiedCarbonKgPerM2PerCm: 0.0,
    costThbPerM2PerCm: 0,
    caveat: 'Used directly, not as a layer in assemblies.',
  },
  // ----- Passive layers -----
  'air-cavity': {
    id: 'air-cavity',
    label: 'Air cavity (unvented)',
    family: 'air',
    rValuePerInch: 0.91, // ≈ R-1/in for a still air film
    embodiedCarbonKgPerM2PerCm: 0.0,
    costThbPerM2PerCm: 0,
  },
  poly: {
    id: 'poly',
    label: 'Poly vapour barrier',
    family: 'finish',
    rValuePerInch: 0,
    embodiedCarbonKgPerM2PerCm: 0,
    costThbPerM2PerCm: 0,
    caveat: 'Zero-thickness in this spec — communicates design intent, not bulk.',
  },
}

export function getMaterial(id: string): MaterialSpec {
  const m = MATERIALS[id]
  if (!m) throw new Error(`Unknown material: ${id}`)
  return m
}
