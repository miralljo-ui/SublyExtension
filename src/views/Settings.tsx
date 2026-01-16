import { type ReactNode, useId, useMemo, useState } from 'react'
import { useStore } from '../store'
import { MAJOR_CURRENCIES } from '../lib/types'
import { useI18n } from '../lib/i18n'
import { useToast } from '../components/Toast'
import { driveLoadAppStateJson, driveSaveAppStateJson } from '../lib/googleDrive'
import { DEFAULT_SETTINGS, normalizeState } from '../lib/storage'
import { disconnectGoogle } from '../lib/googleAuth'
import GradientText from '../components/ui/GradientText'

function SettingsCard({
  title,
  description,
  tone = 'neutral',
  hideHeader = false,
  children,
}: {
  title?: ReactNode
  description?: ReactNode
  tone?:
    | 'neutral'
    | 'blue'
    | 'blueGradient'
    | 'teal'
    | 'amber'
    | 'violet'
    | 'fuchsia'
    | 'indigo'
    | 'slate'
    | 'emerald'
    | 'cyan'
    | 'rose'
  hideHeader?: boolean
  children: ReactNode
}) {
  const toneClasses: Record<NonNullable<Parameters<typeof SettingsCard>[0]['tone']>, string> = {
    neutral: 'bg-gradient-to-br from-slate-900 via-slate-950/60 to-slate-950',
    blue: 'bg-gradient-to-br from-sky-950/80 via-slate-900 to-sky-950/30',
    blueGradient:
      'bg-slate-950 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.28),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(167,139,250,0.22),transparent_55%)]',
    teal: 'bg-gradient-to-br from-teal-950/80 via-slate-900 to-teal-950/30',
    amber: 'bg-gradient-to-br from-amber-950/95 via-slate-950/75 to-amber-950/15',
    violet: 'bg-gradient-to-br from-violet-950/80 via-slate-900 to-violet-950/30',
    fuchsia: 'bg-gradient-to-br from-fuchsia-950/70 via-slate-900 to-fuchsia-950/30',
    indigo: 'bg-gradient-to-br from-indigo-950/80 via-slate-900 to-indigo-950/30',
    slate: 'bg-gradient-to-br from-slate-950/70 via-slate-900 to-slate-950/30',
    emerald: 'bg-gradient-to-br from-emerald-950/80 via-slate-900 to-emerald-950/30',
    cyan: 'bg-gradient-to-br from-cyan-950/80 via-slate-900 to-cyan-950/30',
    rose: 'bg-gradient-to-br from-rose-950/80 via-slate-900 to-rose-950/30',
  }

  return (
    <div className={`rounded-xl border border-white/60 ${toneClasses[tone]}`}>
      <div className="p-4">
        {!hideHeader && (title || description) && (
          <div className="min-w-0">
            {title && <div className="text-sm font-semibold text-slate-200">{title}</div>}
            {description && <div className="mt-2 text-xs text-slate-400">{description}</div>}
          </div>
        )}

        <div className={!hideHeader && (title || description) ? 'mt-3' : ''}>{children}</div>
      </div>
    </div>
  )
}

function SettingsGroup({
  title,
  description,
  defaultOpen = false,
  gradientColors = ['#38BDF8', '#A78BFA', '#FB7185'],
  titleShowBorder = false,
  titleUppercase = true,
  children,
}: {
  title: ReactNode
  description?: ReactNode
  defaultOpen?: boolean
  gradientColors?: string[]
  titleShowBorder?: boolean
  titleUppercase?: boolean
  children: ReactNode
}) {
  const contentId = useId()
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-xl border border-slate-800 bg-slate-900">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 p-4 text-left"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-controls={contentId}
      >
        <div className="min-w-0">
          <GradientText
            className={titleUppercase ? 'text-sm font-bold uppercase tracking-wide' : 'text-sm font-bold'}
            colors={gradientColors}
            animationSpeed={10}
            showBorder={titleShowBorder}
            direction="horizontal"
            pauseOnHover
            yoyo
          >
            {title}
          </GradientText>
          {description && <div className="mt-2 text-xs text-slate-400">{description}</div>}
        </div>
        <div className="mt-0.5 shrink-0 text-slate-400">
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={open ? 'rotate-180 transition-transform' : 'transition-transform'}
            aria-hidden="true"
          >
            <path d="M6 9l6 6 6-6" />
          </svg>
        </div>
      </button>

      <div id={contentId} className={open ? 'space-y-3 px-4 pb-4' : 'hidden space-y-3 px-4 pb-4'}>
        {children}
      </div>
    </div>
  )
}

