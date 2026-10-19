import React from 'react'
import { useI18n } from '../i18n'

interface AssistantBarProps {
  assistantText: string
  setAssistantText: (text: string) => void
  runQuickAction: () => void
  hint?: string
  /** The single coaching CTA (folded in from the removed JourneyCoach banner). */
  cta?: string
  onCta?: () => void
}

export const AssistantBar = React.memo(function AssistantBar({
  assistantText,
  setAssistantText,
  runQuickAction,
  hint,
  cta,
  onCta,
}: AssistantBarProps) {
  const { tr } = useI18n()
  return (
    <div className="assistant-bar">
      <input
        type="text"
        value={assistantText}
        onChange={(event) => setAssistantText(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && runQuickAction()}
        placeholder={tr('Quick action: brighter, budget, photo…')}
        id="quick-action"
        aria-label={tr('Quick plan actions')}
        title={hint ? `${tr('Suggested next step:')} ${tr(hint)}` : undefined}
      />
      {cta && onCta && (
        <button type="button" className="button primary small assistant-cta" onClick={onCta}>
          {tr(cta)}
        </button>
      )}
      <button type="button" className="button secondary" aria-label={tr('Run quick action')} onClick={runQuickAction}>
        {tr('Run quick action')}
      </button>
    </div>
  )
})
