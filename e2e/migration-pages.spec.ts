import { test, expect } from '@playwright/test';
import { loadTestData, navigateViaSideNav } from './helpers/load-data';

test.describe('Migration Pages', () => {
  test.beforeEach(async ({ page }) => {
    await loadTestData(page);
  });

  test.describe('ROKS Migration', () => {
    test('loads ROKS migration page with key sections', async ({ page }) => {
      await navigateViaSideNav(page, 'ROKS Migration', /\/roks-migration$/, 'Migration Assessment');

      // Page should have a heading
      const heading = page.getByRole('heading', { level: 1 }).or(page.getByRole('heading', { level: 2 })).first();
      await expect(heading).toBeVisible();
    });

    test('has navigation tabs', async ({ page }) => {
      await navigateViaSideNav(page, 'ROKS Migration', /\/roks-migration$/, 'Migration Assessment');
      const tabs = page.getByRole('tab');
      await expect(tabs.first()).toBeVisible();
    });
  });

  test.describe('VSI Migration', () => {
    test('loads VSI migration page with key sections', async ({ page }) => {
      await navigateViaSideNav(page, 'VSI Migration', /\/vsi-migration$/, 'Migration Assessment');

      const heading = page.getByRole('heading', { level: 1 }).or(page.getByRole('heading', { level: 2 })).first();
      await expect(heading).toBeVisible();
    });

    test('has navigation tabs', async ({ page }) => {
      await navigateViaSideNav(page, 'VSI Migration', /\/vsi-migration$/, 'Migration Assessment');
      const tabs = page.getByRole('tab');
      await expect(tabs.first()).toBeVisible();
    });
  });

  test.describe('Export page', () => {
    test('loads export page with export options', async ({ page }) => {
      await navigateViaSideNav(page, 'Export', /\/export$/);

      const heading = page.getByRole('heading').first();
      await expect(heading).toBeVisible();
    });
  });
});
