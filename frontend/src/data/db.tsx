/**
 * Single source of truth for all mock user data: the demo clock, Sổ tay entries,
 * saved prescriptions (and their status), scan scenarios, chat history and settings.
 * Drug reference knowledge (interactions, sources) lives in `drugs.ts`.
 */
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { InteractionStatus, Severity } from '@/components/status'
import { type DrugRow, lookupPair, type Pair } from './drugs'
import fixtures from './seed_fixtures.json'

/* ---------------- Clock ---------------- */
/** "Now" for the whole demo: Thứ Năm, 12/11/2026 09:15. */
export const NOW = new Date(2026, 10, 12, 9, 15)

const pad = (n: number) => String(n).padStart(2, '0')
/** Local datetime `yyyy-MM-ddTHH:mm`. */
export const toLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
/** Local day key `yyyy-MM-dd`. */
export const dayKeyOf = (d: Date) => toLocal(d).slice(0, 10)
export const TODAY_KEY = dayKeyOf(NOW)
const fromKey = (key: string) => new Date(key.slice(0, 10) + 'T00:00')

/** Datetime relative to NOW: `daysAgo` days before, at HH:mm. */
export function at(daysAgo: number, h: number, m: number) {
  const d = new Date(NOW)
  d.setDate(d.getDate() - daysAgo)
  d.setHours(h, m, 0, 0)
  return toLocal(d)
}

/** Whole days from the given day (key or datetime) to today. */
export function daysAgoOf(key: string) {
  return Math.round((fromKey(TODAY_KEY).getTime() - fromKey(key).getTime()) / 86400000)
}
/** dd/mm/yyyy */
export const fmtDate = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}/${key.slice(0, 4)}`
/** dd/mm */
export const fmtDayMonth = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`
/** "hôm nay" · "hôm qua" · "3 ngày trước" */
export function relDay(key: string) {
  const n = daysAgoOf(key)
  return n <= 0 ? 'hôm nay' : n === 1 ? 'hôm qua' : `${n} ngày trước`
}
export const WEEKDAY = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']
export const WEEKDAY_SHORT = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7']
export const weekdayOf = (key: string) => fromKey(key).getDay()

/** Days of the current week, Monday → Sunday. */
export function currentWeek(): string[] {
  const d = fromKey(TODAY_KEY)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return Array.from({ length: 7 }, (_, i) => {
    const x = new Date(d)
    x.setDate(d.getDate() + i)
    return dayKeyOf(x)
  })
}
/** Days of the current calendar month. */
export function currentMonth(): string[] {
  const y = NOW.getFullYear()
  const m = NOW.getMonth()
  const n = new Date(y, m + 1, 0).getDate()
  return Array.from({ length: n }, (_, i) => dayKeyOf(new Date(y, m, i + 1)))
}

/* ---------------- Glucose ---------------- */
export type GluUnit = 'mmol/L' | 'mg/dL'
const MGDL_PER_MMOL = 18
export const GLU_DECIMALS: Record<GluUnit, number> = { 'mmol/L': 1, 'mg/dL': 0 }
export const toMmol = (v: number, unit: GluUnit) => (unit === 'mmol/L' ? v : v / MGDL_PER_MMOL)
export const fromMmol = (mmol: number, unit: GluUnit) => (unit === 'mmol/L' ? mmol : mmol * MGDL_PER_MMOL)

/* ---------------- Sổ tay ---------------- */
export type Entry = {
  id: string
  at: string // local datetime yyyy-MM-ddTHH:mm
  bp?: [number, number]
  /** Stored in mmol/L; `entered` keeps what the user typed. */
  glu?: { mmol: number; entered: { v: number; unit: GluUnit } }
  wt?: number
  hr?: number
  note?: string
}

const glu = (v: number, unit: GluUnit): Entry['glu'] => ({ mmol: toMmol(v, unit), entered: { v, unit } })

