// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { AppProvider } from "@/app/state";
import { clearSession, establishSession } from "@/features/auth/session";
import { Dashboard } from "@/screens/Dashboard";
import { analyticsPath, chartPoints, dashboardBounds, presetRange } from "./dashboard-data";
import { healthMutation } from "./hooks";
import type { RawObservation } from "./types";

vi.mock("./ObservationChart", () => ({ default: () => <figure aria-label="Biểu đồ kiểm thử" /> }));
vi.mock("./AnalyticsChart", () => ({
  default: () => <figure aria-label="Biểu đồ thống kê kiểm thử" />,
}));

const user = {
  id: "test-user",
  email: "dashboard@example.test",
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
const reading: RawObservation = {
  id: "reading-1",
  entry_id: "entry-1",
  observation_type: "BLOOD_PRESSURE",
  value: 120,
  secondary_value: 80,
  unit: "mmHg",
  entered_value: null,
  entered_unit: null,
  measured_at: "2020-01-01T17:00:00Z",
  source_type: "MANUAL",
  source_reference: null,
  created_at: "2020-01-01T00:00:00Z",
};
const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status });
const pageOf = (items: RawObservation[], page = 1, total = items.length) => ({
  items,
  pagination: { page, page_size: 100, total },
});

afterEach(() => {
  cleanup();
  clearSession(false);
  localStorage.clear();
  vi.unstubAllGlobals();
});

function mount() {
  return render(
    <MemoryRouter>
      <AppProvider>
        <Dashboard />
      </AppProvider>
    </MemoryRouter>,
  );
}

it("maps Vietnamese calendar dates, glucose units and same-time BP readings without merging IDs", () => {
  expect(presetRange("week", "2020-01-01")).toEqual({ from: "2019-12-30", to: "2020-01-05" });
  expect(presetRange("month", "2020-02-10")).toEqual({ from: "2020-02-01", to: "2020-02-29" });
  expect(dashboardBounds({ from: "2020-01-02", to: "2020-01-02" })).toEqual({
    from: "2020-01-01T17:00:00.000Z",
    to: "2020-01-02T17:00:00.000Z",
  });
  expect(dashboardBounds({ from: "2020-01-01", to: "2021-01-01" })).toBeNull();
  expect(analyticsPath("HEART_RATE", { from: "2020-02-29", to: "2020-03-01" }, "week")).toBe(
    "/analytics?observation_type=HEART_RATE&from=2020-02-29&to=2020-03-02&granularity=week&timezone=Asia%2FHo_Chi_Minh",
  );
  expect(analyticsPath("HEART_RATE", { from: "2020-03-01", to: "2020-02-29" }, "day")).toBeNull();
  const bp = chartPoints([reading, { ...reading, id: "reading-2", value: 310 }], "BLOOD_PRESSURE");
  expect(bp.primary.map((p) => p.reading.id)).toEqual(["reading-1", "reading-2"]);
  expect(bp.secondary.map((p) => p.y)).toEqual([80, 80]);
  expect(bp.domain[1]).toBeGreaterThan(310);
  const glucose = chartPoints(
    [
      { ...reading, observation_type: "GLUCOSE", unit: "mg/dL", value: 90 },
      { ...reading, unit: "unknown" },
    ],
    "GLUCOSE",
  );
  expect(glucose.primary[0].y).toBe(5);
  expect(glucose.excluded).toBe(1);
});

it("keeps private series unmounted for a guest", async () => {
  clearSession(false);
  const fetcher = vi.fn();
  vi.stubGlobal("fetch", fetcher);
  mount();
  await screen.findByText("Đăng nhập để quản lý sức khỏe");
  expect(fetcher).not.toHaveBeenCalled();
});

