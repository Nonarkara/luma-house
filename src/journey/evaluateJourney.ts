import {
  STAGES,
  stageFromVisit,
  type CoachCopy,
  type JourneyContext,
  type JourneyStageId,
  type StageDef,
} from './stages'

export type StageStatus = 'done' | 'current' | 'next' | 'later'

export interface EvaluatedStage {
  def: StageDef
  status: StageStatus
  complete: boolean
  metric: string
}

export interface JourneyEvaluation {
  stages: EvaluatedStage[]
  currentId: JourneyStageId
  nextId: JourneyStageId
  progress: number
  doneCount: number
  coach: CoachCopy
  headline: string
}

export function evaluateJourney(ctx: JourneyContext): JourneyEvaluation {
  const currentId = stageFromVisit(ctx.mode, ctx.view)
  const completeness = STAGES.map((def) => ({ def, complete: def.isComplete(ctx) }))
  const firstIncomplete = completeness.find((item) => !item.complete)?.def.id ?? 'picture'
  const nextId = firstIncomplete

  const stages: EvaluatedStage[] = STAGES.map((def) => {
    const complete = def.isComplete(ctx)
    let status: StageStatus = 'later'
    if (complete) status = 'done'
    else if (def.id === currentId) status = 'current'
    else if (def.id === nextId) status = 'next'
    return {
      def,
      status,
      complete,
      metric: def.metric(ctx),
    }
  })

  // Prefer coach for the recommended next incomplete stage — unless user is
  // actively working a later stage, then coach that stage (respect autonomy).
  const coachStage =
    STAGES.find((s) => s.id === currentId && !s.isComplete(ctx)) ??
    STAGES.find((s) => s.id === nextId) ??
    STAGES[STAGES.length - 1]

  const doneCount = completeness.filter((item) => item.complete).length
  const progress = doneCount / STAGES.length

  const headline =
    doneCount === 0
      ? 'Start with a mark on the napkin'
      : doneCount === STAGES.length
        ? 'Walkthrough complete — refine or share'
        : `${doneCount} of ${STAGES.length} decisions made`

  return {
    stages,
    currentId,
    nextId,
    progress,
    doneCount,
    coach: coachStage.coach(ctx),
    headline,
  }
}
