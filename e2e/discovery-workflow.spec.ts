import { test, expect } from '@playwright/test';
import { loadTestData } from './helpers/load-data';

test.describe('Discovery Workflow', () => {
  test.beforeEach(async ({ page }) => {
    await loadTestData(page);
  });

  test('navigates to discovery page from dashboard', async ({ page }) => {
    // Click the Total VMs metric card which should navigate to discovery
    const card = page.locator('.metric-card--clickable', { hasText: 'Total VMs' }).first();
    await card.click();
    await expect(page).toHaveURL(/\/discovery$/);
  });

  test('discovery page shows VM table', async ({ page }) => {
    await page.goto('/discovery');
    await expect(page).toHaveURL(/\/discovery$/);

    // Should show a data table with VMs
    const table = page.getByRole('table');
    await expect(table).toBeVisible({ timeout: 10_000 });
  });

  test('discovery page has search functionality', async ({ page }) => {
    await page.goto('/discovery');

    // Search bar should be visible
    const searchInput = page.getByPlaceholder('Search VMs...');
    await expect(searchInput).toBeVisible();

    // Type a search term
    await searchInput.fill('test');

    // Table should still be visible (filtered)
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
  });

  test('discovery page has workload and network tabs', async ({ page }) => {
    await page.goto('/discovery');

    // Should have tab navigation
    const tabs = page.getByRole('tab');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(2);
  });

  test('VM table shows VM rows from fixture data', async ({ page }) => {
    await page.goto('/discovery');

    const table = page.getByRole('table');
    await expect(table).toBeVisible({ timeout: 10_000 });

    // Fixture has 3 VMs — rows should be present
    const rows = page.getByRole('row');
    // Header row + at least 1 data row
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);
  });
});
