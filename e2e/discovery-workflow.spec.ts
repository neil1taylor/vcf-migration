import { test, expect } from '@playwright/test';
import { loadTestData, navigateViaSideNav } from './helpers/load-data';

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
    await navigateViaSideNav(page, 'Discovery', /\/discovery$/);

    // Switch to the Workload tab which contains the VM table
    const workloadTab = page.getByRole('tab', { name: /Workload/i });
    await expect(workloadTab).toBeVisible({ timeout: 10_000 });
    await workloadTab.click();

    // Should show a data table with VMs
    const table = page.getByRole('table');
    await expect(table).toBeVisible({ timeout: 10_000 });
  });

  test('discovery page has search functionality', async ({ page }) => {
    await navigateViaSideNav(page, 'Discovery', /\/discovery$/);

    // Switch to Workload tab which has the VM search
    const workloadTab = page.getByRole('tab', { name: /Workload/i });
    await expect(workloadTab).toBeVisible({ timeout: 10_000 });
    await workloadTab.click();

    // Carbon expandable search — click the input directly to expand it
    const searchInput = page.getByPlaceholder('Search VMs...');
    await searchInput.click({ force: true });
    await expect(searchInput).toBeVisible({ timeout: 5_000 });

    // Type a search term
    await searchInput.fill('test');

    // Table should still be visible (filtered)
    const table = page.getByRole('table');
    await expect(table).toBeVisible();
  });

  test('discovery page has workload and network tabs', async ({ page }) => {
    await navigateViaSideNav(page, 'Discovery', /\/discovery$/);

    // Wait for tabs to render
    const firstTab = page.getByRole('tab').first();
    await expect(firstTab).toBeVisible({ timeout: 10_000 });

    // Should have tab navigation (Infrastructure, Workload, Networks)
    const tabs = page.getByRole('tab');
    const tabCount = await tabs.count();
    expect(tabCount).toBeGreaterThanOrEqual(2);
  });

  test('VM table shows VM rows from fixture data', async ({ page }) => {
    await navigateViaSideNav(page, 'Discovery', /\/discovery$/);

    // Switch to the Workload tab which contains the VM table
    const workloadTab = page.getByRole('tab', { name: /Workload/i });
    await expect(workloadTab).toBeVisible({ timeout: 10_000 });
    await workloadTab.click();

    const table = page.getByRole('table');
    await expect(table).toBeVisible({ timeout: 10_000 });

    // Fixture has 3 VMs — rows should be present
    const rows = table.getByRole('row');
    // Header row + at least 1 data row
    const rowCount = await rows.count();
    expect(rowCount).toBeGreaterThanOrEqual(2);
  });
});
