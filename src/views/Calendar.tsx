import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import type { Subscription } from '../lib/types'
import { nextRenewalDate } from '../lib/storage'
import { ensureSubscriptionsCalendar, formatDateYMDLocal, upsertRecurringAllDayEvent, deleteCalendarEvent } from '../lib/googleCalendar'
import { convertCurrencySync, formatCurrency, getRates } from '../lib/money'
import { useStore } from '../store'
import { useI18n } from '../lib/i18n'
import { useToast } from '../components/Toast'
import GradientText from '../components/ui/GradientText'

function StatusIcon({ kind }: { kind: 'synced' | 'notSynced' | 'error' }) {
  if (kind === 'synced') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
        <path
          d="M6.5 12.5l3.2 3.2L17.8 7.8"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  if (kind === 'error') {
    return (
      <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
        <path
          d="M7 7l10 10"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M17 7L7 17"
          stroke="currentColor"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    )
  }

  // notSynced
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" aria-hidden="true">
      <path
        d="M6 12h12"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
      />
    </svg>
  )
}

function periodMonths(s: Subscription) {
  return s.period === 'monthly' ? 1 : s.period === 'quarterly' ? 3 : s.period === 'semiannual' ? 6 : 12
}

function addMonths(date: Date, months: number) {
  const copy = new Date(date)
  copy.setMonth(copy.getMonth() + months)
  return copy
}

