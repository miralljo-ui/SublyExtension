export type Period = 'monthly' | 'quarterly' | 'semiannual' | 'annual'

export type Subscription = {
  id: string
  name: string
  price: number
  currency: string
  period: Period
  startDate: string // YYYY-MM-DD
}

export type AppSettings = {
  notificationsEnabled: boolean
  notifyDaysBefore: number
}

export type AppState = {
  subscriptions: Subscription[]
  settings: AppSettings
}
