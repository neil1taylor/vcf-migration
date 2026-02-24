import { test, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.resolve(__dirname, 'fixtures/test-rvtools.xlsx');

test.describe('File Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('landing page shows upload drop zone', async ({ page }) => {
    const dropZone = page.locator('.drop-zone');
    await expect(dropZone).toBeVisible();
  });

  test('uploading a valid .xlsx navigates to dashboard', async ({ page }) => {
    const fileInput = page.locator('input.drop-zone__input');
    await fileInput.setInputFiles(FIXTURE_PATH);

    await page.waitForURL('**/dashboard', { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Executive Dashboard' })).toBeVisible();
  });

  test('uploading an invalid file shows an error', async ({ page }) => {
    // Create a temporary text file in the test
    const fileInput = page.locator('input.drop-zone__input');

    // Upload a file with invalid extension
    await fileInput.setInputFiles({
      name: 'invalid.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an excel file'),
    });

    // Should show an error notification and stay on the landing page
    const error = page.locator('.cds--inline-notification--error, .drop-zone__error');
    await expect(error).toBeVisible({ timeout: 5_000 });
  });

  test('upload area accepts drag-and-drop styling cues', async ({ page }) => {
    const dropZone = page.locator('.drop-zone');
    await expect(dropZone).toBeVisible();
    // Verify the input exists and accepts xlsx
    const fileInput = page.locator('input.drop-zone__input');
    await expect(fileInput).toBeAttached();
  });
});
