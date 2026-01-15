import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MAJOR_CURRENCIES } from '../lib/types'
import type { Period, Subscription } from '../lib/types'
import { createId, nextRenewalDate } from '../lib/storage'
import { deleteCalendarEvent, ensureSubscriptionsCalendar, formatDateYMDLocal, upsertRecurringAllDayEvent } from '../lib/googleCalendar'
import { convertCurrencySync, formatCurrency } from '../lib/money'
import { ImportExport } from '../components/ImportExport'
import { useToast } from '../components/Toast'
import { useStore } from '../store'
import { useI18n } from '../lib/i18n'

function localeForLanguage(language: 'es' | 'en') {
  return language === 'es' ? 'es-ES' : 'en-US'
}

function parseMoney(v: string) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
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

function isValidYmd(ymd: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(ymd || '').trim())
}

function computeSyncSignature(subscriptions: Subscription[]) {
  return JSON.stringify(
    subscriptions.map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      price: s.price,
      currency: s.currency,
      period: s.period,
      startDate: s.startDate,
    })),
  )
}

export function SubscriptionsView() {
  const { state, setSubscriptions, setSettings } = useStore()
  const { t, language } = useI18n()
  const toast = useToast()
  const displayMode = state.settings.currencyDisplayMode ?? 'original'
  const baseCurrency = (state.settings.baseCurrency || 'USD').toUpperCase()
  const calendarAutoSyncAll = Boolean(state.settings.calendarAutoSyncAll)
  const calendarUseDedicatedCalendar = Boolean(state.settings.calendarUseDedicatedCalendar)

  const settingsRef = useRef(state.settings)
  useEffect(() => {
    settingsRef.current = state.settings
  }, [state.settings])

  const subscriptionsCalendarIdRef = useRef<string | null>(state.settings.calendarSubscriptionsCalendarId ?? null)
  useEffect(() => {
    subscriptionsCalendarIdRef.current = state.settings.calendarSubscriptionsCalendarId ?? null
  }, [state.settings.calendarSubscriptionsCalendarId])

  const subscriptionsRef = useRef<Subscription[]>(state.subscriptions)
  useEffect(() => {
    subscriptionsRef.current = state.subscriptions
  }, [state.subscriptions])

  const [syncBusyAll, setSyncBusyAll] = useState(false)

  const [editingId, setEditingId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const nameInputRef = useRef<HTMLInputElement | null>(null)

  const [searchTerm, setSearchTerm] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [filterCategory, setFilterCategory] = useState('')
  const [filterCurrency, setFilterCurrency] = useState('')
  const [filterPeriod, setFilterPeriod] = useState<'' | Period>('')
  const [filterMinPrice, setFilterMinPrice] = useState('')
  const [filterMaxPrice, setFilterMaxPrice] = useState('')

  type SortColumn = 'name' | 'price' | 'startDate' | 'nextRenewal' | 'category'
  const [sort, setSort] = useState<{ column: SortColumn; direction: 'asc' | 'desc' }>({ column: 'nextRenewal', direction: 'asc' })

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

    const isEdit = Boolean(editingId)
    const existing = editingId ? state.subscriptions.find(s => s.id === editingId) : undefined
    const next: Subscription = {
      ...existing,
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

    // Keep refs in sync so a subsequent sync sees the latest data.
    subscriptionsRef.current = list
    // If auto-sync is enabled, avoid triggering the background syncAll for this same change.
    if (calendarAutoSyncAll) {
      lastSyncSignatureRef.current = computeSyncSignature(list)
    }

    setSubscriptions(list)
    closeModal()

    toast.success(
      isEdit
        ? (t('subscriptions.toastUpdated') ?? 'Suscripción actualizada.')
        : (t('subscriptions.toastCreated') ?? 'Suscripción creada.'),
    )

    // Auto-configure the Calendar event on add/edit when enabled.
    if (calendarAutoSyncAll) {
      void (async () => {
        const result = await syncOne(next.id, true, { quiet: true })
        if (!result.ok) {
          toast.error(
            (t('subscriptions.syncFailed') ?? 'Error al sincronizar.') +
              (result.error ? ` ${result.error}` : ''),
          )
        }
      })()
    }
  }

  function remove(id: string) {
    const current = subscriptionsRef.current
    const s = current.find(x => x.id === id)
    if (!s) return

    const confirmText =
      t('subscriptions.deleteConfirm', { name: s.name }) ??
      `¿Eliminar “${s.name}”? También se borrará su evento en Google Calendar si existe.`

    if (!window.confirm(confirmText)) return

    const eventId = s.calendar?.eventId
    const calendarId = s.calendar?.calendarId ?? 'primary'

    const nextList = current.filter(x => x.id !== id)
    subscriptionsRef.current = nextList
    // Avoid triggering syncAll for a deletion (syncAll can't delete events).
    if (calendarAutoSyncAll) {
      lastSyncSignatureRef.current = computeSyncSignature(nextList)
    }

    setSubscriptions(nextList)
    if (editingId === id) resetForm()
    toast.success(t('subscriptions.toastDeleted') ?? 'Suscripción eliminada.')

    if (eventId) {
      void (async () => {
        try {
          await deleteCalendarEvent({ calendarId, eventId, interactive: true })
          toast.success(t('subscriptions.calendarEventDeleted') ?? 'Evento eliminado de Google Calendar.')
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          toast.error(
            (t('subscriptions.calendarDeleteFailed') ?? 'No se pudo borrar el evento en Google Calendar.') +
              (msg ? ` ${msg}` : ''),
          )
        }
      })()
    }
  }

  const syncSignature = useMemo(() => computeSyncSignature(state.subscriptions), [state.subscriptions])

  const lastSyncSignatureRef = useRef(syncSignature)
  useEffect(() => {
    lastSyncSignatureRef.current = syncSignature
  }, [])

  const syncOne = useCallback(async (
    id: string,
    interactive: boolean,
    opts?: { quiet?: boolean },
  ): Promise<{ ok: boolean; error?: string }> => {
    try {
      const current = subscriptionsRef.current
      const idx = current.findIndex(s => s.id === id)
      if (idx < 0) return { ok: false, error: 'Subscription not found' }
      const s = current[idx]

      let targetCalendarId = s.calendar?.calendarId ?? 'primary'
      if (calendarUseDedicatedCalendar) {
        let ensured = subscriptionsCalendarIdRef.current
        if (!ensured) {
          ensured = await ensureSubscriptionsCalendar({ interactive })
          subscriptionsCalendarIdRef.current = ensured
          setSettings({
            ...settingsRef.current,
            calendarSubscriptionsCalendarId: ensured,
          })
        }
        targetCalendarId = ensured
      }

      const next = nextRenewalDate(s.startDate, s.period, new Date())
      const startYmd = formatDateYMDLocal(next)

      const rawCur = (s.currency || 'USD').toUpperCase()
      const shownCurrency = displayMode === 'convertToBase' ? baseCurrency : rawCur
      const shownAmount = displayMode === 'convertToBase' ? convertCurrencySync(s.price, rawCur, baseCurrency) : s.price

      const detailsLines = [
        `${t('subscriptions.detailsAmount') ?? 'Importe'}: ${formatCurrency(shownAmount, shownCurrency)}`,
        `${t('subscriptions.detailsPeriod') ?? 'Periodo'}: ${s.period}`,
      ]
      const cat = String(s.category || '').trim()
      if (cat) detailsLines.push(`${t('subscriptions.filterCategory') ?? 'Categoría'}: ${cat}`)

      // If an existing event lives in a different calendar, migrate it by deleting the old one
      // and creating a new event in the target calendar.
      const existingEventId = s.calendar?.eventId
      const existingCalendarId = s.calendar?.calendarId
      const shouldMigrate = Boolean(existingEventId && existingCalendarId && existingCalendarId !== targetCalendarId)
      if (shouldMigrate) {
        try {
          await deleteCalendarEvent({ calendarId: existingCalendarId, eventId: existingEventId!, interactive })
        } catch {
          // Best-effort migration. If deletion fails, continue to create the event in the target calendar.
        }
      }

      const link = await upsertRecurringAllDayEvent({
        calendarId: targetCalendarId,
        eventId: shouldMigrate ? undefined : s.calendar?.eventId,
        summary: `${s.name} · ${t('subscriptions.renewal') ?? 'Renovación'}`,
        description: detailsLines.join('\n'),
        startDateYmd: startYmd,
        period: s.period,
        interactive,
      })

      const updated = current.slice()
      updated[idx] = {
        ...s,
        calendar: {
          ...link,
          lastError: undefined,
        },
      }
      setSubscriptions(updated)
      return { ok: true }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      const current = subscriptionsRef.current
      const idx = current.findIndex(s => s.id === id)
      if (idx >= 0) {
        const s = current[idx]
        const updated = current.slice()
        updated[idx] = {
          ...s,
          calendar: {
            ...(s.calendar ?? { calendarId: 'primary' }),
            lastError: msg,
            syncedAt: s.calendar?.syncedAt,
          },
        }
        setSubscriptions(updated)
      }
      return { ok: false, error: msg }
    } finally {
    }
  }, [baseCurrency, calendarUseDedicatedCalendar, displayMode, setSettings, setSubscriptions, t])

  const syncAll = useCallback(async (interactive: boolean) => {
    if (syncBusyAll) return
    setSyncBusyAll(true)
    try {
      const list = subscriptionsRef.current
      let ok = 0
      let fail = 0
      let firstError: string | null = null

      for (const s of list) {
        const result = await syncOne(s.id, interactive, { quiet: true })
        if (result.ok) ok += 1
        else {
          fail += 1
          if (!firstError && result.error) firstError = result.error
        }
      }

      const baseMsg = t('subscriptions.syncAllDone', { ok, fail }) ?? `Sync: ${ok} ok, ${fail} fail`
      if (fail > 0) toast.error(fail > 0 && firstError ? `${baseMsg} (${firstError})` : baseMsg)
      else toast.success(baseMsg)
    } finally {
      setSyncBusyAll(false)
    }
  }, [syncBusyAll, syncOne, t, toast])

  useEffect(() => {
    if (!calendarAutoSyncAll) {
      lastSyncSignatureRef.current = syncSignature
      return
    }
    if (syncBusyAll) return
    if (lastSyncSignatureRef.current === syncSignature) return
    lastSyncSignatureRef.current = syncSignature
    void syncAll(false)
  }, [calendarAutoSyncAll, syncAll, syncBusyAll, syncSignature])

  const categories = useMemo(() => {
    return language === 'es'
      ? ['Streaming', 'Software', 'Música', 'Juegos', 'Productividad', 'Educación', 'Salud', 'Otros']
      : ['Streaming', 'Software', 'Music', 'Games', 'Productivity', 'Education', 'Health', 'Other']
  }, [language])

  const PERIODS: { value: Period; label: string }[] = useMemo(() => (
    [
      { value: 'monthly', label: t('subscriptions.periodMonthly') ?? 'Mensual' },
      { value: 'quarterly', label: t('subscriptions.periodQuarterly') ?? 'Trimestral' },
      { value: 'semiannual', label: t('subscriptions.periodSemiannual') ?? 'Semestral' },
      { value: 'annual', label: t('subscriptions.periodAnnual') ?? 'Anual' },
    ]
  ), [t])

  const periodLabelMap = useMemo<Record<Period, string>>(() => ({
    monthly: t('subscriptions.periodMonthly') ?? 'Mensual',
    quarterly: t('subscriptions.periodQuarterly') ?? 'Trimestral',
    semiannual: t('subscriptions.periodSemiannual') ?? 'Semestral',
    annual: t('subscriptions.periodAnnual') ?? 'Anual',
  }), [t])

  const availableCurrencies = useMemo(() => {
    const set = new Set<string>()
    for (const s of state.subscriptions) {
      const code = String(s.currency || '').trim().toUpperCase()
      if (code) set.add(code)
    }
    set.add(baseCurrency)
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [baseCurrency, state.subscriptions])

  const dueWindowDays = useMemo(() => {
    const n = Number(state.settings.notifyDaysBefore)
    return Number.isFinite(n) ? Math.max(0, Math.min(30, Math.floor(n))) : 2
  }, [state.settings.notifyDaysBefore])

  const enriched = useMemo(() => {
    const now = new Date()
    const dueThreshold = new Date(now)
    dueThreshold.setDate(dueThreshold.getDate() + dueWindowDays)

    return state.subscriptions.map(s => {
      const next = nextRenewalDate(s.startDate, s.period, now)
      const rawCur = (s.currency || 'USD').toUpperCase()
      const monthlyEqBase = convertCurrencySync(monthlyEquivalent(s), rawCur, baseCurrency)
      const dueSoon = next.getTime() <= dueThreshold.getTime()

      return {
        ...s,
        rawCurrency: rawCur,
        nextRenewal: next,
        dueSoon,
        monthlyEqBase,
      }
    })
  }, [baseCurrency, dueWindowDays, state.subscriptions])

  const insights = useMemo(() => {
    const count = state.subscriptions.length
    if (count === 0) {
      return {
        count,
        avgMonthlyBase: 0,
        highest: null as null | { name: string; valueBase: number },
        dueSoonCount: 0,
        nextDueDate: null as null | Date,
        topCategory: null as null | { label: string; percent: number },
      }
    }

    const totalsByCategory = new Map<string, number>()
    let sum = 0
    let highest: null | { name: string; valueBase: number } = null
    let dueSoonCount = 0
    let nextDue: Date | null = null

    for (const s of enriched) {
      sum += s.monthlyEqBase
      if (!highest || s.monthlyEqBase > highest.valueBase) {
        highest = { name: s.name, valueBase: s.monthlyEqBase }
      }
      if (s.dueSoon) dueSoonCount += 1
      if (!nextDue || s.nextRenewal.getTime() < nextDue.getTime()) nextDue = s.nextRenewal

      const cat = String(s.category || '').trim() || (t('common.uncategorized') ?? 'Sin categoría')
      totalsByCategory.set(cat, (totalsByCategory.get(cat) ?? 0) + s.monthlyEqBase)
    }

    let topCategory: null | { label: string; percent: number } = null
    if (sum > 0 && totalsByCategory.size > 0) {
      let best: null | { label: string; value: number } = null
      for (const [label, value] of totalsByCategory.entries()) {
        if (!best || value > best.value) best = { label, value }
      }
      if (best) topCategory = { label: best.label, percent: Math.round((best.value / sum) * 100) }
    }

    return {
      count,
      avgMonthlyBase: sum / count,
      highest,
      dueSoonCount,
      nextDueDate: nextDue,
      topCategory,
    }
  }, [enriched, state.subscriptions.length, t])

  const clearFilters = useCallback(() => {
    setFilterCategory('')
    setFilterCurrency('')
    setFilterPeriod('')
    setFilterMinPrice('')
    setFilterMaxPrice('')
    setSearchTerm('')
  }, [])

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      searchTerm.trim() ||
      filterCategory.trim() ||
      filterCurrency.trim() ||
      filterPeriod ||
      filterMinPrice.trim() ||
      filterMaxPrice.trim(),
    )
  }, [filterCategory, filterCurrency, filterMaxPrice, filterMinPrice, filterPeriod, searchTerm])

  const filtered = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    const min = filterMinPrice.trim() ? Number(filterMinPrice) : null
    const max = filterMaxPrice.trim() ? Number(filterMaxPrice) : null

    return enriched.filter(s => {
      if (filterCategory.trim()) {
        const cat = String(s.category || '').trim()
        if (cat.toLowerCase() !== filterCategory.trim().toLowerCase()) return false
      }
      if (filterCurrency.trim()) {
        if (s.rawCurrency !== filterCurrency.trim().toUpperCase()) return false
      }
      if (filterPeriod) {
        if (s.period !== filterPeriod) return false
      }
      if (min !== null && Number.isFinite(min) && s.price < min) return false
      if (max !== null && Number.isFinite(max) && s.price > max) return false

      if (!query) return true
      const haystack = [
        s.name,
        s.category,
        s.rawCurrency,
        s.period,
        periodLabelMap[s.period],
        String(s.price),
        formatCurrency(s.price, s.rawCurrency),
      ]

      return haystack.some(v => String(v || '').toLowerCase().includes(query))
    })
  }, [enriched, filterCategory, filterCurrency, filterMaxPrice, filterMinPrice, filterPeriod, periodLabelMap, searchTerm])

  const toggleSort = useCallback((column: SortColumn) => {
    setSort(prev => {
      if (prev.column === column) {
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
      }
      return { column, direction: 'asc' }
    })
  }, [])

  const sorted = useMemo(() => {
    const collator = new Intl.Collator(undefined, { sensitivity: 'base' })
    const direction = sort.direction === 'asc' ? 1 : -1

    const parseStart = (ymd: string) => {
      const ts = Date.parse(`${String(ymd || '').slice(0, 10)}T00:00:00`)
      return Number.isFinite(ts) ? ts : 0
    }

    const compare = (a: typeof filtered[number], b: typeof filtered[number]) => {
      switch (sort.column) {
        case 'name':
          return collator.compare(a.name, b.name) * direction
        case 'price':
          return (a.price - b.price) * direction
        case 'startDate':
          return (parseStart(a.startDate) - parseStart(b.startDate)) * direction
        case 'category': {
          const ac = String(a.category || '').trim() || (t('common.uncategorized') ?? 'Sin categoría')
          const bc = String(b.category || '').trim() || (t('common.uncategorized') ?? 'Sin categoría')
          return collator.compare(ac, bc) * direction
        }
        case 'nextRenewal':
        default:
          return (a.nextRenewal.getTime() - b.nextRenewal.getTime()) * direction
      }
    }

    return [...filtered].sort(compare)
  }, [filtered, sort.column, sort.direction])

  const SortHeaderButton = ({ column, label }: { column: SortColumn; label: string }) => {
    const isActive = sort.column === column
    return (
      <button
        type="button"
        onClick={() => toggleSort(column)}
        aria-pressed={isActive}
        className={
          `group inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1 text-center text-xs font-bold uppercase tracking-wide hover:bg-slate-100 dark:hover:bg-slate-800 ` +
          (isActive
            ? 'bg-indigo-50 text-indigo-950 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-100 dark:ring-indigo-700'
            : 'text-slate-700 dark:text-slate-200')
        }
      >
        <span className="truncate">{label}</span>
        <svg
          className={`h-3.5 w-3.5 flex-none transition-transform ${isActive ? 'opacity-100' : 'opacity-40 group-hover:opacity-70'} ${isActive && sort.direction === 'desc' ? 'rotate-180' : ''}`}
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 10l3-5 3 5" />
        </svg>
      </button>
    )
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
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('subscriptions.listTitle') ?? 'Listado'}</div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('subscriptions.subtitle') ?? ''}</div>
        </div>
        <div className="flex items-center gap-2">
          <ImportExport items={state.subscriptions} onImport={setSubscriptions} />
          <button
            type="button"
            className={`rounded-md bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-60`}
            disabled={state.subscriptions.length === 0 || syncBusyAll}
            onClick={() => syncAll(true)}
            title={t('subscriptions.syncAll') ?? 'Sincronizar todas'}
          >
            {syncBusyAll ? (t('subscriptions.syncing') ?? 'Sincronizando…') : (t('subscriptions.syncAll') ?? 'Sync todas')}
          </button>
          <button
            type="button"
            className="rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            onClick={openCreateModal}
          >
            {t('subscriptions.addSubscription') ?? 'Añadir suscripción'}
          </button>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('subscriptions.insightsTitle') ?? 'Resumen'}</div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('subscriptions.insightsHint', { currency: baseCurrency }) ?? ''}</div>
          </div>
          <div className="text-xs font-semibold text-slate-500 dark:text-slate-400">{t('subscriptions.insightsDueWindow', { days: dueWindowDays }) ?? ''}</div>
        </div>

        {state.subscriptions.length === 0 ? (
          <div className="mt-3 text-sm text-slate-500">{t('subscriptions.noSubscriptions') ?? 'No hay suscripciones aún.'}</div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{t('subscriptions.insightsCount') ?? 'Suscripciones'}</div>
              <div className="mt-1 text-2xl font-black text-slate-900 dark:text-white">{insights.count}</div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{t('subscriptions.insightsAvgMonthly') ?? 'Media mensual'}</div>
              <div className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">{formatCurrency(insights.avgMonthlyBase, baseCurrency)}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t('subscriptions.insightsAvgMonthlyHelper', { currency: baseCurrency }) ?? ''}</div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{t('subscriptions.insightsUpcoming') ?? 'Próximas'}</div>
              <div className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">{t('subscriptions.insightsUpcomingValue', { count: insights.dueSoonCount }) ?? String(insights.dueSoonCount)}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {insights.nextDueDate
                  ? (t('subscriptions.insightsUpcomingHelper', { date: insights.nextDueDate.toLocaleDateString(localeForLanguage(language)) }) ?? '')
                  : (t('common.none') ?? '—')}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
              <div className="text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-300">{t('subscriptions.insightsTopCategory') ?? 'Top categoría'}</div>
              <div className="mt-1 text-lg font-extrabold text-slate-900 dark:text-white">{insights.topCategory ? insights.topCategory.label : (t('common.none') ?? '—')}</div>
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{insights.topCategory ? (t('subscriptions.insightsTopCategoryHelper', { percent: insights.topCategory.percent }) ?? '') : ''}</div>
            </div>
          </div>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative w-full">
              <svg
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                viewBox="0 0 20 20"
                fill="none"
                aria-hidden="true"
              >
                <path
                  d="M8.5 3a5.5 5.5 0 014.33 9.02l3.58 3.58-1.06 1.06-3.58-3.58A5.5 5.5 0 118.5 3zm0 1.5a4 4 0 100 8 4 4 0 000-8z"
                  fill="currentColor"
                />
              </svg>
              <input
                type="search"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder={t('subscriptions.searchPlaceholder') ?? 'Buscar…'}
                aria-label={t('subscriptions.searchPlaceholder') ?? 'Buscar…'}
                className="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-950"
                autoComplete="off"
              />
            </div>

            <button
              type="button"
              className={`rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800 ${filtersOpen ? 'bg-slate-100 dark:bg-slate-800' : ''}`}
              onClick={() => setFiltersOpen(v => !v)}
              aria-pressed={filtersOpen}
            >
              {t('subscriptions.filtersToggle') ?? 'Filtros'}
            </button>
            {hasActiveFilters ? (
              <button
                type="button"
                className="rounded-md border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                onClick={clearFilters}
              >
                {t('common.clear') ?? 'Limpiar'}
              </button>
            ) : null}
          </div>

          <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
            {t('subscriptions.resultsCount', { count: sorted.length }) ?? `${sorted.length}`}
          </div>
        </div>

        {filtersOpen ? (
          <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <label className="text-sm">
                <div className="mb-1 font-semibold">{t('subscriptions.filterCategory') ?? 'Categoría'}</div>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={filterCategory}
                  onChange={e => setFilterCategory(e.target.value)}
                >
                  <option value="">{t('common.none') ?? '—'}</option>
                  {Array.from(new Set(enriched.map(s => String(s.category || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b)).map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <div className="mb-1 font-semibold">{t('subscriptions.filterCurrency') ?? 'Moneda'}</div>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={filterCurrency}
                  onChange={e => setFilterCurrency(e.target.value)}
                >
                  <option value="">{t('common.none') ?? '—'}</option>
                  {availableCurrencies.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <div className="mb-1 font-semibold">{t('subscriptions.filterPeriod') ?? 'Periodo'}</div>
                <select
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={filterPeriod}
                  onChange={e => setFilterPeriod(e.target.value as '' | Period)}
                >
                  <option value="">{t('common.none') ?? '—'}</option>
                  {PERIODS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </label>

              <label className="text-sm">
                <div className="mb-1 font-semibold">{t('subscriptions.filterMinPrice') ?? 'Precio mín.'}</div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={filterMinPrice}
                  onChange={e => setFilterMinPrice(e.target.value)}
                />
              </label>

              <label className="text-sm">
                <div className="mb-1 font-semibold">{t('subscriptions.filterMaxPrice') ?? 'Precio máx.'}</div>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  min="0"
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                  value={filterMaxPrice}
                  onChange={e => setFilterMaxPrice(e.target.value)}
                />
              </label>
            </div>
          </div>
        ) : null}

        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[700px] table-fixed border-separate border-spacing-0 text-xs">
            <thead>
              <tr className="text-center">
                <th className="sticky top-0 z-10 w-32 border-b border-slate-200 bg-white py-1.5 dark:border-slate-800 dark:bg-slate-900">
                  <SortHeaderButton column="name" label={t('subscriptions.columnName') ?? 'Nombre'} />
                </th>
                <th className="sticky top-0 z-10 w-24 border-b border-slate-200 bg-white py-1.5 dark:border-slate-800 dark:bg-slate-900">
                  <SortHeaderButton column="price" label={t('subscriptions.columnPrice') ?? 'Importe'} />
                </th>
                <th className="sticky top-0 z-10 w-24 border-b border-slate-200 bg-white py-1.5 dark:border-slate-800 dark:bg-slate-900">
                  <SortHeaderButton column="startDate" label={t('subscriptions.columnStart') ?? 'Inicio'} />
                </th>
                <th className="sticky top-0 z-10 w-24 border-b border-slate-200 bg-white py-1.5 dark:border-slate-800 dark:bg-slate-900">
                  <SortHeaderButton column="nextRenewal" label={t('subscriptions.columnNext') ?? 'Próximo'} />
                </th>
                <th className="sticky top-0 z-10 w-24 border-b border-slate-200 bg-white py-1.5 dark:border-slate-800 dark:bg-slate-900">
                  <SortHeaderButton column="category" label={t('subscriptions.columnCategory') ?? 'Categoría'} />
                </th>
                <th className="sticky top-0 z-10 w-24 border-b border-slate-200 bg-white py-1.5 dark:border-slate-800 dark:bg-slate-900">
                  <span className="block w-full text-center text-xs font-bold uppercase tracking-wide text-slate-700 dark:text-slate-200">{t('subscriptions.columnActions') ?? 'Acciones'}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-sm text-slate-500">
                    {hasActiveFilters
                      ? (t('subscriptions.emptyFiltered') ?? 'Sin resultados con los filtros actuales.')
                      : (t('subscriptions.noSubscriptions') ?? 'No hay suscripciones aún.')}
                  </td>
                </tr>
              ) : (
                sorted.map(s => {
                  const shownCurrency = displayMode === 'convertToBase' ? baseCurrency : s.rawCurrency
                  const shownAmount = displayMode === 'convertToBase' ? convertCurrencySync(s.price, s.rawCurrency, baseCurrency) : s.price
                  const categoryText = String(s.category || '').trim()
                  return (
                    <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-800/60 dark:hover:bg-slate-800/30">
                      <td className="px-2 py-1.5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          <div className="min-w-0 truncate font-semibold text-slate-900 dark:text-white">{s.name}</div>
                          {s.dueSoon ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
                              {t('subscriptions.dueSoon') ?? 'Pronto'}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 whitespace-nowrap text-center text-[11px] text-slate-500 dark:text-slate-400">
                          {periodLabelMap[s.period]}
                        </div>
                      </td>
                      <td className="px-2 py-1.5 text-center font-semibold text-slate-900 dark:text-white">
                        {formatCurrency(shownAmount, shownCurrency)}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-center text-slate-600 dark:text-slate-300">
                        {new Date(s.startDate).toLocaleDateString(localeForLanguage(language))}
                      </td>
                      <td className="px-2 py-1.5 whitespace-nowrap text-center text-slate-600 dark:text-slate-300">
                        {s.nextRenewal.toLocaleDateString(localeForLanguage(language))}
                      </td>
                      <td className="px-2 py-1.5 truncate text-center text-slate-600 dark:text-slate-300">
                        {categoryText || (t('common.uncategorized') ?? 'Sin categoría')}
                      </td>
                      <td className="py-1.5">
                        <div className="flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            aria-label={t('common.edit') ?? 'Editar'}
                            title={t('common.edit') ?? 'Editar'}
                            className="inline-flex items-center justify-center rounded-md bg-amber-600/80 px-2 py-1 text-[11px] font-semibold text-white hover:bg-amber-500/80"
                            onClick={() => loadForEdit(s)}
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 20h9" />
                              <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5z" />
                            </svg>
                            <span className="sr-only">{t('common.edit') ?? 'Editar'}</span>
                          </button>
                          <button
                            type="button"
                            aria-label={t('common.delete') ?? 'Eliminar'}
                            title={t('common.delete') ?? 'Eliminar'}
                            className="inline-flex items-center justify-center rounded-md bg-rose-600 px-2 py-1 text-[11px] font-semibold text-white hover:bg-rose-500"
                            onClick={() => remove(s.id)}
                          >
                            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M6 6l1 14h10l1-14" />
                              <path d="M10 11v6" />
                              <path d="M14 11v6" />
                            </svg>
                            <span className="sr-only">{t('common.delete') ?? 'Eliminar'}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-slate-950/50" onClick={closeModal} />
          <div className="relative mx-auto w-full max-w-3xl px-4 py-6">
            <div role="dialog" aria-modal="true" className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                {editing ? (t('subscriptions.editSubscription') ?? 'Editar suscripción') : (t('subscriptions.addSubscriptionTitle') ?? 'Añadir suscripción')}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-sm">
                  <div className="mb-1 font-semibold">{t('subscriptions.name') ?? 'Nombre'}</div>
                  <input
                    ref={nameInputRef}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                    value={name}
                    onChange={e => setName(e.target.value)}
                  />
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-semibold">{t('subscriptions.category') ?? 'Categoría'}</div>
                  <input
                    list="subly-categories"
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                    value={category}
                    onChange={e => setCategory(e.target.value)}
                    placeholder={t('subscriptions.categoryPlaceholder') ?? 'Ej: Streaming'}
                  />
                  <datalist id="subly-categories">
                    {categories.map(c => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-semibold">{t('subscriptions.amount') ?? 'Importe'}</div>
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
                  <div className="mb-1 font-semibold">{t('subscriptions.currency') ?? 'Moneda'}</div>
                  <select
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
                    value={currency}
                    onChange={e => setCurrency(e.target.value)}
                  >
                    {MAJOR_CURRENCIES.map(c => (
                      <option key={c.code} value={c.code}>
                        {c.code} ({c.symbol}) — {c.names[language]}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-semibold">{t('subscriptions.period') ?? 'Periodo'}</div>
                  <select className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950" value={period} onChange={e => setPeriod(e.target.value as Period)}>
                    {PERIODS.map(p => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="text-sm">
                  <div className="mb-1 font-semibold">{t('subscriptions.startDate') ?? 'Fecha inicio'}</div>
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
                  {editing ? (t('common.save') ?? 'Guardar') : (t('common.add') ?? 'Añadir')}
                </button>
                <button type="button" className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800" onClick={closeModal}>
                  {t('common.cancel') ?? 'Cancelar'}
                </button>
                {!canSubmit ? (
                  <div className="flex items-center text-sm text-slate-600 dark:text-slate-300">
                    {t('subscriptions.helpIncomplete') ?? 'Completa nombre, importe y fecha.'}
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
