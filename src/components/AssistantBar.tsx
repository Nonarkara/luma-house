import React from 'react'
import { ArrowRight, Send, Sparkles } from 'lucide-react'
import { IconButton } from './ui'

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
  return (
    <div className="assistant-bar">
      <div className="assistant-symbol">
        <Sparkles />
      </div>
      <input
        type="text"
        value={assistantText}
        onChange={(event) => setAssistantText(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && runQuickAction()}
        placeholder="Quick action: brighter, budget, photo…"
        id="quick-action"
        aria-label="Quick plan actions"
        title={hint ? `Suggested next step: ${hint}` : undefined}
      />
      {cta && onCta && (
        <button type="button" className="button primary small assistant-cta" onClick={onCta}>
          {cta} <ArrowRight />
        </button>
      )}
      <IconButton label="Run quick action" onClick={runQuickAction}>
        <Send />
      </IconButton>
    </div>
  )
})
