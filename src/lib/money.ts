import { MAJOR_CURRENCIES } from '../data/currencies'

export type CurrencyDisplayMode = 'original' | 'convertToBase'

const normalizeCurrency = (c: string) => (c || '').toString().trim().toUpperCase()

// Convierte símbolo a código si es necesario
function symbolToCurrencyCode(symbolOrCode: string): string {
  const normalized = normalizeCurrency(symbolOrCode)
  // Si ya es código, lo retorna
  if (normalized.length === 3 && /^[A-Z]{3}$/.test(normalized)) return normalized
  // Busca en MAJOR_CURRENCIES
  const trimmed = String(symbolOrCode || '').trim()
  const found = MAJOR_CURRENCIES.find(c => c.symbol === trimmed)
  return found ? found.code : normalized
}

export function formatCurrency(amount: number, currencyCodeOrSymbol: string) {
  const trimmed = String(currencyCodeOrSymbol || '').trim()
  const normalized = normalizeCurrency(trimmed)
  const option = MAJOR_CURRENCIES.find(item => item.code === normalized)
  if (option) return `${option.symbol}${amount.toFixed(2)}`

  const looksLikeSymbol = /[^A-Z]/i.test(trimmed) || trimmed.length <= 2
  const prefix = looksLikeSymbol ? trimmed : `${trimmed} `
  return `${prefix}${amount.toFixed(2)}`
}

// --- Exchange rates fetching + caching ---
// Defaults to exchangerate.host (/latest). You can override with env vars.
type RatesMap = Record<string, number>

const FX_CACHE_PREFIX = 'fx_rates_'
const FX_CACHE_TTL = 1000 * 60 * 60 * 12 // 12 hours

// In-flight requests dedupe map: base -> Promise<RatesMap | null>
const INFLIGHT: Record<string, Promise<RatesMap | null> | undefined> = {}

function readCachedRates(base: string): { ts: number; rates: RatesMap } | null {
  try {
    const raw = localStorage.getItem(FX_CACHE_PREFIX + normalizeCurrency(base))
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function writeCachedRates(base: string, rates: RatesMap) {
  try {
    const payload = { ts: Date.now(), rates }
    localStorage.setItem(FX_CACHE_PREFIX + normalizeCurrency(base), JSON.stringify(payload))
  } catch {
    // ignore
  }
}

async function fetchRatesFromApi(base: string): Promise<RatesMap | null> {
  const normalizedBase = normalizeCurrency(base)

  const envUrl = typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_EXCHANGE_API_URL as string | undefined) : undefined
  const envKey = typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_EXCHANGE_API_KEY as string | undefined) : undefined
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem('exchange_api_key') : undefined
  const apiKey = envKey ?? storedKey ?? undefined

  // Prefer /latest (doesn't require a key on exchangerate.host). If you set a custom provider URL,
  // we will try to add the key in a compatible way.
  const baseUrl = envUrl && envUrl.length > 0 ? envUrl : 'https://api.exchangerate.host/latest'
  const separator = baseUrl.includes('?') ? '&' : '?'
  let url = baseUrl
  const headers: Record<string, string> = {}

  const isLive = /exchangerate\.host\/live/.test(baseUrl)
  const isLatest = /exchangerate\.host\/latest/.test(baseUrl)

  if (isLive) {
    // /live: source=BASE, currencies=USD,EUR,...
    url += `${separator}source=${encodeURIComponent(normalizedBase)}`
    const majors = MAJOR_CURRENCIES.map(c => c.code).filter(c => c !== normalizedBase)
    url += `&currencies=${encodeURIComponent(majors.join(','))}`
    url += `&format=1`
  } else {
    // /latest (or compatible): base=BASE
    url += `${separator}base=${encodeURIComponent(normalizedBase)}`
  }

  if (apiKey) {
    const isExchangerateHost = baseUrl.includes('exchangerate.host')
    if (isExchangerateHost && isLatest) {
      // exchangerate.host/latest does not require a key; omit it.
    } else if (isExchangerateHost && isLive) {
      url += `&access_key=${encodeURIComponent(apiKey)}`
    } else if (baseUrl.includes('apilayer')) {
      url += `&access_key=${encodeURIComponent(apiKey)}`
      headers.apikey = apiKey
    } else if (baseUrl.includes('openexchangerates')) {
      url += `&app_id=${encodeURIComponent(apiKey)}`
    } else {
      url += `&access_key=${encodeURIComponent(apiKey)}`
    }
  }

  const maxAttempts = 3
  const baseDelay = 500
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await fetch(url, { headers })
      if (!res.ok) {
        if (attempt === maxAttempts) return null
        await new Promise(r => setTimeout(r, baseDelay * attempt))
        continue
      }

      const json: any = await res.json()
      if (isLive && json && typeof json.quotes === 'object') {
        // quotes: { BASEUSD: 1.25, BASEEUR: 0.95, ... }
        const rates: RatesMap = {}
        for (const k of Object.keys(json.quotes)) {
          if (k.startsWith(normalizedBase)) {
            const code = k.slice(normalizedBase.length)
            rates[code] = Number(json.quotes[k])
          }
        }
        return rates
      }

      if (json && json.rates && typeof json.rates === 'object') {
        return json.rates as RatesMap
      }

      if (attempt === maxAttempts) return null
      await new Promise(r => setTimeout(r, baseDelay * attempt))
    } catch {
      if (attempt === maxAttempts) return null
      await new Promise(r => setTimeout(r, baseDelay * attempt))
    }
  }

  return null
}

