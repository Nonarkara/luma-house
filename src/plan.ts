import type { Furniture, FurnitureKind, Opening, PlanState, Room } from './types'

export const SITE_WIDTH_METERS = 14
export const SITE_HEIGHT_METERS = 10

export const locations = {
  Bangkok: { latitude: 13.7563, label: 'Bangkok, TH' },
  'Chiang Mai': { latitude: 18.7883, label: 'Chiang Mai, TH' },
  Phuket: { latitude: 7.8804, label: 'Phuket, TH' },
  Singapore: { latitude: 1.3521, label: 'Singapore, SG' },
  Quito: { latitude: -0.1807, label: 'Quito, EC' },
  Anchorage: { latitude: 61.2181, label: 'Anchorage, US' },
}

export const initialRooms: Room[] = [
  { id: 'living', name: 'Living + dining', kind: 'living', x: 5, y: 6, w: 46, h: 43 },
  { id: 'kitchen', name: 'Kitchen', kind: 'kitchen', x: 51, y: 6, w: 28, h: 25 },
  { id: 'bath', name: 'Bath', kind: 'bathroom', x: 79, y: 6, w: 16, h: 25 },
  { id: 'bed-1', name: 'Primary bedroom', kind: 'bedroom', x: 5, y: 49, w: 38, h: 42 },
  { id: 'bed-2', name: 'Bedroom 02', kind: 'bedroom', x: 43, y: 59, w: 31, h: 32 },
  { id: 'terrace', name: 'Shaded terrace', kind: 'terrace', x: 51, y: 31, w: 44, h: 28 },
]

export const initialPlan: PlanState = {
  rooms: initialRooms,
  openings: [
    { id: 'w1', type: 'window', x: 20, y: 6, rotation: 0 },
    { id: 'w2', type: 'window', x: 51, y: 22, rotation: 90 },
    { id: 'w3', type: 'window', x: 21, y: 91, rotation: 0 },
    { id: 'w4', type: 'window', x: 58, y: 91, rotation: 0 },
    { id: 'd1', type: 'door', x: 43, y: 76, rotation: 90 },
    { id: 'd2', type: 'door', x: 51, y: 40, rotation: 90 },
  ],
  furniture: [
    { id: 'f-sofa', kind: 'sofa', x: 12, y: 20, rotated: false },
    { id: 'f-bed', kind: 'bed', x: 10, y: 62, rotated: false },
    { id: 'f-dining', kind: 'dining', x: 28, y: 34, rotated: false },
  ],
  systems: { solar: true, insulation: true, climate: false, lighting: true },
}

// Real-world footprints in meters (width × depth), the whole point of testing fit.
export const furnitureCatalog: Record<FurnitureKind, { label: string; w: number; d: number }> = {
  bed: { label: 'Bed', w: 2.0, d: 1.8 },
  sofa: { label: 'Sofa', w: 2.2, d: 0.9 },
  dining: { label: 'Dining table', w: 1.8, d: 0.9 },
  wardrobe: { label: 'Wardrobe', w: 2.0, d: 0.6 },
  desk: { label: 'Desk', w: 1.4, d: 0.7 },
}

export function furnitureRect(item: Furniture): { x: number; y: number; w: number; h: number } {
  const spec = furnitureCatalog[item.kind]
  const widthMeters = item.rotated ? spec.d : spec.w
  const depthMeters = item.rotated ? spec.w : spec.d
  return {
    x: item.x,
    y: item.y,
    w: (widthMeters / SITE_WIDTH_METERS) * 100,
    h: (depthMeters / SITE_HEIGHT_METERS) * 100,
  }
}

export const DOOR_CLEARANCE_METERS = 0.9

