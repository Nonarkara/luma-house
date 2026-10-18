import { describe, expect, it } from 'vitest'
import {
  blockHeight,
  boxInsideQuad,
  crossSection,
  inkEscapes,
  usableBand,
  charEm,
  lineBox,
  lineWidth,
  placeLabel,
  pointInQuad,
  quadCentre,
  quadExtents,
  textWidth,
  type LabelCandidate,
  type Quad,
} from './labels'

const quad = (x: number, y: number, w: number, h: number): Quad => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
]

const candidate = (over: Partial<LabelCandidate> = {}): LabelCandidate => ({
  id: 'r1',
  lines: [{ text: 'Bed', fontSize: 10 }],
  quad: quad(0, 0, 120, 60),
  align: 'centre',
  pad: 3,
  ...over,
})

describe('text measurement', () => {
  it('orders characters by how wide they actually draw', () => {
    expect(charEm('i')).toBeLessThan(charEm('a'))
    expect(charEm('a')).toBeLessThan(charEm('7'))
    expect(charEm('7')).toBeLessThan(charEm('A'))
    expect(charEm('A')).toBeLessThan(charEm('m'))
  })

  it('grows with the string and with the type size', () => {
    expect(textWidth('Bed', 10)).toBeGreaterThan(textWidth('Be', 10))
    expect(textWidth('Bed', 10)).toBeLessThan(textWidth('Bed', 20))
    expect(textWidth('Bed', 10)).toBeCloseTo(textWidth('Bed', 10), 6)
  })

  it('measures a block by its widest line and its total leading', () => {
    const lines = [{ text: 'Primary', fontSize: 11 }, { text: '12.4 m²', fontSize: 10 }]
    expect(lineWidth(lines)).toBe(textWidth('Primary', 11))
    expect(blockHeight(lines)).toBeCloseTo((11 + 10) * 1.2, 6)
  })

  it('never reports a width for an empty line', () => {
    expect(textWidth('', 11)).toBe(0)
    expect(lineWidth([{ text: '', fontSize: 11 }])).toBe(0)
  })
})

describe('quad geometry', () => {
  it('reads extents and centre off a rhombus as drawn', () => {
    const rhombus: Quad = [[0, 10], [40, 0], [80, 10], [40, 20]]
    expect(quadExtents(rhombus)).toEqual({ minX: 0, minY: 0, maxX: 80, maxY: 20 })
    expect(quadCentre(rhombus)).toEqual({ x: 40, y: 10 })
  })

  it('separates a point inside a face from one outside it', () => {
    const face = quad(10, 10, 100, 40)
    expect(pointInQuad({ x: 60, y: 30 }, face)).toBe(true)
    expect(pointInQuad({ x: 5, y: 30 }, face)).toBe(false)
    expect(pointInQuad({ x: 60, y: 200 }, face)).toBe(false)
  })

  it('agrees with itself on a vertex, where a name centred on a corner would be clipped', () => {
    const face = quad(0, 0, 50, 50)
    expect(pointInQuad({ x: 0, y: 0 }, face)).toBe(pointInQuad({ x: 25, y: 25 }, face))
  })

  it('knows that a diamond narrows, and a rectangle does not', () => {
    const diamond: Quad = [[0, 30], [40, 0], [80, 30], [40, 60]]
    // The same box is inside a rectangle of the same bounds and hangs over the
    // faces of the diamond, because the diamond closes toward its front and back.
    expect(boxInsideQuad(quad(2, 26, 76, 8), diamond)).toBe(false)
    expect(boxInsideQuad(quad(2, 26, 76, 8), quad(0, 20, 80, 40))).toBe(true)
    expect(boxInsideQuad(quad(20, 27, 40, 6), diamond)).toBe(true)
  })

  it('measures the inked rectangle, not the glyph baseline', () => {
    const line = { text: 'Bath', fontSize: 10 }
    const box = lineBox(line, 20, 40)
    // 19.8 px of advance, less a side bearing at each end; cap height 7 px
    // above the baseline, descenders 2 px below it.
    expect(box[0][0]).toBeCloseTo(20.3, 6)
    expect(box[0][1]).toBeCloseTo(33, 6)
    expect(box[2][0]).toBeCloseTo(20 + textWidth('Bath', 10) - 0.3, 6)
    expect(box[3][1]).toBeCloseTo(42, 6)
  })
})

