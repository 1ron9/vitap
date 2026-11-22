import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";

test("symptom-only Journal entry can be created, edited and removed atomically", async ({
  page,
  request,
}) => {
  const email = `symptom-${randomUUID()}@example.test`,
    password = "m1-symptom-flow-password";
  const registration = await request.post("/api/v1/auth/register", {
    data: {
      email,
      password,
      full_name: "Symptom flow",
      consent: {
        is_accepted: true,
        version: "health-ai-v1",
        scope: "HEALTH_DATA_AND_AI_PROCESSING",
      },
    },
  });
  expect(registration.status()).toBe(201);
  await page.goto("/journal");
  await page.getByRole("button", { name: "Đăng ký / Đăng nhập", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "Đăng nhập", exact: true }).click();
  await dialog.getByLabel("Email", { exact: true }).fill(email);
  await dialog.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await dialog.getByRole("button", { name: "Đăng nhập", exact: true }).last().click();
  await expect(dialog).not.toBeVisible();

  await page.getByRole("button", { name: "Thêm ghi chép", exact: true }).click();
  await page.getByRole("button", { name: "Thêm triệu chứng" }).click();
  await page.getByLabel("Tên triệu chứng").fill("Đau đầu");
  await page.getByLabel("Mức độ tự khai (1–10)").fill("4");
  await page.getByLabel("Thời lượng (phút)").fill("0");
  const creation = page.waitForResponse(
    (r) => r.url().endsWith("/health/entries") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Lưu ghi chép" }).click();
  expect((await creation).status()).toBe(201);
  await expect(page.getByText("Đau đầu · mức độ tự khai 4/10 · 0 phút")).toBeVisible();

  await page.getByRole("button", { name: "Sửa ghi chép" }).click();
  await page.getByLabel("Tên triệu chứng").fill("Đau nửa đầu");
  const edit = page.waitForResponse(
    (r) => /\/health\/entries\/[^/]+\/aggregate$/.test(r.url()) && r.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Lưu ghi chép" }).click();
  expect((await edit).status()).toBe(200);
  await expect(page.getByText("Đau nửa đầu · mức độ tự khai 4/10 · 0 phút")).toBeVisible();

  await page.getByRole("button", { name: "Sửa ghi chép" }).click();
  await page.getByRole("button", { name: "Bỏ triệu chứng 1" }).click();
  await expect(page.getByRole("button", { name: "Lưu ghi chép" })).toBeDisabled();
  await page.getByLabel("Ghi chú", { exact: true }).fill("Theo dõi tiếp");
  const removal = page.waitForResponse(
    (r) => /\/health\/entries\/[^/]+\/aggregate$/.test(r.url()) && r.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Lưu ghi chép" }).click();
  expect((await removal).status()).toBe(200);
  await expect(page.getByText("Theo dõi tiếp")).toBeVisible();
  await expect(page.getByText("Đau nửa đầu · mức độ tự khai 4/10 · 0 phút")).toHaveCount(0);
});
