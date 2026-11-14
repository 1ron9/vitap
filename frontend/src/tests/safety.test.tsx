import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { lookupPair } from '@/data/drugs'
import { fromMmol, rxSummary, severeInteractions, toMmol, type Prescription, type RxStatus } from '@/data/db'
import { STATUS_NOTE, StatusPill, type InteractionStatus, type Severity } from '@/components/status'

describe('Clinical Safety - lookupPair', () => {
  it('identifies major severity interaction between Clarithromycin and Simvastatin', () => {
    const res = lookupPair('Clarithromycin', 'Simvastatin', false)
    expect(res.status).toBe('INTERACTION_FOUND')
    expect(res.severity).toBe('major')
    expect(res.sources).toContain('dtqg')
    expect(res.sources).toContain('stockley')
    expect(res.plain).toBeDefined()
  })

  it('is order-independent for drug pairs', () => {
    const forward = lookupPair('Clarithromycin', 'Simvastatin', false)
    const reverse = lookupPair('Simvastatin', 'Clarithromycin', false)
    expect(forward.status).toBe(reverse.status)
    expect(forward.severity).toBe(reverse.severity)
    expect(forward.text).toBe(reverse.text)
  })

  it('identifies moderate interaction for Amlodipin and Simvastatin', () => {
    const res = lookupPair('Amlodipin', 'Simvastatin', false)
    expect(res.status).toBe('INTERACTION_FOUND')
    expect(res.severity).toBe('moderate')
  })

  it('identifies minor interaction for Amlodipin and Clarithromycin', () => {
    const res = lookupPair('Amlodipin', 'Clarithromycin', false)
    expect(res.status).toBe('INTERACTION_FOUND')
    expect(res.severity).toBe('minor')
  })

  it('returns NO_KNOWN_INTERACTION for known non-interacting pairs', () => {
    const res = lookupPair('Amlodipin', 'Paracetamol', false)
    expect(res.status).toBe('NO_KNOWN_INTERACTION')
    expect(res.severity).toBeUndefined()
  })

  it('returns INSUFFICIENT_DATA when pair is not in local knowledge base', () => {
    const res = lookupPair('Atorvastatin', 'Ibuprofen', false)
    expect(res.status).toBe('INSUFFICIENT_DATA')
    expect(res.text).toContain('chưa có đủ bằng chứng')
    expect(res.sources).toContain('dtqg')
  })

  it('returns UNRESOLVED_DRUG with empty sources when any drug is unresolved', () => {
    const res = lookupPair('Gluc—phag XR', 'Amlodipin', true)
    expect(res.status).toBe('UNRESOLVED_DRUG')
    expect(res.text).toContain('chưa được nhận diện')
    expect(res.sources).toEqual([])
  })
})

describe('Clinical Safety - rxSummary severity precedence', () => {
  it('prioritizes major over moderate and minor', () => {
    const drugs = [
      { name: 'Clarithromycin', strength: '500 mg' },
      { name: 'Simvastatin', strength: '20 mg' },
      { name: 'Amlodipin', strength: '5 mg' },
    ]
    const summary = rxSummary(drugs)
    expect(summary.status).toBe('INTERACTION_FOUND')
    expect(summary.severity).toBe('major')
  })

  it('returns UNRESOLVED_DRUG before INSUFFICIENT_DATA if no interaction found', () => {
    const drugs = [
      { name: 'Paracetamol', strength: '500 mg' },
      { name: 'Gluc—phag XR', strength: '750 mg', unresolved: true },
    ]
    const summary = rxSummary(drugs)
    expect(summary.status).toBe('UNRESOLVED_DRUG')
  })

  it('returns NO_KNOWN_INTERACTION when all pairs have no known interactions', () => {
    const drugs = [
      { name: 'Amlodipin', strength: '5 mg' },
      { name: 'Paracetamol', strength: '500 mg' },
      { name: 'Omeprazol', strength: '20 mg' },
    ]
    const summary = rxSummary(drugs)
    expect(summary.status).toBe('NO_KNOWN_INTERACTION')
  })
})

