// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { AppProvider } from "@/app/state";
import {
  establishSession,
  clearSession,
  sessionSnapshot,
  refreshSession,
  establishGuestSession,
} from "@/features/auth/session";
import { authApi } from "@/api/client";
import { api, setCredentials, getCredentials } from "@/shared/api";
import { RealProfile } from "./Profile";
import { RealJournal, aggregateCommand } from "./Journal";
import { Courses } from "./courses";
import { dayBounds, localDateTime, toUtc } from "./time";
import type { Entry } from "./types";

const user = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "a@example.test",
  role: "USER",
  status: "ACTIVE",
  created_at: "2020-01-01T00:00:00Z",
};
const pair = {
  access_token: "access",
  refresh_token: "refresh",
  token_type: "bearer",
  expires_in: 900,
};
const empty = { items: [], pagination: { page: 1, page_size: 20, total: 0 } };
const profile = {
  id: "profile-id",
  full_name: "Tên ban đầu",
  date_of_birth: null,
  biological_sex: null,
  phone: null,
  height_cm: null,
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
function mount(component: React.ReactNode) {
  return render(
    <MemoryRouter>
      <AppProvider>{component}</AppProvider>
    </MemoryRouter>,
  );
}
beforeEach(() => {
  localStorage.clear();
  clearSession(false);
});
afterEach(() => {
  cleanup();
  clearSession(false);
  vi.unstubAllGlobals();
});

describe("M1 real UI", () => {
  it("loads profile and submits phone/height to backend; keeps draft on 422", async () => {
    const patches: unknown[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/auth/me")) return json(user);
        if (url.endsWith("/profile")) {
          if (init?.method === "PATCH") {
            patches.push(JSON.parse(String(init.body)));
            return json(
              {
                error: {
                  message: "Chiều cao chưa hợp lệ",
                  code: "VALIDATION_ERROR",
                  details: [{ field: "height_cm", reason: "INVALID_VALUE" }],
                  request_id: "request-test",
                },
              },
              422,
            );
          }
          return json(profile);
        }
        if (url.endsWith("/preferences"))
          return json({
            allow_ai_health_context: true,
            enable_allergy_alerts: true,
            ai_context_available: true,
          });
        if (url.endsWith("/allergy-declaration"))
          return json({ state: "UNKNOWN", confirmed_at: null });
        return json(empty);
      }),
    );
    await establishSession(pair);
    mount(<RealProfile />);
    await screen.findByText("Tên ban đầu");
    await userEvent.click(screen.getByRole("button", { name: "Chỉnh sửa thông tin cá nhân" }));
    await userEvent.type(screen.getByLabelText("Số điện thoại"), "0123456");
    await userEvent.type(screen.getByLabelText("Chiều cao (cm)"), "170.25");
    await userEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    await screen.findByText("Chiều cao chưa hợp lệ");
    expect(patches).toEqual([expect.objectContaining({ phone: "0123456", height_cm: 170.25 })]);
    expect((screen.getByLabelText("Số điện thoại") as HTMLInputElement).value).toBe("0123456");
    expect(screen.getByText("Mã yêu cầu: request-test")).toBeTruthy();
  });

  it("does not fetch private resources or mount forms for a guest", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    mount(<RealProfile />);
    await screen.findByText("Đăng nhập để quản lý sức khỏe");
    expect(fetcher).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Chỉnh sửa thông tin cá nhân" })).toBeNull();
  });

  it("keeps a new entry draft and warns about uncertain saves without replaying POST on connection loss", async () => {
    const posts: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/auth/me")) return json(user);
        if (init?.method === "POST") {
          posts.push(url);
          throw new TypeError("Failed to fetch");
        }
        return json(empty);
      }),
    );
    await establishSession(pair);
    mount(<RealJournal />);
    await userEvent.click(screen.getByRole("button", { name: "Thêm ghi chép" }));
    await userEvent.type(screen.getByLabelText("Tiêu đề"), "Giữ bản nháp này");
    await userEvent.click(screen.getByRole("button", { name: "Lưu ghi chép" }));
    await screen.findByText(/chưa xác định yêu cầu đã được lưu/);
    expect(posts).toHaveLength(1);
    expect((screen.getByLabelText("Tiêu đề") as HTMLInputElement).value).toBe("Giữ bản nháp này");
  });

  it("confirms a catalog course, completes it and reads terminal history from API", async () => {
    const writes: { method: string; body: any }[] = [];
    let course: any;
    const drug = {
      drug_id: "drug-id",
      brand_name: "QA Catalog",
      strength: "5 mg",
      prescription_item_id: null,
      dosage: null,
      frequency: null,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/auth/me")) return json(user);
        if (url.includes("/medication-course-options")) return json({ ...empty, items: [drug] });
        if (init?.method === "POST" || init?.method === "PATCH") {
          const body = JSON.parse(String(init.body));
          writes.push({ method: init.method, body });
          course = {
            ...drug,
            ...course,
            ...body,
            id: "course-id",
            status: body.status || "ACTIVE",
          };
          return json(course, init.method === "POST" ? 201 : 200);
        }
        const status = new URL(url, "http://test").searchParams.get("status");
        const items = course?.status === status ? [course] : [];
        return json({ items, pagination: { page: 1, page_size: 20, total: items.length } });
      }),
    );
    await establishSession(pair);
    mount(<Courses />);
    await userEvent.click(screen.getByRole("button", { name: "Bắt đầu đợt dùng thuốc" }));
    await userEvent.click(await screen.findByRole("radio", { name: "QA Catalog 5 mg" }));
    await userEvent.type(screen.getByLabelText("Liều dùng đã được chỉ định"), "Theo đơn QA");
    await userEvent.click(screen.getByRole("checkbox"));
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận đang dùng" }));
    await userEvent.click(await screen.findByRole("button", { name: "Ghi nhận kết thúc / dừng" }));
    await userEvent.click(screen.getByRole("button", { name: "Xác nhận kết thúc" }));
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "Ghi nhận kết thúc / dừng" })).toBeNull(),
    );
    await userEvent.selectOptions(screen.getByLabelText("Lịch sử đợt dùng"), "COMPLETED");
    await screen.findByText("QA Catalog 5 mg");
    expect(writes).toEqual([
      {
        method: "POST",
        body: expect.objectContaining({ drug_id: "drug-id", dosage: "Theo đơn QA" }),
      },
      { method: "PATCH", body: expect.objectContaining({ status: "COMPLETED" }) },
    ]);
  });

  it("edits a journal with exactly one aggregate request; preserves input on rollback", async () => {
    const initial: Entry = {
      id: "entry-a",
      title: "Buổi sáng",
      content: "Đo tại nhà",
      mood: null,
      entry_type: "DAILY",
      recorded_at: "2020-01-01T01:00:00Z",
      observations: [
        {
          id: "reading-a",
          observation_type: "HEART_RATE",
          value: 70,
          secondary_value: null,
          unit: "bpm",
          measured_at: "2020-01-01T01:00:00Z",
          entered_value: null,
          entered_unit: null,
        },
      ],
    };
    const mutations: { url: string; body: any }[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/auth/me")) return json(user);
        if (init?.method === "PATCH") {
          mutations.push({ url, body: JSON.parse(String(init.body)) });
          return json(
            {
              error: {
                code: "VALIDATION_ERROR",
                message: "Không lưu được; chưa có thay đổi nào",
                details: [],
                request_id: "atomic-test",
              },
            },
            422,
          );
        }
        return json({ items: [initial], pagination: { page: 1, page_size: 20, total: 1 } });
      }),
    );
    await establishSession(pair);
    mount(<RealJournal />);
    await userEvent.click(await screen.findByRole("button", { name: "Sửa ghi chép" }));
    const title = screen.getByLabelText("Tiêu đề");
    await userEvent.clear(title);
    await userEvent.type(title, "Tiêu đề mới");
    const reading = screen.getByLabelText("Giá trị Nhịp tim");
    await userEvent.clear(reading);
    await userEvent.type(reading, "80");
    await userEvent.click(screen.getByRole("button", { name: "Lưu ghi chép" }));
    await screen.findByText("Không lưu được; chưa có thay đổi nào");
    expect(mutations).toHaveLength(1);
    expect(mutations[0].url).toContain("/entries/entry-a/aggregate");
    expect(mutations[0].body).toMatchObject({
      entry: { title: "Tiêu đề mới" },
      observations: { update: [{ id: "reading-a", value: 80 }] },
    });
    expect((title as HTMLInputElement).value).toBe("Tiêu đề mới");
  });
});

