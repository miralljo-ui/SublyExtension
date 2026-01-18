import { Outlet, useLocation } from 'react-router-dom'
import FaultyTerminal from './components/FaultyTerminal'
import { OnboardingStepper } from './components/OnboardingStepper'
import PillNav from './components/PillNav'
import { useI18n } from './lib/i18n'

export default function App() {
  const { t } = useI18n()
  const location = useLocation()

  const activeHref = location.pathname === '/' ? '/dashboard' : location.pathname
  const logoUrl = '/logo-source.png'

  const items = [
    { label: t('nav.dashboard') ?? 'Dashboard', href: '/dashboard' },
    { label: t('nav.subscriptions') ?? 'Suscripciones', href: '/subscriptions' },
    { label: t('nav.calendar') ?? 'Calendario', href: '/calendar' },
    { label: t('nav.settings') ?? 'Ajustes', href: '/settings' },
  ]

  return (
    <div className="relative min-h-screen text-slate-900 dark:text-white">
      <OnboardingStepper />
      <div className="pointer-events-none absolute inset-0 -z-10">
        <FaultyTerminal
          className="h-full w-full"
          scale={1.0}
          gridMul={[3, 2]}
          digitSize={1.5}
          brightness={1.8}
          scanlineIntensity={0.45}
          noiseAmp={1.0}
          clearColor="#000000"
          baseColor="#020617"
        />
      </div>

      <div className="min-h-screen bg-slate-50/65 dark:bg-slate-950/65">
        <header className="sticky top-0 z-10 bg-transparent">
          <PillNav
            logo={logoUrl}
            logoAlt="Subly"
            items={items}
            activeHref={activeHref}
            baseColor="#e2e8f0"
            pillColor="#5227ff"
            hoveredPillTextColor="#e2e8f0"
            pillTextColor="#e2e8f0"
          />
        </header>

        <main className="mx-auto max-w-3xl px-4 py-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
