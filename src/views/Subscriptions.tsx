import { useMemo, useState } from 'react'
import type { Period, Subscription } from '../lib/types'
import { createId, nextRenewalDate } from '../lib/storage'
import { buildGoogleCalendarEventEditUrl } from '../lib/googleCalendar'
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

export function SubscriptionsView() {
  const { state, setSubscriptions, setSettings } = useStore()
  const [editingId, setEditingId] = useState<string | null>(null)

  const editing = useMemo(
    () => state.subscriptions.find(s => s.id === editingId) ?? null,
    [editingId, state.subscriptions],
  )

  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [period, setPeriod] = useState<Period>('monthly')
  const [startDate, setStartDate] = useState(() => new Date().toISOString().slice(0, 10))

  function resetForm() {
    setEditingId(null)
    setName('')
    setPrice('')
    setCurrency('USD')
    setPeriod('monthly')
    setStartDate(new Date().toISOString().slice(0, 10))
  }

  function loadForEdit(s: Subscription) {
    setEditingId(s.id)
    setName(s.name)
    setPrice(String(s.price))
    setCurrency(s.currency)
    setPeriod(s.period)
    setStartDate(s.startDate)
  }

  function upsert() {
    const trimmed = name.trim()
    if (!trimmed) return

    const next: Subscription = {
      id: editingId ?? createId(),
      name: trimmed,
      price: parseMoney(price),
      currency: currency.trim().toUpperCase() || 'USD',
      period,
      startDate,
    }

    const list = state.subscriptions.slice()
    const idx = list.findIndex(s => s.id === next.id)
    if (idx >= 0) list[idx] = next
    else list.unshift(next)
    setSubscriptions(list)
    resetForm()
  }

  function remove(id: string) {
    setSubscriptions(state.subscriptions.filter(s => s.id !== id))
    if (editingId === id) resetForm()
  }

  function openCalendarDraft(s: Subscription) {
    const next = nextRenewalDate(s.startDate, s.period, new Date())
    const url = buildGoogleCalendarEventEditUrl({
      title: `${s.name} · Renovación`,
      details: `Importe: ${s.price} ${s.currency}\nPeriodo: ${s.period}`,
      startDate: next,
      allDay: true,
      recurrence: { period: s.period },
    })
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  function toggleNotifications(enabled: boolean) {
    setSettings({
      ...state.settings,
      notificationsEnabled: enabled,
    })
  }

  function setNotifyDaysBefore(raw: string) {
    const n = Number(raw)
    const next = Number.isFinite(n) ? Math.max(0, Math.min(30, Math.floor(n))) : 0
    setSettings({
      ...state.settings,
      notifyDaysBefore: next,
    })
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">Alertas</div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={state.settings.notificationsEnabled}
              onChange={e => toggleNotifications(e.target.checked)}
              className="h-4 w-4"
            />
            Activar notificaciones
          </label>

          <label className="text-sm">
            <div className="mb-1 font-semibold">Avisar (días antes)</div>
            <input
              type="number"
              min={0}
              max={30}
              className="w-40 rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={state.settings.notifyDaysBefore}
              onChange={e => setNotifyDaysBefore(e.target.value)}
              disabled={!state.settings.notificationsEnabled}
            />
          </label>
        </div>
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Las alertas se muestran como notificaciones del navegador. Si también quieres recordatorios en Google Calendar, usa “Añadir a Calendar” y configúralos al crear el evento.
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
          {editing ? 'Editar suscripción' : 'Añadir suscripción'}
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <div className="mb-1 font-semibold">Nombre</div>
            <input className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={name} onChange={e => setName(e.target.value)} />
          </label>

          <label className="text-sm">
            <div className="mb-1 font-semibold">Importe</div>
            <input className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={price} onChange={e => setPrice(e.target.value)} />
          </label>

          <label className="text-sm">
            <div className="mb-1 font-semibold">Moneda</div>
            <input className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={currency} onChange={e => setCurrency(e.target.value)} />
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
          <button type="button" className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500" onClick={upsert}>
            {editing ? 'Guardar' : 'Añadir'}
          </button>
          <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" onClick={resetForm}>
            Cancelar
          </button>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">Listado</div>
        <div className="mt-3 space-y-2">
          {state.subscriptions.length === 0 ? (
            <div className="text-sm text-slate-500">No hay suscripciones aún.</div>
          ) : (
            state.subscriptions.map(s => (
              <div key={s.id} className="flex flex-col gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="font-semibold">{s.name}</div>
                  <div className="text-xs text-slate-600 dark:text-slate-300">
                    {s.price} {s.currency} · {s.period} · Inicio: {s.startDate} · Próximo: {nextRenewalDate(s.startDate, s.period, new Date()).toLocaleDateString()}
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
                  <button type="button" className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" onClick={() => loadForEdit(s)}>
                    Editar
                  </button>
                  <button type="button" className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-500" onClick={() => remove(s.id)}>
                    Eliminar
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
