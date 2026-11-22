import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

async function createUser(request: APIRequestContext) {
  const email = `chart-flow-${randomUUID()}@example.test`;
  const password = "m1-dashboard-flow-password";
  const registration = await request.post("/api/v1/auth/register", {
    data: {
      email,
      password,
      full_name: "Dashboard flow",
      consent: {
        is_accepted: true,
        version: "health-ai-v1",
        scope: "HEALTH_DATA_AND_AI_PROCESSING",
      },
    },
  });
  expect(registration.status()).toBe(201);
  const login = await request.post("/api/v1/auth/login", { data: { email, password } });
  expect(login.ok()).toBe(true);
  return (await login.json()) as { access_token: string; refresh_token: string };
}

async function showHeartRate(page: Page, day: string) {
  await page.goto("/dashboard");
  await page.getByLabel("Chỉ số", { exact: true }).selectOption("HEART_RATE");
  await page.getByLabel("Từ ngày", { exact: true }).fill(day);
  await page.getByLabel("Đến ngày (bao gồm)", { exact: true }).fill(day);
}

function waitForEntryWrite(page: Page, method: string) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === method &&
      /\/health\/entries(?:\/[^/?]+(?:\/aggregate)?)?$/.test(response.url()),
  );
}

test("Journal edits refresh raw Dashboard values and measured dates", async ({ page, request }) => {
  const { refresh_token } = await createUser(request);
  await page.goto("/journal");
  await page.evaluate((value) => localStorage.setItem("vitap-refresh-token", value), refresh_token);
  await page.reload();
  await page.getByRole("button", { name: "Thêm ghi chép", exact: true }).click();
  await page.getByLabel("Tiêu đề", { exact: true }).fill("E2E Dashboard lifecycle");
  const headerTime = page.getByLabel("Thời gian ghi chép (giờ Việt Nam)");
  await headerTime.fill("2020-02-01T07:00");
  for (const [value, measured] of [
    ["81", "2020-02-02T00:00"],
    ["86", "2020-02-02T12:00"],
  ]) {
    await page.getByLabel("Loại số đo mới").selectOption("HEART_RATE");
    await page.getByRole("button", { name: "Thêm số đo", exact: true }).click();
    const field = page.locator("fieldset").last();
    await field.getByRole("spinbutton").fill(value);
    await field.getByLabel("Thời gian đo (để trống dùng thời gian ghi chép)").fill(measured);
  }
  const creation = waitForEntryWrite(page, "POST");
  await page.getByRole("button", { name: "Lưu ghi chép" }).click();
  const created = await creation;
  expect(created.status()).toBe(201);
  const original = (await created.json()) as {
    id: string;
    observations: { id: string; value: number; measured_at: string }[];
  };
  const firstId = original.observations.find((o) => o.value === 81)!.id;
  await showHeartRate(page, "2020-02-02");
  const table = page.getByRole("table", { name: "Bảng số đo gốc" });
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table.getByText("81 bpm")).toBeVisible();
  await expect(table.locator("time").first()).toHaveAttribute("datetime", "2020-02-01T17:00:00Z");
  await table.getByRole("link", { name: "Mở ghi chép" }).first().click();

  await page.getByRole("button", { name: "Sửa ghi chép" }).click();
  await headerTime.fill("2020-02-04T09:00");
  const headerWrite = waitForEntryWrite(page, "PATCH");
  await page.getByRole("button", { name: "Lưu ghi chép" }).click();
  expect((await headerWrite).ok()).toBe(true);
  await showHeartRate(page, "2020-02-02");
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table.locator("time").first()).toHaveAttribute("datetime", "2020-02-01T17:00:00Z");

  await table.getByRole("link", { name: "Mở ghi chép" }).first().click();
  await page.getByRole("button", { name: "Sửa ghi chép" }).click();
  const first = page.locator("fieldset").first();
  await first.getByRole("spinbutton").fill("93");
  await first
    .getByLabel("Thời gian đo (để trống dùng thời gian ghi chép)")
    .fill("2020-02-03T00:00");
  const measureWrite = waitForEntryWrite(page, "PATCH");
  await page.getByRole("button", { name: "Lưu ghi chép" }).click();
  const updated = await measureWrite;
  expect(updated.ok()).toBe(true);
  expect((await updated.json()).observations).toContainEqual(
    expect.objectContaining({ id: firstId, value: 93, measured_at: "2020-02-02T17:00:00Z" }),
  );
  await showHeartRate(page, "2020-02-02");
  await expect(table.getByRole("row")).toHaveCount(2);
  await expect(table.getByText("86 bpm")).toBeVisible();
  await showHeartRate(page, "2020-02-03");
  await expect(table.getByText("93 bpm")).toBeVisible();
  await table.getByRole("link", { name: "Mở ghi chép" }).click();
  await page.getByRole("button", { name: "Xóa ghi chép", exact: true }).click();
  const removal = waitForEntryWrite(page, "DELETE");
  await page
    .getByRole("alertdialog", { name: "Xác nhận xóa ghi chép" })
    .getByRole("button", { name: "Xác nhận xóa" })
    .click();
  expect((await removal).status()).toBe(204);
  await showHeartRate(page, "2020-02-03");
  await expect(page.getByText("Chưa có số đo nhịp tim trong khoảng này.")).toBeVisible();
  await showHeartRate(page, "2020-02-02");
  await expect(page.getByText("Chưa có số đo nhịp tim trong khoảng này.")).toBeVisible();
});

test("a delayed Dashboard page from A never appears for Guest or B", async ({ page, request }) => {
  const a = await createUser(request),
    b = await createUser(request);
  const created = await request.post("/api/v1/health/entries", {
    headers: { Authorization: `Bearer ${a.access_token}` },
    data: {
      title: "A only Dashboard reading",
      recorded_at: "2020-02-01T00:00:00Z",
      observations: [
        { observation_type: "HEART_RATE", value: 88, measured_at: "2020-02-01T22:00:00Z" },
      ],
    },
  });
  expect(created.status()).toBe(201);
  await page.goto("/profile");
  await page.evaluate(
    (value) => localStorage.setItem("vitap-refresh-token", value),
    a.refresh_token,
  );
  await page.reload();

  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  let intercepted = false;
  let privatePageReady = false;
  await page.route(/\/api\/v1\/health\/observations\?/, async (route) => {
    const params = new URL(route.request().url()).searchParams;
    if (
      intercepted ||
      params.get("observation_type") !== "HEART_RATE" ||
      params.get("from") !== "2020-02-01T17:00:00.000Z"
    )
      return route.continue();
    intercepted = true;
    const response = await route.fetch();
    privatePageReady = ((await response.json()).items ?? []).some(
      (reading: { value: number }) => reading.value === 88,
    );
    await held;
    await route.fulfill({ response }).catch(() => {});
  });
  try {
    await showHeartRate(page, "2020-02-02");
    await expect.poll(() => privatePageReady).toBe(true);
    await page.goto("/profile");
    await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
    await page.goto("/dashboard");
    await expect(page.getByText("Đăng nhập để quản lý sức khỏe")).toBeVisible();
    expect(await page.getByRole("table", { name: "Bảng số đo gốc" }).count()).toBe(0);
    await page.evaluate(
      (value) => localStorage.setItem("vitap-refresh-token", value),
      b.refresh_token,
    );
    await showHeartRate(page, "2020-02-02");
    release();
    await expect(page.getByText("Chưa có số đo nhịp tim trong khoảng này.")).toBeVisible();
    await expect(page.getByText("88 bpm")).toHaveCount(0);
  } finally {
    release();
  }
});
