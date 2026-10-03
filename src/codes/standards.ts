/**
 * Architectural reference library.
 *
 * Every cited reference lives here as data. These are deliberately labelled
 * as US examples rather than universal compliance rules: applicability varies
 * by jurisdiction, building type, accessibility scope, and adopted edition.
 * Geometry-only checks use the MODEL body and are never presented as code.
 */

export type Severity = 'info' | 'warning' | 'critical'

export interface Standard {
  /** Short code reference, e.g. "2021 IRC R304.1". Shown as a 9px monospace badge. */
  ref: string
  /** Long name. Tooltip. */
  name: string
  /** Issuing body, or MODEL for an internal geometry check. */
  body: 'IRC' | 'IBC' | 'ASHRAE' | 'ADA' | 'MODEL'
}

/** Catalogue of every standard the app references. */
export const STANDARDS: Record<string, Standard> = {
  'IRC-2021-R304.1': {
    ref: '2021 IRC R304.1',
    name: '2021 International Residential Code — Minimum Habitable Room Area',
    body: 'IRC',
  },
  'IRC-2021-R304.2': {
    ref: '2021 IRC R304.2',
    name: '2021 International Residential Code — Minimum Room Width',
    body: 'IRC',
  },
  'IRC-2021-R305.1': {
    ref: '2021 IRC R305.1',
    name: '2021 International Residential Code — Minimum Ceiling Height',
    body: 'IRC',
  },
  'MODEL-EGRESS': {
    ref: 'MODEL · ROUTE',
    name: 'Modeled door-graph route to outdoors — geometry only',
    body: 'MODEL',
  },
  'MODEL-ENVELOPE': {
    ref: 'MODEL · ENVELOPE',
    name: 'Modeled envelope inputs — not a code rating',
    body: 'MODEL',
  },
  'MODEL-VENTILATION': {
    ref: 'MODEL · AIR PATH',
    name: 'Modeled operable-air path — geometry only',
    body: 'MODEL',
  },
  'IBC-1010.1.1': {
    ref: 'IBC 1010.1.1',
    name: 'International Building Code — Door Size',
    body: 'IBC',
  },
  'ASHRAE-62.2-WHOLE-DWELLING': {
    ref: 'ASHRAE 62.2',
    name: 'ASHRAE 62.2 — Residential Ventilation (inputs incomplete)',
    body: 'ASHRAE',
  },
  'ASHRAE-62.2-KITCHEN': {
    ref: 'ASHRAE 62.2',
    name: 'ASHRAE 62.2 — Local Kitchen Exhaust',
    body: 'ASHRAE',
  },
  'ASHRAE-62.2-BATHROOM': {
    ref: 'ASHRAE 62.2',
    name: 'ASHRAE 62.2 — Local Bathroom Exhaust',
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
}

/**
 * Numeric thresholds. Each rule reads from this table. The values are the
 * minimums/maximums a residential plan must hit. Where a value is missing,
 * the rule is not enforced.
 */
export interface Thresholds {
  /** 2021 IRC R304.1 example: minimum habitable-room floor area. */
  minHabitableAreaM2: number
  /** 2021 IRC R304.2 example: minimum horizontal dimension. */
  minHabitableDimensionM: number
  /** 2021 IRC R305.1 example: minimum habitable-space ceiling height. */
  minCeilingHeightM: number
  /** Minimum door clear opening width. ADA 404.2.3 (815 mm = 32 in). */
  minDoorClearWidthM: number
  /** Minimum door height. IBC 1010.1.1 (2.03 m = 80 in). */
  minDoorHeightM: number
  /**
   * Turning space diameter for an accessible room. ADA 304.3 requires a
   * 1.5 m (60 in) clear circle inside bathrooms and other accessible rooms.
   */
  adaTurningDiameterM: number
  /** Kitchen intermittent exhaust reference, L/s. ASHRAE 62.2. */
  kitchenExhaustLs: number
  /** Bathroom intermittent exhaust reference, L/s. ASHRAE 62.2. */
  bathroomExhaustLs: number
  /** Scenario occupancy assumptions; not code-prescribed. */
  occupantsPerKind: Record<string, number>
}

export const DEFAULT_THRESHOLDS: Thresholds = {
  minHabitableAreaM2: 6.5,    // 70 sq ft per 2021 IRC R304.1
  minHabitableDimensionM: 2.13, // 7'-0" per 2021 IRC R304.2
  minCeilingHeightM: 2.13,    // 7'-0" per 2021 IRC R305.1
  minDoorClearWidthM: 0.81,   // 32 in per ADA 404.2.3
  minDoorHeightM: 2.03,       // 80 in per IBC 1010.1.1
  adaTurningDiameterM: 1.5,   // 60 in per ADA 304.3
  kitchenExhaustLs: 50,       // ASHRAE 62.2 intermittent vented range hood
  bathroomExhaustLs: 25,      // ASHRAE 62.2 intermittent local exhaust
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
