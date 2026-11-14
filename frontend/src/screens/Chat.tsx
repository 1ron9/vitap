import { useEffect, useId, useRef, useState } from 'react'
import { ArrowUp, Check, CircleHelp, Info, Lock, MessageSquareText, PanelLeftClose, PanelLeftOpen, Phone, Plus, RefreshCw, Siren, Trash2, X } from 'lucide-react'
import { useApp } from '@/app/state'
import { chatApi } from '@/api/client'
import { Mark } from '@/components/brand'
import { Button, Card, IconButton, Modal } from '@/components/ui'
import { fmtDayMonth, pairsOf, type Prescription, severeInteractions, useData, type UserProfileData } from '@/data/db'
import { DRUG_INFO, lookupPair, type Pair, SOURCES } from '@/data/drugs'
import { cn } from '@/lib/cn'

type Msg =
  | { id: string; kind: 'user'; text: string; failed?: boolean }
  | { id: string; kind: 'assistant'; parts: (string | { cite: number })[]; sources: string[] }
  | { id: string; kind: 'refusal' | 'insufficient' | 'emergency' }

type ContextKey = 'allergy' | 'activeRx' | 'interactions'
const CONTEXTS: { key: ContextKey; label: string }[] = [
  { key: 'allergy', label: 'Dị ứng' },
  { key: 'activeRx', label: 'Thuốc từ đơn đã lưu' },
  { key: 'interactions', label: 'Kết quả tương tác' },
]

