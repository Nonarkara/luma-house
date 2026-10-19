import type { ABComparisonResult } from '../analysis/abComparison'
import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { PlanState } from '../types'
import type { StudioTheme } from '../design/themes'
import { VisualComparison } from '../comparison/VisualComparison'
import { RoomComparison } from '../comparison/RoomComparison'

export function ABComparisonModal({
  result,
  baselineName,
  proposedName,
  onClose,
  onApplyProposedAsBaseline,
  baselinePlan, proposedPlan, theme, onRestoreBaseline,
}: {
  result: ABComparisonResult
  baselineName: string
  proposedName: string
  onClose: () => void
  onApplyProposedAsBaseline?: () => void
  baselinePlan?: PlanState
  proposedPlan?: PlanState
  theme?: StudioTheme
  onRestoreBaseline?: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
    const current = dialog.current
    return () => current?.close()
  }, [])
  const formatDelta = (val: number, unit: string, invertIsGood = false, grade = true) => {
    if (Math.abs(val) < 0.01) return <span className="delta-neutral">No change</span>
    if (!grade) return <span className="delta-neutral">{val > 0 ? '+' : ''}{val.toFixed(1)} {unit}</span>
    const isIncrease = val > 0
    const isGood = invertIsGood ? !isIncrease : isIncrease
    const sign = isIncrease ? '+' : ''
    return (
      <span className={`delta-tag ${isGood ? 'good' : 'warn'}`}>
        {sign}{val.toFixed(1)} {unit}
      </span>
    )
  }

  const content = (
    <dialog ref={dialog} className="ab-modal" aria-labelledby="ab-comparison-title" onKeyDown={e => e.stopPropagation()} onCancel={e => { e.preventDefault(); onClose() }}>
        <div className="ab-modal-header">
          <div className="flex items-center gap-2">
            
            <div>
              <h2 id="ab-comparison-title">Side-by-Side Design Comparison</h2>
              <p>Compare baseline sketch ("Plan A") against active proposed modifications ("Plan B").</p>
            </div>
          </div>
          <button type="button" className="icon-btn-close" onClick={onClose} aria-label="Close modal">
            
          </button>
        </div>

        <p className="ab-comparison-context"><strong>Shared conditions: {result.context.label}</strong><br />
          Sun {result.context.sunAzimuth.toFixed(0)}° azimuth / {result.context.sunAltitude.toFixed(0)}° altitude · outside {result.context.outsideC}°C · wind from {result.context.windFrom}° at {result.context.windSpeed} m/s.
          {' '}Clear-sky sun; temperature and wind are selected assumptions, not live weather. Daylight reach uses window geometry only. Budget uses the China concept rate card, not local supplier prices.
          {' '}Positive heat flow enters the interior; negative heat flow leaves it. The thermal difference has no better/worse colour grade.
        </p>
        {baselinePlan && proposedPlan && theme && <>
          <VisualComparison baseline={baselinePlan} proposed={proposedPlan} theme={theme} sunAzimuth={result.context.sunAzimuth} sunAltitude={result.context.sunAltitude} />
          <RoomComparison baseline={baselinePlan} proposed={proposedPlan} />
        </>}
        <div className="ab-table-wrapper">
          <table className="ab-table">
            <thead>
              <tr>
                <th>Decision Metric</th>
                <th>
                  <div className="ab-col-head">
                    <span className="badge-plan-a">Plan A</span>
                    <strong>{baselineName}</strong>
                  </div>
                </th>
                <th>
                  <div className="ab-col-head">
                    <span className="badge-plan-b">Plan B</span>
                    <strong>{proposedName}</strong>
                  </div>
                </th>
                <th>Net Variance (Δ)</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Floor Area</td>
                <td>{result.baseline.areaM2.toFixed(1)} m²</td>
                <td>{result.proposed.areaM2.toFixed(1)} m²</td>
                <td>{formatDelta(result.delta.areaM2, 'm²')}</td>
              </tr>
              <tr>
                <td>Estimated BOQ Budget</td>
                <td>¥{Math.round(result.baseline.totalCost).toLocaleString()}</td>
                <td>¥{Math.round(result.proposed.totalCost).toLocaleString()}</td>
                <td>{formatDelta(result.delta.totalCost, '¥', true)}</td>
              </tr>
              <tr>
                <td>Embodied Carbon</td>
                <td>{Math.round(result.baseline.carbonKg)} kg CO₂e</td>
                <td>{Math.round(result.proposed.carbonKg)} kg CO₂e</td>
                <td>{formatDelta(result.delta.carbonKg, 'kg', true)}</td>
              </tr>
              <tr>
                <td>Window Daylight Reach (rule of thumb)</td>
                <td>{result.baseline.daylightCoveragePct.toFixed(0)}%</td>
                <td>{result.proposed.daylightCoveragePct.toFixed(0)}%</td>
                <td>{formatDelta(result.delta.daylightCoveragePct, '%')}</td>
              </tr>
              <tr>
                <td>Net Heat Flow (signed)</td>
                <td>{Math.round(result.baseline.netHeatWatts)} W</td>
                <td>{Math.round(result.proposed.netHeatWatts)} W</td>
                <td>{formatDelta(result.delta.netHeatWatts, 'W', false, false)}</td>
              </tr>
              <tr>
                <td>Avg Room Air Exchange</td>
                <td>{result.baseline.avgAch.toFixed(1)} ACH</td>
                <td>{result.proposed.avgAch.toFixed(1)} ACH</td>
                <td>{formatDelta(result.delta.avgAch, 'ACH')}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="ab-modal-footer">
          <div className="ab-footer-note">
            <em>Plan A is saved in this project, including shared links and JSON exports. Modifying the drawing updates Plan B. Restore is undoable.</em>
          </div>
          <div className="ab-footer-actions">
            {onRestoreBaseline && <button type="button" className="button secondary small" onClick={onRestoreBaseline}>Restore Plan A</button>}
            {onApplyProposedAsBaseline && (
              <button
                type="button"
                className="button primary small"
                onClick={onApplyProposedAsBaseline}
              >
                
                Pin Plan B as New Baseline
              </button>
            )}
            <button type="button" className="button secondary small" onClick={onClose}>
              Close Comparison
            </button>
          </div>
        </div>
    </dialog>
  )
  return typeof document === 'undefined' ? content : createPortal(content, document.body)
}
