import React from 'react'
import { Send, Sparkles } from 'lucide-react'
import { IconButton } from './ui'

interface AssistantBarProps {
  assistantText: string
  setAssistantText: (text: string) => void
  runQuickAction: () => void
}

export const AssistantBar = React.memo(function AssistantBar({
  assistantText,
  setAssistantText,
  runQuickAction,
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
        placeholder="Quick actions: brighter, add room, budget, concept photo…"
        aria-label="Quick plan actions"
      />
      <span className="assistant-example">Keyword shortcuts — not a live model</span>
      <IconButton label="Run quick action" onClick={runQuickAction}>
        <Send />
      </IconButton>
    </div>
  )
})