describe('placeLabel', () => {
  it('names a face that has room for the name', () => {
    const result = placeLabel(candidate())
    expect(result.placed).toBe(true)
    expect(result.reason).toBe('placed')
    expect(result.lines).toHaveLength(1)
  })

  it('refuses a name wider than the face, and says so', () => {
    const narrow = placeLabel(candidate({ quad: quad(0, 0, 18, 60) }))
    expect(narrow.placed).toBe(false)
    expect(narrow.reason).toBe('too-narrow')
    expect(narrow.lines).toEqual([])
  })

  it('refuses a face too foreshortened to hold the type', () => {
    const flat = placeLabel(candidate({ quad: quad(0, 0, 120, 11) }))
    expect(flat.placed).toBe(false)
    expect(flat.reason).toBe('too-short')
  })

  it('refuses a face a nearer room has already painted over', () => {
    const covered = placeLabel(candidate({ occluders: [quad(30, 0, 200, 200)] }))
    expect(covered.placed).toBe(false)
    expect(covered.reason).toBe('occluded')
  })

  it('still names a face when the nearer room stands beside it', () => {
    const beside = placeLabel(candidate({ occluders: [quad(300, 0, 200, 200)] }))
    expect(beside.placed).toBe(true)
  })

  it('keeps every placed baseline inside the face it names', () => {
    const faces = [quad(0, 0, 96, 44), quad(12, 8, 140, 26), quad(4, 4, 220, 88)]
    for (const face of faces) {
      const result = placeLabel(candidate({ quad: face, lines: [{ text: 'Kitchen', fontSize: 10 }, { text: '8.1 m²', fontSize: 10 }] }))
      if (!result.placed) continue
      const box = quadExtents(face)
      for (const line of result.lines) {
        expect(line.x).toBeGreaterThanOrEqual(box.minX)
        expect(line.x + textWidth(line.text, line.fontSize)).toBeLessThanOrEqual(box.maxX + 1e-6)
        expect(line.y).toBeGreaterThanOrEqual(box.minY)
        expect(line.y).toBeLessThanOrEqual(box.maxY + 1e-6)
      }
    }
  })

  it('refuses a name that fits the bounding box but overhangs a diamond face', () => {
    // A shallow roof, the shape every axonometric top face takes. The bounding
    // box is 120 x 24, which clears both cheap tests, but the face narrows to
    // nothing at its front and back edges.
    const roof: Quad = [[0, 12], [60, 0], [120, 12], [60, 24]]
    const short = placeLabel(candidate({ lines: [{ text: 'Bed', fontSize: 10 }], quad: roof }))
    const overhanging = placeLabel(candidate({ lines: [{ text: 'Primary bedroom', fontSize: 10 }], quad: roof }))
    expect(short.placed).toBe(true)
    expect(overhanging.placed).toBe(false)
    expect(overhanging.reason).toBe('too-narrow')
  })

  it('places nothing when there is nothing to name', () => {
    const result = placeLabel(candidate({ lines: [] }))
    expect(result.placed).toBe(false)
    expect(result.lines).toEqual([])
  })

  it('reads the width test in the same units the text is drawn in', () => {
    // The shipped defect: the fit guard compared projected model units against
    // SVG font pixels, so a room measured in metres and a room measured in
    // screen pixels looked alike. One face here is 41 px across — wide enough
    // for a short name, far too narrow for the one that spilled.
    const face = quad(0, 0, 41, 24)
    const short = placeLabel(candidate({ id: 'short', lines: [{ text: 'Bed', fontSize: 10 }], quad: face }))
    const spilled = placeLabel(candidate({ id: 'spilled', lines: [{ text: 'Primary bedroom', fontSize: 10 }], quad: face }))
    expect(short.placed).toBe(true)
    expect(spilled.placed).toBe(false)
    expect(spilled.reason).toBe('too-narrow')
  })

  it('clears the same face once it is drawn larger', () => {
    const drawn = placeLabel(candidate({ quad: quad(0, 0, 160, 90), lines: [{ text: 'Primary bedroom', fontSize: 10 }] }))
    expect(drawn.placed).toBe(true)
  })

  it('anchors a start-aligned block at the face it belongs to', () => {
    const result = placeLabel(candidate({ align: 'start', quad: quad(20, 40, 200, 120) }))
    expect(result.placed).toBe(true)
    const box = quadExtents(quad(20, 40, 200, 120))
    expect(result.lines[0].x).toBeCloseTo(box.minX + 3, 6)
  })

  it('slides a name along the face rather than refusing it', () => {
    // The left edge leans in, so the face's midpoint is not the middle of the
    // strip the type occupies. Centred there, "Bedroom" hangs off the edge.
    const face: Quad = [[0, 0], [100, 0], [100, 60], [60, 60]]
    const result = placeLabel(candidate({ lines: [{ text: 'Bedroom', fontSize: 10 }], quad: face, pad: 3 }))
    expect(result.placed).toBe(true)
    expect(result.lines[0].x).toBeGreaterThan(50)
    for (const line of result.lines) expect(boxInsideQuad(lineBox(line, line.x, line.y, 'middle'), face)).toBe(true)
  })

  it('steps the type down when the name will not go at its nominal size', () => {
    const face: Quad = [[0, 0], [34, 0], [34, 40], [0, 40]]
    const nominal = placeLabel(candidate({ lines: [{ text: 'Kitchen', fontSize: 10 }], quad: face }))
    const shrunk = placeLabel(candidate({ lines: [{ text: 'Kitchen', fontSize: 10 }], quad: face, minFontSize: 8 }))
    expect(nominal.placed).toBe(false)
    expect(shrunk.placed).toBe(true)
    expect(shrunk.lines[0].fontSize).toBeLessThan(10)
    expect(shrunk.lines[0].fontSize).toBeGreaterThanOrEqual(8)
  })

  it('refuses a name that no legible size will fit', () => {
    const face = quad(0, 0, 20, 40)
    const result = placeLabel(candidate({ lines: [{ text: 'Kitchen', fontSize: 10 }], quad: face, minFontSize: 8 }))
    expect(result.placed).toBe(false)
    expect(result.reason).toBe('too-narrow')
  })
})

