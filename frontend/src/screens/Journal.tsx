import { useEffect, useId, useRef, useState } from 'react'
import { Activity, Droplet, EllipsisVertical, HeartPulse, NotebookPen, Pencil, Plus, Scale, Trash2, TriangleAlert } from 'lucide-react'
import { useApp } from '@/app/state'
import { GuestLock } from '@/components/GuestLock'
import { Banner, Button, Card, EmptyState, Modal, ModalHeader, Mono, PageHeader, Segmented, TextField } from '@/components/ui'
import { daysAgoOf, type Entry, fmtDate, fromMmol, GLU_DECIMALS, type GluUnit, JOURNAL_SEED, NOW, toLocal, toMmol, useData, WEEKDAY } from '@/data/db'
import { fmt } from '@/data/health'
import { cn } from '@/lib/cn'

const dayKey = (at: string) => at.slice(0, 10)
function dayLabel(key: string) {
  const diff = daysAgoOf(key)
  const wd = WEEKDAY[new Date(key + 'T00:00').getDay()]
  return { rel: diff === 0 ? 'Hôm nay' : diff === 1 ? 'Hôm qua' : wd, date: fmtDate(key) }
}

type Filter = '7' | '30' | '90' | 'all'
const RANGE_OPTS: { value: Filter; label: string }[] = [
  { value: '7', label: '7 ngày' },
  { value: '30', label: '30 ngày' },
  { value: '90', label: '3 tháng' },
  { value: 'all', label: 'Tất cả' },
]

type MetricFilter = 'all' | 'bp' | 'glu' | 'wt' | 'hr'
const METRIC_OPTS: [MetricFilter, string][] = [
  ['all', 'Tất cả'],
  ['bp', 'Huyết áp'],
  ['glu', 'Đường huyết'],
  ['wt', 'Cân nặng'],
  ['hr', 'Nhịp tim'],
]

export function Journal() {
  const { isGuest, toast } = useApp()
  return isGuest ? (
    <GuestLock title="Đăng ký để dùng Sổ tay sức khỏe" body="Ghi lại huyết áp, đường huyết, cân nặng và nhịp tim. VitaP sẽ vẽ biểu đồ xu hướng cho bạn ở Tổng quan." gate="Đăng ký để lưu ghi chép sức khỏe và xem lại bất cứ lúc nào">
      <JournalInner toast={toast} />
    </GuestLock>
  ) : (
    <JournalInner toast={toast} />
  )
}

