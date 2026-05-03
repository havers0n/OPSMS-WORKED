import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:4173'
  },
  webServer: [
    {
      command: `${npmCommand} run dev --workspace @wos/bff`,
      cwd: path.resolve(__dirname, '../..'),
      url: 'http://127.0.0.1:8787/ready',
      reuseExistingServer: true,
      timeout: 120000
    },
    {
      command: `${npmCommand} run dev -- --host 127.0.0.1 --port 4173`,
      cwd: __dirname,
      url: 'http://127.0.0.1:4173/warehouse',
      env: {
        ...process.env,
        VITE_ENABLE_DEV_AUTO_LOGIN: 'false'
      },
      reuseExistingServer: true,
      timeout: 120000
    }
  ]
});
