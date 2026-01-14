import { useStore } from '../store'
import { MAJOR_CURRENCIES } from '../lib/types'
import { useI18n } from '../lib/i18n'

export function Settings() {
  const { state, setSettings } = useStore()
  const { t, language } = useI18n()

  function setLanguage(next: 'es' | 'en') {
    setSettings({
      ...state.settings,
      language: next,
    })
  }

  function toggleNotifications(enabled: boolean) {
    setSettings({
      ...state.settings,
      notificationsEnabled: enabled,
    })
  }

  function setNotifyDaysBefore(raw: string) {
    const n = Number(raw)
    const next = Number.isFinite(n) ? Math.max(0, Math.min(30, Math.floor(n))) : 0
    setSettings({
      ...state.settings,
      notifyDaysBefore: next,
    })
  }

  function setCurrencyDisplayMode(mode: 'original' | 'convertToBase') {
    setSettings({
      ...state.settings,
      currencyDisplayMode: mode,
    })
  }

  function setBaseCurrency(code: string) {
    setSettings({
      ...state.settings,
      baseCurrency: String(code || 'USD').trim().toUpperCase(),
    })
  }

  const calendarHref = 'https://calendar.google.com/calendar/u/0/r'

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('settings.languageTitle') ?? 'Idioma'}</div>
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">{t('settings.languageDescription') ?? 'Elige el idioma de la interfaz.'}</div>

        <div className="mt-3">
          <select
            className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
            value={language}
            onChange={e => setLanguage(e.target.value as 'es' | 'en')}
          >
            <option value="es">{t('common.language.es') ?? 'Español'}</option>
            <option value="en">{t('common.language.en') ?? 'English'}</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('settings.alertsTitle') ?? 'Alertas'}</div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={state.settings.notificationsEnabled}
              onChange={e => toggleNotifications(e.target.checked)}
              className="h-4 w-4"
            />
            {t('settings.enableNotifications') ?? 'Activar notificaciones'}
          </label>

          <label className="text-sm">
            <div className="mb-1 font-semibold">{t('settings.notifyDaysBefore') ?? 'Avisar (días antes)'}</div>
            <input
              type="number"
              min={0}
              max={30}
              className="w-40 rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={state.settings.notifyDaysBefore}
              onChange={e => setNotifyDaysBefore(e.target.value)}
              disabled={!state.settings.notificationsEnabled}
            />
          </label>
        </div>
        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {t('settings.alertsHint') ?? 'Las alertas se muestran como notificaciones del navegador.'}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('settings.currencyTitle') ?? 'Moneda'}</div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <div className="mb-1 font-semibold">{t('settings.displayAmounts') ?? 'Mostrar importes'}</div>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-950"
              value={state.settings.currencyDisplayMode}
              onChange={e => setCurrencyDisplayMode(e.target.value as 'original' | 'convertToBase')}
            >
              <option value="original">{t('settings.displayOriginal') ?? 'Con sus monedas originales'}</option>
              <option value="convertToBase">{t('settings.displayConvert') ?? 'Convertir a una moneda única'}</option>
            </select>
          </label>

          <label className="text-sm">
            <div className="mb-1 font-semibold">{t('settings.baseCurrency') ?? 'Moneda base'}</div>
            <select
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950"
              value={state.settings.baseCurrency}
              onChange={e => setBaseCurrency(e.target.value)}
              disabled={state.settings.currencyDisplayMode !== 'convertToBase'}
            >
              {MAJOR_CURRENCIES.map(c => (
                <option key={c.code} value={c.code}>
                  {c.code} ({c.symbol}) — {c.names[language]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {t('settings.currencyHint') ?? 'Si eliges “moneda única”, los totales y gráficos se convierten a la moneda base.'}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-lg font-bold">{t('settings.googleCalendarTitle') ?? 'Google Calendar'}</div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {t('settings.googleCalendarBody') ?? 'Se abre en una pestaña por seguridad (Google Calendar no se puede embeber en el panel).'}
        </p>
        <div className="mt-4">
          <a
            className="inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            href={calendarHref}
            target="_blank"
            rel="noreferrer"
          >
            {t('settings.openGoogleCalendar') ?? 'Abrir Google Calendar'}
          </a>
        </div>
      </div>
    </div>
  )
}
