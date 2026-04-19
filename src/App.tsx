import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { Home } from './pages/Home'
import { ContestList } from './pages/ContestList'
import { ContestPage } from './pages/ContestPage'
import { SubmitPage } from './pages/SubmitPage'
import { AdminLayout } from './pages/admin/AdminLayout'
import { AdminLogin } from './pages/admin/AdminLogin'
import { AdminContests } from './pages/admin/AdminContests'
import { AdminContestEdit } from './pages/admin/AdminContestEdit'
import { AdminGrading } from './pages/admin/AdminGrading'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="contests" element={<ContestList />} />
          <Route path="contests/:slug" element={<ContestPage />} />
          <Route path="contests/:slug/submit" element={<SubmitPage />} />
        </Route>
        <Route path="admin" element={<AdminLayout />}>
          <Route index element={<Navigate to="contests" replace />} />
          <Route path="login" element={<AdminLogin />} />
          <Route path="contests" element={<AdminContests />} />
          <Route path="contests/:id" element={<AdminContestEdit />} />
          <Route path="contests/:id/grade" element={<AdminGrading />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
