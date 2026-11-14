import { useEffect, useId, useRef, useState } from 'react'
import { Minus, Plus, ZoomIn } from 'lucide-react'
import { Modal, ModalHeader } from '@/components/ui'
import { SAMPLE_RX } from '@/data/db'
import { cn } from '@/lib/cn'

/** Geometry of the mock prescription photo (px at scale 1). */
export const PAPER_W = 380
const HEADER_H = 160
const LINE_H = 80
const FOOTER_H = 120

export type PaperLine = { raw: [string, string]; smudged?: boolean }

export function PrescriptionPaper({ lines, highlight, className }: { lines: PaperLine[]; highlight?: number | null; className?: string }) {
  return (
    <div
      className={cn('paper hand relative overflow-hidden text-[#23324d]', className)}
      style={{ width: PAPER_W, height: HEADER_H + lines.length * LINE_H + FOOTER_H }}
    >
      <div className="px-6" style={{ height: HEADER_H }}>
        <p className="pt-3 font-sans text-[10px] font-semibold tracking-[0.14em] text-ink-600 uppercase">{SAMPLE_RX.place}</p>
        <p className="font-sans text-[9px] text-ink-600">12 Nguyễn Văn Cừ, Q.5, TP.HCM · ĐT 028 3923 xxxx</p>
        <p className="mt-3 text-center font-sans text-[18px] font-bold tracking-[0.2em] text-ink-900">ĐƠN THUỐC</p>
        <p className="mt-2 text-[14px] leading-6">Họ tên: Nguyễn Minh Anh · 54 tuổi</p>
        <p className="text-[14px] leading-6">Chẩn đoán: Tăng huyết áp / Viêm họng</p>
      </div>
      {lines.map((l, i) => (
        <div
          key={i}
          className={cn('relative px-6 transition-colors duration-150', highlight === i && 'bg-brand-600/10')}
          style={{ height: LINE_H }}
        >
          {highlight === i && <span className="absolute inset-y-1 left-2 w-1 rounded-full bg-brand-600" aria-hidden />}
          <p className={cn('pt-2 text-[19px] leading-9', l.smudged && 'opacity-80 blur-[0.7px]')}>
            {i + 1}) {l.raw[0]}
          </p>
          <p className={cn('pl-6 text-[15px] leading-7 text-[#3c4a62]', l.smudged && 'blur-[0.5px]')}>{l.raw[1]}</p>
        </div>
      ))}
      <div className="px-6 text-right" style={{ height: FOOTER_H }}>
        <p className="pt-4 text-[13px]">
          Ngày {SAMPLE_RX.date.slice(8, 10)} tháng {SAMPLE_RX.date.slice(5, 7)} năm {SAMPLE_RX.date.slice(0, 4)}
        </p>
        <p className="font-sans text-[11px] text-ink-600">Bác sĩ khám bệnh</p>
        <svg width="96" height="32" viewBox="0 0 96 32" className="ml-auto" aria-hidden>
          <path d="M4 22 C 14 4, 22 30, 32 14 S 52 6, 58 20 S 78 26, 92 8" fill="none" stroke="#23324d" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        <p className="text-[13px]">BS. Trần Văn Khoa</p>
      </div>
    </div>
  )
}

/** A crop of one prescription line, cut from the same mock photo. */
export function CropThumb({ lines, index, alt, scale = 1, className }: { lines: PaperLine[]; index: number; alt: string; scale?: number; className?: string }) {
  return (
    <div role="img" aria-label={alt} className={cn('relative overflow-hidden rounded-lg border border-line-200 bg-[#fdfcf8]', className)} style={{ height: LINE_H * scale }}>
      <div className="absolute left-0 origin-top-left" style={{ top: -(HEADER_H + index * LINE_H) * scale, transform: `scale(${scale})` }} aria-hidden>
        <PrescriptionPaper lines={lines} />
      </div>
    </div>
  )
}

export function ZoomableCrop({ lines, index, alt }: { lines: PaperLine[]; index: number; alt: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  return (
    <>
      <button onClick={() => setOpen(true)} className="group relative block w-full text-left" aria-label={`Phóng to: ${alt}`}>
        <CropThumb lines={lines} index={index} alt={alt} />
        <span className="absolute right-2 bottom-2 inline-flex h-7 items-center gap-1 rounded-full bg-night/80 px-2.5 text-[12px] font-medium text-white">
          <ZoomIn size={14} aria-hidden />
          Phóng to
        </span>
      </button>
      <Modal open={open} onClose={() => setOpen(false)} labelledBy={id} width={720}>
        <ModalHeader id={id} title={`Dòng ${index + 1} trên ảnh gốc`} onClose={() => setOpen(false)} />
        <div className="overflow-x-auto px-5 pb-6 sm:px-6">
          <CropThumb lines={lines} index={index} alt={alt} scale={1.75} className="w-[665px]" />
        </div>
      </Modal>
    </>
  )
}

/** Desktop left pane: full original image with the focused line highlighted, zoomable. */
export function OriginalPane({ lines, highlight }: { lines: PaperLine[]; highlight: number | null }) {
  const [zoom, setZoom] = useState(0.85)
  const scroller = useRef<HTMLDivElement>(null)
  // Keep the highlighted line in view inside the pane (without scrolling the page).
  useEffect(() => {
    const el = scroller.current
    if (!el || highlight === null) return
    const top = 24 + (HEADER_H + highlight * LINE_H) * zoom
    const bottom = top + LINE_H * zoom
    if (top < el.scrollTop || bottom > el.scrollTop + el.clientHeight) el.scrollTo({ top: Math.max(0, top - 40), behavior: 'smooth' })
  }, [highlight, zoom])
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-line-200 bg-[#e9edf1]">
      <div className="flex items-center justify-between border-b border-line-200 bg-surface px-4 py-2">
        <p className="text-sm font-medium text-ink-900">Ảnh gốc</p>
        <div className="flex items-center gap-1" role="group" aria-label="Thu phóng ảnh">
          <button onClick={() => setZoom((z) => Math.max(0.75, +(z - 0.25).toFixed(2)))} aria-label="Thu nhỏ" className="flex h-9 w-9 items-center justify-center rounded-md text-ink-600 hover:bg-line-100">
            <Minus size={16} />
          </button>
          <span className="w-12 text-center font-mono text-[12px] text-ink-600">{Math.round(zoom * 100)}%</span>
          <button onClick={() => setZoom((z) => Math.min(2, +(z + 0.25).toFixed(2)))} aria-label="Phóng to" className="flex h-9 w-9 items-center justify-center rounded-md text-ink-600 hover:bg-line-100">
            <Plus size={16} />
          </button>
        </div>
      </div>
      <p className="border-b border-line-200 bg-surface px-4 py-2 text-[12px] text-ink-600">Dòng đang chọn được tô xanh. Bấm vào một thuốc bên phải để định vị trên ảnh.</p>
      <div ref={scroller} className="min-h-0 flex-1 overflow-auto p-6">
        <div style={{ width: PAPER_W * zoom, height: (HEADER_H + lines.length * LINE_H + FOOTER_H) * zoom }} className="mx-auto">
          <div className="origin-top-left rotate-0 shadow-e2" style={{ transform: `scale(${zoom})`, width: PAPER_W }}>
            <PrescriptionPaper lines={lines} highlight={highlight} />
          </div>
        </div>
      </div>
    </div>
  )
}