function generateAssistantResponse(
  question: string,
  prescriptions: Prescription[],
  profile: UserProfileData,
  contexts: Record<ContextKey, boolean>,
): Msg {
  const q = question.toLowerCase().trim()
  const id = `m${Date.now()}`

  // 1. Clinical safety: Immediate emergency redirect
  if (/khó thở|sưng môi|sưng mặt|ngất|co giật|đau ngực|tức ngực|sốc phản vệ|nôn ra máu|bầm tím diện rộng/.test(q)) {
    return { id, kind: 'emergency' }
  }

  // 2. Clinical safety: Refusal to diagnose, prescribe, change dosage or discontinue medication
  if (/ngừng thuốc|bỏ thuốc|đổi liều|giảm liều|tăng liều|uống nửa viên|bớt thuốc|chẩn đoán|tôi có bị bệnh|tôi mắc bệnh/.test(q)) {
    return { id, kind: 'refusal' }
  }

  // 3. User inquiries about active prescription / medications
  if (/đơn|thuốc trong đơn|đơn của tôi|toa thuốc|đang uống/.test(q)) {
    if (!contexts.activeRx) {
      return {
        id,
        kind: 'assistant',
        sources: ['dtqg'],
        parts: ['Bạn đã tắt ngữ cảnh "Thuốc từ đơn đã lưu". Hãy bật lại nút ngữ cảnh này dưới khung nhập để trợ lý có thể đọc đơn thuốc của bạn.'],
      }
    }

    if (!prescriptions || prescriptions.length === 0) {
      return {
        id,
        kind: 'assistant',
        sources: ['dtqg'],
        parts: [
          'Hiện tại tài khoản của bạn chưa có đơn thuốc nào được lưu.\n\nBạn có thể chụp ảnh hoặc nhập tay đơn thuốc ở mục Kiểm tra thuốc để tôi có thể phân tích chi tiết công dụng và tương tác thuốc nhé!',
        ],
      }
    }

    const rx = prescriptions[0]
    const dateStr = fmtDayMonth(rx.date)
    const placeStr = rx.place ? ` tại ${rx.place}` : ''
    const drugLines = rx.drugs.map((d) => {
      const info = DRUG_INFO[d.name]
      const uses = info ? info.uses : 'Thuốc dùng theo chỉ định của bác sĩ điều trị.'
      return `• **${d.name}**${d.strength ? ` (${d.strength})` : ''}: ${uses}`
    })

    const pairs = pairsOf(rx.drugs)
    const severePairs = pairs.filter((p: Pair) => p.status === 'INTERACTION_FOUND' && (p.severity === 'major' || p.severity === 'moderate'))
    let alertMsg = ''
    if (contexts.interactions && severePairs.length > 0) {
      const p = severePairs[0]
      alertMsg = `\n\n⚠️ **Lưu ý tương tác**: Ghi nhận tương tác giữa **${p.a}** và **${p.b}** (${p.plain || p.text}). Bạn nên lưu ý báo cho bác sĩ điều trị.`
    }

    return {
      id,
      kind: 'assistant',
      sources: ['dtqg', 'stockley'],
      parts: [
        `Trong đơn thuốc ngày ${dateStr}${placeStr}, bạn có ${rx.drugs.length} thuốc:\n\n` +
          drugLines.join('\n') +
          alertMsg +
          `\n\n*Lưu ý: Luôn tuân thủ đúng liều lượng bác sĩ kê đơn. Không tự ý ngưng hoặc thay đổi liều dùng.*`,
      ],
    }
  }

  // 4. Inquiries comparing two specific drugs or asking about interactions
  if (/tương tác|uống cùng|uống chung|uống kèm|kết hợp/.test(q)) {
    const matched = Object.keys(DRUG_INFO).filter((name) => q.includes(name.toLowerCase()))
    if (matched.length >= 2) {
      const [d1, d2] = matched
      const pair = lookupPair(d1, d2, false)
      if (pair.status === 'INTERACTION_FOUND') {
        const sevVi = pair.severity === 'major' ? 'nghiêm trọng' : pair.severity === 'moderate' ? 'trung bình' : 'nhẹ'
        return {
          id,
          kind: 'assistant',
          sources: pair.sources || ['dtqg', 'stockley'],
          parts: [
            `Giữa **${pair.a}** và **${pair.b}** có ghi nhận tương tác mức **${sevVi}** `,
            { cite: 1 },
            `:\n\n${pair.text}\n\n${pair.plain ? `Khuyến cáo: ${pair.plain}` : ''}\n\nHãy tham khảo ý kiến bác sĩ hoặc dược sĩ trước khi phối hợp hai thuốc này để được hướng dẫn thời gian uống thích hợp.`,
          ],
        }
      } else {
        return {
          id,
          kind: 'assistant',
          sources: pair.sources || ['bnf'],
          parts: [
            `Theo Dược thư Quốc gia và các nguồn tham khảo y khoa, hiện chưa ghi nhận tương tác có ý nghĩa lâm sàng đáng kể giữa **${pair.a}** và **${pair.b}** `,
            { cite: 1 },
            `.\n\nBạn vẫn nên duy trì uống thuốc theo đúng chỉ dẫn của bác sĩ điều trị.`,
          ],
        }
      }
    }
  }

  // 5. Inquiries about a specific known drug
  const singleMatch = Object.keys(DRUG_INFO).find((name) => q.includes(name.toLowerCase()))
  if (singleMatch) {
    const info = DRUG_INFO[singleMatch]
    return {
      id,
      kind: 'assistant',
      sources: [info.source || 'dtqg'],
      parts: [
        `**${singleMatch}** (hoạt chất: *${info.ingredient}*):\n\n` +
          `• **Công dụng**: ${info.uses}\n` +
          `• **Nguồn tham khảo**: `,
        { cite: 1 },
        `\n\n*Khuyến cáo*: Uống thuốc với nước lọc, đúng giờ quy định và không tự ý thay đổi cách dùng đã được bác sĩ dặn dò.`,
      ],
    }
  }

  // 6. Insufficient evidence / herbal supplements
  if (/boganic|actiso|men vi sinh|thảo dược|thuốc nam|thực phẩm chức năng/.test(q)) {
    return { id, kind: 'insufficient' }
  }

  // 7. General evidence-based clinical guidance
  return {
    id,
    kind: 'assistant',
    sources: ['dtqg', 'bnf'],
    parts: [
      `Cảm ơn câu hỏi của bạn. Theo hướng dẫn từ Dược thư Quốc gia Việt Nam `,
      { cite: 1 },
      `: việc sử dụng thuốc cần đúng chỉ định, đúng thời điểm và đủ liệu trình.\n\nNếu bạn muốn kiểm tra công dụng hoặc tương tác cụ thể của các thuốc đang dùng, bạn có thể gõ trực tiếp tên thuốc (ví dụ "Amlodipin và Simvastatin có uống chung được không?") hoặc tải đơn thuốc lên ở mục Kiểm tra thuốc nhé.`,
    ],
  }
}

