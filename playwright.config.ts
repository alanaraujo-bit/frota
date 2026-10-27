import { defineConfig, devices } from "@playwright/test";

// E2E contra build de produção, banco isolado (frota_e2e) e armazenamento local cifrado (.storage-e2e).
const PORT = 3200;
export const E2E_DB = process.env.E2E_DATABASE_URL ?? "postgresql://frota:frota-local@localhost:5433/frota_e2e";

const env = {
  DATABASE_URL: E2E_DB,
  APP_URL: `http://localhost:${PORT}`,
  SESSION_SECRET: "e2e-session-secret-0123456789abcdefghijklmnop",
  FILE_MASTER_KEY: Buffer.alloc(32, 7).toString("base64"),
  STORAGE_DRIVER: "fs",
  STORAGE_FS_DIR: ".storage-e2e",
  ALLOW_FS_STORAGE: "1",
  BUILD_VERSION: "e2e",
};

export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 45_000,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "pt-BR",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npx next start -p ${PORT}`,
    url: `http://localhost:${PORT}/offline`,
    env,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
