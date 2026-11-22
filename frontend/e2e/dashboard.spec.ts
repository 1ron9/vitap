import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("Dashboard plots saved readings and links each one to its Journal entry", async ({
  page,
  request,
}) => {
  const email = `dashboard-${randomUUID()}@example.test`;
  const password = "M1-dashboard-test-password";
  const registered = await request.post("/api/v1/auth/register", {
    data: {
      email,
      password,
      full_name: "Dashboard E2E",
      consent: {
        is_accepted: true,
        version: "health-ai-v1",
        scope: "HEALTH_DATA_AND_AI_PROCESSING",
      },
    },
  });
  expect(registered.status()).toBe(201);
  const login = await request.post("/api/v1/auth/login", { data: { email, password } });
  expect(login.ok()).toBeTruthy();
  const pair = await login.json();
  const created = await request.post("/api/v1/health/entries", {
    headers: { Authorization: `Bearer ${pair.access_token}` },
    data: {
      title: "Dashboard sample entry",
      recorded_at: "2020-01-01T00:00:00Z",
      observations: [
        {
          observation_type: "BLOOD_PRESSURE",
          value: 120,
          secondary_value: 80,
          measured_at: "2020-01-01T17:00:00Z",
        },
        {
          observation_type: "BLOOD_PRESSURE",
          value: 127,
          secondary_value: 83,
          measured_at: "2020-01-01T17:00:00Z",
        },
        {
          observation_type: "BLOOD_PRESSURE",
          value: 135,
          secondary_value: 91,
          measured_at: "2020-01-02T17:00:00Z",
        },
        {
          observation_type: "GLUCOSE",
          value: 100,
          unit: "mg/dL",
          measured_at: "2020-01-01T17:00:00Z",
        },
      ],
    },
  });
  expect(created.status()).toBe(201);

  await page.goto("/dashboard");
  await expect(page.getByText("Đăng nhập để quản lý sức khỏe")).toBeVisible();
  await page.evaluate(
    (token: string) => localStorage.setItem("vitap-refresh-token", token),
    pair.refresh_token,
  );
  await page.reload();
  await page.getByLabel("Từ ngày", { exact: true }).fill("2020-01-02");
  await page.getByLabel("Đến ngày (bao gồm)", { exact: true }).fill("2020-01-02");
  const table = page.getByRole("table", { name: "Bảng số đo gốc" });
  await expect(table.getByRole("row")).toHaveCount(3);
  await expect(table.getByText("120/80 mmHg")).toBeVisible();
  await expect(table.getByText("127/83 mmHg")).toBeVisible();
  const bp = page.getByRole("figure", { name: "Biểu đồ Huyết áp (mmHg)" });
  await expect(bp.locator(".recharts-scatter-symbol")).toHaveCount(4);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel("Chỉ số", { exact: true }).selectOption("GLUCOSE");
  await expect(table.getByText("100 mg/dL")).toBeVisible();
  await expect(
    page
      .getByRole("figure", { name: "Biểu đồ Đường huyết (mmol/L)" })
      .locator(".recharts-scatter-symbol"),
  ).toHaveCount(1);
  await table.getByRole("link", { name: "Mở ghi chép" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard sample entry" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Xem tất cả ghi chép" })).toBeVisible();
});
