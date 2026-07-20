import { siteOf, totalAreaFor, type CarbonLine } from '../plan'
import type { PlanState, Room } from '../types'

export const CHINA_PROJECT_NAME = 'South Light 50 · 向阳之家'
export const CHINA_PROJECT_KEY = 'luma-house:south-light-shanghai-50:v4'
export const CHINA_PROJECT_LOCATION = 'Shanghai'

// Net internal apartment envelope: 8.75 m × 5.714 m = exactly 50.0 m²
// on the editor's 14 × 10 m coordinate system. North is up; the principal
// glazing is on the south (bottom) facade.
const NORTH = 21.4285714286
const MID = 46.4285714286
const SOUTH = 78.5714285714

export const chinaApartmentRooms: Room[] = [
  { id: 'bedroom', name: 'Quiet bedroom', kind: 'bedroom', x: 18.75, y: NORTH, w: 26, h: 25, wallHeight: 2.75 },
  { id: 'study', name: 'Tea + study niche', kind: 'studio', x: 44.75, y: NORTH, w: 17, h: 25, wallHeight: 2.75 },
  { id: 'bath', name: 'Dry / wet bath', kind: 'bathroom', x: 61.75, y: NORTH, w: 19.5, h: 25, wallHeight: 2.75 },
  { id: 'living', name: 'South living room', kind: 'living', x: 18.75, y: MID, w: 28, h: SOUTH - MID, wallHeight: 2.75 },
  { id: 'kitchen', name: 'Kitchen + dining', kind: 'kitchen', x: 46.75, y: MID, w: 21, h: SOUTH - MID, wallHeight: 2.75 },
  { id: 'entry', name: 'Entry + laundry', kind: 'studio', x: 67.75, y: MID, w: 13.5, h: SOUTH - MID, wallHeight: 2.75 },
]

export const chinaApartmentPlan: PlanState = {
  rooms: chinaApartmentRooms,
  openings: [
    { id: 'w-s-living-a', type: 'window', x: 28, y: SOUTH, rotation: 0 },
    { id: 'w-s-living-b', type: 'window', x: 40, y: SOUTH, rotation: 0 },
    { id: 'w-s-kitchen', type: 'window', x: 57, y: SOUTH, rotation: 0 },
    { id: 'w-n-bedroom', type: 'window', x: 31.5, y: NORTH, rotation: 0 },
    { id: 'w-n-study', type: 'window', x: 53, y: NORTH, rotation: 0 },
    { id: 'w-e-bath', type: 'window', x: 81.25, y: 34, rotation: 90 },
    { id: 'd-entry', type: 'door', x: 81.25, y: 67, rotation: 90 },
    { id: 'd-bedroom', type: 'door', x: 40, y: MID, rotation: 0 },
    { id: 'd-study', type: 'door', x: 53, y: MID, rotation: 0 },
    { id: 'd-bath', type: 'door', x: 65, y: MID, rotation: 0 },
  ],
  furniture: [
    { id: 'f-bed', kind: 'bed', x: 19, y: 25, rotated: false },
    { id: 'f-robe', kind: 'wardrobe', x: 29, y: 22, rotated: false },
    { id: 'f-desk', kind: 'desk', x: 46, y: 23, rotated: false },
    { id: 'f-sofa', kind: 'sofa', x: 23, y: 57, rotated: false },
    { id: 'f-dining', kind: 'dining', x: 50, y: 60, rotated: true },
  ],
  systems: { solar: true, insulation: true, climate: true, lighting: true },
}

export const chinaApartmentVariants = [
  {
    name: 'South-light calm',
    note: 'Bed protected north; social rooms own the sun',
    rooms: chinaApartmentRooms,
  },
  {
    name: 'Tea-host mode',
    note: 'Sliding study opens to one long entertaining room',
    rooms: chinaApartmentRooms.map((room) => room.id === 'study' ? { ...room, name: 'Open tea gallery' } : { ...room }),
  },
  {
    name: 'Work-from-home',
    note: 'Acoustic study closes; living remains south-facing',
    rooms: chinaApartmentRooms.map((room) => room.id === 'study' ? { ...room, name: 'Acoustic study' } : { ...room }),
  },
]

export interface LightingChannel {
  id: string
  circuit: string
  name: string
  zone: string
  loadWatts: number
  defaultLevel: number
  control: string
}

