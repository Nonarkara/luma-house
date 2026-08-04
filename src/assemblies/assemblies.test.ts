import { describe, expect, it } from 'vitest'
import {
  applyClimateResponse,
  CLIMATE_RESPONSES,
  DEFAULT_ASSEMBLIES,
  listResolvedAssemblies,
  resolveAssembly,
  resolvePlanAssemblies,
  suggestClimateResponse,
} from './resolve'
import { ASSEMBLY_PRESETS, getAssemblyPreset } from './presets'
import { getEnvelopeFromAssemblies } from './envelope'
import { MATERIALS } from './materials'
import { initialPlan } from '../plan'
import type { PlanState } from '../types'

const BANGKOK = 13.7563
const ANCHORAGE = 61.2181
const QUITO = -0.1807

describe('resolveAssembly', () => {
  it('sums R-value across layers using per-inch values', () => {
    const a = resolveAssembly(getAssemblyPreset('wall-cold-cavity'))
    // Layers: gypsum 12mm (R 0.45/in × 0.47 in = 0.21) + plywood 12mm ×2 (R 1.10 × 0.94) +
    // mineral-wool 200mm (R 4.0 × 7.87) + cement-plaster 15mm (R 0.20 × 0.59)
    // ≈ 0.21 + 2.07 + 31.5 + 0.12 = 33.9
    expect(a.totalRValue).toBeGreaterThan(28)
    expect(a.totalRValue).toBeLessThan(40)
    expect(a.uValue).toBeCloseTo(1 / (a.totalRValue * 0.176), 5)
  })

  it('sums embodied carbon and cost across layers', () => {
    const a = resolveAssembly(getAssemblyPreset('wall-rammed-earth'))
    // 15mm cement-plaster (0.45 × 1.5) + 450mm rammed-earth (0.05 × 45) + 15mm lime-plaster (0.18 × 1.5)
    // = 0.675 + 2.25 + 0.27 ≈ 3.2 kgCO2e/m²
    expect(a.embodiedCarbonKgPerM2).toBeGreaterThan(2.5)
    expect(a.embodiedCarbonKgPerM2).toBeLessThan(4.0)
  })

  it('treats zero-thickness layers as no-op', () => {
    // wall-cold-cavity has a 0mm "poly" vapour barrier
    const a = resolveAssembly(getAssemblyPreset('wall-cold-cavity'))
    const aWithoutZero = resolveAssembly({
      ...getAssemblyPreset('wall-cold-cavity'),
      layers: getAssemblyPreset('wall-cold-cavity').layers.filter((l) => l.thicknessMm > 0),
    })
    expect(a.totalRValue).toBeCloseTo(aWithoutZero.totalRValue, 5)
    expect(a.embodiedCarbonKgPerM2).toBeCloseTo(aWithoutZero.embodiedCarbonKgPerM2, 5)
  })
})

describe('listResolvedAssemblies', () => {
  it('filters by kind', () => {
    const walls = listResolvedAssemblies('wall')
    const roofs = listResolvedAssemblies('roof')
    const floors = listResolvedAssemblies('floor')
    expect(walls.every((a) => a.assembly.kind === 'wall')).toBe(true)
    expect(roofs.every((a) => a.assembly.kind === 'roof')).toBe(true)
    expect(floors.every((a) => a.assembly.kind === 'floor')).toBe(true)
    expect(walls.length).toBeGreaterThan(0)
  })
})

describe('applyClimateResponse', () => {
  it('copies wall / roof / floor / glazing defaults', () => {
    const next = applyClimateResponse(DEFAULT_ASSEMBLIES, 'cold-temperate')
    expect(next.wall).toBe('wall-cold-cavity')
    expect(next.roof).toBe('roof-insulated-cold')
    expect(next.floor).toBe('floor-mass-insulated')
    expect(next.glazingUValue).toBe(1.0)
    expect(next.glazingSHGC).toBe(0.45)
    expect(next.climateResponseId).toBe('cold-temperate')
  })

  it('preserves the climate response id so undo knows what to roll back to', () => {
    const next = applyClimateResponse(DEFAULT_ASSEMBLIES, 'hot-arid')
    expect(next.climateResponseId).toBe('hot-arid')
  })
})

