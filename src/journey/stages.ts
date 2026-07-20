import type { CanvasView, PlanState, PlanTool, WorkspaceMode } from '../types'

/**
 * Behavioral design journey for Luma House.
 *
 * Principles in play (not decoration — they shape the sequence):
 * 1. Endowment / IKEA effect — drawing first makes the plan “yours”
 * 2. Curiosity gap — 3D reveal after a tangible sketch
 * 3. Construal level — sun as a concrete patch, not an abstract climate score
 * 4. Checklist completion bias — living-logic checks feel finishable
 * 5. Loss aversion — systems framed as what you lose without them
 * 6. Anchoring + peak-end — BOQ then interiors close the arc
 * 7. One decision at a time — coach never offers a menu of equals
 */

export type JourneyStageId =
  | 'draw'
  | 'model'
  | 'sun'
  | 'living'
  | 'systems'
  | 'cost'
  | 'picture'

export interface JourneyVisit {
  mode: WorkspaceMode
  view: CanvasView
}

export interface JourneyContext {
  plan: PlanState
  areaM2: number
  hasConcept: boolean
  visited: Set<JourneyStageId>
  mode: WorkspaceMode
  view: CanvasView
}

export interface StageNav {
  mode?: WorkspaceMode
  view?: CanvasView
  tool?: PlanTool
  inspector?: boolean
}

export interface CoachCopy {
  title: string
  body: string
  cta: string
  /** Short why — shown as microcopy, not a lecture */
  why: string
  nav: StageNav
}

export interface StageDef {
  id: JourneyStageId
  step: string
  label: string
  principle: string
  metric: (ctx: JourneyContext) => string
  isComplete: (ctx: JourneyContext) => boolean
  coach: (ctx: JourneyContext) => CoachCopy
  nav: StageNav
}

export const JOURNEY_STORAGE_KEY = 'luma-journey:shanghai-50'
export const WELCOME_STORAGE_KEY = 'luma-journey:welcome:shanghai-50'

