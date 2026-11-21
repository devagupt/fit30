import { defineConfig, devices } from '@playwright/test';

const url = 'http://127.0.0.1:4168';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  use: {
    ...devices['Pixel 7'],
    browserName: 'chromium',
    baseURL: url,
    launchOptions: { executablePath: process.env.FIT30_CHROME_PATH || undefined },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run preview -- --host 127.0.0.1 --port 4168',
    url,
    timeout: 20_000,
  },
});
