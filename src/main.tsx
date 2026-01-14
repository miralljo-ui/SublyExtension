import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createHashRouter } from 'react-router-dom'
import { routes } from './routes'
import { StoreProvider } from './store'
import { useI18n } from './lib/i18n'
import './styles.css'

const router = createHashRouter(routes)

function LoadingFallback() {
  const { t } = useI18n()
  return <div className="p-4 text-sm">{t('common.loading') ?? 'Loading…'}</div>
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <Suspense fallback={<LoadingFallback />}>
        <RouterProvider router={router} />
      </Suspense>
    </StoreProvider>
  </React.StrictMode>,
)
