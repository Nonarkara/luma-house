import { useEffect, useMemo, useRef, useState } from 'react'
import { synthesizeLayout, type SynthesizerBrief } from '../concept/layoutSynthesizer'
import type { PlanState } from '../types'

export function LayoutPresetDialog({ onClose, onApply }: { onClose: () => void; onApply: (plan: PlanState) => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const [style, setStyle] = useState<SynthesizerBrief['style']>('courtyard')
  const [area, setArea] = useState('80')
  const result = useMemo(() => {
    try { return synthesizeLayout({ style, targetAreaM2: Number(area) }) } catch { return null }
  }, [style, area])
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} className="trace-review" aria-labelledby="preset-title" onCancel={event => { event.preventDefault(); onClose() }}>
    <h2 id="preset-title">Choose a layout preset</h2>
    <p>These are editable templates. Openings follow the room boundaries. They are not AI-generated or optimized for your site.</p>
    <div className="trace-fields">
      <label>Layout<select value={style} onChange={event => setStyle(event.target.value as SynthesizerBrief['style'])}>
        <option value="courtyard">Courtyard</option><option value="compact">Compact</option><option value="linear">Linear</option><option value="l-shaped">L-shaped</option>
      </select></label>
      <label>Enclosed area (m²)<input type="number" min="20" max="1000" value={area} onChange={event => setArea(event.target.value)} /></label>
    </div>
    {result ? <svg viewBox="0 0 100 100" style={{ width: '100%', maxHeight: 260 }} role="img" aria-label="Layout preview">
      {result.rooms.map(room => <rect key={room.id} x={room.x} y={room.y} width={room.w} height={room.h} fill="none" stroke="#f59e0b" strokeWidth="0.5" />)}
      {result.openings.map(opening => <circle key={opening.id} cx={opening.x} cy={opening.y} r="0.8" fill="#f59e0b" />)}
    </svg> : <p role="alert">Enter an enclosed area from 20 to 1000 m².</p>}
    <p>Applying replaces the current plan. Undo restores it.</p>
    <div className="trace-actions"><button className="button secondary" onClick={onClose}>Keep current project</button><button className="button primary" disabled={!result} onClick={() => result && onApply(result)}>Apply layout preset</button></div>
  </dialog>
}
