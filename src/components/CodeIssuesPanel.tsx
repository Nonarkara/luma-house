import React from 'react'
import { useI18n } from '../i18n'
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

const SEVERITY_SHORT: Record<CodeIssue['severity'], string> = {
  critical: 'CRIT',
  warning: 'WARN',
  info: 'INFO',
}

const SEVERITY_LABEL: Record<CodeIssue['severity'], string> = {
  critical: 'Critical',
  warning: 'Warning',
  info: 'Info',
}

function ruleLabel(ref: string): string {
  switch (ref) {
    case 'MODEL-EGRESS': return 'Modeled route outdoors'
    case 'MODEL-ENVELOPE': return 'Modeled envelope'
    case 'MODEL-VENTILATION': return 'Modeled air path'
    case 'ASHRAE-62.2-WHOLE-DWELLING': return 'Whole-dwelling ventilation'
    case 'ASHRAE-62.2-KITCHEN': return 'Kitchen exhaust'
    case 'ASHRAE-62.2-BATHROOM': return 'Bathroom exhaust'
    case 'ADA-404.2.3': return 'Accessible door'
    case 'IBC-1010.1.1': return 'Door size rule'
    case 'ADA-304.3': return 'Turning space'
    case 'IRC-2021-R304.1':
    case 'IRC-2021-R304.2':
    case 'IRC-2021-R305.1':
      return 'Residential room rule'
    default:
      return ref
  }
}

/**
 * The building-standards code-check list. Each row carries a standards
 * reference ("2021 IRC R305.1"), a one-line title, a one-sentence body with the
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
  const { tr } = useI18n()
  if (issues.length === 0) {
    return (
      <div className="code-issues-empty">{tr('No code issues detected.')}</div>
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
        <span>{tr(`${counts.critical + counts.warning + counts.info} findings`)}</span>
        <span className="code-issues-summary-counts">
          <span className="count-critical">{tr(`${counts.critical} critical`)}</span>
          <span className="count-warning">{tr(`${counts.warning} warn`)}</span>
          <span className="count-info">{tr(`${counts.info} info`)}</span>
        </span>
      </div>
      {sorted.map((issue, index) => {
        const roomName = roomNameById(issue.roomId)
        return (
          <div key={`${issue.ref}-${issue.roomId ?? ''}-${issue.openingId ?? ''}-${index}`} className="code-issue-row">
            <div className="code-issue-ref">
              <span
                className={`standards-badge is-${issue.severity}`}
                title={`${issue.ref} — ${issue.name}`}
              >
                {tr(ruleLabel(issue.ref))}
              </span>
              <span className="code-issue-sev" title={SEVERITY_SHORT[issue.severity]}>{tr(SEVERITY_LABEL[issue.severity])}</span>
            </div>
            <div className="code-issue-body-block">
              <div className="code-issue-title">
                {tr(issue.title)}
                {roomName && <span className="code-issue-room"> · {tr(roomName)}</span>}
              </div>
              <p className="code-issue-body">{tr(issue.body)}</p>
              {issue.fixAction && onApply && (
                <button
                  type="button"
                  className="code-issue-fix"
                  onClick={() => onApply(issue)}
                >
                  {tr(fixLabel(issue.fixAction))}
                </button>
              )}
            </div>
          </div>
        )
      })}
      {counts.critical === 0 && counts.warning === 0 && (
        <div className="code-issues-summary" style={{ paddingTop: 8 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: 'var(--success)' }}>
            {tr('All hard rules pass')}
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
      return 'Add exterior door'
  }
}