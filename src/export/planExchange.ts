import { siteOf } from '../plan'
import type { PlanState } from '../types'

function dxfPair(code: number | string, value: number | string): string {
  return `${code}\n${value}`
}

/** Rooms and napkin walls as metre LINE entities. Plan Y is flipped so north is +Y. */
export function planToDxf(plan: PlanState): string {
  const site = siteOf(plan)
  const entities: string[] = []
  const line = (x1: number, y1: number, x2: number, y2: number, layer: string) => {
    entities.push(
      dxfPair(0, 'LINE'),
      dxfPair(8, layer),
      dxfPair(10, x1.toFixed(4)),
      dxfPair(20, y1.toFixed(4)),
      dxfPair(30, '0'),
      dxfPair(11, x2.toFixed(4)),
      dxfPair(21, y2.toFixed(4)),
      dxfPair(31, '0'),
    )
  }
  const toWorld = (xPct: number, yPct: number) => ({
    x: (xPct / 100) * site.w,
    y: site.h - (yPct / 100) * site.h,
  })
  for (const room of plan.rooms) {
    const a = toWorld(room.x, room.y)
    const b = toWorld(room.x + room.w, room.y)
    const c = toWorld(room.x + room.w, room.y + room.h)
    const d = toWorld(room.x, room.y + room.h)
    line(a.x, a.y, b.x, b.y, 'ROOMS')
    line(b.x, b.y, c.x, c.y, 'ROOMS')
    line(c.x, c.y, d.x, d.y, 'ROOMS')
    line(d.x, d.y, a.x, a.y, 'ROOMS')
  }
  for (const wall of plan.walls ?? []) {
    const a = toWorld(wall.x1, wall.y1)
    const b = toWorld(wall.x2, wall.y2)
    line(a.x, a.y, b.x, b.y, 'WALLS')
  }
  return [
    dxfPair(0, 'SECTION'),
    dxfPair(2, 'HEADER'),
    dxfPair(9, '$INSUNITS'),
    dxfPair(70, 6),
    dxfPair(0, 'ENDSEC'),
    dxfPair(0, 'SECTION'),
    dxfPair(2, 'ENTITIES'),
    ...entities,
    dxfPair(0, 'ENDSEC'),
    dxfPair(0, 'EOF'),
    '',
  ].join('\n')
}

/** Flat plan drawing on a canvas. Paper and ink follow the drafting-room palette. */
export function drawPlan(ctx: CanvasRenderingContext2D, plan: PlanState, width: number, height: number) {
  const site = siteOf(plan)
  ctx.fillStyle = '#fcfcf8'
  ctx.fillRect(0, 0, width, height)
  const pad = 48
  const scale = Math.min((width - pad * 2) / site.w, (height - pad * 2) / site.h)
  const ox = (width - site.w * scale) / 2
  const oy = (height - site.h * scale) / 2
  const px = (xPct: number) => ox + (xPct / 100) * site.w * scale
  const py = (yPct: number) => oy + (yPct / 100) * site.h * scale
  ctx.strokeStyle = '#c5c8bc'
  ctx.lineWidth = 1
  const stepX = (site.unit / site.w) * 100
  const stepY = (site.unit / site.h) * 100
  for (let x = 0; x <= 100; x += stepX) {
    ctx.beginPath()
    ctx.moveTo(px(x), py(0))
    ctx.lineTo(px(x), py(100))
    ctx.stroke()
  }
  for (let y = 0; y <= 100; y += stepY) {
    ctx.beginPath()
    ctx.moveTo(px(0), py(y))
    ctx.lineTo(px(100), py(y))
    ctx.stroke()
  }
  ctx.strokeStyle = '#26383f'
  ctx.lineWidth = 2
  for (const room of plan.rooms) {
    ctx.strokeRect(px(room.x), py(room.y), (room.w / 100) * site.w * scale, (room.h / 100) * site.h * scale)
  }
  for (const wall of plan.walls ?? []) {
    ctx.beginPath()
    ctx.moveTo(px(wall.x1), py(wall.y1))
    ctx.lineTo(px(wall.x2), py(wall.y2))
    ctx.stroke()
  }
  for (const opening of plan.openings) {
    const along = (opening.rotation === 0 ? site.w : site.h)
    const half = ((opening.widthM ?? (opening.type === 'door' ? 0.9 : 1.6)) / along) * 50
    ctx.strokeStyle = '#8a4c16'
    ctx.lineWidth = opening.type === 'door' ? 3 : 2
    ctx.beginPath()
    if (opening.rotation === 0) {
      ctx.moveTo(px(opening.x - half), py(opening.y))
      ctx.lineTo(px(opening.x + half), py(opening.y))
    } else {
      ctx.moveTo(px(opening.x), py(opening.y - half))
      ctx.lineTo(px(opening.x), py(opening.y + half))
    }
    ctx.stroke()
  }
  ctx.fillStyle = '#26383f'
  ctx.font = '16px "Source Sans 3", sans-serif'
  ctx.fillText(`${site.w.toFixed(1)} × ${site.h.toFixed(1)} m · 1 cell = ${site.unit} m`, pad, height - 20)
}

export function downloadBlob(bytes: BlobPart, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

export function downloadPlanPng(plan: PlanState, filename: string) {
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 900
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Could not draw the plan')
  drawPlan(ctx, plan, canvas.width, canvas.height)
  const url = canvas.toDataURL('image/png')
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  return url
}