function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate())
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function ymdKey(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function Calendar() {
  const { state, setSubscriptions, setSettings, ready } = useStore()
  const toast = useToast()
  const { t, language } = useI18n()

  const periodLabel = useMemo(() => {
    return {
      monthly: t('subscriptions.periodMonthly') ?? 'Monthly',
      quarterly: t('subscriptions.periodQuarterly') ?? 'Quarterly',
      semiannual: t('subscriptions.periodSemiannual') ?? 'Semiannual',
      annual: t('subscriptions.periodAnnual') ?? 'Annual',
    } as const
  }, [t])

  const displayMode = state.settings.currencyDisplayMode ?? 'original'
  const baseCurrency = (state.settings.baseCurrency || 'USD').toUpperCase()
  const calendarUseDedicatedCalendar = Boolean(state.settings.calendarUseDedicatedCalendar)

  const settingsRef = useRef(state.settings)
  useEffect(() => {
    settingsRef.current = state.settings
  }, [state.settings])

  const subscriptionsRef = useRef<Subscription[]>(state.subscriptions)
  useEffect(() => {
    subscriptionsRef.current = state.subscriptions
  }, [state.subscriptions])

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
        setFxTick(x => x + 1)
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

  const windowDays = 30
  const from = useMemo(() => startOfDay(new Date()), [])
  const to = useMemo(() => {
    const d = new Date()
    d.setDate(d.getDate() + windowDays)
    d.setHours(23, 59, 59, 999)
    return d
  }, [])

  const agendaGroups = useMemo(() => {
    const items: Array<{ date: Date; ymd: string; s: Subscription }> = []
    for (const s of state.subscriptions) {
      const step = periodMonths(s)
      let cursor = nextRenewalDate(s.startDate, s.period, from)
      while (cursor.getTime() <= to.getTime()) {
        items.push({ date: new Date(cursor), ymd: ymdKey(cursor), s })
        cursor = addMonths(cursor, step)
      }
    }

    items.sort((a, b) => a.date.getTime() - b.date.getTime() || a.s.name.localeCompare(b.s.name))

    const map = new Map<string, { date: Date; ymd: string; rows: Array<{ s: Subscription; shownAmount: number; shownCurrency: string }> }>()
    for (const it of items) {
      const rawCur = (it.s.currency || 'USD').toUpperCase()
      const shownCurrency = displayMode === 'convertToBase' ? baseCurrency : rawCur
      const shownAmount = displayMode === 'convertToBase' ? convertCurrencySync(it.s.price, rawCur, baseCurrency) : it.s.price

      if (!map.has(it.ymd)) {
        map.set(it.ymd, { date: it.date, ymd: it.ymd, rows: [] })
      }
      map.get(it.ymd)!.rows.push({ s: it.s, shownAmount, shownCurrency })
    }

    return Array.from(map.values()).sort((a, b) => a.date.getTime() - b.date.getTime())
  }, [baseCurrency, displayMode, fxTick, from, state.subscriptions, to])

  const [syncBusy, setSyncBusy] = useState(false)
  const [syncProgress, setSyncProgress] = useState<{ ok: number; fail: number; total: number } | null>(null)

  const syncAll = async (interactive: boolean) => {
    if (syncBusy) return
    if (subscriptionsRef.current.length === 0) {
      toast.info(t('calendar.emptyHint') ?? 'Añade suscripciones para ver tu agenda.')
      return
    }

    setSyncBusy(true)
    setSyncProgress({ ok: 0, fail: 0, total: subscriptionsRef.current.length })

    try {
      let ensuredCalendarId: string | null = null
      if (calendarUseDedicatedCalendar) {
        ensuredCalendarId = settingsRef.current.calendarSubscriptionsCalendarId ?? null
        if (!ensuredCalendarId) {
          ensuredCalendarId = await ensureSubscriptionsCalendar({ interactive })
          setSettings({
            ...settingsRef.current,
            calendarSubscriptionsCalendarId: ensuredCalendarId,
          })
        }
      }

      const list = subscriptionsRef.current
      const updated = list.slice()
      let ok = 0
      let fail = 0
      let firstError: string | null = null

      for (let idx = 0; idx < list.length; idx++) {
        const s = list[idx]
        try {
          const rawCur = (s.currency || 'USD').toUpperCase()
          const shownCurrency = displayMode === 'convertToBase' ? baseCurrency : rawCur
          const shownAmount = displayMode === 'convertToBase' ? convertCurrencySync(s.price, rawCur, baseCurrency) : s.price

          const detailsLines = [
            `${t('subscriptions.detailsAmount') ?? 'Importe'}: ${formatCurrency(shownAmount, shownCurrency)}`,
            `${t('subscriptions.detailsPeriod') ?? 'Periodo'}: ${s.period}`,
          ]
          const cat = String(s.category || '').trim()
          if (cat) detailsLines.push(`${t('subscriptions.filterCategory') ?? 'Categoría'}: ${cat}`)

          const next = nextRenewalDate(s.startDate, s.period, new Date())
          const startYmd = formatDateYMDLocal(next)

          const reminderMethod: 'popup' | 'email' = s.reminder?.enabled
            ? (s.reminder?.method === 'email' ? 'email' : 'popup')
            : (settingsRef.current.calendarReminderMethod === 'email' ? 'email' : 'popup')

          const reminderMinutes = (() => {
            const useCustom = Boolean(s.reminder?.enabled)
            const days = useCustom
              ? Math.max(0, Math.trunc(Number(s.reminder?.daysBefore ?? 1)))
              : Math.max(0, Math.trunc(Number(settingsRef.current.calendarReminderDaysBefore ?? 1)))
            return days * 24 * 60
          })()

          const targetCalendarId = calendarUseDedicatedCalendar
            ? (ensuredCalendarId ?? 'primary')
            : (s.calendar?.calendarId ?? 'primary')

          const existingEventId = s.calendar?.eventId
          const existingCalendarId = s.calendar?.calendarId
          const shouldMigrate = Boolean(existingEventId && existingCalendarId && existingCalendarId !== targetCalendarId)
          if (shouldMigrate) {
            try {
              await deleteCalendarEvent({ calendarId: existingCalendarId, eventId: existingEventId!, interactive })
            } catch {
              // best-effort
            }
          }

          const upsert = async (calendarId: string, eventId?: string) => {
            return await upsertRecurringAllDayEvent({
              calendarId,
              eventId,
              summary: `${s.name} · ${t('subscriptions.renewal') ?? 'Renovación'}`,
              description: detailsLines.join('\n'),
              startDateYmd: startYmd,
              period: s.period,
              reminderMinutes,
              reminderMethod,
              interactive,
            })
          }

          let link: Awaited<ReturnType<typeof upsertRecurringAllDayEvent>>
          try {
            link = await upsert(targetCalendarId, shouldMigrate ? undefined : s.calendar?.eventId)
          } catch (e) {
            const status = (e && typeof e === 'object' && typeof (e as any).status === 'number') ? (e as any).status : undefined
            if (status !== 404) throw e
            // Recover from stale calendarId
            if (calendarUseDedicatedCalendar) {
              const ensured = await ensureSubscriptionsCalendar({ interactive })
              ensuredCalendarId = ensured
              setSettings({
                ...settingsRef.current,
                calendarSubscriptionsCalendarId: ensured,
              })
              link = await upsert(ensured, undefined)
            } else {
              link = await upsert('primary', undefined)
            }
          }

          updated[idx] = {
            ...s,
            calendar: {
              ...link,
              lastError: undefined,
            },
          }
          ok += 1
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e)
          if (!firstError) firstError = msg
          fail += 1
          updated[idx] = {
            ...s,
            calendar: {
              ...(s.calendar ?? { calendarId: 'primary' }),
              lastError: msg,
              syncedAt: s.calendar?.syncedAt,
            },
          }
        }

        setSyncProgress({ ok, fail, total: list.length })
      }

      setSubscriptions(updated)
      const baseMsg = t('subscriptions.syncAllDone', { ok, fail }) ?? `Sync: ${ok} ok, ${fail} fail`
      if (fail > 0) toast.error(firstError ? `${baseMsg} (${firstError})` : baseMsg)
      else toast.success(baseMsg)
    } finally {
      setSyncBusy(false)
      // keep progress visible briefly
      window.setTimeout(() => setSyncProgress(null), 2000)
    }
  }

  const href = 'https://calendar.google.com/calendar/u/0/r'
  const locale = language === 'es' ? 'es-ES' : 'en-US'
  const today = startOfDay(new Date())
  const tomorrow = (() => {
    const d = new Date(today)
    d.setDate(d.getDate() + 1)
    return d
  })()

  if (!ready) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm dark:border-slate-800 dark:bg-slate-900">
        {t('common.loading') ?? 'Loading…'}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold text-slate-700 dark:text-slate-200 sm:text-base">
              <GradientText
                className="tracking-wide"
                colors={['#67cdddf4', '#e6d5d5e2', '#ad9ae8']}
                animationSpeed={10}
              >
                {t('calendar.title') ?? (t('nav.calendar') ?? 'Calendar')}
              </GradientText>
            </div>
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {t('calendar.hint') ?? ''}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
              onClick={() => void syncAll(true)}
              disabled={syncBusy || state.subscriptions.length === 0}
              title={state.subscriptions.length === 0 ? (t('calendar.emptyHint') ?? 'Añade suscripciones para ver tu agenda.') : undefined}
            >
              {syncBusy ? (t('subscriptions.syncing') ?? 'Syncing…') : (t('subscriptions.syncAll') ?? 'Sync all')}
            </button>

            <a
              className="inline-flex rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              href={href}
              target="_blank"
              rel="noreferrer"
            >
              {t('settings.openGoogleCalendar') ?? 'Open Google Calendar'}
            </a>

            <Link
              className="inline-flex rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-900"
              to="/settings"
            >
              {t('nav.settings') ?? 'Ajustes'}
            </Link>
          </div>
        </div>

        {syncProgress ? (
          <div className="mt-3 text-xs font-semibold text-slate-600 dark:text-slate-300">
            {t('calendar.syncProgress', { ok: syncProgress.ok, total: syncProgress.total, fail: syncProgress.fail })
              ?? `Progress: ${syncProgress.ok}/${syncProgress.total} ok · ${syncProgress.fail} fail`}
          </div>
        ) : null}

        {displayMode === 'convertToBase' ? (
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {fxStatus === 'loading'
              ? (t('dashboard.fxLoading') ?? 'Cargando tipos de cambio…')
              : fxStatus === 'unavailable'
                ? (t('dashboard.fxUnavailable') ?? 'Tipos de cambio no disponibles; usando aproximación.')
                : null}
          </div>
        ) : null}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-sm font-extrabold text-slate-700 dark:text-slate-200 sm:text-base">
            <GradientText
              className="tracking-wide"
              colors={['#67cdddf4', '#e6d5d5e2', '#ad9ae8']}
              animationSpeed={10}
            >
              {t('calendar.agenda30', { days: windowDays }) ?? `Agenda · Next ${windowDays} days`}
            </GradientText>
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {state.subscriptions.length} {state.subscriptions.length === 1 ? (t('common.subscription') ?? 'suscripción') : (t('common.subscriptions') ?? 'suscripciones')}
          </div>
        </div>

        {agendaGroups.length === 0 ? (
          <div className="mt-3 rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-700 dark:text-slate-300">
            {state.subscriptions.length === 0
              ? (t('calendar.emptyHint') ?? 'Añade suscripciones para ver tu agenda.')
              : (t('calendar.noUpcoming', { days: windowDays }) ?? `No renewals in the next ${windowDays} days.`)}
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            {agendaGroups.map(group => {
              const labelRaw = group.date.toLocaleDateString(locale, {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: '2-digit',
              })
              const label = labelRaw.length > 0 ? (labelRaw[0].toUpperCase() + labelRaw.slice(1)) : labelRaw

              const tag = isSameDay(group.date, today)
                ? (t('common.today') ?? 'Today')
                : isSameDay(group.date, tomorrow)
                  ? (t('common.tomorrow') ?? 'Tomorrow')
                  : null

              return (
                <div key={group.ymd} className="rounded-lg border border-slate-200 p-3 dark:border-slate-800">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-extrabold text-slate-700 dark:text-slate-200">
                      {label}
                    </div>
                    {tag ? (
                      <div className="rounded-full bg-indigo-600/20 px-2 py-0.5 text-[11px] font-black text-indigo-300">
                        {tag}
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-2 space-y-2">
                    {group.rows.map(row => (
                      <div
                        key={`${group.ymd}:${row.s.id}`}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-slate-50 px-3 py-2 dark:bg-slate-950/40"
                      >
                        <div className="min-w-0">
                          <div className="truncate text-sm font-extrabold text-slate-800 dark:text-slate-100">{row.s.name}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {(t('subscriptions.renewal') ?? 'Renewal')} · {periodLabel[row.s.period]}
                            {row.s.category ? ` · ${row.s.category}` : ''}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-sm font-black text-slate-900 dark:text-slate-100">
                            {formatCurrency(row.shownAmount, row.shownCurrency)}
                          </div>
                          {row.s.calendar?.lastError ? (
                            <div
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-rose-600/15 text-rose-300"
                              title={row.s.calendar.lastError}
                              aria-label={t('common.error') ?? 'Error'}
                            >
                              <StatusIcon kind="error" />
                              <span className="sr-only">{t('common.error') ?? 'Error'}</span>
                            </div>
                          ) : row.s.calendar?.syncedAt ? (
                            <div
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600/15 text-emerald-300"
                              title={row.s.calendar.syncedAt}
                              aria-label={t('common.synced') ?? 'Synced'}
                            >
                              <StatusIcon kind="synced" />
                              <span className="sr-only">{t('common.synced') ?? 'Synced'}</span>
                            </div>
                          ) : (
                            <div
                              className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-600/15 text-slate-400"
                              title={t('common.notSynced') ?? 'Not synced'}
                              aria-label={t('common.notSynced') ?? 'Not synced'}
                            >
                              <StatusIcon kind="notSynced" />
                              <span className="sr-only">{t('common.notSynced') ?? 'Not synced'}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
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
