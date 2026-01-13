import { NavLink, Outlet } from 'react-router-dom'
import FaultyTerminal from './components/FaultyTerminal'

function Tab({ to, label }: { to: string; label: string }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `rounded-md px-3 py-2 text-sm font-semibold ${isActive ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-200 dark:text-slate-200 dark:hover:bg-slate-800'}`
      }
    >
      {label}
    </NavLink>
  )
}

export default function App() {
  return (
    <div className="relative min-h-screen text-slate-900 dark:text-white">
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
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
          <div className="mx-auto flex max-w-3xl items-center justify-between gap-3 px-4 py-3">
            <div className="text-sm font-black tracking-wide">Subly</div>
            <nav className="flex items-center gap-2">
              <Tab to="/dashboard" label="Dashboard" />
              <Tab to="/subscriptions" label="Suscripciones" />
              <Tab to="/settings" label="Ajustes" />
            </nav>
          </div>
        </header>

        <main className="mx-auto max-w-3xl px-4 py-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
