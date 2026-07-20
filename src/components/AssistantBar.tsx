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
        value={assistantText}
        onChange={(event) => setAssistantText(event.target.value)}
        onKeyDown={(event) => event.key === 'Enter' && runQuickAction()}
        placeholder={hint ? `Next: ${hint} — or type brighter / budget / photo` : 'Quick actions: brighter, add room, budget, concept photo…'}
        aria-label="Quick plan actions"
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
