import { useEffect, useId, useRef, useState } from 'react'
import { ArrowDown, BadgeQuestionMark, Check, Eye, Flag, Plus, RefreshCw, Search, Trash2, UserCheck } from 'lucide-react'
import { useApp } from '@/app/state'
import { LowConfTag, StatusPill } from '@/components/status'
import { Banner, Button, IconButton, Modal, ModalHeader } from '@/components/ui'
import type { ResultDrug } from '@/data/db'
import { type DrugRow, type Field, NAMES_KNOWN, SUGGESTIONS } from '@/data/drugs'
import { cn } from '@/lib/cn'
import { canVerify, emptyRow, LOW_CONF, needsReview, pendingCount } from './model'
import { OriginalPane, type PaperLine, ZoomableCrop } from './Prescription'

type Props = {
  state: { rows: DrugRow[]; lines: PaperLine[]; manual: boolean; saveFailed?: boolean }
  onChange: (rows: DrugRow[]) => void
  onSaveFailed: (v: boolean) => void
  onDone: (drugs: ResultDrug[]) => void
  /** Inside the public landing page: the bottom bar is sticky within the flow instead of fixed. */
  embedded?: boolean
}

export const UNRESOLVED_BANNER = 'Đơn thuốc có thành phần chưa rõ tên, hệ thống không thể đảm bảo an toàn cho đến khi bạn sửa lại đúng tên thuốc'

