import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { QueryWarmup } from './components/QueryWarmup'
import { SiteBackgroundSync } from './components/SiteBackgroundSync'
import { Home } from './pages/Home'
import { ContestList } from './pages/ContestList'
import { ContestPage } from './pages/ContestPage'
import { SubmitPage } from './pages/SubmitPage'
import { RulesPage } from './pages/RulesPage'
import { GamesPage } from './pages/GamesPage'
import { GamePage } from './pages/GamePage'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminLogin } from './pages/admin/AdminLogin'
import { AdminContests } from './pages/admin/AdminContests'
import { AdminContestEdit } from './pages/admin/AdminContestEdit'
import { AdminGrading } from './pages/admin/AdminGrading'
import { AdminGames } from './pages/admin/AdminGames'
import { AdminGameEdit } from './pages/admin/AdminGameEdit'
import { AuthPage } from './pages/AuthPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { PlayersPage } from './pages/PlayersPage'
import { ProfilePage } from './pages/ProfilePage'
import { ProfileEditPage } from './pages/ProfileEditPage'
import { AdminUsers } from './pages/admin/AdminUsers'
import { AdminUserEdit } from './pages/admin/AdminUserEdit'
import { NotFoundPage } from './pages/NotFoundPage'

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: 'auth', element: <AuthPage /> },
      { path: 'auth/callback', element: <AuthCallbackPage /> },
      { path: 'auth/reset-password', element: <ResetPasswordPage /> },
      { path: 'players', element: <PlayersPage /> },
      { path: 'players/:username', element: <ProfilePage /> },
      { path: 'profile/edit', element: <ProfileEditPage /> },
      { path: 'contests', element: <ContestList /> },
      { path: 'contests/:slug', element: <ContestPage /> },
      { path: 'contests/:slug/submit', element: <SubmitPage /> },
      { path: 'rules', element: <RulesPage /> },
      { path: 'games', element: <GamesPage /> },
      { path: 'games/:slug', element: <GamePage /> },
      { path: '404', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    element: <AdminLayout />,
    children: [
      { index: true, element: <Navigate to="contests" replace /> },
      { path: 'login', element: <AdminLogin /> },
      { path: 'contests', element: <AdminContests /> },
      { path: 'contests/:id', element: <AdminContestEdit /> },
      { path: 'contests/:id/grade', element: <AdminGrading /> },
      { path: 'games', element: <AdminGames /> },
      { path: 'games/:id', element: <AdminGameEdit /> },
      { path: 'users', element: <AdminUsers /> },
      { path: 'users/:id', element: <AdminUserEdit /> },
    ],
  },
  { path: '*', element: <Navigate to="/404" replace /> },
])

export default function App() {
  return (
    <AuthProvider>
      <QueryWarmup />
      <SiteBackgroundSync />
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
