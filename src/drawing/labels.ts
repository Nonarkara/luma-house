/**
 * Label placement for the printed drawing sheet.
 *
 * Two failure modes killed the first version of this and both are pure geometry,
 * so they are decided here, in viewBox pixels, where they can be tested:
 *
 *  - A label wider than the face it names spills past the polygon and reads as
 *    the neighbouring room's name, or as clipped rubbish.
 *  - A label whose face has been painted over by a nearer room is chopped in
 *    half by the room in front of it.
 *
 * Every decision below compares millimetres of *screen* against millimetres of
 * *text*. The earlier guard compared projected model units against SVG font
 * pixels — two different coordinate spaces — so it could never exclude anything
 * and the collisions shipped. Text advance widths are a deterministic estimate
 * used only to decide whether a name fits. They are never a measurement, and
 * nothing on the sheet claims otherwise.
 */

export type Quad = ReadonlyArray<readonly [number, number]>

export interface Point {
  x: number
  y: number
}

export interface Extents {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export interface LabelLine {
  text: string
  fontSize: number
}

export interface TextMetrics {
  width: number
  left: number
  right: number
  ascent: number
  descent: number
}

/** Runtime callers measure the loaded font; pure callers use the estimate. */
export type MeasureText = (line: LabelLine) => TextMetrics

export interface LabelCandidate {
  id: string
  lines: LabelLine[]
  /** The face the label sits on, in viewBox pixels. */
  quad: Quad
  align: 'centre' | 'start'
  pad?: number
  /** Smallest type the name may be set at when the nominal size will not fit. */
  minFontSize?: number
  /** Polygons painted after this label's own face. A covered label is worse than no label. */
  occluders?: Quad[]
  measure?: MeasureText
}

export interface PlacedLine extends LabelLine {
  x: number
  y: number
}

export interface LabelPlacement {
  id: string
  lines: PlacedLine[]
  /** False when the name does not belong on this face. `lines` is then empty. */
  placed: boolean
  reason: 'placed' | 'too-narrow' | 'too-short' | 'occluded'
}

const NARROW = "ijltfrI!.,:;|'`()[]{}/\\- "
const WIDE = 'mwMW@%'
const UPPER = /[A-Z]/
const DIGIT = /[0-9]/

/** Advance width in em for one character. An estimate for fit decisions only. */
export function charEm(character: string): number {
  if (NARROW.includes(character)) return 0.28
  if (WIDE.includes(character)) return 0.86
  if (DIGIT.test(character)) return 0.55
  if (UPPER.test(character)) return 0.66
  if (character >= 'a' && character <= 'z') return 0.52
  // Anything else — Thai, accents, symbols — is drawn no narrower than a digit.
  return 0.6
}

export function textWidth(text: string, fontSize: number): number {
  let em = 0
  for (const character of text) em += charEm(character)
  return em * fontSize
}

export function quadExtents(quad: Quad): Extents {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of quad) {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

export function quadCentre(quad: Quad): Point {
  const box = quadExtents(quad)
  return { x: (box.minX + box.maxX) / 2, y: (box.minY + box.maxY) / 2 }
}

/** Crossing-number test. Every face this is used on is a convex quad. */
export function pointInQuad(point: Point, quad: Quad): boolean {
  let inside = false
  for (let i = 0, j = quad.length - 1; i < quad.length; j = i++) {
    const [xi, yi] = quad[i]
    const [xj, yj] = quad[j]
    const straddles = yi > point.y !== yj > point.y
    if (straddles && point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export function lineWidth(lines: LabelLine[], measure?: MeasureText): number {
  return lines.reduce((widest, line) => Math.max(widest, measure ? measure(line).width : textWidth(line.text, line.fontSize)), 0)
}

/** Total block height, with the leading that keeps two stacked lines from touching. */
export function blockHeight(lines: LabelLine[]): number {
  return lines.reduce((height, line) => height + line.fontSize, 0) * 1.2
}

/**
 * Real ink, not the em box. Cap height sits above the baseline, descenders below
 * it, and the first and last glyphs carry side bearings — the corners of an em
 * box are empty for every letter. Testing the em box instead rejected names on
 * every axonometric roof, because a roof is a diamond and its em box overhangs
 * by a fraction of a pixel at four corners.
 */
const INK_ASCENT = 0.7
const INK_DESCENT = 0.2
const INK_SIDE_BEARING = 0.03

/** Clearance between inked type and the edge it is set against. */
const INSET = 0.05

/**
 * The rectangle a single line of type actually inks. `x` is the anchor point,
 * exactly as the SVG renders it, so the sheet and this test agree on where the
 * name begins.
 */
export function lineBox(
  line: { text: string; fontSize: number },
  x: number,
  baselineY: number,
  anchor: 'start' | 'middle' = 'start',
  measure?: MeasureText,
): Quad {
  if (measure) {
    const metrics = measure(line)
    const origin = anchor === 'middle' ? x - metrics.width / 2 : x
    return [[origin + metrics.left, baselineY - metrics.ascent], [origin + metrics.right, baselineY - metrics.ascent],
      [origin + metrics.right, baselineY + metrics.descent], [origin + metrics.left, baselineY + metrics.descent]]
  }
  const width = textWidth(line.text, line.fontSize)
  const bearing = INK_SIDE_BEARING * line.fontSize
  const origin = anchor === 'middle' ? x - width / 2 : x
  const left = origin + bearing
  const right = origin + Math.max(0, width - bearing)
  const top = baselineY - INK_ASCENT * line.fontSize
  const bottom = baselineY + INK_DESCENT * line.fontSize
  return [[left, top], [right, top], [right, bottom], [left, bottom]]
}

/** Separating-axis test for convex faces and ink boxes, including edge crossings. */
export function quadsOverlap(a: Quad, b: Quad): boolean {
  for (const polygon of [a, b]) {
    for (let i = 0; i < polygon.length; i += 1) {
      const p = polygon[i], q = polygon[(i + 1) % polygon.length]
      const nx = p[1] - q[1], ny = q[0] - p[0]
      if (nx === 0 && ny === 0) continue
      const project = (quad: Quad) => quad.map(([x, y]) => x * nx + y * ny)
      const aa = project(a), bb = project(b)
      if (Math.max(...aa) <= Math.min(...bb) || Math.max(...bb) <= Math.min(...aa)) return false
    }
  }
  return a.length >= 3 && b.length >= 3
}

/** True when every corner of `box` lies inside the convex `quad`. */
export function boxInsideQuad(box: Quad, quad: Quad): boolean {
  return box.every((corner) => pointInQuad({ x: corner[0], y: corner[1] }, quad))
}

/** The span a horizontal line cuts across a convex face at height `y`. */
export function crossSection(quad: Quad, y: number): { left: number; right: number } | null {
  const xs: number[] = []
  for (let index = 0; index < quad.length; index += 1) {
    const [x1, y1] = quad[index]
    const [x2, y2] = quad[(index + 1) % quad.length]
    if (y1 === y2) continue
    // Inclusive, so a cut level that lands on a vertex still measures the whole
    // face. Every edge of a quad meets at most two vertices, and skipping them
    // would report a narrower cut than the face actually offers.
    const slack = 1e-9
    if (y < Math.min(y1, y2) - slack || y > Math.max(y1, y2) + slack) continue
    xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1))
  }
  if (xs.length < 2) return null
  return { left: Math.min(...xs), right: Math.max(...xs) }
}

/**
 * The corners of a placed block that fall outside the face it names.
 *
 * The band arithmetic is what decides placement, so this is the check that the
 * decision and the drawing agree — a corner list that is empty is the promise
 * the sheet makes about every name it prints.
 */
export function inkEscapes(lines: PlacedLine[], quad: Quad, anchor: 'start' | 'middle', measure?: MeasureText): Quad {
  return lines
    .flatMap((line) => lineBox(line, line.x, line.y, anchor, measure))
    .filter((corner) => !pointInQuad({ x: corner[0], y: corner[1] }, quad))
}

/**
 * The horizontal room a text block actually has, measured over the band it
 * inks rather than over the face's bounding box.
 *
 * An axonometric face is a parallelogram. Its diagonal extent is far wider than
 * the strip the type sits in, which is why a name can clear the bounding box
 * and still hang over an edge. The extremes of a convex face's cut lie at the
 * band's own edges or at a vertex inside it, so those are all the heights worth
 * measuring.
 */
export function usableBand(quad: Quad, top: number, bottom: number): { left: number; right: number } | null {
  const heights = [top, bottom, ...quad.map(([, y]) => y).filter((y) => y > top && y < bottom)]
  let left = -Infinity
  let right = Infinity
  for (const y of heights) {
    const cut = crossSection(quad, y)
    if (!cut) continue
    left = Math.max(left, cut.left)
    right = Math.min(right, cut.right)
  }
  return Number.isFinite(left) && Number.isFinite(right) && right > left ? { left, right } : null
}

/**
 * Decide whether `candidate` may be named on its own face, and where.
 *
 * A candidate is placed only when the inked block of every line sits inside the
 * face it describes and nothing has been painted over that face. A bounding box
 * is not enough: an axonometric roof is a parallelogram whose usable width at
 * the band the type occupies is far less than its diagonal extent, so a name
 * that clears the bounding box can still hang over an edge. Where a name will
 * not sit at its nominal size the type is stepped down a point at a time, as a
 * drafter would, and the face is left unnamed only when even the smallest size
 * will not go.
 */
export function placeLabel(candidate: LabelCandidate): LabelPlacement {
  if (candidate.lines.length === 0) return { id: candidate.id, lines: [], placed: false, reason: 'too-narrow' }
  const nominal = candidate.lines[0].fontSize
  const floor = Math.min(nominal, candidate.minFontSize ?? nominal)
  let refusal: LabelPlacement = { id: candidate.id, lines: [], placed: false, reason: 'too-narrow' }
  for (let size = nominal; size >= floor; size -= 1) {
    const attempt = attemptPlacement(candidate, size)
    if (attempt.placed) return attempt
    refusal = attempt
  }
  return refusal
}

function attemptPlacement(candidate: LabelCandidate, size: number): LabelPlacement {
  const empty: LabelPlacement = { id: candidate.id, lines: [], placed: false, reason: 'too-narrow' }
  const pad = candidate.pad ?? 3
  const scale = size / candidate.lines[0].fontSize
  const lines: LabelLine[] = candidate.lines.map((line) => ({ text: line.text, fontSize: line.fontSize * scale }))
  const box = quadExtents(candidate.quad)
  const faceWidth = box.maxX - box.minX
  const faceHeight = box.maxY - box.minY
  const need = lineWidth(lines, candidate.measure)
  const height = blockHeight(lines)
  if (faceWidth < need + pad * 2) return { ...empty, reason: 'too-narrow' }
  if (faceHeight < height + pad * 2) return { ...empty, reason: 'too-short' }
  const anchor = candidate.align === 'centre' ? 'middle' : 'start'
  const origin = candidate.align === 'centre' ? (box.minX + box.maxX) / 2 : box.minX + pad
  const top = candidate.align === 'centre' ? (box.minY + box.maxY) / 2 - height / 2 : box.minY + pad
  let cursor = top
  const laidOut: PlacedLine[] = lines.map((line) => {
    const baseline = cursor + line.fontSize * 0.82
    cursor += line.fontSize * 1.2
    return { ...line, x: origin, y: baseline }
  })
  // Measure the strip the ink actually covers, not the block's leading: a face
  // narrows fast between one line's descenders and the next line's cap height,
  // and charging the name for that gap is what empties an axonometric of names.
  const inks = laidOut.map((line) => lineBox(line, line.x, line.y, anchor, candidate.measure))
  const inkTop = Math.min(...inks.flat().map((corner) => corner[1]))
  const inkBottom = Math.max(...inks.flat().map((corner) => corner[1]))
  const leftOffset = Math.min(...inks.flat().map(([x]) => x - origin))
  const rightOffset = Math.max(...inks.flat().map(([x]) => x - origin))
  const band = usableBand(candidate.quad, inkTop, inkBottom)
  if (!band) return { ...empty, reason: 'too-short' }
  // Slide the block along the face until its ink sits in the measured band. A
  // name that misses by a few pixels at the centre then still lands properly,
  // and one that misses by more is refused rather than named across an edge.
  // The inset keeps the ink clear of the line rather than resting on it: type
  // that touches an edge reads as touching, not as inside.
  const near = band.left - leftOffset + INSET
  const far = band.right - rightOffset - INSET
  if (near > far) return { ...empty, reason: 'too-narrow' }
  const placed = laidOut.map((line) => ({ ...line, x: Math.min(Math.max(origin, near), far) }))
  // Backstop, not a primary gate: the band arithmetic above is expected to make
  // this unreachable. It stays because a name printed across a boundary is the
  // defect this whole module exists to prevent, and a future face ordering that
  // confuses the band should cost one unnamed room rather than a wrong drawing.
  const escapes = inkEscapes(placed, candidate.quad, anchor, candidate.measure)
  if (escapes.length > 0) {
    const leftVertically = escapes.some((corner) => corner[1] < box.minY || corner[1] > box.maxY)
    return { ...empty, reason: leftVertically ? 'too-short' : 'too-narrow' }
  }
  const covered = (candidate.occluders ?? []).some((occluder) => placed.some(line =>
    quadsOverlap(lineBox(line, line.x, line.y, anchor, candidate.measure), occluder)))
  return covered
    ? { id: candidate.id, lines: [], placed: false, reason: 'occluded' }
    : { id: candidate.id, lines: placed, placed: true, reason: 'placed' }
}
