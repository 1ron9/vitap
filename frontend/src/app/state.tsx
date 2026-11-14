import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { CircleAlert, CircleCheck } from 'lucide-react'
import type { AuthVariant, Route } from './variants'
import { getCredentials, mockMode } from '@/shared/api'
import { authApi } from '@/api/client'

export type AuthRequest = { variant?: AuthVariant; gate?: string }
type Toast = { id: number; msg: string; tone: 'success' | 'error' }

type Ctx = {
  route: Route
  go: (r: Route, variant?: string, from?: Route) => void
  /** where an in-app link came from, so the destination can offer "Quay lại" */
  origin: Route | null
  theme: 'light' | 'dark'
  toggleTheme: () => void
  isGuest: boolean
  setGuest: (g: boolean) => void
  auth: AuthRequest | null
  openAuth: (r?: AuthRequest) => void
  closeAuth: () => void
  variant: (r: Route) => string
  setVariant: (r: Route, v: string) => void
  toast: (msg: string, tone?: Toast['tone']) => void
  /** bumps whenever the demo panel forces a state, so screens can remount */
  stamp: number
}

const AppCtx = createContext<Ctx | null>(null)

export const GATE_COPY: Partial<Record<Route, string>> = {
  dashboard: 'Đăng ký để theo dõi sức khỏe của bạn',
  journal: 'Đăng ký để lưu ghi chép sức khỏe và xem lại bất cứ lúc nào',
  chat: 'Đăng ký để trò chuyện với trợ lý AI về đơn thuốc của bạn',
  profile: 'Đăng ký để khai báo bệnh nền và dị ứng',
  scan: 'Đăng ký để lưu đơn thuốc này vào lịch sử của bạn',
}

export function pathToRoute(pathname: string): Route {
  if (pathname.startsWith('/dashboard')) return 'dashboard'
  if (pathname.startsWith('/journal')) return 'journal'
  if (pathname.startsWith('/scan')) return 'scan'
  if (pathname.startsWith('/chat')) return 'chat'
  if (pathname.startsWith('/profile')) return 'profile'
  return 'onboarding'
}

export function routeToPath(route: Route): string {
  switch (route) {
    case 'dashboard':
      return '/dashboard'
    case 'journal':
      return '/journal'
    case 'scan':
      return '/scan'
    case 'chat':
      return '/chat'
    case 'profile':
      return '/profile'
    case 'onboarding':
    default:
      return '/'
  }
}

export function AppProvider({ children, initialGuest }: { children: ReactNode; initialGuest?: boolean }) {
  const location = useLocation()
  const navigate = useNavigate()
  const params = new URLSearchParams(location.search)
  const qScreen = params.get('screen') as Route | null

  const route = useMemo<Route>(() => {
    return pathToRoute(location.pathname)
  }, [location.pathname])

  const [isGuest, setGuest] = useState<boolean>(() => {
    if (initialGuest !== undefined) return initialGuest
    // In dev and test environments, allow query param overrides for test harnesses
    if (!import.meta.env.PROD) {
      const qRole = params.get('role')
      if (qRole === 'guest') return true
      if (qRole === 'member') return false
    }
    if (typeof window === 'undefined') return true
    if (mockMode) {
      return !localStorage.getItem('vitap-user-email')
    }
    return !getCredentials().access
  })

  // In real backend mode, attempt startup session refresh if refresh token is present
  useEffect(() => {
    if (typeof window === 'undefined' || mockMode) return
    const refreshToken = localStorage.getItem('vitap-refresh-token')
    if (!getCredentials().access && refreshToken) {
      authApi
        .refresh(refreshToken)
        .then(() => {
          setGuest(false)
        })
        .catch((err) => {
          console.warn('[VitaP Auth] Session refresh failed, clearing session:', err)
          localStorage.removeItem('vitap-refresh-token')
          localStorage.removeItem('vitap-user-email')
          setGuest(true)
        })
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const onAuthChange = () => {
      const email = localStorage.getItem('vitap-user-email')
      if (mockMode) {
        setGuest(!email)
      } else {
        setGuest(!getCredentials().access)
      }
    }
    window.addEventListener('vitap-auth-change', onAuthChange)
    return () => window.removeEventListener('vitap-auth-change', onAuthChange)
  }, [])
  const [auth, setAuth] = useState<AuthRequest | null>(() => (params.get('auth') ? { variant: params.get('auth') as AuthVariant } : null))
  const [variants, setVariants] = useState<Record<string, string>>({})
  const [stamp, setStamp] = useState(0)
  const [originState, setOriginState] = useState<Route | null>(null)
  const origin = (location.state as { from?: Route } | null)?.from ?? originState

  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const q = params.get('theme')
    if (q === 'dark' || q === 'light') return q
    if (typeof window === 'undefined') return 'light'
    const saved = localStorage.getItem('vitap-theme')
    if (saved === 'dark' || saved === 'light') return saved
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  useEffect(() => {
    if (typeof window === 'undefined') return
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const n = t === 'dark' ? 'light' : 'dark'
      if (typeof window !== 'undefined') {
        localStorage.setItem('vitap-theme', n)
      }
      return n
    })
  }, [])
  const [toasts, setToasts] = useState<Toast[]>([])

  const go = useCallback(
    (r: Route, v?: string, from?: Route) => {
      setOriginState(from ?? null)
      if (v) {
        setVariants((s) => ({ ...s, [r]: v }))
        setStamp((n) => n + 1)
      }
      const targetPath = routeToPath(r)
      navigate(targetPath, { state: { from, target: v } })
      window.scrollTo({ top: 0 })
    },
    [navigate],
  )

  const toast = useCallback((msg: string, tone: Toast['tone'] = 'success') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, tone }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  const value = useMemo<Ctx>(
    () => ({
      route,
      go,
      origin,
      theme,
      toggleTheme,
      isGuest,
      setGuest,
      auth,
      openAuth: (r = {}) => setAuth({ variant: 'login', ...r }),
      closeAuth: () => setAuth(null),
      variant: (r) => variants[r],
      setVariant: (r, v) => {
        setVariants((s) => ({ ...s, [r]: v }))
        setStamp((n) => n + 1)
      },
      toast,
      stamp,
    }),
    [route, go, origin, theme, toggleTheme, isGuest, auth, variants, toast, stamp],
  )

  return (
    <AppCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-8">
        {toasts.map((t) => (
          <ToastView key={t.id} {...t} />
        ))}
      </div>
    </AppCtx.Provider>
  )
}

function ToastView({ msg, tone }: Toast) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(r)
  }, [])
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-center gap-2.5 rounded-xl bg-night px-4 py-3 text-sm font-medium text-white shadow-e2 transition-all duration-200 ${shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}
    >
      {tone === 'success' ? (
        <CircleCheck size={18} className="text-[#9cc0ff]" aria-hidden />
      ) : (
        <CircleAlert size={18} className="text-[#ffb4ab]" aria-hidden />
      )}
      {msg}
    </div>
  )
}

export function useApp() {
  const c = useContext(AppCtx)
  if (!c) throw new Error('useApp outside provider')
  return c
}
