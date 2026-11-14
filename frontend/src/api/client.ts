import { api, type ErrorEnvelope, type Identity, mockMode, setCredentials, type TokenPair } from '@/shared/api'
import { CHAT_SESSIONS } from '@/data/db'

export type { Identity, TokenPair, ErrorEnvelope }
export { mockMode, setCredentials }

export interface LoginPayload {
  email: string
  password: string
}

export interface RegisterPayload {
  email: string
  password: string
  full_name: string
  consent?: {
    is_accepted: boolean
    version: string
    scope: string
  }
}

export interface GuestSessionPayload {
  consent_accepted?: boolean
  consent_version?: string
}

export interface GuestSessionResponse {
  id: string
  guest_token: string
  consent_accepted: boolean
  consent_version: string
  created_at: string
  expires_at: string
}

export interface ChatSession {
  id: string
  title: string
  created_at: string
  updated_at?: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: string[]
  created_at: string
}

export interface SendMessagePayload {
  content: string
  context?: {
    allergy?: boolean
    activeRx?: boolean
    interactions?: boolean
  }
}

const MOCK_IDENTITY: Identity = {
  id: 'usr_mock_001',
  email: 'minhanh@gmail.com',
  role: 'USER',
  status: 'ACTIVE',
  created_at: new Date('2026-01-01T00:00:00Z').toISOString(),
}

const MOCK_TOKEN_PAIR: TokenPair = {
  access_token: 'mock_jwt_access_token',
  refresh_token: 'mock_opaque_refresh_token',
  token_type: 'bearer',
  expires_in: 3600,
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError && err.message.toLowerCase().includes('fetch')) return true
  if (err instanceof Error && (err.message.includes('Failed to fetch') || err.message.includes('NetworkError') || err.message.includes('ECONNREFUSED'))) {
    return true
  }
  return false
}

function setSessionUserEmail(email: string) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('vitap-user-email', email)
    window.dispatchEvent(new Event('vitap-auth-change'))
  }
}

export function clearSessionUserEmail() {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('vitap-user-email')
    window.dispatchEvent(new Event('vitap-auth-change'))
  }
}

export const authApi = {
  async login(payload: LoginPayload): Promise<TokenPair> {
    if (mockMode) {
      setCredentials({ access: MOCK_TOKEN_PAIR.access_token })
      setSessionUserEmail(payload.email)
      return MOCK_TOKEN_PAIR
    }
    try {
      const res = await api<TokenPair>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
      setCredentials({ access: res.access_token })
      if (res.refresh_token && typeof window !== 'undefined') {
        localStorage.setItem('vitap-refresh-token', res.refresh_token)
      }
      setSessionUserEmail(payload.email)
      return res
    } catch (err) {
      if (isNetworkError(err)) {
        console.warn('[VitaP API] Backend offline, falling back to mock login', err)
        setCredentials({ access: MOCK_TOKEN_PAIR.access_token })
        setSessionUserEmail(payload.email)
        return MOCK_TOKEN_PAIR
      }
      throw err
    }
  },

  async register(payload: RegisterPayload): Promise<Identity> {
    if (mockMode) {
      setSessionUserEmail(payload.email)
      return { ...MOCK_IDENTITY, email: payload.email }
    }
    try {
      const res = await api<Identity>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: payload.email,
          password: payload.password,
          full_name: payload.full_name,
          consent: payload.consent ?? {
            is_accepted: true,
            version: 'health-ai-v1',
            scope: 'HEALTH_DATA_AND_AI_PROCESSING',
          },
        }),
      })
      setSessionUserEmail(payload.email)
      return res
    } catch (err) {
      if (isNetworkError(err)) {
        console.warn('[VitaP API] Backend offline, falling back to mock register', err)
        setSessionUserEmail(payload.email)
        return { ...MOCK_IDENTITY, email: payload.email }
      }
      throw err
    }
  },

  async guestSession(payload?: GuestSessionPayload): Promise<GuestSessionResponse> {
    const mockGuest: GuestSessionResponse = {
      id: 'gst_mock_001',
      guest_token: 'mock_guest_token_abc123',
      consent_accepted: true,
      consent_version: 'guest-processing-v1',
      created_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
    }
    if (mockMode) {
      setCredentials({ guest: mockGuest.guest_token })
      return mockGuest
    }
    try {
      const res = await api<GuestSessionResponse>('/guest-sessions', {
        method: 'POST',
        body: JSON.stringify({
          consent_accepted: payload?.consent_accepted ?? true,
          consent_version: payload?.consent_version ?? 'guest-processing-v1',
        }),
      })
      setCredentials({ guest: res.guest_token })
      return res
    } catch (err) {
      if (isNetworkError(err)) {
        console.warn('[VitaP API] Backend offline, falling back to mock guest session', err)
        setCredentials({ guest: mockGuest.guest_token })
        return mockGuest
      }
      throw err
    }
  },

  async getMe(): Promise<Identity> {
    if (mockMode) return MOCK_IDENTITY
    try {
      return await api<Identity>('/auth/me')
    } catch (err) {
      if (isNetworkError(err)) {
        console.warn('[VitaP API] Backend offline, falling back to mock identity', err)
        return MOCK_IDENTITY
      }
      throw err
    }
  },

  async logout(refreshToken?: string): Promise<void> {
    const token = refreshToken || (typeof window !== 'undefined' ? localStorage.getItem('vitap-refresh-token') : null)
    if (!mockMode && token) {
      try {
        await api('/auth/logout', {
          method: 'POST',
          body: JSON.stringify({ refresh_token: token }),
        })
      } catch (err) {
        console.warn('[VitaP API] Logout warning ignored:', err)
      }
    }
    if (typeof window !== 'undefined') {
      localStorage.removeItem('vitap-refresh-token')
    }
    setCredentials({})
  },
}

export const chatApi = {
  async getSessions(): Promise<ChatSession[]> {
    if (mockMode) {
      return CHAT_SESSIONS.map((s) => ({
        id: s.id,
        title: s.title,
        created_at: s.at,
      }))
    }
    try {
      return await api<ChatSession[]>('/ai/chat/sessions')
    } catch (err) {
      if (isNetworkError(err)) {
        return CHAT_SESSIONS.map((s) => ({
          id: s.id,
          title: s.title,
          created_at: s.at,
        }))
      }
      throw err
    }
  },

  async sendMessage(sessionId: string, payload: SendMessagePayload): Promise<ChatMessage> {
    if (mockMode) {
      return {
        id: `msg_${Date.now()}`,
        role: 'assistant',
        content: `Thông tin tham khảo từ Dược thư Quốc gia về câu hỏi: "${payload.content}". Vui lòng tham khảo ý kiến bác sĩ hoặc dược sĩ trước khi thay đổi liều dùng hoặc kết hợp thuốc.`,
        sources: ['dtqg', 'stockley'],
        created_at: new Date().toISOString(),
      }
    }
    try {
      return await api<ChatMessage>(`/ai/chat/sessions/${sessionId}/messages`, {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    } catch (err) {
      if (isNetworkError(err)) {
        return {
          id: `msg_${Date.now()}`,
          role: 'assistant',
          content: `Thông tin tham khảo từ Dược thư Quốc gia về câu hỏi: "${payload.content}". Vui lòng tham khảo ý kiến bác sĩ hoặc dược sĩ trước khi thay đổi liều dùng hoặc kết hợp thuốc.`,
          sources: ['dtqg', 'stockley'],
          created_at: new Date().toISOString(),
        }
      }
      throw err
    }
  },
}

