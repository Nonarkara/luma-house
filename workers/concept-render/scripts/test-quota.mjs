import assert from 'node:assert/strict'
import { Miniflare, convertV4MiniflareOptions } from 'miniflare'

// Exercise the deployed class in workerd/SQLite, not a mock that pretends
// transaction() serializes concurrent requests. No Gemini credentials or calls.
const mf = new Miniflare(convertV4MiniflareOptions({
  modules: true,
  scriptPath: '.wrangler/quota-test/index.js',
  compatibilityDate: '2026-04-01',
  durableObjects: { AI_QUOTA: { className: 'AiQuota', useSQLite: true } },
  bindings: { DAILY_IP_LIMIT: '5', DAILY_GLOBAL_LIMIT: '12' },
}))
try {
  const namespace = await mf.getDurableObjectNamespace('AI_QUOTA')
  const quota = namespace.get(namespace.idFromName('parallel-proof'))
  const reserve = async network => (await quota.fetch(`https://quota.internal/?network=${network}`, { method: 'POST' })).status
  const sameNetwork = await Promise.all(Array.from({ length: 40 }, () => reserve('a'.repeat(64))))
  assert.equal(sameNetwork.filter(status => status === 204).length, 5)
  assert.equal(sameNetwork.filter(status => status === 429).length, 35)
  const manyNetworks = await Promise.all(Array.from({ length: 50 }, (_, index) => reserve(index.toString(16).padStart(64, '0'))))
  assert.equal(manyNetworks.filter(status => status === 204).length, 7)
  assert.equal(manyNetworks.filter(status => status === 429).length, 43)
  assert.equal(await reserve('f'.repeat(64)), 429)
  console.log('SQLite quota proof: 40 concurrent calls admitted exactly 5; 50 further networks admitted exactly 7; global cap 12 held.')
} finally {
  await mf.dispose()
}
