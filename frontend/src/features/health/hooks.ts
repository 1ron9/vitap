import { useEffect, useState, useSyncExternalStore } from "react";
import { api, mockMode } from "@/shared/api";
import { mockHealthApi } from "./mock";
import { useSession } from "@/features/auth/session";

const revisions = new Map<string, number>();
const subscribers = new Set<() => void>();
const resource = (path: string) => path.split("?")[0].split("/")[1] || "";
export function invalidateHealth(path: string) {
  const name = resource(path);
  const related =
    name === "entries" ? ["observations"] : name === "allergies" ? ["allergy-declaration"] : [];
  const keys = [name, ...related];
  keys.forEach((key) => revisions.set(key, (revisions.get(key) || 0) + 1));
  subscribers.forEach((fn) => fn());
}
export async function healthMutation<T>(path: string, method: string, body?: unknown): Promise<T> {
  try {
    const result = mockMode
      ? await mockHealthApi<T>(path, method, body)
      : await api<T>(`/health${path}`, {
          method,
          body: body === undefined ? undefined : JSON.stringify(body),
        });
    invalidateHealth(path);
    return result;
  } catch (error) {
    if (error instanceof TypeError && !mockMode) {
      throw new Error(
        "Mất kết nối nên chưa xác định yêu cầu đã được lưu hay chưa. Dữ liệu nhập vẫn được giữ; hãy kiểm tra lại danh sách trước khi gửi lại.",
      );
    }
    throw error;
  }
}
export function readHealth<T>(path: string, signal: AbortSignal): Promise<T> {
  return mockMode ? mockHealthApi<T>(path) : api<T>(`/health${path}`, { signal });
}

export function useHealthQuery<T>(path: string | null, load = readHealth<T>) {
  const session = useSession();
  const version = useSyncExternalStore(
    (fn) => {
      subscribers.add(fn);
      return () => {
        subscribers.delete(fn);
      };
    },
    () => revisions.get(resource(path || "")) || 0,
    () => 0,
  );
  const enabled = session.status === "authenticated" && !!path;
  const [state, setState] = useState<{ key: string; data?: T; error?: unknown }>({ key: "" });
  const [retry, setRetry] = useState(0);
  const key = `${session.user?.id}:${session.generation}:${path}:${version}:${retry}`;
  useEffect(() => {
    if (!enabled || !path) return;
    const controller = new AbortController();
    setState({ key });
    const request = load(path, controller.signal);
    request
      .then((data) => {
        if (!controller.signal.aborted) setState({ key, data });
      })
      .catch((error) => {
        if (!controller.signal.aborted && error?.name !== "AbortError") setState({ key, error });
      });
    return () => controller.abort();
  }, [key, enabled, path, load]);
  const current = enabled && state.key === key ? state : { key };
  return {
    data: current.data,
    error: current.error,
    loading: enabled && !current.data && !current.error,
    reload: () => setRetry((x) => x + 1),
  };
}
