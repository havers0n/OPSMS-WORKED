import { expect, test, type Page, type Response } from '@playwright/test';
import { signInToWarehouse } from './support/auth';
import { resetWarehouseData, seedAdditionalFloorDraft, seedDraftScenario } from './support/local-supabase';

function isLayoutDraftSaveResponse(response: Response) {
  const url = new URL(response.url());
  return url.pathname === '/api/layout-drafts/save' && response.request().method() === 'POST';
}

function waitForLayoutDraftSave(page: Page) {
  return page.waitForResponse(isLayoutDraftSaveResponse);
}

async function selectFirstRack(page: Page) {
  const canvas = page.locator('.konvajs-content canvas').first();
  await expect(canvas).toBeVisible();
  await page.waitForFunction(() => {
    const stage = (window as Window & { __WOS_CANVAS_STAGE__?: any }).__WOS_CANVAS_STAGE__;
    const rackLayer = stage?.findOne?.('.rack-layer');
    return Boolean(rackLayer?.getChildren?.().length);
  });

  const point = await page.evaluate(() => {
    const stage = (window as Window & { __WOS_CANVAS_STAGE__?: any }).__WOS_CANVAS_STAGE__;
    const rackLayer = stage.findOne('.rack-layer');
    const rackGroup = rackLayer.getChildren()[0];
    const rect = rackGroup.getClientRect({ relativeTo: stage });
    const containerRect = stage.container().getBoundingClientRect();
    const scale = stage.scaleX();

    return {
      x: containerRect.left + stage.x() + (rect.x + rect.width / 2) * scale,
      y: containerRect.top + stage.y() + (rect.y + rect.height / 2) * scale
    };
  });

  await page.mouse.click(point.x, point.y);
  await expect(page.getByTestId('inspector-surface')).toBeVisible();
}

async function openFirstRackGeometry(page: Page) {
  await expect(page.getByRole('region', { name: 'Warehouse editor' })).toBeVisible();
  await selectFirstRack(page);
  await page.getByTestId('geometry-advanced-toggle').click();
  const totalLengthInput = page.getByLabel('Total Length');
  await expect(totalLengthInput).toBeVisible();
  return totalLengthInput;
}

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
    const totalLengthInput = await openFirstRackGeometry(page);

    const saveResponse = waitForLayoutDraftSave(page);
    await totalLengthInput.fill('5.7');
    await totalLengthInput.fill('5.8');
    await expect(page.getByText('Unsaved')).toBeVisible();
    await saveResponse;
    await expect(page.getByText('Saved')).toBeVisible();
    await expect(totalLengthInput).toHaveValue('5.8');
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
    const firstFloorTotalLengthInput = await openFirstRackGeometry(page);

    await firstFloorTotalLengthInput.fill('6.1');
    await expect(page.getByText('Unsaved')).toBeVisible();

    page.once('dialog', async (dialog) => {
      await dialog.dismiss();
    });
    await page.getByLabel('Floor').selectOption(second.floor.id);

    await expect(page.getByLabel('Floor')).toHaveValue(first.floor.id);
    await expect(firstFloorTotalLengthInput).toHaveValue('6.1');

    page.once('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.getByLabel('Floor').selectOption(second.floor.id);

    await expect(page.getByLabel('Floor')).toHaveValue(second.floor.id);
    const secondFloorTotalLengthInput = await openFirstRackGeometry(page);
    await expect(secondFloorTotalLengthInput).toHaveValue('5');
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
    const totalLengthInput = await openFirstRackGeometry(page);

    const conflictResponse = waitForLayoutDraftSave(page);
    await totalLengthInput.fill('5.7');
    await conflictResponse;
    await expect(page.getByText('Conflict')).toBeVisible();

    const secondSaveAttempt = page
      .waitForResponse(isLayoutDraftSaveResponse, { timeout: 2500 })
      .then(() => true)
      .catch(() => false);
    await totalLengthInput.fill('5.9');
    await expect(secondSaveAttempt).resolves.toBe(false);
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
    await expect(page.getByText('Saved')).toBeVisible();

    await page.getByRole('button', { name: /Publish/i }).click();
    await expect(page.getByText('Rack R-03 has overlapping cells.')).toBeVisible();
    await expect(page.getByText('Save failed')).not.toBeVisible();
  });
});
