import type { ABComparisonState, PlanState } from '../types'

type PlanSnapshot = Omit<PlanState, 'comparison'>

/** Pin metadata without changing any physical geometry or nesting earlier baselines. */
export function pinBaseline(plan: PlanState, baselineName = 'Pinned Baseline (Plan A)', pinnedAt = new Date().toISOString()): PlanState {
  const baselinePlan = { ...plan }
  delete baselinePlan.comparison
  return { ...plan, comparison: { baselinePlan, baselineName, pinnedAt } }
}

/** Restoring a drawing keeps its comparison available; the caller records one undo step. */
export function restoreBaseline(plan: PlanState): PlanState {
  return plan.comparison ? { ...plan.comparison.baselinePlan, comparison: plan.comparison } : plan
}

/** The supplied content sanitizer ignores comparison fields, so nesting is never traversed. */
export function sanitizeBaseline(raw: unknown, sanitizeSnapshot: (raw: unknown) => PlanSnapshot | null): ABComparisonState | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const candidate = raw as Record<string, unknown>
  if (typeof candidate.baselineName !== 'string' || !candidate.baselineName.trim() || candidate.baselineName.length > 64
    || typeof candidate.pinnedAt !== 'string' || candidate.pinnedAt.length > 32 || !Number.isFinite(Date.parse(candidate.pinnedAt))) return undefined
  const baselinePlan = sanitizeSnapshot(candidate.baselinePlan)
  if (!baselinePlan) return undefined
  return { baselinePlan, baselineName: candidate.baselineName.trim(), pinnedAt: candidate.pinnedAt }
}
