// MV3 background service worker (module)

const KEY = 'subly:state'
const ALARM_PREFIX = 'subly:sub:'

function clampInt(n, min, max, fallback) {
  const num = Number(n)
  if (!Number.isFinite(num)) return fallback
  const v = Math.floor(num)
  return Math.min(max, Math.max(min, v))
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function yyyymmddLocal(date) {
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1)
  const d = pad2(date.getDate())
  return `${y}-${m}-${d}`
}

function addMonths(date, months) {
  const copy = new Date(date)
  copy.setMonth(copy.getMonth() + months)
  return copy
}

function nextRenewalDate(startDate, period, from = new Date()) {
  // startDate is stored as YYYY-MM-DD
  const parts = String(startDate).split('-').map(Number)
  const base = new Date(parts[0], (parts[1] ?? 1) - 1, parts[2] ?? 1)
  if (Number.isNaN(base.getTime())) return from

  const step = period === 'monthly' ? 1 : period === 'quarterly' ? 3 : period === 'semiannual' ? 6 : 12
  let cursor = new Date(base)
  while (cursor.getTime() < from.getTime()) {
    cursor = addMonths(cursor, step)
  }
  return cursor
}

function buildNotifyTime(nextRenewal, notifyDaysBefore) {
  const days = clampInt(notifyDaysBefore, 0, 30, 2)
  const when = new Date(nextRenewal)
  // notify at 09:00 local by default
  when.setHours(9, 0, 0, 0)
  when.setDate(when.getDate() - days)
  return when
}

async function readState() {
  const res = await chrome.storage.local.get([KEY])
  const raw = res?.[KEY] ?? null
  const subscriptions = Array.isArray(raw?.subscriptions) ? raw.subscriptions : []
  const settings = raw?.settings ?? {}
  return {
    subscriptions,
    settings: {
      notificationsEnabled: Boolean(settings.notificationsEnabled ?? false),
      notifyDaysBefore: clampInt(settings.notifyDaysBefore, 0, 30, 2),
    },
  }
}

async function clearSublyAlarms() {
  const all = await chrome.alarms.getAll()
  await Promise.all(
    all
      .filter(a => a?.name?.startsWith(ALARM_PREFIX))
      .map(a => chrome.alarms.clear(a.name))
  )
}

async function scheduleAll() {
  if (!chrome?.alarms) return

  const { subscriptions, settings } = await readState()
  await clearSublyAlarms()
  if (!settings.notificationsEnabled) return

  const now = new Date()

  for (const s of subscriptions) {
    if (!s?.id || !s?.startDate || !s?.period) continue
    const next = nextRenewalDate(s.startDate, s.period, now)
    let notifyAt = buildNotifyTime(next, settings.notifyDaysBefore)
    // If we missed it (e.g., browser was closed), schedule soon.
    if (notifyAt.getTime() <= now.getTime() + 30 * 1000) {
      notifyAt = new Date(now.getTime() + 60 * 1000)
    }
    await chrome.alarms.create(`${ALARM_PREFIX}${s.id}`, {
      when: notifyAt.getTime(),
    })
  }
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  void scheduleAll()
})

chrome.runtime.onStartup?.addListener(() => {
  void scheduleAll()
})

chrome.storage?.onChanged?.addListener((changes, areaName) => {
  if (areaName !== 'local') return
  if (!changes?.[KEY]) return
  void scheduleAll()
})

chrome.alarms?.onAlarm?.addListener(async (alarm) => {
  if (!alarm?.name?.startsWith(ALARM_PREFIX)) return
  const subId = alarm.name.slice(ALARM_PREFIX.length)
  const { subscriptions, settings } = await readState()
  if (!settings.notificationsEnabled) return
  const sub = subscriptions.find(s => s?.id === subId)
  if (!sub) return

  const now = new Date()
  const next = nextRenewalDate(sub.startDate, sub.period, now)
  const notifyDaysBefore = settings.notifyDaysBefore
  const renewalLabel = yyyymmddLocal(next)
  const title = `Renovación: ${sub.name}`
  const message = notifyDaysBefore > 0
    ? `Vence el ${renewalLabel} (en ${notifyDaysBefore} día(s)).`
    : `Vence hoy (${renewalLabel}).`

  try {
    await chrome.notifications.create(`subly:${sub.id}:${Date.now()}`, {
      type: 'basic',
      iconUrl: chrome.runtime.getURL('icon-128.png'),
      title,
      message,
      priority: 1,
    })
  } catch {
    // Ignore notification failures (e.g., blocked by user).
  }

  // Reschedule this subscription for the next cycle.
  const afterRenewal = new Date(next.getTime() + 60 * 1000)
  const nextCycle = nextRenewalDate(sub.startDate, sub.period, afterRenewal)
  let notifyAt = buildNotifyTime(nextCycle, notifyDaysBefore)
  if (notifyAt.getTime() <= now.getTime() + 30 * 1000) {
    notifyAt = new Date(now.getTime() + 60 * 1000)
  }
  await chrome.alarms.create(`${ALARM_PREFIX}${sub.id}`, { when: notifyAt.getTime() })
})

chrome.runtime.onMessage.addListener((message, sender) => {
  if (message?.type !== 'OPEN_PANEL') return
  const tabId = sender.tab?.id
  if (typeof tabId !== 'number') return

  chrome.sidePanel.setOptions({ tabId, path: 'sidepanel.html', enabled: true })
  chrome.sidePanel.open({ tabId })
})