describe('the strip a name has to live in', () => {
  it('cuts a parallelogram to its constant width, not its diagonal extent', () => {
    const face: Quad = [[0, 0], [60, 0], [100, 40], [40, 40]]
    const band = usableBand(face, 14, 30)
    expect(band).not.toBeNull()
    // The face leans right as it descends, so the strip common to every height
    // in the band is narrower than any single cut, and far narrower than the
    // 100 px its diagonal extent would suggest.
    expect(band!.right - band!.left).toBeCloseTo(44, 6)
    expect(quadExtents(face).maxX - quadExtents(face).minX).toBe(100)
  })

  it('has nothing to say outside the face', () => {
    const face = quad(0, 0, 60, 40)
    expect(crossSection(face, -1)).toBeNull()
    expect(crossSection(face, 41)).toBeNull()
    expect(crossSection(face, 20)).toEqual({ left: 0, right: 60 })
  })

  it('still measures the full face when the cut lands on a vertex', () => {
    const diamond: Quad = [[0, 30], [40, 0], [80, 30], [40, 60]]
    // Level with the left and right vertices: every edge ends there, and a cut
    // that skipped them would report nothing at all.
    expect(crossSection(diamond, 30)).toEqual({ left: 0, right: 80 })
  })

  it('reports the corners of a name that fell off its face', () => {
    const face = quad(0, 0, 60, 40)
    const inside = [{ text: 'Bath', fontSize: 10, x: 30, y: 22 }]
    expect(inkEscapes(inside, face, 'middle')).toEqual([])
    const outside = [{ text: 'Bath', fontSize: 10, x: 58, y: 22 }]
    expect(inkEscapes(outside, face, 'middle').length).toBeGreaterThan(0)
  })

  it('keeps every placed name inside its face, however the face leans', () => {
    const faces: Quad[] = [
      [[0, 0], [100, 0], [100, 60], [60, 60]],
      [[0, 0], [60, 0], [100, 40], [40, 40]],
      [[0, 30], [50, 0], [100, 30], [50, 60]],
      [[0, 10], [70, 0], [90, 50], [20, 60]],
    ]
    const names = ['Bedroom', 'Kitchen', 'Bath', 'Terrace', 'Living + dining']
    for (const face of faces) {
      for (const name of names) {
        const result = placeLabel(candidate({ lines: [{ text: name, fontSize: 10 }], quad: face, minFontSize: 9 }))
        if (!result.placed) continue
        for (const line of result.lines) {
          expect(boxInsideQuad(lineBox(line, line.x, line.y, 'middle'), face)).toBe(true)
        }
      }
    }
  })
})