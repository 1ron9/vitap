import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

const password = "M1-synthetic-test-password";
async function login(page: Page, email: string) {
  await page.getByRole("button", { name: "Đăng ký / Đăng nhập", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "Đăng nhập", exact: true }).click();
  await dialog.getByLabel("Email", { exact: true }).fill(email);
  await dialog.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await dialog.getByRole("button", { name: "Đăng nhập", exact: true }).last().click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Chỉnh sửa thông tin cá nhân" })).toBeVisible();
}

test("real PostgreSQL: profile, declarations, Journal atomic edit, courses and A→B isolation", async ({
  page,
  request,
}) => {
  const a = `m1-a-${randomUUID()}@example.test`,
    b = `m1-b-${randomUUID()}@example.test`;
  for (const email of [a, b]) {
    const response = await request.post("/api/v1/auth/register", {
      data: {
        email,
        password,
        full_name: email === a ? "M1 A" : "M1 B",
        consent: {
          is_accepted: true,
          version: "health-ai-v1",
          scope: "HEALTH_DATA_AND_AI_PROCESSING",
        },
      },
    });
    expect(response.status()).toBe(201);
  }
  await page.goto("/profile");
  await login(page, a);
  await page.getByRole("button", { name: "Chỉnh sửa thông tin cá nhân" }).click();
  await page.getByLabel("Họ tên", { exact: true }).fill("M1 A saved");
  await page.getByLabel("Số điện thoại").fill("0900000123");
  await page.getByLabel("Chiều cao (cm)").fill("170.25");
  await page.getByRole("button", { name: "Lưu thông tin" }).click();
  await expect(page.getByRole("button", { name: "Lưu thông tin" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("M1 A saved", { exact: true })).toBeVisible();
  await expect(page.getByText(/0900000123/)).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  await page.getByRole("button", { name: "Thêm bệnh nền" }).click();
  await page.getByLabel("Tên bệnh nền").fill("Synthetic condition");
  await page.getByLabel("Ghi chú bệnh nền").fill("Synthetic description");
  await page.getByRole("button", { name: "Lưu bệnh nền" }).click();
  await expect(page.getByText("Synthetic condition", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Xác nhận không có dị ứng đã biết", exact: true }).click();
  await expect(page.getByText("Bạn đã xác nhận không có dị ứng nào đã biết.")).toBeVisible();
  await page.getByRole("button", { name: "Thêm dị ứng" }).click();
  await page.getByLabel("Tên chất gây dị ứng").fill("Synthetic food");
  await page.getByLabel("Loại dị ứng").selectOption("FOOD");
  await page.getByLabel("Phản ứng đã gặp").fill("Synthetic reaction");
  await page.getByRole("button", { name: "Lưu dị ứng" }).click();
  await expect(page.getByText("Có dị ứng đã khai báo.")).toBeVisible();
  await page
    .locator("li")
    .filter({ hasText: "Synthetic food" })
    .getByRole("button", { name: "Xóa", exact: true })
    .click();
  await page
    .getByRole("alertdialog", { name: "Xác nhận xóa dị ứng" })
    .getByRole("button", { name: "Xác nhận xóa" })
    .click();
  await expect(page.getByText("Chưa khai báo tình trạng dị ứng.")).toBeVisible();
  // The switch keeps the server value while PATCH/refetch is pending.
  await page.getByRole("switch", { name: "Cho Trợ lý AI dùng hồ sơ này" }).click();
  await expect(
    page.getByRole("switch", { name: "Cho Trợ lý AI dùng hồ sơ này" }),
  ).not.toBeChecked();
  await page.reload();
  await expect(
    page.getByRole("switch", { name: "Cho Trợ lý AI dùng hồ sơ này" }),
  ).not.toBeChecked();

  await page.getByRole("button", { name: "Bắt đầu đợt dùng thuốc" }).click();
  await page.getByLabel("Tìm tên thuốc").fill("Glucophage");
  await page.getByRole("radio").first().check();
  await page.getByLabel("Liều dùng đã được chỉ định").fill("Synthetic prescribed dose");
  await page
    .getByRole("checkbox", { name: "Tôi xác nhận thông tin thuốc và đợt dùng này." })
    .check();
  await page.getByRole("button", { name: "Xác nhận đang dùng" }).click();
  await page.getByRole("button", { name: "Ghi nhận kết thúc / dừng" }).click();
  await page.getByRole("button", { name: "Xác nhận kết thúc", exact: true }).click();
  await expect(page.getByRole("button", { name: "Ghi nhận kết thúc / dừng" })).toHaveCount(0);
  await page.getByLabel("Lịch sử đợt dùng").selectOption("COMPLETED");
  await expect(page.getByText("Synthetic prescribed dose", { exact: false })).toBeVisible();

  await page.goto("/journal");
  await page.getByRole("button", { name: "Thêm ghi chép", exact: true }).click();
  await page.getByLabel("Tiêu đề", { exact: true }).fill("Synthetic Journal");
  for (const [type, value] of [
    ["GLUCOSE", "100"],
    ["GLUCOSE", "108"],
    ["HEART_RATE", "70"],
    ["WEIGHT", "65"],
    ["BLOOD_PRESSURE", "120"],
  ]) {
    await page.getByLabel("Loại số đo mới").selectOption(type);
    await page.getByRole("button", { name: "Thêm số đo", exact: true }).click();
    const field = page.locator("fieldset").last();
    await field.getByRole("spinbutton").first().fill(value);
    if (type === "GLUCOSE") await field.getByLabel("Đơn vị số đo").selectOption("mg/dL");
    if (type === "BLOOD_PRESSURE") await field.getByLabel("Tâm trương").fill("80");
  }
  const creation = page.waitForResponse(
    (r) => r.url().endsWith("/health/entries") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Lưu ghi chép" }).click();
  const created = await creation;
  expect(created.status()).toBe(201);
  const original = await created.json();
  expect(original.observations.filter((o: any) => o.observation_type === "GLUCOSE")).toHaveLength(
    2,
  );
  expect(original.observations.find((o: any) => o.entered_value === 100).value).toBe(5.5556);
  await page.reload();
  await page.getByRole("button", { name: "Sửa ghi chép" }).click();
  await page.getByLabel("Tiêu đề", { exact: true }).fill("Synthetic Journal edited");
  await page.getByLabel("Giá trị Đường huyết", { exact: true }).first().fill("110");
  const aggregate = page.waitForResponse(
    (r) => r.url().endsWith("/aggregate") && r.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Lưu ghi chép" }).click();
  const updated = await aggregate;
  expect(updated.status()).toBe(200);
  const result = await updated.json();
  expect(result.observations.map((o: any) => o.id).sort()).toEqual(
    original.observations.map((o: any) => o.id).sort(),
  );
  await expect(page.getByText("Synthetic Journal edited", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole("button", { name: "Thêm ghi chép", exact: true }).click();
  await page.getByLabel("Tiêu đề", { exact: true }).fill("Synthetic title-only");
  await page.getByRole("button", { name: "Lưu ghi chép" }).click();
  await expect(page.getByRole("button", { name: "Lưu ghi chép" })).toHaveCount(0);
  await page.reload();
  await expect(page.getByText("Synthetic title-only", { exact: true })).toBeVisible();

  let delayed = false;
  let release!: () => void;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/v1/health/profile", async (route) => {
    if (route.request().method() !== "GET" || delayed) return route.continue();
    delayed = true;
    const response = await route.fetch();
    await held;
    await route.fulfill({ response }).catch(() => {}); // The old request can already be aborted by logout.
  });
  await page.goto("/profile");
  await expect.poll(() => delayed).toBe(true);
  await page.getByRole("button", { name: "Đăng xuất", exact: true }).click();
  await page.goto("/profile");
  await login(page, b);
  release();
  await expect(page.getByText("M1 B", { exact: true })).toBeVisible();
  await expect(page.getByText("M1 A saved", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Synthetic condition", { exact: true })).toHaveCount(0);
  await page.goto("/journal");
  await expect(page.getByText("Synthetic Journal edited", { exact: true })).toHaveCount(0);
  await expect(
    page.getByText("Không có ghi chép trong khoảng này.", { exact: false }),
  ).toBeVisible();
});
