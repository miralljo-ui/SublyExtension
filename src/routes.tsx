import type { RouteObject } from 'react-router-dom'
import App from './App'
import { Calendar } from './views/Calendar'
import { Dashboard } from './views/Dashboard'
import { SubscriptionsView } from './views/Subscriptions'
import { Settings } from './views/Settings'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/subscriptions', element: <SubscriptionsView /> },
      { path: '/calendar', element: <Calendar /> },
      { path: '/settings', element: <Settings /> },
    ],
  },
]
