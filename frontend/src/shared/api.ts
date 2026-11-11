export type Identity = { id: string; email: string; role: string; status: string; created_at: string };
export type TokenPair = { access_token: string; refresh_token: string; token_type: string; expires_in: number };
export type ErrorEnvelope = { error: { code: string; message: string; details: unknown[]; request_id: string } };
export const mockMode = import.meta.env.VITE_USE_MOCK === 'true';
// Credentials intentionally live only in memory. Reload requires login again.
let accessToken: string | undefined;
let guestToken: string | undefined;
export function setCredentials(tokens: { access?: string; guest?: string }) {
  if (tokens.access && tokens.guest) throw new Error('AMBIGUOUS_PRINCIPAL');
  accessToken = tokens.access;
  guestToken = tokens.guest;
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  if (guestToken) headers.set('X-Guest-Token', guestToken);
  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1'}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as ErrorEnvelope | null;
    throw new Error(body?.error?.message || `HTTP ${response.status}`);
  }
  return response.status === 204 ? undefined as T : await response.json() as T;
}
