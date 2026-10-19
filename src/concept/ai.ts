/**
 * AI calls stay off unless a build sets VITE_AI_ENABLED=true.
 * The default is no request, so a paused service cannot spend a model key.
 * Read at call time so a test can cover the network path without turning the
 * shipped build on.
 */
export function aiEnabled(): boolean {
  return import.meta.env.VITE_AI_ENABLED === 'true'
}

export const AI_ENABLED = aiEnabled()

export const AI_PAUSED_MESSAGE = 'AI tracing and concept photos are paused. Upload the plan as an underlay and draw over it. Nothing is sent to a model.'
