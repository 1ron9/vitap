import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { AppProvider } from '@/app/state'
import { AppShell } from '@/components/AppShell'

describe('AppShell without DemoPanel', () => {
  it('renders AppShell navigation without any design status panel', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AppProvider>
          <AppShell>
            <div>Dashboard Content</div>
          </AppShell>
        </AppProvider>
      </MemoryRouter>
    )
    expect(html).not.toContain('Bảng trạng thái thiết kế')
    expect(html).not.toContain('Trạng thái thiết kế')
    expect(html).toContain('Dashboard Content')
  })
})
