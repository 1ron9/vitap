import {
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import { ArrowLeft, CircleAlert, Eye, EyeOff, Info, Loader2, Siren, TriangleAlert, X } from 'lucide-react'
import { cn } from '@/lib/cn'

/* ---------------- Button ---------------- */
type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md'
  loading?: boolean
  icon?: ReactNode
  iconRight?: ReactNode
  block?: boolean
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading,
  icon,
  iconRight,
  block,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition-colors duration-150 ease-out select-none disabled:pointer-events-auto'
  const sizes = { sm: 'h-9 px-3 text-sm', md: 'h-11 px-4 text-[15px]' }
  const variants = {
    primary:
      'bg-brand-600 text-white hover:bg-brand-700 active:bg-brand-700 disabled:bg-line-200 disabled:text-ink-600',
    secondary:
      'bg-surface text-ink-900 border border-line-200 hover:border-ink-400 hover:bg-bg-50 active:bg-line-100 disabled:text-ink-400 disabled:bg-bg-50',
    ghost: 'text-brand-fg hover:bg-brand-50 active:bg-brand-100 disabled:text-ink-400 disabled:bg-transparent',
    danger: 'bg-red-line text-white hover:bg-red-ink disabled:bg-line-200 disabled:text-ink-600',
  }
  return (
    <button
      className={cn(base, sizes[size], variants[variant], block && 'w-full', className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Loader2 size={18} className="animate-spin" aria-hidden /> : icon}
      {children}
      {!loading && iconRight}
    </button>
  )
}

export function IconButton({
  label,
  children,
  className,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex h-11 w-11 items-center justify-center rounded-lg text-ink-600 transition-colors duration-150 hover:bg-line-100 hover:text-ink-900',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  )
}

export function BackButton({ onClick, children = 'Quay lại', className }: { onClick: () => void; children?: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn('-ml-2 inline-flex h-10 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-ink-600 transition-colors duration-150 hover:bg-line-100 hover:text-ink-900', className)}
    >
      <ArrowLeft size={18} aria-hidden />
      {children}
    </button>
  )
}

/* ---------------- TextField ---------------- */
type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> & {
  label: string
  helper?: ReactNode
  error?: string
  unit?: ReactNode
  mono?: boolean
}

export function TextField({ label, helper, error, unit, mono, type = 'text', className, id, ...rest }: FieldProps) {
  const autoId = useId()
  const fid = id ?? autoId
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  const describedBy = [error && `${fid}-err`, helper && `${fid}-help`].filter(Boolean).join(' ') || undefined
  return (
    <div className={className}>
      <label htmlFor={fid} className="mb-1.5 block text-sm font-medium text-ink-900">
        {label}
      </label>
      <div
        className={cn(
          'flex h-11 items-center rounded-lg border bg-surface transition-colors duration-150 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20',
          error ? 'border-red-line' : 'border-line-200 hover:border-ink-400',
          rest.disabled && 'bg-bg-50 opacity-70',
        )}
      >
        <input
          id={fid}
          type={isPassword && show ? 'text' : type}
          aria-invalid={!!error || undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-full w-full min-w-0 rounded-lg bg-transparent px-3 text-base text-ink-900 outline-none placeholder:text-ink-400 disabled:cursor-not-allowed',
            mono && 'font-mono',
          )}
          {...rest}
        />
        {unit && <span className="pr-3 font-mono text-sm text-ink-600">{unit}</span>}
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            className="mr-1 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-600 hover:bg-line-100"
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
      {error && (
        <p id={`${fid}-err`} className="mt-1.5 flex items-start gap-1.5 text-sm text-red-ink">
          <CircleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          {error}
        </p>
      )}
      {helper && !error && (
        <p id={`${fid}-help`} className="mt-1.5 text-sm text-ink-600">
          {helper}
        </p>
      )}
    </div>
  )
}

