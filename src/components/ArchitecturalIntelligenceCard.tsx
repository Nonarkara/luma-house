import { AlertCircle, CheckCircle2, ShieldCheck, Wrench, Volume2, SunMedium } from 'lucide-react'
import type { ArchitecturalCodeReport, CodeIssue } from '../analysis'

interface ArchitecturalIntelligenceCardProps {
  report: ArchitecturalCodeReport
  onAutoFix?: (issue: CodeIssue) => void
}

export const ArchitecturalIntelligenceCard: React.FC<ArchitecturalIntelligenceCardProps> = ({ report, onAutoFix }) => {
  const { summary, issues, overallStatus } = report

  const statusBadge =
    overallStatus === 'COMPLIANT'
      ? { label: 'Code Compliant (IRC/IBC)', color: 'var(--accent-emerald, #10b981)', icon: CheckCircle2 }
      : overallStatus === 'NEEDS_ATTENTION'
        ? { label: 'Architectural Advisory', color: 'var(--accent-amber, #f59e0b)', icon: AlertCircle }
        : { label: 'Code Non-Compliant', color: 'var(--accent-rose, #ef4444)', icon: AlertCircle }

  const StatusIcon = statusBadge.icon

  return (
    <section className="panel-section architectural-intelligence-card" style={{ background: 'rgba(255, 255, 255, 0.03)', borderRadius: 8, padding: 12, marginBottom: 16 }}>
      <div className="section-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <ShieldCheck style={{ width: 18, height: 18, color: statusBadge.color }} />
          <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Architectural & Code Intelligence</h3>
        </div>
        <span
          className="badge"
          style={{
            background: `${statusBadge.color}22`,
            color: statusBadge.color,
            border: `1px solid ${statusBadge.color}55`,
            fontSize: '0.75rem',
            padding: '2px 8px',
            borderRadius: 12,
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}
        >
          <StatusIcon style={{ width: 12, height: 12 }} />
          {statusBadge.label}
        </span>
      </div>

      <p className="section-intro" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
        Real-time building science & residential code compliance engine (IRC R305 ceiling clearance, R310 egress, R303 glazing, IBC structural lintels & STC sound isolation).
      </p>

      {/* Metrics Grid */}
      <div className="code-metrics-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 12 }}>
        <div className="metric-box" style={{ background: 'rgba(0, 0, 0, 0.15)', padding: 8, borderRadius: 6 }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Ceiling Headroom</span>
          <strong style={{ fontSize: '0.9rem', color: summary.ceilingHeightStatus === 'PASS' ? 'var(--text-primary)' : 'var(--accent-amber)' }}>
            {summary.averageCeilingM.toFixed(2)} m
          </strong>
          <small style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>min 2.50m (IRC R305)</small>
        </div>

        <div className="metric-box" style={{ background: 'rgba(0, 0, 0, 0.15)', padding: 8, borderRadius: 6 }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}>Bedroom Egress</span>
          <strong style={{ fontSize: '0.9rem', color: summary.egressStatus === 'PASS' ? 'var(--text-primary)' : 'var(--accent-rose)' }}>
            {summary.sleepingRoomsEgressCount}/{summary.totalSleepingRooms} Ready
          </strong>
          <small style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>min 0.35m² (IRC R310)</small>
        </div>

        <div className="metric-box" style={{ background: 'rgba(0, 0, 0, 0.15)', padding: 8, borderRadius: 6 }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}><SunMedium style={{ width: 10, height: 10, display: 'inline', marginRight: 2 }} />Glazing Ratio</span>
          <strong style={{ fontSize: '0.9rem', color: summary.glazingRatioStatus === 'PASS' ? 'var(--text-primary)' : 'var(--accent-amber)' }}>
            {summary.glazingToFloorPct.toFixed(1)}% Floor Area
          </strong>
          <small style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>min 8% (IRC R303.1)</small>
        </div>

        <div className="metric-box" style={{ background: 'rgba(0, 0, 0, 0.15)', padding: 8, borderRadius: 6 }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', display: 'block' }}><Volume2 style={{ width: 10, height: 10, display: 'inline', marginRight: 2 }} />Acoustics (STC)</span>
          <strong style={{ fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            STC {summary.acousticSTCRating} ({summary.acousticRatingStatus})
          </strong>
          <small style={{ display: 'block', fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>partition rating</small>
        </div>
      </div>

      {/* Issues & Auto-Fix Actions */}
      {issues.length > 0 ? (
        <div className="code-issues-list" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {issues.map((issue) => (
            <div
              key={issue.id}
              className="code-issue-row"
              style={{
                background: issue.severity === 'error' ? 'rgba(239, 68, 68, 0.08)' : 'rgba(245, 158, 11, 0.08)',
                borderLeft: `3px solid ${issue.severity === 'error' ? '#ef4444' : '#f59e0b'}`,
                padding: '6px 10px',
                borderRadius: '0 4px 4px 0',
                fontSize: '0.78rem',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{issue.title}</span>
                <span style={{ fontSize: '0.65rem', background: 'rgba(255,255,255,0.1)', padding: '1px 4px', borderRadius: 3 }}>
                  {issue.codeReference}
                </span>
              </div>
              <p style={{ margin: 0, fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{issue.detail}</p>

              {issue.autoFixAvailable && onAutoFix && (
                <button
                  type="button"
                  className="button secondary small"
                  style={{ marginTop: 6, fontSize: '0.7rem', padding: '2px 8px', height: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  onClick={() => onAutoFix(issue)}
                >
                  <Wrench style={{ width: 10, height: 10 }} /> 1-Click Code Auto-Fix
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '8px 0', color: 'var(--accent-emerald)', fontSize: '0.8rem' }}>
          <CheckCircle2 style={{ width: 16, height: 16, display: 'inline', marginRight: 4 }} />
          All architectural code & engineering checks passed!
        </div>
      )}
    </section>
  )
}
