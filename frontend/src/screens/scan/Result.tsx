import { useId, useState } from 'react'
import { BadgeQuestionMark, BookOpen, ChevronDown, FlaskConical, History, Info, Layers, MessageSquareText, Pencil, ShieldAlert } from 'lucide-react'
import { useApp } from '@/app/state'
import { type InteractionStatus, STATUS_ORDER, StatusPill } from '@/components/status'
import { BackButton, Banner, Button, Card, Mono } from '@/components/ui'
import { RxStatusControl } from '@/components/RxStatus'
import { fmtDate, fmtDayMonth, PRESCRIPTIONS, type ResultDrug, SAMPLE_RX, useData } from '@/data/db'
import { DRUG_INFO, lookupPair, type Pair, SOURCES } from '@/data/drugs'
import { cn } from '@/lib/cn'
import { setChatDraft } from '@/screens/Chat'
import { UNRESOLVED_BANNER } from './Confirm'

const SEV_ORDER = { major: 0, moderate: 1, minor: 2 }

/** All pairs, sorted FOUND (by severity) → UNRESOLVED → INSUFFICIENT → NO_KNOWN. */
export function buildPairs(drugs: ResultDrug[]) {
  const pairs: Pair[] = []
  for (let i = 0; i < drugs.length; i++)
    for (let j = i + 1; j < drugs.length; j++) pairs.push(lookupPair(drugs[i].name, drugs[j].name, !!(drugs[i].unresolved || drugs[j].unresolved)))
  pairs.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (SEV_ORDER[a.severity ?? 'minor'] ?? 3) - (SEV_ORDER[b.severity ?? 'minor'] ?? 3))
  const counts = pairs.reduce<Partial<Record<InteractionStatus, number>>>((c, p) => ((c[p.status] = (c[p.status] ?? 0) + 1), c), {})
  return { pairs, counts }
}

