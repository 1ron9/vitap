import { CircleQuestionMark, Eye, Info, Lock, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

export type InteractionStatus = 'INTERACTION_FOUND' | 'NO_KNOWN_INTERACTION' | 'INSUFFICIENT_DATA' | 'UNRESOLVED_DRUG'
export type Severity = 'major' | 'moderate' | 'minor'

export const STATUS_ORDER: Record<InteractionStatus, number> = {
  INTERACTION_FOUND: 0,
  UNRESOLVED_DRUG: 1,
  INSUFFICIENT_DATA: 2,
  NO_KNOWN_INTERACTION: 3,
}

export const SEVERITY_META: Record<Severity, { label: string; level: number }> = {
  major: { label: 'Nghiêm trọng', level: 3 },
  moderate: { label: 'Trung bình', level: 2 },
  minor: { label: 'Nhẹ', level: 1 },
}

/** Severity meter: 3 slots, `level` of them filled; empty slots are outlined so the count never relies on colour. */
function SeverityMeter({ level }: { level: number }) {
  return (
    <span className="inline-flex items-end gap-[2px]" aria-hidden>
      {[1, 2, 3].map((i) => (
        <span
          key={i}
          className={cn(
            'w-[4px] rounded-[1px] border border-current',
            i === 1 ? 'h-1.5' : i === 2 ? 'h-2.5' : 'h-3.5',
            i <= level ? 'bg-current' : 'bg-transparent opacity-60',
          )}
        />
      ))}
    </span>
  )
}

/** Plain question mark (no enclosing shape), drawn in lucide style. */
function QuestionMark({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.25} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M8.5 8.5a3.5 3.5 0 0 1 6.8 1.2c0 2.3-3.3 3.1-3.3 5" />
      <path d="M12 19h.01" />
    </svg>
  )
}

/** Secondary line shown under statuses that must never read as "safe". */
export const STATUS_NOTE = {
  NO_KNOWN_INTERACTION: 'Điều này không có nghĩa là an toàn. Hãy hỏi bác sĩ hoặc dược sĩ.',
  INSUFFICIENT_DATA: 'Chưa có đủ thông tin về cặp thuốc này, không có nghĩa là an toàn.',
} as const

function WithNote({ pill, note, size, className }: { pill: ReactNode; note: string; size: 'sm' | 'md'; className: string }) {
  return (
    <span className="inline-flex flex-col items-start gap-1">
      {pill}
      <span className={cn('max-w-[22rem] pl-1 leading-snug', size === 'sm' ? 'text-[12px]' : 'text-[13px]', className)}>{note}</span>
    </span>
  )
}

/**
 * StatusPill — the single status indicator used across the app.
 * Every status differs by hue + icon + text, never by colour alone.
 * `locked` renders the neutral outlined replacement for "chưa ghi nhận" while any drug is UNRESOLVED.
 */
export function StatusPill({
  status,
  severity,
  locked,
  size = 'md',
  showSubline = true,
  muted,
}: {
  status: InteractionStatus
  severity?: Severity
  locked?: boolean
  size?: 'sm' | 'md'
  /** Always-visible note under "Chưa ghi nhận…" / "Chưa đủ dữ liệu…". On by default; turn off only where a tooltip carries the same text. */
  showSubline?: boolean
  /** Neutral outline for interaction alerts from prescriptions marked "Đã kết thúc". Icon, bars and text stay. */
  muted?: boolean
}) {
  const pad = 'whitespace-nowrap font-semibold ' + (size === 'sm' ? 'h-7 px-2.5 text-[12px] gap-1.5' : 'h-8 px-3 text-[13px] gap-1.5')
  const ic = size === 'sm' ? 14 : 16

  if (status === 'NO_KNOWN_INTERACTION' && locked) {
    return (
      <span className={cn('inline-flex items-center rounded-full border border-gray-line bg-surface text-gray-ink', pad)}>
        <Lock size={ic} aria-hidden />
        Chưa ghi nhận tương tác (chưa kết luận)
      </span>
    )
  }

  if (status === 'INTERACTION_FOUND') {
    const sev = severity ? SEVERITY_META[severity] : null
    const tone = muted
      ? 'border-gray-line bg-surface text-gray-ink'
      : severity === 'major'
        ? 'border-sev-major bg-sev-major text-white'
        : severity === 'moderate'
          ? 'border-sev-moderate-line bg-sev-moderate text-sev-moderate-ink'
          : 'border-red-line bg-red-bg text-red-ink'
    return (
      <span className={cn('inline-flex items-center rounded-full border', pad, tone)}>
        <TriangleAlert size={ic} aria-hidden />
        Có tương tác thuốc
        {sev && (
          <>
            <span>·</span>
            <SeverityMeter level={sev.level} />
            <span>Mức {sev.label.toLowerCase()}</span>
          </>
        )}
      </span>
    )
  }

  if (status === 'NO_KNOWN_INTERACTION') {
    const pill = (
      <span className={cn('inline-flex items-center rounded-full border border-slate-line bg-slate-bg text-slate-ink', pad)}>
        <Info size={ic} aria-hidden />
        Chưa ghi nhận tương tác trong cơ sở dữ liệu
      </span>
    )
    return showSubline ? <WithNote pill={pill} note={STATUS_NOTE.NO_KNOWN_INTERACTION} size={size} className="text-slate-ink" /> : pill
  }

  if (status === 'INSUFFICIENT_DATA') {
    const pill = (
      <span className={cn('inline-flex items-center rounded-full border border-gray-line bg-gray-bg text-gray-ink', pad)}>
        <QuestionMark size={ic} />
        Chưa đủ dữ liệu để kết luận
      </span>
    )
    return showSubline ? <WithNote pill={pill} note={STATUS_NOTE.INSUFFICIENT_DATA} size={size} className="text-gray-ink" /> : pill
  }

  return (
    <span className={cn('inline-flex items-center rounded-full border border-dashed border-yellow-ink bg-surface text-yellow-ink', pad)}>
      <CircleQuestionMark size={ic} aria-hidden />
      Thuốc chưa nhận diện được
    </span>
  )
}

export function LowConfTag({ pct }: { pct: number }) {
  return (
    <span className="inline-flex h-6 items-center gap-1 rounded-full border border-lc-line/60 bg-surface px-2 text-[12px] font-medium text-lc-ink">
      <Eye size={13} aria-hidden />
      Độ tin cậy thấp · <span className="font-mono">{pct}%</span>
    </span>
  )
}
