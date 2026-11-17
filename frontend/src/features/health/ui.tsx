import { useState, useEffect, useRef, type ReactNode } from "react";
import { ApiError, mockMode } from "@/shared/api";
import { useSession } from "@/features/auth/session";
import { GuestLock } from "@/components/GuestLock";
import { Button, Card } from "@/components/ui";

export const inputClass =
  "w-full rounded-lg border border-line-200 bg-surface px-3 py-2 text-ink-900 focus:outline-brand-600";
export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="grid gap-1 text-sm font-medium">
      {label}
      {children}
    </label>
  );
}
export function Failure({ error }: { error: unknown }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (error) ref.current?.focus();
  }, [error]);
  if (!error) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="alert"
      className="my-3 rounded-lg border border-red-line bg-red-bg p-3 text-sm text-red-ink"
    >
      <p>{error instanceof Error ? error.message : "Không thể xử lý yêu cầu"}</p>
      {error instanceof ApiError && (
        <>
          {error.details?.map((d, i) => (
            <p key={i}>
              {d.field || d.loc?.join(".")}: {d.reason || d.msg}
            </p>
          ))}
          {error.request_id && <p>Mã yêu cầu: {error.request_id}</p>}
        </>
      )}
    </div>
  );
}
export function QueryState({
  query,
  children,
}: {
  query: { loading: boolean; error?: unknown; reload: () => void };
  children: ReactNode;
}) {
  if (query.loading) return <p role="status">Đang tải…</p>;
  if (query.error)
    return (
      <>
        <Failure error={query.error} />
        <Button onClick={query.reload}>Thử lại</Button>
      </>
    );
  return <>{children}</>;
}
export function useAction() {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState<unknown>();
  async function run(fn: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    setError(undefined);
    try {
      await fn();
    } catch (e) {
      if ((e as Error)?.name !== "AbortError") setError(e);
    } finally {
      setBusy(false);
    }
  }
  return { busy, error, run };
}
export function HealthGate({ children }: { children: ReactNode }) {
  const session = useSession();
  if (session.status === "initializing") return <p role="status">Đang khôi phục phiên…</p>;
  if (session.status !== "authenticated")
    return (
      <GuestLock
        title="Đăng nhập để quản lý sức khỏe"
        body="Dữ liệu sức khỏe chỉ dành cho chủ tài khoản."
        gate="Đăng nhập để dùng M1"
      >
        <Card className="h-48">
          <span>Hồ sơ sức khỏe</span>
        </Card>
      </GuestLock>
    );
  // Key invalidates local drafts synchronously when identity/session changes.
  return (
    <div key={`${session.user?.id}:${session.generation}`}>
      {mockMode && (
        <p role="status" className="mb-4 rounded-lg bg-yellow-bg p-3 text-sm">
          Chế độ mô phỏng · Dữ liệu mẫu được lưu riêng trong trình duyệt.
        </p>
      )}
      {children}
    </div>
  );
}
