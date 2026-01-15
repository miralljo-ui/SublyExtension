import { useMemo, useState } from 'react'
import { useStore } from '../store'
import { MAJOR_CURRENCIES } from '../lib/types'
import { useI18n } from '../lib/i18n'
import { useToast } from '../components/Toast'
import { driveLoadAppStateJson, driveSaveAppStateJson } from '../lib/googleDrive'
import { normalizeState } from '../lib/storage'

export function Settings() {
  const { state, setSettings, setSubscriptions } = useStore()
  const { t, language } = useI18n()
  const toast = useToast()

  const [driveBusy, setDriveBusy] = useState<null | 'save' | 'restore'>(null)

  const lastBackupLabel = useMemo(() => {
    const raw = String(state.settings.driveLastBackupAt || '').trim()
    if (!raw) return t('common.none') ?? '—'
    const d = new Date(raw)
    if (Number.isNaN(d.getTime())) return raw
    return d.toLocaleString(language === 'es' ? 'es-ES' : 'en-US')
  }, [language, state.settings.driveLastBackupAt, t])

  function setLanguage(next: 'es' | 'en') {
    setSettings({
      ...state.settings,
      language: next,
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

  function toggleCalendarAutoSyncAll(enabled: boolean) {
    setSettings({
      ...state.settings,
      calendarAutoSyncAll: enabled,
    })
  }

  function toggleCalendarDedicated(enabled: boolean) {
    setSettings({
      ...state.settings,
      calendarUseDedicatedCalendar: enabled,
    })
  }

  const calendarHref = 'https://calendar.google.com/calendar/u/0/r'

  async function saveBackupToDrive() {
    if (driveBusy) return
    setDriveBusy('save')
    try {
      const payload = JSON.stringify({ version: 1, savedAt: new Date().toISOString(), state }, null, 2)
      const result = await driveSaveAppStateJson({
        json: payload,
        fileId: state.settings.driveBackupFileId,
        interactive: true,
      })

      setSettings({
        ...state.settings,
        driveBackupFileId: result.fileId,
        driveLastBackupAt: result.modifiedTime ?? new Date().toISOString(),
      })

      toast.success(t('drive.backupSaved') ?? 'Copia guardada en Google Drive.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error((t('drive.backupSaveFailed') ?? 'No se pudo guardar la copia en Google Drive.') + (msg ? ` ${msg}` : ''))
    } finally {
      setDriveBusy(null)
    }
  }

  async function restoreBackupFromDrive() {
    if (driveBusy) return
    const confirmText = t('drive.restoreConfirm') ?? 'Esto reemplazará tus datos locales con los de Drive. ¿Continuar?'
    if (!window.confirm(confirmText)) return

    setDriveBusy('restore')
    try {
      const loaded = await driveLoadAppStateJson({
        fileId: state.settings.driveBackupFileId,
        interactive: true,
      })

      let parsed: unknown
      try {
        parsed = JSON.parse(loaded.jsonText)
      } catch {
        throw new Error('Invalid JSON in Drive backup file.')
      }

      // Accept either: { state: AppState } wrapper, or an AppState-like object.
      const rawState = (parsed && typeof parsed === 'object' && 'state' in (parsed as any))
        ? (parsed as any).state
        : parsed

      const normalized = normalizeState(rawState as any)
      setSubscriptions(normalized.subscriptions)
      setSettings({
        ...normalized.settings,
        // Preserve Drive metadata so next save/restore uses the same file.
        driveBackupFileId: loaded.fileId,
        driveLastBackupAt: loaded.modifiedTime ?? new Date().toISOString(),
      })

      toast.success(t('drive.backupRestored') ?? 'Datos restaurados desde Google Drive.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error((t('drive.backupRestoreFailed') ?? 'No se pudo restaurar desde Google Drive.') + (msg ? ` ${msg}` : ''))
    } finally {
      setDriveBusy(null)
    }
  }

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
          <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">{t('settings.calendarSyncTitle') ?? 'Sincronización'}</div>

          <label className="mt-2 flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={Boolean(state.settings.calendarUseDedicatedCalendar)}
              onChange={e => toggleCalendarDedicated(e.target.checked)}
              className="h-4 w-4"
            />
            {t('settings.calendarDedicatedLabel') ?? 'Usar calendario dedicado para suscripciones'}
          </label>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {t('settings.calendarDedicatedHint') ?? 'Si está activo, los eventos se publican en un calendario separado para poder filtrarlos en Google Calendar.'}
          </div>

          <label className="mt-2 flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={Boolean(state.settings.calendarAutoSyncAll)}
              onChange={e => toggleCalendarAutoSyncAll(e.target.checked)}
              className="h-4 w-4"
            />
            {t('settings.calendarAutoSyncAllLabel') ?? 'Auto-sync de suscripciones'}
          </label>
          <div className="mt-2 text-xs text-slate-500 dark:text-slate-400">
            {t('settings.calendarAutoSyncAllHint') ?? 'Si está activo, los cambios en Suscripciones intentarán sincronizarse automáticamente (si ya hay autorización).'}
          </div>
        </div>

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

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-lg font-bold">{t('drive.title') ?? 'Google Drive (backup)'}</div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {t('drive.body') ?? 'Guarda y restaura tus datos usando la carpeta oculta de la app (appDataFolder).'}
        </p>

        <div className="mt-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
          {t('drive.lastBackup') ?? 'Última copia'}: {lastBackupLabel}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
            onClick={saveBackupToDrive}
            disabled={driveBusy !== null}
          >
            {driveBusy === 'save' ? (t('drive.saving') ?? 'Guardando…') : (t('drive.save') ?? 'Guardar en Drive')}
          </button>
          <button
            type="button"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
            onClick={restoreBackupFromDrive}
            disabled={driveBusy !== null}
          >
            {driveBusy === 'restore' ? (t('drive.restoring') ?? 'Restaurando…') : (t('drive.restore') ?? 'Restaurar desde Drive')}
          </button>
        </div>
      </div>
    </div>
  )
}