it("explains why legacy readings were excluded from analytics", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) => {
      if (url.endsWith("/auth/me")) return json(user);
      if (url.includes("/health/analytics?"))
        return json({
          observation_type: "BLOOD_PRESSURE",
          from: "2020-01-01",
          to: "2020-01-02",
          granularity: "day",
          timezone: "Asia/Ho_Chi_Minh",
          unit: "mmHg",
          excluded_count: 2,
          excluded_reasons: { UNKNOWN_UNIT: 1, INCOMPLETE_BLOOD_PRESSURE: 1 },
          buckets: [
            {
              period_start: "2020-01-01",
              period_end: "2020-01-02",
              count: 0,
              average: null,
              minimum: null,
              maximum: null,
              secondary_average: null,
              secondary_minimum: null,
              secondary_maximum: null,
            },
          ],
        });
      return json(pageOf([]));
    }),
  );
  await establishSession(pair);
  mount();
  await userEvent.selectOptions(screen.getByLabelText("Cách xem"), "analytics");
  await screen.findByText("2 số đo cũ không thể tổng hợp:");
  expect(screen.getByText("1 · đơn vị không nhận diện")).toBeTruthy();
  expect(screen.getByText("1 · huyết áp thiếu hoặc sai một vế")).toBeTruthy();
});

it("keeps a failed page out of the chart, retries all pages and refetches after Journal saves", async () => {
  const items = Array.from({ length: 101 }, (_, i) => ({
    ...reading,
    id: `raw-${i}`,
    value: 300 + i,
  }));
  const pages: number[] = [];
  let failPage = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options?: RequestInit) => {
      if (url.endsWith("/auth/me")) return json(user);
      if (options?.method === "PATCH") {
        items[0].value = 888;
        return json({});
      }
      const number = Number(new URL(url, "http://test").searchParams.get("page"));
      pages.push(number);
      if (number === 2 && failPage) {
        failPage = false;
        return json({ error: { message: "Lỗi trang hai", request_id: "dashboard-request" } }, 500);
      }
      return json(pageOf(items.slice((number - 1) * 100, number * 100), number, items.length));
    }),
  );
  await establishSession(pair);
  mount();
  await screen.findByText("Mã yêu cầu: dashboard-request");
  expect(screen.queryByRole("table")).toBeNull();
  await userEvent.click(screen.getByRole("button", { name: "Thử lại" }));
  await screen.findByText("101 lần đo");
  expect(pages).toEqual([1, 2, 1, 2]);
  expect(screen.getAllByRole("link", { name: "Mở ghi chép" })[0].getAttribute("href")).toBe(
    "/journal?entry=entry-1",
  );
  await act(async () => {
    await healthMutation("/entries/entry-1/aggregate", "PATCH", {});
  });
  await screen.findByText("888/80 mmHg");
  expect(pages).toEqual([1, 2, 1, 2, 1, 2]);
});

it("ignores a response from an abandoned metric and skips invalid date filters", async () => {
  let respond: ((res: Response) => void) | undefined;
  const fetcher = vi.fn(async (url: string, _options?: RequestInit) => {
    if (url.endsWith("/auth/me")) return json(user);
    if (url.includes("observation_type=WEIGHT"))
      return new Promise<Response>((resolve) => {
        respond = resolve;
      });
    return json(pageOf([reading]));
  });
  vi.stubGlobal("fetch", fetcher);
  await establishSession(pair);
  mount();
  await screen.findByText("120/80 mmHg");
  await userEvent.selectOptions(screen.getByLabelText("Chỉ số"), "WEIGHT");
  await waitFor(() => expect(respond).toBeDefined());
  await userEvent.selectOptions(screen.getByLabelText("Chỉ số"), "BLOOD_PRESSURE");
  await screen.findByText("120/80 mmHg");
  await act(async () => {
    respond?.(json(pageOf([{ ...reading, value: 77, unit: "kg", secondary_value: null }])));
  });
  expect(screen.queryByText("77 kg")).toBeNull();
  await userEvent.clear(screen.getByLabelText("Từ ngày"));
  await screen.findByRole("alert");
  expect(screen.queryByRole("table")).toBeNull();
  expect(fetcher.mock.calls.find(([url]) => url.includes("from=&"))).toBeUndefined();
});