export function Chat() {
  const { isGuest, openAuth } = useApp()
  if (isGuest)
    return (
      <div className="flex min-h-[70dvh] items-center justify-center px-4">
        <div className="w-full max-w-md rounded-2xl border border-brand-100 bg-brand-50 p-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-surface text-brand-fg">
            <Lock size={22} aria-hidden />
          </div>
          <h1 className="text-lg font-semibold text-ink-900">Đăng nhập để trò chuyện với trợ lý AI</h1>
          <p className="mt-1.5 text-sm text-ink-600">Trợ lý trả lời dựa trên đơn thuốc đã lưu và hồ sơ sức khỏe của bạn, luôn kèm nguồn dẫn.</p>
          <Button className="mt-5" onClick={() => openAuth({ variant: 'guestGate', gate: 'Đăng ký để trò chuyện với trợ lý AI về đơn thuốc của bạn' })}>
            Đăng nhập / Đăng ký
          </Button>
        </div>
      </div>
    )
  return <ChatInner />
}

type Session = { id: string; title: string; group: 'today' | 'week' | 'older'; date: string; msgs: Msg[] }

const GROUP_LABEL: Record<Session['group'], string> = { today: 'Hôm nay', week: '7 ngày qua', older: 'Cũ hơn' }

function getSessionStorageKey(email: string | null): string {
  return email ? `vitap-chat-sessions-${email}` : 'vitap-chat-sessions-guest'
}

function loadSavedSessions(email: string | null): Session[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(getSessionStorageKey(email))
    if (!raw) return []
    return JSON.parse(raw)
  } catch {
    return []
  }
}

function persistSessions(email: string | null, list: Session[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(getSessionStorageKey(email), JSON.stringify(list))
  } catch {}
}

const isDesktop = () => (typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches) || false

/** Text to prefill in the input of the next new session (set by other screens before navigating here). */
let pendingDraft = ''
export function setChatDraft(text: string) {
  pendingDraft = text
}

