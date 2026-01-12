import { useStore } from '../store'

export function Settings() {
  const { state, setSettings } = useStore()

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

  const calendarHref = 'https://calendar.google.com/calendar/u/0/r'

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">Alertas</div>
        <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={state.settings.notificationsEnabled}
              onChange={e => toggleNotifications(e.target.checked)}
              className="h-4 w-4"
            />
            Activar notificaciones
          </label>

          <label className="text-sm">
            <div className="mb-1 font-semibold">Avisar (días antes)</div>
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
          Las alertas se muestran como notificaciones del navegador.
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="text-lg font-bold">Google Calendar</div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Se abre en una pestaña por seguridad (Google Calendar no se puede embeber en el panel).
        </p>
        <div className="mt-4">
          <a
            className="inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
            href={calendarHref}
            target="_blank"
            rel="noreferrer"
          >
            Abrir Google Calendar
          </a>
        </div>
      </div>
    </div>
  )
}
