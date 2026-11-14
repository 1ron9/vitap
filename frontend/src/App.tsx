import { useEffect } from 'react'
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { LucideProvider } from 'lucide-react'
import { AppProvider, useApp } from '@/app/state'
import { AppShell } from '@/components/AppShell'
import { DataProvider } from '@/data/db'
import { AuthModal } from '@/screens/AuthModal'
import { Chat } from '@/screens/Chat'
import { Dashboard } from '@/screens/Dashboard'
import { Journal } from '@/screens/Journal'
import { Onboarding } from '@/screens/Onboarding'
import { Profile } from '@/screens/Profile'
import { Scan } from '@/screens/scan/Scan'

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [pathname])
  return null
}

function Screens() {
  return (
    <Routes>
      <Route path="/" element={<Onboarding />} />
      <Route path="/onboarding" element={<Navigate to="/" replace />} />
      <Route element={<AppShell />}>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/journal" element={<Journal />} />
        <Route path="/scan" element={<Scan />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <LucideProvider strokeWidth={1.5} size={20}>
        <AppProvider>
          <DataProvider>
            <Screens />
            <AuthModal />
          </DataProvider>
        </AppProvider>
      </LucideProvider>
    </BrowserRouter>
  )
}