export const chinaLightingChannels: LightingChannel[] = [
  { id: 'living', circuit: 'L01', name: 'Wall-wash + reflected cove', zone: 'Living', loadWatts: 34, defaultLevel: 58, control: 'DALI warm-dim' },
  { id: 'dining', circuit: 'L02', name: 'Dining lantern', zone: 'Dining', loadWatts: 16, defaultLevel: 64, control: 'DALI dim' },
  { id: 'task', circuit: 'L03', name: 'Joinery task line', zone: 'Kitchen', loadWatts: 28, defaultLevel: 88, control: 'DALI dim' },
  { id: 'sleep', circuit: 'L04', name: 'Low-level sleep light', zone: 'Bedroom', loadWatts: 18, defaultLevel: 26, control: 'Warm-dim 1800–2700 K' },
  { id: 'tea', circuit: 'L05', name: 'Tea / art niche', zone: 'Study', loadWatts: 12, defaultLevel: 42, control: 'Museum spot, dim' },
  { id: 'hygiene', circuit: 'L06', name: 'Entry + bath clarity', zone: 'Wet / entry', loadWatts: 26, defaultLevel: 72, control: 'Presence + manual override' },
]

export const chinaLightingScenes = {
  Morning: { living: 20, dining: 0, task: 70, sleep: 28, tea: 0, hygiene: 65 },
  Tea: { living: 32, dining: 18, task: 12, sleep: 8, tea: 78, hygiene: 20 },
  Entertain: { living: 62, dining: 76, task: 45, sleep: 8, tea: 42, hygiene: 32 },
  Sleep: { living: 4, dining: 0, task: 0, sleep: 8, tea: 0, hygiene: 10 },
} satisfies Record<string, Record<string, number>>

export const chinaAutomationRules = [
  { name: 'Clean-air arrival', trigger: 'Presence + outdoor PM2.5 above limit', action: 'Close facade vents · ERV boost 20 min · entry light 55%' },
  { name: 'South glare control', trigger: 'Solar altitude 18–42° + glare sensor', action: 'Lower sheer shade to 55%; preserve view below eye level' },
  { name: 'Cooking purge', trigger: 'Hob on or PM2.5 rises in kitchen', action: 'Range hood high · ERV supply balance · close bedroom transfer grille' },
  { name: 'Sleep protection', trigger: 'Scene Sleep after 22:30', action: 'Warm light ≤8% · 25 dBA ventilation · leak sensors armed' },
]

export const preferenceChecks = [
  { title: 'South-facing daily rooms', status: 'Aligned', detail: 'Living and dining receive the principal south facade; north remains quieter.' },
  { title: 'Protected bed position', status: 'Aligned', detail: 'Solid headboard wall; the bed is not directly in line with the entry or WC door.' },
  { title: 'Clear arrival / 明堂', status: 'Aligned', detail: 'A 1.2 m clear landing precedes the living room; storage absorbs shoes and parcels.' },
  { title: 'Fire–water separation', status: 'Aligned', detail: 'Hob and sink are separated by a 600 mm preparation zone.' },
  { title: 'Quiet tea / remembrance niche', status: 'Resident option', detail: 'Integrated timber niche faces the calm interior; its use remains entirely optional.' },
]

export const hygieneChecks = [
  { title: 'Shoes and parcels contained', detail: 'Ventilated elm entry cabinet, washable base, parcel shelf and hand-cleaning point.' },
  { title: 'Dry / wet bath split', detail: 'Separate basin, WC and shower zones; fall to floor drain and accessible service valves.' },
  { title: 'Cooking air isolated', detail: 'Ducted hood to exterior; make-up air path prevents bedroom odor migration.' },
  { title: 'Filtered outdoor air', detail: 'Balanced ERV with ePM1 filter, CO₂ and PM2.5 sensing; filters remain front-accessible.' },
  { title: 'Moisture surveillance', detail: 'Humidity control, laundry exhaust, concealed leak sensors and shut-off valve.' },
]

export const customInteriorSchedule = [
  { zone: 'Entry', element: 'Full-height elm shoe + parcel cabinet', specification: 'Ventilated bronze mesh, removable washable plinth, integrated bench' },
  { zone: 'Living', element: 'South-window daybed and media wall', specification: 'Solid ash frame, linen cushions, drawers and concealed cable raceway' },
  { zone: 'Dining', element: 'Built-in banquette + 1.5 m solid elm table', specification: 'Rounded corners, loose upholstered pads, no flat-pack modules' },
  { zone: 'Kitchen', element: 'Custom fluted-lacquer galley', specification: 'Quartz worktop, 600 mm hob–sink separation, ducted extraction' },
  { zone: 'Study', element: 'Tea / art cabinet and sliding screen', specification: 'Oiled elm, linen-laminated glass, dimmable museum spot' },
  { zone: 'Bedroom', element: 'Platform bed + wardrobe wall', specification: 'Under-bed drawers, integrated reading light, acoustic felt backing' },
]

