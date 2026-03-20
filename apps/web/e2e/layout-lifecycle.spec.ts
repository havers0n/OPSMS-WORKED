import { expect, test } from '@playwright/test';
import { signInToWarehouse } from './support/auth';
import { resetWarehouseData, seedAdditionalFloorDraft, seedDraftScenario } from './support/local-supabase';

test.describe('live draft lifecycle', () => {
  test.beforeEach(async () => {
    await resetWarehouseData();
  });

  test('selected floor with draft supports edit, save, validate, and publish', async ({ page }) => {
    const { floor } = await seedDraftScenario({ rackDisplayCode: '03' });

    await signInToWarehouse(page);
    await page.getByLabel('Floor').selectOption(floor.id);
    await expect(page.getByRole('region', { name: 'Warehouse editor' })).toBeVisible();

    const displayCodeInput = page.getByLabel('Display Code');
    await displayCodeInput.fill('07');
    await expect(page.getByText('Unsaved draft')).toBeVisible();
    await expect(page.getByRole('button', { name: /Publish/i })).toBeDisabled();

    await page.getByRole('button', { name: 'Save Draft' }).click();
    await expect(page.getByText('Draft saved')).toBeVisible();
    await expect(page.getByText('Draft synced')).toBeVisible();

    await page.getByRole('button', { name: /Validate/i }).click();
    await expect(page.getByText('Layout is valid')).toBeVisible();

    await page.getByRole('button', { name: /Publish/i }).click();
    await expect(page.getByText(/Published with 8 generated cells/)).toBeVisible();
  });

  test('dirty draft floor switch is guarded and only switches after confirmation', async ({ page }) => {
    const first = await seedDraftScenario({ floorCode: 'F1', floorName: 'Main Floor', rackDisplayCode: '03' });
    const second = await seedAdditionalFloorDraft(first.site.id, { floorCode: 'F2', floorName: 'Overflow Floor', sortOrder: 1, rackDisplayCode: '09' });

    await signInToWarehouse(page);
    await page.getByLabel('Floor').selectOption(first.floor.id);
    await expect(page.getByText('Rack 03').first()).toBeVisible();

    await page.getByLabel('Display Code').fill('11');
    await expect(page.getByText('Unsaved draft')).toBeVisible();

    page.once('dialog', async (dialog) => {
      await dialog.dismiss();
    });
    await page.getByLabel('Floor').selectOption(second.floor.id);

    await expect(page.getByText('Rack 11').first()).toBeVisible();
    await expect(page.getByLabel('Floor')).toHaveValue(first.floor.id);

    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.getByLabel('Floor').selectOption(second.floor.id);

    await expect(page.getByLabel('Floor')).toHaveValue(second.floor.id);
    await expect(page.getByText('Rack 09').first()).toBeVisible();
  });
});
