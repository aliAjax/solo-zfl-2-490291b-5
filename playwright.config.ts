import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: [['list']],
  timeout: 60000,
  expect: { timeout: 10000 },
  use: {
    baseURL: 'http://127.0.0.1:5199',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'off',
    actionTimeout: 8000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], channel: undefined },
      // 先跑较轻的回归用例，再跑资源消耗较大的决策台枚举用例，
      // 避免在资源受限环境中跨用例累积导致冷导航超时。
      testMatch: /.*regression\.spec\.ts/,
    },
    {
      name: 'chromium-bench',
      use: { ...devices['Desktop Chrome'], channel: undefined },
      testMatch: /.*bench\.spec\.ts/,
    },
  ],
  webServer: {
    command: 'npm run dev -- --port 5199 --host 127.0.0.1',
    url: 'http://127.0.0.1:5199',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
