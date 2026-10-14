import { defineConfig } from "@playwright/test";

// Runs against a dev server on :3000 plus the worker (start both first):
//   npm run db:local · npm run dev · npm run worker · npm run e2e
// Uses the installed Microsoft Edge (no Playwright browser download).
export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: "list",
  use: { baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000", channel: "msedge", trace: "retain-on-failure" },
});
