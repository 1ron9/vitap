import type { ReactNode } from 'react'
import { Outlet } from 'react-router-dom'
import { LayoutDashboard, Lock, MessageSquareText, NotebookPen, ScanLine, UserRound } from 'lucide-react'
import { GATE_COPY, useApp } from '@/app/state'
import type { Route } from '@/app/variants'
import { useDataSafe } from '@/data/db'
import { cn } from '@/lib/cn'
import { Wordmark } from './brand'
import { ThemeToggle } from './ThemeToggle'

const TABS: { route: Route; label: string; icon: typeof LayoutDashboard; gated: boolean }[] = [
  { route: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, gated: true },
  { route: 'journal', label: 'Sổ tay', icon: NotebookPen, gated: true },
  { route: 'scan', label: 'Kiểm tra thuốc', icon: ScanLine, gated: false },
  { route: 'chat', label: 'Trợ lý AI', icon: MessageSquareText, gated: true },
]

/** Header height: 112px on mobile (bar + tab row), 64px on desktop. Sticky children offset from this. */
/** One container for the navbar and page content so the logo lines up with the content's left edge. */
const CONTAINER = 'mx-auto w-full max-w-[1160px] px-6'

export function AppShell({ children, bare }: { children?: ReactNode; bare?: boolean }) {
  const { route, go, isGuest, openAuth } = useApp()
  const isBare = bare ?? (route === 'chat')

  const navigate = (r: Route, gated: boolean) => {
    if (isGuest && gated) {
      openAuth({ variant: 'guestGate', gate: GATE_COPY[r] })
      return
    }
    // Remember where we came from so the home page can send members back to the app.
    if (r === 'onboarding') go('onboarding', 's1', route)
    else go(r)
  }

  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-white focus:shadow-e2"
      >
        Bỏ qua đến nội dung chính
      </a>

      <header className="sticky top-0 z-40 border-b border-line-200 bg-surface/95 backdrop-blur">
        <div className={cn(CONTAINER, 'flex h-14 items-center gap-6 lg:h-16')}>
          <button onClick={() => navigate('onboarding', false)} aria-label="VitaP — về Trang chủ" className="shrink-0 rounded-lg">
            <Wordmark />
          </button>

          <nav aria-label="Điều hướng chính" className="hidden h-full lg:block">
            <ul className="flex h-full items-center gap-1">
              {TABS.map((t) => {
                const active = route === t.route
                const locked = isGuest && t.gated
                return (
                  <li key={t.route} className="relative flex h-full items-center">
                    <button
                      onClick={() => navigate(t.route, t.gated)}
                      aria-current={active ? 'page' : undefined}
                      className={cn(
                        'flex h-10 items-center gap-2 rounded-lg px-3.5 text-[15px] font-medium transition-colors duration-150',
                        active ? 'bg-brand-50 text-brand-ink' : 'text-ink-600 hover:bg-line-100 hover:text-ink-900',
                      )}
                    >
                      <t.icon size={18} aria-hidden />
                      {t.label}
                      {locked && <Lock size={13} className="text-ink-400" aria-label="Cần đăng nhập" />}
                    </button>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <AccountButton />
          </div>
        </div>
      </header>

      {isBare ? (
        children ?? <Outlet />
      ) : (
        <main id="main-content" tabIndex={-1} className={cn(CONTAINER, 'pt-5 pb-20 outline-none lg:pt-8 lg:pb-16')}>
          {children ?? <Outlet />}
        </main>
      )}

      {/* Mobile bottom tab bar */}
      <nav
        aria-label="Điều hướng chính (di động)"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line-200 bg-surface/95 shadow-e2 backdrop-blur lg:hidden"
      >
        <ul className="grid grid-cols-4">
          {TABS.map((t) => {
            const active = route === t.route
            const locked = isGuest && t.gated
            return (
              <li key={t.route}>
                <button
                  onClick={() => navigate(t.route, t.gated)}
                  aria-current={active ? 'page' : undefined}
                  className="flex h-14 w-full items-center justify-center px-1 text-xs font-medium"
                >
                  <span
                    className={cn(
                      'flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 transition-colors duration-150',
                      active ? 'bg-brand-50 text-brand-ink' : 'text-ink-600',
                    )}
                  >
                    <span className="relative">
                      <t.icon size={20} aria-hidden />
                      {locked && (
                        <span className="absolute -right-2 -bottom-1 flex h-4 w-4 items-center justify-center rounded-full border border-line-200 bg-surface">
                          <Lock size={9} strokeWidth={2.2} aria-label="Cần đăng nhập" />
                        </span>
                      )}
                    </span>
                    <span className="whitespace-nowrap">{t.label}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </nav>
    </div>
  )
}

function AccountButton() {
  const { isGuest, openAuth, go, route } = useApp()
  const data = useDataSafe()
  const profile = data?.profile
  if (isGuest)
    return (
      <button
        onClick={() => openAuth({ variant: 'login' })}
        className="ml-1 flex h-10 items-center gap-2 rounded-full border border-line-200 pr-3.5 pl-1 text-sm font-medium text-ink-900 hover:bg-line-100"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-line-100 text-ink-600">
          <UserRound size={16} aria-hidden />
        </span>
        Đăng nhập
      </button>
    )
  const active = route === 'profile'
  const initials = profile?.fullName
    ? profile.fullName.trim().split(/\s+/).map((n) => n[0]).slice(-2).join('').toUpperCase()
    : 'ND'
  return (
    <button
      onClick={() => !active && go('profile', undefined, route)}
      aria-label={`Hồ sơ sức khỏe của ${profile?.fullName || 'bạn'}`}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'ml-1 flex h-10 w-10 items-center justify-center rounded-full ring-offset-2 ring-offset-surface transition-shadow',
        active ? 'ring-2 ring-brand-600' : 'hover:ring-2 hover:ring-line-200',
      )}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-[13px] font-semibold text-white">{initials}</span>
    </button>
  )
}