// A door needs its swing radius free; furniture inside that arc gets flagged.
export function furnitureDoorConflicts(furniture: Furniture[], openings: Opening[]): Set<string> {
  const doors = openings.filter((opening) => opening.type === 'door')
  const conflicts = new Set<string>()
  for (const item of furniture) {
    const rect = furnitureRect(item)
    const left = (rect.x / 100) * SITE_WIDTH_METERS
    const top = (rect.y / 100) * SITE_HEIGHT_METERS
    const right = ((rect.x + rect.w) / 100) * SITE_WIDTH_METERS
    const bottom = ((rect.y + rect.h) / 100) * SITE_HEIGHT_METERS
    for (const door of doors) {
      const doorX = (door.x / 100) * SITE_WIDTH_METERS
      const doorY = (door.y / 100) * SITE_HEIGHT_METERS
      const nearestX = Math.max(left, Math.min(doorX, right))
      const nearestY = Math.max(top, Math.min(doorY, bottom))
      if (Math.hypot(doorX - nearestX, doorY - nearestY) < DOOR_CLEARANCE_METERS) {
        conflicts.add(item.id)
        break
      }
    }
  }
  return conflicts
}

export const variants: Array<{ name: string; note: string; rooms: Room[] }> = [
  {
    name: 'Courtyard light',
    note: 'Morning light, protected center',
    rooms: initialRooms,
  },
  {
    name: 'Cross breeze',
    note: 'Open spine, opposing windows',
    rooms: [
      { id: 'living', name: 'Living + dining', kind: 'living', x: 5, y: 8, w: 54, h: 38 },
      { id: 'kitchen', name: 'Kitchen', kind: 'kitchen', x: 59, y: 8, w: 35, h: 23 },
      { id: 'bed-1', name: 'Primary bedroom', kind: 'bedroom', x: 5, y: 56, w: 40, h: 35 },
      { id: 'bed-2', name: 'Bedroom 02', kind: 'bedroom', x: 55, y: 56, w: 39, h: 35 },
      { id: 'terrace', name: 'Breezeway', kind: 'terrace', x: 45, y: 46, w: 10, h: 45 },
      { id: 'bath', name: 'Bath', kind: 'bathroom', x: 70, y: 31, w: 24, h: 25 },
    ],
  },
  {
    name: 'Compact shade',
    note: 'Less envelope, lower build cost',
    rooms: [
      { id: 'living', name: 'Living + dining', kind: 'living', x: 14, y: 15, w: 43, h: 39 },
      { id: 'kitchen', name: 'Kitchen', kind: 'kitchen', x: 57, y: 15, w: 28, h: 22 },
      { id: 'bath', name: 'Bath', kind: 'bathroom', x: 70, y: 37, w: 15, h: 19 },
      { id: 'bed-1', name: 'Primary bedroom', kind: 'bedroom', x: 14, y: 54, w: 36, h: 33 },
      { id: 'bed-2', name: 'Bedroom 02', kind: 'bedroom', x: 50, y: 56, w: 35, h: 31 },
    ],
  },
]

export function roomArea(room: Room): number {
  return (room.w / 100) * SITE_WIDTH_METERS * (room.h / 100) * SITE_HEIGHT_METERS
}

export function totalArea(rooms: Room[]): number {
  return rooms.reduce((sum, room) => sum + roomArea(room), 0)
}

export function formatTHB(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'THB',
    maximumFractionDigits: 0,
  }).format(value)
}

export function calculateBudget(plan: PlanState) {
  const area = totalArea(plan.rooms)
  const systemsCost =
    (plan.systems.solar ? 290_000 : 0) +
    (plan.systems.insulation ? area * 1_250 : 0) +
    (plan.systems.climate ? 185_000 : 0) +
    (plan.systems.lighting ? 95_000 : 0)

  const items = [
    { label: 'Structure', amount: area * 17_800 },
    { label: 'Envelope', amount: area * 6_200 + plan.openings.length * 8_500 },
    { label: 'Interior finishes', amount: area * 8_900 },
    { label: 'MEP services', amount: area * 4_600 },
    { label: 'Intelligent systems', amount: systemsCost },
  ]
  const subtotal = items.reduce((sum, item) => sum + item.amount, 0)
  return { area, items, subtotal, total: subtotal * 1.1 }
}

