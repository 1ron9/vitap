import type { ReactNode } from 'react'
import { Lock } from 'lucide-react'
import { useApp } from '@/app/state'
import { Button } from './ui'

/** Blurred sample content behind a brand-50 invitation card. Never styled as an error. */
export function GuestLock({ title, body, cta = 'Đăng ký / Đăng nhập', gate, children }: { title: string; body: string; cta?: string; gate: string; children: ReactNode }) {
  const { openAuth } = useApp()
  return (
    <div className="relative">
      <div className="pointer-events-none select-none blur-[6px] opacity-60" aria-hidden inert>
        {children}
      </div>
      <div className="absolute inset-0 flex items-start justify-center px-4 pt-16 sm:items-center sm:pt-0">
        <div className="w-full max-w-md rounded-2xl border border-brand-100 bg-brand-50 p-6 text-center shadow-e2 sm:p-8">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-brand-fg">
            <Lock size={22} aria-hidden />
          </div>
          <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
          <p className="mt-1.5 text-sm text-ink-600">{body}</p>
          <Button className="mt-5" onClick={() => openAuth({ variant: 'guestGate', gate })}>
            {cta}
          </Button>
        </div>
      </div>
    </div>
  )
}