describe("session and request isolation", () => {
  it("switches USER to GUEST without retaining private identity or refresh credentials", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => json(user)),
    );
    await establishSession(pair);
    establishGuestSession("guest-only");
    expect(sessionSnapshot().user).toBeNull();
    expect(getCredentials()).toEqual({ guest: "guest-only" });
    expect(localStorage.getItem("vitap-refresh-token")).toBeNull();
  });

  it("keeps B's refresh token when A's logout request finishes late", async () => {
    let release!: (r: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/auth/me")
          ? json(user)
          : new Promise<Response>((resolve) => {
              release = resolve;
            }),
      ),
    );
    await establishSession(pair);
    const pending = authApi.logout();
    await establishSession({ ...pair, access_token: "access-b", refresh_token: "refresh-b" });
    release(new Response(null, { status: 204 }));
    await pending;
    expect(localStorage.getItem("vitap-refresh-token")).toBe("refresh-b");
    expect(getCredentials().access).toBe("access-b");
  });

  it("single-flights concurrent expired USER requests and replays FormData unchanged", async () => {
    let rotations = 0;
    const form = new FormData();
    form.set("image", new Blob(["fixture"]), "fixture.png");
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        if (url.endsWith("/auth/me")) return json(user);
        if (url.endsWith("/auth/refresh")) {
          rotations++;
          await new Promise((r) => setTimeout(r, 10));
          return json({ ...pair, access_token: "new-access", refresh_token: "rotated" });
        }
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === "Bearer access")
          return json({ error: { code: "TOKEN_EXPIRED", message: "Expired" } }, 401);
        if (url.endsWith("/upload")) {
          expect(init?.body).toBe(form);
          expect(headers.get("Content-Type")).toBeNull();
        }
        return json({ ok: true });
      }),
    );
    await establishSession(pair);
    await Promise.all([api("/upload", { method: "POST", body: form }), api("/health/profile")]);
    expect(rotations).toBe(1);
    expect(getCredentials().access).toBe("new-access");
  });

  it("does not publish a response from A after logout", async () => {
    let release!: (r: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/auth/me")
          ? json(user)
          : new Promise<Response>((resolve) => {
              release = resolve;
            }),
      ),
    );
    await establishSession(pair);
    const pending = api("/health/profile");
    clearSession(false);
    release(json(profile));
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(sessionSnapshot().user).toBeNull();
  });

  it("does not resurrect a logged-out session when refresh completes late", async () => {
    let release!: (r: Response) => void;
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.endsWith("/auth/me")
          ? json(user)
          : new Promise<Response>((resolve) => {
              release = resolve;
            }),
      ),
    );
    await establishSession(pair);
    const pending = refreshSession();
    clearSession(false);
    release(json({ ...pair, access_token: "late" }));
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
    expect(getCredentials().access).toBeUndefined();
    expect(localStorage.getItem("vitap-refresh-token")).toBeNull();
  });
});