export const JOURNAL_SEED: Entry[] = [
  { id: 'e1', at: at(0, 7, 30), bp: [122, 78], hr: 72, note: 'Đo sau khi ngủ dậy, trước bữa sáng. Ngủ được khoảng 7 tiếng.' },
  { id: 'e2', at: at(1, 21, 10), glu: glu(5.8, 'mmol/L'), note: 'Đo 2 giờ sau bữa tối.' },
  { id: 'e3', at: at(1, 6, 45), bp: [125, 80], wt: 62.4 },
  { id: 'e4', at: at(2, 20, 30), glu: glu(110, 'mg/dL') },
  { id: 'e5', at: at(3, 7, 5), bp: [119, 77], hr: 74, wt: 62.7, note: 'Hơi mệt sau khi đi bộ 30 phút buổi sáng, đã nghỉ ngơi 15 phút rồi mới đo lại.' },
  { id: 'e6', at: at(5, 7, 20), bp: [124, 79], hr: 75 },
  { id: 'e7', at: at(9, 20, 0), glu: glu(108, 'mg/dL') },
  { id: 'e8', at: at(24, 7, 15), bp: [128, 84], wt: 63.5 },
]

export type Metric = 'bp' | 'glu' | 'wt' | 'hr'
/** Entries that are not in the future, newest first. */
export const pastEntries = (list: Entry[]) => list.filter((e) => e.at <= toLocal(NOW)).sort((a, b) => b.at.localeCompare(a.at))
export const latestWith = (list: Entry[], m: Metric) => pastEntries(list).find((e) => e[m] !== undefined)

/* ---------------- Prescriptions ---------------- */
export type ResultDrug = { name: string; strength: string; unresolved?: boolean; freq?: string }
export type RxStatus = 'active' | 'ended' | 'unknown'
export const RX_STATUS_LABEL: Record<RxStatus, string> = { active: 'Đang dùng', ended: 'Đã kết thúc', unknown: 'Chưa xác định' }

export type Prescription = {
  id: string
  date: string // yyyy-MM-dd
  place: string
  /** Scan demo state that opens this prescription's result. */
  scenario: string
  drugs: ResultDrug[]
}

export const PRESCRIPTIONS: Prescription[] = [
  {
    id: 'rx-20260516',
    date: '2026-05-16',
    place: 'Phòng khám Đa khoa An Bình',
    scenario: 'resultMixed',
    drugs: [
      { name: 'Amlodipin', strength: '5 mg', freq: '1 lần/ngày' },
      { name: 'Simvastatin', strength: '20 mg', freq: '1 lần/ngày' },
      { name: 'Clarithromycin', strength: '500 mg', freq: '2 lần/ngày' },
      { name: 'Paracetamol', strength: '500 mg', freq: 'Khi sốt' },
    ],
  },
  {
    id: 'rx-20260428',
    date: '2026-04-28',
    place: 'Bệnh viện Nhân dân 115',
    scenario: 'resultInsufficient',
    drugs: [
      { name: 'Cao Actiso', strength: '200 mg' },
      { name: 'Boganic', strength: '170 mg' },
      { name: 'Bio-acimin', strength: '4 g' },
    ],
  },
]

/** The prescription shown in the sample photo used by the scan flow. */
export const SAMPLE_RX = PRESCRIPTIONS[0]
export const rxByScenario = (v: string) => PRESCRIPTIONS.find((p) => p.scenario === v)

/** Drug lists for every scan "Kết quả" demo state. */
export const RESULT_SCENARIOS: Record<string, ResultDrug[]> = {
  resultMixed: PRESCRIPTIONS[0].drugs,
  resultSevere: [
    { name: 'Clopidogrel', strength: '75mg' },
    { name: 'Omeprazole', strength: '20mg' },
  ],
  resultNoKnown: [
    { name: 'Amlodipin', strength: '5 mg' },
    { name: 'Paracetamol', strength: '500 mg' },
    { name: 'Omeprazol', strength: '20 mg' },
  ],
  resultUnresolved: [
    { name: 'Amlodipin', strength: '5 mg' },
    { name: 'Paracetamol', strength: '500 mg' },
    { name: 'Omeprazol', strength: '20 mg' },
    { name: 'Gluc—phag XR', strength: '750 mg', unresolved: true },
  ],
  resultInsufficient: PRESCRIPTIONS[1].drugs,
  resultFew: [
    { name: 'Paracetamol', strength: '500 mg' },
    { name: 'Gluc—phag XR', strength: '750 mg', unresolved: true },
  ],
}

