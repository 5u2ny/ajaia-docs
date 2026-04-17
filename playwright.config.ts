import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright boots the Next.js dev server on port 3100, runs the e2e tests
 * against it, and shuts it down. Separate port keeps it from clobbering a
 * manually-started dev server on 3000.
 *
 * Before the first run, make sure the browsers are installed:
 *   npx playwright install chromium
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false, // Tests share the dev DB; keep serial.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://localhost:3100",
    trace: "on-first-retry",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Reset the DB and boot the dev server. Using a dedicated port lets us
    // run this test suite while a hand-started dev server is on 3000.
    command: "npm run db:reset && PORT=3100 npm run dev",
    url: "http://localhost:3100/login",
    timeout: 120_000,
    reuseExistingServer: !process.env.CI,
    stdout: "pipe",
    stderr: "pipe",
  },
});
