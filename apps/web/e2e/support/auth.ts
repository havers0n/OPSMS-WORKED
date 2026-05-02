import { expect, type Page } from '@playwright/test';
import { ensureLocalAuthSession, type LocalAuthSession } from './local-supabase';

const credentials = {
  email: 'admin@wos.local',
  password: 'warehouse123'
};

const authCorsHeaders = {
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
  'access-control-allow-origin': '*'
};

function authResponseBody(session: LocalAuthSession) {
  return {
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user
  };
}

export async function installSupabaseAuthRoutes(page: Page) {
  const session = await ensureLocalAuthSession();

  await page.route('**/auth/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());

    if (request.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: authCorsHeaders });
      return;
    }

    if (url.pathname.endsWith('/auth/v1/token')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: authCorsHeaders,
        body: JSON.stringify(authResponseBody(session))
      });
      return;
    }

    if (url.pathname.endsWith('/auth/v1/user')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: authCorsHeaders,
        body: JSON.stringify(session.user)
      });
      return;
    }

    if (url.pathname.endsWith('/auth/v1/logout')) {
      await route.fulfill({ status: 204, headers: authCorsHeaders });
      return;
    }

    await route.continue();
  });
}

export async function fillCredentials(page: Page) {
  await page.getByLabel('Email').fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
}

async function submitLoginForm(page: Page) {
  const form = page.locator('form').filter({ has: page.getByLabel('Email') });
  await form.getByRole('button', { name: /Sign In|Create Account/ }).click();
}

export async function signInToWarehouse(page: Page) {
  await installSupabaseAuthRoutes(page);
  await page.goto('/login');

  await fillCredentials(page);
  await submitLoginForm(page);
  await expect(page).toHaveURL(/\/warehouse$/);
}