/** Lines read by OCR from the sample photo. */
const base = (r: Omit<DrugRow, 'verified' | 'confirmed'>): DrugRow => ({ ...r, verified: false, confirmed: [] })
export const OCR_ROWS: Record<string, DrugRow> = {
  amlo: base({ id: 'amlo', name: 'Amlodipin', strength: '5 mg', dose: '1 viên', freq: '1 lần/ngày', duration: '30 ngày', conf: { name: 97, strength: 95, dose: 93, freq: 92, duration: 90 }, line: 0, raw: ['Amlodipin 5mg', 'SL 30 v — Sáng 1 viên'] }),
  simva: base({ id: 'simva', name: 'Simvastatin', strength: '20 mg', dose: '1 viên', freq: '1 lần/ngày', duration: '30 ngày', conf: { name: 94, strength: 62, dose: 91, freq: 88, duration: 90 }, line: 1, raw: ['Simvastatin 20mg', 'SL 30 v — Tối 1 viên'] }),
  clari: base({ id: 'clari', name: 'Clarithromycin', strength: '500 mg', dose: '1 viên', freq: '2 lần/ngày', duration: '7 ngày', conf: { name: 71, strength: 90, dose: 89, freq: 74, duration: 86 }, line: 2, raw: ['Clarithromycin 500mg', 'SL 14 v — Sáng 1, tối 1'] }),
  para: base({ id: 'para', name: 'Paracetamol', strength: '500 mg', dose: '1 viên', freq: 'Khi sốt > 38,5°C', duration: '5 ngày', conf: { name: 98, strength: 96, dose: 92, freq: 84, duration: 85 }, line: 3, raw: ['Paracetamol 500mg', 'SL 10 v — Khi sốt'] }),
  unres: base({ id: 'unres', name: 'Gluc—phag XR', strength: '750 mg', dose: '1 viên', freq: '1 lần/ngày', duration: '30 ngày', conf: { name: 38, strength: 66, dose: 90, freq: 88, duration: 87 }, unresolved: true, line: 3, raw: ['Gluc~phag XR 750', 'SL 30 v — Tối 1 viên'] }),
}

export function pairsOf(drugs: ResultDrug[]): Pair[] {
  const out: Pair[] = []
  for (let i = 0; i < drugs.length; i++)
    for (let j = i + 1; j < drugs.length; j++) out.push(lookupPair(drugs[i].name, drugs[j].name, !!(drugs[i].unresolved || drugs[j].unresolved)))
  return out
}

const SEV_RANK: Record<Severity, number> = { major: 3, moderate: 2, minor: 1 }
/** The most important status in a prescription, for list rows. */
export function rxSummary(drugs: ResultDrug[]): { status: InteractionStatus; severity?: Severity } {
  const pairs = pairsOf(drugs)
  const found = pairs.filter((p) => p.status === 'INTERACTION_FOUND')
  if (found.length) {
    const top = found.reduce((a, b) => (SEV_RANK[b.severity ?? 'minor'] > SEV_RANK[a.severity ?? 'minor'] ? b : a))
    return { status: 'INTERACTION_FOUND', severity: top.severity }
  }
  for (const s of ['UNRESOLVED_DRUG', 'INSUFFICIENT_DATA'] as const) if (pairs.some((p) => p.status === s)) return { status: s }
  return { status: 'NO_KNOWN_INTERACTION' }
}