describe('Clinical Safety - severeInteractions active filtering', () => {
  it('excludes prescriptions marked as ended', () => {
    const rxActive: Prescription = {
      id: 'rx-test-active',
      date: '2026-05-16',
      place: 'Phòng khám Test A',
      scenario: 'resultMixed',
      drugs: [
        { name: 'Simvastatin', strength: '20 mg' },
        { name: 'Clarithromycin', strength: '500 mg' },
      ],
    }
    const rxEnded: Prescription = {
      id: 'rx-test-ended',
      date: '2026-04-28',
      place: 'Phòng khám Test B',
      scenario: 'resultSevere',
      drugs: [
        { name: 'Simvastatin', strength: '20 mg' },
        { name: 'Clarithromycin', strength: '500 mg' },
      ],
    }

    const statusMap: Record<string, RxStatus> = {
      'rx-test-active': 'active',
      'rx-test-ended': 'ended',
    }
    const alerts = severeInteractions((id) => statusMap[id] ?? 'active', [rxActive, rxEnded])

    expect(alerts.length).toBeGreaterThan(0)
    for (const a of alerts) {
      expect(a.pair.status).toBe('INTERACTION_FOUND')
      expect(a.pair.severity).toBe('major')
      expect(a.rx.id).toBe('rx-test-active')
      expect(a.rx.id).not.toBe('rx-test-ended')
    }
  })
})

describe('Clinical Safety - Blood Glucose Unit Conversions', () => {
  it('converts correctly between mmol/L and mg/dL without precision drift', () => {
    expect(toMmol(5.5, 'mmol/L')).toBe(5.5)
    expect(toMmol(180, 'mg/dL')).toBe(10)
    expect(fromMmol(10, 'mg/dL')).toBe(180)
    expect(fromMmol(5.5, 'mmol/L')).toBe(5.5)
  })
})

describe('Clinical UI Safety Invariant - StatusPill & Color Ban', () => {
  it('renders mandatory clinical safety notes for NO_KNOWN_INTERACTION and INSUFFICIENT_DATA', () => {
    const noKnownHtml = renderToString(<StatusPill status="NO_KNOWN_INTERACTION" showSubline={true} />)
    expect(noKnownHtml).toContain(STATUS_NOTE.NO_KNOWN_INTERACTION)

    const insufficientHtml = renderToString(<StatusPill status="INSUFFICIENT_DATA" showSubline={true} />)
    expect(insufficientHtml).toContain(STATUS_NOTE.INSUFFICIENT_DATA)
  })

  it('renders locked indicator for NO_KNOWN_INTERACTION when locked is true', () => {
    const html = renderToString(<StatusPill status="NO_KNOWN_INTERACTION" locked={true} />)
    expect(html).toContain('chưa kết luận')
  })

  it('NEVER outputs green classes or green hues on any status variant', () => {
    const scenarios: { status: InteractionStatus; severity?: Severity; locked?: boolean }[] = [
      { status: 'INTERACTION_FOUND', severity: 'major' },
      { status: 'INTERACTION_FOUND', severity: 'moderate' },
      { status: 'INTERACTION_FOUND', severity: 'minor' },
      { status: 'NO_KNOWN_INTERACTION' },
      { status: 'NO_KNOWN_INTERACTION', locked: true },
      { status: 'INSUFFICIENT_DATA' },
      { status: 'UNRESOLVED_DRUG' },
    ]

    for (const s of scenarios) {
      const html = renderToString(
        <StatusPill status={s.status} severity={s.severity} locked={s.locked} showSubline={true} />,
      )
      // Assert that no green class is ever output
      expect(html).not.toMatch(/text-green/)
      expect(html).not.toMatch(/bg-green/)
      expect(html).not.toMatch(/border-green/)
      expect(html).not.toMatch(/#[0-9a-fA-F]*22c55e/)
    }
  })
})
