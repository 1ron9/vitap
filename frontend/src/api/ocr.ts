import { authApi, mockMode } from '@/api/client'
import { api, getCredentials } from '@/shared/api'

export type OcrItem = {
  id: string
  item_order: number
  extracted_name: string
  extracted_strength?: string | null
  extracted_dosage?: string | null
  frequency?: string | null
  duration_days?: number | null
  route?: string | null
  instructions?: string | null
  confidence?: number | null
  resolution_status: string
}

export type OcrJob = { id: string; prescription_id: string; status: string; error?: { message: string }; items: OcrItem[] }
type Upload = { job_id: string; poll_after_seconds: number }

async function ensureRealSession(isGuest: boolean) {
  if (mockMode) throw new Error('OCR thật cần đặt VITE_USE_MOCK=false và khởi động lại frontend.')
  if (isGuest) {
    const { guest } = getCredentials()
    if (!guest) {
      const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('vitap-refresh-token') : null
      if (refreshToken) {
        try {
          await authApi.refresh(refreshToken)
          return
        } catch {
          // Expired login session; create an explicitly consented guest session below.
        }
      }
      await authApi.guestSession({ consent_accepted: true, consent_version: 'guest-processing-v1' })
    }
    return
  }
  const { access } = getCredentials()
  if (!access) await authApi.refresh()
}

export async function processPrescriptionImage(file: File, isGuest: boolean, onStatus: (status: string) => void): Promise<OcrJob> {
  await ensureRealSession(isGuest)
  const form = new FormData()
  form.append('image_file', file)
  const upload = await api<Upload>('/prescriptions/ocr', { method: 'POST', body: form })
  const deadline = Date.now() + 5 * 60_000
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, Math.max(1, upload.poll_after_seconds) * 1000))
    const job = await api<OcrJob>(`/ocr-jobs/${upload.job_id}`)
    onStatus(job.status)
    if (job.status === 'COMPLETED') return job
    if (job.status === 'FAILED') throw new Error(job.error?.message || 'PaddleOCR không xử lý được ảnh này.')
  }
  throw new Error('Tác vụ OCR vẫn đang chạy sau 5 phút. Bạn có thể thử lại sau.')
}

export async function saveOcrReview(jobId: string, items: Array<{
  source_ocr_item_id?: string
  item_order: number
  extracted_name: string
  extracted_strength?: string
  extracted_dosage?: string
  frequency?: string
  duration_days?: number
  route?: string
  instructions?: string
  confidence?: number
  unresolved: boolean
}>) {
  if (mockMode) throw new Error('OCR thật cần đặt VITE_USE_MOCK=false và khởi động lại frontend.')
  return api<{ prescription_id: string; saved_items: number; status: string }>(`/ocr-jobs/${jobId}/review`, {
    method: 'POST', body: JSON.stringify({ items }),
  })
}
