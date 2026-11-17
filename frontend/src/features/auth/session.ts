import { useSyncExternalStore } from "react";
import {
  ApiError,
  assertSession,
  configureRefresh,
  getCredentials,
  getGeneration,
  mockMode,
  rawApi,
  setCredentials,
  type Identity,
  type TokenPair,
} from "@/shared/api";

type Snapshot = {
  status: "initializing" | "authenticated" | "guest";
  user: Identity | null;
  generation: number;
};
let snapshot: Snapshot = {
  status: mockMode ? "guest" : "initializing",
  user: null,
  generation: getGeneration(),
};
const listeners = new Set<() => void>();
let refreshing: Promise<TokenPair> | undefined;
let refreshingGeneration = -1;
let restoring: Promise<void> | undefined;
function publish(status: Snapshot["status"], user: Identity | null = null) {
  snapshot = { status, user, generation: getGeneration() };
  listeners.forEach((fn) => fn());
  if (typeof window !== "undefined") window.dispatchEvent(new Event("vitap-auth-change"));
}
export const sessionSnapshot = () => snapshot;
export const subscribeSession = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
export const useSession = () =>
  useSyncExternalStore(subscribeSession, sessionSnapshot, sessionSnapshot);
export function establishMockSession(email: string) {
  setCredentials({ access: "mock_jwt_access_token" });
  localStorage.setItem("vitap-user-email", email);
  publish("authenticated", {
    id: crypto.randomUUID(),
    email,
    role: "USER",
    status: "ACTIVE",
    created_at: new Date().toISOString(),
  });
}
function savePair(pair: TokenPair) {
  setCredentials({ access: pair.access_token }, true);
  localStorage.setItem("vitap-refresh-token", pair.refresh_token);
}
export function clearSession(notifyTabs = true) {
  setCredentials({});
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("vitap-refresh-token");
    localStorage.removeItem("vitap-user-email");
    if (notifyTabs) localStorage.setItem("vitap-session-change", crypto.randomUUID());
  }
  publish("guest");
}
export function establishGuestSession(token: string) {
  clearSession();
  setCredentials({ guest: token });
  publish("guest");
}
export async function establishSession(pair: TokenPair) {
  setCredentials({});
  const generation = getGeneration();
  publish("initializing");
  savePair(pair);
  try {
    const user = await rawApi<Identity>("/auth/me");
    assertSession(generation);
    localStorage.setItem("vitap-user-email", user.email);
    localStorage.setItem("vitap-session-change", crypto.randomUUID());
    publish("authenticated", user);
  } catch (error) {
    if (generation === getGeneration()) clearSession();
    throw error;
  }
}
export async function refreshSession() {
  const generation = getGeneration();
  if (refreshing && refreshingGeneration === generation) return refreshing;
  refreshingGeneration = generation;
  const perform = async () => {
    assertSession(generation);
    const token = localStorage.getItem("vitap-refresh-token");
    if (!token) throw new Error("NO_REFRESH_TOKEN");
    const marker = localStorage.getItem("vitap-session-change");
    const request = (refreshToken: string) =>
      rawApi<TokenPair>(
        "/auth/refresh",
        { method: "POST", body: JSON.stringify({ refresh_token: refreshToken }) },
        false,
      );
    const checkMarker = () => {
      if (marker !== localStorage.getItem("vitap-session-change")) {
        setCredentials({});
        publish("guest");
        throw new DOMException("Session changed", "AbortError");
      }
    };
    let pair: TokenPair;
    try {
      pair = await request(token);
    } catch (error) {
      assertSession(generation);
      checkMarker();
      const latest = localStorage.getItem("vitap-refresh-token");
      if (error instanceof ApiError && error.status === 401 && latest && latest !== token)
        pair = await request(latest);
      else throw error;
    }
    assertSession(generation);
    checkMarker();
    savePair(pair);
    return pair;
  };
  refreshing = (async () => {
    try {
      if (typeof navigator !== "undefined" && navigator.locks)
        return await navigator.locks.request("vitap-user-refresh", perform);
      return await perform();
    } catch (error) {
      if (generation === getGeneration()) clearSession();
      throw error;
    } finally {
      if (refreshingGeneration === generation) refreshing = undefined;
    }
  })();
  return refreshing;
}
export function restoreSession() {
  if (typeof window === "undefined") return Promise.resolve();
  if (mockMode) {
    const email = localStorage.getItem("vitap-user-email");
    if (email && snapshot.status !== "authenticated") establishMockSession(email);
    return Promise.resolve();
  }
  if (restoring) return restoring;
  if (snapshot.status === "authenticated") return Promise.resolve();
  const generation = getGeneration();
  restoring = (async () => {
    try {
      if (!getCredentials().access) {
        if (!localStorage.getItem("vitap-refresh-token")) {
          publish("guest");
          return;
        }
        await refreshSession();
      }
      const user = await rawApi<Identity>("/auth/me");
      assertSession(generation);
      localStorage.setItem("vitap-user-email", user.email);
      publish("authenticated", user);
    } catch {
      if (generation === getGeneration()) clearSession();
    } finally {
      restoring = undefined;
    }
  })();
  return restoring;
}
configureRefresh(async () => {
  await refreshSession();
});
if (typeof window !== "undefined")
  window.addEventListener("storage", (event) => {
    if (event.key === "vitap-session-change") {
      // Another tab logged out/switched identity. Drop this tab's access/cache immediately;
      // do not remove the other tab's newly established refresh token.
      setCredentials({});
      publish("guest");
    }
  });
