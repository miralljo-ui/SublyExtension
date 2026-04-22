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
  const rawSubscriptions = Array.isArray(input?.subscriptions) ? input!.subscriptions : []
  const subscriptions = rawSubscriptions.map((sub) => {
    const list = [
      ...(Array.isArray(sub?.categories) ? sub.categories : []),
      typeof sub?.category === 'string' ? sub.category : '',
    ]
      .map(v => String(v || '').trim())
      .filter(Boolean)

    const uniqueCategories = Array.from(new Set(list))

    return {
      ...sub,
      categories: uniqueCategories.length ? uniqueCategories : undefined,
      category: uniqueCategories[0] ?? undefined,
    }
  })
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
  
  // Validate month and day are in reasonable ranges
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return from
  if (m < 1 || m > 12 || d < 1 || d > 31) return from
  
  const base = new Date(y, (m ?? 1) - 1, d ?? 1)
  if (Number.isNaN(base.getTime())) return from

  /**
   * Safely add months to a date, handling end-of-month dates.
   * Remembers the original day to restore it when possible.
   * E.g., Jan 31 + 1 month = Feb 28/29, then + 1 month = Mar 31.
   * See: https://stackoverflow.com/questions/5645058
   */
  const addMonths = (date: Date, months: number, originalDay: number): Date => {
    let year = date.getFullYear()
    let month = date.getMonth() + months
    
    // Handle month overflow
    year += Math.floor(month / 12)
    month = month % 12
    
    // Try to create date with the original day
    let result = new Date(year, month, originalDay)
    
    // If day doesn't exist in target month, use last day of that month
    if (result.getMonth() !== month) {
      result = new Date(year, month + 1, 0)
    }
    
    return result
  }

  const step = period === 'monthly' ? 1 : period === 'quarterly' ? 3 : period === 'semiannual' ? 6 : 12
  const originalDay = base.getDate() // Remember the subscription's original day
  let cursor = new Date(base)
  
  while (cursor.getTime() <= from.getTime()) {
    cursor = addMonths(cursor, step, originalDay)
  }
  return cursor
}
