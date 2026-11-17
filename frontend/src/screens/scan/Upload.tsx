import { useRef, useState } from 'react'
import { AlignCenterVertical, Camera, Clock, ImagePlus, Keyboard, RotateCcw, ScanSearch, Sun } from 'lucide-react'
import { useApp } from '@/app/state'
import { Banner, Button, Card } from '@/components/ui'
import { MAX_UPLOAD_MB } from '@/data/health'
import { cn } from '@/lib/cn'

export function Upload({ error, onImage, onManual, onError }: {
  error?: 'invalid' | 'expired'
  onImage: (file: File, url: string) => void
  onManual: () => void
  onError: (e: 'invalid') => void
}) {
  const { isGuest } = useApp()
  const input = useRef<HTMLInputElement>(null)
  const camera = useRef<HTMLInputElement>(null)
  const [drag, setDrag] = useState(false)
  const [consent, setConsent] = useState(false)
  const accept = (file?: File | null) => {
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > MAX_UPLOAD_MB * 1024 * 1024) return onError('invalid')
    if (consent) onImage(file, URL.createObjectURL(file))
  }
  return <div className="space-y-4">
    {isGuest && <Banner tone="info">Phiên khách xử lý ảnh thật trên backend; dữ liệu phiên khách có thời hạn lưu trữ.</Banner>}
    {error === 'invalid' && <Banner tone="error">Ảnh không hợp lệ. Chỉ nhận JPG, PNG và dung lượng tối đa {MAX_UPLOAD_MB} MB.</Banner>}
    {error === 'expired' && <Banner tone="neutral" icon={<Clock size={20} />}>Phiên đã hết hạn. Vui lòng tải ảnh lại.</Banner>}
    <div onDragOver={(e) => { e.preventDefault(); setDrag(true) }} onDragLeave={() => setDrag(false)} onDrop={(e) => { e.preventDefault(); setDrag(false); accept(e.dataTransfer.files[0]) }} className={cn('flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-10 text-center sm:py-14', drag ? 'border-brand-600 bg-brand-50' : 'border-ink-400 bg-surface')}>
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-fg"><ScanSearch size={28} /></div>
      <p className="mt-4 text-lg font-semibold text-ink-900">Chụp ảnh hoặc chọn ảnh đơn thuốc</p>
      <p className="mt-1 hidden text-sm text-ink-600 sm:block">Kéo thả ảnh vào đây trên máy tính</p>
      <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <Button icon={<Camera size={18} />} onClick={() => camera.current?.click()} disabled={!consent} className="sm:hidden">Chụp ảnh</Button>
        <Button variant="secondary" icon={<ImagePlus size={18} />} onClick={() => input.current?.click()} disabled={!consent} className="sm:border-transparent sm:bg-brand-600 sm:text-white sm:hover:bg-brand-700"><span className="sm:hidden">Chọn từ thư viện</span><span className="hidden sm:inline">Chọn ảnh</span></Button>
      </div>
      <label className="mt-4 flex max-w-xl items-start gap-2 text-left text-sm text-ink-700"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-1 accent-brand-600" /><span>Tôi đồng ý gửi ảnh đơn thuốc lên máy chủ VitaP để PaddleOCR xử lý và trích xuất thông tin.</span></label>
      <p className="mt-4 text-xs text-ink-600">JPG, PNG · tối đa {MAX_UPLOAD_MB} MB</p>
      <input ref={input} type="file" accept="image/jpeg,image/png" className="sr-only" onChange={(e) => accept(e.target.files?.[0])} />
      <input ref={camera} type="file" accept="image/jpeg,image/png" capture="environment" className="sr-only" onChange={(e) => accept(e.target.files?.[0])} />
    </div>
    <Card className="p-5"><p className="text-sm font-semibold text-ink-900">Mẹo chụp ảnh</p><ul className="mt-3 grid gap-3 sm:grid-cols-3">{[
      { icon: Sun, title: 'Đủ sáng', text: 'Tránh bóng và đèn chói lên chữ' },
      { icon: AlignCenterVertical, title: 'Chụp thẳng', text: 'Đặt đơn phẳng, máy song song với giấy' },
      { icon: ScanSearch, title: 'Thấy rõ toàn bộ', text: 'Không cắt mất tên thuốc hoặc liều' },
    ].map((tip) => <li key={tip.title} className="flex gap-3"><tip.icon size={18} className="mt-0.5 shrink-0 text-brand-fg" /><span className="text-sm"><b className="block font-medium text-ink-900">{tip.title}</b><span className="text-ink-600">{tip.text}</span></span></li>)}</ul></Card>
    <div className="flex flex-col items-center gap-2 pt-2 sm:flex-row sm:justify-center"><span className="text-sm text-ink-600">Không có ảnh?</span><Button variant="secondary" icon={<Keyboard size={18} />} onClick={onManual}>Nhập tay danh sách thuốc</Button></div>
  </div>
}

export function Processing({ phase, image, error, onRetake, onManual }: {
  phase: 'running' | 'slow' | 'failed'; image?: string; error?: string; onRetake: () => void; onManual: () => void
}) {
  const running = phase !== 'failed'
  return <Card className="overflow-hidden"><div className="flex flex-col gap-6 p-5 sm:flex-row sm:p-6">
    <div className="relative mx-auto h-[220px] w-[160px] shrink-0 overflow-hidden rounded-lg border border-line-200 bg-bg-50">{image && <img src={image} alt="Ảnh đơn thuốc vừa tải lên" className={cn('h-full w-full object-contain', !running && 'grayscale')} />}{running && <div className="absolute inset-x-0 top-0 h-1/3 animate-[scanline_2.2s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-brand-600/15 to-transparent" />}</div>
    <div className="flex min-w-0 flex-1 flex-col justify-center" aria-live="polite">{running ? <><p className="text-lg font-semibold text-ink-900">Đang chờ worker PaddleOCR xử lý ảnh…</p><p className="mt-1 text-sm text-ink-600">Backend cập nhật trạng thái tác vụ; không có dữ liệu mẫu trong luồng này.</p><div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-line-100" role="progressbar" aria-label="Tiến trình OCR" aria-busy><div className="h-full w-2/5 animate-indeterminate rounded-full bg-brand-600" /></div></> : <><p className="text-lg font-semibold text-ink-900">Không xử lý được ảnh.</p><p className="mt-1 text-sm text-ink-600">{error || 'Kiểm tra backend, worker PaddleOCR và thử lại.'}</p><div className="mt-5 flex flex-wrap gap-2"><Button icon={<RotateCcw size={18} />} onClick={onRetake}>Chọn ảnh khác</Button><Button variant="secondary" icon={<Keyboard size={18} />} onClick={onManual}>Nhập tay</Button></div></>}</div>
  </div></Card>
}
