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
        <div className="text-base font-extrabold text-slate-700 dark:text-slate-200 sm:text-lg">
          <GradientText>{t('dashboard.chartsTitle') ?? 'Gráficos'}</GradientText>
        </div>
        {state.subscriptions.length === 0 ? (
          <div className="mt-2 text-sm text-slate-500">{t('dashboard.addSubsToSeeCharts') ?? 'Añade suscripciones para ver gráficos.'}</div>
        ) : (
          <div className="mt-3 space-y-4">
            {currencies.map(cur => {
              const lineValues = monthlyProjectionByCurrency.byCurrency.get(cur) ?? []
              const barItems = annualTopByCurrency.get(cur) ?? []
              const categoryItems = monthlyByCategoryByCurrency.get(cur) ?? []
              const pieItems = monthlyDistributionByCurrency.get(cur) ?? []
              return (
                <div key={cur} className="rounded-xl bg-slate-50 p-3 dark:bg-slate-800/60">
                  <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">{t('dashboard.currencyLabel', { cur }) ?? `Moneda: ${cur}`}</div>

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
                          <GradientText>{t('dashboard.projectionTitle') ?? 'Proyección mensual (últimos 12 meses)'}</GradientText>
                        </div>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                            onClick={() => {
                              const el = chartElsRef.current.get(`${cur}:line`)
                              if (!el) return
                              void exportElementToPng(el, `monthly-${cur}.png`)
                            }}
                          >
                            PNG
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                            onClick={() => {
                              const rows: Array<Array<string | number>> = [[
                                t('dashboard.csvMonth') ?? 'Month',
                                t('dashboard.csvAmount') ?? 'Amount',
                                t('dashboard.csvCurrency') ?? 'Currency',
                              ]]
                              for (let i = 0; i < monthlyProjectionByCurrency.labels.length; i++) {
                                rows.push([monthlyProjectionByCurrency.labels[i], lineValues[i] ?? 0, cur])
                              }
                              exportRowsToCsv(rows, `monthly-${cur}.csv`)
                            }}
                          >
                            CSV
                          </button>
                        </div>
                      </div>
                      <div ref={setChartEl(`${cur}:line`)} className="mt-2">
                        <SimpleLineChart
                          ariaLabel={`Proyección mensual ${cur}`}
                          labels={monthlyProjectionByCurrency.labels}
                          values={lineValues}
                          formatValue={v => formatCurrency(v, cur)}
                        />
                      </div>
                    </div>

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