export async function getRates(base: string, options?: { force?: boolean }): Promise<RatesMap | null> {
  if (typeof window === 'undefined') return null

  const normalizedBase = normalizeCurrency(base)
  const force = options?.force === true
  const cached = readCachedRates(normalizedBase)
  if (!force && cached && (Date.now() - cached.ts) < FX_CACHE_TTL) {
    return cached.rates
  }

  if (INFLIGHT[normalizedBase]) return INFLIGHT[normalizedBase]!

  const promise = (async () => {
    try {
      const fetched = await fetchRatesFromApi(normalizedBase)
      if (fetched) {
        writeCachedRates(normalizedBase, fetched)
        return fetched
      }
      return cached ? cached.rates : null
    } finally {
      delete INFLIGHT[normalizedBase]
    }
  })()

  INFLIGHT[normalizedBase] = promise
  return promise
}

export function clearRatesCache(base: string) {
  try {
    localStorage.removeItem(FX_CACHE_PREFIX + normalizeCurrency(base))
  } catch {
    // ignore
  }
}

export function setExchangeApiKey(key: string | null) {
  try {
    if (key === null) localStorage.removeItem('exchange_api_key')
    else localStorage.setItem('exchange_api_key', String(key))
  } catch {
    // ignore
  }
}

export function hasExchangeApiKey(): boolean {
  try {
    return !!localStorage.getItem('exchange_api_key')
  } catch {
    return false
  }
}

// Convert amount from `from` currency into `to` currency using cached/fetched rates.
// Prefer fetching rates with base = `to` so conversion is amount_in_to = amount / rates[from]
export async function convertCurrencyAsync(amount: number, from: string, to: string): Promise<number> {
  const f = symbolToCurrencyCode(from)
  const t = symbolToCurrencyCode(to)
  if (!f || f === t) return amount

  const rates = await getRates(t)
  if (rates && rates[f]) {
    return amount / rates[f]
  }
  return convertCurrencySync(amount, from, to)
}

// Synchronous conversion using cached rates if available (no network). Returns a fallback if none.
export function convertCurrencySync(amount: number, from: string, to: string): number {
  const f = symbolToCurrencyCode(from)
  const t = symbolToCurrencyCode(to)
  if (!f || f === t) return amount

  // Cached rates (base = to)
  if (typeof window !== 'undefined') {
    try {
      const cached = readCachedRates(t)
      if (cached && cached.rates && cached.rates[f]) {
        return amount / cached.rates[f]
      }
    } catch {
      // ignore
    }
  }

  // Fallback: base rates relative to EUR (best-effort only)
  const fallbackRates: Record<string, number> = {
    EUR: 1,
    USD: 1.05,
    GBP: 0.88,
    CAD: 1.42,
  }
  const fromRate = fallbackRates[f] ?? 1
  const toRate = fallbackRates[t] ?? 1
  const inEur = amount / fromRate
  return inEur * toRate
}