export function Result({
  drugs,
  rxId,
  onFix,
  onRestart,
  onBack,
  backLabel,
}: {
  drugs: ResultDrug[]
  /** Set when showing a saved prescription from history. */
  rxId?: string
  onFix: () => void
  onRestart: () => void
  onBack: () => void
  backLabel: string
}) {
  const { isGuest, openAuth, go } = useApp()
  const { rxStatus, prescriptions } = useData()
  const rx = prescriptions.find((p) => p.id === rxId) ?? PRESCRIPTIONS.find((p) => p.id === rxId)
  const ended = !!rx && rxStatus(rx.id) === 'ended'
  const anyUnresolved = drugs.some((d) => d.unresolved)
  const resolved = drugs.filter((d) => !d.unresolved)
  const { pairs, counts } = buildPairs(drugs)
  const strengthOf = (n: string) => drugs.find((d) => d.name === n)?.strength

  const hasClari = resolved.some((d) => d.name === 'Clarithromycin')
  const dupActiso = resolved.some((d) => d.name === 'Cao Actiso') && resolved.some((d) => d.name === 'Boganic')

  const rxDay = fmtDayMonth((rx ?? SAMPLE_RX).date)
  const askAssistant = (p: Pair) => {
    if (isGuest) return openAuth({ variant: 'guestGate', gate: 'Đăng ký để trò chuyện với trợ lý AI về đơn thuốc của bạn' })
    setChatDraft(`Giải thích cảnh báo tương tác giữa ${p.a} và ${p.b} trong đơn ${rxDay}`)
    go('chat', 'empty', 'scan')
  }

  return (
    <div className="space-y-6">
      <BackButton onClick={onBack}>{backLabel}</BackButton>
      {!isGuest && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p role="status" className="flex items-center gap-2 text-sm font-medium text-ink-900">
            <History size={18} className="text-brand-fg" aria-hidden />
            Đã lưu vào lịch sử
            <span className="font-normal text-ink-600">
              · <Mono>{fmtDate((rx ?? SAMPLE_RX).date)}</Mono> · {drugs.length} thuốc
            </span>
          </p>
          {rx && <RxStatusControl rx={rx} />}
        </div>
      )}

      {resolved.length >= 2 && <SummaryBar pairs={pairs} muted={ended} />}

      {anyUnresolved && (
        <div className="sticky top-[120px] z-20 lg:top-[76px]">
          <Banner
            tone="warning"
            icon={<BadgeQuestionMark size={20} />}
            className="shadow-e1"
            action={
              <Button size="sm" variant="secondary" icon={<Pencil size={16} aria-hidden />} onClick={onFix} className="border-yellow-line">
                Sửa tên thuốc
              </Button>
            }
          >
            {UNRESOLVED_BANNER}
          </Banner>
        </div>
      )}

      <section aria-labelledby="sec-ddi">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="sec-ddi" className="text-lg font-semibold text-ink-900">
            Kiểm tra tương tác
          </h2>
          {resolved.length >= 2 && (
            <p className="text-sm text-ink-600">
              <Mono>{pairs.length}</Mono> cặp thuốc
              {counts.INTERACTION_FOUND ? (
                <>
                  {' '}
                  · <Mono>{counts.INTERACTION_FOUND}</Mono> có tương tác
                </>
              ) : null}
            </p>
          )}
        </div>

        {resolved.length < 2 ? (
          <Banner tone="info" title="Cần ít nhất 2 thuốc đã nhận diện để kiểm tra tương tác.">
            Hiện có <Mono>{resolved.length}</Mono> thuốc đã nhận diện. Sửa tên thuốc chưa rõ hoặc thêm thuốc để tiếp tục.
          </Banner>
        ) : (
          <ul className="space-y-3">
            {pairs.map((p) => (
              <InteractionCard key={p.a + p.b} pair={p} locked={anyUnresolved} muted={ended} sa={strengthOf(p.a)} sb={strengthOf(p.b)} onAsk={() => askAssistant(p)} />
            ))}
          </ul>
        )}

        {(hasClari || dupActiso) && (
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {dupActiso && (
              <P1Card icon={<Layers size={18} />} title="Trùng hoạt chất">
                <span className="font-medium text-ink-900">Cao Actiso</span> và <span className="font-medium text-ink-900">Boganic</span> cùng chứa cao Actiso. Hỏi dược sĩ trước khi dùng cả hai.
              </P1Card>
            )}
            {hasClari && (
              <P1Card icon={<ShieldAlert size={18} />} title="Có thể xung đột với dị ứng đã khai báo">
                <span className="font-medium text-ink-900">Clarithromycin</span> thuộc nhóm macrolid. Hồ sơ của bạn ghi dị ứng với <span className="font-medium text-ink-900">Erythromycin</span> (cùng nhóm).
              </P1Card>
            )}
          </div>
        )}
      </section>

      {isGuest && (
        <Card className="flex flex-col gap-4 border-brand-100 bg-brand-50 p-5 sm:flex-row sm:items-center">
          <Info size={22} className="shrink-0 text-brand-fg" aria-hidden />
          <p className="flex-1 text-[15px] font-medium text-ink-900">Đăng ký để lưu đơn thuốc này vào lịch sử của bạn</p>
          <Button onClick={() => openAuth({ variant: 'guestGate', gate: 'Đăng ký để lưu đơn thuốc này vào lịch sử của bạn' })}>Đăng ký</Button>
        </Card>
      )}

      <section aria-labelledby="sec-drugs">
        <h2 id="sec-drugs" className="mb-3 text-lg font-semibold text-ink-900">
          Thông tin thuốc
        </h2>
        <Card className="divide-y divide-line-200 overflow-hidden">
          {drugs.map((d) => (
            <DrugAccordion key={d.name} drug={d} onFix={onFix} />
          ))}
        </Card>
      </section>

      <footer className="space-y-4 rounded-xl border border-line-200 bg-surface p-5">
        <p className="flex gap-2.5 text-sm text-ink-900">
          <Info size={18} className="mt-0.5 shrink-0 text-ink-600" aria-hidden />
          Kết quả chỉ mang tính tham khảo. Hãy hỏi bác sĩ hoặc dược sĩ trước khi thay đổi cách dùng thuốc.
        </p>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            variant="secondary"
            icon={<MessageSquareText size={18} aria-hidden />}
            onClick={() => (isGuest ? openAuth({ variant: 'guestGate', gate: 'Đăng ký để trò chuyện với trợ lý AI về đơn thuốc của bạn' }) : go('chat', 'conversation'))}
          >
            Hỏi trợ lý về đơn này
          </Button>
          <Button onClick={() => (isGuest ? onRestart() : go('dashboard'))} className="sm:min-w-[140px]">
            Hoàn tất
          </Button>
        </div>
      </footer>
    </div>
  )
}