describe("metric/time roundtrip", () => {
  it("keeps UTC offset boundaries and a legacy observation untouched", () => {
    expect(localDateTime("2020-01-01T18:00:00Z")).toBe("2020-01-02T01:00:00");
    expect(toUtc("2020-01-02T01:00:00")).toBe("2020-01-01T18:00:00.000Z");
    expect(dayBounds("2020-01-01", "2020-01-01")).toEqual({
      from: "2019-12-31T17:00:00.000Z",
      to: "2020-01-01T17:00:00.000Z",
    });
    const initial: Entry = {
      id: "e",
      title: "old",
      content: null,
      mood: null,
      entry_type: "DAILY",
      recorded_at: "2020-01-01T00:00:00Z",
      observations: [
        {
          id: "legacy",
          observation_type: "SPO2",
          value: 98,
          secondary_value: null,
          unit: "%",
          measured_at: "2020-01-01T00:00:00Z",
          entered_value: null,
          entered_unit: null,
        },
      ],
    };
    const o = initial.observations[0];
    expect(
      aggregateCommand(initial, { title: "new", content: null, recorded_at: initial.recorded_at }, [
        {
          key: o.id,
          id: o.id,
          type: o.observation_type,
          value: "98",
          secondary: "",
          unit: "%",
          time: localDateTime(o.measured_at),
          original: o,
        },
      ]),
    ).toEqual({ entry: { title: "new" }, observations: { create: [], update: [], delete: [] } });
  });
});
