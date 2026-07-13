import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { KonamiCodeListener } from './components/KonamiCodeListener'
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
import { TracksPage } from './pages/TracksPage'
import { AdminLayout } from './pages/admin/AdminLayout'
import {
  AdminContestEdit,
  AdminContests,
  AdminGameEdit,
  AdminGames,
  AdminGrading,
  AdminLogin,
  AdminUserEdit,
  AdminUsers,
} from './pages/admin/lazyAdminPages'
import { AuthPage } from './pages/AuthPage'
import { AuthCallbackPage } from './pages/AuthCallbackPage'
import { ResetPasswordPage } from './pages/ResetPasswordPage'
import { PlayersPage } from './pages/PlayersPage'
import { ProfilePage } from './pages/ProfilePage'
import { ProfileEditPage } from './pages/ProfileEditPage'
import { RpgShopPage } from './pages/RpgShopPage'
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
      { path: 'shop', element: <RpgShopPage /> },
      { path: 'contests', element: <ContestList /> },
      { path: 'contests/:slug', element: <ContestPage /> },
      { path: 'contests/:slug/submit', element: <SubmitPage /> },
      { path: 'rules', element: <RulesPage /> },
      { path: 'games', element: <GamesPage /> },
      { path: 'games/:slug', element: <GamePage /> },
      { path: 'tracks', element: <TracksPage /> },
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
      <KonamiCodeListener />
      <QueryWarmup />
      <SiteBackgroundSync />
      <RouterProvider router={router} />
    </AuthProvider>
  )
}
