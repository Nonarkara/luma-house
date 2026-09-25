import { useEffect, useMemo, useRef, useState } from 'react'
import type { PlanState } from '../types'
import { calibrateTrace, traceIssues } from '../concept/reviewTrace'

export interface PendingTrace { image: string; plan: PlanState | null; note: string; error?: string }

export function TraceReview({ draft, busy, onCancel, onAccept }: {
  draft: PendingTrace; busy: boolean; onCancel: () => void; onAccept: (plan: PlanState) => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [roomId, setRoomId] = useState('')
  const [axis, setAxis] = useState<'w' | 'h'>('w')
  const [meters, setMeters] = useState('')
  const [confirmed, setConfirmed] = useState(false)
  const [overlay, setOverlay] = useState(true)
  const selected = roomId || draft.plan?.rooms[0]?.id || ''
  const calibrated = useMemo(() => draft.plan ? calibrateTrace(draft.plan, selected, axis, Number(meters)) : null, [draft.plan, selected, axis, meters])
  const issues = useMemo(() => calibrated ? traceIssues(calibrated) : [], [calibrated])
  useEffect(() => { dialog.current?.showModal() }, [])
  return (
    <dialog ref={dialog} className="trace-review" aria-labelledby="trace-title" onCancel={(event) => { event.preventDefault(); onCancel() }}>
      <h2 id="trace-title">Review the traced plan</h2>
      <p>Your current project stays in place until you accept this draft.</p>
      <div className="trace-preview">
        <img src={draft.image} alt="Source floor plan for comparison" />
        {overlay && draft.plan && <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="Traced room boundaries over the source image">
          {draft.plan.rooms.map((room, index) => <g key={`${room.id}-${index}`}>
            <rect x={room.x} y={room.y} width={room.w} height={room.h} fill="none" stroke="var(--accent, #f59e0b)" strokeWidth="0.5" />
            <text x={room.x + 1} y={room.y + 4} fontSize="3" fill="var(--accent, #f59e0b)">{index + 1}</text>
          </g>)}
          {draft.plan.openings.map((opening, index) => <circle key={index} cx={opening.x} cy={opening.y} r="1" fill="var(--accent, #f59e0b)" />)}
        </svg>}
      </div>
      <p role="status">{busy ? 'Reading the image…' : draft.error || draft.note}</p>
      {draft.plan && <>
        <label><input type="checkbox" checked={overlay} onChange={event => setOverlay(event.target.checked)} /> Show traced boundaries</label>
        <div className="trace-fields">
          <label>Known room<select value={selected} onChange={event => { setRoomId(event.target.value); setConfirmed(false) }}>
            {draft.plan.rooms.map((room, index) => <option key={`${room.id}-${index}`} value={room.id}>{index + 1}. {room.name}</option>)}
          </select></label>
          <label>Dimension<select value={axis} onChange={event => { setAxis(event.target.value as 'w' | 'h'); setConfirmed(false) }}><option value="w">Width</option><option value="h">Depth</option></select></label>
          <label>Known meters<input type="number" min="0.1" step="0.1" value={meters} onChange={event => { setMeters(event.target.value); setConfirmed(false) }} /></label>
        </div>
        {!calibrated && <p>Enter one measured room dimension. The calibrated field must be 1–200 m on each side.</p>}
        {calibrated && <p>Calibrated field: {calibrated.site!.w.toFixed(2)} × {calibrated.site!.h.toFixed(2)} m. Opening sizes remain assumptions until checked.</p>}
        {issues.length > 0 && <div><strong>Needs correction in the editor</strong><ul>{issues.map((issue, index) => <li key={index}>{issue}</li>)}</ul></div>}
        <label><input type="checkbox" checked={confirmed} onChange={event => setConfirmed(event.target.checked)} /> I compared the trace with the source and will correct the unresolved geometry.</label>
      </>}
      <div className="trace-actions">
        <button className="button secondary" type="button" onClick={onCancel}>{busy ? 'Cancel tracing' : 'Keep current project'}</button>
        <button className="button primary" type="button" disabled={busy || !calibrated || !confirmed} onClick={() => calibrated && onAccept(calibrated)}>Accept editable draft</button>
      </div>
    </dialog>
  )
}
