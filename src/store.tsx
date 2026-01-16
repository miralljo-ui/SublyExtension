import React, { createContext, useContext, useEffect, useMemo, useState } from 'react'
import type { AppSettings, AppState, Subscription } from './lib/types'
import { DEFAULT_SETTINGS, loadState, saveState } from './lib/storage'

type Store = {
  state: AppState
  setSubscriptions: (subs: Subscription[]) => void
  setSettings: (settings: AppSettings) => void
  ready: boolean
}

const StoreContext = createContext<Store | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>({ subscriptions: [], settings: DEFAULT_SETTINGS })
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const s = await loadState()
      if (!mounted) return
      setState(s)
      setReady(true)
    })()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (!ready) return
    void saveState(state)
  }, [ready, state])

  const value = useMemo<Store>(() => ({
    state,
    setSubscriptions: (subs) => setState(prev => ({ ...prev, subscriptions: subs })),
    setSettings: (settings) => setState(prev => ({ ...prev, settings })),
    ready,
  }), [ready, state])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within StoreProvider')
  return ctx
}
