/** One transactional coordinator caps both per-network and total upstream calls. */
interface DailyQuota { day: string; total: number; networks: Record<string, number> }
interface Limits { DAILY_IP_LIMIT?: string; DAILY_GLOBAL_LIMIT?: string }

function positiveLimit(raw: string | undefined, fallback: number, maximum: number): number | null {
  if (raw === undefined) return fallback
  const value = Number(raw)
  return Number.isSafeInteger(value) && value > 0 && value <= maximum ? value : null
}

export class AiQuota {
  constructor(private state: DurableObjectState, private env: Limits) {}

  async fetch(request: Request): Promise<Response> {
    const perNetwork = positiveLimit(this.env.DAILY_IP_LIMIT, 20, 100)
    const global = positiveLimit(this.env.DAILY_GLOBAL_LIMIT, 200, 1000)
    const network = new URL(request.url).searchParams.get('network')
    if (request.method !== 'POST' || !network || !/^[a-f0-9]{64}$/.test(network) || perNetwork === null || global === null) {
      return new Response(null, { status: 503 })
    }
    const day = new Date().toISOString().slice(0, 10)
    const allowed = await this.state.storage.transaction(async tx => {
      const stored = await tx.get<DailyQuota>('daily')
      const quota: DailyQuota = stored?.day === day ? stored : { day, total: 0, networks: {} }
      const count = quota.networks[network] ?? 0
      if (quota.total >= global || count >= perNetwork) return false
      quota.total++
      quota.networks[network] = count + 1
      await tx.put('daily', quota)
      return true
    })
    return new Response(null, { status: allowed ? 204 : 429 })
  }
}
