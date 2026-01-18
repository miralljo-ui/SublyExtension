import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Stepper, { Step } from './Stepper'
import { useStore } from '../store'
import LogoLoop from './ui/LogoLoop'
import { useI18n } from '../lib/i18n'
import TextType from './ui/TextType'
import { formatCurrency } from '../lib/money'
import { SimpleLineChart, SimplePieChart } from './SimpleCharts'
import type { Period } from '../lib/types'

export function OnboardingStepper() {
  const { state, setSettings, ready } = useStore()
  const navigate = useNavigate()
  const { t } = useI18n()

  const [previewChartIndex, setPreviewChartIndex] = useState(0)
  const [previewPaused, setPreviewPaused] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined') return
    const prefersReduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
    if (prefersReduced) return
    if (previewPaused) return

    const id = window.setInterval(() => {
      setPreviewChartIndex((v) => (v + 1) % 2)
    }, 3500)

    return () => window.clearInterval(id)
  }, [previewPaused])

  const isOpen = ready && state.settings.onboardingCompleted !== true

  const modalDescription = t('onboarding.modalDescription') ?? 'Configura lo básico en 1 minuto y empieza a registrar tus suscripciones.'

  const welcomeLines = useMemo(() => {
    const raw = [
      t('onboarding.welcomeType1'),
      t('onboarding.welcomeType2'),
      t('onboarding.welcomeType3'),
    ]
      .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
      .map(v => v.trim())

    const lines = raw.length
      ? raw
      : ['Bienvenido a Subly', 'Tu centro de suscripciones', 'Todo a un vistazo']

    const seen = new Set<string>()
    const deduped: string[] = []
    for (const line of lines) {
      const key = line.toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      deduped.push(line)
    }

    return deduped
  }, [t])

  const subscriptionExamples = useMemo(
    () =>
      [
        { src: '/logos/netflix.svg', label: 'Netflix' },
        { src: '/logos/spotify.svg', label: 'Spotify' },
        { src: '/logos/youtube-premium.svg', label: 'YouTube Premium' },
        { src: '/logos/disney-plus.svg', label: 'Disney+', scale: 1.0 },
        { src: '/logos/amazon-prime-video.png', label: 'Prime Video', scale: 0.9 },
        { src: '/logos/apple-music.png', label: 'Apple Music', scale: 1.36 },
        { src: '/logos/apple-tv-plus.svg', label: 'Apple TV+' },
        { src: '/logos/icloud.svg', label: 'iCloud+' },
        { src: '/logos/google-one.png', label: 'Google One'},
        { src: '/logos/dropbox.svg', label: 'Dropbox' },
        { src: '/logos/max.svg', label: 'Max' , scale: 1.05},
        { src: '/logos/crunchyroll.svg', label: 'Crunchyroll' },
        { src: '/logos/microsoft-365.svg', label: 'Microsoft 365' },
        { src: '/logos/xbox-game-pass.svg', label: 'Xbox Game Pass', scale: 1.0 },
        { src: '/logos/playstation-plus.svg', label: 'PlayStation Plus' },
        { src: '/logos/nintendo-switch-online.svg', label: 'Nintendo Switch Online', scale: 1.04 },
        { src: '/logos/chatgpt.svg', label: 'ChatGPT' },
        { src: '/logos/claude.svg', label: 'Claude' },
        { src: '/logos/perplexity.svg', label: 'Perplexity' },
        { src: '/logos/microsoft-copilot.svg', label: 'Microsoft Copilot' },
        { src: '/logos/google-gemini.svg', label: 'Google Gemini' },
        { src: '/logos/canva.png', label: 'Canva' },
        { src: '/logos/tidal.png', label: 'TIDAL' },
      ].map(({ src, label, scale }) => ({
        src,
        alt: label,
        title: label,
        scale,
      })),
    [],
  )

  const complete = () => {
    setSettings({ ...state.settings, onboardingCompleted: true })
  }

  const [exampleName, setExampleName] = useState('Netflix')
  const [examplePrice, setExamplePrice] = useState('12.99')
  const [examplePeriod, setExamplePeriod] = useState<Period>('monthly')
  const [exampleStartDate, setExampleStartDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [exampleCreated, setExampleCreated] = useState(false)

  const canCreateExample = useMemo(() => {
    const name = exampleName.trim()
    const price = Number(examplePrice)
    if (!name) return false
    if (!Number.isFinite(price) || price <= 0) return false
    if (!examplePeriod) return false
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(exampleStartDate || '').trim())) return false
    return true
  }, [exampleName, examplePeriod, examplePrice, exampleStartDate])

  const simulateExample = () => {
    if (!canCreateExample) return
    setExampleCreated(true)
  }

  const previewExample = useMemo(() => {
    const currency = (state.settings.baseCurrency || 'USD').toUpperCase()

    return {
      currency,
      trend: {
        labels: ['Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul'],
        values: [12.99, 14.49, 13.75, 16.2, 15.6, 18.1],
      },
      categories: [
        { label: 'Streaming', value: 38, className: 'text-violet-500' },
        { label: 'Productividad', value: 26, className: 'text-sky-500' },
        { label: 'Música', value: 18, className: 'text-rose-500' },
        { label: 'Gaming', value: 12, className: 'text-emerald-500' },
      ],
    }
  }, [state.settings.baseCurrency])

  if (!isOpen) return null

  return (
    <Stepper
      useModalLayout
      isOpen={isOpen}
      onRequestClose={complete}
      modalTitle={t('onboarding.title') ?? 'Bienvenido a Subly'}
      modalDescription={modalDescription}
      backButtonText={t('onboarding.back') ?? 'Atrás'}
      nextButtonText={t('onboarding.next') ?? 'Continuar'}
      onFinalStepCompleted={complete}
      initialStep={1}
      disableStepIndicators={false}
      className="text-slate-900 dark:text-white"
      stepCircleContainerClassName="bg-white/95 dark:bg-slate-950/95 border border-slate-200 dark:border-slate-800"
    >
      <Step>
        <div className="space-y-3">
          <TextType
            as="div"
            text={welcomeLines}
            typingSpeed={36}
            deletingSpeed={20}
            pauseDuration={1600}
            initialDelay={250}
            loop
            showCursor
            hideCursorWhileTyping
            cursorCharacter="|"
            cursorBlinkDuration={0.55}
            textColors={['#A78BFA', '#FB7185', '#38BDF8']}
            className="text-base font-semibold tracking-tight"
          />

          <p className="text-sm text-slate-700 dark:text-slate-200">
            {t('onboarding.step1Body') ??
              'Visualiza gastos y renovaciones de un vistazo.'}
          </p>
          <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200">
            <span className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18h6" />
                <path d="M10 22h4" />
                <path d="M12 2a7 7 0 0 0-4 12c.7.6 1 1.1 1 2v1h6v-1c0-.9.3-1.4 1-2a7 7 0 0 0-4-12Z" />
              </svg>
            </span>
            <span>
              <span className="sr-only">Consejo: </span>
              {t('onboarding.step1Tip') ?? 'Consejo: puedes cerrar este asistente (×) y volver luego desde Ajustes.'}
            </span>
          </div>
        </div>
      </Step>

      <Step>
        <div className="space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            {t('onboarding.step2Body') ??
              'Reúne todas tus suscripciones en un solo lugar: añade servicios, edítalos y controla sus renovaciones.'}
          </p>

          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="mt-2">
              <LogoLoop
                logos={subscriptionExamples}
                speed={80}
                direction="left"
                gap={36}
                logoHeight={44}
                pauseOnHover
                fadeOut
                fadeOutColor="rgba(2, 6, 23, 0)"
                scaleOnHover
                ariaLabel={t('onboarding.step2ExamplesAria') ?? 'Ejemplos de suscripciones'}
              />
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
              {t('onboarding.step2MiniFormTitle') ?? 'Ejemplo rápido'}
            </div>

            <form
              className="mt-2 grid grid-cols-1 gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                simulateExample()
              }}
            >
              <label className="grid gap-1">
                <span className="text-[11px] text-slate-600 dark:text-slate-300">
                  {t('onboarding.step2MiniFormNameLabel') ?? 'Nombre'}
                </span>
                <input
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-violet-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  value={exampleName}
                  onChange={(e) => {
                    setExampleName(e.target.value)
                    setExampleCreated(false)
                  }}
                  placeholder="Netflix"
                />
              </label>

              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-1">
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">
                    {t('onboarding.step2MiniFormPriceLabel') ?? 'Precio'}
                  </span>
                  <div className="relative">
                    <input
                      inputMode="decimal"
                      className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 pr-12 text-sm text-slate-900 outline-none focus:border-violet-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                      value={examplePrice}
                      onChange={(e) => {
                        setExamplePrice(e.target.value)
                        setExampleCreated(false)
                      }}
                      placeholder="12.99"
                    />
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-slate-500 dark:text-slate-400">
                      {(state.settings.baseCurrency || 'USD').toUpperCase()}
                    </span>
                  </div>
                </label>

                <label className="grid gap-1">
                  <span className="text-[11px] text-slate-600 dark:text-slate-300">
                    {t('onboarding.step2MiniFormPeriodLabel') ?? 'Periodicidad'}
                  </span>
                  <select
                    className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-violet-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                    value={examplePeriod}
                    onChange={(e) => {
                      setExamplePeriod(e.target.value as Period)
                      setExampleCreated(false)
                    }}
                  >
                    <option value="monthly">{t('onboarding.step2MiniFormPeriodMonthly') ?? 'Mensual'}</option>
                    <option value="annual">{t('onboarding.step2MiniFormPeriodAnnual') ?? 'Anual'}</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-1">
                <span className="text-[11px] text-slate-600 dark:text-slate-300">
                  {t('onboarding.step2MiniFormStartDateLabel') ?? 'Fecha de inicio'}
                </span>
                <input
                  type="date"
                  className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-sm text-slate-900 outline-none focus:border-violet-400 dark:border-slate-800 dark:bg-slate-950 dark:text-white"
                  value={exampleStartDate}
                  onChange={(e) => {
                    setExampleStartDate(e.target.value)
                    setExampleCreated(false)
                  }}
                />
              </label>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={!canCreateExample}
                  className={
                    'rounded-md px-3 py-2 text-sm font-semibold text-white ' +
                    (canCreateExample
                      ? 'bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200'
                      : 'cursor-not-allowed bg-slate-400 dark:bg-slate-800 dark:text-slate-400')
                  }
                >
                  {t('onboarding.step2MiniFormSubmit') ?? 'Previsualizar'}
                </button>
              </div>
            </form>
          </div>

          <div className="flex items-start gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200">
            <span className="mt-0.5 shrink-0 text-amber-500 dark:text-amber-400" aria-hidden="true">
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 18h6" />
                <path d="M10 22h4" />
                <path d="M12 2a7 7 0 0 0-4 12c.7.6 1 1.1 1 2v1h6v-1c0-.9.3-1.4 1-2a7 7 0 0 0-4-12Z" />
              </svg>
            </span>
            <span>
              <span className="sr-only">Consejo: </span>
              {exampleCreated
                ? (t('onboarding.step2MiniFormCreated') ?? 'Listo. Así quedaría al guardarla (previsualización).')
                : (t('onboarding.step2MiniFormHelp') ?? 'Previsualización: no se guardará nada.')}
            </span>
          </div>
        </div>
      </Step>

      <Step>
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">
              {t('onboarding.calendarPortabilityTitle') ?? 'Eventos en tu Google Calendar'}
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200">
              {t('onboarding.calendarPortabilityBody') ??
                'Al sincronizar, Subly crea eventos recurrentes en tu cuenta de Google Calendar. Así los verás también en móvil, tablet y otros dispositivos con la misma cuenta.'}
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
            <ul className="space-y-1 text-xs text-slate-700 dark:text-slate-300">
              <li>• {t('onboarding.calendarPortabilityBullet1') ?? 'Los eventos quedan en tu calendario, no en servidores del desarrollador.'}</li>
              <li>• {t('onboarding.calendarPortabilityBullet2') ?? 'Puedes activar/desactivar la sincronización cuando quieras desde Ajustes.'}</li>
              <li>• {t('onboarding.calendarPortabilityBullet3') ?? 'Si eliminas la sincronización, Subly puede borrar sus eventos asociados.'}</li>
            </ul>
          </div>
        </div>
      </Step>

      <Step>
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">{t('onboarding.previewTitle') ?? 'Vista previa'}</div>
            <p className="text-xs text-slate-600 dark:text-slate-300">{t('onboarding.previewBody') ?? 'Ejemplo de gráficos del Resumen (datos de muestra).'}</p>
          </div>

          <div
            className="rounded-lg border border-slate-200 bg-white/70 p-3 outline-none dark:border-slate-800 dark:bg-slate-900/40"
            tabIndex={0}
            onMouseEnter={() => setPreviewPaused(true)}
            onMouseLeave={() => setPreviewPaused(false)}
            onFocus={() => setPreviewPaused(true)}
            onBlur={() => setPreviewPaused(false)}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                {previewChartIndex === 0
                  ? (t('onboarding.previewChartTrendTitle') ?? 'Evolución mensual')
                  : (t('onboarding.previewChartCategoriesTitle') ?? 'Por categoría')}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-[10px] text-slate-500 dark:text-slate-400">{t('onboarding.previewExampleLabel') ?? 'Ejemplo'}</div>
                <div className="flex items-center gap-1" aria-hidden="true">
                  {[0, 1].map((i) => (
                    <span
                      key={i}
                      className={
                        i === previewChartIndex
                          ? 'h-1.5 w-4 rounded-full bg-violet-500'
                          : 'h-1.5 w-1.5 rounded-full bg-slate-300 dark:bg-slate-700'
                      }
                    />
                  ))}
                </div>
              </div>
            </div>

            {previewChartIndex === 0 ? (
              <SimpleLineChart
                labels={previewExample.trend.labels}
                values={previewExample.trend.values}
                height={210}
                formatValue={(v) => formatCurrency(v, previewExample.currency)}
                ariaLabel="Gasto mensual (ejemplo)"
              />
            ) : (
              <SimplePieChart
                segments={previewExample.categories}
                formatValue={(v) => formatCurrency(v, previewExample.currency)}
                size={260}
                ariaLabel="Distribución por categoría (ejemplo)"
              />
            )}
          </div>
        </div>
      </Step>

      <Step>
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="text-sm font-semibold text-slate-900 dark:text-white">{t('onboarding.integrationsTitle') ?? 'Integraciones con Google'}</div>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              {t('onboarding.integrationsBody') ?? 'Actívalas cuando quieras desde Ajustes. Se pedirá permiso OAuth al usar cada acción.'}
            </p>
          </div>

          <div className="grid gap-2">
            <div className="rounded-lg border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <span className="text-sky-500" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="18" rx="2" />
                    <path d="M16 2v4" />
                    <path d="M8 2v4" />
                    <path d="M3 10h18" />
                  </svg>
                </span>
                {t('onboarding.integrationsCalendarTitle') ?? 'Google Calendar'}
              </div>
              <ul className="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-300">
                <li>• {t('onboarding.integrationsCalendar1') ?? 'Crear/actualizar eventos recurrentes (todo el día) por suscripción.'}</li>
                <li>• {t('onboarding.integrationsCalendar2') ?? 'Opcional: calendario dedicado “Subly Subscriptions”.'}</li>
                <li>• {t('onboarding.integrationsCalendar3') ?? 'Recordatorios: notificación o email (por defecto o por suscripción).'}</li>
              </ul>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white/70 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800 dark:text-slate-200">
                <span className="text-emerald-500" aria-hidden="true">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 16.5a4.5 4.5 0 0 0-3.5-4.4A6 6 0 1 0 6 16" />
                    <path d="M12 12v9" />
                    <path d="m8 17 4-4 4 4" />
                  </svg>
                </span>
                {t('onboarding.integrationsDriveTitle') ?? 'Google Drive'}
              </div>
              <ul className="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-300">
                <li>• {t('onboarding.integrationsDrive1') ?? 'Guardar un backup JSON en appDataFolder (carpeta oculta).'}</li>
                <li>• {t('onboarding.integrationsDrive2') ?? 'Restaurar una copia anterior cuando lo necesites.'}</li>
                <li>• {t('onboarding.integrationsDrive3') ?? 'No se guarda en servidores del desarrollador.'}</li>
              </ul>
            </div>
          </div>

          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            onClick={() => navigate('/settings')}
          >
            {t('onboarding.goSettings') ?? 'Ir a Ajustes'}
          </button>
        </div>
      </Step>
    </Stepper>
  )
}
