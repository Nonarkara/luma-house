import type { PlanState, Room } from '../types'

export const COMPLETE_PROJECT_NAME = 'Lantern Courtyard 100'
export const COMPLETE_PROJECT_KEY = 'luma-house:lantern-courtyard-100:v2'
export const COMPLETE_PROJECT_LOCATION = 'Bangkok'

// Two 39.6825%-deep bands across a 90%-wide envelope resolve to exactly 100 m²
// on the 14 × 10 m site used by the editor.
const BAND_DEPTH = 39.6825396825

export const completeHouseRooms: Room[] = [
  { id: 'living', name: 'Living room', kind: 'living', x: 5, y: 10, w: 30, h: BAND_DEPTH },
  { id: 'kitchen', name: 'Kitchen + dining', kind: 'kitchen', x: 35, y: 10, w: 30, h: BAND_DEPTH },
  { id: 'utility', name: 'Utility', kind: 'studio', x: 65, y: 10, w: 15, h: BAND_DEPTH },
  { id: 'guest-bath', name: 'Guest bath', kind: 'bathroom', x: 80, y: 10, w: 15, h: BAND_DEPTH },
  { id: 'primary', name: 'Primary suite', kind: 'bedroom', x: 5, y: 10 + BAND_DEPTH, w: 30, h: BAND_DEPTH },
  { id: 'bed-2', name: 'Bedroom 02', kind: 'bedroom', x: 35, y: 10 + BAND_DEPTH, w: 25, h: BAND_DEPTH },
  { id: 'studio', name: 'Flexible studio', kind: 'studio', x: 60, y: 10 + BAND_DEPTH, w: 20, h: BAND_DEPTH },
  { id: 'main-bath', name: 'Main bath', kind: 'bathroom', x: 80, y: 10 + BAND_DEPTH, w: 15, h: BAND_DEPTH },
]

export const completeHousePlan: PlanState = {
  rooms: completeHouseRooms,
  openings: [
    { id: 'w-n-living', type: 'window', x: 19, y: 10, rotation: 0 },
    { id: 'w-n-kitchen', type: 'window', x: 49, y: 10, rotation: 0 },
    { id: 'w-n-utility', type: 'window', x: 72, y: 10, rotation: 0 },
    { id: 'w-n-guest', type: 'window', x: 87, y: 10, rotation: 0 },
    { id: 'w-s-primary', type: 'window', x: 20, y: 89.365079365, rotation: 0 },
    { id: 'w-s-bed2', type: 'window', x: 47, y: 89.365079365, rotation: 0 },
    { id: 'w-s-studio', type: 'window', x: 70, y: 89.365079365, rotation: 0 },
    { id: 'w-s-bath', type: 'window', x: 87, y: 89.365079365, rotation: 0 },
    { id: 'w-w-living', type: 'window', x: 5, y: 27, rotation: 90 },
    { id: 'w-w-primary', type: 'window', x: 5, y: 69, rotation: 90 },
    { id: 'w-e-guest', type: 'window', x: 95, y: 27, rotation: 90 },
    { id: 'w-e-main', type: 'window', x: 95, y: 69, rotation: 90 },
    { id: 'd-entry', type: 'door', x: 5, y: 42, rotation: 90 },
    { id: 'd-primary', type: 'door', x: 20, y: 49.6825396825, rotation: 0 },
    { id: 'd-bed2', type: 'door', x: 47, y: 49.6825396825, rotation: 0 },
    { id: 'd-studio', type: 'door', x: 70, y: 49.6825396825, rotation: 0 },
    { id: 'd-main-bath', type: 'door', x: 87, y: 49.6825396825, rotation: 0 },
  ],
  furniture: [
    { id: 'f-living-sofa', kind: 'sofa', x: 14, y: 27, rotated: false },
    { id: 'f-dining', kind: 'dining', x: 42, y: 27, rotated: false },
    { id: 'f-primary-bed', kind: 'bed', x: 10, y: 65, rotated: false },
    { id: 'f-primary-robe', kind: 'wardrobe', x: 27, y: 60, rotated: true },
    { id: 'f-bed2', kind: 'bed', x: 38, y: 66, rotated: false },
    { id: 'f-bed2-robe', kind: 'wardrobe', x: 54, y: 59, rotated: true },
    { id: 'f-studio-desk', kind: 'desk', x: 64, y: 65, rotated: false },
  ],
  systems: { solar: true, insulation: true, climate: true, lighting: true },
}

