#!/usr/bin/env node
/**
 * The release gate.
 *
 * `npm run deploy:pages` publishes to the public internet. The questions it
 * asks are the ones a reader of the site is owed an answer to:
 *
 *   1. check-clean — is this the code that was reviewed? An uncommitted tree
 *      or an unpushed commit means the site is serving something nobody has
 *      seen, and the CI run that passed was for a different commit.
 *   2. gates — has that code passed? The CI workflow runs lint, the unit
 *      suite, the worker's own checks and the browser suite. A red run means
 *      the site would be serving a build that failed its own gate.
 *   3. deploy — publish.
 *   4. stamp — the deployed page records the commit it came from, so "which
 *      code is live?" is answered by the site and not by a bundle hash.
 *   5. verify — the public domain is serving that commit. Otherwise the
 *      deploy is a claim, not a fact.
 *
 * Every step that fails exits non-zero. The only way past a failed gate is
 * `--skip-ci`, and it says so on the console, in the record and in the exit
 * code's message.
 *
 * The decisions live in plain functions so they can be tested without a
 * network, a git remote or a deploy.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, resolve } from 'node:path'
import { readFileSync } from 'node:fs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const WORKFLOW = 'deploy.yml'
const PRODUCTION = process.env.DESIGNON_PRODUCTION_URL ?? 'https://designon.nonarkara.org/'
const WRANGLER = resolve(ROOT, 'workers/concept-render/node_modules/.bin/wrangler')
const VERIFY_TIMEOUT_MS = Number(process.env.DESIGNON_VERIFY_TIMEOUT_MS ?? 120_000)

/**
 * Whether a release may go ahead.
 *
 * @param {{ dirty: boolean, pushed: boolean, ciStatus: string | null, sha: string, builtSha: string | null }} state
 *   `dirty` — the working tree has changes that are not committed.
 *   `pushed` — HEAD is on the remote branch.
 *   `ciStatus` — the CI run for HEAD: 'success', 'failure', 'queued',
 *   'in_progress', 'cancelled', or null when there is no run for it.
 */
export function releaseDecision({ dirty, pushed, ciStatus, sha, builtSha }) {
  const blockers = []
  if (dirty) blockers.push('the working tree has uncommitted changes')
  if (!pushed) blockers.push('HEAD is not on the remote, so the commit that passed CI is not this one')
  if (ciStatus === null) blockers.push('no CI run found for HEAD — push it and wait for the gate')
  else if (ciStatus === 'failure') blockers.push('the CI run for HEAD failed')
  else if (ciStatus === 'cancelled') blockers.push('the CI run for HEAD was cancelled')
  else if (ciStatus !== 'success') blockers.push(`the CI run for HEAD is ${ciStatus}, not finished`)
  if (!sha || !/^[0-9a-f]{40}$/.test(sha) || builtSha !== sha) {
    blockers.push('dist/index.html does not carry the full HEAD commit — build it or install the exact CI artifact before uploading')
  }
  return { ok: blockers.length === 0, blockers }
}

/** The commit stamp the built page carries. */
export function stampFromHtml(html) {
  const match = /<meta\s+name="designon-build"\s+content="([0-9a-f]{7,40})"/.exec(html ?? '')
  return match ? match[1] : null
}

/** Whether a served page carries the commit we deployed. */
export function stampMatches(html, expected) {
  const found = stampFromHtml(html)
  if (!found || !expected) return false
  const short = expected.slice(0, 7)
  return found === expected || found.startsWith(short) || short.startsWith(found)
}

function git(...args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim()
}

function gitSucceeds(...args) {
  const result = spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' })
  return result.status === 0
}

function ciStatusFor(sha) {
  let runs
  try {
    runs = JSON.parse(execFileSync('gh', ['run', 'list', '--workflow', WORKFLOW, '--commit', sha, '--json', 'status,conclusion', '--limit', '5'], { cwd: ROOT, encoding: 'utf8' }))
  } catch (error) {
    console.error(`  could not read the CI runs: ${error.message.split('\n')[0]}`)
    return null
  }
  if (!Array.isArray(runs) || runs.length === 0) return null
  const latest = runs[0]
  if (latest.status !== 'completed') return latest.status
  return latest.conclusion ?? latest.status
}