function ChatInner() {
  const { rxStatus, prescriptions, profile, currentUserEmail } = useData()
  const alerts = severeInteractions(rxStatus, prescriptions)
  const severePrompt = alerts.length > 0 ? `Giải thích cảnh báo tương tác trong đơn ${fmtDayMonth(alerts[0].rx.date)}` : null
  const suggestions =
    prescriptions.length > 0
      ? severePrompt
        ? [severePrompt, 'Thuốc trong đơn của tôi dùng để làm gì?', 'Các thuốc này uống cùng nhau cần lưu ý gì?']
        : ['Thuốc trong đơn của tôi dùng để làm gì?', 'Các thuốc này uống cùng nhau cần lưu ý gì?']
      : [
          'Lưu ý khi sử dụng thuốc hạ huyết áp',
          'Thuốc giảm đau Paracetamol dùng thế nào cho an toàn?',
          'Dấu hiệu tương tác thuốc thường gặp là gì?',
        ]

  const [sessions, setSessions] = useState<Session[]>(() => loadSavedSessions(currentUserEmail))
  const [activeId, setActiveId] = useState<string>('new')
  const [typingId, setTypingId] = useState<string | null>(null)
  const [text, setText] = useState(() => pendingDraft)
  const [failNext, setFailNext] = useState(false)
  const [drawer, setDrawer] = useState<{ sources: string[]; focus: number } | null>(null)
  const [sidebar, setSidebar] = useState(true)
  const [mobileList, setMobileList] = useState(false)
  const [contexts, setContexts] = useState<Record<ContextKey, boolean>>({
    allergy: true,
    activeRx: true,
    interactions: true,
  })
  const scroller = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  const toggleContext = (key: ContextKey) => {
    setContexts((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const active = sessions.find((x) => x.id === activeId)
  const msgs = active?.msgs ?? []
  const typing = typingId === activeId
  const paused = msgs.some((m) => m.kind === 'emergency')

  const patch = (sid: string, fn: (m: Msg[]) => Msg[]) => {
    setSessions((l) => {
      const next = l.map((x) => (x.id === sid ? { ...x, msgs: fn(x.msgs) } : x))
      persistSessions(currentUserEmail, next)
      return next
    })
  }

  useEffect(() => {
    if (!pendingDraft) return
    setText(pendingDraft)
    pendingDraft = ''
    const el = inputRef.current
    if (el) {
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }, [])

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })
  }, [msgs.length, typing, activeId])

  useEffect(() => {
    const loaded = loadSavedSessions(currentUserEmail)
    setSessions(loaded)
    setActiveId('new')
  }, [currentUserEmail])

  const respond = async (sid: string, q: string) => {
    // 1. Clinical safety: Immediate client-side check for life-threatening emergency or refusal
    const early = generateAssistantResponse(q, prescriptions, profile, contexts)
    if (early.kind === 'emergency' || early.kind === 'refusal') {
      setTypingId(sid)
      setTimeout(() => {
        setTypingId((t) => (t === sid ? null : t))
        patch(sid, (m) => [...m, early])
      }, 500)
      return
    }

    setTypingId(sid)
    try {
      const res = await chatApi.sendMessage(sid, {
        content: q,
        context: {
          allergy: contexts.allergy,
          activeRx: contexts.activeRx,
          interactions: contexts.interactions,
        },
      })
      setTypingId((t) => (t === sid ? null : t))
      const sources = res.sources && res.sources.length ? res.sources : ['dtqg', 'stockley']
      patch(sid, (m) => [
        ...m,
        {
          id: res.id,
          kind: 'assistant',
          sources,
          parts: [res.content],
        },
      ])
    } catch {
      setTimeout(() => {
        setTypingId((t) => (t === sid ? null : t))
        patch(sid, (m) => [...m, generateAssistantResponse(q, prescriptions, profile, contexts)])
      }, 700)
    }
  }

  const send = (q: string) => {
    const t = q.trim()
    if (!t || paused || typing) return
    const mid = `u${Date.now()}`
    let sid = activeId
    if (activeId === 'new' || !active) {
      sid = `s${Date.now()}`
      const newSession: Session = {
        id: sid,
        title: t.length > 40 ? t.slice(0, 39) + '…' : t,
        group: 'today',
        date: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
        msgs: [],
      }
      setSessions((l) => {
        const next = [newSession, ...l]
        persistSessions(currentUserEmail, next)
        return next
      })
      setActiveId(sid)
    }
    setText('')
    const failed = failNext
    setFailNext(false)
    setTimeout(() => {
      patch(sid, (m) => [...m, { id: mid, kind: 'user', text: t, failed }])
      if (!failed) respond(sid, t)
    }, 20)
  }

  const resend = (id: string) => {
    const m = msgs.find((x) => x.id === id)
    if (!m || m.kind !== 'user') return
    patch(activeId, (list) => list.map((x) => (x.id === id ? { ...x, failed: false } : x)))
    respond(activeId, m.text)
  }

  const newSession = () => {
    setActiveId('new')
    setMobileList(false)
    setTimeout(() => inputRef.current?.focus())
  }
  const open = (sid: string) => {
    setActiveId(sid)
    setMobileList(false)
  }
  const remove = (sid: string) => {
    setSessions((l) => {
      const next = l.filter((x) => x.id !== sid)
      persistSessions(currentUserEmail, next)
      return next
    })
    if (sid === activeId) setActiveId('new')
  }

  const list = <SessionList sessions={sessions} activeId={activeId} onOpen={open} onNew={newSession} onRemove={remove} />
  const toggleLabel = sidebar ? 'Đóng thanh lịch sử' : 'Mở thanh lịch sử'

  return (
    <div className="flex h-[calc(100dvh-114px)] lg:h-[calc(100dvh-65px)]">
      {sidebar && (
        <aside aria-label="Lịch sử trò chuyện" className="hidden w-72 shrink-0 flex-col border-r border-line-200 bg-surface lg:flex">
          {list}
        </aside>
      )}

      <section className="flex min-w-0 flex-1 flex-col" aria-label="Trợ lý AI">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-line-200 px-2 sm:px-4">
          <IconButton
            label="Lịch sử trò chuyện"
            className="lg:hidden"
            aria-expanded={mobileList}
            onClick={() => setMobileList(true)}
          >
            <PanelLeftOpen size={20} />
          </IconButton>
          <span className="hidden lg:block">
            <IconButton label={toggleLabel} aria-expanded={sidebar} onClick={() => (isDesktop() ? setSidebar((x) => !x) : setMobileList(true))}>
              {sidebar ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
            </IconButton>
          </span>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-ink-900 sm:text-lg">
            Trợ lý AI
            <span className="font-normal text-ink-600"> · {active ? active.title : 'Phiên mới'}</span>
          </h1>
          <span className={cn(sidebar && 'lg:hidden')}>
            <Button variant="secondary" size="sm" icon={<Plus size={16} aria-hidden />} onClick={newSession} aria-label="Phiên mới">
              <span className="max-sm:sr-only">Phiên mới</span>
            </Button>
          </span>
        </div>

        <div ref={scroller} className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[720px] space-y-4 px-4 py-6" aria-live="polite" aria-label="Cuộc trò chuyện">
            {msgs.length === 0 && (
              <div className="flex flex-col items-center px-4 pt-8 pb-6 text-center">
                <Mark size={44} />
                <p className="mt-4 text-lg font-semibold text-ink-900">Bạn muốn hỏi gì về thuốc của mình?</p>
                <p className="mt-1 max-w-sm text-sm text-ink-600">Mỗi câu trả lời đều kèm nguồn dẫn. Trợ lý không chẩn đoán và không thay đổi đơn thuốc.</p>
                <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto">
                  {suggestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => send(q)}
                      className="flex min-h-11 items-center gap-2.5 rounded-xl border border-line-200 bg-surface px-4 py-2.5 text-left text-sm font-medium text-ink-900 shadow-e1 transition-colors hover:border-brand-600 hover:bg-brand-50"
                    >
                      <MessageSquareText size={16} className="shrink-0 text-brand-fg" aria-hidden />
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {msgs.map((m) => (
              <Bubble key={m.id} m={m} onCite={(sources, focus) => setDrawer({ sources, focus })} onResend={resend} />
            ))}

            {typing && (
              <div className="flex items-center gap-2" role="status" aria-label="Trợ lý đang trả lời">
                <Mark size={28} />
                <div className="flex h-10 items-center gap-1 rounded-2xl rounded-tl-md border border-line-200 bg-surface px-4">
                  {[0, 1, 2].map((i) => (
                    <span key={i} className="h-1.5 w-1.5 animate-bounce rounded-full bg-ink-400" style={{ animationDelay: `${i * 140}ms` }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="shrink-0 border-t border-line-200 bg-bg-50">
          <div className="mx-auto max-w-[720px] px-4 pt-3 pb-3">
            <div className={cn('transition-opacity duration-150', paused && 'opacity-50')}>
              <div className="no-scrollbar mb-2 flex items-center gap-1.5 overflow-x-auto" aria-label="Dữ liệu trợ lý đang dùng">
                <span className="shrink-0 text-xs text-ink-600">Đang dùng:</span>
                {CONTEXTS.map(({ key, label }) => {
                  const active = contexts[key]
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => toggleContext(key)}
                      aria-pressed={active}
                      title="Trợ lý sẽ dùng thông tin này khi trả lời"
                      className={cn(
                        'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-medium transition-colors',
                        active
                          ? 'border border-brand-200 bg-brand-50 text-brand-ink'
                          : 'border border-line-200 bg-surface text-ink-400 opacity-70 hover:opacity-100',
                      )}
                    >
                      {active && <Check size={12} className="text-brand-fg" aria-hidden />}
                      {label}
                    </button>
                  )
                })}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  send(text)
                }}
                className="flex items-end gap-2 rounded-2xl border border-line-200 bg-surface p-1.5 pl-4 shadow-e1 focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20"
              >
                <label htmlFor="chat-input" className="sr-only">
                  Nhập câu hỏi
                </label>
                <textarea
                  ref={inputRef}
                  id="chat-input"
                  rows={1}
                  value={text}
                  disabled={paused}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      send(text)
                    }
                  }}
                  placeholder={paused ? 'Cuộc trò chuyện thường được tạm dừng' : 'Hỏi về thuốc trong đơn của bạn…'}
                  className="max-h-32 min-h-10 flex-1 resize-none bg-transparent py-2 text-base text-ink-900 outline-none placeholder:text-ink-400 disabled:cursor-not-allowed"
                />
                <button
                  type="submit"
                  disabled={!text.trim() || paused || typing}
                  aria-label="Gửi"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white transition-colors hover:bg-brand-700 disabled:bg-line-200 disabled:text-ink-400"
                >
                  <ArrowUp size={20} />
                </button>
              </form>
            </div>
            {paused ? (
              <p className="mt-2 text-center text-xs font-medium text-ink-900">Cuộc trò chuyện thường được tạm dừng</p>
            ) : (
              <p className="mt-2 text-center text-xs text-ink-600">Trợ lý chỉ cung cấp thông tin tham khảo, không thay thế bác sĩ.</p>
            )}
          </div>
        </div>
      </section>

      <CitationDrawer data={drawer} onClose={() => setDrawer(null)} />
      <MobileHistory open={mobileList} onClose={() => setMobileList(false)}>
        {list}
      </MobileHistory>
    </div>
  )
}

function Bubble({ m, onCite, onResend }: { m: Msg; onCite: (s: string[], f: number) => void; onResend: (id: string) => void }) {
  if (m.kind === 'user')
    return (
      <div className="flex flex-col items-end">
        <div className={cn('max-w-[85%] rounded-2xl rounded-tr-md px-4 py-2.5 text-[15px] whitespace-pre-line', m.failed ? 'border border-dashed border-ink-400 bg-surface text-ink-900' : 'bg-brand-600 text-white')}>
          {m.text}
        </div>
        {m.failed && (
          <div role="alert" className="mt-1.5 flex items-center gap-2 text-[13px] text-ink-900">
            <span className="text-red-ink">Không gửi được. Tin nhắn của bạn vẫn được giữ.</span>
            <Button size="sm" variant="ghost" icon={<RefreshCw size={14} aria-hidden />} onClick={() => onResend(m.id)} className="h-8">
              Gửi lại
            </Button>
          </div>
        )}
      </div>
    )

  if (m.kind === 'emergency')
    return (
      <div role="alert" className="rounded-2xl bg-red-line p-5 text-white shadow-e2 sm:p-6">
        <div className="flex items-center gap-2.5">
          <Siren size={24} aria-hidden />
          <p className="text-lg font-bold">Đây có thể là tình huống khẩn cấp</p>
        </div>
        <p className="mt-2 text-[15px]">Hãy gọi 115 hoặc đến cơ sở y tế gần nhất ngay.</p>
        <a
          href="tel:115"
          className="mt-5 flex h-14 w-full items-center justify-center gap-2.5 rounded-xl bg-surface text-lg font-bold text-red-ink transition-colors hover:bg-red-bg focus-visible:outline-white"
        >
          <Phone size={22} aria-hidden />
          Gọi <span className="font-mono">115</span>
        </a>
      </div>
    )

  return (
    <div className="flex items-start gap-2">
      <Mark size={28} className="mt-1 shrink-0" />
      {m.kind === 'refusal' ? (
        <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-gray-line/40 bg-gray-bg px-4 py-3 text-[15px] text-gray-ink">
          <p className="flex gap-2.5">
            <Info size={18} className="mt-0.5 shrink-0" aria-hidden />
            <span>Mình không thể chẩn đoán, đổi liều hay khuyên ngừng thuốc. Hãy hỏi bác sĩ hoặc dược sĩ của bạn.</span>
          </p>
        </div>
      ) : m.kind === 'insufficient' ? (
        <div className="max-w-[85%] rounded-2xl rounded-tl-md border border-gray-line/40 bg-gray-bg px-4 py-3 text-[15px] text-gray-ink">
          <p className="flex gap-2.5">
            <CircleHelp size={18} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              VitaP chưa đủ dữ liệu xác thực cho câu hỏi này.{' '}
              <strong className="font-semibold text-ink-900">
                Nếu bạn đang gặp bất kỳ triệu chứng bất thường nào sau khi dùng thuốc, vui lòng liên hệ ngay bác sĩ điều trị hoặc cơ sở y tế gần nhất.
              </strong>
            </span>
          </p>
        </div>
      ) : m.kind === 'assistant' ? (
        <Card className="max-w-[85%] rounded-2xl rounded-tl-md px-4 py-3 text-[15px] leading-6 text-ink-900">
          <p className="whitespace-pre-line">
            {m.parts.map((p, i) =>
              typeof p === 'string' ? (
                <span key={i}>{p}</span>
              ) : (
                <button
                  key={i}
                  onClick={() => onCite(m.sources, p.cite)}
                  aria-label={`Nguồn ${p.cite}: ${SOURCES[m.sources[p.cite - 1]].title}, phiên bản ${SOURCES[m.sources[p.cite - 1]].version}`}
                  className="mx-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-50 px-1.5 align-[2px] font-mono text-xs font-semibold text-brand-ink hover:bg-brand-100"
                >
                  {p.cite}
                </button>
              ),
            )}
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line-200 pt-3">
            {m.sources.map((s, i) => (
              <button key={s} onClick={() => onCite(m.sources, i + 1)} className="inline-flex h-7 items-center gap-1.5 rounded-full border border-line-200 px-2.5 text-[12px] text-ink-600 hover:border-brand-600 hover:text-brand-ink" aria-label={`Mở nguồn ${i + 1}: ${SOURCES[s].title}`}>
                <span className="font-mono font-semibold text-brand-ink">[{i + 1}]</span>
                {SOURCES[s].title}
              </button>
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  )
}

function CitationDrawer({ data, onClose }: { data: { sources: string[]; focus: number } | null; onClose: () => void }) {
  const id = useId()
  return (
    <Modal open={!!data} onClose={onClose} labelledBy={id} variant="side" width={420}>
      <div className="flex items-center justify-between px-5 pt-4 pb-3 sm:px-6">
        <h2 id={id} className="text-lg font-semibold text-ink-900">
          Nguồn dẫn
        </h2>
        <IconButton label="Đóng" onClick={onClose} className="-mr-2">
          <X size={20} />
        </IconButton>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto px-5 pb-6 sm:px-6">
        {data?.sources.map((s, i) => {
          const src = SOURCES[s]
          const focused = data.focus === i + 1
          return (
            <article key={s} className={cn('rounded-xl border p-4', focused ? 'border-brand-600 bg-brand-50/50' : 'border-line-200')}>
              <p className="font-mono text-[12px] font-semibold text-brand-ink">[{i + 1}]</p>
              <h3 className="mt-1 text-[15px] font-semibold text-ink-900">{src.title}</h3>
              <p className="text-[12px] text-ink-600">
                Phiên bản <span className="font-mono">{src.version}</span>
              </p>
              <blockquote className="mt-3 border-l-2 border-line-200 pl-3 text-sm text-ink-900">“{src.excerpt}”</blockquote>
            </article>
          )
        })}
      </div>
    </Modal>
  )
}

function SessionList({
  sessions,
  activeId,
  onOpen,
  onNew,
  onRemove,
}: {
  sessions: Session[]
  activeId: string
  onOpen: (id: string) => void
  onNew: () => void
  onRemove: (id: string) => void
}) {
  const groups = (['today', 'week', 'older'] as const).map((g) => ({ g, items: sessions.filter((x) => x.group === g) })).filter((x) => x.items.length)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="p-3">
        <Button block variant="secondary" icon={<Plus size={18} aria-hidden />} onClick={onNew} className={cn(activeId === 'new' && 'border-brand-600 text-brand-fg')}>
          Phiên mới
        </Button>
      </div>
      <nav aria-label="Các phiên trò chuyện" className="flex-1 overflow-y-auto px-3 pb-4">
        {groups.length === 0 && <p className="px-3 py-6 text-center text-sm text-ink-600">Chưa có phiên trò chuyện nào.</p>}
        {groups.map(({ g, items }) => (
          <div key={g} className="mb-4">
            <p className="px-3 pb-1.5 text-[12px] font-semibold tracking-wide text-ink-600">{GROUP_LABEL[g]}</p>
            <ul className="space-y-0.5">
              {items.map((it) => {
                const current = it.id === activeId
                const emergency = it.msgs.some((m) => m.kind === 'emergency')
                return (
                  <li key={it.id} className="group relative">
                    <button
                      onClick={() => onOpen(it.id)}
                      aria-current={current ? 'true' : undefined}
                      className={cn('flex w-full flex-col rounded-lg py-2 pr-10 pl-3 text-left transition-colors', current ? 'bg-brand-50' : 'hover:bg-line-100')}
                    >
                      <span className={cn('truncate text-sm font-medium', current ? 'text-brand-ink' : 'text-ink-900')}>{it.title}</span>
                      <span className="flex items-center gap-1.5 text-[12px] text-ink-600">
                        {it.date}
                        {emergency && (
                          <span className="inline-flex items-center gap-1 text-red-ink">
                            · <Siren size={11} aria-hidden /> Khẩn cấp
                          </span>
                        )}
                      </span>
                    </button>
                    <button
                      onClick={() => onRemove(it.id)}
                      aria-label={`Xóa phiên “${it.title}”`}
                      className="absolute top-1/2 right-1 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-ink-600 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-line-200 focus-visible:opacity-100 max-lg:opacity-100"
                    >
                      <Trash2 size={15} />
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
      </nav>
    </div>
  )
}

function MobileHistory({ open, onClose, children }: { open: boolean; onClose: () => void; children: React.ReactNode }) {
  const id = useId()
  return (
    <Modal open={open} onClose={onClose} labelledBy={id} variant="drawer-left" width={320}>
      <div className="flex items-center justify-between px-5 pt-4 pb-1">
        <h2 id={id} className="text-lg font-semibold text-ink-900">
          Lịch sử trò chuyện
        </h2>
        <IconButton label="Đóng" onClick={onClose} className="-mr-2">
          <X size={20} />
        </IconButton>
      </div>
      {children}
    </Modal>
  )
}