function layoutWithRoomOrder(order: string[]): Room[] {
  const slots = completeHouseRooms.map(({ x, y, w, h }) => ({ x, y, w, h }))
  return order.map((id, index) => {
    const room = completeHouseRooms.find((item) => item.id === id)!
    return { ...room, ...slots[index] }
  })
}

export const completeHouseVariants: Array<{ name: string; note: string; rooms: Room[] }> = [
  { name: 'Lantern courtyard', note: 'Balanced daylight, private south wing', rooms: completeHouseRooms },
  {
    name: 'Social kitchen',
    note: 'Kitchen anchors arrival and daily life',
    rooms: layoutWithRoomOrder(['kitchen', 'living', 'utility', 'guest-bath', 'primary', 'bed-2', 'studio', 'main-bath']),
  },
  {
    name: 'Work from garden',
    note: 'Studio moves to the quiet west edge',
    rooms: layoutWithRoomOrder(['living', 'kitchen', 'utility', 'guest-bath', 'studio', 'primary', 'bed-2', 'main-bath']),
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

export const lightingChannels: LightingChannel[] = [
  { id: 'ambient', circuit: 'L01', name: 'Ambient wash', zone: 'Living', loadWatts: 48, defaultLevel: 72, control: 'DALI dim' },
  { id: 'kitchen', circuit: 'L02', name: 'Task line', zone: 'Kitchen', loadWatts: 36, defaultLevel: 85, control: 'DALI dim' },
  { id: 'pendant', circuit: 'L03', name: 'Dining pendant', zone: 'Dining', loadWatts: 18, defaultLevel: 62, control: 'Phase dim' },
  { id: 'bedrooms', circuit: 'L04', name: 'Low-glare downlight', zone: 'Bedrooms', loadWatts: 42, defaultLevel: 38, control: 'DALI warm-dim' },
  { id: 'wet', circuit: 'L05', name: 'Mirror + utility', zone: 'Wet rooms', loadWatts: 28, defaultLevel: 60, control: 'Presence' },
  { id: 'landscape', circuit: 'L06', name: 'Courtyard path', zone: 'Exterior', loadWatts: 32, defaultLevel: 24, control: 'Astronomical' },
]

export const lightingScenes = {
  Morning: { ambient: 55, kitchen: 90, pendant: 20, bedrooms: 45, wet: 70, landscape: 0 },
  Entertain: { ambient: 68, kitchen: 55, pendant: 78, bedrooms: 15, wet: 35, landscape: 48 },
  'Night path': { ambient: 8, kitchen: 0, pendant: 0, bedrooms: 6, wet: 12, landscape: 22 },
  Away: { ambient: 0, kitchen: 0, pendant: 0, bedrooms: 0, wet: 0, landscape: 8 },
} satisfies Record<string, Record<string, number>>

export const automationRules = [
  { name: 'Arrive home', trigger: 'First presence after sunset', action: 'Entry 30% · living 45% · cool to 25°C' },
  { name: 'Night purge', trigger: 'Outdoor air 2°C cooler', action: 'Open high vents · pause cooling' },
  { name: 'Peak shave', trigger: 'Grid tariff > ฿5.2/kWh', action: 'Battery support · pre-cool off' },
  { name: 'House asleep', trigger: 'No motion for 45 min after 23:00', action: 'All off · path lights at 6%' },
]
