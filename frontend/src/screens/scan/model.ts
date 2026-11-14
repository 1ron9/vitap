import { OCR_ROWS } from '@/data/db'
import type { DrugRow, Field } from '@/data/drugs'
import type { PaperLine } from './Prescription'

const clone = (r: DrugRow, over: Partial<DrugRow> = {}): DrugRow => ({ ...r, conf: { ...r.conf }, confirmed: [...r.confirmed], ...over })

export function ocrResult(kind: 'clear' | 'mixed' | 'unresolved'): { rows: DrugRow[]; lines: PaperLine[] } {
  const ids = kind === 'unresolved' ? ['amlo', 'simva', 'clari', 'unres'] : ['amlo', 'simva', 'clari', 'para']
  const rows = ids.map((id, i) =>
    kind === 'clear'
      ? clone(OCR_ROWS[id], { line: i, conf: { name: 96, strength: 95, dose: 94, freq: 92, duration: 91 }, verified: true })
      : clone(OCR_ROWS[id], { line: i }),
  )
  return { rows, lines: rows.map((r) => ({ raw: r.raw, smudged: r.unresolved })) }
}

/** Manually added rows have no image line (line = -1), so no "đối chiếu" check is required. */
export const emptyRow = (): DrugRow => ({
  id: `m${Date.now()}${Math.random().toString(36).slice(2, 6)}`,
  name: '',
  strength: '',
  dose: '',
  freq: '',
  duration: '',
  conf: {},
  verified: false,
  confirmed: [],
  line: -1,
  raw: ['', ''],
})

export const LOW_CONF = 80

const FIELDS: Field[] = ['name', 'strength', 'dose', 'freq', 'duration']

/** Fields below LOW_CONF. An unresolved name is handled by "Sửa tên thuốc" instead. */
export const lowFields = (r: DrugRow) => FIELDS.filter((f) => (r.conf[f] ?? 100) < LOW_CONF && !(f === 'name' && r.unresolved))

/** The drug can be ticked once every low-confidence field was edited or kept, and an unresolved name was fixed or marked. */
export const canVerify = (r: DrugRow) => lowFields(r).every((f) => r.confirmed.includes(f)) && !(r.unresolved && !r.marked)

/** Whether a drug still blocks "Xem kết quả". */
export const needsReview = (r: DrugRow) => !r.name.trim() || (r.unresolved && !r.marked) || (r.line >= 0 && !r.verified)

/** Number of drugs (not fields) still to review. */
export function pendingCount(rows: DrugRow[]) {
  return rows.filter(needsReview).length
}
