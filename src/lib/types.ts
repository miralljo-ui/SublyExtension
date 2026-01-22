export type Period = 'monthly' | 'quarterly' | 'semiannual' | 'annual'

export type CurrencyOption = {
  code: string
  symbol: string
  names: {
    es: string
    en: string
  }
}

export const MAJOR_CURRENCIES: CurrencyOption[] = [
  { code: 'USD', symbol: '$', names: { es: 'Dólar estadounidense', en: 'US Dollar' } },
  { code: 'EUR', symbol: '€', names: { es: 'Euro', en: 'Euro' } },
  { code: 'GBP', symbol: '£', names: { es: 'Libra esterlina', en: 'Pound Sterling' } },
  { code: 'JPY', symbol: '¥', names: { es: 'Yen japonés', en: 'Japanese Yen' } },
  { code: 'AUD', symbol: 'A$', names: { es: 'Dólar australiano', en: 'Australian Dollar' } },
  { code: 'CAD', symbol: 'C$', names: { es: 'Dólar canadiense', en: 'Canadian Dollar' } },
  { code: 'CHF', symbol: 'CHF', names: { es: 'Franco suizo', en: 'Swiss Franc' } },
  { code: 'CNY', symbol: '¥', names: { es: 'Yuan chino', en: 'Chinese Yuan' } },
  { code: 'MXN', symbol: 'MX$', names: { es: 'Peso mexicano', en: 'Mexican Peso' } },
  { code: 'BRL', symbol: 'R$', names: { es: 'Real brasileño', en: 'Brazilian Real' } },
]

export type Subscription = {
  id: string
  name: string
  category?: string
  price: number
  currency: string
  period: Period
  startDate: string // YYYY-MM-DD

  // Optional per-subscription Calendar reminder override.
  reminder?: {
    enabled?: boolean
    daysBefore?: number
    method?: 'popup' | 'email'
  }

  // Google Calendar sync (optional)
  calendar?: {
    calendarId: string
    eventId?: string
    syncedAt?: string // ISO string
    lastError?: string
  }
}

export type AppSettings = {
  language: 'es' | 'en'
  currencyDisplayMode: 'original' | 'convertToBase'
  baseCurrency: string

  // Sidepanel onboarding
  onboardingCompleted?: boolean

  // Content-script UI
  // When enabled, the extension injects a small floating button on Google Calendar
  // to open the side panel.
  calendarFloatingButtonEnabled?: boolean

  // When enabled, changes in subscriptions trigger a best-effort sync.
  // Note: syncing still requires OAuth authorization.
  calendarAutoSyncAll?: boolean

  // When enabled, subscription events are published to a dedicated calendar
  // so they can be filtered in Google Calendar.
  calendarSubscriptionsCalendarId?: string

  // Default reminders for synced subscription events.
  // Stored as days/hours before the all-day event start.
  // (e.g. 1 day, 0 hours => 24h before)
  calendarReminderDaysBefore?: number
  calendarReminderMethod?: 'popup' | 'email'

  // Google Drive (appDataFolder) backup
  driveBackupFileId?: string
  driveLastBackupAt?: string // ISO
}

export type AppState = {
  subscriptions: Subscription[]
  settings: AppSettings
}
