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

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

function formatDateYYYYMMDDLocal(date: Date) {
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1)
  const d = pad2(date.getDate())
  return `${y}${m}${d}`
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
