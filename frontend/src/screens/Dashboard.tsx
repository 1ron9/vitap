import { useEffect, useState } from 'react'
import { Activity, ChartLine, ChevronRight, Droplet, HeartPulse, MessageSquareText, NotebookPen, RefreshCw, Scale, Table2, TriangleAlert, WifiOff } from 'lucide-react'
import { useApp } from '@/app/state'
import { cn } from '@/lib/cn'
import { GuestLock } from '@/components/GuestLock'
import { LineChart } from '@/components/LineChart'
import { StatusPill } from '@/components/status'
import { Button, Card, EmptyState, Mono, PageHeader, Segmented, Skeleton } from '@/components/ui'
import { RxStatusControl } from '@/components/RxStatus'
import { type Entry, fmtDate, fmtDayMonth, fromMmol, GLU_DECIMALS, latestWith, type Metric, pastEntries, PRESCRIPTIONS, relDay, rxSummary, type SevereAlert, severeInteractions, useData } from '@/data/db'
import { type ChartDef, chartDefs, fmt, type Range } from '@/data/health'
import { setChatDraft } from '@/screens/Chat'

const RANGE_OPTS: { value: Range; label: string }[] = [
  { value: 'day', label: 'Ngày' },
  { value: 'week', label: 'Tuần' },
  { value: 'month', label: 'Tháng' },
]

type DState = 'data' | 'loading' | 'empty' | 'single' | 'error'

export function Dashboard() {
  const { isGuest } = useApp()
  const { entries } = useData()
  const [range, setRange] = useState<Range>('week')

  const state: DState = entries.length === 0 ? 'empty' : entries.length === 1 ? 'single' : 'data'

  const changeRange = (r: Range) => {
    setRange(r)
  }

  const content = (
    <>
      <PageHeader
        title="Tổng quan"
        sub={isGuest ? 'Dữ liệu mẫu' : 'Chỉ số của bạn, tổng hợp từ Sổ tay'}
        right={<Segmented size="lg" label="Khoảng thời gian" value={range} onChange={changeRange} options={RANGE_OPTS} className="w-full sm:w-auto [&>button]:sm:w-20" />}
      />
      {!isGuest && <AttentionCard />}
      <Body state={isGuest ? 'data' : state} range={range} onRetry={() => {}} />
    </>
  )

  if (isGuest)
    return (
      <GuestLock
        title="Đăng ký để theo dõi sức khỏe của bạn"
        body="Biểu đồ huyết áp, đường huyết, cân nặng và nhịp tim được vẽ từ các ghi chép trong Sổ tay của bạn."
        gate="Đăng ký để theo dõi sức khỏe của bạn"
      >
        {content}
      </GuestLock>
    )
  return content
}

const MAX_ALERT_ROWS = 3

/** Shown only when a saved prescription has a "Mức nghiêm trọng" interaction; renders nothing otherwise. */
function AttentionCard() {
  const { go } = useApp()
  const { rxStatus, prescriptions } = useData()
  const alerts = severeInteractions(rxStatus, prescriptions)
  const [showAll, setShowAll] = useState(false)
  if (alerts.length === 0) return null

  const visible = showAll ? alerts : alerts.slice(0, MAX_ALERT_ROWS)
  const hidden = alerts.length - visible.length

  return (
    <Card as="section" className="mb-6 border-l-[3px] border-l-red-ink">
      <div className="flex items-center gap-2 px-5 pt-4">
        <TriangleAlert size={20} className="shrink-0 text-red-ink" aria-hidden />
        <h2 id="attention-title" className="text-base font-semibold text-ink-900">
          Cần chú ý
        </h2>
      </div>
      <ul className="divide-y divide-line-200" aria-labelledby="attention-title">
        {visible.map((a) => (
          <AttentionRow key={`${a.rx.id}-${a.pair.a}-${a.pair.b}`} alert={a} onDetail={() => go('scan', a.rx.id, 'dashboard')} onAsk={() => askAssistant(a)} />
        ))}
      </ul>
      {hidden > 0 && (
        <div className="border-t border-line-200 px-3 py-1">
          <Button variant="ghost" iconRight={<ChevronRight size={16} aria-hidden />} onClick={() => setShowAll(true)} aria-expanded={false}>
            Xem tất cả
          </Button>
        </div>
      )}
    </Card>
  )

  function askAssistant(a: SevereAlert) {
    setChatDraft(`Giải thích cảnh báo tương tác giữa ${a.pair.a} và ${a.pair.b} trong đơn ${fmtDayMonth(a.rx.date)}`)
    go('chat', 'empty', 'dashboard')
  }
}

