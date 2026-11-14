import { useEffect, useRef, useState } from 'react'
import { AlignCenterVertical, Camera, Clock, FileImage, History, ImagePlus, Keyboard, RotateCcw, ScanSearch, Sun } from 'lucide-react'
import { useApp } from '@/app/state'
import { Banner, Button, Card } from '@/components/ui'
import { StatusPill } from '@/components/status'
import { fmtDate, type Prescription, rxSummary, useDataSafe } from '@/data/db'
import { MAX_UPLOAD_MB } from '@/data/health'
import { cn } from '@/lib/cn'
import { ocrResult } from './model'
import { PrescriptionPaper } from './Prescription'

export function Upload({
  error,
  onImage,
  onManual,
  onError,
  onSelectRx,
}: {
  error?: 'invalid' | 'expired'
  onImage: (url?: string) => void
  onManual: () => void
  onError: (e: 'invalid') => void
  onSelectRx?: (rx: Prescription) => void
}) {
  const { isGuest, openAuth } = useApp()
  const data = useDataSafe()
  const prescriptions = data?.prescriptions ?? []
  const input = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)

  const accept = (f?: File | null) => {
    if (!f) return
    const okType = ['image/jpeg', 'image/png'].includes(f.type)
    if (!okType || f.size > MAX_UPLOAD_MB * 1024 * 1024) return onError('invalid')
    onImage(URL.createObjectURL(f))
  }

  return (
    <div className="space-y-4">
      {isGuest && (
        <Banner tone="info">
          Bạn đang dùng thử, kết quả sẽ không được lưu.{' '}
          <button
            type="button"
            onClick={() => openAuth({ variant: 'login' })}
            // Inline text button; the pseudo-element extends the hit area to 44px tall without changing the line.
            className="relative rounded font-semibold text-brand-fg underline underline-offset-2 after:absolute after:-inset-x-1 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-[''] hover:text-brand-ink"
          >
            Đăng nhập để lưu
          </button>
        </Banner>
      )}
      {error === 'invalid' && <Banner tone="error">Ảnh không hợp lệ. Chỉ nhận JPG, PNG và dung lượng trong giới hạn cho phép.</Banner>}
      {error === 'expired' && (
        <Banner tone="neutral" icon={<Clock size={20} />}>
          Phiên đã hết hạn. Vui lòng tải ảnh lại.
        </Banner>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDrag(true)
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDrag(false)
          accept(e.dataTransfer.files[0])
        }}
        className={cn(
          'flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors duration-150 sm:py-14',
          drag ? 'border-brand-600 bg-brand-50' : 'border-ink-400 bg-surface',
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-fg" aria-hidden>
          <ScanSearch size={28} />
        </div>
        <p className="mt-4 text-lg font-semibold text-ink-900">Chụp ảnh hoặc chọn ảnh đơn thuốc</p>
        <p className="mt-1 hidden text-sm text-ink-600 sm:block">Kéo thả ảnh vào đây trên máy tính</p>
        <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
          <Button icon={<Camera size={18} aria-hidden />} onClick={() => camera.current?.click()} className="sm:hidden">
            Chụp ảnh
          </Button>
          <Button
            variant="secondary"
            icon={<ImagePlus size={18} aria-hidden />}
            onClick={() => input.current?.click()}
            className="max-sm:order-2 sm:border-transparent sm:bg-brand-600 sm:text-white sm:hover:bg-brand-700"
          >
            <span className="sm:hidden">Chọn từ thư viện</span>
            <span className="hidden sm:inline">Chọn ảnh</span>
          </Button>
          <Button variant="secondary" icon={<FileImage size={18} aria-hidden />} onClick={() => onImage(undefined)} className="max-sm:order-3">
            Dùng ảnh đơn mẫu
          </Button>
        </div>
        <p className="mt-5 text-xs text-ink-600">JPG, PNG · tối đa {MAX_UPLOAD_MB} MB</p>
        <input ref={input} type="file" accept="image/jpeg,image/png" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => accept(e.target.files?.[0])} />
        <input ref={camera} type="file" accept="image/jpeg,image/png" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => accept(e.target.files?.[0])} />
      </div>

      <Card className="p-5">
        <p className="text-sm font-semibold text-ink-900">Mẹo chụp ảnh</p>
        <ul className="mt-3 grid gap-3 sm:grid-cols-3">
          {[
            { icon: Sun, t: 'Đủ sáng', d: 'Tránh bóng tay và đèn chói lên chữ' },
            { icon: AlignCenterVertical, t: 'Chụp thẳng', d: 'Đặt đơn phẳng, máy song song với giấy' },
            { icon: ScanSearch, t: 'Thấy rõ toàn bộ', d: 'Không cắt mất tên thuốc hoặc liều' },
          ].map((x) => (
            <li key={x.t} className="flex gap-3">
              <x.icon size={18} className="mt-0.5 shrink-0 text-brand-fg" aria-hidden />
              <span className="text-sm">
                <span className="block font-medium text-ink-900">{x.t}</span>
                <span className="text-ink-600">{x.d}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>

      <div className="flex flex-col items-center gap-2 pt-2 sm:flex-row sm:justify-center">
        <span className="text-sm text-ink-600">Không có ảnh?</span>
        <Button variant="secondary" icon={<Keyboard size={18} aria-hidden />} onClick={onManual}>
          Nhập tay danh sách thuốc
        </Button>
      </div>

      {prescriptions.length > 0 && (
        <Card className="mt-6 overflow-hidden">
          <div className="flex items-center justify-between border-b border-line-200 px-5 py-3">
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink-900">
              <History size={18} className="text-brand-fg" aria-hidden />
              Đơn thuốc đã lưu gần đây
            </h2>
            <span className="text-xs text-ink-600">{prescriptions.length} đơn</span>
          </div>
          <ul className="divide-y divide-line-200">
            {prescriptions.map((rx) => {
              const sum = rxSummary(rx.drugs)
              return (
                <li key={rx.id} className="flex flex-col gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between hover:bg-bg-50">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-ink-900">
                      {fmtDate(rx.date)} <span className="font-normal text-ink-600">· {rx.place}</span>
                    </p>
                    <p className="truncate text-xs text-ink-600">
                      {rx.drugs.map((d) => d.name).join(', ')}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:justify-end">
                    <StatusPill status={sum.status} severity={sum.severity} size="sm" />
                    <Button size="sm" variant="secondary" onClick={() => onSelectRx?.(rx)}>
                      Xem kết quả đơn này
                    </Button>
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      )}
    </div>
  )
}

const SLOW_AFTER_MS = 18000
const DONE_AFTER_MS = 5000

export function Processing({
  phase,
  image,
  onDone,
  onSlow,
  onRetake,
  onManual,
}: {
  phase: 'running' | 'slow' | 'failed'
  image?: string
  onDone: () => void
  onSlow: () => void
  onRetake: () => void
  onManual: () => void
}) {
  const [waiting, setWaiting] = useState(false)
  useEffect(() => {
    if (phase !== 'running') return
    const done = setTimeout(onDone, DONE_AFTER_MS)
    const slow = setTimeout(onSlow, SLOW_AFTER_MS)
    return () => {
      clearTimeout(done)
      clearTimeout(slow)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])
  useEffect(() => {
    if (!waiting) return
    const t = setTimeout(onDone, 2500)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting])

  const running = phase !== 'failed'
  const lines = ocrResult('mixed').lines

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-6 p-5 sm:flex-row sm:p-6">
        <div className="relative mx-auto h-[220px] w-[160px] shrink-0 overflow-hidden rounded-lg border border-line-200 bg-bg-50">
          {image ? (
            <img src={image} alt="Ảnh đơn thuốc vừa tải lên" className={cn('h-full w-full object-cover', phase === 'failed' && 'grayscale')} />
          ) : (
            <div className="origin-top-left scale-[0.42]" role="img" aria-label="Ảnh đơn thuốc mẫu">
              <PrescriptionPaper lines={lines} />
            </div>
          )}
          {running && <div className="absolute inset-x-0 top-0 h-1/3 animate-[scanline_2.2s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-brand-600/15 to-transparent" aria-hidden />}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-center" aria-live="polite">
          {phase === 'failed' ? (
            <>
              <p className="text-lg font-semibold text-ink-900">Không đọc được đơn thuốc. Ảnh có thể bị mờ hoặc thiếu sáng.</p>
              <p className="mt-1 text-sm text-ink-600">Hãy chụp lại ở nơi đủ sáng, hoặc nhập tên thuốc bằng tay.</p>
              <div className="mt-5 flex flex-wrap gap-2">
                <Button icon={<RotateCcw size={18} aria-hidden />} onClick={onRetake}>
                  Chụp lại
                </Button>
                <Button variant="secondary" icon={<Keyboard size={18} aria-hidden />} onClick={onManual}>
                  Nhập tay
                </Button>
              </div>
            </>
          ) : (
            <>
              <p className="text-lg font-semibold text-ink-900">{phase === 'slow' && !waiting ? 'Hệ thống đang xử lý nền. Bạn có thể chờ thêm hoặc nhập tay.' : 'Đang đọc đơn thuốc…'}</p>
              <p className="mt-1 text-sm text-ink-600">{phase === 'slow' && !waiting ? 'Ảnh có nhiều chữ viết tay nên cần thêm thời gian.' : 'Thường mất khoảng 5–15 giây.'}</p>
              <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-line-100" role="progressbar" aria-label="Tiến trình đọc đơn" aria-busy>
                <div className="h-full w-2/5 animate-indeterminate rounded-full bg-brand-600" />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                {phase === 'slow' && !waiting && (
                  <>
                    <Button onClick={() => setWaiting(true)}>Chờ thêm</Button>
                    <Button variant="secondary" icon={<Keyboard size={18} aria-hidden />} onClick={onManual}>
                      Nhập tay
                    </Button>
                  </>
                )}
                <span className="group relative inline-flex">
                  <Button variant="ghost" aria-disabled="true" aria-describedby="retake-tip" icon={<RotateCcw size={18} aria-hidden />} className="cursor-not-allowed text-ink-400 hover:bg-transparent" onClick={(e) => e.preventDefault()}>
                    Chụp lại
                  </Button>
                  <span
                    id="retake-tip"
                    role="tooltip"
                    className="pointer-events-none absolute bottom-full left-1/2 mb-2 -translate-x-1/2 rounded-md bg-night px-2.5 py-1.5 text-[12px] whitespace-nowrap text-white opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
                  >
                    Đang xử lý ảnh trước đó
                  </span>
                </span>
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}
