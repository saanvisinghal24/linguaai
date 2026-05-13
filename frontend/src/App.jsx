import { Routes, Route, Navigate } from 'react-router-dom'
import useAuthStore from './store/authStore'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import GrammarPage from './pages/GrammarPage'
import WritingPage from './pages/WritingPage'
import SpeakingPage from './pages/SpeakingPage'
import FlashcardsPage from './pages/FlashcardsPage'
import ListeningPage from './pages/ListeningPage'
import SettingsPage from './pages/SettingsPage'
import StudyPlanPage from './pages/StudyPlanPage'

function ProtectedRoute({ children }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  return isAuthenticated ? children : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={
        <ProtectedRoute>
          <Layout />
        </ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="speaking" element={<SpeakingPage />} />
        <Route path="writing" element={<WritingPage />} />
        <Route path="grammar" element={<GrammarPage />} />
        <Route path="flashcards" element={<FlashcardsPage />} />
        <Route path="listening" element={<ListeningPage />} />
        <Route path="study-plan" element={<StudyPlanPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  )
}