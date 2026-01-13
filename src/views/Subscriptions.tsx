import { useEffect, useMemo, useRef, useState } from 'react'
import { MAJOR_CURRENCIES } from '../lib/types'
import type { Period, Subscription } from '../lib/types'
import { createId, nextRenewalDate } from '../lib/storage'
import { buildGoogleCalendarEventEditUrl } from '../lib/googleCalendar'
import { convertCurrencySync, formatCurrency } from '../lib/money'
import { useStore } from '../store'

const PERIODS: { value: Period; label: string }[] = [
  { value: 'monthly', label: 'Mensual' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'annual', label: 'Anual' },
]

function parseMoney(v: string) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function isValidYmd(ymd: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(ymd || '').trim())
}

export function SubscriptionsView() {
  const { state, setSubscriptions } = useStore()
  const displayMode = state.settings.currencyDisplayMode ?? 'original'
  const baseCurrency = (state.settings.baseCurrency || 'USD').toUpperCase()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const editing = useMemo(
    () => state.subscriptions.find(s => s.id === editingId) ?? null,
    [editingId, state.subscriptions],
  )

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [period, setPeriod] = useState<Period>('monthly')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))

  const canSubmit = useMemo(() => {
    const trimmedName = name.trim()
    const trimmedPrice = price.trim()
    if (!trimmedName) return false
    if (!trimmedPrice) return false
    if (!Number.isFinite(Number(trimmedPrice))) return false
    if (!currency.trim()) return false
    if (!period) return false
    if (!isValidYmd(startDate)) return false
    return true
  }, [currency, name, period, price, startDate])

  function resetForm() {
    setEditingId(null)
    setName('')
    setCategory('')
    setPrice('')
    setCurrency('USD')
    setPeriod('monthly')
    setStartDate(new Date().toISOString().slice(0, 10))
  }

  function closeModal() {
    setIsModalOpen(false)
    resetForm()
  }

  function openCreateModal() {
    resetForm()
    setIsModalOpen(true)
  }

  function loadForEdit(s: Subscription) {
    setEditingId(s.id)
    setName(s.name)
    setCategory(s.category ?? '')
    setPrice(String(s.price))
    const normalized = String(s.currency ?? '').trim().toUpperCase()
    const allowed = MAJOR_CURRENCIES.some(c => c.code === normalized)
    setCurrency(allowed ? normalized : 'USD')
    setPeriod(s.period)
    setStartDate(s.startDate)
    setIsModalOpen(true)
  }

  function upsert() {
    const trimmed = name.trim()
    const trimmedPrice = price.trim()
    if (!trimmed) return
    if (!trimmedPrice) return
    if (!Number.isFinite(Number(trimmedPrice))) return
    if (!currency.trim()) return
    if (!period) return
    if (!isValidYmd(startDate)) return

    const cat = category.trim()

    const next: Subscription = {
      id: editingId ?? createId(),
      name: trimmed,
      category: cat ? cat : undefined,
      price: parseMoney(price),
      currency,
      period,
      startDate,
    }

    const list = state.subscriptions.slice()
    const idx = list.findIndex(s => s.id === next.id)
    if (idx >= 0) list[idx] = next
    else list.unshift(next)
    setSubscriptions(list)
    closeModal()
  }

  function remove(id: string) {
    setSubscriptions(state.subscriptions.filter(s => s.id !== id))
    if (editingId === id) resetForm()
  }

  function openCalendarDraft(s: Subscription) {
    const next = nextRenewalDate(s.startDate, s.period, new Date())
    const rawCur = (s.currency || 'USD').toUpperCase()
    const shownCurrency = displayMode === 'convertToBase' ? baseCurrency : rawCur
    const shownAmount = displayMode === 'convertToBase' ? convertCurrencySync(s.price, rawCur, baseCurrency) : s.price
    const url = buildGoogleCalendarEventEditUrl({
      title: `${s.name} · Renovación`,
      details: `Importe: ${formatCurrency(shownAmount, shownCurrency)}\nPeriodo: ${s.period}`,
      startDate: next,
      allDay: true,
      recurrence: { period: s.period },
    })
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  useEffect(() => {
    if (!isModalOpen) return

    const t = window.setTimeout(() => {
      nameInputRef.current?.focus()
    }, 0)

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeModal()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [isModalOpen])

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">Listado</div>
          <button type="button" className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500" onClick={openCreateModal}>
            Añadir suscripción
          </button>
        </div>
        <div className="mt-3 space-y-2">
          {state.subscriptions.length === 0 ? (
            <div className="text-sm text-slate-500">No hay suscripciones aún.</div>
          ) : (
            state.subscriptions.map(s => (
              <div key={s.id} className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {(() => {
                      const rawCur = (s.currency || 'USD').toUpperCase()
                      const shownCurrency = displayMode === 'convertToBase' ? baseCurrency : rawCur
                      const shownAmount = displayMode === 'convertToBase' ? convertCurrencySync(s.price, rawCur, baseCurrency) : s.price
                      return formatCurrency(shownAmount, shownCurrency)
                    })()} · {s.period}{s.category ? ` · ${s.category}` : ''} · Inicio: {s.startDate} · Próximo: {nextRenewalDate(s.startDate, s.period, new Date()).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-md bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-500"
                    onClick={() => openCalendarDraft(s)}
                  >
                    Añadir a Calendar
                  </button>
                  <button
                    type="button"
                    aria-label="Editar"
                    title="Editar"
                    className="inline-flex items-center justify-center rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                    onClick={() => loadForEdit(s)}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                    </svg>
                    <span className="sr-only">Editar</span>
                  </button>
                  <button
                    type="button"
                    aria-label="Eliminar"
                    title="Eliminar"
                    className="inline-flex items-center justify-center rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-500"
                    onClick={() => remove(s.id)}
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M3 6h18" />
                      <path d="M8 6V4h8v2" />
                      <path d="M6 6l1 14h10l1-14" />
                      <path d="M10 11v6" />
                      <path d="M14 11v6" />
                    </svg>
                    <span className="sr-only">Eliminar</span>
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-950/50" onClick={closeModal} />
          <div className="relative mx-auto w-full max-w-3xl px-4 py-6">
            <div role="dialog" aria-modal="true" className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {editing ? 'Editar suscripción' : 'Añadir suscripción'}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-1 font-semibold">Nombre</div>
                  <input
                    ref={nameInputRef}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-semibold">Categoría</div>
                  <input
                    list="subly-categories"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder="Ej: Streaming"
                  />
                  <datalist id="subly-categories">
                    <option value="Streaming" />
                    <option value="Software" />
                    <option value="Música" />
                    <option value="Juegos" />
                    <option value="Productividad" />
                    <option value="Educación" />
                    <option value="Salud" />
                    <option value="Otros" />
                  </datalist>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-semibold">Importe</div>
                  <input
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                  />
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-semibold">Moneda</div>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                  >
                    {MAJOR_CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol}) — {c.names.es}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-semibold">Periodo</div>
                  <select className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={period} onChange={e => setPeriod(e.target.value as Period)}>
                    {PERIODS.map(p => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-semibold">Fecha inicio</div>
                  <input type="date" className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={startDate} onChange={e => setStartDate(e.target.value)} />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={!canSubmit}
                  aria-disabled={!canSubmit}
                  className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={upsert}
                >
                  {editing ? 'Guardar' : 'Añadir'}
                </button>
                <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" onClick={closeModal}>
                  Cancelar
                </button>
                {!canSubmit ? (
                  <div className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                    Completa nombre, importe y fecha.
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
