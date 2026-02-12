import { useEffect, useMemo, useRef, useState } from 'react'
import type { Subscription } from '../lib/types'
import { nextRenewalDate } from '../lib/storage'
import { SimpleBarChart, SimpleLineChart, SimplePieChart } from '../components/SimpleCharts'
import { exportElementToPng, exportRowsToCsv } from '../lib/export'
import { convertCurrencySync, formatCurrency, getRates } from '../lib/money'
import GradientText from '../components/ui/GradientText'
import { useStore } from '../store'
import { useI18n } from '../lib/i18n'

function monthlyEquivalent(s: Subscription) {
  if (!Number.isFinite(s.price)) return 0
  switch (s.period) {
    case 'monthly':
      return s.price
    case 'quarterly':
      return s.price / 3
    case 'semiannual':
      return s.price / 6
    case 'annual':
      return s.price / 12
  }
}

function periodMonths(s: Subscription) {
  return s.period === 'monthly' ? 1 : s.period === 'quarterly' ? 3 : s.period === 'semiannual' ? 6 : 12
}

function annualCost(s: Subscription) {
  const step = periodMonths(s)
  if (!Number.isFinite(s.price)) return 0
  return (s.price * 12) / step
}

function linearProjection(values: number[], monthsForward: number) {
  const clean = values.map(v => (Number.isFinite(v) ? v : 0))
  const n = clean.length
  if (n === 0) return Array.from({ length: monthsForward }, () => 0)
  if (n === 1) return Array.from({ length: monthsForward }, () => Math.max(0, clean[0]))

  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumXX = 0
  for (let i = 0; i < n; i += 1) {
    const x = i
    const y = clean[i]
    sumX += x
    sumY += y
    sumXY += x * y
    sumXX += x * x
  }
  const denom = (n * sumXX) - (sumX * sumX)
  const slope = denom === 0 ? 0 : ((n * sumXY) - (sumX * sumY)) / denom
  const intercept = (sumY - (slope * sumX)) / n

  return Array.from({ length: monthsForward }, (_, i) => {
    const y = intercept + slope * (n + i)
    return Math.max(0, y)
  })
}

function makeFutureMonthLabels(startFrom: Date, count: number, locale: string) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(startFrom.getFullYear(), startFrom.getMonth() + i, 1)
    return d.toLocaleString(locale, { month: 'short' })
  })
}

function capitalizeFirst(value: string) {
  if (!value) return value
  return value[0].toUpperCase() + value.slice(1)
}

function parseYmdLocal(ymd: string): Date | null {
  const [y, m, d] = String(ymd).split('-').map(Number)
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1)
  return Number.isNaN(dt.getTime()) ? null : dt
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date)
  copy.setMonth(copy.getMonth() + months)
  return copy
}

function occurrencesInRange(startDate: string, stepMonths: number, from: Date, to: Date): Date[] {
  const base = parseYmdLocal(startDate)
  if (!base) return []
  let cursor = new Date(base)
  while (cursor.getTime() < from.getTime()) {
    cursor = addMonths(cursor, stepMonths)
  }
  const out: Date[] = []
  while (cursor.getTime() <= to.getTime()) {
    out.push(new Date(cursor))
    cursor = addMonths(cursor, stepMonths)
  }
  return out
}