function JournalInner({ toast }: { toast: (m: string, t?: 'success' | 'error') => void }) {
  const { entries, setEntries } = useData()
  const [filter, setFilter] = useState<Filter>('30')
  const [metric, setMetric] = useState<MetricFilter>('all')
  const [form, setForm] = useState<{ entry?: Entry } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Entry | null>(null)

  const now = NOW.getTime()
  const visible = entries
    .filter((e) => filter === 'all' || now - new Date(e.at).getTime() <= Number(filter) * 86400000)
    // An entry with no reading for the chosen metric would render empty, so drop it.
    .filter((e) => metric === 'all' || e[metric] != null)
    .sort((a, b) => b.at.localeCompare(a.at))
  const groups = visible.reduce<Record<string, Entry[]>>((g, e) => ((g[dayKey(e.at)] ??= []).push(e), g), {})

  const save = (e: Entry) => {
    setEntries((list) => (list.some((x) => x.id === e.id) ? list.map((x) => (x.id === e.id ? e : x)) : [e, ...list]))
    setForm(null)
    toast('Đã lưu ghi chép')
  }

  return (
    <>
      <PageHeader
        title="Sổ tay"
        sub="Ghi chép chỉ số sức khỏe theo thời gian"
        right={
          <Button icon={<Plus size={18} aria-hidden />} onClick={() => setForm({})}>
            Thêm ghi chép
          </Button>
        }
      />

      {entries.length === 0 ? (
        <Card>
          <EmptyState
            className="py-16"
            icon={<NotebookPen size={22} />}
            title="Sổ tay đang trống"
            body="Ghi lại chỉ số đầu tiên để xem biểu đồ ở Tổng quan."
            action={
              <Button icon={<Plus size={18} aria-hidden />} onClick={() => setForm({})}>
                Thêm ghi chép
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <Segmented size="lg" label="Khoảng thời gian" value={filter} onChange={setFilter} options={RANGE_OPTS} className="mb-3 w-full sm:w-auto [&>button]:sm:w-24" />

          <div role="group" aria-label="Lọc theo chỉ số" className="no-scrollbar -mx-6 mb-6 flex gap-2 overflow-x-auto px-6">
            {METRIC_OPTS.map(([k, l]) => (
              <button
                key={k}
                onClick={() => setMetric(k)}
                aria-pressed={metric === k}
                className={cn(
                  'h-11 shrink-0 rounded-full border px-4 text-sm font-medium transition-colors duration-150',
                  metric === k ? 'border-brand-600 bg-brand-50 text-brand-ink' : 'border-line-200 bg-surface text-ink-600 hover:border-ink-400 hover:text-ink-900',
                )}
              >
                {l}
              </button>
            ))}
          </div>

          {visible.length === 0 ? (
            <Card>
              <EmptyState
                icon={<NotebookPen size={22} />}
                title="Không có ghi chép trong khoảng này"
                body="Chọn khoảng thời gian rộng hơn để xem thêm."
                action={
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFilter('all')
                      setMetric('all')
                    }}
                  >
                    Xem tất cả
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="space-y-8">
              {Object.entries(groups).map(([k, list]) => {
                const l = dayLabel(k)
                return (
                  <section key={k} aria-label={`${l.rel} ${l.date}`}>
                    <h2 className="mb-3 flex items-baseline gap-2 text-sm">
                      <span className="font-semibold text-ink-900">{l.rel}</span>
                      <Mono className="text-ink-600">{l.date}</Mono>
                    </h2>
                    <ul className="space-y-3">
                      {list.map((e) => (
                        <EntryCard key={e.id} e={e} metric={metric} onEdit={() => setForm({ entry: e })} onDelete={() => setConfirmDelete(e)} />
                      ))}
                    </ul>
                  </section>
                )
              })}
            </div>
          )}
        </>
      )}

      {form && (
        <EntryForm
          initial={form.entry}
          onClose={() => setForm(null)}
          onSave={(e) => {
            save(e)
            return true
          }}
        />
      )}

      <DeleteDialog
        entry={confirmDelete}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => {
          setEntries((l) => l.filter((x) => x.id !== confirmDelete!.id))
          setConfirmDelete(null)
          toast('Đã xóa ghi chép')
        }}
      />
    </>
  )
}

function ObsChips({ e, metric = 'all' }: { e: Entry; metric?: MetricFilter }) {
  const { gluUnit } = useData()
  const chips: { icon: typeof Activity; label: string; value: string; unit: string; alt?: string }[] = []
  const show = (m: MetricFilter) => metric === 'all' || metric === m
  if (e.bp && show('bp')) chips.push({ icon: Activity, label: 'Huyết áp', value: `${e.bp[0]}/${e.bp[1]}`, unit: 'mmHg' })
  if (e.glu && show('glu')) {
    const { v, unit } = e.glu.entered
    // Shown as typed; when that differs from the chosen unit, add the converted value.
    const alt = unit !== gluUnit ? `(≈ ${fmt(fromMmol(e.glu.mmol, gluUnit), GLU_DECIMALS[gluUnit])} ${gluUnit})` : undefined
    chips.push({ icon: Droplet, label: 'Đường huyết', value: fmt(v, GLU_DECIMALS[unit]), unit, alt })
  }
  if (e.wt && show('wt')) chips.push({ icon: Scale, label: 'Cân nặng', value: fmt(e.wt, 1), unit: 'kg' })
  if (e.hr && show('hr')) chips.push({ icon: HeartPulse, label: 'Nhịp tim', value: String(e.hr), unit: 'bpm' })
  return (
    <ul className="flex flex-wrap gap-2">
      {chips.map((c) => (
        <li key={c.label} className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line-200 bg-bg-50 px-3 text-[13px] text-ink-900">
          <c.icon size={14} className="text-ink-600" aria-hidden />
          <span className="text-ink-600">{c.label}</span>
          <Mono className="font-medium">{c.value}</Mono>
          <Mono className="text-ink-600">{c.unit}</Mono>
          {c.alt && <Mono className="text-ink-600">{c.alt}</Mono>}
        </li>
      ))}
    </ul>
  )
}

