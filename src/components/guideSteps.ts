/** The four moves of the system, in order. Shared by the step list and the
 *  numbered callouts in the illustration so a colour always means one thing:
 *
 *    red   = your mark        (the drawing you make)
 *    blue  = the measure      (the dimension you give)
 *    paper = the fit-out      (neutral, linework)
 *    yellow = the light       (the sun you read)
 */
export type GuideTone = 'red' | 'blue' | 'paper' | 'yellow'

export interface GuideStep {
  /** Two-digit index, printed as a Bauhaus number plate. */
  n: string
  tone: GuideTone
  title: string
  body: string
}

export const GUIDE_STEPS: GuideStep[] = [
  {
    n: '01',
    tone: 'red',
    title: 'Draw the space',
    body: 'Pencil a room on the napkin. A line is a wall, a box is a room, a tick on a wall opens a door or a window.',
  },
  {
    n: '02',
    tone: 'blue',
    title: 'Give it a scale',
    body: 'One known length calibrates everything. Type 8.75 m once and every wall, view and sheet shares those metres.',
  },
  {
    n: '03',
    tone: 'paper',
    title: 'Make room for living',
    body: 'Place real-size furniture, then open Spatial to orbit the model and cut a section through it.',
  },
  {
    n: '04',
    tone: 'yellow',
    title: 'Bring in the sun',
    body: 'Choose your city and time. Move the sun across your floor, read the shadows, then check Living, Systems and Cost.',
  },
]

/** Callout plates in the illustration, in the same order as the step list. */
export const GUIDE_CALLOUT_TONES: GuideTone[] = GUIDE_STEPS.map(step => step.tone)