/* ---------------- Checkbox ---------------- */
export function Checkbox({
  checked,
  onChange,
  children,
  className,
  describedBy,
  required,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  children: ReactNode
  className?: string
  describedBy?: string
  required?: boolean
}) {
  const id = useId()
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <input
        id={id}
        type="checkbox"
        checked={checked}
        required={required}
        aria-describedby={describedBy}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer appearance-none rounded border-[1.5px] border-ink-400 bg-surface bg-center bg-no-repeat transition-colors duration-150 checked:border-brand-600 checked:bg-brand-600 checked:bg-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22white%22%20stroke-width=%223%22><path%20d=%22M5%2012l5%205L20%207%22/></svg>')] checked:bg-[length:14px]"
      />
      <label htmlFor={id} className="cursor-pointer text-sm leading-5 text-ink-900">
        {children}
      </label>
    </div>
  )
}

/* ---------------- Banner ---------------- */
type BannerTone = 'info' | 'warning' | 'emergency' | 'error' | 'neutral'
export function Banner({
  tone = 'info',
  title,
  children,
  action,
  onDismiss,
  icon,
  className,
}: {
  tone?: BannerTone
  title?: ReactNode
  children?: ReactNode
  action?: ReactNode
  onDismiss?: () => void
  icon?: ReactNode
  className?: string
}) {
  const tones: Record<BannerTone, string> = {
    info: 'bg-brand-50 border-brand-100 text-ink-900 [--ic:var(--color-brand-fg)]',
    warning: 'bg-yellow-bg border-yellow-line text-yellow-ink [--ic:var(--color-yellow-ink)]',
    emergency: 'bg-red-line border-red-line text-white [--ic:white]',
    error: 'bg-surface border-line-200 border-l-[3px] border-l-red-ink text-ink-900 [--ic:var(--color-red-ink)]',
    neutral: 'bg-gray-bg border-line-200 text-gray-ink [--ic:var(--color-gray-ink)]',
  }
  const defaultIcon = {
    info: <Info size={20} />,
    warning: <TriangleAlert size={20} />,
    emergency: <Siren size={20} />,
    error: <CircleAlert size={20} />,
    neutral: <Info size={20} />,
  }[tone]
  return (
    <div
      role={tone === 'emergency' || tone === 'error' ? 'alert' : 'status'}
      className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', tones[tone], className)}
    >
      <span className="mt-0.5 shrink-0 text-[var(--ic)]" aria-hidden>
        {icon ?? defaultIcon}
      </span>
      <div className="min-w-0 flex-1 text-sm leading-5">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn(!!title && 'mt-0.5')}>{children}</div>}
        {action && <div className="mt-3 flex flex-wrap gap-2">{action}</div>}
      </div>
      {onDismiss && tone === 'info' && (
        <button
          onClick={onDismiss}
          aria-label="Đóng thông báo"
          className="-mr-2 -mt-1.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-ink-600 hover:bg-brand-100"
        >
          <X size={18} />
        </button>
      )}
    </div>
  )
}

/* ---------------- Card ---------------- */
export function Card({ className, children, as: Tag = 'div' }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article' | 'li' }) {
  return <Tag className={cn('rounded-xl border border-line-200 bg-surface shadow-e1', className)}>{children}</Tag>
}

/* ---------------- Segmented ---------------- */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  size = 'md',
}: {
  options: { value: T; label: ReactNode }[]
  value: T
  onChange: (v: T) => void
  label: string
  className?: string
  /** 'lg' gives 44px segments for primary page controls such as time ranges. */
  size?: 'sm' | 'md' | 'lg'
}) {
  const refs = useRef<Array<HTMLButtonElement | null>>([])
  return (
    <div role="tablist" aria-label={label} className={cn('inline-flex rounded-lg bg-line-100 p-1', className)}>
      {options.map((o, i) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            role="tab"
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + options.length) % options.length
                onChange(options[n].value)
                refs.current[n]?.focus()
              }
            }}
            className={cn(
              'flex-1 rounded-md px-3 font-medium transition-all duration-150 ease-out',
              size === 'lg' ? 'h-11 text-sm' : size === 'md' ? 'h-9 text-sm' : 'h-8 text-[13px]',
              selected ? 'bg-surface text-ink-900 shadow-e1' : 'text-ink-600 hover:text-ink-900',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---------------- Modal / Sheet / Side panel ---------------- */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])'

