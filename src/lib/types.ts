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

  // When enabled, changes in subscriptions trigger a best-effort sync.
  // Note: syncing still requires OAuth authorization.
  calendarAutoSyncAll?: boolean

  // When enabled, subscription events are published to a dedicated calendar
  // so they can be filtered in Google Calendar.
  calendarUseDedicatedCalendar?: boolean
  calendarSubscriptionsCalendarId?: string

  // Google Drive (appDataFolder) backup
  driveBackupFileId?: string
  driveLastBackupAt?: string // ISO
}

export type AppState = {
  subscriptions: Subscription[]
  settings: AppSettings
}
