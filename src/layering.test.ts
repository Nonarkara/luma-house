import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The layering gate.
 *
 * Domain calculations in this project are pure so a validator, a sanitizer or a
 * unit test can import them without dragging in a renderer, a DOM or a WebGL
 * context. That rule lives in prose in AGENTS.md, which is not a thing that can
 * fail. This test is.
 *
 * It ratchets rather than forbids: the two current exceptions are named with
 * the reason each exists, so a third one has to be written down deliberately,
 * and a deleted exception fails the test rather than silently widening the rule.
 */

const PURE_DIRECTORIES = ['src/analysis', 'src/drawing', 'src/export', 'src/location', 'src/study']
const PURE_FILES = ['src/plan.ts', 'src/openingGeometry.ts', 'src/sharePlan.ts']

/** Libraries that can only work in a browser with a GPU. */
const RENDERING = ['three', 'three-stdlib', '@react-three/fiber', '@react-three/drei', 'react-dom']
const VIEW_LAYER = ['react']

/** Every reason a pure module may reach past its layer, and why it still does. */
const EXEMPT: Record<string, string> = {
  'src/drawing/useTextMeasure.ts': 'measures the font the browser actually loaded; unknowable without a document',
  'src/study/geometry.ts': "camera framing reuses Three's Box3 and OrthographicCamera; tracked, not yet decoupled",
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory)
    .filter(name => name.endsWith('.ts') && !name.endsWith('.test.ts'))
    .map(name => join(directory, name))
}

function importsOf(file: string): string[] {
  return [...readFileSync(file, 'utf8').matchAll(/from\s+'([^']+)'/g)].map(match => match[1])
}

const pure = [...PURE_DIRECTORIES.flatMap(sourceFiles), ...PURE_FILES]
const breaches: Array<{ file: string; imported: string }> = []
for (const file of pure) {
  if (file in EXEMPT) continue
  for (const imported of importsOf(file)) {
    if (RENDERING.includes(imported) || VIEW_LAYER.includes(imported)) breaches.push({ file, imported })
  }
}

describe('layering', () => {
  it('keeps a renderer out of the pure domain modules', () => {
    expect(
      breaches.map(breach => `${breach.file} imports ${breach.imported}`),
      'a domain module may not reach for a renderer — move the maths or name the exception above',
    ).toEqual([])
  })

  it('names every exemption that exists, and they are all real files', () => {
    for (const file of Object.keys(EXEMPT)) {
      expect(() => readFileSync(file, 'utf8'), `exemption ${file} names a file that no longer exists`).not.toThrow()
    }
  })

  it('still scans something', () => {
    expect(pure.length).toBeGreaterThan(20)
  })

  it('catches a renderer dragged into a domain module', () => {
    // The detector proved against itself: this is the shape of the bug the
    // gate exists for, spelled out rather than asserted.
    const smuggled = "import { Vector3 } from 'three'\nexport const x = 1\n"
    expect([...smuggled.matchAll(/from\s+'([^']+)'/g)].map(match => match[1])).toContain('three')
    expect(RENDERING).toContain('three')
  })
})