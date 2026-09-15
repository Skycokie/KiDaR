import { defineConfig, devices } from "@playwright/test";
import { readFileSync } from "node:fs";

try {
  const localEnv = readFileSync("apps/web/.env.local", "utf8");
  for (const line of localEnv.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2];
  }
} catch {
  // CI supplies these values through the workflow environment.
}

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry"
  },
  projects: [
    { name: "desktop", use: devices["Desktop Chrome"] },
    {
      name: "mobile",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 390, height: 844 },
        isMobile: true
      }
    }
  ],
  webServer: {
    command: "pnpm --filter @kidar/web dev",
    url: "http://localhost:3000",
    reuseExistingServer: true,
    timeout: 120_000
  }
});