export const apartmentSystems = [
  { code: 'M01', title: 'Balanced ERV', detail: '120–150 m³/h, ePM1 filtration, 25 dBA sleep mode' },
  { code: 'M02', title: 'Two-zone heat pump', detail: 'Living + bedroom zones; condensate and access panels coordinated' },
  { code: 'E01', title: 'Secondary glazing + air sealing', detail: 'Low-e interior panel where permitted; preserve drainage and fire egress' },
  { code: 'C01', title: 'Open controls', detail: 'DALI lighting; Matter/KNX gateway; local manual control works offline' },
  { code: 'S01', title: 'Conditional solar', detail: '2.2 kWp share of common roof, or ≤800 W balcony/facade only with approvals' },
]

export interface ApartmentBudget {
  area: number
  currency: 'CNY'
  subtotal: number
  contingencyRate: number
  total: number
  items: Array<{ label: string; amount: number; quantity: number; unit: string; rate: number }>
}

export function calculateChinaApartmentBudget(plan: PlanState): ApartmentBudget {
  const area = totalAreaFor(plan.rooms, siteOf(plan))
  const items = [
    { label: 'Preliminaries, survey & protection', quantity: 1, unit: 'lot', rate: 12_000, amount: 12_000 },
    { label: 'Selective demolition & waste', quantity: area, unit: 'm²', rate: 180, amount: area * 180 },
    { label: 'Partitions, linings & ceilings', quantity: 85, unit: 'm²', rate: 260, amount: 22_100 },
    { label: 'Waterproofing & flood test', quantity: 18, unit: 'm²', rate: 260, amount: 4_680 },
    { label: 'Floor, wall & ceiling finishes', quantity: 145, unit: 'm²', rate: 280, amount: 40_600 },
    { label: 'Bespoke elm / lacquer joinery', quantity: 22, unit: 'lin.m', rate: 3_200, amount: 70_400 },
    { label: 'Internal doors & secondary glazing', quantity: 7, unit: 'units', rate: 3_500, amount: 24_500 },
    { label: 'Plumbing, sanitaryware & drainage', quantity: 1, unit: 'lot', rate: 48_000, amount: 48_000 },
    { label: 'Electrical & six-channel lighting', quantity: 1, unit: 'lot', rate: 38_000, amount: 38_000 },
    { label: 'ERV, filtration & air-quality sensors', quantity: 1, unit: 'system', rate: 36_000, amount: 36_000 },
    { label: 'Two-zone HVAC & thermal upgrades', quantity: 1, unit: 'system', rate: 42_000, amount: 42_000 },
    { label: 'Appliance allowance', quantity: 1, unit: 'allowance', rate: 55_000, amount: 55_000 },
    { label: 'Digital controls & commissioning', quantity: 1, unit: 'system', rate: 28_000, amount: 28_000 },
  ]
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
  const contingencyRate = 0.08
  return { area, currency: 'CNY', items, subtotal, contingencyRate, total: subtotal * (1 + contingencyRate) }
}

export function estimateApartmentCarbon(plan: PlanState): { lines: CarbonLine[]; totalKg: number; kgPerM2: number } {
  const area = totalAreaFor(plan.rooms, siteOf(plan))
  const lines: CarbonLine[] = [
    { label: 'Partitions & ceilings', basis: `${area.toFixed(1)} m² × 22 kg`, kgCO2e: area * 22 },
    { label: 'Floor and wall finishes', basis: `${area.toFixed(1)} m² × 31 kg`, kgCO2e: area * 31 },
    { label: 'Bespoke joinery', basis: '22 lin.m × 46 kg', kgCO2e: 22 * 46 },
    { label: 'MEP and sanitary fit-out', basis: `${area.toFixed(1)} m² × 27 kg`, kgCO2e: area * 27 },
    { label: 'Glazing and doors', basis: '7 units × 72 kg', kgCO2e: 7 * 72 },
  ]
  if (plan.systems.solar) lines.push({ label: 'Allocated common-roof PV', basis: '2.2 kWp × 400 kg/kWp', kgCO2e: 2.2 * 400 })
  const totalKg = lines.reduce((sum, line) => sum + line.kgCO2e, 0)
  return { lines, totalKg, kgPerM2: totalKg / Math.max(1, area) }
}
