import type { Period } from './types'

type CalendarEventDraft = {
  title: string
  details?: string
  startDate: Date
  allDay?: boolean
  recurrence?: {
    period: Period
  }
}

export type GoogleCalendarEventLink = {
  calendarId: string
  eventId: string
  syncedAt: string
  lastError?: string
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatDateYYYYMMDDLocal(date: Date) {
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1)
  const d = pad2(date.getDate())
  return `${y}${m}${d}`
}

export function formatDateYMDLocal(date: Date) {
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1)
  const d = pad2(date.getDate())
  return `${y}-${m}-${d}`
}

function buildRRule(period: Period): string {
  switch (period) {
    case 'monthly':
      return 'RRULE:FREQ=MONTHLY'
    case 'quarterly':
      return 'RRULE:FREQ=MONTHLY;INTERVAL=3'
    case 'semiannual':
      return 'RRULE:FREQ=MONTHLY;INTERVAL=6'
    case 'annual':
      return 'RRULE:FREQ=YEARLY'
  }
}

export function buildGoogleCalendarEventEditUrl(draft: CalendarEventDraft): string {
  const base = 'https://calendar.google.com/calendar/u/0/r/eventedit'

  const params = new URLSearchParams()
  params.set('text', draft.title)
  if (draft.details) params.set('details', draft.details)

  const allDay = draft.allDay ?? true

  if (allDay) {
    const start = new Date(draft.startDate)
    const end = new Date(start)
    end.setDate(end.getDate() + 1)
    params.set('dates', `${formatDateYYYYMMDDLocal(start)}/${formatDateYYYYMMDDLocal(end)}`)
  }

  if (draft.recurrence) {
    params.set('recur', buildRRule(draft.recurrence.period))
  }

  return `${base}?${params.toString()}`
}

function isExtension() {
  return typeof chrome !== 'undefined' && !!chrome.identity
}

async function getAuthToken(interactive: boolean): Promise<string> {
  if (!isExtension()) throw new Error('Google Calendar sync requires Chrome Extension environment.')

  return await new Promise((resolve, reject) => {
    chrome.identity.getAuthToken({ interactive }, (token) => {
      const err = chrome.runtime.lastError
      if (err) {
        reject(new Error(err.message || 'OAuth token error'))
        return
      }
      if (!token) {
        reject(new Error('No OAuth token received'))
        return
      }
      resolve(token)
    })
  })
}

async function removeCachedToken(token: string): Promise<void> {
  if (!isExtension()) return
  await new Promise<void>((resolve) => {
    chrome.identity.removeCachedAuthToken({ token }, () => resolve())
  })
}

async function calendarApiRequest<T>(args: {
  token: string
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  path: string
  body?: unknown
}): Promise<T> {
  const url = `https://www.googleapis.com/calendar/v3${args.path}`
  const res = await fetch(url, {
    method: args.method,
    headers: {
      Authorization: `Bearer ${args.token}`,
      ...(args.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: args.body ? JSON.stringify(args.body) : undefined,
  })

  if (res.status === 204) return undefined as T

  const text = await res.text()
  if (!res.ok) {
    const msg = text || `${res.status} ${res.statusText}`
    const err = new Error(msg)
    ;(err as any).status = res.status
    ;(err as any).body = text
    throw err
  }
  return (text ? (JSON.parse(text) as T) : (undefined as T))
}

function getHttpStatus(e: unknown): number | undefined {
  if (!e || typeof e !== 'object') return undefined
  const s = (e as any).status
  return typeof s === 'number' ? s : undefined
}

function shouldPurgeToken(status: number | undefined): boolean {
  // 401/403 are the typical cases for invalid/expired token or missing consent.
  return status === 401 || status === 403
}

export type UpsertRecurringAllDayEventInput = {
  calendarId?: string
  eventId?: string
  summary: string
  description?: string
  startDateYmd: string // YYYY-MM-DD (local)
  period: Period
  // Minutes before event start (all-day event start is local midnight).
  // When provided, Subly sets a popup reminder override for the event.
  reminderMinutes?: number
  reminderMethod?: 'popup' | 'email'
  token?: string
  interactive?: boolean
  // If true, don't auto-create a missing event when a PATCH returns 404; rethrow instead.
  throwOnMissingEvent?: boolean
}

function clampReminderMinutes(v: number): number {
  // Google Calendar UI typically supports up to 4 weeks.
  const max = 40320
  if (!Number.isFinite(v)) return 0
  const i = Math.trunc(v)
  if (i < 0) return 0
  if (i > max) return max
  return i
}

export async function upsertRecurringAllDayEvent(input: UpsertRecurringAllDayEventInput): Promise<GoogleCalendarEventLink> {
  const calendarId = input.calendarId ?? 'primary'
  const interactive = input.interactive ?? true
  let token = input.token

  if (!token) token = await getAuthToken(interactive)

  const [y, m, d] = input.startDateYmd.split('-').map(Number)
  const start = new Date(y, (m ?? 1) - 1, d ?? 1)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)

  const reminderMinutes = typeof input.reminderMinutes === 'number' ? clampReminderMinutes(input.reminderMinutes) : undefined
  const reminderMethod = input.reminderMethod === 'email' ? 'email' : 'popup'

  const body = {
    summary: input.summary,
    description: input.description,
    start: { date: input.startDateYmd },
    end: { date: formatDateYMDLocal(end) },
    recurrence: [buildRRule(input.period)],
    ...(reminderMinutes === undefined
      ? {}
      : {
        reminders: reminderMinutes > 0
          ? { useDefault: false, overrides: [{ method: reminderMethod, minutes: reminderMinutes }] }
          : { useDefault: false, overrides: [] as { method: 'popup' | 'email'; minutes: number }[] },
      }),
  }

  try {
    if (input.eventId) {
      try {
        const updated = await calendarApiRequest<{ id: string }>({
          token,
          method: 'PATCH',
          path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(input.eventId)}`,
          body,
        })

        // Extra verification: some edge cases may not return 404 on PATCH even if
        // the event is effectively gone. Do a GET to ensure the event exists and
        // has the expected start date; if the GET returns 404, fall through to create.
        try {
          const fetched = await calendarApiRequest<any>({
            token,
            method: 'GET',
            path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(updated.id)}`,
          })
          // Basic sanity check: ensure start.date matches requested start date.
          if (fetched && fetched.start && fetched.start.date && String(fetched.start.date) === input.startDateYmd) {
            return { calendarId, eventId: updated.id, syncedAt: new Date().toISOString() }
          }
          // If start date doesn't match, proceed to recreate to ensure correct instance.
          console.debug && console.debug('upsertRecurringAllDayEvent: PATCH returned but event content differed; recreating', calendarId, input.eventId)
        } catch (getErr) {
          const getStatus = getHttpStatus(getErr)
          if (getStatus === 404) {
            // Event truly missing; if caller requested to throw, do so.
            if (input.throwOnMissingEvent) throw getErr
            // Otherwise continue to create below.
          } else if (shouldPurgeToken(getStatus)) {
            await removeCachedToken(token)
            throw getErr
          } else {
            // Non-404 GET error: rethrow to let upper layers decide.
            throw getErr
          }
        }
      } catch (e) {
        // If the event was deleted or the ID is stale, either recreate it or
        // propagate the 404 to caller depending on `throwOnMissingEvent`.
        const status = getHttpStatus(e)
        if (status === 404 && input.throwOnMissingEvent) throw e
        if (status !== 404) throw e
        // Otherwise continue to create a new event below.
      }
    }

    const created = await calendarApiRequest<{ id: string }>({
      token,
      method: 'POST',
      path: `/calendars/${encodeURIComponent(calendarId)}/events`,
      body,
    })
    return { calendarId, eventId: created.id, syncedAt: new Date().toISOString() }
  } catch (e) {
    const status = getHttpStatus(e)
    if (shouldPurgeToken(status)) {
      await removeCachedToken(token)
    }
    throw e
  }
}

