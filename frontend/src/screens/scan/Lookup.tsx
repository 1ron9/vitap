import { useId, useRef, useState } from 'react'
import { BadgeQuestionMark, ChevronDown, History, Info, Pencil, Pill, Plus, Search, X } from 'lucide-react'
import { Banner, Button, Card, EmptyState, Mono } from '@/components/ui'
import type { ResultDrug } from '@/data/db'
import { NAMES_KNOWN, STRENGTHS, SUGGESTIONS } from '@/data/drugs'
import { cn } from '@/lib/cn'
import { UNRESOLVED_BANNER } from './Confirm'
import { buildPairs, PairCard } from './Result'

type Item = { id: string; name: string; strength: string; unresolved: boolean }

const KNOWN = new Set([...SUGGESTIONS, ...NAMES_KNOWN])
const STRENGTH_RE = /\s+(\d+(?:[.,]\d+)?(?:\/\d+(?:[.,]\d+)?)?)\s*(mg|g|mcg|µg|ml)\s*$/i

let seq = 0
const mk = (name: string, strength = ''): Item => ({ id: `d${++seq}`, name, strength, unresolved: !KNOWN.has(name) })

const RECENT_KEY = 'vitap-recent-lookups'

type RecentRecord = {
  id: string
  label: string
  drugs: [string, string][]
  at: string
}

