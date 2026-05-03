import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, '../..');
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function readRootEnv() {
  try {
    return Object.fromEntries(
      readFileSync(path.resolve(workspaceRoot, '.env'), 'utf8')
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#') && line.includes('='))
        .map((line) => {
          const separatorIndex = line.indexOf('=');
          return [line.slice(0, separatorIndex), line.slice(separatorIndex + 1)] as const;
        })
    );
  } catch {
    return {};
  }
}

const rootEnv = readRootEnv();

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
        VITE_SUPABASE_URL: process.env.E2E_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? rootEnv.VITE_SUPABASE_URL,
        VITE_SUPABASE_ANON_KEY: process.env.E2E_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? rootEnv.VITE_SUPABASE_ANON_KEY,
        VITE_BFF_URL: process.env.VITE_BFF_URL ?? rootEnv.VITE_BFF_URL ?? '/api',
        VITE_ENABLE_DEV_AUTO_LOGIN: 'false'
      },
      reuseExistingServer: true,
      timeout: 120000
    }
  ]
});
