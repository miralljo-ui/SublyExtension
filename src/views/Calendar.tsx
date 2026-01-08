export function Calendar() {
  const href = 'https://calendar.google.com/calendar/u/0/r'
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="text-lg font-bold">Google Calendar</div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Se abre en una pestaña por seguridad (Google Calendar no se puede embeber en el panel).
      </p>
      <div className="mt-4">
        <a
          className="inline-flex rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          href={href}
          target="_blank"
          rel="noreferrer"
        >
          Abrir Google Calendar
        </a>
      </div>
    </div>
  )
}
