import { describe, it, expect } from 'vitest'
import fixtures from '@/data/seed_fixtures.json'
import { loadUserFixture } from '@/data/db'

describe('User Fixtures & Data Loader', () => {
  it('contains three standardized personas', () => {
    expect(fixtures['patient.chronic@vitap.vn']).toBeDefined()
    expect(fixtures['patient.ddi@vitap.vn']).toBeDefined()
    expect(fixtures['patient.empty@vitap.vn']).toBeDefined()
  })

  it('loads 30-day health entries for chronic patient', () => {
    const data = loadUserFixture('patient.chronic@vitap.vn')
    expect(data.entries.length).toBeGreaterThanOrEqual(20)
    expect(data.prescriptions.length).toBeGreaterThanOrEqual(1)
    expect(data.profile.fullName).toBe('Nguyễn Văn An')
  })

  it('loads critical DDI prescription for DDI patient', () => {
    const data = loadUserFixture('patient.ddi@vitap.vn')
    expect(data.prescriptions[0].drugs.some(d => d.name.includes('Clopidogrel'))).toBe(true)
  })

  it('loads empty datasets for empty patient', () => {
    const data = loadUserFixture('patient.empty@vitap.vn')
    expect(data.entries).toEqual([])
    expect(data.prescriptions).toEqual([])
  })
})

