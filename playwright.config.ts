import { defineConfig, devices } from '@playwright/test';

// A port of its own on 127.0.0.1, not Vite's default 4173 on localhost: on 16 Nov 2026 another
// project's preview server took 4173 and this suite "reused" it and tested the wrong app. A fresh
// server per run (reuseExistingServer: false) also means the tests always see this tree's build;
// if the port is busy, the run stops with an error instead.
const PORT = Number(process.env.E2E_PORT ?? 4373);
const BASE_URL = `http://127.0.0.1:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // Most tests fill the add form several times and run axe scans: 10 to 25 s on an idle machine.
  // With other work loading the machine (load average 60 to 137 on 10 cores, 16 Nov 2026) the 30 s
  // default timed out in actions that then passed alone, so each test gets 90 s. Assertions and
  // their 5 s expect timeout are unchanged.
  timeout: 90_000,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    // Tests run against the production build, not the dev server.
    command: `npm run build && npx vite preview --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    reuseExistingServer: false,
    // The build includes a full typecheck: 10 s on an idle machine, 71 s at load average 147.
    timeout: 300 * 1000,
  },
});
