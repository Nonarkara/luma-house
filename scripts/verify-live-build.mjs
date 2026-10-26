import { stampFromHtml } from './release-gate.mjs'

export default async function verifyLiveBuild() {
  const expected = process.env.DESIGNON_EXPECTED_BUILD
  if (!expected || !/^[0-9a-f]{40}$/.test(expected)) throw new Error('Set DESIGNON_EXPECTED_BUILD to the complete deployed commit.')
  const url = new URL(process.env.DESIGNON_LIVE_URL ?? 'https://designon.nonarkara.org/')
  const allowed = ['designon.nonarkara.org', 'luma-house.pages.dev', 'nonarkara.github.io']
  if (url.protocol !== 'https:' || !allowed.includes(url.hostname)) throw new Error('Production verification requires a designon HTTPS host.')
  url.searchParams.set('build-probe', expected)
  const response = await fetch(url, { signal: AbortSignal.timeout(30_000), redirect: 'error' })
  if (!response.ok) throw new Error(`Live build probe returned HTTP ${response.status}.`)
  const actual = stampFromHtml(await response.text())
  if (actual !== expected) throw new Error(`Refusing browser proof: expected ${expected}, received ${actual ?? 'no stamp'}.`)
  console.log(`Verified live build ${actual}`)
}
