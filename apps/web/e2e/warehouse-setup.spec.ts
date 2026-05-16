import { expect, test, type Page } from '@playwright/test';
import { signInToWarehouse } from './support/auth';
import { resetWarehouseData, seedSiteAndFloor } from './support/local-supabase';

function waitForSuccessfulPost(page: Page, path: string) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      url.pathname === `/api${path}` &&
      response.request().method() === 'POST' &&
      response.ok()
    );
  });
}

test.describe('warehouse bootstrap flow', () => {
  test.beforeEach(async () => {
    await resetWarehouseData();
  });

  test('empty DB opens bootstrap wizard and can enter editor after first draft', async ({ page }) => {
    await signInToWarehouse(page);
    await expect(page.getByText(/Bootstrap Warehouse Setup|אתחול הגדרת מחסן/)).toBeVisible();

    await page.getByLabel(/Site Code|קוד אתר/).fill('MAIN');
    await page.getByLabel(/Site Name|שם אתר/).fill('Main Site');
    await page.getByLabel(/Timezone|אזור זמן/).fill('Asia/Jerusalem');
    await page.getByLabel(/Floor Code|קוד רצפה/).fill('F1');
    await page.getByLabel(/Floor Name|שם רצפה/).fill('Main Floor');

    const createSiteResponse = waitForSuccessfulPost(page, '/sites');
    const createFloorResponse = waitForSuccessfulPost(page, '/floors');
    const createDraftResponse = waitForSuccessfulPost(page, '/layout-drafts');
    await page.getByRole('button', { name: /Create Site, Floor, and First Draft|צור אתר, רצפה וטיוטה ראשונה/ }).click();
    await createSiteResponse;
    await createFloorResponse;
    await createDraftResponse;

    await expect(page.getByRole('region', { name: /Warehouse editor|עורך המחסן/ })).toBeVisible();
  });

  test('existing floor without draft requires explicit draft creation', async ({ page }) => {
    const { floor } = await seedSiteAndFloor({
      siteCode: 'E2E_SETUP',
      siteName: 'E2E Setup Site',
      floorCode: 'E2E_F1',
      floorName: 'E2E Setup Floor'
    });

    await signInToWarehouse(page);
    await expect(page.getByText(/Select or Create Site and Floor|בחירה או יצירה של אתר ורצפה/)).toBeVisible();
    await page.getByLabel(/Floor|רצפה/).selectOption(floor.id);
    await expect(page.getByLabel(/Floor|רצפה/)).toHaveValue(floor.id);

    const createDraftButton = page.getByRole('button', { name: /Create First Draft for Selected Floor|צור טיוטה ראשונה לרצפה שנבחרה/ });
    await expect(createDraftButton).toBeVisible();
    const createDraftResponse = waitForSuccessfulPost(page, '/layout-drafts');
    await createDraftButton.click();
    await createDraftResponse;

    await expect(page.getByRole('region', { name: /Warehouse editor|עורך המחסן/ })).toBeVisible();
  });
});
