import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'

type ToastType = 'success' | 'error' | 'info'

type Toast = {
  id: string
  type: ToastType
  message: string
}

type ToastApi = {
  show: (message: string, type?: ToastType, opts?: { durationMs?: number }) => void
  success: (message: string, opts?: { durationMs?: number }) => void
  error: (message: string, opts?: { durationMs?: number }) => void
  info: (message: string, opts?: { durationMs?: number }) => void
}

const ToastContext = createContext<ToastApi | null>(null)

function createToastId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function classForType(type: ToastType) {
  switch (type) {
    case 'success':
      return 'bg-emerald-600/60 text-white'
    case 'error':
      return 'bg-rose-600/60 text-white'
    case 'info':
    default:
      return 'bg-slate-900/60 text-white dark:bg-slate-950/60'
  }
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timeoutsRef = useRef<Record<string, number>>({})

  const remove = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    const timeout = timeoutsRef.current[id]
    if (timeout) {
      window.clearTimeout(timeout)
      delete timeoutsRef.current[id]
    }
  }, [])

  const show = useCallback((message: string, type: ToastType = 'info', opts?: { durationMs?: number }) => {
    const id = createToastId()
    const next: Toast = { id, type, message }

    setToasts(prev => {
      const trimmed = prev.slice(-2)
      return [...trimmed, next]
    })

    const durationMs = opts?.durationMs ?? 3200
    timeoutsRef.current[id] = window.setTimeout(() => remove(id), durationMs)
  }, [remove])

  const api = useMemo<ToastApi>(() => {
    return {
      show,
      success: (m, o) => show(m, 'success', o),
      error: (m, o) => show(m, 'error', o),
      info: (m, o) => show(m, 'info', o),
    }
  }, [show])

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div
        className="pointer-events-none fixed bottom-3 right-3 z-50 flex w-[min(22rem,calc(100vw-1.5rem))] flex-col gap-2"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map(t => (
          <div
            key={t.id}
            className={`pointer-events-auto rounded-lg px-3 py-2 text-sm font-semibold shadow-sm backdrop-blur ${classForType(t.type)}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within ToastProvider')
  return ctx
}
