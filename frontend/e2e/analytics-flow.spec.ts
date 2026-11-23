import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("Dashboard renders day, week and month summaries from saved readings", async ({
  page,
  request,
}) => {
  const email = `analytics-${randomUUID()}@example.test`,
    password = "m1-analytics-flow-password";
  const registered = await request.post("/api/v1/auth/register", {
    data: {
      email,
      password,
      full_name: "Analytics flow",
      consent: {
        is_accepted: true,
        version: "health-ai-v1",
        scope: "HEALTH_DATA_AND_AI_PROCESSING",
      },
    },
  });
  expect(registered.status()).toBe(201);
  const login = await request.post("/api/v1/auth/login", { data: { email, password } });
  expect(login.ok()).toBe(true);
  const { access_token } = await login.json();
  const created = await request.post("/api/v1/health/entries", {
    headers: { Authorization: `Bearer ${access_token}` },
    data: {
      title: "Analytics source",
      recorded_at: "2020-02-27T00:00:00Z",
      observations: [
        { observation_type: "HEART_RATE", value: 60, measured_at: "2020-02-29T12:00:00Z" },
        { observation_type: "HEART_RATE", value: 80, measured_at: "2020-03-01T00:00:00Z" },
      ],
    },
  });
  expect(created.status()).toBe(201);

  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Đăng ký / Đăng nhập", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "Đăng nhập", exact: true }).click();
  await dialog.getByLabel("Email", { exact: true }).fill(email);
  await dialog.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await dialog.getByRole("button", { name: "Đăng nhập", exact: true }).last().click();
  await expect(dialog).not.toBeVisible();
  await page.getByLabel("Chỉ số", { exact: true }).selectOption("HEART_RATE");
  await page.getByLabel("Từ ngày", { exact: true }).fill("2020-02-29");
  await page.getByLabel("Đến ngày (bao gồm)", { exact: true }).fill("2020-03-02");
  await page.getByLabel("Cách xem", { exact: true }).selectOption("analytics");
  const table = page.getByRole("table", { name: "Bảng thống kê số đo" });
  await expect(table).toBeVisible();
  await expect(
    table.getByRole("row").filter({ hasText: "2020-02-29 – 2020-03-01" }).getByRole("cell").nth(1),
  ).toHaveText("1");
  await expect(
    table.getByRole("row").filter({ hasText: "2020-03-01 – 2020-03-02" }).getByRole("cell").nth(2),
  ).toContainText("80 / 80 / 80 bpm");
  await expect(
    table.getByRole("row").filter({ hasText: "2020-03-02 – 2020-03-03" }).getByRole("cell").nth(1),
  ).toHaveText("0");
  await page.getByLabel("Nhóm theo", { exact: true }).selectOption("week");
  await expect(
    table.getByRole("row").filter({ hasText: "2020-02-24 – 2020-03-02" }).getByRole("cell").nth(2),
  ).toContainText("70 / 60 / 80 bpm");
  await page.getByLabel("Nhóm theo", { exact: true }).selectOption("month");
  await expect(
    table.getByRole("row").filter({ hasText: "2020-02-01 – 2020-03-01" }).getByRole("cell").nth(1),
  ).toHaveText("1");
  await expect(
    table.getByRole("row").filter({ hasText: "2020-03-01 – 2020-04-01" }).getByRole("cell").nth(1),
  ).toHaveText("1");
  await page.getByLabel("Cách xem", { exact: true }).selectOption("raw");
  await expect(page.getByRole("table", { name: "Bảng số đo gốc" }).getByRole("row")).toHaveCount(3);
});
