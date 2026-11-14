import { currentMonth, currentWeek, type Entry, fmtDayMonth, fromMmol, GLU_DECIMALS, type GluUnit, type Metric, pastEntries, TODAY_KEY, WEEKDAY, WEEKDAY_SHORT, weekdayOf } from './db'

export type Range = 'day' | 'week' | 'month'
/** `v: null` = no Sổ tay entry for that slot (no point is drawn). */
export type Point = { t: string; full: string; v: number | null }
export type Series = { name: string; color: string; dashed?: boolean; data: Point[] }

type Slot = { t: string; full: string; entries: Entry[] }

// TODO(clinical): Reference ranges to be reviewed by clinical team
export const BP_SYSTOLIC_BAND: [number, number] = [90, 120]
export const BP_DIASTOLIC_BAND: [number, number] = [60, 80]
export const GLU_FASTING_BAND_MMOL: [number, number] = [3.9, 7.2]
export const HR_RESTING_BAND: [number, number] = [60, 100]

/** X-axis slots for a range, each holding that slot's Sổ tay entries (newest first). Future days stay empty. */
function slots(r: Range, list: Entry[]): Slot[] {
  const past = pastEntries(list)
  if (r === 'day')
    return past
      .filter((e) => e.at.startsWith(TODAY_KEY))
      .reverse()
      .map((e) => ({ t: e.at.slice(11, 16), full: `Hôm nay, ${e.at.slice(11, 16)}`, entries: [e] }))
  const days = r === 'week' ? currentWeek() : currentMonth()
  return days.map((k, i) => {
    const dm = fmtDayMonth(k)
    const t = r === 'week' ? WEEKDAY_SHORT[weekdayOf(k)] : i === 0 || (i + 1) % 5 === 0 ? dm : ''
    return { t, full: `${WEEKDAY[weekdayOf(k)]}, ${dm}`, entries: past.filter((e) => e.at.startsWith(k)) }
  })
}

const build = (r: Range, list: Entry[], pick: (e: Entry) => number | undefined): Point[] =>
  slots(r, list).map((s) => {
    const e = s.entries.find((x) => pick(x) !== undefined)
    return { t: s.t, full: s.full, v: e ? pick(e)! : null }
  })

export type ChartDef = {
  id: Metric
  title: string
  unit: string
  yTitle: string
  decimals: number
  series: (r: Range, list: Entry[]) => Series[]
  yRange?: (list: Entry[]) => [number, number]
  bands?: [number, number][]
  bandLabels?: string[]
  insight?: (r: Range, list: Entry[]) => string
}

function getRangeEntries(r: Range, list: Entry[]): Entry[] {
  const past = pastEntries(list)
  if (r === 'day') return past.filter((e) => e.at.startsWith(TODAY_KEY))
  const days = r === 'week' ? currentWeek() : currentMonth()
  const startDay = days[0]
  const endDay = days[days.length - 1]
  return past.filter((e) => {
    const day = e.at.slice(0, 10)
    return day >= startDay && day <= endDay
  })
}

