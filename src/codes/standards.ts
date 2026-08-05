/**
 * Architectural standards library.
 *
 * Every rule lives here as data. The values are the conservative residential
 * thresholds; if a project's local code is stricter, raise the numbers. The
 * labels are short enough to fit in a 9px monospace badge ("IBC 1003.3.1").
 *
 * Why these specific ones: residential planning needs egress dimensions
 * (IBC 1003), minimum room sizes + ceiling height (IBC 1208), fresh-air
 * rates (ASHRAE 62.1), envelope performance (ASHRAE 90.1), and accessible
 * door widths (ADA 404). We don't claim to be a code consultant — the UI
 * shows these as references, not as law.
 */

export type Severity = 'info' | 'warning' | 'critical'

export interface Standard {
  /** Short code reference, e.g. "IBC 1003.3.1". Shown as a 9px monospace badge. */
  ref: string
  /** Long name, e.g. "International Building Code — Means of Egress". Tooltip. */
  name: string
  /** Issuing body, e.g. "IBC", "ASHRAE", "ADA". */
  body: 'IBC' | 'ASHRAE' | 'ADA' | 'ISO'
}

/** Catalogue of every standard the app references. */
export const STANDARDS: Record<string, Standard> = {
  'IBC-1003.3': {
    ref: 'IBC 1003.3',
    name: 'International Building Code — Common Path of Egress Travel',
    body: 'IBC',
  },
  'IBC-1003.4': {
    ref: 'IBC 1003.4',
    name: 'International Building Code — Aisles',
    body: 'IBC',
  },
  'IBC-1005.1': {
    ref: 'IBC 1005.1',
    name: 'International Building Code — Minimum Aisle Width',
    body: 'IBC',
  },
  'IBC-1008.1.1': {
    ref: 'IBC 1008.1.1',
    name: 'International Building Code — Door Swing',
    body: 'IBC',
  },
  'IBC-1008.1.9': {
    ref: 'IBC 1008.1.9',
    name: 'International Building Code — Door Opening Force',
    body: 'IBC',
  },
  'IBC-1009.1': {
    ref: 'IBC 1009.1',
    name: 'International Building Code — Stairways',
    body: 'IBC',
  },
  'IBC-1010.1.1': {
    ref: 'IBC 1010.1.1',
    name: 'International Building Code — Door Size',
    body: 'IBC',
  },
  'IBC-1208.1': {
    ref: 'IBC 1208.1',
    name: 'International Building Code — Minimum Room Area',
    body: 'IBC',
  },
  'IBC-1208.2': {
    ref: 'IBC 1208.2',
    name: 'International Building Code — Minimum Ceiling Height',
    body: 'IBC',
  },
  'IBC-1208.4': {
    ref: 'IBC 1208.4',
    name: 'International Building Code — Efficiency Dwelling Unit',
    body: 'IBC',
  },
  'IBC-1011.5.2': {
    ref: 'IBC 1011.5.2',
    name: 'International Building Code — Riser Height',
    body: 'IBC',
  },
  'IBC-1011.5.3': {
    ref: 'IBC 1011.5.3',
    name: 'International Building Code — Tread Depth',
    body: 'IBC',
  },
  'ASHRAE-62.1-RESIDENTIAL': {
    ref: 'ASHRAE 62.1',
    name: 'ASHRAE 62.1 — Ventilation for Residential',
    body: 'ASHRAE',
  },
  'ASHRAE-62.1-KITCHEN': {
    ref: 'ASHRAE 62.1',
    name: 'ASHRAE 62.1 — Kitchen Exhaust',
    body: 'ASHRAE',
  },
  'ASHRAE-62.1-BATHROOM': {
    ref: 'ASHRAE 62.1',
    name: 'ASHRAE 62.1 — Bathroom Exhaust',
    body: 'ASHRAE',
  },
  'ASHRAE-90.1-ENVELOPE': {
    ref: 'ASHRAE 90.1',
    name: 'ASHRAE 90.1 — Building Envelope',
    body: 'ASHRAE',
  },
  'ADA-404.2.3': {
    ref: 'ADA 404.2.3',
    name: 'ADA — Accessible Door Clear Width',
    body: 'ADA',
  },
  'ADA-304.3': {
    ref: 'ADA 304.3',
    name: 'ADA — Turning Space',
    body: 'ADA',
  },
  'ISO-7730-COMFORT': {
    ref: 'ISO 7730',
    name: 'ISO 7730 — Moderate Thermal Comfort (PMV/PPD)',
    body: 'ISO',
  },
}

/**
 * Numeric thresholds. Each rule reads from this table. The values are the
 * minimums/maximums a residential plan must hit. Where a value is missing,
 * the rule is not enforced.
 */
export interface Thresholds {
  /** Minimum clear floor area for a habitable room. IBC 1208.1. */
  minHabitableAreaM2: number
  /** Minimum clear ceiling height for a habitable room. IBC 1208.2. */
  minCeilingHeightM: number
  /** Minimum door clear opening width. ADA 404.2.3 (815 mm = 32 in). */
  minDoorClearWidthM: number
  /** Minimum corridor / aisle clear width. IBC 1005.1. */
  minAisleWidthM: number
  /** Maximum dead-end corridor length. IBC 1003.3. */
  maxDeadEndM: number
  /** Minimum fresh-air rate per person, L/s. ASHRAE 62.1. */
  freshAirLsPerPerson: number
  /** Minimum outside-air ACH for residential. ASHRAE 62.1. */
  minAch: number
  /** Kitchen intermittent exhaust, L/s. ASHRAE 62.1. */
  kitchenExhaustLs: number
  /** Bathroom intermittent exhaust, L/s. ASHRAE 62.1. */
  bathroomExhaustLs: number
  /** Max cooling PMV for ISO 7730 comfort. */
  maxHeatingPmv: number
  minCoolingPmv: number
  /** Default occupants per room kind. ASHRAE 62.1 default occupancy. */
  occupantsPerKind: Record<string, number>
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  minHabitableAreaM2: 6.5,    // 70 sq ft per IBC 1208.1
  minCeilingHeightM: 2.13,    // 7'-0" per IBC 1208.2
  minDoorClearWidthM: 0.81,   // 32 in per ADA 404.2.3
  minAisleWidthM: 0.91,       // 36 in per IBC 1005.1
  maxDeadEndM: 6.1,           // 20 ft per IBC 1003.3 (conservative residential)
  freshAirLsPerPerson: 7.5,   // ASHRAE 62.1 Table 5.5.1 (residential)
  minAch: 0.35,                // ASHRAE 62.1 residential default
  kitchenExhaustLs: 25,        // ASHRAE 62.1 kitchen continuous
  bathroomExhaustLs: 10,       // ASHRAE 62.1 bathroom intermittent
  maxHeatingPmv: 0.5,
  minCoolingPmv: -0.5,
  occupantsPerKind: {
    living: 3,
    kitchen: 2,
    bedroom: 2,
    bathroom: 1,
    studio: 1,
    terrace: 0,
  },
}

/** Look up a standard by id. */
export function getStandard(id: string): Standard | null {
  return STANDARDS[id] ?? null
}