export function Confirm({ state, onChange, onSaveFailed, onDone, embedded = false }: Props) {
  const { isGuest } = useApp()
  const { rows, lines, manual, saveFailed } = state
  const [focusLine, setFocusLine] = useState<number | null>(rows[0]?.line ?? null)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [showOriginalModal, setShowOriginalModal] = useState(false)
  const [saving, setSaving] = useState(false)
  const [barH, setBarH] = useState(0)
  const helperId = useId()
  const root = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const cards = useRef(new Map<string, HTMLLIElement>())
  const pending = pendingCount(rows)
  const hasUnresolved = rows.some((r) => r.unresolved)
  const disabled = pending > 0 || rows.length === 0

  const update = (id: string, patch: Partial<DrugRow>) => onChange(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)))

  // On opening step 3, bring the first low-confidence field into view and focus it.
  useEffect(() => {
    const first = root.current?.querySelector<HTMLElement>('[data-low]')
    if (!first) return
    first.scrollIntoView({ block: 'center' })
    first.focus({ preventScroll: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Page bottom padding = bar height + 16px, so the last card is never covered.
  useEffect(() => {
    if (!bar.current) return
    const ro = new ResizeObserver(([e]) => setBarH(e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height))
    ro.observe(bar.current)
    return () => ro.disconnect()
  }, [])

  /** Scroll to and focus the next drug that still needs review, after the one the user is on. */
  const goNext = () => {
    const todo = rows.filter(needsReview)
    if (!todo.length) return
    const cur = rows.findIndex((r) => r.id === activeId)
    const next = todo.find((r) => rows.indexOf(r) > cur) ?? todo[0]
    const el = cards.current.get(next.id)
    if (!el) return
    el.scrollIntoView({ block: 'center', behavior: 'smooth' })
    const target = el.querySelector<HTMLElement>('[data-low]') ?? el.querySelector<HTMLElement>('[data-todo]') ?? el.querySelector<HTMLElement>('[data-verify]:not(:disabled)') ?? el
    target.focus({ preventScroll: true })
  }

  const submit = () => {
    if (disabled) return
    const drugs = rows.map((r) => ({ name: r.name.trim(), strength: r.strength.trim(), unresolved: r.unresolved }))
    if (isGuest) return onDone(drugs)
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      onSaveFailed(false)
      onDone(drugs)
    }, 900)
  }

  return (
    <div ref={root} className="space-y-4" style={embedded ? undefined : { paddingBottom: barH + 16, ['--bar-h' as string]: `${barH}px` }}>
      {hasUnresolved && (
        <div className="sticky top-[120px] z-20 lg:top-[76px]">
          <Banner tone="warning" icon={<BadgeQuestionMark size={20} />} className="shadow-e1">
            {UNRESOLVED_BANNER}
          </Banner>
        </div>
      )}
      {manual && (
        <Banner tone="info">Bạn đang nhập tay danh sách thuốc. Hãy chép đúng tên và hàm lượng như trên đơn hoặc vỏ hộp thuốc.</Banner>
      )}

      <div className={cn('grid gap-6', !manual && 'lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]')}>
        {!manual && (
          <div className="hidden lg:block">
            {/* Sticky 24px below the 64px app header (24px from the top when embedded). */}
            <div
              className={cn('sticky max-h-[860px]', embedded ? 'top-6' : 'top-[88px]')}
              style={{ height: embedded ? 'calc(100dvh - 48px)' : 'calc(100dvh - 88px - var(--bar-h, 0px) - 16px)' }}
            >
              <OriginalPane lines={lines} highlight={focusLine} />
            </div>
          </div>
        )}

        <div className="min-w-0 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-ink-900">
                {rows.length} thuốc {manual ? 'đã nhập' : 'đọc được'}
              </h2>
              {!manual && <p className="text-xs text-ink-600">Ô màu cam: hệ thống chưa chắc chắn</p>}
            </div>
            {!manual && (
              <Button
                variant="secondary"
                size="sm"
                icon={<Eye size={16} aria-hidden />}
                onClick={() => setShowOriginalModal(true)}
                className="shrink-0 lg:hidden"
              >
                Xem ảnh gốc
              </Button>
            )}
          </div>
          <datalist id="drug-names">
            {SUGGESTIONS.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
          <ol className="space-y-4">
            {rows.map((r, i) => (
              <DrugRowCard
                key={r.id}
                ref={(el) => {
                  if (el) cards.current.set(r.id, el)
                  else cards.current.delete(r.id)
                }}
                index={i}
                row={r}
                lines={lines}
                focused={focusLine === r.line && r.line >= 0}
                onFocus={() => {
                  setActiveId(r.id)
                  if (r.line >= 0) setFocusLine(r.line)
                }}
                onChange={(p) => update(r.id, p)}
                onRemove={rows.length > 1 ? () => onChange(rows.filter((x) => x.id !== r.id)) : undefined}
              />
            ))}
          </ol>
          <Button variant="secondary" block icon={<Plus size={18} aria-hidden />} onClick={() => onChange([...rows, emptyRow()])} className="border-dashed">
            Thêm thuốc
          </Button>

          {saveFailed && (
            <Banner
              tone="error"
              title="Không lưu được đơn thuốc. Dữ liệu bạn đã sửa vẫn còn."
              action={
                <Button size="sm" variant="secondary" icon={<RefreshCw size={16} aria-hidden />} onClick={submit} loading={saving}>
                  Thử lại
                </Button>
              }
            />
          )}

          {embedded && barContent(true)}
        </div>
      </div>

      {!embedded && (
        <div ref={bar} className="fixed inset-x-0 bottom-0 z-30 border-t border-line-200 bg-surface/95 shadow-e2 backdrop-blur">
          <div className="mx-auto max-w-[1280px] px-4 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[1160px]">{barContent(false)}</div>
          </div>
        </div>
      )}

      {showOriginalModal && (
        <Modal open onClose={() => setShowOriginalModal(false)} labelledBy="mobile-original-pane" width={720}>
          <ModalHeader id="mobile-original-pane" title="Ảnh đơn thuốc gốc" onClose={() => setShowOriginalModal(false)} />
          <div className="h-[75dvh] p-3 sm:p-4">
            <OriginalPane lines={lines} highlight={focusLine} />
          </div>
        </Modal>
      )}
    </div>
  )

  function barContent(inFlow: boolean) {
    const helper = disabled ? 'Hoàn tất đối chiếu để tiếp tục' : isGuest ? 'Dùng thử: kết quả không được lưu' : null
    return (
      <div ref={inFlow ? bar : undefined} className={cn('flex flex-col gap-2 py-3 lg:flex-row lg:items-center lg:gap-4', inFlow && 'sticky bottom-0 z-10 -mx-4 border-t border-line-200 bg-surface/95 px-4 backdrop-blur sm:mx-0 sm:rounded-xl sm:border')}>
        <p className={cn('text-sm', pending ? 'font-medium text-ink-900' : 'text-ink-600')} aria-live="polite">
          {pending ? (
            <>
              Còn <span className="font-mono">{pending}</span> thuốc cần đối chiếu
            </>
          ) : (
            'Đã đối chiếu tất cả các mục'
          )}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center lg:ml-auto">
          {pending > 0 && (
            <Button variant="secondary" iconRight={<ArrowDown size={18} aria-hidden />} onClick={goNext}>
              Đến thuốc tiếp theo
            </Button>
          )}
          {helper && (
            <p id={helperId} className="text-[13px] text-ink-600 sm:order-first sm:text-right">
              {helper}
            </p>
          )}
          <Button onClick={submit} disabled={disabled} loading={saving && !saveFailed} aria-describedby={helper ? helperId : undefined} className="sm:min-w-[180px]">
            Xem kết quả
          </Button>
        </div>
      </div>
    )
  }
}

type CardProps = {
  index: number
  row: DrugRow
  lines: PaperLine[]
  focused: boolean
  onFocus: () => void
  onChange: (p: Partial<DrugRow>) => void
  onRemove?: () => void
  ref?: React.Ref<HTMLLIElement>
}

function DrugRowCard({ index, row, lines, focused, onFocus, onChange, onRemove, ref }: CardProps) {
  const hintId = useId()
  const hasImage = row.line >= 0
  const confirm = (f: Field) => (row.confirmed.includes(f) ? row.confirmed : [...row.confirmed, f])
  const set = (f: Field, v: string) => onChange({ [f]: v, confirmed: confirm(f) } as Partial<DrugRow>)
  const keep = (f: Field) => onChange({ confirmed: confirm(f) })
  const field = (f: Field) => ({ conf: row.conf[f], confirmed: row.confirmed.includes(f), onChange: (v: string) => set(f, v), onKeep: () => keep(f) })
  const title = row.name || `Thuốc ${index + 1}`
  const verifiable = canVerify(row)

  return (
    <li
      ref={ref}
      tabIndex={-1}
      onFocusCapture={onFocus}
      onMouseEnter={onFocus}
      className={cn(
        'scroll-mt-32 rounded-xl border bg-surface shadow-e1 transition-[border-color,box-shadow] duration-150',
        row.unresolved ? 'border-yellow-line' : focused ? 'border-brand-600 ring-1 ring-brand-600' : 'border-line-200',
      )}
    >
      <div className="flex items-center gap-3 px-4 pt-3 sm:px-5">
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-line-100 px-1.5 font-mono text-[12px] font-semibold text-ink-600">{index + 1}</span>
        <p className="min-w-0 flex-1 truncate text-[15px] font-semibold text-ink-900">{row.unresolved ? 'Thuốc chưa rõ tên' : title}</p>
        {hasImage && (
          <button type="button" onClick={onFocus} className="hidden min-h-11 items-center rounded-md px-1 text-[12px] font-medium text-brand-fg underline-offset-2 hover:underline lg:inline-flex">
            Dòng {row.line + 1} trên ảnh
          </button>
        )}
        {onRemove && (
          <IconButton label={`Xóa ${title} khỏi danh sách`} onClick={onRemove} className="-mr-2 h-10 w-10">
            <Trash2 size={18} />
          </IconButton>
        )}
      </div>

      <div className="space-y-4 px-4 pt-3 pb-4 sm:px-5 sm:pb-5">
        {hasImage && <ZoomableCrop lines={lines} index={row.line} alt={`Dòng ${row.line + 1} của đơn: ${row.raw[0]}, ${row.raw[1]}`} />}

        {row.unresolved ? (
          <div className="space-y-3 rounded-xl border border-yellow-line bg-yellow-bg p-4">
            <StatusPill status="UNRESOLVED_DRUG" size="sm" />
            <p className="text-sm text-yellow-ink">
              Đọc được trên ảnh: <span className="font-mono font-medium">“{row.raw[0]}”</span>. Không khớp với thuốc nào trong cơ sở dữ liệu.
            </p>
            <DrugAutocomplete
              label="Sửa tên thuốc"
              onPick={(name) => onChange({ name, unresolved: false, marked: false, conf: { ...row.conf, name: undefined } })}
            />
            {row.marked ? (
              <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface/70 px-3 py-2 text-sm text-yellow-ink">
                <Flag size={16} aria-hidden />
                <span className="flex-1">Đã đánh dấu. Thuốc này sẽ không được dùng để kiểm tra tương tác.</span>
                <Button size="sm" variant="ghost" onClick={() => onChange({ marked: false, verified: false })}>
                  Bỏ đánh dấu
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" icon={<Flag size={16} aria-hidden />} onClick={() => onChange({ marked: true })} className="text-yellow-ink hover:bg-surface/60" data-todo>
                Giữ nguyên và đánh dấu
              </Button>
            )}
          </div>
        ) : (
          <div>
            <ConfidenceField label="Tên thuốc" value={row.name} {...field('name')} placeholder="Ví dụ: Amlodipin" list />
            {row.name && !NAMES_KNOWN.has(row.name.trim()) && !hasImage && (
              <p className="mt-1.5 text-[12px] text-ink-600">Tên này chưa có trong cơ sở dữ liệu; kết quả có thể là “Thuốc chưa nhận diện được”.</p>
            )}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <ConfidenceField label="Hàm lượng" mono value={row.strength} {...field('strength')} placeholder="5 mg" />
          <ConfidenceField label="Liều" mono value={row.dose} {...field('dose')} placeholder="1 viên" />
          <ConfidenceField label="Tần suất" mono value={row.freq} {...field('freq')} placeholder="2 lần/ngày" />
          <ConfidenceField label="Thời gian dùng" value={row.duration} {...field('duration')} placeholder="7 ngày" />
        </div>

        {hasImage && (
          <div className="border-t border-line-200 pt-3">
            <label className={cn('flex min-h-12 items-center gap-3 rounded-lg px-1', verifiable ? 'cursor-pointer' : 'cursor-not-allowed')}>
              <input
                type="checkbox"
                data-verify
                checked={row.verified}
                disabled={!verifiable}
                aria-describedby={!verifiable ? hintId : undefined}
                onChange={(e) => onChange({ verified: e.target.checked })}
                className="h-5 w-5 shrink-0 cursor-pointer appearance-none rounded border-[1.5px] border-ink-400 bg-surface bg-center bg-no-repeat transition-colors duration-150 checked:border-brand-600 checked:bg-brand-600 checked:bg-[url('data:image/svg+xml;utf8,<svg%20xmlns=%22http://www.w3.org/2000/svg%22%20viewBox=%220%200%2024%2024%22%20fill=%22none%22%20stroke=%22white%22%20stroke-width=%223%22><path%20d=%22M5%2012l5%205L20%207%22/></svg>')] checked:bg-[length:14px] disabled:cursor-not-allowed disabled:bg-bg-50"
              />
              <span className={cn('text-[15px] font-medium', verifiable ? 'text-ink-900' : 'text-ink-600')}>Tôi đã đối chiếu thuốc này với ảnh gốc</span>
            </label>
            {!verifiable && (
              <p id={hintId} className="mt-1 pl-9 text-[13px] text-ink-600">
                Hãy sửa hoặc bấm “Giữ nguyên giá trị này” ở các ô màu cam trước.
              </p>
            )}
          </div>
        )}
      </div>
    </li>
  )
}

function ConfidenceField({
  label,
  value,
  onChange,
  onKeep,
  conf,
  confirmed,
  mono,
  placeholder,
  list,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  onKeep: () => void
  conf?: number
  confirmed: boolean
  mono?: boolean
  placeholder?: string
  list?: boolean
}) {
  const id = useId()
  const input = useRef<HTMLInputElement>(null)
  const isLow = conf !== undefined && conf < LOW_CONF
  const low = isLow && !confirmed
  return (
    <div>
      <div className="mb-1.5 flex min-h-6 items-center justify-between gap-2">
        <label htmlFor={id} className="text-sm font-medium text-ink-900">
          {label}
          {low && <span className="sr-only"> (độ tin cậy thấp {conf}%, hãy so với ảnh gốc)</span>}
        </label>
        {low && <LowConfTag pct={conf!} />}
        {isLow && confirmed && (
          <span className="inline-flex h-6 items-center gap-1 rounded-full bg-line-100 px-2 text-[12px] font-medium text-ink-600">
            <UserCheck size={13} aria-hidden />
            Đã đối chiếu
          </span>
        )}
      </div>
      <input
        ref={input}
        id={id}
        value={value}
        placeholder={placeholder}
        list={list ? 'drug-names' : undefined}
        data-low={low || undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-11 w-full rounded-lg border px-3 text-base outline-none transition-colors duration-150 placeholder:text-ink-400 focus:ring-2 focus:ring-brand-600/20',
          mono && 'font-mono',
          low
            ? 'border-lc-line/40 border-l-[3px] border-l-lc-line bg-lc-bg font-medium text-lc-ink focus:border-lc-line'
            : 'border-line-200 bg-surface text-ink-900 hover:border-ink-400 focus:border-brand-600',
        )}
      />
      {low && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="mt-1 -ml-2 h-11 px-2 text-[13px]"
          icon={<Check size={16} aria-hidden />}
          aria-label={`Giữ nguyên giá trị này: ${label} ${value}`}
          onClick={() => {
            onKeep()
            input.current?.focus()
          }}
        >
          Giữ nguyên giá trị này
        </Button>
      )}
    </div>
  )
}

function DrugAutocomplete({ label, onPick }: { label: string; onPick: (name: string) => void }) {
  const id = useId()
  const [q, setQ] = useState('Gluco')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const matches = SUGGESTIONS.filter((s) => s.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 6)
  const pick = (n: string) => {
    setOpen(false)
    onPick(n)
  }
  return (
    <div className="relative">
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-yellow-ink">
        {label}
      </label>
      <div className="flex h-11 items-center rounded-lg border border-yellow-line bg-surface focus-within:ring-2 focus-within:ring-brand-600/25">
        <Search size={18} className="ml-3 shrink-0 text-ink-600" aria-hidden />
        <input
          ref={inputRef}
          id={id}
          role="combobox"
          aria-expanded={open && matches.length > 0}
          aria-controls={`${id}-list`}
          aria-autocomplete="list"
          aria-activedescendant={open && matches[active] ? `${id}-${active}` : undefined}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') (e.preventDefault(), setOpen(true), setActive((a) => Math.min(matches.length - 1, a + 1)))
            if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(0, a - 1)))
            if (e.key === 'Enter' && open && matches[active]) (e.preventDefault(), pick(matches[active]))
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder="Nhập tên thuốc trên vỏ hộp"
          className="h-full w-full min-w-0 bg-transparent px-2.5 text-base text-ink-900 outline-none placeholder:text-ink-400"
        />
      </div>
      {open && matches.length > 0 && (
        <ul id={`${id}-list`} role="listbox" className="absolute inset-x-0 top-full z-20 mt-1 overflow-hidden rounded-xl border border-line-200 bg-surface p-1 shadow-e2">
          {matches.map((m, i) => (
            <li
              key={m}
              id={`${id}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => (e.preventDefault(), pick(m))}
              onMouseEnter={() => setActive(i)}
              className={cn('flex h-10 cursor-pointer items-center rounded-lg px-3 text-sm', i === active ? 'bg-brand-50 text-brand-ink' : 'text-ink-900')}
            >
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

