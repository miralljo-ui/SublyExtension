import type { AppSettings, AppState, Subscription } from './types'

const KEY = 'subly:state'

export const DEFAULT_SETTINGS: AppSettings = {
  notificationsEnabled: false,
  notifyDaysBefore: 2,
}

function normalizeState(input: Partial<AppState> | null | undefined): AppState {
  const subscriptions = Array.isArray(input?.subscriptions) ? input!.subscriptions : []
  const rawSettings = (input as AppState | undefined)?.settings
  return {
    subscriptions,
    settings: {
      notificationsEnabled: Boolean(rawSettings?.notificationsEnabled ?? DEFAULT_SETTINGS.notificationsEnabled),
      notifyDaysBefore: Number.isFinite(rawSettings?.notifyDaysBefore)
        ? Math.max(0, Math.min(30, Math.floor(rawSettings!.notifyDaysBefore)))
        : DEFAULT_SETTINGS.notifyDaysBefore,
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