function AttentionRow({ alert: a, onDetail, onAsk }: { alert: SevereAlert; onDetail: () => void; onAsk: () => void }) {
  const day = fmtDayMonth(a.rx.date)
  return (
    <li className="flex flex-col gap-3 px-5 py-4 lg:flex-row lg:items-center">
      <div className="min-w-0 flex-1">
        <p className="text-[15px] text-ink-900">
          Đơn ngày <Mono>{day}</Mono> có <Mono>{a.countInRx}</Mono> tương tác mức nghiêm trọng
        </p>
        <p className="mt-1 text-base font-semibold text-ink-900">
          {a.pair.a} + {a.pair.b}
        </p>
        <div className="mt-2">
          <StatusPill status="INTERACTION_FOUND" severity={a.pair.severity} size="sm" />
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button onClick={onDetail} aria-label={`Xem chi tiết đơn ngày ${day}`}>
          Xem chi tiết
        </Button>
        <Button variant="secondary" icon={<MessageSquareText size={18} aria-hidden />} onClick={onAsk}>
          Hỏi trợ lý
        </Button>
      </div>
    </li>
  )
}

const SUMMARY: { id: Metric; label: string; icon: typeof Activity }[] = [
  { id: 'bp', label: 'Huyết áp', icon: Activity },
  { id: 'glu', label: 'Đường huyết', icon: Droplet },
  { id: 'wt', label: 'Cân nặng', icon: Scale },
  { id: 'hr', label: 'Nhịp tim', icon: HeartPulse },
]

/** Latest Sổ tay value for a metric, in display units, plus how long ago it was logged. */
function latest(list: Entry[], m: Metric, gluUnit: keyof typeof GLU_DECIMALS) {
  const e = latestWith(list, m)
  if (!e) return null
  const value =
    m === 'bp' ? `${e.bp![0]}/${e.bp![1]}` : m === 'glu' ? fmt(fromMmol(e.glu!.mmol, gluUnit), GLU_DECIMALS[gluUnit]) : m === 'wt' ? fmt(e.wt!, 1) : String(e.hr)
  const unit = m === 'bp' ? 'mmHg' : m === 'glu' ? gluUnit : m === 'wt' ? 'kg' : 'bpm'
  return { value, unit, updated: `Cập nhật ${relDay(e.at)}` }
}

