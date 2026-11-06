/**
 * The mutation check.
 *
 * A gate that has never been broken is a rule nobody owns. Each mutation puts
 * one rule back the way it was — or takes it away — the bundle is rebuilt, and
 * the gate that owns the rule is run. A mutation that survives means the rule
 * is not owned by anything.
 *
 * The tree is restored after every mutation, whatever the outcome.
 *
 *   node scripts/mutation-check.mjs
 */
import { execFile } from 'node:child_process'
import { readFile, writeFile } from 'node:fs/promises'
import { promisify } from 'node:util'

const run = promisify(execFile)

/**
 * Each mutation names the file, the exact text it replaces, and the spec that
 * owns the rule. The replacement is a literal string so the patch is visible
 * in this file and cannot drift from the code.
 */
const MUTATIONS = [
  {
    name: 'the gallery carries the furniture picker again',
    file: 'src/canvas/Spatial3D.tsx',
    from: '{!picture && !ghost && !previewingFurniture && plan.furniture.length > 0 && <div className="spatial-furniture-tools"',
    to: '{!ghost && !previewingFurniture && plan.furniture.length > 0 && <div className="spatial-furniture-tools"',
    spec: 'e2e/gallery.spec.ts',
  },
  {
    name: "the gallery's picture index is two bands away again",
    file: 'src/canvas/RenderGallery.tsx',
    from: '      <div className="render-navigation">',
    to: '      <div className="render-navigation" style={{ order: 2 }}>',
    spec: 'e2e/gallery.spec.ts',
  },
  {
    name: 'the gallery loses the hour the picture was taken at',
    file: 'src/canvas/RenderGallery.tsx',
    from: "      {active.id === 'wireframe' && <div className=\"render-local-controls\">{localControls}</div>}\n",
    to: '',
    spec: 'e2e/gallery.spec.ts',
  },
  {
    name: 'the picture does not say what it is',
    file: 'src/canvas/Spatial3D.tsx',
    from: '>Local 3D · your drawing · clear-sky sun</span>',
    to: '></span>',
    spec: 'e2e/gallery.spec.ts',
  },
  {
    name: 'the eraser erases nothing',
    file: 'src/canvas/editing.ts',
    from: '  const target = eraseTargetAt(plan, point, toleranceM)',
    to: '  const target = null as EraseTarget | null\n  void eraseTargetAt(plan, point, toleranceM)',
    spec: 'e2e/cutting.spec.ts',
  },
  {
    name: 'the trim trims nothing',
    file: 'src/canvas/editing.ts',
    from: '    const cut = trimCutAgainst(room, other, site)\n    if (!cut) continue',
    to: '    const cut = null as TrimCut | null\n    if (!cut) continue',
    spec: 'e2e/cutting.spec.ts',
  },
  {
    name: 'a carried window is dropped on nothing',
    file: 'src/canvas/useCarry.ts',
    from: '        const opening = placeOpeningAt(event.clientX, event.clientY)\n        if (!opening) {',
    to: '        const opening = null as Opening | null\n        if (!opening) {',
    spec: 'e2e/cutting.spec.ts',
  },
]

async function build() {
  try {
    await run('npm', ['run', 'build'], { cwd: process.cwd(), maxBuffer: 64 * 1024 * 1024 })
    return true
  } catch {
    return false
  }
}

async function runSpec(spec) {
  try {
    await run('npx', ['playwright', 'test', spec, '--reporter=line'], { cwd: process.cwd(), maxBuffer: 64 * 1024 * 1024 })
    return { failed: false }
  } catch (error) {
    // Playwright exits non-zero when a test fails. That is the expected
    // outcome for a mutation that is caught.
    const output = `${error.stdout ?? ''}${error.stderr ?? ''}`
    const infrastructure = /ECONNREFUSED|browserType\.launch|Timed out waiting for|ERR_CONNECTION/i.test(output)
    return { failed: true, infrastructure, output: output.slice(-1500) }
  }
}

const results = []

for (const mutation of MUTATIONS) {
  const original = await readFile(mutation.file, 'utf8')
  if (!original.includes(mutation.from)) {
    results.push({ ...mutation, verdict: 'NOT APPLIED — the anchor text is not in the file' })
    console.log(`\n── ${mutation.name}\n   NOT APPLIED — the anchor text is not in ${mutation.file}`)
    continue
  }
  await writeFile(mutation.file, original.replace(mutation.from, mutation.to))
  const built = await build()
  if (!built) {
    await writeFile(mutation.file, original)
    results.push({ ...mutation, verdict: 'the mutant did not build' })
    console.log(`\n── ${mutation.name}\n   the mutant did not build`)
    continue
  }
  const outcome = await runSpec(mutation.spec)
  await writeFile(mutation.file, original)
  const verdict = outcome.infrastructure
    ? 'INFRASTRUCTURE — the run did not reach the gate'
    : outcome.failed
      ? 'KILLED — the gate caught it'
      : 'SURVIVED — the rule is not owned'
  results.push({ ...mutation, verdict })
  console.log(`\n── ${mutation.name}\n   ${verdict}`)
}

await build()

const survivors = results.filter((row) => row.verdict.startsWith('SURVIVED'))
console.log(`\n=== ${results.length} mutations, ${results.length - survivors.length} killed, ${survivors.length} survived ===`)
for (const row of results) console.log(`  ${row.verdict.padEnd(46)} ${row.name}`)
if (survivors.length > 0) process.exitCode = 1