export type SevereAlert = { rx: Prescription; pair: Pair; countInRx: number }
/** Every "Mức nghiêm trọng" interaction in saved prescriptions, skipping prescriptions marked "Đã kết thúc". */
export function severeInteractions(statusOf: (id: string) => RxStatus, rxList?: Prescription[]): SevereAlert[] {
  const list = rxList ?? PRESCRIPTIONS
  return list.filter((rx) => statusOf(rx.id) !== 'ended').flatMap((rx) => {
    const pairs = pairsOf(rx.drugs).filter((p) => p.status === 'INTERACTION_FOUND' && p.severity === 'major')
    return pairs.map((pair) => ({ rx, pair, countInRx: pairs.length }))
  })
}

/* ---------------- User Profile & Fixtures ---------------- */
export type UserProfileData = {
  fullName: string
  dob: string
  gender: string
  phone: string
  conditions: string[]
  allergies: string[]
}

export type UserFixtureData = {
  profile: UserProfileData
  entries: Entry[]
  prescriptions: Prescription[]
}

export function getCurrentUserEmail(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('vitap-user-email')
}

export function loadUserFixture(email: string): UserFixtureData {
  const f = (fixtures as Record<string, any>)[email]
  const base: UserFixtureData = f
    ? {
        profile: { ...f.profile },
        entries: f.entries ?? [],
        prescriptions: f.prescriptions ?? [],
      }
    : {
        profile: {
          fullName: email.split('@')[0],
          dob: '',
          gender: '',
          phone: '',
          conditions: [],
          allergies: [],
        },
        entries: [],
        prescriptions: [],
      }

  if (typeof window !== 'undefined') {
    const savedProfile = localStorage.getItem(`vitap-profile-${email}`)
    if (savedProfile) {
      try {
        base.profile = { ...base.profile, ...JSON.parse(savedProfile) }
      } catch {
        // ignore
      }
    }
    const savedRx = localStorage.getItem(`vitap-prescriptions-${email}`)
    if (savedRx) {
      try {
        base.prescriptions = JSON.parse(savedRx)
      } catch {
        // ignore
      }
    }
    const savedEntries = localStorage.getItem(`vitap-entries-${email}`)
    if (savedEntries) {
      try {
        base.entries = JSON.parse(savedEntries)
      } catch {
        // ignore
      }
    }
  }
  return base
}

/* ---------------- Trợ lý AI ---------------- */
export type ChatSeedKind = 'conversation' | 'refusal' | 'insufficient' | 'emergency'
export const CHAT_SESSIONS: { id: string; title: string; at: string; kind: ChatSeedKind }[] = [
  { id: 's1', title: `Thuốc trong đơn ${fmtDayMonth(SAMPLE_RX.date)} dùng để làm gì?`, at: at(0, 8, 42), kind: 'conversation' },
  { id: 's2', title: 'Có nên ngừng Simvastatin không?', at: at(1, 19, 20), kind: 'refusal' },
  { id: 's3', title: 'Boganic uống cùng men vi sinh', at: at(6, 15, 5), kind: 'insufficient' },
  { id: 's4', title: 'Sưng môi, khó thở sau khi uống thuốc', at: at(14, 21, 40), kind: 'emergency' },
]

/* ---------------- Shared store ---------------- */
type DataCtx = {
  entries: Entry[]
  setEntries: (fn: (list: Entry[]) => Entry[]) => void
  prescriptions: Prescription[]
  setPrescriptions: (fn: (list: Prescription[]) => Prescription[]) => void
  profile: UserProfileData
  setProfile: (p: UserProfileData) => void
  rxStatus: (id: string) => RxStatus
  setRxStatus: (id: string, s: RxStatus) => void
  gluUnit: GluUnit
  setGluUnit: (u: GluUnit) => void
  currentUserEmail: string | null
}

const Ctx = createContext<DataCtx | null>(null)