function Body({ state, range, onRetry }: { state: DState; range: Range; onRetry: () => void }) {
  const { go } = useApp()
  const { entries, prescriptions, gluUnit, rxStatus } = useData()
  // Demo state "Một điểm dữ liệu": only the newest Sổ tay entry exists.
  const list = state === 'single' ? pastEntries(entries).slice(0, 1) : entries
  const charts = chartDefs(gluUnit)

  if (state === 'error')
    return (
      <Card>
        <EmptyState
          icon={<WifiOff size={22} />}
          title="Không tải được dữ liệu"
          body="Kiểm tra kết nối mạng rồi thử lại."
          action={
            <Button variant="secondary" icon={<RefreshCw size={18} aria-hidden />} onClick={onRetry}>
              Thử lại
            </Button>
          }
        />
      </Card>
    )

  const loading = state === 'loading'

  return (
    <div className="space-y-6" aria-busy={loading}>
      {state === 'empty' ? (
        <Card>
          <EmptyState
            className="py-12"
            icon={<ChartLine size={22} />}
            title="Chưa có dữ liệu để hiển thị"
            body="Hãy thêm chỉ số đầu tiên vào Sổ tay"
            action={
              <Button icon={<NotebookPen size={18} aria-hidden />} onClick={() => go('journal', 'form', 'dashboard')}>
                Thêm vào Sổ tay
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <section aria-label="Chỉ số gần nhất" className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
            {SUMMARY.map((s) => {
              const last = latest(list, s.id, gluUnit)
              return (
              <Card key={s.id} className="p-4">
                {loading ? (
                  <>
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="mt-4 h-7 w-24" />
                    <Skeleton className="mt-3 h-3 w-16" />
                  </>
                ) : (
                  <>
                    <p className="flex items-center gap-2 text-sm font-medium text-ink-600">
                      <s.icon size={16} aria-hidden />
                      {s.label}
                    </p>
                    <p className="mt-3 flex flex-wrap items-baseline gap-x-1.5">
                      <Mono className="text-2xl font-semibold text-ink-900">{last ? last.value : '—'}</Mono>
                      {last && <Mono className="text-[13px] text-ink-600">{last.unit}</Mono>}
                    </p>
                    <p className="mt-1 text-[12px] text-ink-600">{last ? last.updated : 'Chưa có ghi chép'}</p>
                  </>
                )}
              </Card>
              )
            })}
          </section>

          <section aria-label="Biểu đồ">
            <div className="grid gap-4 lg:grid-cols-2">
              {charts.map((c) => (
                <ChartCard key={c.id} def={c} range={range} loading={loading} entries={list} />
              ))}
            </div>
            <p className="mt-2 text-[12px] text-ink-600">Chỉ hiển thị ngày có ghi chép.</p>
          </section>
        </>
      )}

      <Card as="section" className="overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <h2 className="text-base font-semibold text-ink-900">Đơn thuốc gần đây</h2>
          <Button variant="ghost" size="sm" onClick={() => go('scan', 'upload')}>
            Quét đơn mới
          </Button>
        </div>
        {loading ? (
          <div className="space-y-3 px-5 pt-2 pb-5">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <ul className="divide-y divide-line-200">
            {prescriptions.length === 0 ? (
              <li className="px-5 py-6 text-sm text-ink-500">Chưa có đơn thuốc nào được lưu.</li>
            ) : (
              prescriptions.map((rx) => {
              const date = fmtDate(rx.date)
              const sum = rxSummary(rx.drugs)
              return (
              <li key={rx.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-medium text-ink-900">
                    <Mono>{date}</Mono> · {rx.drugs.length} thuốc
                  </p>
                  <p className="truncate text-sm text-ink-600">{rx.place}</p>
                  <RxStatusControl rx={rx} className="mt-1.5" />
                </div>
                <div className="flex items-center justify-between gap-3">
                  <StatusPill status={sum.status} severity={sum.severity} size="sm" muted={rxStatus(rx.id) === 'ended'} />
                  <Button variant="ghost" size="sm" iconRight={<ChevronRight size={16} aria-hidden />} onClick={() => go('scan', rx.id, 'dashboard')} aria-label={`Xem đơn ngày ${date}`}>
                    Xem
                  </Button>
                </div>
              </li>
              )
            }))}
          </ul>
        )}
      </Card>
    </div>
  )
}

function ChartCard({ def, range, loading, entries }: { def: ChartDef; range: Range; loading: boolean; entries: Entry[] }) {
  const [table, setTable] = useState(false)
  const series = def.series(range, entries)
  const rows = series[0]?.data.flatMap((d, i) => (series.some((s) => s.data[i].v != null) ? [i] : [])) ?? []
  const empty = rows.length === 0
  const single = rows.length === 1
  const insight = def.insight ? def.insight(range, entries) : undefined

  return (
    <Card as="article" className="flex min-w-0 flex-col p-5">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink-900">{def.title}</h3>
          {!loading && !empty && insight && (
            <p className="mt-0.5 text-xs text-ink-600">{insight}</p>
          )}
          {series.length > 1 && (
            <ul className="mt-1.5 flex gap-4 text-xs text-ink-600">
              {series.map((s) => (
                <li key={s.name} className="flex items-center gap-1.5">
                  <span
                    className={cn('h-0.5 w-4 rounded', s.dashed && 'border-b border-dashed')}
                    style={{ background: s.color }}
                    aria-hidden
                  />
                  {s.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        {!loading && !empty && (
          <Button
            variant="ghost"
            size="sm"
            className="-mr-2 -mt-1"
            onClick={() => setTable((t) => !t)}
            icon={table ? <ChartLine size={16} aria-hidden /> : <Table2 size={16} aria-hidden />}
            aria-pressed={table}
            aria-label={table ? `Xem biểu đồ: ${def.title}` : `Xem dạng bảng: ${def.title}`}
          >
            {table ? 'Xem biểu đồ' : 'Xem dạng bảng'}
          </Button>
        )}
      </div>
      {loading ? (
        <Skeleton className="h-[200px] w-full" />
      ) : empty ? (
        <div className="flex h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-line-200 text-center">
          <p className="text-sm font-medium text-ink-900">Chưa có ghi chép</p>
          <p className="mt-0.5 text-xs text-ink-600">Thêm {def.title.toLowerCase()} trong Sổ tay để xem biểu đồ</p>
        </div>
      ) : table ? (
        <div className="max-h-[200px] overflow-auto rounded-lg border border-line-200">
          <table className="w-full text-sm">
            <caption className="sr-only">{def.title} dạng bảng</caption>
            <thead className="sticky top-0 bg-bg-50 text-left text-xs text-ink-600">
              <tr>
                <th className="px-3 py-2 font-medium">Thời gian</th>
                {series.map((s) => (
                  <th key={s.name} className="px-3 py-2 text-right font-medium">
                    {s.name} ({def.unit})
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-200">
              {rows.map((i) => (
                <tr key={i}>
                  <td className="px-3 py-2 text-ink-600">{series[0].data[i].full}</td>
                  {series.map((s) => (
                    <td key={s.name} className="px-3 py-2 text-right font-mono text-ink-900">
                      {s.data[i].v == null ? '—' : fmt(s.data[i].v!, def.decimals)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <>
          <LineChart
            series={series}
            unit={def.unit}
            yTitle={def.yTitle}
            decimals={def.decimals}
            bands={single ? undefined : def.bands}
            bandLabels={single ? undefined : def.bandLabels}
            yRange={def.yRange ? def.yRange(entries) : undefined}
            label={`Biểu đồ ${def.title}`}
          />
          {def.bands && (
            <p className="mt-2 text-right text-[11px] text-ink-500 italic">
              * Dải tham khảo định hướng chuyên môn (VNHA/ISH 2020, QĐ 5481/QĐ-BYT). Không thay thế chẩn đoán y khoa.
            </p>
          )}
          {single && <p className="mt-2 text-center text-xs text-ink-600">Cần thêm ghi chép để vẽ xu hướng</p>}
        </>
      )}
    </Card>
  )
}
