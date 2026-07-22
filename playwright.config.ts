import { defineConfig, devices } from "@playwright/test";

const productionPort = 3100;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: `http://127.0.0.1:${productionPort}`,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "Mobile 375px",
      use: {
        ...devices["Pixel 5"],
        viewport: { width: 375, height: 812 },
      },
    },
  ],
  webServer: {
    // The standalone server reads its host and port from the environment
    // rather than CLI flags, and is the same entrypoint the Docker image runs.
    command: "pnpm start",
    env: {
      HOSTNAME: "127.0.0.1",
      PORT: String(productionPort),
      // Raise the /api/* per-IP rate limit so parallel e2e runs never hit 429.
      RATE_LIMIT_MAX_PER_MINUTE: "10000",
    },
    url: `http://127.0.0.1:${productionPort}`,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
