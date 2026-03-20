import { expect, type Page } from '@playwright/test';

const credentials = {
  email: 'admin@wos.local',
  password: 'warehouse123'
};

async function submitAndWait(page: Page, submitButton: ReturnType<Page['locator']>) {
  await submitButton.click();

  await Promise.race([
    page.waitForURL(/\/warehouse$/, { timeout: 4000 }).catch(() => null),
    expect(submitButton).toBeEnabled({ timeout: 4000 }).catch(() => null)
  ]);

  return page.url().endsWith('/warehouse');
}

export async function signInToWarehouse(page: Page) {
  await page.goto('/login');

  const emailInput = page.getByLabel('Email');
  const submitButton = page.locator('section').filter({ has: emailInput }).getByRole('button').last();
  const signInToggle = page.getByRole('button', { name: 'Sign In' }).first();
  const createAccountToggle = page.getByRole('button', { name: 'Create Account' }).first();
  await emailInput.fill(credentials.email);
  await page.getByLabel('Password').fill(credentials.password);
  let isAuthenticated = await submitAndWait(page, submitButton);

  if (!isAuthenticated) {
    await createAccountToggle.click();
    await page.getByLabel('Email').fill(credentials.email);
    await page.getByLabel('Password').fill(credentials.password);
    isAuthenticated = await submitAndWait(page, submitButton);
  }

  if (!isAuthenticated) {
    await signInToggle.click();
    await page.getByLabel('Email').fill(credentials.email);
    await page.getByLabel('Password').fill(credentials.password);
    await submitAndWait(page, submitButton);
  }

  await expect(page).toHaveURL(/\/warehouse$/);
}
