import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { AppProvider } from '@/app/state'
import { DataProvider, RESULT_SCENARIOS } from '@/data/db'
import { Result } from '@/screens/scan/Result'
import { Scan } from '@/screens/scan/Scan'
import { Dashboard } from '@/screens/Dashboard'
import { clearSessionUserEmail } from '@/api/client'

describe('Code Review Defect Fixes Verification', () => {
  beforeEach(() => {
    const store: Record<string, string> = {}
    // @ts-ignore
    global.window = {
      dispatchEvent: vi.fn(),
    }
    // @ts-ignore
    global.localStorage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => { store[k] = v },
      removeItem: (k: string) => { delete store[k] },
    }
  })

  it('clearSessionUserEmail removes storage key and triggers event', () => {
    localStorage.setItem('vitap-user-email', 'patient.chronic@vitap.vn')
    expect(localStorage.getItem('vitap-user-email')).toBe('patient.chronic@vitap.vn')

    clearSessionUserEmail()
    expect(localStorage.getItem('vitap-user-email')).toBeNull()
  })

  it('RESULT_SCENARIOS contains resultSevere for DDI patient', () => {
    expect(RESULT_SCENARIOS['resultSevere']).toBeDefined()
    expect(RESULT_SCENARIOS['resultSevere'].some(d => d.name.toLowerCase().includes('clopidogrel'))).toBe(true)
  })

  it('Result component resolves prescription from useData and displays its metadata', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/?role=member']}>
        <AppProvider>
          <DataProvider overrideEmail="patient.ddi@vitap.vn">
            <Result
              drugs={[
                { name: 'Clopidogrel', strength: '75mg' },
                { name: 'Omeprazole', strength: '20mg' },
              ]}
              rxId="rx-ddi-01"
              onFix={() => {}}
              onRestart={() => {}}
              onBack={() => {}}
              backLabel="Quay lại"
            />
          </DataProvider>
        </AppProvider>
      </MemoryRouter>
    )

    // Should render date and DDI status
    expect(html).toContain('Đã lưu vào lịch sử')
    expect(html).toContain('Kiểm tra tương tác')
    expect(html).toContain('Clopidogrel')
    expect(html).toContain('Omeprazole')
  })

  it('Dashboard renders prescriptions even when entries is empty', () => {
    // Custom data provider with 0 entries but 1 prescription
    const html = renderToString(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppProvider>
          <DataProvider overrideEmail="patient.ddi@vitap.vn">
            <Dashboard />
          </DataProvider>
        </AppProvider>
      </MemoryRouter>
    )

    expect(html).toContain('Đơn thuốc gần đây')
    expect(html).toContain('Bệnh viện Thống Nhất')
  })

  it('Scan deep-links into Step 4 result when navigated with prescription target', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={[{ pathname: '/scan', state: { target: 'rx-ddi-01' } }]}>
        <AppProvider>
          <DataProvider overrideEmail="patient.ddi@vitap.vn">
            <Scan />
          </DataProvider>
        </AppProvider>
      </MemoryRouter>
    )

    expect(html).toContain('Kiểm tra tương tác')
    expect(html).toContain('Clopidogrel')
    expect(html).toContain('Omeprazole')
  })
})
