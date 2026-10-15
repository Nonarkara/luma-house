import { furnitureRectFor, siteOf } from '../plan'
import { roomsForOpening } from '../analysis/walls'
import { openingDimensions } from '../openingGeometry'
import type { PlanState, SiteSpec } from '../types'
import { comparisonFrame, furnitureChangeIds } from './geometry'

function Drawing({ plan, frame, label, numbers, changed }: { plan: PlanState; frame: SiteSpec; label: string; numbers: Map<string, number>; changed: Set<string> }) {
  const own = siteOf(plan), site = frame, margin = Math.max(site.w, site.h) * .08
  const x = (v: number) => v / 100 * own.w, y = (v: number) => v / 100 * own.h
  return <svg className="comparison-plan" viewBox={`${-margin} ${-margin} ${site.w + margin * 2} ${site.h + margin * 2}`} role="img" aria-label={`${label}, measured plan, north up`}>
    <rect className="comparison-site" width={own.w} height={own.h} />
    {plan.rooms.map(r => <g key={r.id}><title>{numbers.get(r.id)}. {r.name} · {(x(r.w) * y(r.h)).toFixed(1)} m²</title><rect className="comparison-room" x={x(r.x)} y={y(r.y)} width={x(r.w)} height={y(r.h)} strokeDasharray={r.kind === 'terrace' ? '.2 .15' : undefined} /></g>)}
    {plan.walls?.map(w => <line key={w.id} className="comparison-room" x1={x(w.x1)} y1={y(w.y1)} x2={x(w.x2)} y2={y(w.y2)} />)}
    {plan.openings.filter(o => roomsForOpening(plan, o).length > 0).map(o => {
      const d = openingDimensions(o), a = o.rotation === 0 ? d.width / 2 : 0, b = o.rotation === 90 ? d.width / 2 : 0
      return <g key={o.id}><title>{o.type} {d.width.toFixed(2)} m</title><line className="comparison-opening-gap" x1={x(o.x) - a} x2={x(o.x) + a} y1={y(o.y) - b} y2={y(o.y) + b} /><line className="comparison-opening" x1={x(o.x) - a} x2={x(o.x) + a} y1={y(o.y) - b} y2={y(o.y) + b} strokeDasharray={o.type === 'door' ? '.1 .1' : undefined} /></g>
    })}
    {plan.furniture.map(f => { const r = furnitureRectFor(f, own); return <g key={f.id}><title>{f.kind} · {x(r.w).toFixed(2)} × {y(r.h).toFixed(2)} m{changed.has(f.id) ? ' · changed furniture' : ''}</title><rect className={`comparison-furniture${changed.has(f.id) ? ' comparison-changed' : ''}`} x={x(r.x)} y={y(r.y)} width={x(r.w)} height={y(r.h)} /></g> })}
    {plan.rooms.map(r => <text key={r.id} className="comparison-room-number" x={x(r.x + r.w / 2)} y={y(r.y + r.h / 2)} fontSize={Math.max(site.w, site.h) / 35} textAnchor="middle" dominantBaseline="middle">{numbers.get(r.id)}</text>)}
    <text className="comparison-annotation" x={site.w} y={-margin / 3} textAnchor="end" fontSize={margin / 3}>N ↑</text>
    <text className="comparison-annotation" x="0" y={site.h + margin * .7} fontSize={margin / 3}>{site.w.toFixed(2)} × {site.h.toFixed(2)} m shared field</text>
  </svg>
}
export function MeasuredComparison({ baseline, proposed, baselineLabel = 'Plan A', proposedLabel = 'Plan B' }: {
  baseline: PlanState; proposed: PlanState; baselineLabel?: string; proposedLabel?: string
}) {
  const frame = comparisonFrame(baseline, proposed)
  const rooms = [...new Map([...baseline.rooms, ...proposed.rooms].map(r => [r.id, r])).values()]
  const numbers = new Map(rooms.map((r, i) => [r.id, i + 1]))
  const changes = furnitureChangeIds(baseline, proposed)
  return <><div className="comparison-drawings">
    <figure><figcaption>{baselineLabel}</figcaption><Drawing plan={baseline} frame={frame.site} label={baselineLabel} numbers={numbers} changed={new Set([...changes.changed, ...changes.removed])} /></figure>
    <figure><figcaption>{proposedLabel}</figcaption><Drawing plan={proposed} frame={frame.site} label={proposedLabel} numbers={numbers} changed={new Set([...changes.changed, ...changes.added])} /></figure>
  </div><p className="comparison-room-key">{rooms.map((r, i) => `${i + 1}. ${r.name}`).join(' · ')}</p></>
}
