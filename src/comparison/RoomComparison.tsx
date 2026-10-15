import { compareRoomLayouts, furnitureChanges } from './geometry'
import type { PlanState } from '../types'

export function RoomComparison({ baseline, proposed }: { baseline: PlanState; proposed: PlanState }) {
  const rows = compareRoomLayouts(baseline, proposed), changes = furnitureChanges(baseline, proposed)
  const distance = (n: number | null | undefined) => n == null ? 'Unavailable' : `${n.toFixed(2)} m`
  return <section className="comparison-room-measures" aria-label="Furniture and room comparison">
    <h3>What changed in the rooms</h3>
    <p>{changes.changed} furniture pieces moved, rotated or resized · {changes.added} added · {changes.removed} removed. Envelope metrics below may stay unchanged for furniture-only changes.</p>
    <div className="comparison-metric-scroll"><table><caption>Geometric distances; no lux, walking-route or code-compliance claim. Unavailable means the room, desk/seat or window is absent.</caption><thead><tr><th scope="col">Room</th><th scope="col">Centre clearance A → B</th><th scope="col">Desk/seat to window A → B</th><th scope="col">Fit checks A → B</th></tr></thead><tbody>
      {rows.map(r => <tr key={r.id}><th scope="row">{r.name}{r.status !== 'Matched room' && <span> · {r.status}</span>}</th><td>{distance(r.baseline?.centreClearanceM)} → {distance(r.proposed?.centreClearanceM)}</td><td>{distance(r.baseline?.nearestWindowM)} → {distance(r.proposed?.nearestWindowM)}</td><td>{r.baseline ? r.baselineIssues.join(' ') || 'No checked conflict' : 'Absent'} → {r.proposed ? r.proposedIssues.join(' ') || 'No checked conflict' : 'Absent'}</td></tr>)}
    </tbody></table></div>
  </section>
}
