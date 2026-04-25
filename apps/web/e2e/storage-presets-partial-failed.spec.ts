import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';
import { signInToWarehouse } from './support/auth';
import { seedStoragePresetPartialFailedScenario } from './support/local-supabase';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const artifactDir = path.resolve(__dirname, '../../../output/playwright/storage-presets-p1');

test.describe('storage preset partial materialization', () => {
  test('selects the shell and shows backend reason after partial_failed', async ({ page }) => {
    const seed = await seedStoragePresetPartialFailedScenario();
    await mkdir(artifactDir, { recursive: true });
    await writeFile(path.join(artifactDir, 'seed-metadata.json'), `${JSON.stringify(seed, null, 2)}\n`);

    await signInToWarehouse(page);
    await page.goto(`/warehouse/view?floor=${encodeURIComponent(seed.floor.id)}`);
    await page.getByLabel('Site').selectOption(seed.site.id);
    await page.getByLabel('Floor').selectOption(seed.floor.id);
    await expect(page.getByRole('region', { name: 'Published warehouse layout' })).toBeVisible();

    await page.getByRole('button', { name: 'Storage' }).click();
    await expect(page.getByRole('region', { name: 'Storage workspace' })).toBeVisible();

    await page.getByLabel('Locate cell address').fill(seed.publishedLocation.cellAddress);
    await page.getByRole('button', { name: 'Locate' }).click();
    await expect(page.getByText(`Located ${seed.publishedLocation.cellAddress}.`)).toBeVisible();

    await page.getByTestId('create-from-preset-action').click();
    await expect(page.getByRole('complementary', { name: 'Create container from preset' })).toBeVisible();

    await page.getByLabel('Product search').fill(seed.product.sku);
    await page.getByRole('option', { name: new RegExp(seed.product.sku) }).click();
    await page.getByLabel('Storage preset').selectOption(seed.preset.id);
    await page.getByLabel('External code').fill(seed.externalContainerCode);
    await page.getByLabel('Create and fill standard contents').check();

    const createResponsePromise = page.waitForResponse(
      (response) =>
        response.url().includes(`/api/storage-presets/${seed.preset.id}/create-container`) &&
        response.request().method() === 'POST'
    );

    await page.getByTestId('confirm-create-from-preset').click();
    const createResponse = await createResponsePromise;
    const createResponseJson = await createResponse.json();
    await writeFile(
      path.join(artifactDir, 'create-container-response.json'),
      `${JSON.stringify(createResponseJson, null, 2)}\n`
    );

    expect(createResponse.status()).toBe(200);
    expect(createResponseJson).toMatchObject({
      externalCode: seed.externalContainerCode,
      materializationMode: 'shell',
      materializationStatus: 'partial_failed',
      materializationErrorCode: seed.expectedErrorCode,
      materializationErrorMessage: seed.expectedErrorMessage
    });

    const detailPanel = page.getByRole('complementary', {
      name: new RegExp(`Container detail: ${seed.externalContainerCode}`)
    });
    await expect(detailPanel).toBeVisible();
    await expect(detailPanel.getByText(seed.externalContainerCode)).toBeVisible();

    const warning = page.getByTestId('storage-preset-partial-failure-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(seed.expectedErrorMessage);

    await page.screenshot({
      path: path.join(artifactDir, 'partial-failed-warning.png'),
      fullPage: true
    });
  });
});
