import { useMemo } from 'react'
import type { Subscription } from '../lib/types'
import { nextRenewalDate } from '../lib/storage'
import { useStore } from '../store'

function formatMoney(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

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

export function Dashboard() {
  const { state } = useStore()

  const totals = useMemo(() => {
    const byCurrency = new Map<string, number>()
    for (const s of state.subscriptions) {
      const cur = (s.currency || 'USD').toUpperCase()
      const current = byCurrency.get(cur) ?? 0
      byCurrency.set(cur, current + monthlyEquivalent(s))
    }
    return Array.from(byCurrency.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [state.subscriptions])

  const nextItems = useMemo(() => {
    const now = new Date()
    const list = state.subscriptions
      .map(s => ({ s, next: nextRenewalDate(s.startDate, s.period, now) }))
      .sort((a, b) => a.next.getTime() - b.next.getTime())
      .slice(0, 5)
    return list
  }, [state.subscriptions])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">Gasto mensual (equivalente)</div>
        <div className="mt-2 flex flex-wrap gap-2">
          {totals.length === 0 ? (
            <div className="text-sm text-slate-500">Sin suscripciones aún.</div>
          ) : (
            totals.map(([cur, amt]) => (
              <div key={cur} className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold dark:bg-slate-800">
                {formatMoney(amt, cur)}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">Próximas renovaciones</div>
        <div className="mt-2 space-y-2">
          {nextItems.length === 0 ? (
            <div className="text-sm text-slate-500">No hay datos todavía.</div>
          ) : (
            nextItems.map(({ s, next }) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-slate-800/60">
                <div className="font-semibold">{s.name}</div>
                <div className="text-slate-600 dark:text-slate-300">{next.toLocaleDateString()}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