export function DataProvider({ children, overrideEmail }: { children: ReactNode; overrideEmail?: string }) {
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(() => {
    if (overrideEmail !== undefined) return overrideEmail
    return getCurrentUserEmail()
  })

  const currentFixture = useMemo<UserFixtureData>(() => {
    if (currentUserEmail) {
      return loadUserFixture(currentUserEmail)
    }
    return {
      profile: { fullName: 'Khách', dob: '', gender: '', phone: '', conditions: [], allergies: [] },
      entries: [],
      prescriptions: [],
    }
  }, [currentUserEmail])

  const [entries, setEntriesState] = useState<Entry[]>(() => currentFixture.entries)
  const [prescriptions, setPrescriptionsState] = useState<Prescription[]>(() => currentFixture.prescriptions)
  const [profile, setProfileState] = useState<UserProfileData>(() => currentFixture.profile)
  const [statuses, setStatuses] = useState<Record<string, RxStatus>>({})
  const [gluUnit, setGluUnit] = useState<GluUnit>(() => (typeof window !== 'undefined' && localStorage.getItem('vitap-glu-unit') === 'mg/dL' ? 'mg/dL' : 'mmol/L'))

  // Synchronize state when the active persona changes
  useEffect(() => {
    setEntriesState(currentFixture.entries)
    setPrescriptionsState(currentFixture.prescriptions)
    setProfileState(currentFixture.profile)
  }, [currentFixture])

  useEffect(() => {
    if (typeof window === 'undefined') return
    localStorage.setItem('vitap-glu-unit', gluUnit)
  }, [gluUnit])

  useEffect(() => {
    if (overrideEmail !== undefined) {
      setCurrentUserEmail(overrideEmail)
      return
    }
    const onAuthChange = () => {
      setCurrentUserEmail(getCurrentUserEmail())
    }
    window.addEventListener('storage', onAuthChange)
    window.addEventListener('vitap-auth-change', onAuthChange)
    return () => {
      window.removeEventListener('storage', onAuthChange)
      window.removeEventListener('vitap-auth-change', onAuthChange)
    }
  }, [overrideEmail])

  const setEntries = useCallback(
    (fn: (l: Entry[]) => Entry[]) => {
      setEntriesState((prev) => {
        const next = fn(prev)
        if (typeof window !== 'undefined' && currentUserEmail) {
          localStorage.setItem(`vitap-entries-${currentUserEmail}`, JSON.stringify(next))
        }
        return next
      })
    },
    [currentUserEmail],
  )
  const setPrescriptions = useCallback(
    (fn: (l: Prescription[]) => Prescription[]) => {
      setPrescriptionsState((prev) => {
        const next = fn(prev)
        if (typeof window !== 'undefined' && currentUserEmail) {
          localStorage.setItem(`vitap-prescriptions-${currentUserEmail}`, JSON.stringify(next))
        }
        return next
      })
    },
    [currentUserEmail],
  )
  const setProfile = useCallback(
    (p: UserProfileData) => {
      setProfileState(p)
      if (typeof window !== 'undefined' && currentUserEmail) {
        localStorage.setItem(`vitap-profile-${currentUserEmail}`, JSON.stringify(p))
      }
    },
    [currentUserEmail],
  )
  const setRxStatus = useCallback((id: string, s: RxStatus) => setStatuses((m) => ({ ...m, [id]: s })), [])

  const value = useMemo<DataCtx>(
    () => ({
      entries,
      setEntries,
      prescriptions,
      setPrescriptions,
      profile,
      setProfile,
      rxStatus: (id) => statuses[id] ?? 'unknown',
      setRxStatus,
      gluUnit,
      setGluUnit,
      currentUserEmail,
    }),
    [entries, setEntries, prescriptions, setPrescriptions, profile, statuses, setRxStatus, gluUnit, currentUserEmail],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useData() {
  const c = useContext(Ctx)
  if (!c) throw new Error('useData outside DataProvider')
  return c
}

export function useDataSafe() {
  return useContext(Ctx)
}
