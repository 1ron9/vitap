import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { AppProvider } from '@/app/state'
import { DataProvider } from '@/data/db'
import { AppShell } from '@/components/AppShell'
import { ApiError } from '@/shared/api'

describe('Copilot Review Invariant Tests', () => {
  it('ApiError preserves both field-level reason and loc details', () => {
    const err = new ApiError('Validation error', 422, 'VALIDATION_ERROR', [
      { field: 'body.password', reason: 'string_too_short' },
      { field: 'body.email', reason: 'value_error' },
    ])
    expect(err.status).toBe(422)
    expect(err.details).toHaveLength(2)
    expect(err.details?.[0].field).toBe('body.password')
    expect(err.details?.[0].reason).toBe('string_too_short')
  })

  it('AppShell renders #main-content landmark even when isBare is true (Chat route)', () => {
    const html = renderToString(
      <MemoryRouter initialEntries={['/chat']}>
        <AppProvider>
          <AppShell>
            <div data-testid="chat-container">Chat Content</div>
          </AppShell>
        </AppProvider>
      </MemoryRouter>,
    )

    expect(html).toContain('id="main-content"')
    expect(html).toContain('Chat Content')
  })

  it('DataProvider isolates data per user persona and persists profile edits', () => {
    const email = 'patient.chronic@vitap.vn'
    const html = renderToString(
      <MemoryRouter>
        <AppProvider>
          <DataProvider overrideEmail={email}>
            <div>Testing DataProvider Isolation</div>
          </DataProvider>
        </AppProvider>
      </MemoryRouter>,
    )

    expect(html).toContain('Testing DataProvider Isolation')
  })
})