function getRecentLookups(): RecentRecord[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function saveRecentLookup(item: RecentRecord) {
  if (typeof window === 'undefined') return
  try {
    const current = getRecentLookups().filter((x) => x.label !== item.label)
    const next = [item, ...current].slice(0, 5)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

export const LOOKUP_PRESETS: Record<string, { items: Item[]; checked: boolean }> = {
  lookup: { items: [], checked: false },
  lookupFilled: { items: [mk('Amlodipin', '5 mg'), mk('Simvastatin', '20 mg'), mk('Clarithromycin')], checked: false },
  lookupResult: { items: [mk('Amlodipin', '5 mg'), mk('Simvastatin', '20 mg'), mk('Clarithromycin', '500 mg')], checked: true },
  lookupUnresolved: { items: [mk('Amlodipin', '5 mg'), mk('Paracetamol', '500 mg'), mk('Glucofag', '750 mg')], checked: true },
}

export function Lookup({ preset }: { preset: { items: Item[]; checked: boolean } }) {
  const [items, setItems] = useState<Item[]>(preset.items)
  const [checked, setChecked] = useState<ResultDrug[] | null>(preset.checked ? toDrugs(preset.items) : null)
  const [recentLookups, setRecentLookups] = useState<RecentRecord[]>(() => getRecentLookups())
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const topRef = useRef<HTMLDivElement>(null)
  const id = useId()

  const update = (next: Item[]) => {
    setItems(next)
    setChecked(null) // results are stale once the list changes
  }

  const applyLookup = (drugs: [string, string][]) => {
    const next = drugs.map(([n, s]) => mk(n, s))
    setItems(next)
    setChecked(toDrugs(next))
    setOpen(false)
    if (next.length >= 2) {
      const label = next.map((i) => i.name).join(' + ')
      const record = {
        id: `lk-${Date.now()}`,
        label,
        drugs,
        at: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      }
      saveRecentLookup(record)
      setRecentLookups(getRecentLookups())
    }
  }

  // Split a trailing strength ("Amlodipin 5mg") off the query.
  const m = q.match(STRENGTH_RE)
  const typedStrength = m ? `${m[1]} ${m[2].toLowerCase()}` : ''
  const typedName = (m ? q.slice(0, m.index) : q).trim()
  const already = new Set(items.map((i) => i.name.toLowerCase()))
  const matches = typedName ? SUGGESTIONS.filter((s) => s.toLowerCase().includes(typedName.toLowerCase()) && !already.has(s.toLowerCase())).slice(0, 6) : []
  const exact = matches.some((s) => s.toLowerCase() === typedName.toLowerCase())
  const options: { name: string; free?: boolean }[] = [...matches.map((name) => ({ name })), ...(typedName && !exact && !already.has(typedName.toLowerCase()) ? [{ name: typedName, free: true }] : [])]

  const add = (name: string) => {
    const canonical = SUGGESTIONS.find((s) => s.toLowerCase() === name.toLowerCase()) ?? name
    const strengths = STRENGTHS[canonical] ?? []
    update([...items, mk(canonical, typedStrength || (strengths.length === 1 ? strengths[0] : ''))])
    setQ('')
    setActive(0)
    inputRef.current?.focus()
  }

  const run = () => {
    const drugsList = toDrugs(items)
    setChecked(drugsList)
    setOpen(false)
    if (items.length >= 2) {
      const label = items.map((i) => i.name).join(' + ')
      const record = {
        id: `lk-${Date.now()}`,
        label,
        drugs: items.map((i) => [i.name, i.strength] as [string, string]),
        at: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
      }
      saveRecentLookup(record)
      setRecentLookups(getRecentLookups())
    }
  }

  const editList = () => {
    topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })
    inputRef.current?.focus({ preventScroll: true })
  }

  const result = checked ? buildPairs(checked) : null
  const resolvedCount = checked?.filter((d) => !d.unresolved).length ?? 0
  const anyUnresolved = !!checked?.some((d) => d.unresolved)

  return (
    <div className="space-y-6">
      <Card className="scroll-mt-[136px] p-5 sm:p-6 lg:scroll-mt-[96px]">
        <div ref={topRef} className="scroll-mt-[136px] lg:scroll-mt-[96px]" />
        <label htmlFor={id} className="text-base font-semibold text-ink-900">
          Nhập các thuốc cần kiểm tra
        </label>
        <p className="mt-0.5 text-sm text-ink-600">Gõ tên thuốc, có thể kèm hàm lượng (ví dụ “Amlodipin 5mg”), rồi nhấn Enter.</p>

        <div className="relative mt-4">
          <div
            onClick={() => inputRef.current?.focus()}
            className="flex min-h-14 cursor-text flex-wrap items-center gap-2 rounded-xl border border-line-200 bg-surface p-2 pl-3 transition-colors focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20 hover:border-ink-400"
          >
            <Search size={18} className="shrink-0 text-ink-600" aria-hidden />
            <ul className="contents" aria-label="Thuốc đã thêm">
              {items.map((it) => (
                <DrugTag
                  key={it.id}
                  item={it}
                  onStrength={(strength) => update(items.map((x) => (x.id === it.id ? { ...x, strength } : x)))}
                  onRemove={() => update(items.filter((x) => x.id !== it.id))}
                />
              ))}
            </ul>
            <input
              ref={inputRef}
              id={id}
              role="combobox"
              aria-expanded={open && options.length > 0}
              aria-controls={`${id}-list`}
              aria-autocomplete="list"
              aria-activedescendant={open && options[active] ? `${id}-${active}` : undefined}
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setOpen(true)
                setActive(0)
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 120)}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') (e.preventDefault(), setOpen(true), setActive((a) => Math.min(options.length - 1, a + 1)))
                if (e.key === 'ArrowUp') (e.preventDefault(), setActive((a) => Math.max(0, a - 1)))
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (options[active]) add(options[active].name)
                  else if (!q && items.length >= 2) run()
                }
                if (e.key === 'Escape') setOpen(false)
                if (e.key === 'Backspace' && !q && items.length) update(items.slice(0, -1))
              }}
              placeholder={items.length ? 'Thêm thuốc…' : 'Tìm tên thuốc, ví dụ: Amlodipin 5mg'}
              className="h-9 min-w-[180px] flex-1 bg-transparent text-base text-ink-900 outline-none placeholder:text-ink-400"
            />
          </div>

          {open && options.length > 0 && (
            <ul id={`${id}-list`} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 overflow-hidden rounded-xl border border-line-200 bg-surface p-1 shadow-e2">
              {options.map((o, i) => (
                <li
                  key={o.name + (o.free ? '-free' : '')}
                  id={`${id}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => (e.preventDefault(), add(o.name))}
                  onMouseEnter={() => setActive(i)}
                  className={cn('flex min-h-11 cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm', i === active ? 'bg-brand-50' : '')}
                >
                  {o.free ? <BadgeQuestionMark size={16} className="shrink-0 text-yellow-ink" aria-hidden /> : <Pill size={16} className="shrink-0 text-ink-600" aria-hidden />}
                  <span className="min-w-0 flex-1">
                    {o.free ? (
                      <>
                        Thêm “<span className="font-medium text-ink-900">{o.name}</span>”{' '}
                        <span className="text-ink-600">· chưa có trong cơ sở dữ liệu</span>
                      </>
                    ) : (
                      <span className={cn('font-medium', i === active ? 'text-brand-ink' : 'text-ink-900')}>{o.name}</span>
                    )}
                  </span>
                  {typedStrength ? (
                    <Mono className="text-[12px] text-ink-600">{typedStrength}</Mono>
                  ) : (
                    !o.free && STRENGTHS[o.name] && <Mono className="text-[12px] text-ink-600">{STRENGTHS[o.name].join(' · ')}</Mono>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-5 flex flex-col-reverse gap-2 border-t border-line-200 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-ink-600" aria-live="polite">
            {items.length < 2 ? (
              'Thêm ít nhất 2 thuốc để kiểm tra'
            ) : (
              <>
                <Mono>{items.length}</Mono> thuốc · <Mono>{(items.length * (items.length - 1)) / 2}</Mono> cặp sẽ được kiểm tra
              </>
            )}
          </p>
          <div className="flex gap-2">
            {items.length > 0 && (
              <Button variant="ghost" onClick={() => update([])}>
                Xóa tất cả
              </Button>
            )}
            <Button onClick={run} disabled={items.length < 2} className="flex-1 sm:flex-none sm:min-w-[200px]">
              Kiểm tra tương tác
            </Button>
          </div>
        </div>
      </Card>

      {checked && result ? (
        <section aria-labelledby="lookup-res" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 id="lookup-res" className="text-lg font-semibold text-ink-900">
              Kết quả kiểm tra
            </h2>
            <Button variant="ghost" size="sm" icon={<Pencil size={16} aria-hidden />} onClick={editList}>
              Sửa danh sách
            </Button>
          </div>

          {anyUnresolved && (
            <Banner
              tone="warning"
              icon={<BadgeQuestionMark size={20} />}
              action={
                <Button size="sm" variant="secondary" className="border-yellow-line" icon={<Pencil size={16} aria-hidden />} onClick={editList}>
                  Sửa tên thuốc
                </Button>
              }
            >
              {UNRESOLVED_BANNER}
            </Banner>
          )}

          {resolvedCount < 2 ? (
            <Banner tone="info" title="Cần ít nhất 2 thuốc đã nhận diện để kiểm tra tương tác.">
              Hiện có <Mono>{resolvedCount}</Mono> thuốc đã nhận diện.
            </Banner>
          ) : (
            <ul className="space-y-3">
              {result.pairs.map((p) => (
                <PairCard
                  key={p.a + p.b}
                  pair={p}
                  locked={anyUnresolved}
                  sa={checked.find((d) => d.name === p.a)?.strength}
                  sb={checked.find((d) => d.name === p.b)?.strength}
                />
              ))}
            </ul>
          )}

          <p className="flex gap-2.5 rounded-xl border border-line-200 bg-surface p-4 text-sm text-ink-900">
            <Info size={18} className="mt-0.5 shrink-0 text-ink-600" aria-hidden />
            Kết quả chỉ mang tính tham khảo. Hãy hỏi bác sĩ hoặc dược sĩ trước khi thay đổi cách dùng thuốc.
          </p>
        </section>
      ) : (
        <div className="space-y-4">
          {items.length >= 2 && (
            <Card>
              <EmptyState icon={<Search size={22} />} title="Sẵn sàng kiểm tra" body="Bấm “Kiểm tra tương tác” để đối chiếu từng cặp thuốc với cơ sở dữ liệu có nguồn dẫn." />
            </Card>
          )}

          {recentLookups.length > 0 && (
            <Card className="p-5 sm:p-6">
              <div className="flex items-center justify-between pb-3 border-b border-line-200">
                <div className="flex items-center gap-2">
                  <History size={18} className="text-brand-600" aria-hidden />
                  <h3 className="font-semibold text-ink-900">Tương tác đã tra gần đây</h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    localStorage.removeItem(RECENT_KEY)
                    setRecentLookups([])
                  }}
                  className="text-xs text-ink-500 hover:text-ink-900"
                >
                  Xóa lịch sử
                </Button>
              </div>
              <div className="mt-3 divide-y divide-line-100">
                {recentLookups.map((rec) => (
                  <div key={rec.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3">
                    <div>
                      <p className="font-medium text-ink-900 text-sm">{rec.label}</p>
                      <span className="text-xs text-ink-500">Tra cứu lúc {rec.at}</span>
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => applyLookup(rec.drugs)}
                      className="self-start sm:self-auto shrink-0"
                    >
                      Xem lại kết quả
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}
    </div>
  )
}

function toDrugs(items: Item[]): ResultDrug[] {
  return items.map((i) => ({ name: i.name, strength: i.strength, unresolved: i.unresolved }))
}

function DrugTag({ item, onStrength, onRemove }: { item: Item; onStrength: (s: string) => void; onRemove: () => void }) {
  const list = STRENGTHS[item.name] ?? []
  const opts = item.strength && !list.includes(item.strength) ? [item.strength, ...list] : list
  const u = item.unresolved
  return (
    <li className={cn('inline-flex h-9 items-stretch overflow-hidden rounded-full border text-sm', u ? 'border-yellow-line bg-yellow-bg text-yellow-ink' : 'border-brand-100 bg-brand-50 text-brand-ink')}>
      <span className="flex items-center gap-1.5 pl-3 pr-2 font-medium">
        {u ? <BadgeQuestionMark size={15} aria-label="Thuốc chưa nhận diện được" /> : <Pill size={15} aria-hidden />}
        {item.name}
      </span>
      <span className={cn('relative flex items-center border-l', u ? 'border-yellow-line/50' : 'border-brand-100')}>
        <label className="sr-only" htmlFor={`s-${item.id}`}>
          Hàm lượng của {item.name}
        </label>
        <select
          id={`s-${item.id}`}
          value={item.strength}
          onChange={(e) => onStrength(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          className={cn('h-full cursor-pointer appearance-none bg-transparent pr-7 pl-2.5 font-mono text-[13px] outline-none', !item.strength && 'text-ink-600')}
        >
          <option value="">Liều?</option>
          {opts.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="pointer-events-none absolute right-2" aria-hidden />
      </span>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onRemove()
        }}
        aria-label={`Bỏ ${item.name}`}
        className={cn('flex w-8 items-center justify-center border-l', u ? 'border-yellow-line/50 hover:bg-yellow-line/20' : 'border-brand-100 hover:bg-brand-100')}
      >
        <X size={14} />
      </button>
    </li>
  )
}
