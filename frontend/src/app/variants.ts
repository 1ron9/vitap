export type Route = 'onboarding' | 'dashboard' | 'journal' | 'scan' | 'chat' | 'profile'

export type AuthVariant =
  | 'login'
  | 'register'
  | 'fieldErrors'
  | 'loginFailed'
  | 'rateLimited'
  | 'loading'
  | 'sessionExpired'
  | 'guestGate'

export const SCREEN_LABEL: Record<Route, string> = {
  onboarding: 'Trang chủ',
  dashboard: 'Tổng quan',
  journal: 'Sổ tay',
  scan: 'Kiểm tra thuốc',
  chat: 'Trợ lý AI',
  profile: 'Hồ sơ sức khỏe',
}
