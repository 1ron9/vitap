import { useId } from 'react'
import { cn } from '@/lib/cn'

/**
 * VitaP mark: a heartbeat trace. The flat baseline fades out on both sides;
 * only the pulse — a bold "V" — is solid, ending in a dot like the original mark.
 */
export function Mark({ size = 28, className, plain }: { size?: number; className?: string; plain?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const fg = plain ? 'var(--color-brand-fg)' : '#fff'
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={className} aria-hidden>
      <defs>
        {/* userSpaceOnUse: a horizontal line has a zero-height bbox, which breaks objectBoundingBox gradients */}
        <linearGradient id={`l${id}`} gradientUnits="userSpaceOnUse" x1="1" x2="9.4" y1="0" y2="0">
          <stop offset="0" stopColor={fg} stopOpacity="0" />
          <stop offset="1" stopColor={fg} stopOpacity="0.85" />
        </linearGradient>
        <linearGradient id={`r${id}`} gradientUnits="userSpaceOnUse" x1="25" x2="31" y1="0" y2="0">
          <stop offset="0" stopColor={fg} stopOpacity="0.8" />
          <stop offset="1" stopColor={fg} stopOpacity="0" />
        </linearGradient>
      </defs>
      {!plain && <rect width="32" height="32" rx="9" fill="#2457C5" />}
      {/* faded baseline, flush with the top of the pulse */}
      <path d="M1.5 12.4 H9.2" stroke={`url(#l${id})`} strokeWidth="1.7" strokeLinecap="round" fill="none" />
      <path d="M25.6 12.4 H30.5" stroke={`url(#r${id})`} strokeWidth="1.7" strokeLinecap="round" fill="none" />
      {/* the pulse: bold V */}
      <path d="M9.4 12.4 L15.1 23.6 a1 1 0 0 0 1.8 0 L21.4 14.4" fill="none" stroke={fg} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      {/* dot closing the V */}
      <circle cx="23.2" cy="11.2" r="2.3" fill={plain ? 'var(--color-brand-fg)' : '#9CC0FF'} />
    </svg>
  )
}

export function Wordmark({ className, size = 'md' }: { className?: string; size?: 'md' | 'lg' | 'xl' }) {
  const s = { md: { m: 28, t: 'text-lg' }, lg: { m: 36, t: 'text-[22px]' }, xl: { m: 72, t: 'text-[52px]' } }[size]
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Mark size={s.m} />
      <span className={cn('font-bold tracking-[-0.02em] text-ink-900', s.t)}>
        Vita<span className="text-brand-fg">P</span>
      </span>
    </span>
  )
}

/* ---- Third-party glyphs (Lucide v1 ships no brand icons) ---- */
export function GoogleG({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  )
}

export function SocialIcon({ name, size = 18 }: { name: 'facebook' | 'youtube' | 'linkedin' | 'zalo'; size?: number }) {
  const p = { width: size, height: size, viewBox: '0 0 24 24', fill: 'currentColor', 'aria-hidden': true }
  if (name === 'facebook')
    return (
      <svg {...p}>
        <path d="M13.5 21v-7.5h2.5l.4-3h-2.9V8.6c0-.9.3-1.5 1.5-1.5h1.5V4.4c-.3 0-1.2-.1-2.2-.1-2.2 0-3.8 1.4-3.8 3.9v2.3H8v3h2.5V21h3z" />
      </svg>
    )
  if (name === 'youtube')
    return (
      <svg {...p}>
        <path d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.3 5 12 5 12 5s-6.3 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2C2 8.8 2 12 2 12s0 3.2.4 4.8a2.5 2.5 0 0 0 1.8 1.8C5.7 19 12 19 12 19s6.3 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8c.4-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l5.2 3L10 15z" />
      </svg>
    )
  if (name === 'linkedin')
    return (
      <svg {...p}>
        <path d="M6.9 8.8H3.8V20h3.1V8.8zM5.4 4a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6zM20.2 13.6c0-3-1.6-4.9-4.2-4.9-1.4 0-2.4.8-2.8 1.5V8.8h-3V20h3.1v-5.6c0-1.5.3-2.9 2.1-2.9 1.8 0 1.8 1.7 1.8 3V20h3.1v-6.4z" />
      </svg>
    )
  return (
    <svg {...p} viewBox="0 0 24 24">
      <path d="M12 3C6.5 3 2 6.8 2 11.5c0 2.6 1.4 4.9 3.6 6.5L5 21l3.4-1.8c1.1.3 2.3.5 3.6.5 5.5 0 10-3.8 10-8.5S17.5 3 12 3z" />
      <text x="12" y="13.6" textAnchor="middle" fontSize="6.4" fontWeight="700" fill="var(--color-surface)" fontFamily="system-ui">Zalo</text>
    </svg>
  )
}
