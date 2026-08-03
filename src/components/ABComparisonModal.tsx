import { ArrowDownRight, ArrowUpRight, Check, Pin, X } from 'lucide-react'
import type { ABComparisonResult } from '../analysis/abComparison'

export function ABComparisonModal({
  result,
  baselineName,
  proposedName,
  onClose,
  onApplyProposedAsBaseline,
}: {
  result: ABComparisonResult
  baselineName: string
  proposedName: string
  onClose: () => void
  onApplyProposedAsBaseline?: () => void
}) {
  const formatDelta = (val: number, unit: string, invertIsGood = false) => {
    if (Math.abs(val) < 0.01) return <span className="delta-neutral">No change</span>
    const isIncrease = val > 0
    const isGood = invertIsGood ? !isIncrease : isIncrease
    const sign = isIncrease ? '+' : ''
    const Icon = isIncrease ? ArrowUpRight : ArrowDownRight

    return (
      <span className={`delta-tag ${isGood ? 'good' : 'warn'}`}>
        <Icon className="w-3.5 h-3.5" />
        {sign}{val.toFixed(1)} {unit}
      </span>
    )
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="ab-modal shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="ab-modal-header">
          <div className="flex items-center gap-2">
            <Pin className="w-5 h-5 text-amber-400" />
            <div>
              <h2>Side-by-Side Design Comparison</h2>
              <p>Compare baseline sketch ("Plan A") against active proposed modifications ("Plan B").</p>
            </div>
          </div>
          <button type="button" className="icon-btn-close" onClick={onClose} aria-label="Close modal">
            <X className="w-5 h-5" />
          </button>
        </div>

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
                <td>Daylight Coverage</td>
                <td>{result.baseline.daylightCoveragePct.toFixed(0)}%</td>
                <td>{result.proposed.daylightCoveragePct.toFixed(0)}%</td>
                <td>{formatDelta(result.delta.daylightCoveragePct, '%')}</td>
              </tr>
              <tr>
                <td>Net Thermal Load</td>
                <td>{Math.round(result.baseline.netHeatWatts)} W</td>
                <td>{Math.round(result.proposed.netHeatWatts)} W</td>
                <td>{formatDelta(result.delta.netHeatWatts, 'W', true)}</td>
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
            💡 <em>Plan A is pinned as your baseline. Modifying rooms, openings, or systems updates Plan B live.</em>
          </div>
          <div className="ab-footer-actions">
            {onApplyProposedAsBaseline && (
              <button
                type="button"
                className="button primary small"
                onClick={onApplyProposedAsBaseline}
              >
                <Check className="w-3.5 h-3.5" />
                Pin Plan B as New Baseline
              </button>
            )}
            <button type="button" className="button secondary small" onClick={onClose}>
              Close Comparison
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
