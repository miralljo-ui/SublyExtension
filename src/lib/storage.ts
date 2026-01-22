import type { AppSettings, AppState, Subscription } from './types'

const KEY = 'subly:state'

export const DEFAULT_SETTINGS: AppSettings = {
  language: 'es',
  currencyDisplayMode: 'original',
  baseCurrency: 'USD',
  calendarAutoSyncAll: true,
  calendarFloatingButtonEnabled: true,
  calendarReminderDaysBefore: 1,
  calendarReminderMethod: 'popup',
  onboardingCompleted: false,
  driveBackupFileId: undefined,
  driveLastBackupAt: undefined,
}

export function normalizeState(input: Partial<AppState> | null | undefined): AppState {
  const subscriptions = Array.isArray(input?.subscriptions) ? input!.subscriptions : []
  const rawSettings = (input as AppState | undefined)?.settings
  const language = rawSettings?.language === 'en' ? 'en' : 'es'
  const display = rawSettings?.currencyDisplayMode === 'convertToBase' ? 'convertToBase' : 'original'
  const baseCurrency = String(rawSettings?.baseCurrency ?? DEFAULT_SETTINGS.baseCurrency).trim().toUpperCase() || DEFAULT_SETTINGS.baseCurrency
  const calendarAutoSyncAll = Boolean(rawSettings?.calendarAutoSyncAll ?? DEFAULT_SETTINGS.calendarAutoSyncAll)
  const calendarFloatingButtonEnabled = rawSettings?.calendarFloatingButtonEnabled === false ? false : true

  const toIntInRange = (v: unknown, fallback: number, min: number, max: number) => {
    const n = typeof v === 'number' ? v : Number(v)
    if (!Number.isFinite(n)) return fallback
    const i = Math.trunc(n)
    if (i < min) return min
    if (i > max) return max
    return i
  }

  const calendarReminderDaysBefore = toIntInRange(
    rawSettings?.calendarReminderDaysBefore,
    DEFAULT_SETTINGS.calendarReminderDaysBefore ?? 1,
    0,
    365,
  )

  const calendarReminderMethod = rawSettings?.calendarReminderMethod === 'email' ? 'email' : 'popup'

  const onboardingCompleted = Boolean(rawSettings?.onboardingCompleted ?? DEFAULT_SETTINGS.onboardingCompleted)
  const calendarSubscriptionsCalendarId = String(rawSettings?.calendarSubscriptionsCalendarId ?? '').trim() || undefined
  const driveBackupFileId = String(rawSettings?.driveBackupFileId ?? '').trim() || undefined
  const driveLastBackupAt = String(rawSettings?.driveLastBackupAt ?? '').trim() || undefined
  return {
    subscriptions,
    settings: {
      language,
      currencyDisplayMode: display,
      baseCurrency,
      calendarAutoSyncAll,
      calendarFloatingButtonEnabled,
      calendarReminderDaysBefore,
      calendarReminderMethod,
      onboardingCompleted,
      calendarSubscriptionsCalendarId,
      driveBackupFileId,
      driveLastBackupAt,
    },
  }
}

function isExtension() {
  return typeof chrome !== 'undefined' && !!chrome.storage?.local
}

export async function loadState(): Promise<AppState> {
  if (isExtension()) {
    const res = await chrome.storage.local.get([KEY])
    return normalizeState((res?.[KEY] as AppState) ?? null)
  }

  const raw = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
  if (!raw) return normalizeState(null)
  try {
    return normalizeState(JSON.parse(raw) as AppState)
  } catch {
    return normalizeState(null)
  }
}

export async function saveState(state: AppState): Promise<void> {
  if (isExtension()) {
    await chrome.storage.local.set({ [KEY]: state })
    return
  }
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(KEY, JSON.stringify(state))
  }
}

export function createId(): string {
  // Good enough for local ids; if you later sync to a DB, use UUID.
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function nextRenewalDate(startDate: string, period: Subscription['period'], from = new Date()): Date {
  const [y, m, d] = startDate.split('-').map(Number)
  const base = new Date(y, (m ?? 1) - 1, d ?? 1)
  if (Number.isNaN(base.getTime())) return from

  const addMonths = (date: Date, months: number) => {
    const copy = new Date(date)
    copy.setMonth(copy.getMonth() + months)
    return copy
  }

  const step = period === 'monthly' ? 1 : period === 'quarterly' ? 3 : period === 'semiannual' ? 6 : 12
  let cursor = new Date(base)
  while (cursor.getTime() < from.getTime()) {
    cursor = addMonths(cursor, step)
  }
  return cursor
}