export function solarPosition(latitude: number, dayOfYear: number, hour: number) {
  const radians = Math.PI / 180
  const declination = 23.45 * Math.sin(radians * ((360 / 365) * (284 + dayOfYear)))
  const hourAngle = 15 * (hour - 12)
  const sinAltitude =
    Math.sin(latitude * radians) * Math.sin(declination * radians) +
    Math.cos(latitude * radians) * Math.cos(declination * radians) * Math.cos(hourAngle * radians)
  const altitude = Math.asin(Math.max(-1, Math.min(1, sinAltitude))) / radians
  const cosAzimuth =
    (Math.sin(declination * radians) - Math.sin(altitude * radians) * Math.sin(latitude * radians)) /
    (Math.cos(altitude * radians) * Math.cos(latitude * radians))
  const rawAzimuth = Math.acos(Math.max(-1, Math.min(1, cosAzimuth))) / radians
  const azimuth = hour < 12 ? 180 - rawAzimuth : 180 + rawAzimuth
  return { altitude: Math.max(0, altitude), azimuth }
}

export function estimateEnergySavings(systems: PlanState['systems']): number {
  return Math.min(
    68,
    (systems.solar ? 26 : 0) +
      (systems.insulation ? 18 : 0) +
      (systems.climate ? 13 : 0) +
      (systems.lighting ? 7 : 0),
  )
}

export interface SunPatch {
  windowId: string
  roomId: string
  // parallelogram corners in percent coordinates, order: [W1, W2, W2+depth, W1+depth]
  polygon: Array<{ x: number; y: number }>
  areaM2: number // approximate unclipped patch area in m²
}

export function sunPatches(plan: PlanState, azimuthDeg: number, altitudeDeg: number): SunPatch[] {
  if (altitudeDeg <= 2) return []
  const radians = Math.PI / 180
  const azimuthRad = azimuthDeg * radians
  const altitudeRad = altitudeDeg * radians
  const direction = { x: -Math.sin(azimuthRad), y: Math.cos(azimuthRad) }
  const depth = Math.max(0.3, Math.min(6, 2.4 / Math.tan(altitudeRad)))

  const patches: SunPatch[] = []
  for (const opening of plan.openings) {
    if (opening.type !== 'window') continue
    const centerX = (opening.x / 100) * SITE_WIDTH_METERS
    const centerY = (opening.y / 100) * SITE_HEIGHT_METERS
    const axisX = opening.rotation === 0 ? 1 : 0
    const axisY = opening.rotation === 0 ? 0 : 1
    const w1 = { x: centerX - 0.8 * axisX, y: centerY - 0.8 * axisY }
    const w2 = { x: centerX + 0.8 * axisX, y: centerY + 0.8 * axisY }
    const offset = { x: depth * direction.x, y: depth * direction.y }
    const w3 = { x: w2.x + offset.x, y: w2.y + offset.y }
    const w4 = { x: w1.x + offset.x, y: w1.y + offset.y }

    const probeX = ((centerX + 0.5 * direction.x) / SITE_WIDTH_METERS) * 100
    const probeY = ((centerY + 0.5 * direction.y) / SITE_HEIGHT_METERS) * 100
    const room = plan.rooms.find(
      (item) => probeX >= item.x && probeX <= item.x + item.w && probeY >= item.y && probeY <= item.y + item.h,
    )
    if (!room) continue

    const f = opening.rotation === 0 ? Math.abs(direction.y) : Math.abs(direction.x)
    patches.push({
      windowId: opening.id,
      roomId: room.id,
      polygon: [w1, w2, w3, w4].map((point) => ({
        x: (point.x / SITE_WIDTH_METERS) * 100,
        y: (point.y / SITE_HEIGHT_METERS) * 100,
      })),
      areaM2: 1.6 * depth * f,
    })
  }
  return patches
}
