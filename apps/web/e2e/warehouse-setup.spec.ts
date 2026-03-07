import { expect, test } from '@playwright/test';
import { resetWarehouseData, seedSiteAndFloor } from './support/local-supabase';

test.describe('warehouse bootstrap flow', () => {
  test.beforeEach(async () => {
    await resetWarehouseData();
  });

  test('empty DB opens bootstrap wizard and can enter editor after first draft', async ({ page }) => {
    await page.goto('/warehouse');
    await expect(page.getByText('Bootstrap Warehouse Setup')).toBeVisible();

    await page.getByLabel('Site Code').fill('MAIN');
    await page.getByLabel('Site Name').fill('Main Site');
    await page.getByLabel('Timezone').fill('Asia/Jerusalem');
    await page.getByLabel('Floor Code').fill('F1');
    await page.getByLabel('Floor Name').fill('Main Floor');
    await page.getByRole('button', { name: 'Create Site, Floor, and First Draft' }).click();

    await expect(page.getByRole('region', { name: 'Warehouse editor' })).toBeVisible();
  });

  test('existing floor without draft requires explicit draft creation', async ({ page }) => {
    const { floor } = await seedSiteAndFloor();

    await page.goto('/warehouse');
    await expect(page.getByText('Select or Create Site and Floor')).toBeVisible();
    await page.getByLabel('Floor').selectOption(floor.id);

    const createDraftButton = page.getByRole('button', { name: 'Create First Draft for Selected Floor' });
    await expect(createDraftButton).toBeVisible();
    await createDraftButton.click();

    await expect(page.getByRole('region', { name: 'Warehouse editor' })).toBeVisible();
  });
});
