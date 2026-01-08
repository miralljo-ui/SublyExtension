import React, { Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider, createHashRouter } from 'react-router-dom'
import { routes } from './routes'
import { StoreProvider } from './store'
import './styles.css'

const router = createHashRouter(routes)

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <StoreProvider>
      <Suspense fallback={<div className="p-4 text-sm">Loading…</div>}>
        <RouterProvider router={router} />
      </Suspense>
    </StoreProvider>
  </React.StrictMode>,
)
