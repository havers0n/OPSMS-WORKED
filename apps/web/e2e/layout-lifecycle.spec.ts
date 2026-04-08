import { expect, test } from '@playwright/test';
import { signInToWarehouse } from './support/auth';
import { resetWarehouseData, seedAdditionalFloorDraft, seedDraftScenario } from './support/local-supabase';

test.describe('live draft lifecycle', () => {
  test.beforeEach(async () => {
    await resetWarehouseData();
  });

  test('selected floor with draft supports autosave, validate, and publish', async ({ page }) => {
    const { floor } = await seedDraftScenario({ rackDisplayCode: '03' });
    let saveRequestCount = 0;

    await page.route('**/api/layout-drafts/save', async (route) => {
      saveRequestCount += 1;
      // Hold the response in-flight long enough for the Saving... state to render.
      await new Promise<void>((resolve) => setTimeout(resolve, 500));
      await route.continue();
    });

    await signInToWarehouse(page);
    await page.getByLabel('Floor').selectOption(floor.id);
    await expect(page.getByRole('region', { name: 'Warehouse editor' })).toBeVisible();

    const displayCodeInput = page.getByLabel('Display Code');
    await displayCodeInput.fill('07');
    await displayCodeInput.fill('08');
    await expect(page.getByText('Unsaved')).toBeVisible();
    await expect(page.getByText('Saving...')).toBeVisible();
    await expect(page.getByText('Saved')).toBeVisible();
    await expect(displayCodeInput).toHaveValue('08');
    expect(saveRequestCount).toBe(1);

    await page.getByRole('button', { name: /Validate/i }).click();
    await expect(page.getByText('Valid')).toBeVisible();

    await page.getByRole('button', { name: /Publish/i }).click();
    await expect(page.getByText(/Published/i)).toBeVisible();
  });

  test('dirty draft floor switch is guarded and only switches after confirmation', async ({ page }) => {
    const first = await seedDraftScenario({ floorCode: 'F1', floorName: 'Main Floor', rackDisplayCode: '03' });
    const second = await seedAdditionalFloorDraft(first.site.id, { floorCode: 'F2', floorName: 'Overflow Floor', sortOrder: 1, rackDisplayCode: '09' });

    await signInToWarehouse(page);
    await page.getByLabel('Floor').selectOption(first.floor.id);
    await expect(page.getByText('Rack 03').first()).toBeVisible();

    await page.getByLabel('Display Code').fill('11');
    await expect(page.getByText('Unsaved')).toBeVisible();

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

  test('conflict hard-stop shows Conflict status and blocks further autosave', async ({ page }) => {
    const { floor } = await seedDraftScenario({ rackDisplayCode: '03' });
    let saveRequestCount = 0;

    await page.route('**/api/layout-drafts/save', async (route) => {
      saveRequestCount += 1;
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'DRAFT_CONFLICT',
          message: 'Layout draft was changed by another session. Please reload.'
        })
      });
    });

    await signInToWarehouse(page);
    await page.getByLabel('Floor').selectOption(floor.id);
    await expect(page.getByRole('region', { name: 'Warehouse editor' })).toBeVisible();

    const displayCodeInput = page.getByLabel('Display Code');
    await displayCodeInput.fill('07');
    // Wait for the autosave debounce (2s) to fire and the conflict response to land.
    await expect(page.getByText('Conflict')).toBeVisible();

    // A second edit must not trigger another save — conflict is a terminal hard-stop.
    await displayCodeInput.fill('08');
    await page.waitForTimeout(3000); // longer than the 2s debounce
    expect(saveRequestCount).toBe(1);
  });

  test('publish gate failure shows first validation issue rather than a generic error', async ({ page }) => {
    const { floor } = await seedDraftScenario({ rackDisplayCode: '03' });

    await page.route('**/api/layout-drafts/*/publish', async (route) => {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'LAYOUT_VALIDATION_FAILED',
          message: 'Layout draft failed validation. Please review the reported issues.'
        })
      });
    });

    await page.route('**/api/layout-drafts/*/validate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          isValid: false,
          issues: [{ severity: 'error', message: 'Rack R-03 has overlapping cells.' }]
        })
      });
    });

    await signInToWarehouse(page);
    await page.getByLabel('Floor').selectOption(floor.id);
    await expect(page.getByRole('region', { name: 'Warehouse editor' })).toBeVisible();
    // Wait for the draft to finish loading before attempting to publish.
    await expect(page.getByText('Saved')).toBeVisible();

    await page.getByRole('button', { name: /Publish/i }).click();
    await expect(page.getByText('Rack R-03 has overlapping cells.')).toBeVisible();
    await expect(page.getByText('Save failed')).not.toBeVisible();
  });
});
