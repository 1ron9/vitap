import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { AppProvider } from '@/app/state'
import { DataProvider } from '@/data/db'
import { Dashboard } from '@/screens/Dashboard'

describe('Natural Screen Rendering', () => {
  it('renders Dashboard with EmptyState when entries are empty', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/dashboard?role=member']}>
        <AppProvider>
          <DataProvider overrideEmail="patient.empty@vitap.vn">
            <Dashboard />
          </DataProvider>
        </AppProvider>
      </MemoryRouter>
    )
    expect(html).toContain('Chưa có dữ liệu để hiển thị')
    expect(html).toContain('Hãy thêm chỉ số đầu tiên vào Sổ tay')
  })

  it('renders Dashboard with AttentionCard when severe interaction exists', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/dashboard?role=member']}>
        <AppProvider>
          <DataProvider overrideEmail="patient.ddi@vitap.vn">
            <Dashboard />
          </DataProvider>
        </AppProvider>
      </MemoryRouter>
    )
    expect(html).toContain('Cần chú ý')
    expect(html).toContain('Clopidogrel')
    expect(html).toContain('Omeprazole')
    expect(html).toContain('Có tương tác thuốc')
  })
})