const SEV_WORD = { major: 'nghiêm trọng', moderate: 'trung bình', minor: 'nhẹ' } as const

/** Top-of-page summary: the most important status + counts per severity, all derived from `pairs` (already sorted). */
function SummaryBar({ pairs, muted }: { pairs: Pair[]; muted: boolean }) {
  const found = pairs.filter((p) => p.status === 'INTERACTION_FOUND')
  const top = pairs[0]
  return (
    <section aria-label="Tóm tắt kết quả" className="flex flex-col gap-3 rounded-xl border border-line-200 bg-surface p-4 shadow-e1 sm:flex-row sm:items-center sm:p-5">
      <StatusPill status={top.status} severity={top.severity} muted={muted} showSubline={found.length === 0} />
      {found.length > 0 && (
        <p className="text-[15px] font-semibold text-ink-900">
          Phát hiện <Mono>{found.length}</Mono> tương tác
          {(['major', 'moderate', 'minor'] as const).map((s) => {
            const n = found.filter((p) => p.severity === s).length
            return n ? (
              <span key={s} className="font-medium">
                {' '}
                · <Mono>{n}</Mono> {SEV_WORD[s]}
              </span>
            ) : null
          })}
        </p>
      )}
    </section>
  )
}

const DOCTOR_QUESTIONS = [
  'Tôi có cần theo dõi triệu chứng nào khi dùng hai thuốc này không?',
  'Có cách nào dùng hai thuốc này an toàn hơn không?',
  'Hai thuốc này có ảnh hưởng gì đến các bệnh tôi đang có không?',
]

/** Collapsed-by-default section with a 44px toggle. */
function Disclosure({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <div className="border-t border-line-200">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={id} className="flex min-h-11 w-full items-center justify-between gap-3 py-2 text-left text-sm font-semibold text-ink-900 hover:text-brand-ink">
        {title}
        <ChevronDown size={18} className={cn('shrink-0 text-ink-600 transition-transform duration-150', open && 'rotate-180')} aria-hidden />
      </button>
      {open && (
        <div id={id} className="pb-3">
          {children}
        </div>
      )}
    </div>
  )
}

