import type { ClimateResponse } from './types'

/**
 * Climate response library. Each entry is a *starting spec* for a house
 * in a particular climate. The user picks one, the system applies the
 * wall / roof / floor defaults + glazing + eave depth + ventilation
 * strategy, and the analysis re-runs.
 *
 * The 5 responses are the ones with a clear physics story — we don't
 * pretend to know what "Tropical Mountain" or "Marine West Coast" want.
 */
export const CLIMATE_RESPONSES: ClimateResponse[] = [
  {
    id: 'tropical-humid',
    label: 'Tropical humid',
    shortLabel: 'Tropical humid',
    description:
      'Hot all year, high humidity, monsoon rain. The enemy is solar gain + moisture. Strategy: high mass, cross-ventilation, deep eaves, light colours.',
    appliesTo: (lat) => Math.abs(lat) >= 5 && Math.abs(lat) <= 20,
    defaults: {
      wallAssemblyId: 'wall-tropical-block',
      roofAssemblyId: 'roof-tile-on-air',
      floorAssemblyId: 'floor-concrete-slab',
      glazingUValue: 2.0, // W/m²·K
      glazingSHGC: 0.30,
      recommendedEaveDepthM: 1.2,
      ventilationStrategy: 'Cross-breeze with operable openings on opposing walls. Solar chimney over the stair or bath.',
      massStrategy: 'high',
      principle: 'Mass damps the diurnal swing; ventilation carries the heat away before it accumulates.',
    },
    designNotes: [
      'Place the longest axis east-west to minimise east + west wall exposure.',
      'Put the kitchen and bath on the leeward side so cooking moisture vents away from the breeze.',
      'A courtyard in the middle turns the whole house into a single through-ventilated volume.',
      'Use light colours on the roof and walls — solar reflectance index (SRI) above 60.',
    ],
  },
  {
    id: 'hot-arid',
    label: 'Hot arid',
    shortLabel: 'Hot arid',
    description:
      'Hot days, cold nights, low humidity, large diurnal swing. The enemy is daytime heat gain + night-time heat loss. Strategy: high thermal mass, small windows, night-flush ventilation.',
    appliesTo: (lat) => Math.abs(lat) >= 20 && Math.abs(lat) <= 35,
    defaults: {
      wallAssemblyId: 'wall-rammed-earth',
      roofAssemblyId: 'roof-tropical-mass',
      floorAssemblyId: 'floor-concrete-slab',
      glazingUValue: 1.4,
      glazingSHGC: 0.25,
      recommendedEaveDepthM: 0.6,
      ventilationStrategy: 'Night-flush: open high clerestories after sunset to dump heat from the mass, close them before sunrise.',
      massStrategy: 'high',
      principle: 'Mass is the battery — charge it at night with cool air, discharge it slowly through the day.',
    },
    designNotes: [
      'Rammed earth or AAC block walls at least 30 cm thick.',
      'Small, deep-set windows on the south and west; large north-facing clerestories.',
      'Internal courtyards are great for both shading and night-flush.',
      'Avoid west-facing glass without external shading.',
    ],
  },
  {
    id: 'cold-temperate',
    label: 'Cold temperate',
    shortLabel: 'Cold temperate',
    description:
      'Long cold winters, short mild summers. The enemy is heat loss. Strategy: high R-value envelope, controlled fresh air with heat recovery, passive solar gain on the south.',
    appliesTo: (lat) => Math.abs(lat) >= 35 && Math.abs(lat) <= 70,
    defaults: {
      wallAssemblyId: 'wall-cold-cavity',
      roofAssemblyId: 'roof-insulated-cold',
      floorAssemblyId: 'floor-mass-insulated',
      glazingUValue: 1.0,
      glazingSHGC: 0.45,
      recommendedEaveDepthM: 0.4,
      ventilationStrategy: 'Mechanical with HRV (heat-recovery ventilator). Cross-ventilation on summer nights only.',
      massStrategy: 'mixed',
      principle: 'Insulate aggressively, ventilate mechanically, harvest winter sun on the south.',
    },
    designNotes: [
      'Continuous vapour barrier on the warm side of the insulation.',
      'Triple-glazed south windows to harvest winter sun without losing heat at night.',
      'Heated mass (tile, concrete) on south-facing floors stores solar gain.',
      'Vestibule or airlock at the main entry to stop cold air infiltration.',
    ],
  },
  {
    id: 'high-altitude',
    label: 'High-altitude equatorial',
    shortLabel: 'High altitude',
    description:
      'Equatorial but elevated: intense sun, cool nights, mild days, low humidity. The enemy is UV + diurnal swing. Strategy: high R-value for night cooling, operable shading for midday sun, operable high louvers for diurnal cycle.',
    appliesTo: (lat) => Math.abs(lat) < 5,
    defaults: {
      wallAssemblyId: 'wall-mass-tropical',
      roofAssemblyId: 'roof-tile-on-air',
      floorAssemblyId: 'floor-concrete-slab',
      glazingUValue: 1.6,
      glazingSHGC: 0.35,
      recommendedEaveDepthM: 0.9,
      ventilationStrategy: 'Operable high louvers: open during the warm afternoon for purge, close at sunset to retain mass warmth.',
      massStrategy: 'high',
      principle: 'The mild days and cool nights are a free diurnal battery — use mass and operable high openings.',
    },
    designNotes: [
      'UV is extreme — protect exposed materials with overhangs or screens.',
      'Low-pitched roofs are fine; snow load is not a concern.',
      'Thick walls (≥ 25 cm) plus high R-value combine mass with diurnal resistance.',
      'Avoid ground-floor cold from the slab — insulate perimeter at least 60 cm down.',
    ],
  },
  {
    id: 'temperate-mixed',
    label: 'Temperate mixed',
    shortLabel: 'Mixed',
    description:
      'A balanced climate with hot summers and cool winters. Strategy: mid-range R, operable shading, mix of mass and insulation.',
    appliesTo: (lat) => Math.abs(lat) > 20 && Math.abs(lat) < 35,
    defaults: {
      wallAssemblyId: 'wall-timber-frame',
      roofAssemblyId: 'roof-lightweight-tropical',
      floorAssemblyId: 'floor-concrete-slab',
      glazingUValue: 1.4,
      glazingSHGC: 0.35,
      recommendedEaveDepthM: 0.7,
      ventilationStrategy: 'Cross-breeze in summer, closed-up with internal mass in winter. Operable shading on south + west.',
      massStrategy: 'mixed',
      principle: 'A balance — enough mass to flatten the daily swing, enough insulation for winter.',
    },
    designNotes: [
      'Deciduous trees on the south and west give summer shade and winter sun.',
      'Operable shading (louvers, roll-down screens) is the most flexible solution.',
      'A north-facing clerestory gives year-round diffuse light without summer gain.',
      'Mix of mass (interior tile or concrete) and insulation (cavity) is the most forgiving envelope.',
    ],
  },
]

/** Pick the best response for a latitude. Falls back to temperate-mixed. */
export function suggestClimateResponse(latitude: number): ClimateResponse {
  const matches = CLIMATE_RESPONSES.filter((r) => r.appliesTo(latitude))
  if (matches.length > 0) return matches[0]
  return CLIMATE_RESPONSES.find((r) => r.id === 'temperate-mixed')!
}

export function getClimateResponse(id: string): ClimateResponse {
  const r = CLIMATE_RESPONSES.find((item) => item.id === id)
  if (!r) throw new Error(`Unknown climate response: ${id}`)
  return r
}
