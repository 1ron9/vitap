import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";

if (!process.env.TEST_POSTGRES_URL)
  throw new Error(
    "E2E requires TEST_POSTGRES_URL pointing to a disposable migrated/seeded database",
  );

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5174",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1000 } },
    },
    { name: "mobile", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "python -m uvicorn app.main:app --host 127.0.0.1 --port 8000",
      cwd: fileURLToPath(new URL("../backend/", import.meta.url)),
      url: "http://127.0.0.1:8000/ready",
      env: { DATABASE_URL: process.env.TEST_POSTGRES_URL },
    },
    {
      command: "pnpm dev --host 127.0.0.1 --port 5174 --strictPort",
      url: "http://127.0.0.1:5174",
      env: { VITE_USE_MOCK: "false", VITE_API_URL: "/api/v1" },
    },
  ],
});
