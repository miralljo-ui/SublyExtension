import { useCallback } from 'react'
import { useStore } from '../store'

export type Language = 'es' | 'en'

type TranslationValue = string | TranslationDict

interface TranslationDict {
  [key: string]: TranslationValue
}

type Params = Record<string, string | number>

const translations: Record<Language, TranslationDict> = {
  es: {
    common: {
      loading: 'Cargando…',
      language: { es: 'Español', en: 'English' },
      cancel: 'Cancelar',
      save: 'Guardar',
      add: 'Añadir',
      edit: 'Editar',
      delete: 'Eliminar',
      importJson: 'Importar JSON',
      exportJson: 'Exportar JSON',
      exported: 'Exportado.',
      importedCount: 'Importadas: {{count}}',
      importFailed: 'Importación fallida (JSON inválido o estructura incorrecta).',
      none: '—',
      uncategorized: 'Sin categoría',
      other: 'Otros',
    },
    nav: {
      dashboard: 'Dashboard',
      subscriptions: 'Suscripciones',
      settings: 'Ajustes',
    },
    settings: {
      languageTitle: 'Idioma',
      languageDescription: 'Elige el idioma de la interfaz.',
      alertsTitle: 'Alertas',
      enableNotifications: 'Activar notificaciones',
      notifyDaysBefore: 'Avisar (días antes)',
      alertsHint: 'Las alertas se muestran como notificaciones del navegador.',
      currencyTitle: 'Moneda',
      displayAmounts: 'Mostrar importes',
      displayOriginal: 'Con sus monedas originales',
      displayConvert: 'Convertir a una moneda única',
      baseCurrency: 'Moneda base',
      currencyHint: 'Si eliges “moneda única”, los totales y gráficos se convierten a la moneda base.',
      googleCalendarTitle: 'Google Calendar',
      googleCalendarBody: 'Se abre en una pestaña por seguridad (Google Calendar no se puede embeber en el panel).',
      openGoogleCalendar: 'Abrir Google Calendar',
    },
    subscriptions: {
      listTitle: 'Listado',
      addSubscription: 'Añadir suscripción',
      noSubscriptions: 'No hay suscripciones aún.',
      addToCalendar: 'Añadir a Calendar',
      editSubscription: 'Editar suscripción',
      addSubscriptionTitle: 'Añadir suscripción',
      name: 'Nombre',
      category: 'Categoría',
      categoryPlaceholder: 'Ej: Streaming',
      amount: 'Importe',
      currency: 'Moneda',
      period: 'Periodo',
      startDate: 'Fecha inicio',
      helpIncomplete: 'Completa nombre, importe y fecha.',
      startLabel: 'Inicio',
      nextLabel: 'Próximo',
      renewal: 'Renovación',
      detailsAmount: 'Importe',
      detailsPeriod: 'Periodo',
      periodMonthly: 'Mensual',
      periodQuarterly: 'Trimestral',
      periodSemiannual: 'Semestral',
      periodAnnual: 'Anual',
    },
    dashboard: {
      monthlySpendTitle: 'Gasto mensual (equivalente)',
      noSubscriptionsYet: 'Sin suscripciones aún.',
      fxRatesLabel: 'FX rates',
      fxUpdating: 'actualizando…',
      fxReady: 'reales (cacheadas)',
      fxUnavailable: 'no disponibles (fallback)',
      fxIdle: '—',
      upcomingRenewalsTitle: 'Próximas renovaciones',
      noDataYet: 'No hay datos todavía.',
      chartsTitle: 'Gráficos',
      addSubsToSeeCharts: 'Añade suscripciones para ver gráficos.',
      currencyLabel: 'Moneda: {{cur}}',
      kpiSubscriptions: 'Suscripciones',
      kpiAvgMonthly: 'Media mensual',
      kpiDueSoon: 'Vencen (≤ {{days}}d)',
      kpiTopCategory: 'Top categoría',
      projectionTitle: 'Proyección mensual (últimos 12 meses)',
      annualTopTitle: 'Top gasto anual (estimado)',
      monthlyByCategoryTitle: 'Gasto mensual por categoría (equivalente)',
      distributionTitle: 'Distribución (gasto mensual equivalente)',
      noData: 'Sin datos.',
      csvMonth: 'Mes',
      csvAmount: 'Importe',
      csvCurrency: 'Moneda',
      csvName: 'Nombre',
      csvAnnualAmount: 'Importe anual',
      csvCategory: 'Categoría',
      csvMonthlyEquivalent: 'Equivalente mensual',
    },
  },
  en: {
    common: {
      loading: 'Loading…',
      language: { es: 'Español', en: 'English' },
      cancel: 'Cancel',
      save: 'Save',
      add: 'Add',
      edit: 'Edit',
      delete: 'Delete',
      importJson: 'Import JSON',
      exportJson: 'Export JSON',
      exported: 'Exported.',
      importedCount: 'Imported: {{count}}',
      importFailed: 'Import failed (invalid JSON or wrong structure).',
      none: '—',
      uncategorized: 'Uncategorized',
      other: 'Other',
    },
    nav: {
      dashboard: 'Dashboard',
      subscriptions: 'Subscriptions',
      settings: 'Settings',
    },
    settings: {
      languageTitle: 'Language',
      languageDescription: 'Choose the UI language.',
      alertsTitle: 'Alerts',
      enableNotifications: 'Enable notifications',
      notifyDaysBefore: 'Notify (days before)',
      alertsHint: 'Alerts are shown as browser notifications.',
      currencyTitle: 'Currency',
      displayAmounts: 'Show amounts',
      displayOriginal: 'In original currencies',
      displayConvert: 'Convert to a single currency',
      baseCurrency: 'Base currency',
      currencyHint: 'If you choose “single currency”, totals and charts are converted to the base currency.',
      googleCalendarTitle: 'Google Calendar',
      googleCalendarBody: 'It opens in a new tab for security (Google Calendar can’t be embedded in the panel).',
      openGoogleCalendar: 'Open Google Calendar',
    },
    subscriptions: {
      listTitle: 'List',
      addSubscription: 'Add subscription',
      noSubscriptions: 'No subscriptions yet.',
      addToCalendar: 'Add to Calendar',
      editSubscription: 'Edit subscription',
      addSubscriptionTitle: 'Add subscription',
      name: 'Name',
      category: 'Category',
      categoryPlaceholder: 'e.g. Streaming',
      amount: 'Amount',
      currency: 'Currency',
      period: 'Period',
      startDate: 'Start date',
      helpIncomplete: 'Fill name, amount and date.',
      startLabel: 'Start',
      nextLabel: 'Next',
      renewal: 'Renewal',
      detailsAmount: 'Amount',
      detailsPeriod: 'Period',
      periodMonthly: 'Monthly',
      periodQuarterly: 'Quarterly',
      periodSemiannual: 'Semiannual',
      periodAnnual: 'Annual',
    },
    dashboard: {
      monthlySpendTitle: 'Monthly spend (equivalent)',
      noSubscriptionsYet: 'No subscriptions yet.',
      fxRatesLabel: 'FX rates',
      fxUpdating: 'updating…',
      fxReady: 'real (cached)',
      fxUnavailable: 'unavailable (fallback)',
      fxIdle: '—',
      upcomingRenewalsTitle: 'Upcoming renewals',
      noDataYet: 'No data yet.',
      chartsTitle: 'Charts',
      addSubsToSeeCharts: 'Add subscriptions to see charts.',
      currencyLabel: 'Currency: {{cur}}',
      kpiSubscriptions: 'Subscriptions',
      kpiAvgMonthly: 'Avg monthly',
      kpiDueSoon: 'Due (≤ {{days}}d)',
      kpiTopCategory: 'Top category',
      projectionTitle: 'Monthly projection (last 12 months)',
      annualTopTitle: 'Top annual spend (estimated)',
      monthlyByCategoryTitle: 'Monthly spend by category (equivalent)',
      distributionTitle: 'Distribution (monthly equivalent spend)',
      noData: 'No data.',
      csvMonth: 'Month',
      csvAmount: 'Amount',
      csvCurrency: 'Currency',
      csvName: 'Name',
      csvAnnualAmount: 'Annual amount',
      csvCategory: 'Category',
      csvMonthlyEquivalent: 'Monthly equivalent',
    },
  },
}

function getNested(dict: TranslationDict, path: string): TranslationValue | undefined {
  const parts = path.split('.')
  let cursor: TranslationValue = dict
  for (const part of parts) {
    if (typeof cursor !== 'object' || cursor === null) return undefined
    cursor = (cursor as TranslationDict)[part]
    if (cursor === undefined) return undefined
  }
  return cursor
}

function applyParams(template: string, params?: Params): string {
  if (!params) return template
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => String(params[key] ?? ''))
}

export function translate(language: Language, key: string, params?: Params): string | undefined {
  const dict = translations[language] ?? translations.es
  const value = getNested(dict, key)
  if (typeof value === 'string') return applyParams(value, params)
  return undefined
}

export function useI18n() {
  const { state } = useStore()
  const language: Language = state.settings.language === 'en' ? 'en' : 'es'

  const t = useCallback(
    (key: string, params?: Params) => translate(language, key, params),
    [language],
  )

  return { language, t }
}