/** Step 4 interaction card: pair + pill, plain sentence, what to do, then collapsed detail sections. */
function InteractionCard({ pair, locked, muted, sa, sb, onAsk }: { pair: Pair; locked: boolean; muted: boolean; sa?: string; sb?: string; onAsk: () => void }) {
  const [quotes, setQuotes] = useState(false)
  const isLocked = locked && pair.status === 'NO_KNOWN_INTERACTION'
  const found = pair.status === 'INTERACTION_FOUND'
  const plain = isLocked ? 'Chưa thể kết luận vì đơn còn thuốc chưa nhận diện được. Sửa tên thuốc để xem kết quả đầy đủ.' : (pair.plain ?? pair.text)
  const technical = !isLocked && pair.plain ? pair.text : null
  return (
    <li className={cn('rounded-xl border border-l-[3px] border-line-200 bg-surface px-4 pt-4 pb-1 shadow-e1 sm:px-5 sm:pt-5', isLocked || (muted && found) ? 'border-l-gray-line' : ACCENT[pair.status])}>
      <div className="flex flex-col gap-2.5">
        <p className="text-[15px] font-semibold text-ink-900">
          {pair.a} {sa && <Mono className="font-normal text-ink-600">{sa}</Mono>} <span className="px-1 text-ink-400">+</span> {pair.b}{' '}
          {sb && <Mono className="font-normal text-ink-600">{sb}</Mono>}
        </p>
        <div>
          <StatusPill status={pair.status} severity={pair.severity} locked={isLocked} showSubline={!isLocked} muted={muted} />
        </div>
      </div>
      <p className="mt-3 text-[15px] text-ink-900">{plain}</p>
      <p className="mt-2 text-sm text-ink-900">
        <span className="font-semibold">Việc nên làm:</span> Hỏi bác sĩ hoặc dược sĩ trước khi dùng cùng nhau.
      </p>
      {pair.sources.length > 0 && (
        <p className="mt-2 text-xs text-ink-600">
          Nguồn:{' '}
          {pair.sources.map((s, i) => (
            <span key={s}>
              {i > 0 && ' · '}
              <Mono className="font-medium text-brand-ink">[{i + 1}]</Mono> {SOURCES[s].title}
            </span>
          ))}
        </p>
      )}

      <div className="mt-3">
        {(technical || pair.sources.length > 0) && (
          <Disclosure title="Chi tiết chuyên môn">
            {technical && <p className="text-sm text-ink-900">{technical}</p>}
            {pair.sources.length > 0 && (
              <div className={cn('flex flex-wrap items-center gap-2 overflow-x-auto no-scrollbar', technical && 'mt-3')}>
                {pair.sources.map((s, i) => (
                  <SourceChip key={s} id={s} n={i + 1} />
                ))}
                <Button variant="ghost" size="sm" className="h-11" onClick={() => setQuotes((o) => !o)} aria-expanded={quotes} iconRight={<ChevronDown size={16} className={cn('transition-transform', quotes && 'rotate-180')} aria-hidden />}>
                  {quotes ? 'Ẩn trích dẫn' : 'Xem trích dẫn'}
                </Button>
              </div>
            )}
            {quotes && (
              <div className="mt-3 space-y-2">
                {pair.sources.map((s, i) => (
                  <blockquote key={s} className="rounded-lg bg-bg-50 p-3 text-sm text-ink-900">
                    <p className="mb-1 text-[12px] font-medium text-ink-600">
                      <Mono>[{i + 1}]</Mono> {SOURCES[s].title} · phiên bản <Mono>{SOURCES[s].version}</Mono>
                    </p>
                    “{SOURCES[s].excerpt}”
                  </blockquote>
                ))}
              </div>
            )}
          </Disclosure>
        )}
        {found && (pair.severity === 'major' || pair.severity === 'moderate') && (
          <Disclosure title="Câu hỏi nên hỏi bác sĩ">
            <ul className="list-disc space-y-1.5 pl-5 text-sm text-ink-900">
              {DOCTOR_QUESTIONS.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </Disclosure>
        )}
        {found && pair.severity === 'major' && (
          <div className="border-t border-line-200 py-2">
            <Button variant="ghost" className="-ml-3" icon={<MessageSquareText size={18} aria-hidden />} onClick={onAsk}>
              Hỏi trợ lý về cảnh báo này
            </Button>
          </div>
        )}
      </div>
    </li>
  )
}

export function SourceChip({ id, n }: { id: string; n?: number }) {
  const s = SOURCES[id]
  return (
    <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line-200 bg-bg-50 px-2.5 text-[12px] text-ink-600" aria-label={`Nguồn: ${s.title}, phiên bản ${s.version}`}>
      {n !== undefined ? <Mono className="font-medium text-brand-ink">[{n}]</Mono> : <BookOpen size={13} aria-hidden />}
      <span>
        Nguồn: <span className="font-medium text-ink-900">{s.title}</span> · phiên bản <Mono>{s.version}</Mono>
      </span>
    </span>
  )
}

function DrugAccordion({ drug, onFix }: { drug: ResultDrug; onFix: () => void }) {
  const [open, setOpen] = useState(false)
  const info = DRUG_INFO[drug.name]
  const pid = `acc-${drug.name.replace(/\W/g, '')}`
  return (
    <div>
      <h3>
        <button onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={pid} className="flex min-h-14 w-full items-center gap-3 px-5 py-3 text-left hover:bg-bg-50">
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1.5">
            <span>
              <span className="text-[15px] font-semibold text-ink-900">{drug.name}</span> <Mono className="text-sm text-ink-600">{drug.strength}</Mono>
            </span>
            {drug.unresolved && <StatusPill status="UNRESOLVED_DRUG" size="sm" />}
          </span>
          <ChevronDown size={18} className={cn('shrink-0 text-ink-600 transition-transform duration-150', open && 'rotate-180')} aria-hidden />
        </button>
      </h3>
      {open && (
        <div id={pid} className="px-5 pb-5">
          {drug.unresolved || !info ? (
            <div className="flex flex-col gap-3 rounded-lg bg-yellow-bg p-4 text-sm text-yellow-ink sm:flex-row sm:items-center">
              <p className="flex-1">Chưa có thông tin vì thuốc chưa nhận diện được.</p>
              <Button size="sm" variant="secondary" onClick={onFix} className="border-yellow-line">
                Sửa tên thuốc
              </Button>
            </div>
          ) : (
            <>
              <dl className="grid gap-3 text-sm sm:grid-cols-[140px_1fr]">
                <dt className="text-ink-600">Hoạt chất</dt>
                <dd className="font-medium text-ink-900">{info.ingredient}</dd>
                <dt className="text-ink-600">Công dụng</dt>
                <dd className="text-ink-900">{info.uses}</dd>
              </dl>
              <div className="mt-4">
                <SourceChip id={info.source} />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

const ACCENT: Record<InteractionStatus, string> = {
  INTERACTION_FOUND: 'border-l-red-line',
  UNRESOLVED_DRUG: 'border-l-yellow-line',
  INSUFFICIENT_DATA: 'border-l-gray-line',
  NO_KNOWN_INTERACTION: 'border-l-slate-line',
}

export function PairCard({ pair, locked, muted, sa, sb }: { pair: Pair; locked: boolean; muted?: boolean; sa?: string; sb?: string }) {
  const [open, setOpen] = useState(false)
  const isLocked = locked && pair.status === 'NO_KNOWN_INTERACTION'
  return (
    <li className={cn('rounded-xl border border-l-[3px] border-line-200 bg-surface p-4 shadow-e1 sm:p-5', isLocked || (muted && pair.status === 'INTERACTION_FOUND') ? 'border-l-gray-line' : ACCENT[pair.status])}>
      <p className="text-[15px] font-semibold text-ink-900">
        {pair.a} {sa && <Mono className="font-normal text-ink-600">{sa}</Mono>} <span className="px-1 text-ink-400">+</span> {pair.b}{' '}
        {sb && <Mono className="font-normal text-ink-600">{sb}</Mono>}
      </p>
      <div className="mt-2.5">
        <StatusPill status={pair.status} severity={pair.severity} locked={isLocked} showSubline={!isLocked} muted={muted} />
      </div>
      <p className="mt-2.5 text-sm text-ink-900">
        {isLocked ? 'Chưa thể kết luận vì đơn còn thuốc chưa nhận diện được. Sửa tên thuốc để xem kết quả đầy đủ.' : pair.text}
      </p>
      {pair.sources.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {pair.sources.map((s, i) => (
            <SourceChip key={s} id={s} n={i + 1} />
          ))}
          <Button variant="ghost" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} iconRight={<ChevronDown size={16} className={cn('transition-transform', open && 'rotate-180')} aria-hidden />}>
            {open ? 'Ẩn trích dẫn' : 'Xem trích dẫn'}
          </Button>
        </div>
      )}
      {open && (
        <div className="mt-3 space-y-2">
          {pair.sources.map((s, i) => (
            <blockquote key={s} className="rounded-lg bg-bg-50 p-3 text-sm text-ink-900">
              <p className="mb-1 text-[12px] font-medium text-ink-600">
                <Mono>[{i + 1}]</Mono> {SOURCES[s].title} · phiên bản <Mono>{SOURCES[s].version}</Mono>
              </p>
              “{SOURCES[s].excerpt}”
            </blockquote>
          ))}
        </div>
      )}
    </li>
  )
}

function P1Card({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border-[1.5px] border-dashed border-ink-400 bg-surface p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-ink-900" aria-hidden>
          {icon}
        </span>
        <p className="flex-1 text-sm font-semibold text-ink-900">{title}</p>
        <span className="inline-flex h-5 items-center gap-1 rounded-full bg-line-100 px-2 text-xs font-medium text-ink-600">
          <FlaskConical size={12} aria-hidden />
          Thử nghiệm
        </span>
      </div>
      <p className="text-sm text-ink-600">{children}</p>
    </div>
  )
}