export const STAGES: StageDef[] = [
  {
    id: 'draw',
    step: '01',
    label: 'Draw',
    principle: 'endowment',
    nav: { mode: 'plan', view: 'plan', tool: 'draw', inspector: true },
    metric: (ctx) =>
      ctx.plan.rooms.length === 0
        ? 'Start here'
        : `${ctx.areaM2.toFixed(0)} m² · ${ctx.plan.rooms.length} room${ctx.plan.rooms.length === 1 ? '' : 's'}`,
    isComplete: (ctx) => ctx.plan.rooms.length >= 1,
    coach: (ctx) =>
      ctx.plan.rooms.length === 0
        ? {
            title: 'Make the first mark',
            body: 'Sketch one room. Once it’s yours, every later choice gets easier — people defend what they drew.',
            cta: 'Draw a room',
            why: 'IKEA effect · ownership first',
            nav: { mode: 'plan', view: 'plan', tool: 'draw', inspector: true },
          }
        : {
            title: 'Plan is live',
            body: `You have ${ctx.plan.rooms.length} room${ctx.plan.rooms.length === 1 ? '' : 's'}. Next: see the volumes — the brain trusts space it can orbit.`,
            cta: 'Open 3D model',
            why: 'Curiosity gap · reveal the form',
            nav: { mode: 'plan', view: 'spatial', inspector: true },
          },
  },
  {
    id: 'model',
    step: '02',
    label: '3D',
    principle: 'curiosity',
    nav: { mode: 'plan', view: 'spatial', inspector: true },
    metric: (ctx) => `${ctx.plan.rooms.length} volume${ctx.plan.rooms.length === 1 ? '' : 's'}`,
    isComplete: (ctx) => ctx.visited.has('model') && ctx.plan.rooms.length >= 1,
    coach: () => ({
      title: 'Orbit what you drew',
      body: 'Drag the model. If a room feels wrong in 3D, fix it in plan — the loop is the product.',
      cta: 'Check winter sun next',
      why: 'Feedback loop · see before you specify',
      nav: { mode: 'light', view: 'spatial', inspector: true },
    }),
  },
  {
    id: 'sun',
    step: '03',
    label: 'Sun',
    principle: 'construal',
    nav: { mode: 'light', view: 'spatial', inspector: true },
    metric: (ctx) => {
      const windows = ctx.plan.openings.filter((o) => o.type === 'window').length
      return windows === 0 ? 'No windows yet' : `${windows} window${windows === 1 ? '' : 's'}`
    },
    isComplete: (ctx) =>
      ctx.visited.has('sun') && ctx.plan.openings.some((o) => o.type === 'window'),
    coach: (ctx) => {
      const windows = ctx.plan.openings.filter((o) => o.type === 'window').length
      if (windows === 0) {
        return {
          title: 'Light needs an opening',
          body: 'Place one south-facing window. Without it, sun studies stay abstract — and abstract advice is easy to ignore.',
          cta: 'Place a window',
          why: 'Construal · make light tangible',
          nav: { mode: 'plan', view: 'plan', tool: 'window', inspector: true },
        }
      }
      return {
        title: 'Read the sun, then decide',
        body: 'Scrub the hour. Notice which rooms stay dark. Those are the rooms that will fight you later.',
        cta: 'Run living checks',
        why: 'Loss aversion · dark rooms cost comfort',
        nav: { mode: 'wellbeing', view: 'plan', inspector: true },
      }
    },
  },
  {
    id: 'living',
    step: '04',
    label: 'Living',
    principle: 'checklist',
    nav: { mode: 'wellbeing', view: 'plan', inspector: true },
    metric: () => '10 checks',
    // A visit only "locks" the stage when there is a real plan to check —
    // otherwise the rail claims progress while the canvas is still empty.
    isComplete: (ctx) => ctx.visited.has('living') && ctx.plan.rooms.length >= 1,
    coach: () => ({
      title: 'Finish the living checklist',
      body: 'Tick what already works. Incomplete checks are not guilt — they are the next cheap move before you buy systems.',
      cta: 'Open systems',
      why: 'Zeigarnik · open loops pull attention',
      nav: { mode: 'systems', view: 'plan', inspector: true },
    }),
  },
  {
    id: 'systems',
    step: '05',
    label: 'Systems',
    principle: 'loss-aversion',
    nav: { mode: 'systems', view: 'plan', inspector: true },
    metric: (ctx) => {
      const on = Object.values(ctx.plan.systems).filter(Boolean).length
      return on === 0 ? 'None selected' : `${on} of 4 on`
    },
    isComplete: (ctx) =>
      ctx.visited.has('systems') && Object.values(ctx.plan.systems).some(Boolean),
    coach: (ctx) => {
      const on = Object.values(ctx.plan.systems).filter(Boolean).length
      if (on === 0) {
        return {
          title: 'Buy fewer machines later',
          body: 'Turn on insulation first. Skipping the shell is how people overspend on climate equipment they could have avoided.',
          cta: 'Review systems',
          why: 'Loss aversion · avoid the expensive path',
          nav: { mode: 'systems', view: 'plan', inspector: true },
        }
      }
      return {
        title: 'Lock a cost picture',
        body: 'Systems are on. See the BOQ while the decisions are still fresh — delay makes numbers feel like someone else’s problem.',
        cta: 'Open cost BOQ',
        why: 'Peak · price while intent is hot',
        nav: { mode: 'budget', view: 'plan', inspector: true },
      }
    },
  },
  {
    id: 'cost',
    step: '06',
    label: 'Cost',
    principle: 'anchoring',
    nav: { mode: 'budget', view: 'plan', inspector: true },
    metric: (ctx) => `${ctx.areaM2.toFixed(0)} m² BOQ`,
    isComplete: (ctx) => ctx.visited.has('cost') && ctx.plan.rooms.length >= 1,
    coach: () => ({
      title: 'Anchor the number, then dream',
      body: 'Scan the BOQ once. Then open interiors — people remember the last beautiful frame more than the middle spreadsheet.',
      cta: 'See interiors',
      why: 'Peak-end rule · finish on feeling',
      nav: { view: 'renders', inspector: false },
    }),
  },
  {
    id: 'picture',
    step: '07',
    label: 'Picture',
    principle: 'peak-end',
    nav: { view: 'renders', inspector: false },
    metric: (ctx) => (ctx.hasConcept ? 'Concept ready' : '5 views'),
    isComplete: (ctx) => ctx.visited.has('picture') || ctx.hasConcept,
    coach: () => ({
      title: 'Close on a picture you can share',
      body: 'Pick a view or generate a concept photo. The walkthrough ends when you can show someone else what you decided.',
      cta: 'Back to plan',
      why: 'Social proof · design that can be shown',
      nav: { mode: 'plan', view: 'plan', inspector: true },
    }),
  },
]

export function stageFromVisit(mode: WorkspaceMode, view: CanvasView): JourneyStageId {
  if (view === 'renders') return 'picture'
  if (view === 'spatial' && mode === 'plan') return 'model'
  if (mode === 'light') return 'sun'
  if (mode === 'wellbeing' || mode === 'climate') return 'living'
  if (mode === 'systems') return 'systems'
  if (mode === 'budget') return 'cost'
  return 'draw'
}

export function readVisited(): Set<JourneyStageId> {
  try {
    const raw = localStorage.getItem(JOURNEY_STORAGE_KEY)
    if (!raw) return new Set()
    const parsed = JSON.parse(raw) as JourneyStageId[]
    return new Set(parsed.filter((id) => STAGES.some((s) => s.id === id)))
  } catch {
    return new Set()
  }
}

export function writeVisited(visited: Set<JourneyStageId>): void {
  localStorage.setItem(JOURNEY_STORAGE_KEY, JSON.stringify([...visited]))
}

export function readWelcomeDismissed(): boolean {
  try {
    return localStorage.getItem(WELCOME_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeWelcomeDismissed(): void {
  localStorage.setItem(WELCOME_STORAGE_KEY, '1')
}