function fetchHtml(url) {
  const result = spawnSync('curl', ['-sS', '--max-time', '20', url], { encoding: 'utf8' })
  if (result.status !== 0) return null
  return result.stdout
}

async function waitForStamp(expected) {
  const deadline = Date.now() + VERIFY_TIMEOUT_MS
  let seen = null
  while (Date.now() < deadline) {
    const html = fetchHtml(PRODUCTION)
    seen = stampFromHtml(html ?? '')
    if (stampMatches(html ?? '', expected)) return { ok: true, seen }
    await new Promise(resolve => setTimeout(resolve, 5000))
  }
  return { ok: false, seen }
}

async function main() {
  const args = process.argv.slice(2)
  const skipCi = args.includes('--skip-ci')
  const skipVerify = args.includes('--skip-verify')

  const sha = git('rev-parse', 'HEAD')
  const dirty = git('status', '--porcelain').length > 0
  const pushed = gitSucceeds('merge-base', '--is-ancestor', 'HEAD', 'origin/main')
  let builtSha = null
  try { builtSha = stampFromHtml(readFileSync(resolve(ROOT, 'dist/index.html'), 'utf8')) }
  catch (error) { console.error(`  could not read the built page: ${error.code ?? 'unknown error'}`) }
  const ciStatus = skipCi ? 'skipped' : ciStatusFor(sha)

  console.log('release gate')
  console.log(`  commit  ${sha}`)
  console.log(`  tree    ${dirty ? 'dirty' : 'clean'}`)
  console.log(`  remote  ${pushed ? 'HEAD is on origin/main' : 'HEAD is NOT on origin/main'}`)
  console.log(`  ci      ${skipCi ? 'SKIPPED by --skip-ci' : (ciStatus ?? 'unknown')}`)
  console.log(`  build   ${builtSha ?? 'missing stamp'}`)

  const decision = releaseDecision({ dirty, pushed, ciStatus: skipCi ? 'success' : ciStatus, sha, builtSha })
  if (!decision.ok) {
    console.error('\nrefusing to deploy:')
    for (const blocker of decision.blockers) console.error(`  - ${blocker}`)
    if (!skipCi && ciStatus !== 'success') {
      console.error('\nwait for the CI run to finish, or pass --skip-ci and take the blame in the record.')
    }
    process.exit(1)
  }
  if (skipCi) {
    console.log('\n!! CI VERIFICATION SKIPPED — this release has not been proven by the gate.')
  }

  console.log('\ndeploying…')
  const deploy = spawnSync(WRANGLER, ['pages', 'deploy', 'dist', '--project-name=luma-house', '--branch=main'], { cwd: ROOT, stdio: 'inherit' })
  if (deploy.status !== 0) {
    console.error('\nthe deploy command failed — nothing was published by this script.')
    process.exit(1)
  }

  if (skipVerify) {
    console.log('\n!! VERIFICATION SKIPPED — nobody has checked that the site is serving this commit.')
    process.exit(0)
  }

  console.log(`\nverifying ${PRODUCTION} serves ${sha.slice(0, 7)}…`)
  const result = await waitForStamp(sha)
  if (!result.ok) {
    console.error(`\nthe deploy finished, but ${PRODUCTION} is not serving ${sha.slice(0, 7)}.`)
    console.error(result.seen ? `  the page reports commit ${result.seen}.` : '  the page carries no commit stamp at all.')
    console.error('the deployment may still be propagating, or it may have failed silently. Check before telling anyone it shipped.')
    process.exit(1)
  }
  console.log(`  the site is serving ${sha.slice(0, 7)} — verified.`)
}

const invokedDirectly = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url
if (invokedDirectly) {
  main().catch(error => {
    console.error(error)
    process.exit(1)
  })
}
