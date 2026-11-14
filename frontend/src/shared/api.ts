export type Identity = { id: string; email: string; role: string; status: string; created_at: string };
export type TokenPair = { access_token: string; refresh_token: string; token_type: string; expires_in: number };
export type ErrorEnvelope = { error: { code: string; message: string; details: unknown[]; request_id: string } };

export class ApiError extends Error {
  status: number;
  code?: string;
  details?: Array<{ loc?: (string | number)[]; msg?: string; type?: string }>;

  constructor(message: string, status: number, code?: string, details?: unknown[]) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details as Array<{ loc?: (string | number)[]; msg?: string; type?: string }> | undefined;
  }
}

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
  const baseUrl = import.meta.env.VITE_API_URL ?? '/api/v1';
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as ErrorEnvelope | null;
    throw new ApiError(body?.error?.message || `HTTP ${response.status}`, response.status, body?.error?.code, body?.error?.details);
  }
  return response.status === 204 ? undefined as T : await response.json() as T;
}
