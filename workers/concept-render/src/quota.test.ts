import { describe, expect, it } from 'vitest'
import { AiQuota } from './quota'

class MemStorage {
  store = new Map<string, unknown>()
  async get<T>(key: string): Promise<T | undefined> { return this.store.get(key) as T | undefined }
  async put(key: string, value: unknown): Promise<void> { this.store.set(key, value) }
  async transaction<T>(fn: (tx: MemStorage) => Promise<T>): Promise<T> { return fn(this) }
}

const NETWORK_A = 'a'.repeat(64)
const NETWORK_B = 'b'.repeat(64)

function quota(limits: Record<string, string> = {}, storage = new MemStorage()) {
  const instance = new AiQuota({ storage } as never, limits as never)
  const call = (network: string | null = NETWORK_A) =>
    instance.fetch(new Request(`https://quota.internal/${network ? `?network=${network}` : ''}`, { method: 'POST' }))
  return { call, storage, instance }
}

describe('AiQuota coordinated daily caps', () => {
  it('allows calls up to the per-network limit, then refuses', async () => {
    const { call } = quota({ DAILY_IP_LIMIT: '2', DAILY_GLOBAL_LIMIT: '200' })
    expect((await call()).status).toBe(204)
    expect((await call()).status).toBe(204)
    expect((await call()).status).toBe(429)
  })

  it('the global cap holds across networks', async () => {
    const { call } = quota({ DAILY_IP_LIMIT: '20', DAILY_GLOBAL_LIMIT: '2' })
    expect((await call(NETWORK_A)).status).toBe(204)
    expect((await call(NETWORK_B)).status).toBe(204)
    expect((await call(NETWORK_B)).status).toBe(429)
  })

  it('one network exhausting its allowance does not block others', async () => {
    const { call } = quota({ DAILY_IP_LIMIT: '1', DAILY_GLOBAL_LIMIT: '5' })
    expect((await call(NETWORK_A)).status).toBe(204)
    expect((await call(NETWORK_A)).status).toBe(429)
    expect((await call(NETWORK_B)).status).toBe(204)
  })

  it('counts reset when the stored day rolls over', async () => {
    const storage = new MemStorage()
    storage.store.set('daily', { day: '2000-01-01', total: 999, networks: { [NETWORK_A]: 999 } })
    const { call } = quota({}, storage)
    expect((await call(NETWORK_A)).status).toBe(204)
  })

  it('fails closed on malformed probes and nonsensical limits', async () => {
    const { call, instance } = quota({ DAILY_IP_LIMIT: 'not-a-number' })
    expect((await call()).status).toBe(503)
    expect((await call(NETWORK_A.toUpperCase())).status).toBe(503)
    expect((await call(null)).status).toBe(503)
    expect((await call('deadbeef')).status).toBe(503)
    expect((await instance.fetch(new Request('https://quota.internal/?network=' + NETWORK_A))).status).toBe(503)
  })

  it('refuses limits above the hard ceiling rather than silently widening them', async () => {
    const { call } = quota({ DAILY_IP_LIMIT: '100000' })
    expect((await call()).status).toBe(503)
  })
})
