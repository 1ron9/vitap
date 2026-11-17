export type Identity = {
  id: string;
  email: string;
  role: string;
  status: string;
  created_at: string;
};
export type TokenPair = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
};
export type ErrorEnvelope = {
  error: { code: string; message: string; details: unknown[]; request_id: string };
};

export class ApiError extends Error {
  request_id?: string;
  status: number;
  code?: string;
  details?: Array<{
    loc?: (string | number)[];
    msg?: string;
    type?: string;
    field?: string;
    reason?: string;
  }>;

  constructor(
    message: string,
    status: number,
    code?: string,
    details?: unknown[],
    requestId?: string,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.request_id = requestId;
    this.details = details as
      | Array<{
          loc?: (string | number)[];
          msg?: string;
          type?: string;
          field?: string;
          reason?: string;
        }>
      | undefined;
  }
}

export const mockMode = import.meta.env.VITE_USE_MOCK === "true";
import { getCredentials, getGeneration, setCredentials } from "./credentials";
export { getCredentials, getGeneration, setCredentials };
let refreshUser: (() => Promise<void>) | undefined;
export function configureRefresh(refresh: () => Promise<void>) {
  refreshUser = refresh;
}
export function assertSession(generation: number) {
  if (generation !== getGeneration()) throw new DOMException("Session changed", "AbortError");
}
export async function rawApi<T>(
  path: string,
  options: RequestInit = {},
  authenticated = true,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData))
    headers.set("Content-Type", "application/json");
  const { access, guest } = getCredentials();
  if (authenticated && access) headers.set("Authorization", `Bearer ${access}`);
  if (authenticated && guest) headers.set("X-Guest-Token", guest);
  const baseUrl = import.meta.env.VITE_API_URL ?? "/api/v1";
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as ErrorEnvelope | null;
    throw new ApiError(
      body?.error?.message || `HTTP ${response.status}`,
      response.status,
      body?.error?.code,
      body?.error?.details,
      body?.error?.request_id || response.headers.get("X-Request-ID") || undefined,
    );
  }
  return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
}
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const generation = getGeneration();
  const original = getCredentials();
  const authEndpoint =
    /^\/auth\/(login|register|refresh)$/.test(path) || path === "/guest-sessions";
  try {
    const result = await rawApi<T>(path, options, !authEndpoint);
    assertSession(generation);
    return result;
  } catch (error) {
    assertSession(generation);
    if (
      !(error instanceof ApiError) ||
      error.status !== 401 ||
      error.code !== "TOKEN_EXPIRED" ||
      !original.access ||
      !refreshUser ||
      authEndpoint
    )
      throw error;
    // A late 401 for an old token must not rotate the newly issued refresh token again.
    if (getCredentials().access === original.access) await refreshUser();
    assertSession(generation);
    const result = await rawApi<T>(path, options);
    assertSession(generation);
    return result;
  }
}
