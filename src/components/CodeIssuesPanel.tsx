import React from 'react'
import { ArrowRight, Check } from 'lucide-react'
import type { CodeIssue } from '../codes/checkPlan'
import type { Room } from '../types'

export interface CodeIssuesPanelProps {
  issues: CodeIssue[]
  rooms?: Room[]
  onApply?: (issue: CodeIssue) => void
}

const SEVERITY_ORDER: Record<CodeIssue['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

const SEVERITY_LABEL: Record<CodeIssue['severity'], string> = {
  critical: 'CRIT',
  warning: 'WARN',
  info: 'INFO',
}

/**
 * The building-standards code-check list. Each row carries a standards
 * reference ("IBC 1208.2"), a one-line title, a one-sentence body with the
 * actual measured value, and a one-click fix button when applicable.
 *
 * Per Axiom Design Core: sharp edges, monospace numbers, single accent
 * reserved for the fix action. No glass, no shadows, no gradients.
 */
export const CodeIssuesPanel: React.FC<CodeIssuesPanelProps> = ({
  issues,
  rooms = [],
  onApply,
}) => {
  if (issues.length === 0) {
    return (
      <div className="code-issues-empty">No code issues detected.</div>
    )
  }
  const sorted = [...issues].sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity],
  )
  const counts = sorted.reduce(
    (acc, issue) => {
      acc[issue.severity] += 1
      return acc
    },
    { critical: 0, warning: 0, info: 0 },
  )
  const roomNameById = (id: string | null): string | null => {
    if (!id) return null
    return rooms.find((room) => room.id === id)?.name ?? null
  }
  return (
    <div className="code-issues-panel">
      <div className="code-issues-summary">
        <span>{sorted.length} checked</span>
        <span className="code-issues-summary-counts">
          <span className="count-critical">{counts.critical} critical</span>
          <span className="count-warning">{counts.warning} warn</span>
          <span className="count-info">{counts.info} info</span>
        </span>
      </div>
      {sorted.map((issue, index) => {
        const refShort = issue.ref.replace(/^IBC-/, 'IBC ').replace(/^ASHRAE-/, 'ASHRAE ').replace(/^ADA-/, 'ADA ').replace(/^ISO-/, 'ISO ')
        const refDisplay = refShort.replace(/IBC /, 'IBC ')
        const roomName = roomNameById(issue.roomId)
        const openingRoomName = issue.openingId ? null : null
        return (
          <div key={`${issue.ref}-${issue.roomId ?? ''}-${issue.openingId ?? ''}-${index}`} className="code-issue-row">
            <div className="code-issue-ref">
              <span
                className={`standards-badge is-${issue.severity}`}
                title={issue.name}
              >
                {refDisplay}
              </span>
              <span className="code-issue-sev">{SEVERITY_LABEL[issue.severity]}</span>
            </div>
            <div className="code-issue-body-block">
              <div className="code-issue-title">
                {issue.title}
                {roomName && <span className="code-issue-room"> · {roomName}</span>}
                {openingRoomName && <span className="code-issue-room"> · {openingRoomName}</span>}
              </div>
              <p className="code-issue-body">{issue.body}</p>
              {issue.fixAction && onApply && (
                <button
                  type="button"
                  className="code-issue-fix"
                  onClick={() => onApply(issue)}
                >
                  {fixLabel(issue.fixAction)} <ArrowRight className="fix-arrow" />
                </button>
              )}
            </div>
          </div>
        )
      })}
      {counts.critical === 0 && counts.warning === 0 && (
        <div className="code-issues-summary" style={{ paddingTop: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--accent-emerald, #10b981)' }}>
            <Check /> All hard rules pass
          </span>
        </div>
      )}
    </div>
  )
}

function fixLabel(action: NonNullable<CodeIssue['fixAction']>): string {
  switch (action.type) {
    case 'enlarge_opening':
      return 'Widen door'
    case 'set_ceiling':
      return `Raise ceiling to ${action.meters.toFixed(2)} m`
    case 'add_exterior_door':
      return `Add door on ${action.compass} wall`
    case 'add_opening_for_egress':
      return `Add egress opening on ${action.compass}`
  }
}
