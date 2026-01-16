import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Stepper, { Step } from './Stepper'
import { useStore } from '../store'
import LogoLoop from './ui/LogoLoop'

export function OnboardingStepper() {
  const { state, setSettings, ready } = useStore()
  const navigate = useNavigate()

  const isOpen = ready && state.settings.onboardingCompleted !== true

  const modalDescription = useMemo(() => {
    return 'Configura lo básico en 1 minuto y empieza a registrar tus suscripciones.'
  }, [])

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

  if (!isOpen) return null

  return (
    <Stepper
      useModalLayout
      isOpen={isOpen}
      onRequestClose={complete}
      onFinalStepCompleted={complete}
      initialStep={1}
      modalTitle="Bienvenido a Subly"
      modalDescription={modalDescription}
      backButtonText="Atrás"
      nextButtonText="Continuar"
      disableStepIndicators={false}
      className="text-slate-900 dark:text-white"
      stepCircleContainerClassName="bg-white/95 dark:bg-slate-950/95 border border-slate-200 dark:border-slate-800"
    >
      <Step>
        <div className="space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Subly te ayuda a visualizar gastos, próximas renovaciones y sincronizar recordatorios con Google Calendar.
          </p>
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900/40 dark:text-slate-200">
            Tip: puedes cerrar este asistente (×) y volver luego desde Ajustes.
          </div>
        </div>
      </Step>

      <Step>
        <div className="space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-200">Primero, añade tus suscripciones para que el dashboard tenga datos.</p>

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
                ariaLabel="Ejemplos de suscripciones"
              />
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              onClick={() => navigate('/subscriptions')}
            >
              Ir a Suscripciones
            </button>
            <button
              type="button"
              className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:text-slate-200 dark:hover:bg-slate-900"
              onClick={() => navigate('/dashboard')}
            >
              Ver dashboard
            </button>
          </div>
        </div>
      </Step>

      <Step>
        <div className="space-y-3">
          <p className="text-sm text-slate-700 dark:text-slate-200">
            Luego puedes configurar moneda base, idioma e integraciones (Calendar / Drive).
          </p>
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
            onClick={() => navigate('/settings')}
          >
            Ir a Ajustes
          </button>
        </div>
      </Step>
    </Stepper>
  )
}