export function Modal({
  open,
  onClose,
  labelledBy,
  children,
  variant = 'modal',
  width = 440,
  role = 'dialog',
}: {
  open: boolean
  onClose: () => void
  labelledBy: string
  children: ReactNode
  variant?: 'modal' | 'side' | 'drawer-left'
  width?: number
  role?: 'dialog' | 'alertdialog'
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement as HTMLElement | null
    const node = ref.current
    const first = node?.querySelector<HTMLElement>('[data-autofocus]') ?? node?.querySelector<HTMLElement>(FOCUSABLE)
    first?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
      }
      if (e.key === 'Tab' && node) {
        const els = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null)
        if (!els.length) return
        const a = els[0]
        const b = els[els.length - 1]
        if (e.shiftKey && document.activeElement === a) {
          e.preventDefault()
          b.focus()
        } else if (!e.shiftKey && document.activeElement === b) {
          e.preventDefault()
          a.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = overflow
      prev?.focus?.()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null
  const layout = {
    modal: 'items-end sm:items-center justify-center sm:p-6',
    side: 'items-end lg:items-stretch justify-center lg:justify-end',
    'drawer-left': 'items-stretch justify-start',
  }[variant]
  const panel = {
    modal: 'w-full rounded-t-2xl sm:rounded-2xl max-h-[92dvh] animate-sheet-in',
    side: 'w-full rounded-t-2xl lg:rounded-none lg:rounded-l-2xl max-h-[92dvh] lg:max-h-none lg:h-full animate-sheet-in lg:animate-panel-in',
    'drawer-left': 'h-full w-[88%] rounded-r-2xl animate-panel-in-left',
  }[variant]
  return (
    <div className={cn('fixed inset-0 z-50 flex', layout)}>
      <div className="absolute inset-0 animate-fade-in bg-night/40" onClick={onClose} aria-hidden />
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        style={{ ['--w' as string]: `${width}px` }}
        className={cn('relative flex flex-col overflow-hidden bg-surface shadow-e2 sm:max-w-[var(--w)]', panel)}
      >
        {(variant === 'modal' || variant === 'side') && <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-line-200 lg:hidden" aria-hidden />}
        {children}
      </div>
    </div>
  )
}

export function ModalHeader({ id, title, onClose, sub }: { id: string; title: ReactNode; onClose: () => void; sub?: ReactNode }) {
  return (
    <div className="flex shrink-0 items-start justify-between gap-3 px-5 pt-4 pb-3 sm:px-6 sm:pt-5">
      <div>
        <h2 id={id} className="text-lg font-semibold text-ink-900">
          {title}
        </h2>
        {sub && <p className="mt-0.5 text-sm text-ink-600">{sub}</p>}
      </div>
      <IconButton label="Đóng" onClick={onClose} className="-mr-2 -mt-1.5">
        <X size={20} />
      </IconButton>
    </div>
  )
}

/* ---------------- EmptyState ---------------- */
export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon: ReactNode
  title: string
  body?: string
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-fg" aria-hidden>
        {icon}
      </div>
      <p className="text-base font-semibold text-ink-900">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-ink-600">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}

/* ---------------- Skeleton ---------------- */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-shimmer rounded-md bg-line-100', className)} aria-hidden />
}

/* ---------------- Mono ---------------- */
export function Mono({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('font-mono tabular-nums', className)}>{children}</span>
}

/* ---------------- Page header ---------------- */
export function PageHeader({ title, sub, right }: { title: string; sub?: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-[-0.01em] text-ink-900 lg:text-[32px] lg:leading-10">{title}</h1>
        {sub && <p className="mt-1 text-sm text-ink-600">{sub}</p>}
      </div>
      {right}
    </div>
  )
}