describe('suggestClimateResponse', () => {
  it('suggests tropical-humid for Bangkok', () => {
    expect(suggestClimateResponse(BANGKOK).id).toBe('tropical-humid')
  })
  it('suggests high-altitude for Quito', () => {
    expect(suggestClimateResponse(QUITO).id).toBe('high-altitude')
  })
  it('suggests cold-temperate for Anchorage', () => {
    expect(suggestClimateResponse(ANCHORAGE).id).toBe('cold-temperate')
  })
  it('falls back to temperate-mixed when no predicate matches', () => {
    expect(suggestClimateResponse(999).id).toBe('temperate-mixed')
  })
})

describe('getEnvelopeFromAssemblies', () => {
  it('returns sensible envelope numbers for the default tropical plan', () => {
    const plan: PlanState = { ...initialPlan, assemblies: DEFAULT_ASSEMBLIES }
    const env = getEnvelopeFromAssemblies(plan)
    // Tropical-humid wall-tropical-block layers sum to a respectable R-value
    expect(env.wallRValue).toBeGreaterThan(7)
    expect(env.wallU).toBeGreaterThan(0.25)
    expect(env.wallU).toBeLessThan(0.8)
    expect(env.insulationFactor).toBeGreaterThan(0.3)
    expect(env.insulationFactor).toBeLessThan(0.9)
  })

  it('reads higher R for cold-temperate than tropical-humid', () => {
    const tropical: PlanState = { ...initialPlan, assemblies: DEFAULT_ASSEMBLIES }
    const cold: PlanState = {
      ...initialPlan,
      assemblies: applyClimateResponse(DEFAULT_ASSEMBLIES, 'cold-temperate'),
    }
    const tEnv = getEnvelopeFromAssemblies(tropical)
    const cEnv = getEnvelopeFromAssemblies(cold)
    expect(cEnv.wallRValue).toBeGreaterThan(tEnv.wallRValue * 2)
  })

  it('falls back to the legacy boolean signal when plan has no assemblies field', () => {
    const plan: PlanState = { ...initialPlan }
    delete plan.assemblies
    const env = getEnvelopeFromAssemblies(plan)
    expect(env.wallU).toBeGreaterThan(0)
    // Default plan has systems.insulation = true → insulated legacy defaults
    expect(env.wallU).toBeLessThan(1)
    expect(env.glazingU).toBeGreaterThan(0)
  })

  it('embodied carbon per m² of floor includes wall + roof + floor layers', () => {
    const plan: PlanState = { ...initialPlan, assemblies: DEFAULT_ASSEMBLIES }
    const env = getEnvelopeFromAssemblies(plan)
    expect(env.embodiedCarbonKgPerM2Floor).toBeGreaterThan(0)
  })
})

describe('CLIMATE_RESPONSES coverage', () => {
  it('every response has a principle and 3+ design notes', () => {
    for (const r of CLIMATE_RESPONSES) {
      expect(r.defaults.principle.length).toBeGreaterThan(10)
      expect(r.designNotes.length).toBeGreaterThanOrEqual(3)
    }
  })

  it('every assembly referenced by a response exists in the preset catalog', () => {
    for (const r of CLIMATE_RESPONSES) {
      expect(ASSEMBLY_PRESETS[r.defaults.wallAssemblyId]).toBeDefined()
      expect(ASSEMBLY_PRESETS[r.defaults.roofAssemblyId]).toBeDefined()
      expect(ASSEMBLY_PRESETS[r.defaults.floorAssemblyId]).toBeDefined()
    }
  })
})

describe('resolvePlanAssemblies', () => {
  it('returns resolved wall/roof/floor', () => {
    const out = resolvePlanAssemblies(DEFAULT_ASSEMBLIES)
    expect(out.wall.assembly.id).toBe(DEFAULT_ASSEMBLIES.wall)
    expect(out.roof.assembly.id).toBe(DEFAULT_ASSEMBLIES.roof)
    expect(out.floor.assembly.id).toBe(DEFAULT_ASSEMBLIES.floor)
  })
})

describe('MATERIALS', () => {
  it('every material used in a preset exists in the catalog', () => {
    const used = new Set<string>()
    for (const a of Object.values(ASSEMBLY_PRESETS)) {
      for (const l of a.layers) used.add(l.materialId)
    }
    for (const id of used) {
      expect(MATERIALS[id]).toBeDefined()
    }
  })
})