export function Dashboard() {
  const { state } = useStore()
  const { t, language } = useI18n()
  const displayMode = state.settings.currencyDisplayMode ?? 'original'
  const baseCurrency = (state.settings.baseCurrency || 'USD').toUpperCase()

  const [fxTick, setFxTick] = useState(0)
  const [fxStatus, setFxStatus] = useState<'idle' | 'loading' | 'ready' | 'unavailable'>('idle')

  const [trendWindow, setTrendWindow] = useState<3 | 6 | 12>(6)
  const [projectionMonths, setProjectionMonths] = useState<3 | 6>(3)
  const [compareA, setCompareA] = useState<string>('')
  const [compareB, setCompareB] = useState<string>('')

  useEffect(() => {
    if (displayMode !== 'convertToBase') return
    let cancelled = false

    setFxStatus('loading')

    void (async () => {
      const rates = await getRates(baseCurrency)
      if (cancelled) return
      if (rates) {
        setFxStatus('ready')
        setFxTick(t => t + 1)
      } else {
        setFxStatus('unavailable')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [baseCurrency, displayMode])

  useEffect(() => {
    if (displayMode !== 'convertToBase') setFxStatus('idle')
  }, [displayMode])

  const chartElsRef = useRef(new Map<string, HTMLDivElement>())
  const setChartEl = (key: string) => (el: HTMLDivElement | null) => {
    if (el) chartElsRef.current.set(key, el)
    else chartElsRef.current.delete(key)
  }

  const currencies = useMemo(() => {
    if (displayMode === 'convertToBase') return [baseCurrency]
    return Array.from(new Set(state.subscriptions.map(s => (s.currency || 'USD').toUpperCase()))).sort((a, b) => a.localeCompare(b))
  }, [baseCurrency, displayMode, state.subscriptions])

  const sortedSubscriptions = useMemo(() => {
    return state.subscriptions.slice().sort((a, b) => a.name.localeCompare(b.name))
  }, [state.subscriptions])

  useEffect(() => {
    if (sortedSubscriptions.length === 0) {
      if (compareA) setCompareA('')
      if (compareB) setCompareB('')
      return
    }

    const first = sortedSubscriptions[0]?.id
    const hasCompareA = sortedSubscriptions.some(s => s.id === compareA)
    if (!compareA || !hasCompareA) {
      setCompareA(first)
      return
    }

    const hasCompareB = sortedSubscriptions.some(s => s.id === compareB)
    const nextB = sortedSubscriptions.find(s => s.id !== compareA)?.id ?? compareA
    if (!compareB || !hasCompareB || compareB === compareA) {
      setCompareB(nextB)
    }
  }, [compareA, compareB, sortedSubscriptions])

  const totals = useMemo(() => {
    const byCurrency = new Map<string, number>()
    for (const s of state.subscriptions) {
      const rawCur = (s.currency || 'USD').toUpperCase()
      const cur = displayMode === 'convertToBase' ? baseCurrency : rawCur
      const amt = displayMode === 'convertToBase'
        ? convertCurrencySync(monthlyEquivalent(s), rawCur, baseCurrency)
        : monthlyEquivalent(s)
      const current = byCurrency.get(cur) ?? 0
      byCurrency.set(cur, current + amt)
    }
    return Array.from(byCurrency.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [baseCurrency, displayMode, fxTick, state.subscriptions])

  const insightsByCurrency = useMemo(() => {
    const now = new Date()
    const windowDays = 7
    const dueThreshold = new Date(now)
    dueThreshold.setDate(dueThreshold.getDate() + windowDays)

    const totalsByCurrency = new Map<string, number>()
    const countsByCurrency = new Map<string, number>()
    const dueSoonByCurrency = new Map<string, number>()
    const highestByCurrency = new Map<string, { name: string; value: number }>()
    const categoryTotalsByCurrency = new Map<string, Map<string, number>>()

    for (const s of state.subscriptions) {
      const rawCur = (s.currency || 'USD').toUpperCase()
      const cur = displayMode === 'convertToBase' ? baseCurrency : rawCur
      const monthlyEq = displayMode === 'convertToBase'
        ? convertCurrencySync(monthlyEquivalent(s), rawCur, baseCurrency)
        : monthlyEquivalent(s)

      totalsByCurrency.set(cur, (totalsByCurrency.get(cur) ?? 0) + monthlyEq)
      countsByCurrency.set(cur, (countsByCurrency.get(cur) ?? 0) + 1)

      const next = nextRenewalDate(s.startDate, s.period, now)
      if (next.getTime() <= dueThreshold.getTime()) {
        dueSoonByCurrency.set(cur, (dueSoonByCurrency.get(cur) ?? 0) + 1)
      }

      const prevHigh = highestByCurrency.get(cur)
      if (!prevHigh || monthlyEq > prevHigh.value) {
        highestByCurrency.set(cur, { name: s.name, value: monthlyEq })
      }

      const category = (s.category || '').trim() || (t('common.uncategorized') ?? 'Sin categoría')
      if (!categoryTotalsByCurrency.has(cur)) categoryTotalsByCurrency.set(cur, new Map())
      const catMap = categoryTotalsByCurrency.get(cur)!
      catMap.set(category, (catMap.get(category) ?? 0) + monthlyEq)
    }

    const out = new Map<
      string,
      {
        count: number
        monthlyTotal: number
        avgMonthly: number
        dueSoonCount: number
        highest: { name: string; value: number } | null
        topCategory: { label: string; value: number; pct: number } | null
        windowDays: number
      }
    >()

    const allCurrencies = new Set<string>([...totalsByCurrency.keys(), ...countsByCurrency.keys()])
    for (const cur of allCurrencies) {
      const count = countsByCurrency.get(cur) ?? 0
      const monthlyTotal = totalsByCurrency.get(cur) ?? 0
      const avgMonthly = count > 0 ? monthlyTotal / count : 0
      const dueSoonCount = dueSoonByCurrency.get(cur) ?? 0
      const highest = highestByCurrency.get(cur) ?? null
      const catMap = categoryTotalsByCurrency.get(cur)
      let topCategory: { label: string; value: number; pct: number } | null = null
      if (catMap && monthlyTotal > 0) {
        let best: { label: string; value: number } | null = null
        for (const [label, value] of catMap.entries()) {
          if (!best || value > best.value) best = { label, value }
        }
        if (best) {
          topCategory = { label: best.label, value: best.value, pct: Math.round((best.value / monthlyTotal) * 100) }
        }
      }

      out.set(cur, { count, monthlyTotal, avgMonthly, dueSoonCount, highest, topCategory, windowDays })
    }

    return out
  }, [baseCurrency, displayMode, fxTick, state.subscriptions, t])

  const nextItems = useMemo(() => {
    const now = new Date()
    const list = state.subscriptions
      .map(s => ({ s, next: nextRenewalDate(s.startDate, s.period, now) }))
      .sort((a, b) => a.next.getTime() - b.next.getTime())
      .slice(0, 5)
    return list
  }, [state.subscriptions])

  const monthlyProjectionByCurrency = useMemo(() => {
    const now = new Date()
    const months = Array.from({ length: 12 }, (_, i) => new Date(now.getFullYear(), now.getMonth() - (11 - i), 1))
    const labels = months.map(d => d.toLocaleString(language === 'es' ? 'es-ES' : 'en-US', { month: 'short' }))

    const byCurrency = new Map<string, number[]>()
    for (const cur of currencies) {
      byCurrency.set(cur, Array.from({ length: 12 }, () => 0))
    }

    for (const s of state.subscriptions) {
      const rawCur = (s.currency || 'USD').toUpperCase()
      const cur = displayMode === 'convertToBase' ? baseCurrency : rawCur
      if (!byCurrency.has(cur)) byCurrency.set(cur, Array.from({ length: 12 }, () => 0))
      const step = periodMonths(s)

      for (let i = 0; i < months.length; i++) {
        const monthStart = months[i]
        const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999)
        const occ = occurrencesInRange(s.startDate, step, monthStart, monthEnd)
        if (!occ.length) continue
        const arr = byCurrency.get(cur)!
        const amount = s.price * occ.length
        arr[i] += displayMode === 'convertToBase' ? convertCurrencySync(amount, rawCur, baseCurrency) : amount
      }
    }

    return { labels, byCurrency }
  }, [baseCurrency, currencies, displayMode, fxTick, state.subscriptions])

  const advancedByCurrency = useMemo(() => {
    const locale = language === 'es' ? 'es-ES' : 'en-US'
    const fullLabels = monthlyProjectionByCurrency.labels
    const now = new Date()
    const fullMonthLabels = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (11 - i), 1)
      return capitalizeFirst(d.toLocaleString(locale, { month: 'long' }))
    })
    const out = new Map<string, {
      trendLabels: string[]
      trendValues: number[]
      momRows: Array<{ label: string; value: number; delta: number; pct: number | null }>
      lastMonthValue: number
      lastMonthDelta: number
      lastMonthPct: number | null
      projectionLabels: string[]
      projectionValues: number[]
      projectionTotal: number
    }>()

    const nextMonthStart = new Date()
    nextMonthStart.setDate(1)
    nextMonthStart.setMonth(nextMonthStart.getMonth() + 1)

    for (const cur of currencies) {
      const series = monthlyProjectionByCurrency.byCurrency.get(cur) ?? []
      const safeSeries = series.length ? series : Array.from({ length: 12 }, () => 0)
      const trendValues = safeSeries.slice(-trendWindow)
      const trendLabels = fullLabels.slice(-trendWindow)

      const momRows: Array<{ label: string; value: number; delta: number; pct: number | null }> = []
      const startIdx = Math.max(1, safeSeries.length - 3)
      for (let i = startIdx; i < safeSeries.length; i += 1) {
        const value = safeSeries[i]
        const prev = safeSeries[i - 1] ?? 0
        const delta = value - prev
        const pct = prev === 0 ? null : (delta / prev) * 100
        momRows.push({
          label: fullMonthLabels[i] ?? fullLabels[i] ?? '',
          value,
          delta,
          pct,
        })
      }

      const last = safeSeries[safeSeries.length - 1] ?? 0
      const prev = safeSeries[safeSeries.length - 2] ?? 0
      const lastDelta = last - prev
      const lastPct = prev === 0 ? null : (lastDelta / prev) * 100

      const projectionValues = linearProjection(trendValues, projectionMonths)
      const projectionLabels = makeFutureMonthLabels(nextMonthStart, projectionMonths, locale)
      const projectionTotal = projectionValues.reduce((sum, v) => sum + v, 0)

      out.set(cur, {
        trendLabels,
        trendValues,
        momRows,
        lastMonthValue: last,
        lastMonthDelta: lastDelta,
        lastMonthPct: lastPct,
        projectionLabels,
        projectionValues,
        projectionTotal,
      })
    }

    return out
  }, [currencies, language, monthlyProjectionByCurrency.byCurrency, monthlyProjectionByCurrency.labels, projectionMonths, trendWindow])

  const comparison = useMemo(() => {
    const a = state.subscriptions.find(s => s.id === compareA)
    const b = state.subscriptions.find(s => s.id === compareB)
    if (!a || !b) return null

    const aRaw = (a.currency || 'USD').toUpperCase()
    const bRaw = (b.currency || 'USD').toUpperCase()
    const sameCurrency = aRaw === bRaw
    const targetCurrency = displayMode === 'convertToBase' ? baseCurrency : aRaw

    const aMonthly = monthlyEquivalent(a)
    const bMonthly = monthlyEquivalent(b)
    const aAnnual = annualCost(a)
    const bAnnual = annualCost(b)

    const aShownMonthly = displayMode === 'convertToBase' ? convertCurrencySync(aMonthly, aRaw, baseCurrency) : aMonthly
    const bShownMonthly = displayMode === 'convertToBase' ? convertCurrencySync(bMonthly, bRaw, baseCurrency) : bMonthly
    const aShownAnnual = displayMode === 'convertToBase' ? convertCurrencySync(aAnnual, aRaw, baseCurrency) : aAnnual
    const bShownAnnual = displayMode === 'convertToBase' ? convertCurrencySync(bAnnual, bRaw, baseCurrency) : bAnnual

    const monthlyDelta = aShownMonthly - bShownMonthly
    const annualDelta = aShownAnnual - bShownAnnual
    const monthlyPct = bShownMonthly === 0 ? null : (monthlyDelta / bShownMonthly) * 100

    return {
      a,
      b,
      currency: targetCurrency,
      sameCurrency,
      monthly: { a: aShownMonthly, b: bShownMonthly, delta: monthlyDelta, pct: monthlyPct },
      annual: { a: aShownAnnual, b: bShownAnnual, delta: annualDelta },
      isComparable: displayMode === 'convertToBase' || sameCurrency,
    }
  }, [baseCurrency, compareA, compareB, displayMode, state.subscriptions])

  const annualTopByCurrency = useMemo(() => {
    const map = new Map<string, { label: string; value: number }[]>()
    for (const s of state.subscriptions) {
      const rawCur = (s.currency || 'USD').toUpperCase()
      const cur = displayMode === 'convertToBase' ? baseCurrency : rawCur
      const list = map.get(cur) ?? []
      const v = annualCost(s)
      list.push({ label: s.name, value: displayMode === 'convertToBase' ? convertCurrencySync(v, rawCur, baseCurrency) : v })
      map.set(cur, list)
    }

    for (const [cur, list] of map.entries()) {
      map.set(cur, list.sort((a, b) => b.value - a.value).slice(0, 6))
    }

    return map
  }, [baseCurrency, displayMode, fxTick, state.subscriptions])

  const monthlyDistributionByCurrency = useMemo(() => {
    const map = new Map<string, { label: string; value: number }[]>()
    for (const s of state.subscriptions) {
      const rawCur = (s.currency || 'USD').toUpperCase()
      const cur = displayMode === 'convertToBase' ? baseCurrency : rawCur
      const list = map.get(cur) ?? []
      const v = monthlyEquivalent(s)
      list.push({ label: s.name, value: displayMode === 'convertToBase' ? convertCurrencySync(v, rawCur, baseCurrency) : v })
      map.set(cur, list)
    }

    for (const [cur, list] of map.entries()) {
      const sorted = list.sort((a, b) => b.value - a.value)
      const top = sorted.slice(0, 5)
      const rest = sorted.slice(5)
      const restValue = rest.reduce((sum, i) => sum + i.value, 0)
      const next = restValue > 0 ? [...top, { label: t('common.other') ?? 'Otros', value: restValue }] : top
      map.set(cur, next)
    }

    return map
  }, [baseCurrency, displayMode, fxTick, state.subscriptions, t])

  const monthlyByCategoryByCurrency = useMemo(() => {
    const map = new Map<string, Map<string, number>>()

    for (const s of state.subscriptions) {
      const rawCur = (s.currency || 'USD').toUpperCase()
      const cur = displayMode === 'convertToBase' ? baseCurrency : rawCur
      const category = (s.category || '').trim() || (t('common.uncategorized') ?? 'Sin categoría')

      if (!map.has(cur)) map.set(cur, new Map<string, number>())
      const catMap = map.get(cur)!

      const v = monthlyEquivalent(s)
      const amt = displayMode === 'convertToBase' ? convertCurrencySync(v, rawCur, baseCurrency) : v
      catMap.set(category, (catMap.get(category) ?? 0) + amt)
    }

    const out = new Map<string, { label: string; value: number }[]>()
    for (const [cur, catMap] of map.entries()) {
      const items = Array.from(catMap.entries())
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value)

      const top = items.slice(0, 7)
      out.set(cur, top)
    }

    return out
  }, [baseCurrency, displayMode, fxTick, state.subscriptions, t])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-base font-extrabold text-slate-700 dark:text-slate-200 sm:text-lg">
          <GradientText>{t('dashboard.monthlySpendTitle') ?? 'Gasto mensual (equivalente)'}</GradientText>
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {totals.length === 0 ? (
            <div className="text-sm text-slate-500">{t('dashboard.noSubscriptionsYet') ?? 'Sin suscripciones aún.'}</div>
          ) : (
            totals.map(([cur, amt]) => (
              <div key={cur} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold dark:bg-slate-800">
                {formatCurrency(amt, cur)}
              </div>
            ))
          )}
        </div>
        {displayMode === 'convertToBase' ? (
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {t('dashboard.fxRatesLabel') ?? 'FX rates'}: {fxStatus === 'loading'
              ? (t('dashboard.fxUpdating') ?? 'actualizando…')
              : fxStatus === 'ready'
                ? (t('dashboard.fxReady') ?? 'reales (cacheadas)')
                : fxStatus === 'unavailable'
                  ? (t('dashboard.fxUnavailable') ?? 'no disponibles (fallback)')
                  : (t('dashboard.fxIdle') ?? '—')}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-base font-extrabold text-slate-700 dark:text-slate-200 sm:text-lg">
          <GradientText>{t('dashboard.upcomingRenewalsTitle') ?? 'Próximas renovaciones'}</GradientText>
        </div>
        <div className="mt-2 space-y-2">
          {nextItems.length === 0 ? (
            <div className="text-sm text-slate-500">{t('dashboard.noDataYet') ?? 'No hay datos todavía.'}</div>
          ) : (
            nextItems.map(({ s, next }) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
                <div className="font-semibold">{s.name}</div>
                <div className="text-slate-600 dark:text-slate-300">{next.toLocaleDateString(language === 'es' ? 'es-ES' : 'en-US')}</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-base font-extrabold text-slate-700 dark:text-slate-200 sm:text-lg">
            <GradientText>{t('dashboard.advancedSummaryTitle') ?? 'Panorama financiero'}</GradientText>
          </div>
        </div>

        {currencies.length === 0 ? (
          <div className="mt-2 text-sm text-slate-500">{t('dashboard.noSubscriptionsYet') ?? 'Sin suscripciones aún.'}</div>
        ) : (
          <div className="mt-3 space-y-4">
            {currencies.map(cur => {
              const advanced = advancedByCurrency.get(cur)
              if (!advanced) return null
              return (
                <div key={`advanced-${cur}`} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <GradientText>{t('dashboard.currencyLabel', { cur }) ?? `Moneda: ${cur}`}</GradientText>
                  </div>

                  <div className="mt-2 space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          <GradientText>{t('dashboard.trendTitle') ?? 'Tendencia mensual'}</GradientText>
                        </div>
                        <label className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-sm dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400">{t('dashboard.trendWindow') ?? 'Tendencia'}</span>
                          <select
                            className="bg-transparent text-sm font-semibold text-slate-700 focus:bg-slate-50 focus:outline-none dark:text-slate-200 dark:focus:bg-slate-800"
                            value={trendWindow}
                            onChange={e => setTrendWindow(Number(e.target.value) as 3 | 6 | 12)}
                          >
                            <option value={3}>3m</option>
                            <option value={6}>6m</option>
                            <option value={12}>12m</option>
                          </select>
                        </label>
                      </div>
                      <div className="mt-2">
                        <SimpleLineChart
                          labels={advanced.trendLabels}
                          values={advanced.trendValues}
                          formatValue={(v) => formatCurrency(v, cur)}
                          ariaLabel="Monthly trend"
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                          <div className="text-slate-500 dark:text-slate-400">{t('dashboard.lastMonth') ?? 'Último mes'}</div>
                          <div className="font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(advanced.lastMonthValue, cur)}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                          <div className="text-slate-500 dark:text-slate-400">{t('dashboard.momChange') ?? 'Cambio MoM'}</div>
                          <div className={`font-semibold ${advanced.lastMonthDelta >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                            {advanced.lastMonthDelta >= 0 ? '+' : ''}{formatCurrency(advanced.lastMonthDelta, cur)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                          <div className="text-slate-500 dark:text-slate-400">{t('dashboard.momPct') ?? '% MoM'}</div>
                          <div className="font-semibold text-slate-800 dark:text-slate-100">
                            {advanced.lastMonthPct === null ? (t('common.none') ?? '—') : `${advanced.lastMonthPct >= 0 ? '+' : ''}${advanced.lastMonthPct.toFixed(1)}%`}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 rounded-lg border border-dashed border-slate-200 p-2 text-xs dark:border-slate-800">
                        <div className="mb-1 font-semibold text-slate-600 dark:text-slate-300">{t('dashboard.momComparisons') ?? 'Comparativas mes a mes'}</div>
                        <div className="grid gap-1">
                          {advanced.momRows.map(row => (
                            <div key={`mom-${cur}-${row.label}`} className="flex items-center justify-between">
                              <div className="text-slate-500 dark:text-slate-400">{row.label}</div>
                              <div className="flex items-center gap-2 text-right">
                                <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(row.value, cur)}</span>
                                <span className={`text-[11px] font-semibold ${row.delta >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                                  {row.delta >= 0 ? '+' : ''}{formatCurrency(row.delta, cur)}
                                  {row.pct === null ? '' : ` (${row.pct >= 0 ? '+' : ''}${row.pct.toFixed(1)}%)`}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                          <GradientText>{t('dashboard.projectionTitle') ?? 'Proyección de gasto'}</GradientText>
                        </div>
                        <label className="flex items-center gap-2 rounded-md border border-slate-200 px-2 py-1 text-sm dark:border-slate-800">
                          <span className="text-slate-500 dark:text-slate-400">{t('dashboard.projectionWindow') ?? 'Proyección'}</span>
                          <select
                            className="bg-transparent text-sm font-semibold text-slate-700 focus:bg-slate-50 focus:outline-none dark:text-slate-200 dark:focus:bg-slate-800"
                            value={projectionMonths}
                            onChange={e => setProjectionMonths(Number(e.target.value) as 3 | 6)}
                          >
                            <option value={3}>3m</option>
                            <option value={6}>6m</option>
                          </select>
                        </label>
                      </div>
                      <div className="mt-2">
                        <SimpleLineChart
                          labels={advanced.projectionLabels}
                          values={advanced.projectionValues}
                          formatValue={(v) => formatCurrency(v, cur)}
                          ariaLabel="Projection"
                        />
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                          <div className="text-slate-500 dark:text-slate-400">{t('dashboard.nextMonthProjection') ?? 'Próximo mes'}</div>
                          <div className="font-semibold text-slate-800 dark:text-slate-100">
                            {formatCurrency(advanced.projectionValues[0] ?? 0, cur)}
                          </div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                          <div className="text-slate-500 dark:text-slate-400">
                            {t('dashboard.projectionTotal', { months: projectionMonths }) ?? `Total ${projectionMonths}m`}
                          </div>
                          <div className="font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(advanced.projectionTotal, cur)}</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
          <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
            <GradientText>{t('dashboard.subscriptionCompareTitle') ?? 'Comparativa entre suscripciones'}</GradientText>
          </div>

          {sortedSubscriptions.length < 2 ? (
            <div className="mt-2 text-sm text-slate-500">{t('dashboard.needMoreSubs') ?? 'Añade al menos dos suscripciones para comparar.'}</div>
          ) : (
            <div className="mt-3 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
              <div className="grid gap-2 sm:grid-cols-2">
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  {t('dashboard.compareA') ?? 'Suscripción A'}
                  <select
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                    value={compareA}
                    onChange={e => setCompareA(e.target.value)}
                  >
                    {sortedSubscriptions.map(s => (
                      <option key={`compare-a-${s.id}`} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-slate-500 dark:text-slate-400">
                  {t('dashboard.compareB') ?? 'Suscripción B'}
                  <select
                    className="mt-1 w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-sm font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200"
                    value={compareB}
                    onChange={e => setCompareB(e.target.value)}
                  >
                    {sortedSubscriptions.map(s => (
                      <option key={`compare-b-${s.id}`} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
                {!comparison ? (
                  <div className="text-slate-500">{t('dashboard.comparePlaceholder') ?? 'Selecciona dos suscripciones para comparar.'}</div>
                ) : !comparison.isComparable ? (
                  <div className="text-slate-500">
                    {t('dashboard.compareDifferentCurrencyHint') ?? 'Las suscripciones tienen monedas distintas. Activa “convertir a moneda base” para comparar.'}
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{comparison.a.name} vs {comparison.b.name}</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                        <div className="text-slate-500 dark:text-slate-400">{t('dashboard.monthlyCost') ?? 'Mensual'}</div>
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(comparison.monthly.a, comparison.currency)}</div>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                        <div className="text-slate-500 dark:text-slate-400">{t('dashboard.monthlyCost') ?? 'Mensual'}</div>
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(comparison.monthly.b, comparison.currency)}</div>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                        <div className="text-slate-500 dark:text-slate-400">{t('dashboard.annualCost') ?? 'Anual'}</div>
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(comparison.annual.a, comparison.currency)}</div>
                      </div>
                      <div className="rounded-md border border-slate-200 bg-slate-50 px-2 py-2 dark:border-slate-800 dark:bg-slate-950/40">
                        <div className="text-slate-500 dark:text-slate-400">{t('dashboard.annualCost') ?? 'Anual'}</div>
                        <div className="font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(comparison.annual.b, comparison.currency)}</div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2 py-2 text-xs dark:border-slate-800 dark:bg-slate-950/40">
                      <div className="text-slate-500 dark:text-slate-400">{t('dashboard.diffLabel') ?? 'Diferencia (A - B)'}</div>
                      <div className={`font-semibold ${comparison.monthly.delta >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                        {comparison.monthly.delta >= 0 ? '+' : ''}{formatCurrency(comparison.monthly.delta, comparison.currency)}
                        {comparison.monthly.pct === null ? '' : ` (${comparison.monthly.pct >= 0 ? '+' : ''}${comparison.monthly.pct.toFixed(1)}%)`}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-base font-extrabold text-slate-700 dark:text-slate-200 sm:text-lg">
          <GradientText>{t('dashboard.chartsTitle') ?? 'Gráficos'}</GradientText>
        </div>
        {state.subscriptions.length === 0 ? (
          <div className="mt-2 text-sm text-slate-500">{t('dashboard.addSubsToSeeCharts') ?? 'Añade suscripciones para ver gráficos.'}</div>
        ) : (
          <div className="mt-3 space-y-4">
            {currencies.map(cur => {
              const barItems = annualTopByCurrency.get(cur) ?? []
              const categoryItems = monthlyByCategoryByCurrency.get(cur) ?? []
              const pieItems = monthlyDistributionByCurrency.get(cur) ?? []
              return (
                <div key={cur} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                    <GradientText>{t('dashboard.currencyLabel', { cur }) ?? `Moneda: ${cur}`}</GradientText>
                  </div>

                  {(() => {
                    const ins = insightsByCurrency.get(cur)
                    if (!ins) return null
                    return (
                      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
                          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('dashboard.kpiSubscriptions') ?? 'Suscripciones'}</div>
                          <div className="mt-0.5 font-bold text-slate-900 dark:text-white">{ins.count}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
                          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('dashboard.kpiAvgMonthly') ?? 'Media mensual'}</div>
                          <div className="mt-0.5 font-bold text-slate-900 dark:text-white">{formatCurrency(ins.avgMonthly, cur)}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
                          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('dashboard.kpiDueSoon', { days: ins.windowDays }) ?? `Vencen (≤ ${ins.windowDays}d)`}</div>
                          <div className="mt-0.5 font-bold text-slate-900 dark:text-white">{ins.dueSoonCount}</div>
                        </div>
                        <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
                          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('dashboard.kpiTopCategory') ?? 'Top categoría'}</div>
                          <div className="mt-0.5 font-bold text-slate-900 dark:text-white">{ins.topCategory ? `${ins.topCategory.label} · ${ins.topCategory.pct}%` : (t('common.none') ?? '—')}</div>
                        </div>
                      </div>
                    )
                  })()}

                  <div className="mt-3 space-y-3">
                    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-base font-bold text-slate-700 dark:text-slate-200">
                          <GradientText>{t('dashboard.annualTopTitle') ?? 'Top gasto anual (estimado)'}</GradientText>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                            onClick={() => {
                              const el = chartElsRef.current.get(`${cur}:bar`)
                              if (!el) return
                              void exportElementToPng(el, `annual-top-${cur}.png`)
                            }}
                          >
                            PNG
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                            onClick={() => {
                              const rows: Array<Array<string | number>> = [[
                                t('dashboard.csvName') ?? 'Name',
                                t('dashboard.csvAnnualAmount') ?? 'AnnualAmount',
                                t('dashboard.csvCurrency') ?? 'Currency',
                              ]]
                              for (const item of barItems) {
                                rows.push([item.label, item.value, cur])
                              }
                              exportRowsToCsv(rows, `annual-top-${cur}.csv`)
                            }}
                          >
                            CSV
                          </button>
                        </div>
                      </div>
                      <div ref={setChartEl(`${cur}:bar`)} className="mt-3">
                        {barItems.length === 0 ? (
                          <div className="text-sm text-slate-500">{t('dashboard.noData') ?? 'Sin datos.'}</div>
                        ) : (
                          <SimpleBarChart items={barItems} colorClassName="text-indigo-500" formatValue={v => formatCurrency(v, cur)} />
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-base font-bold text-slate-700 dark:text-slate-200">
                          <GradientText>{t('dashboard.monthlyByCategoryTitle') ?? 'Gasto mensual por categoría (equivalente)'}</GradientText>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                            onClick={() => {
                              const el = chartElsRef.current.get(`${cur}:cat`)
                              if (!el) return
                              void exportElementToPng(el, `categories-${cur}.png`)
                            }}
                          >
                            PNG
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                            onClick={() => {
                              const rows: Array<Array<string | number>> = [[
                                t('dashboard.csvCategory') ?? 'Category',
                                t('dashboard.csvMonthlyEquivalent') ?? 'MonthlyEquivalent',
                                t('dashboard.csvCurrency') ?? 'Currency',
                              ]]
                              for (const item of categoryItems) {
                                rows.push([item.label, item.value, cur])
                              }
                              exportRowsToCsv(rows, `categories-${cur}.csv`)
                            }}
                          >
                            CSV
                          </button>
                        </div>
                      </div>
                      <div ref={setChartEl(`${cur}:cat`)} className="mt-3">
                        {categoryItems.length === 0 ? (
                          <div className="text-sm text-slate-500">{t('dashboard.noData') ?? 'Sin datos.'}</div>
                        ) : (
                          <SimpleBarChart items={categoryItems} colorClassName="text-sky-500" formatValue={v => formatCurrency(v, cur)} />
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-3">
                        <div className="text-base font-bold text-slate-700 dark:text-slate-200">
                          <GradientText>{t('dashboard.distributionTitle') ?? 'Distribución (gasto mensual equivalente)'}</GradientText>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                            onClick={() => {
                              const el = chartElsRef.current.get(`${cur}:pie`)
                              if (!el) return
                              void exportElementToPng(el, `distribution-${cur}.png`)
                            }}
                          >
                            PNG
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                            onClick={() => {
                              const rows: Array<Array<string | number>> = [[
                                t('dashboard.csvName') ?? 'Name',
                                t('dashboard.csvMonthlyEquivalent') ?? 'MonthlyEquivalent',
                                t('dashboard.csvCurrency') ?? 'Currency',
                              ]]
                              for (const seg of pieItems) {
                                rows.push([seg.label, seg.value, cur])
                              }
                              exportRowsToCsv(rows, `distribution-${cur}.csv`)
                            }}
                          >
                            CSV
                          </button>
                        </div>
                      </div>
                      <div ref={setChartEl(`${cur}:pie`)} className="mt-2">
                        <SimplePieChart segments={pieItems} formatValue={v => formatCurrency(v, cur)} />
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
