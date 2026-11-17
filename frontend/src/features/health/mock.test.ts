// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { mockHealthApi } from './mock'
import type { Declaration, Entry, Page, Preferences } from './types'

beforeEach(() => { localStorage.setItem('vitap-user-email', `${crypto.randomUUID()}@example.test`) })
describe('offline M1 adapter protocol', () => {
  it('preserves glucose input and atomically rejects an invalid aggregate', async () => {
    const entry = await mockHealthApi<Entry>('/entries','POST',{title:'Original',recorded_at:'2020-01-01T00:00:00Z',observations:[{observation_type:'GLUCOSE',value:100,unit:'mg/dL'}]})
    expect(entry.observations[0]).toMatchObject({value:5.5556,unit:'mmol/L',entered_value:100,entered_unit:'mg/dL'})
    await expect(mockHealthApi(`/entries/${entry.id}/aggregate`,'PATCH',{entry:{title:'Must rollback'},observations:{update:[{id:entry.observations[0].id,value:-1}]}})).rejects.toThrow()
    expect((await mockHealthApi<Entry>(`/entries/${entry.id}`)).title).toBe('Original')
  })
  it('distinguishes no-known-allergy confirmation from empty lists', async () => {
    expect((await mockHealthApi<Declaration>('/allergy-declaration')).state).toBe('UNKNOWN')
    await mockHealthApi('/allergy-declaration','PUT',{state:'NO_KNOWN_ALLERGIES'})
    const allergy=await mockHealthApi<{id:string}>('/allergies','POST',{allergen_name:'Demo',allergen_type:'OTHER'})
    expect((await mockHealthApi<Declaration>('/allergy-declaration')).state).toBe('HAS_ALLERGIES')
    await mockHealthApi(`/allergies/${allergy.id}`,'DELETE')
    expect((await mockHealthApi<Declaration>('/allergy-declaration')).state).toBe('UNKNOWN')
  })
  it('isolates mock resources per email and keeps preferences separate', async () => {
    await mockHealthApi('/preferences','PATCH',{allow_ai_health_context:false})
    await mockHealthApi('/entries','POST',{title:'A-only',recorded_at:'2020-01-01T00:00:00Z',observations:[]})
    localStorage.setItem('vitap-user-email',`${crypto.randomUUID()}@example.test`)
    expect((await mockHealthApi<Page<Entry>>('/entries')).items).toEqual([])
    expect((await mockHealthApi<Preferences>('/preferences')).allow_ai_health_context).toBe(true)
  })
})