export async function deleteCalendarEvent(args: { calendarId?: string; eventId: string; token?: string; interactive?: boolean }): Promise<void> {
  const calendarId = args.calendarId ?? 'primary'
  const interactive = args.interactive ?? true
  const token = args.token ?? await getAuthToken(interactive)
  try {
    await calendarApiRequest<void>({
      token,
      method: 'DELETE',
      path: `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(args.eventId)}`,
    })
  } catch (e) {
    const status = getHttpStatus(e)
    // If it's already gone, treat as success.
    if (status === 404) return
    if (shouldPurgeToken(status)) {
      await removeCachedToken(token)
    }
    throw e
  }
}

type CalendarListItem = {
  id: string
  summary?: string
}

type CalendarListResponse = {
  items?: CalendarListItem[]
}

const SUBSCRIPTIONS_CALENDAR_SUMMARY = 'Subly Subscriptions'

export async function ensureSubscriptionsCalendar(args?: { token?: string; interactive?: boolean; summary?: string }): Promise<string> {
  const interactive = args?.interactive ?? true
  const desiredSummary = String(args?.summary || SUBSCRIPTIONS_CALENDAR_SUMMARY).trim() || SUBSCRIPTIONS_CALENDAR_SUMMARY
  let token = args?.token
  if (!token) token = await getAuthToken(interactive)

  try {
    const list = await calendarApiRequest<CalendarListResponse>({
      token,
      method: 'GET',
      path: `/users/me/calendarList?minAccessRole=writer`,
    })

    const existing = (list.items ?? []).find(it => String(it.summary || '').trim().toLowerCase() === desiredSummary.toLowerCase())
    if (existing?.id) return existing.id

    const created = await calendarApiRequest<{ id: string }>({
      token,
      method: 'POST',
      path: `/calendars`,
      body: { summary: desiredSummary },
    })

    // Best-effort: ensure it appears in the user's calendar list.
    try {
      await calendarApiRequest<void>({
        token,
        method: 'POST',
        path: `/users/me/calendarList`,
        body: { id: created.id },
      })
    } catch {
      // Ignore; owned calendars typically appear automatically.
    }

    return created.id
  } catch (e) {
    await removeCachedToken(token)
    throw e
  }
}

export async function deleteSubscriptionsCalendar(args?: { calendarId?: string; token?: string; interactive?: boolean }): Promise<void> {
  const calendarId = String(args?.calendarId || '').trim()
  if (!calendarId) throw new Error('Missing calendar id')
  const interactive = args?.interactive ?? true
  let token = args?.token
  if (!token) token = await getAuthToken(interactive)

  try {
    await calendarApiRequest<void>({
      token,
      method: 'DELETE',
      path: `/calendars/${encodeURIComponent(calendarId)}`,
    })
  } catch (e) {
    const status = getHttpStatus(e)
    // If already gone, treat as success.
    if (status === 404) return
    if (shouldPurgeToken(status)) {
      await removeCachedToken(token)
    }
    throw e
  }
}
