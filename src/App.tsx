import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider } from './auth/AuthContext'
import { Layout } from './components/Layout'
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

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
      <SiteBackgroundSync />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="auth" element={<AuthPage />} />
          <Route path="auth/callback" element={<AuthCallbackPage />} />
          <Route path="auth/reset-password" element={<ResetPasswordPage />} />
          <Route path="players" element={<PlayersPage />} />
          <Route path="players/:username" element={<ProfilePage />} />
          <Route path="profile/edit" element={<ProfileEditPage />} />
          <Route path="contests" element={<ContestList />} />
          <Route path="contests/:slug" element={<ContestPage />} />
          <Route path="contests/:slug/submit" element={<SubmitPage />} />
          <Route path="rules" element={<RulesPage />} />
          <Route path="games" element={<GamesPage />} />
          <Route path="games/:slug" element={<GamePage />} />
          <Route path="404" element={<NotFoundPage />} />
        </Route>
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="contests" replace />} />
          <Route path="login" element={<AdminLogin />} />
          <Route path="contests" element={<AdminContests />} />
          <Route path="contests/:id" element={<AdminContestEdit />} />
          <Route path="contests/:id/grade" element={<AdminGrading />} />
          <Route path="games" element={<AdminGames />} />
          <Route path="games/:id" element={<AdminGameEdit />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="users/:id" element={<AdminUserEdit />} />
        </Route>
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
