import type { RouteObject } from 'react-router-dom'
import App from './App'
import { Dashboard } from './views/Dashboard'
import { SubscriptionsView } from './views/Subscriptions'
import { Calendar } from './views/Calendar'

export const routes: RouteObject[] = [
  {
    path: '/',
    element: <App />,
    children: [
      { path: '/', element: <Dashboard /> },
      { path: '/dashboard', element: <Dashboard /> },
      { path: '/subscriptions', element: <SubscriptionsView /> },
      { path: '/calendar', element: <Calendar /> },
    ],
  },
]
