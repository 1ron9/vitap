import { useId, useState } from 'react'
import { CircleDashed, CirclePlay, CircleStop } from 'lucide-react'
import { Button, Modal, ModalHeader } from '@/components/ui'
import { fmtDate, type Prescription, RX_STATUS_LABEL, type RxStatus, useData } from '@/data/db'
import { cn } from '@/lib/cn'

const ICON: Record<RxStatus, typeof CirclePlay> = { active: CirclePlay, ended: CircleStop, unknown: CircleDashed }
const ORDER: RxStatus[] = ['active', 'ended', 'unknown']

export function RxStatusBadge({ status }: { status: RxStatus }) {
  const Icon = ICON[status]
  return (
    <span className={cn('inline-flex h-7 items-center gap-1.5 rounded-full border border-gray-line bg-surface px-2.5 text-[12px] font-semibold text-gray-ink', status === 'unknown' && 'border-dashed')}>
      <Icon size={14} aria-hidden />
      {RX_STATUS_LABEL[status]}
    </span>
  )
}

/** Status badge + "Cập nhật trạng thái" button for one saved prescription. */
export function RxStatusControl({ rx, className }: { rx: Prescription; className?: string }) {
  const { rxStatus, setRxStatus } = useData()
  const status = rxStatus(rx.id)
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<RxStatus>(status)
  const titleId = useId()
  const name = useId()
  const date = fmtDate(rx.date)

  return (
    <div className={cn('flex flex-wrap items-center gap-x-2 gap-y-1', className)}>
      <RxStatusBadge status={status} />
      <Button
        variant="ghost"
        size="sm"
        className="h-11 px-2.5"
        aria-label={`Cập nhật trạng thái đơn ngày ${date}`}
        onClick={() => {
          setDraft(status)
          setOpen(true)
        }}
      >
        Cập nhật trạng thái
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} labelledBy={titleId} width={400}>
        <ModalHeader id={titleId} title="Cập nhật trạng thái" sub={<>Đơn ngày <span className="font-mono">{date}</span></>} onClose={() => setOpen(false)} />
        <form
          className="px-5 pb-5 sm:px-6"
          onSubmit={(e) => {
            e.preventDefault()
            setRxStatus(rx.id, draft)
            setOpen(false)
          }}
        >
          <fieldset>
            <legend className="sr-only">Cập nhật trạng thái</legend>
            <div className="space-y-2">
              {ORDER.map((s) => {
                const Icon = ICON[s]
                return (
                  <label
                    key={s}
                    className={cn(
                      'flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 text-[15px] font-medium text-ink-900 transition-colors',
                      draft === s ? 'border-brand-600 bg-brand-50' : 'border-gray-line hover:bg-bg-50',
                    )}
                  >
                    <input type="radio" name={name} value={s} checked={draft === s} onChange={() => setDraft(s)} className="h-5 w-5 accent-brand-600" data-autofocus={s === status || undefined} />
                    <Icon size={18} className="text-gray-ink" aria-hidden />
                    {RX_STATUS_LABEL[s]}
                  </label>
                )
              })}
            </div>
          </fieldset>
          <div className="mt-6 flex gap-3">
            <Button type="button" variant="secondary" className="flex-1" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button type="submit" className="flex-1">
              Lưu
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
