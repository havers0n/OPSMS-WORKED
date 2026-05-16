import { expect, test, type Page } from '@playwright/test';
import { fillCredentials, installSupabaseAuthRoutes, signInToWarehouse } from './support/auth';
import { resetWarehouseData } from './support/local-supabase';

async function openAccountMenu(page: Page) {
  await page.getByLabel(/Account menu|תפריט חשבון/).click();
}

test.describe('auth runtime smoke', () => {
  test('anonymous protected navigation resolves to login without an auth loading loop', async ({ page }) => {
    await page.goto('/operations');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: /Sign in to the active warehouse workspace\.|התחברות לסביבת העבודה הפעילה של המחסן\./ })).toBeVisible();
    await expect(page.getByText('Signing in to the warehouse workspace...')).toHaveCount(0);
  });

  test('login, workspace session, refresh, and sign out keep the protected app shell coherent', async ({ page }) => {
    await resetWarehouseData();

    const meStatuses: number[] = [];
    await page.route('**/api/me', async (route) => {
      const response = await route.fetch();
      meStatuses.push(response.status());
      await route.fulfill({ response });
    });

    await signInToWarehouse(page);

    expect(meStatuses).toContain(200);
    await expect(page.getByText(/Bootstrap Warehouse Setup|אתחול הגדרת מחסן/)).toBeVisible();

    await page.goto('/operations');
    await openAccountMenu(page);
    await expect(page.getByRole('button', { name: /Sign Out|התנתקות/ })).toBeVisible();

    await page.reload();
    await expect(page).toHaveURL(/\/operations$/);
    await openAccountMenu(page);
    await expect(page.getByRole('button', { name: /Sign Out|התנתקות/ })).toBeVisible();

    await page.getByRole('button', { name: /Sign Out|התנתקות/ }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: /Sign in to the active warehouse workspace\.|התחברות לסביבת העבודה הפעילה של המחסן\./ })).toBeVisible();
  });

  test('workspace-unavailable session shows access screen and still signs out', async ({ page }) => {
    await installSupabaseAuthRoutes(page);

    await page.route('**/api/me', async (route) => {
      await route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'WORKSPACE_UNAVAILABLE',
          message: 'No workspace assigned'
        })
      });
    });

    await page.goto('/operations');
    await expect(page).toHaveURL(/\/login$/);

    await fillCredentials(page);
    await page.locator('form').filter({ has: page.getByLabel(/Email|אימייל/) }).getByRole('button', { name: /Sign In|התחברות/ }).click();

    await expect(page.getByText(/Workspace Access|גישה לסביבת עבודה/)).toBeVisible();
    await expect(page.getByText(/Your account is authenticated, but no warehouse workspace is assigned yet\.|החשבון מאומת, אבל עדיין לא הוקצתה לו סביבת עבודה במחסן\./)).toBeVisible();
    await expect(page.getByText('No workspace assigned', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /Sign out|התנתק/ }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('heading', { name: /Sign in to the active warehouse workspace\.|התחברות לסביבת העבודה הפעילה של המחסן\./ })).toBeVisible();
  });
});