export function chartDefs(gluUnit: GluUnit): ChartDef[] {
  return [
    {
      id: 'bp',
      title: 'Huyết áp',
      unit: 'mmHg',
      yTitle: 'Huyết áp (mmHg)',
      decimals: 0,
      yRange: () => [60, 160],
      bands: [BP_DIASTOLIC_BAND, BP_SYSTOLIC_BAND],
      bandLabels: ['Tham khảo (tâm trương)', 'Tham khảo (tâm thu)'],
      insight: (r, list) => {
        const entries = getRangeEntries(r, list).filter((e) => e.bp)
        if (entries.length < 3) return 'Chưa đủ ghi chép để nhận xét (cần ít nhất 3 ngày).'
        const outCount = entries.filter(
          (e) =>
            e.bp![0] < BP_SYSTOLIC_BAND[0] ||
            e.bp![0] > BP_SYSTOLIC_BAND[1] ||
            e.bp![1] < BP_DIASTOLIC_BAND[0] ||
            e.bp![1] > BP_DIASTOLIC_BAND[1],
        ).length
        if (outCount === 0) return `Trong khoảng tham khảo cả ${entries.length} ngày có ghi chép.`
        return `${outCount}/${entries.length} ngày ngoài khoảng tham khảo.`
      },
      series: (r, l) => [
        { name: 'Tâm thu', color: 'var(--color-chart-1)', data: build(r, l, (e) => e.bp?.[0]) },
        { name: 'Tâm trương', color: 'var(--color-aqua)', dashed: true, data: build(r, l, (e) => e.bp?.[1]) },
      ],
    },
    {
      id: 'glu',
      title: 'Đường huyết',
      unit: gluUnit,
      yTitle: `Đường huyết (${gluUnit})`,
      decimals: GLU_DECIMALS[gluUnit],
      yRange: () =>
        gluUnit === 'mmol/L'
          ? [3, 10]
          : [fromMmol(3, gluUnit), fromMmol(10, gluUnit)],
      bands: [
        [
          fromMmol(GLU_FASTING_BAND_MMOL[0], gluUnit),
          fromMmol(GLU_FASTING_BAND_MMOL[1], gluUnit),
        ],
      ],
      bandLabels: ['Khoảng tham khảo'],
      insight: (r, list) => {
        const entries = getRangeEntries(r, list).filter((e) => e.glu)
        if (entries.length < 3) return 'Chưa đủ ghi chép để nhận xét (cần ít nhất 3 ngày).'
        const outCount = entries.filter(
          (e) =>
            e.glu!.mmol < GLU_FASTING_BAND_MMOL[0] ||
            e.glu!.mmol > GLU_FASTING_BAND_MMOL[1],
        ).length
        if (outCount === 0) return `Trong khoảng tham khảo cả ${entries.length} ngày có ghi chép.`
        return `${outCount}/${entries.length} ngày ngoài khoảng tham khảo.`
      },
      series: (r, l) => [
        { name: 'Đường huyết', color: 'var(--color-chart-3)', data: build(r, l, (e) => (e.glu ? fromMmol(e.glu.mmol, gluUnit) : undefined)) },
      ],
    },
    {
      id: 'wt',
      title: 'Cân nặng',
      unit: 'kg',
      yTitle: 'Cân nặng (kg)',
      decimals: 1,
      yRange: (list) => {
        const past = pastEntries(list).filter((e) => e.wt != null)
        const latest = past[0]?.wt ?? 60
        return [Math.max(20, latest - 5), latest + 5]
      },
      insight: (r, list) => {
        const entries = getRangeEntries(r, list).filter((e) => e.wt != null)
        if (entries.length < 2) return 'Chưa đủ ghi chép để nhận xét.'
        const oldest = entries[entries.length - 1].wt!
        const newest = entries[0].wt!
        const diff = +(newest - oldest).toFixed(1)
        if (Math.abs(diff) < 0.1) return 'Cân nặng ổn định qua các lần ghi chép.'
        if (diff > 0) return `Tăng ${fmt(diff, 1)} kg so với lần ghi chép đầu tiên.`
        return `Giảm ${fmt(Math.abs(diff), 1)} kg so với lần ghi chép đầu tiên.`
      },
      series: (r, l) => [
        { name: 'Cân nặng', color: 'var(--color-chart-2)', data: build(r, l, (e) => e.wt) },
      ],
    },
    {
      id: 'hr',
      title: 'Nhịp tim',
      unit: 'bpm',
      yTitle: 'Nhịp tim (bpm)',
      decimals: 0,
      yRange: () => [40, 120],
      bands: [HR_RESTING_BAND],
      bandLabels: ['Khoảng tham khảo'],
      insight: (r, list) => {
        const entries = getRangeEntries(r, list).filter((e) => e.hr != null)
        if (entries.length < 3) return 'Chưa đủ ghi chép để nhận xét (cần ít nhất 3 ngày).'
        const outCount = entries.filter(
          (e) => e.hr! < HR_RESTING_BAND[0] || e.hr! > HR_RESTING_BAND[1],
        ).length
        if (outCount === 0) return `Trong khoảng tham khảo cả ${entries.length} ngày có ghi chép.`
        return `${outCount}/${entries.length} ngày ngoài khoảng tham khảo.`
      },
      series: (r, l) => [
        { name: 'Nhịp tim', color: 'var(--color-chart-5)', data: build(r, l, (e) => e.hr) },
      ],
    },
  ]
}

export const fmt = (v: number, d: number) => v.toLocaleString('vi-VN', { minimumFractionDigits: d, maximumFractionDigits: d })

/** Validation limits are delivered by the backend; mocked here as the API response. */
export const BACKEND_LIMITS = {
  systolic: [50, 260],
  diastolic: [30, 160],
  glucose_mgdl: [20, 600],
  glucose_mmol: [1.1, 33.3],
  weight: [2, 350],
  heartRate: [25, 250],
} as const

export const MAX_UPLOAD_MB = 20