function EntryCard({ e, metric, onEdit, onDelete }: { e: Entry; metric: MetricFilter; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card as="li" className="flex items-start gap-4 px-4 py-4 sm:px-5">
      <Mono className="w-12 shrink-0 pt-1 text-sm font-medium text-ink-600">{e.at.slice(11, 16)}</Mono>
      <div className="min-w-0 flex-1">
        <ObsChips e={e} metric={metric} />
        {e.note && <p className="mt-2.5 line-clamp-2 text-sm text-ink-600">{e.note}</p>}
      </div>
      <OverflowMenu onEdit={onEdit} onDelete={onDelete} label={`Tùy chọn cho ghi chép lúc ${e.at.slice(11, 16)}`} />
    </Card>
  )
}

function OverflowMenu({ onEdit, onDelete, label }: { onEdit: () => void; onDelete: () => void; label: string }) {
  const [open, setOpen] = useState(false)
  const btn = useRef<HTMLButtonElement>(null)
  const items = useRef<Array<HTMLButtonElement | null>>([])
  const wrap = useRef<HTMLDivElement>(null)
  const menuId = useId()

  useEffect(() => {
    if (!open) return
    items.current[0]?.focus()
    const onDoc = (ev: MouseEvent) => !wrap.current?.contains(ev.target as Node) && setOpen(false)
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const close = () => {
    setOpen(false)
    btn.current?.focus()
  }
  const actions = [
    { label: 'Sửa', icon: Pencil, run: onEdit, cls: 'text-ink-900' },
    { label: 'Xóa', icon: Trash2, run: onDelete, cls: 'text-red-ink' },
  ]

  return (
    // Negative vertical margin keeps the 44px button within the 32px chip row, so card padding stays 16px top and bottom.
    <div ref={wrap} className="relative -my-1.5 -mr-2 shrink-0">
      <button
        ref={btn}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((o) => !o)}
        onKeyDown={(ev) => ev.key === 'ArrowDown' && (ev.preventDefault(), setOpen(true))}
        className={cn('flex h-11 w-11 items-center justify-center rounded-lg text-ink-600 hover:bg-line-100', open && 'bg-line-100')}
      >
        <EllipsisVertical size={20} />
      </button>
      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label={label}
          className="absolute top-11 right-0 z-20 w-40 animate-fade-in rounded-xl border border-line-200 bg-surface p-1 shadow-e2"
          onKeyDown={(ev) => {
            const i = items.current.findIndex((x) => x === document.activeElement)
            if (ev.key === 'Escape') close()
            if (ev.key === 'Tab') setOpen(false)
            if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
              ev.preventDefault()
              const n = (i + (ev.key === 'ArrowDown' ? 1 : -1) + actions.length) % actions.length
              items.current[n]?.focus()
            }
          }}
        >
          {actions.map((a, i) => (
            <button
              key={a.label}
              ref={(el) => {
                items.current[i] = el
              }}
              role="menuitem"
              tabIndex={-1}
              onClick={() => {
                setOpen(false)
                a.run()
              }}
              className={cn('flex h-10 w-full items-center gap-2.5 rounded-lg px-3 text-sm font-medium outline-none hover:bg-bg-50 focus:bg-bg-50', a.cls)}
            >
              <a.icon size={16} aria-hidden />
              {a.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------------- Form ---------------- */
type Block = 'bp' | 'glu' | 'wt' | 'hr'
const BLOCKS: Block[] = ['bp', 'glu', 'wt', 'hr']
const NOTE_MAX = 500
const UNUSUAL = 'Giá trị này khác thường. Kiểm tra lại số đo?'

/** Numbers only; "." becomes ",", at most one decimal comma. */
function numeric(v: string, decimals: boolean) {
  let s = v.replace(/\./g, ',').replace(decimals ? /[^\d,]/g : /\D/g, '')
  const i = s.indexOf(',')
  if (i >= 0) s = s.slice(0, i + 1) + s.slice(i + 1).replace(/,/g, '')
  return s.slice(0, 7)
}
const num = (s: string) => (/\d/.test(s) ? Number(s.replace(',', '.')) : NaN)
const toInput = (v: number) => String(v).replace('.', ',')

/** dd/mm/yyyy mask: digits only, slashes inserted as you type. */
function maskDate(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return [d.slice(0, 2), d.slice(2, 4), d.slice(4)].filter(Boolean).join('/')
}
/** HH:mm mask (24h). */
function maskTime(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  return d.length > 2 ? `${d.slice(0, 2)}:${d.slice(2)}` : d
}
function parseDate(s: string) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s)
  if (!m) return null
  const [, dd, mm, yyyy] = m
  const d = new Date(+yyyy, +mm - 1, +dd)
  return d.getFullYear() === +yyyy && d.getMonth() === +mm - 1 && d.getDate() === +dd && +yyyy >= 1900 ? `${yyyy}-${mm}-${dd}` : null
}
const parseTime = (s: string) => {
  const m = /^(\d{2}):(\d{2})$/.exec(s)
  return m && +m[1] < 24 && +m[2] < 60 ? s : null
}

function EntryForm({
  initial,
  preset,
  onClose,
  onSave,
  startFailed,
}: {
  initial?: Entry
  preset?: 'validation'
  onClose: () => void
  onSave: (e: Entry) => boolean
  startFailed?: boolean
}) {
  const titleId = useId()
  const hintId = useId()
  const { gluUnit: preferredUnit } = useData()
  const start = initial?.at ?? toLocal(NOW)
  const [date, setDate] = useState(`${start.slice(8, 10)}/${start.slice(5, 7)}/${start.slice(0, 4)}`)
  const [time, setTime] = useState(start.slice(11, 16))
  const [timeTouched, setTimeTouched] = useState({ date: false, time: false })
  // New entries start with every metric off; when editing, metrics that already have a value are on.
  const [on, setOn] = useState<Record<Block, boolean>>({
    bp: preset === 'validation' || !!initial?.bp,
    glu: preset === 'validation' || !!initial?.glu,
    wt: !!initial?.wt,
    hr: !!initial?.hr,
  })
  const [sys, setSys] = useState(initial?.bp ? String(initial.bp[0]) : preset === 'validation' ? '128' : '')
  const [dia, setDia] = useState(initial?.bp ? String(initial.bp[1]) : '')
  const [glu, setGlu] = useState(initial?.glu ? toInput(initial.glu.entered.v) : preset === 'validation' ? '980' : '')
  const [gluUnit, setGluUnit] = useState<GluUnit>(initial?.glu?.entered.unit ?? preferredUnit)
  const [wt, setWt] = useState(initial?.wt ? toInput(initial.wt) : '')
  const [hr, setHr] = useState(initial?.hr ? String(initial.hr) : '')
  const [note, setNote] = useState(initial?.note ?? '')
  const [touched, setTouched] = useState<Set<Block>>(new Set())
  const [submitted, setSubmitted] = useState(preset === 'validation')
  const [kept, setKept] = useState<Set<string>>(new Set())
  const [failed, setFailed] = useState(!!startFailed)
  const [saving, setSaving] = useState(false)
  const noteId = useId()
  const blockRefs = useRef<Partial<Record<Block, HTMLDivElement | null>>>({})

  const dayKey = parseDate(date)
  const hhmm = parseTime(time)
  const n = { sys: num(sys), dia: num(dia), glu: num(glu), wt: num(wt), hr: num(hr) }
  const gluMmol = Number.isFinite(n.glu) ? toMmol(n.glu, gluUnit) : NaN

  const errors: Partial<Record<Block, string>> = {}
  if (!Number.isFinite(n.sys) || !Number.isFinite(n.dia)) errors.bp = 'Nhập đủ cả tâm thu và tâm trương'
  else if (n.sys <= n.dia) errors.bp = 'Tâm thu phải lớn hơn tâm trương.'
  if (!Number.isFinite(n.glu)) errors.glu = 'Nhập giá trị đường huyết'
  if (!Number.isFinite(n.wt)) errors.wt = 'Nhập cân nặng'
  if (!Number.isFinite(n.hr)) errors.hr = 'Nhập nhịp tim'

  const unusual: Record<Block, boolean> = {
    bp: n.sys < 60 || n.sys > 260 || n.dia < 30 || n.dia > 160,
    glu: gluMmol > 40,
    wt: n.wt < 20 || n.wt > 300,
    hr: n.hr < 25 || n.hr > 220,
  }
  // A kept warning stays dismissed only for the exact value that was kept.
  const keyOf: Record<Block, string> = { bp: `bp:${sys}/${dia}`, glu: `glu:${glu}${gluUnit}`, wt: `wt:${wt}`, hr: `hr:${hr}` }
  const valid = (b: Block) => on[b] && !errors[b]
  const warn = (b: Block) => valid(b) && unusual[b] && !kept.has(keyOf[b])
  const shown = (b: Block) => on[b] && (submitted || touched.has(b))
  const canSave = BLOCKS.some(valid) && !!dayKey && !!hhmm

  const touch = (b: Block) => (e: React.FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setTouched((s) => new Set(s).add(b))
  }
  const fixAgain = (b: Block) => blockRefs.current[b]?.querySelector<HTMLInputElement>('input')?.focus()

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault()
    setSubmitted(true)
    setTimeTouched({ date: true, time: true })
    if (!canSave) return
    const firstProblem = BLOCKS.find((b) => on[b] && (errors[b] || warn(b)))
    if (firstProblem) return fixAgain(firstProblem)
    setSaving(true)
    setTimeout(() => {
      setSaving(false)
      const ok = onSave({
        id: initial?.id ?? `e${Date.now()}`,
        at: `${dayKey}T${hhmm}`,
        bp: on.bp ? [n.sys, n.dia] : undefined,
        glu: on.glu ? { mmol: gluMmol, entered: { v: n.glu, unit: gluUnit } } : undefined,
        wt: on.wt ? n.wt : undefined,
        hr: on.hr ? n.hr : undefined,
        note: note.trim() || undefined,
      })
      setFailed(!ok)
    }, 700)
  }

  const toggle = (b: Block) => setOn((s) => ({ ...s, [b]: !s[b] }))
  const block = (b: Block) => ({
    on: on[b],
    onToggle: () => toggle(b),
    error: shown(b) ? errors[b] : undefined,
    warning: shown(b) && warn(b) ? { onFix: () => fixAgain(b), onKeep: () => setKept((s) => new Set(s).add(keyOf[b])) } : undefined,
    onBlur: touch(b),
    blockRef: (el: HTMLDivElement | null) => {
      blockRefs.current[b] = el
    },
  })
  const otherUnit: GluUnit = gluUnit === 'mmol/L' ? 'mg/dL' : 'mmol/L'

  return (
    <Modal open onClose={onClose} labelledBy={titleId} variant="side" width={480}>
      <ModalHeader id={titleId} title={initial ? 'Sửa ghi chép' : 'Thêm ghi chép'} onClose={onClose} />
      <form onSubmit={submit} noValidate className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-6 sm:px-6">
          {failed && (
            <Banner tone="error" title="Không lưu được. Dữ liệu của bạn vẫn còn, hãy thử lại.">
              Kiểm tra kết nối mạng rồi bấm Lưu lần nữa.
            </Banner>
          )}

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-ink-900">Thời gian</legend>
            <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,2fr)] gap-3">
              <TextField
                label="Ngày"
                className="[&>label]:text-[13px] [&>label]:font-normal [&>label]:text-ink-600"
                mono
                inputMode="numeric"
                autoComplete="off"
                placeholder="dd/mm/yyyy"
                value={date}
                onChange={(e) => setDate(maskDate(e.target.value))}
                onBlur={() => setTimeTouched((s) => ({ ...s, date: true }))}
                error={timeTouched.date && !dayKey ? 'Nhập ngày theo dạng dd/mm/yyyy' : undefined}
              />
              <TextField
                label="Giờ"
                className="[&>label]:text-[13px] [&>label]:font-normal [&>label]:text-ink-600"
                mono
                inputMode="numeric"
                autoComplete="off"
                placeholder="HH:mm"
                value={time}
                onChange={(e) => setTime(maskTime(e.target.value))}
                onBlur={() => setTimeTouched((s) => ({ ...s, time: true }))}
                error={timeTouched.time && !hhmm ? 'Nhập giờ theo dạng HH:mm' : undefined}
              />
            </div>
          </fieldset>

          <fieldset aria-describedby={hintId}>
            <legend className="text-sm font-medium text-ink-900">Chỉ số</legend>
            <p id={hintId} className="mt-0.5 mb-2 text-[13px] text-ink-600">
              Bật chỉ số bạn đã đo.
            </p>
            <div className="space-y-3">
              <ObsBlock icon={Activity} label="Huyết áp" {...block('bp')}>
                <div className="grid grid-cols-2 gap-3">
                  <TextField label="Tâm thu" inputMode="numeric" mono unit="mmHg" value={sys} onChange={(e) => setSys(numeric(e.target.value, false))} />
                  <TextField label="Tâm trương" inputMode="numeric" mono unit="mmHg" value={dia} onChange={(e) => setDia(numeric(e.target.value, false))} />
                </div>
              </ObsBlock>
              <ObsBlock icon={Droplet} label="Đường huyết" {...block('glu')}>
                <div className="flex items-end gap-3">
                  <TextField className="flex-1" label="Giá trị" inputMode="decimal" mono unit={gluUnit} value={glu} onChange={(e) => setGlu(numeric(e.target.value, true))} />
                  <Segmented
                    label="Đơn vị đường huyết"
                    className="[&>button]:h-11 [&>button]:px-2.5"
                    value={gluUnit}
                    onChange={setGluUnit}
                    options={[
                      { value: 'mmol/L', label: <span className="font-mono">mmol/L</span> },
                      { value: 'mg/dL', label: <span className="font-mono">mg/dL</span> },
                    ]}
                  />
                </div>
                <p className="mt-1.5 min-h-5 font-mono text-[13px] text-ink-600" aria-live="polite">
                  {Number.isFinite(n.glu) ? `≈ ${fmt(fromMmol(gluMmol, otherUnit), GLU_DECIMALS[otherUnit])} ${otherUnit}` : ''}
                </p>
              </ObsBlock>
              <ObsBlock icon={Scale} label="Cân nặng" {...block('wt')}>
                <TextField label="Cân nặng" inputMode="decimal" mono unit="kg" value={wt} onChange={(e) => setWt(numeric(e.target.value, true))} />
              </ObsBlock>
              <ObsBlock icon={HeartPulse} label="Nhịp tim" {...block('hr')}>
                <TextField label="Nhịp tim" inputMode="numeric" mono unit="bpm" value={hr} onChange={(e) => setHr(numeric(e.target.value, false))} />
              </ObsBlock>
            </div>
          </fieldset>

          <div>
            <label htmlFor={noteId} className="mb-1.5 block text-sm font-medium text-ink-900">
              Ghi chú
            </label>
            <textarea
              id={noteId}
              rows={4}
              maxLength={NOTE_MAX}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              aria-describedby={`${noteId}-count`}
              placeholder="Ví dụ: đo sau khi ngủ dậy, trước bữa sáng"
              className="w-full resize-none rounded-lg border border-line-200 px-3 py-2.5 text-base outline-none placeholder:text-ink-400 hover:border-ink-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
            />
            <p id={`${noteId}-count`} className="mt-1 text-right font-mono text-[12px] text-ink-600">
              {note.length}/{NOTE_MAX}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 gap-3 border-t border-line-200 bg-surface px-5 py-4 sm:px-6">
          <Button type="button" variant="secondary" className="flex-1" onClick={onClose}>
            Hủy
          </Button>
          <Button type="submit" className="flex-1" loading={saving} disabled={!canSave} aria-describedby={!canSave ? hintId : undefined}>
            Lưu
          </Button>
        </div>
      </form>
    </Modal>
  )
}

function ObsBlock({
  icon: Icon,
  label,
  on,
  onToggle,
  error,
  warning,
  onBlur,
  blockRef,
  children,
}: {
  icon: typeof Activity
  label: string
  on: boolean
  onToggle: () => void
  error?: string
  warning?: { onFix: () => void; onKeep: () => void }
  onBlur: (e: React.FocusEvent<HTMLDivElement>) => void
  blockRef: (el: HTMLDivElement | null) => void
  children: React.ReactNode
}) {
  return (
    <div className={cn('rounded-xl border transition-colors duration-150', error ? 'border-red-line' : on ? 'border-line-200 bg-surface' : 'border-dashed border-line-200 bg-bg-50')}>
      <button type="button" onClick={onToggle} aria-pressed={on} className="flex h-12 w-full items-center gap-3 px-4 text-left">
        <Icon size={18} className={on ? 'text-brand-fg' : 'text-ink-600'} aria-hidden />
        <span className="flex-1 text-[15px] font-medium text-ink-900">{label}</span>
        {/* Off: 1px gray-line border (≥ 3:1 against the card) and a lighter knob. */}
        <span className={cn('relative h-6 w-10 rounded-full border transition-colors duration-150', on ? 'border-brand-600 bg-brand-600' : 'border-gray-line bg-line-200')} aria-hidden>
          <span
            className={cn(
              'absolute top-0.5 h-[18px] w-[18px] rounded-full shadow-e1 transition-all duration-150',
              on ? 'left-[19px] bg-surface' : 'left-0.5 bg-surface dark:bg-ink-600',
            )}
          />
        </span>
      </button>
      {on && (
        <div ref={blockRef} onBlur={onBlur} className="px-4 pb-4">
          {children}
          {error && (
            <p role="alert" className="mt-2 text-sm text-red-ink">
              {error}
            </p>
          )}
          {warning && !error && (
            <div role="status" className="mt-3 flex flex-col gap-2 rounded-lg border border-yellow-line bg-yellow-bg p-3 text-sm text-yellow-ink">
              <p className="flex items-start gap-2">
                <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
                {UNUSUAL}
              </p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="secondary" className="h-11 border-yellow-ink" onClick={warning.onFix}>
                  Sửa lại
                </Button>
                <Button type="button" size="sm" variant="ghost" className="h-11 text-yellow-ink hover:bg-surface/60" onClick={warning.onKeep}>
                  Giữ nguyên
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DeleteDialog({ entry, onCancel, onConfirm }: { entry: Entry | null; onCancel: () => void; onConfirm: () => void }) {
  const id = useId()
  return (
    <Modal open={!!entry} onClose={onCancel} labelledBy={id} width={400} role="alertdialog">
      <div className="px-5 pt-5 pb-5 sm:px-6 sm:pt-6">
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-bg-50 text-ink-900" aria-hidden>
          <Trash2 size={20} />
        </div>
        <h2 id={id} className="text-lg font-semibold text-ink-900">
          Xóa ghi chép này?
        </h2>
        <p className="mt-1 text-sm text-ink-600">Hành động này không thể hoàn tác.</p>
        {entry && (
          <div className="mt-4 rounded-xl border border-line-200 bg-bg-50 p-3">
            <ObsChips e={entry} />
          </div>
        )}
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel} data-autofocus>
            Hủy
          </Button>
          <Button variant="danger" className="flex-1" onClick={onConfirm}>
            Xóa
          </Button>
        </div>
      </div>
    </Modal>
  )
}
