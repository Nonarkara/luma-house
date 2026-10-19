import type { CurrencyCode, ProjectLocation } from '../types'

/**
 * Units of each currency per 1 CNY. The authored budget is a Shanghai
 * specification priced in RMB; other currencies are a conversion of that
 * specification, not a local market rate card.
 * Source: Bank of Thailand reference/mid rates for 15 Oct 2026
 * (FM_FX_001_S3, https://app.bot.or.th/BTWS_STAT/statistics/BOTWEBSTAT.aspx?language=ENG&reportID=123):
 * CNY 5.0181, USD 33.5410, EUR 37.5857 THB.
 */
export const THB_PER = { CNY: 5.0181, USD: 33.541, EUR: 37.5857 } as const
export const FX_PER_CNY: Record<CurrencyCode, number> = {
  CNY: 1,
  THB: THB_PER.CNY,
  USD: THB_PER.CNY / THB_PER.USD,
  EUR: THB_PER.CNY / THB_PER.EUR,
}
export const FX_SOURCE = 'Bank of Thailand reference rates, 15 Oct 2026'

/** The city decides the default pricing currency; the user can still override it. */
export function currencyForLocation(location: Pick<ProjectLocation, 'timezone' | 'label'> | undefined): CurrencyCode {
  if (!location) return 'CNY'
  const tz = location.timezone ?? ''
  if (tz === 'Asia/Bangkok' || /Thailand/i.test(location.label ?? '')) return 'THB'
  if (tz.startsWith('America/')) return 'USD'
  if (tz.startsWith('Europe/')) return 'EUR'
  return 'CNY'
}

export function convertFromCny(amountCny: number, to: CurrencyCode): number {
  return amountCny * (FX_PER_CNY[to] ?? 1)
}