export function Settings() {
  const { state, setSettings, setSubscriptions } = useStore()
  const { t, language } = useI18n()
  const toast = useToast()

  const [driveBusy, setDriveBusy] = useState<null | 'save' | 'restore'>(null)
  const [feedbackText, setFeedbackText] = useState('')

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

  function toggleFloatingButton(enabled: boolean) {
    setSettings({
      ...state.settings,
      calendarFloatingButtonEnabled: enabled,
    })
  }

  function openOnboarding() {
    setSettings({
      ...state.settings,
      onboardingCompleted: false,
    })
    toast.info(t('settings.onboardingOpened') ?? 'Onboarding abierto.')
  }

  async function copyDiagnostics() {
    const payload = {
      generatedAt: new Date().toISOString(),
      language,
      settings: {
        currencyDisplayMode: state.settings.currencyDisplayMode,
        baseCurrency: state.settings.baseCurrency,
        calendarAutoSyncAll: Boolean(state.settings.calendarAutoSyncAll),
        calendarUseDedicatedCalendar: Boolean(state.settings.calendarUseDedicatedCalendar),
        calendarFloatingButtonEnabled: state.settings.calendarFloatingButtonEnabled !== false,
        driveBackupLinked: Boolean(state.settings.driveBackupFileId),
        driveLastBackupAt: state.settings.driveLastBackupAt || null,
      },
      subscriptionsCount: state.subscriptions.length,
    }

    const text = JSON.stringify(payload, null, 2)
    try {
      await navigator.clipboard.writeText(text)
      toast.success(t('settings.helpCopied') ?? 'Diagnóstico copiado.')
    } catch {
      try {
        window.prompt(t('settings.helpCopyFailed') ?? 'No se pudo copiar automáticamente. Copia el texto:', text)
      } catch {
        toast.error(t('settings.helpCopyFailed') ?? 'No se pudo copiar automáticamente. Copia el texto manualmente.')
      }
    }
  }

  async function copyFeedback() {
    const trimmed = feedbackText.trim()
    if (!trimmed) {
      toast.info(t('settings.helpFeedbackEmpty') ?? 'Escribe un comentario antes de copiar.')
      return
    }
    try {
      await navigator.clipboard.writeText(trimmed)
      toast.success(t('settings.helpFeedbackCopied') ?? 'Comentario copiado.')
    } catch {
      try {
        window.prompt(t('settings.helpCopyFailed') ?? 'No se pudo copiar automáticamente. Copia el texto:', trimmed)
      } catch {
        toast.error(t('settings.helpCopyFailed') ?? 'No se pudo copiar automáticamente. Copia el texto manualmente.')
      }
    }
  }

  const privacyHref = useMemo(() => {
    const chromeUrl = (globalThis as any)?.chrome?.runtime?.getURL
    if (typeof chromeUrl === 'function') return chromeUrl('PRIVACY.md') as string
    return '/PRIVACY.md'
  }, [])

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

      const rawState = parsed && typeof parsed === 'object' && 'state' in (parsed as any) ? (parsed as any).state : parsed
      const normalized = normalizeState(rawState as any)

      setSubscriptions(normalized.subscriptions)
      setSettings({
        ...normalized.settings,
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

  async function disconnectGoogleAccount() {
    const confirmText = t('settings.googleDisconnectConfirm') ??
      'Esto desconectará Subly de tu cuenta de Google en este navegador. ¿Continuar?'
    if (!window.confirm(confirmText)) return

    try {
      const res = await disconnectGoogle({ interactive: false })
      if (!res.hadToken) {
        toast.info(t('settings.googleDisconnectNoToken') ?? 'No hay sesión activa que desconectar.')
        return
      }
      toast.success(t('settings.googleDisconnectDone') ?? 'Desconectado. La próxima vez se pedirán permisos de nuevo.')
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      toast.error(msg || 'Disconnect failed')
    }
  }

  function resetLocalData() {
    const confirmText = t('settings.resetLocalConfirm') ??
      'Esto borrará tus datos locales (suscripciones y ajustes) en este dispositivo. ¿Continuar?'
    if (!window.confirm(confirmText)) return

    setSubscriptions([])
    setSettings({
      ...DEFAULT_SETTINGS,
      language: state.settings.language,
    })
    toast.success(t('settings.resetLocalDone') ?? 'Datos locales borrados.')
  }

  return (
    <div className="space-y-4">
      <SettingsGroup
        title={t('settings.groupGeneral') ?? 'General'}
        gradientColors={['#E2E8F0', '#94A3B8', '#A78BFA']}
        defaultOpen
      >
        <SettingsCard
          title={t('settings.languageTitle') ?? 'Idioma'}
          description={t('settings.languageDescription') ?? 'Selecciona el idioma de la app.'}
          tone="blue"
        >
          <select
            className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
            value={state.settings.language}
            onChange={e => setLanguage(e.target.value as 'es' | 'en')}
          >
            <option value="es">{t('common.language.es') ?? 'Español'}</option>
            <option value="en">{t('common.language.en') ?? 'English'}</option>
          </select>
        </SettingsCard>

        <SettingsCard
          title={t('settings.currencyTitle') ?? 'Moneda'}
          description={t('settings.currencyHint') ??
            'Al convertir a una sola moneda, los totales y gráficos se muestran en la moneda base.'}
          tone="blue"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <div className="mb-1 font-semibold text-slate-200">{t('settings.displayAmounts') ?? 'Mostrar importes'}</div>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                value={state.settings.currencyDisplayMode}
                onChange={e => setCurrencyDisplayMode(e.target.value as 'original' | 'convertToBase')}
              >
                <option value="original">{t('settings.displayOriginal') ?? 'Con sus monedas originales'}</option>
                <option value="convertToBase">{t('settings.displayConvert') ?? 'Convertir a una moneda única'}</option>
              </select>
            </label>

            <label className="text-sm">
              <div className="mb-1 font-semibold text-slate-200">{t('settings.baseCurrency') ?? 'Moneda base'}</div>
              <select
                className="w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 disabled:opacity-60"
                value={state.settings.baseCurrency}
                onChange={e => setBaseCurrency(e.target.value)}
                disabled={state.settings.currencyDisplayMode !== 'convertToBase'}
              >
                {MAJOR_CURRENCIES.map(c => (
                  <option key={c.code} value={c.code}>
                    {c.code} — {c.names[state.settings.language]}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </SettingsCard>

        <SettingsCard
          title={t('settings.onboardingTitle') ?? 'Primeros pasos'}
          description={t('settings.onboardingDescription') ?? 'Puedes volver a ver el onboarding cuando quieras.'}
          tone="blue"
        >
          <button
            type="button"
            className="inline-flex rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900"
            onClick={openOnboarding}
          >
            {t('settings.openOnboarding') ?? 'Ver onboarding de nuevo'}
          </button>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup
        title={t('settings.groupIntegrations') ?? 'Integraciones'}
        gradientColors={['#38BDF8', '#A78BFA', '#FB7185']}
      >

        <SettingsCard
          tone="fuchsia"
          hideHeader
        >
          <div className="space-y-3">
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={Boolean(state.settings.calendarUseDedicatedCalendar)}
                onChange={e => toggleCalendarDedicated(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-200">{t('settings.calendarDedicatedLabel') ?? 'Usar calendario dedicado'}</div>
                <div className="mt-1 text-xs text-slate-400">{t('settings.calendarDedicatedHint') ?? 'Al activarlo, se crea un calendario dedicado para tus suscripciones.'}</div>
              </div>
            </label>

            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={Boolean(state.settings.calendarAutoSyncAll)}
                onChange={e => toggleCalendarAutoSyncAll(e.target.checked)}
                className="mt-1 h-4 w-4"
              />
              <div className="min-w-0">
                <div className="text-sm font-semibold text-slate-200">{t('settings.calendarAutoSyncAllLabel') ?? 'Auto-sync de suscripciones'}</div>
                <div className="mt-1 text-xs text-slate-400">{t('settings.calendarAutoSyncAllHint') ?? 'Al guardar cambios en Suscripciones, se intentará sincronizar automáticamente (si ya diste permiso).'}</div>
              </div>
            </label>

            <a
              className="inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
              href={calendarHref}
              target="_blank"
              rel="noreferrer"
            >
              {t('settings.openGoogleCalendar') ?? 'Abrir Google Calendar'}
            </a>
          </div>
        </SettingsCard>

        <SettingsCard
          title={t('settings.extensionTitle') ?? 'Extensión'}
          description={t('settings.floatingButtonHint') ??
            'Si lo desactivas, podrás abrir Subly solo desde el icono de la extensión (o el panel lateral si ya está abierto).'}
          tone="fuchsia"
        >
          <label className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              checked={state.settings.calendarFloatingButtonEnabled !== false}
              onChange={e => toggleFloatingButton(e.target.checked)}
              className="h-4 w-4"
            />
            <span className="font-semibold text-slate-200">{t('settings.floatingButtonLabel') ?? 'Mostrar botón flotante en Google Calendar'}</span>
          </label>

        </SettingsCard>

        <SettingsCard title={t('settings.privacyTitle') ?? 'Permisos'} tone="fuchsia">
          <p className="text-sm text-slate-300">
            {t('settings.privacyBody') ??
              'Subly guarda tus datos localmente. Si activas sincronización/backup, usa Google OAuth para crear/actualizar eventos en Google Calendar y guardar una copia JSON en Drive (appDataFolder).'}
          </p>
          <p className="mt-2 text-xs text-slate-400">
            {t('settings.permissionsHint') ??
              'Permisos: identity (OAuth), storage (guardar estado), sidePanel (UI), y acceso a Google APIs + proveedor de tipos de cambio.'}
          </p>

          <div className="mt-4">
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md border border-amber-800/60 bg-amber-950/30 px-4 py-2 text-sm font-semibold text-amber-200 shadow-sm backdrop-blur ring-1 ring-white/10 hover:bg-amber-950/45"
              onClick={disconnectGoogleAccount}
            >
              {t('settings.googleDisconnectLabel') ?? 'Desconectar Google'}
            </button>
            <div className="mt-2 text-xs text-slate-400">
              {t('settings.googleDisconnectHint') ??
                'Revoca el token OAuth y fuerza a pedir permisos de nuevo la próxima vez. No borra eventos de Calendar ni tu backup en Drive.'}
            </div>
          </div>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup
        title={t('settings.groupData') ?? 'Datos y mantenimiento'}
        gradientColors={['#34D399', '#A3E635', '#60A5FA']}
      >
        <SettingsCard
          title={t('drive.title') ?? 'Copia de seguridad'}
          description={t('drive.body') ?? 'Guarda una copia en tu Google Drive y restaura una copia anterior cuando lo necesites.'}
          tone="emerald"
        >
          <div className="text-xs font-semibold text-slate-400">
            {t('drive.lastBackup') ?? 'Última copia'}: {lastBackupLabel}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-60"
              onClick={saveBackupToDrive}
              disabled={driveBusy !== null}
            >
              {driveBusy === 'save' ? (t('drive.saving') ?? 'Guardando…') : (t('drive.save') ?? 'Guardar copia')}
            </button>
            <button
              type="button"
              className="rounded-md bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-slate-200 disabled:opacity-60"
              onClick={restoreBackupFromDrive}
              disabled={driveBusy !== null}
            >
              {driveBusy === 'restore' ? (t('drive.restoring') ?? 'Restaurando…') : (t('drive.restore') ?? 'Restaurar copia')}
            </button>
          </div>
        </SettingsCard>

        <SettingsCard
          title={t('settings.helpPrivacyQ') ?? 'Privacidad'}
          description={t('settings.helpPrivacyA') ??
            'Tus datos se guardan localmente. Solo si activas integraciones, Subly usa Google OAuth para Calendar y/o guardar un backup JSON en Drive (appDataFolder).'}
          tone="cyan"
        >
          <a
            className="inline-flex rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900"
            href={privacyHref}
            target="_blank"
            rel="noreferrer"
          >
            {t('settings.helpPrivacyOpen') ?? 'Abrir política de privacidad'}
          </a>
        </SettingsCard>

        <SettingsCard
          title={t('settings.dataTitle') ?? 'Datos'}
          description={t('settings.resetLocalHint') ??
            'Elimina suscripciones y restablece ajustes de este dispositivo. No borra tu copia en Drive ni eventos ya creados en Calendar.'}
          tone="rose"
        >
          <button
            type="button"
            className="rounded-md bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-500"
            onClick={resetLocalData}
          >
            {t('settings.resetLocalLabel') ?? 'Borrar datos locales'}
          </button>
        </SettingsCard>
      </SettingsGroup>

      <SettingsGroup
        title={t('settings.groupHelp') ?? 'Ayuda'}
        gradientColors={['#94A3B8', '#E2E8F0', '#A78BFA']}
      >
        <SettingsCard
          title={t('settings.helpFaqTitle') ?? 'FAQ'}
          description={t('settings.helpFaqDescription') ?? 'Respuestas rápidas y solución de problemas.'}
          tone="amber"
        >
          <div className="space-y-2 text-sm">
            <details className="group rounded-lg border border-white/10 bg-slate-950/40 p-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-200 [&::-webkit-details-marker]:hidden">
                <span>{t('settings.helpOpenPanelQ') ?? '¿Cómo abro el panel?'}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <div className="mt-2 text-slate-300">{t('settings.helpOpenPanelA') ?? 'En Google Calendar puedes usar el botón flotante (si está activado) o hacer clic en el icono de la extensión para abrir el Side Panel.'}</div>
            </details>

            <details className="group rounded-lg border border-white/10 bg-slate-950/40 p-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-200 [&::-webkit-details-marker]:hidden">
                <span>{t('settings.helpDriveQ') ?? '¿Qué se guarda en Drive?'}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <div className="mt-2 text-slate-300">{t('settings.helpDriveA') ?? 'Un único archivo JSON en la carpeta oculta appDataFolder (por defecto: subly-state.json).'}</div>
            </details>

            <details className="group rounded-lg border border-white/10 bg-slate-950/40 p-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-200 [&::-webkit-details-marker]:hidden">
                <span>{t('settings.helpCalendarQ') ?? '¿Qué crea en Google Calendar?'}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <div className="mt-2 text-slate-300">{t('settings.helpCalendarA') ?? 'Eventos recurrentes (todo el día) para cada suscripción, si sincronizas.'}</div>
            </details>

            <details className="group rounded-lg border border-white/10 bg-slate-950/40 p-3">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-semibold text-slate-200 [&::-webkit-details-marker]:hidden">
                <span>{t('settings.helpTroubleshootingQ') ?? 'Solución de problemas'}</span>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true">
                  <path d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <div className="mt-2 text-slate-300">
                <div>{t('settings.helpTroubleshootingA') ?? 'Si algo no funciona, prueba estos pasos:'}</div>
                <ul className="mt-2 list-disc space-y-1 pl-5">
                  <li>{t('settings.helpTs1') ?? 'Recarga Google Calendar y vuelve a abrir el panel.'}</li>
                  <li>{t('settings.helpTs2') ?? 'Revisa los toggles de sincronización y el botón flotante en Integraciones.'}</li>
                  <li>{t('settings.helpTs3') ?? 'Si Drive/Calendar falla, desconecta Google y vuelve a autorizar desde la acción que lo requiera.'}</li>
                </ul>
              </div>
            </details>
          </div>
        </SettingsCard>

        <SettingsCard
          title={t('settings.helpContactTitle') ?? 'Ponte en contacto con nosotros'}
          description={t('settings.helpContactDescription') ?? 'Incluye el diagnóstico para resolver incidencias más rápido.'}
          tone="amber"
        >
          <div className="text-sm text-slate-300">
            {t('settings.helpContactA') ??
              'Para soporte, usa el email de soporte indicado en la ficha de Chrome Web Store. Si vas a reportar un problema, adjunta también el Diagnóstico.'}
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-slate-950/40 px-3 py-2">
              <div className="text-xs font-semibold text-slate-200">{t('settings.helpStatusAutoSync') ?? 'Auto-sync'}</div>
              <div className={state.settings.calendarAutoSyncAll ? 'text-xs font-semibold text-emerald-300' : 'text-xs font-semibold text-slate-400'}>
                {state.settings.calendarAutoSyncAll ? (t('common.on') ?? 'ON') : (t('common.off') ?? 'OFF')}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-slate-950/40 px-3 py-2">
              <div className="text-xs font-semibold text-slate-200">{t('settings.helpStatusDedicated') ?? 'Calendario dedicado'}</div>
              <div className={state.settings.calendarUseDedicatedCalendar ? 'text-xs font-semibold text-emerald-300' : 'text-xs font-semibold text-slate-400'}>
                {state.settings.calendarUseDedicatedCalendar ? (t('common.on') ?? 'ON') : (t('common.off') ?? 'OFF')}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-slate-950/40 px-3 py-2">
              <div className="text-xs font-semibold text-slate-200">{t('settings.helpStatusFloating') ?? 'Botón flotante'}</div>
              <div className={state.settings.calendarFloatingButtonEnabled !== false ? 'text-xs font-semibold text-emerald-300' : 'text-xs font-semibold text-slate-400'}>
                {state.settings.calendarFloatingButtonEnabled !== false ? (t('common.on') ?? 'ON') : (t('common.off') ?? 'OFF')}
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 rounded-md border border-white/10 bg-slate-950/40 px-3 py-2">
              <div className="text-xs font-semibold text-slate-200">{t('settings.helpStatusDrive') ?? 'Backup en Drive'}</div>
              <div className={state.settings.driveBackupFileId ? 'text-xs font-semibold text-emerald-300' : 'text-xs font-semibold text-slate-400'}>
                {state.settings.driveBackupFileId ? (t('settings.helpStatusLinked') ?? 'Vinculado') : (t('settings.helpStatusNotLinked') ?? 'No vinculado')}
              </div>
            </div>
          </div>
          <div className="mt-2 text-xs text-slate-400">{(t('settings.helpContactLastBackup') ?? 'Última copia en Drive')}: {lastBackupLabel}</div>

          <div className="mt-3 text-xs text-slate-400">
            {t('settings.helpDiagnosticsA') ?? 'Copia un resumen del estado de la app para adjuntarlo en un reporte (no incluye tokens OAuth).'}
          </div>
          <div className="mt-2">
            <button
              type="button"
              onClick={copyDiagnostics}
              className="inline-flex rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900"
            >
              {t('settings.helpCopyDiagnostics') ?? 'Copiar diagnóstico'}
            </button>
          </div>
        </SettingsCard>

        <SettingsCard
          title={t('settings.helpFeedbackTitle') ?? 'Enviar comentarios'}
          description={t('settings.helpFeedbackDescription') ?? 'Ideas, mejoras, bugs o sugerencias.'}
          tone="amber"
        >
          <textarea
            className="min-h-[96px] w-full resize-y rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500"
            placeholder={t('settings.helpFeedbackPlaceholder') ?? 'Cuéntanos qué mejorarías, qué esperabas que pasase y cómo reproducirlo…'}
            value={feedbackText}
            onChange={e => setFeedbackText(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copyFeedback}
              className="inline-flex rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-900"
            >
              {t('settings.helpCopyFeedback') ?? 'Copiar comentario'}
            </button>
            <div className="text-xs text-slate-400">{t('settings.helpFeedbackHint') ?? 'Pega el comentario en el email de soporte o en el formulario de la tienda.'}</div>
          </div>
        </SettingsCard>
      </SettingsGroup>
    </div>
  )
}
