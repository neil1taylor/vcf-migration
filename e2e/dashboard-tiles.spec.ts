import { test, expect } from '@playwright/test';
import { loadTestData } from './helpers/load-data';

test.describe('Dashboard Tiles', () => {
  test.beforeEach(async ({ page }) => {
    await loadTestData(page);
  });

  // ── MetricCard navigation ──────────────────────────────────────────────────

  test.describe('MetricCard navigation', () => {
    const metricTests: Array<{ label: string; expectedPath: string }> = [
      { label: 'Total VMs', expectedPath: '/discovery' },
      { label: 'Total vCPUs', expectedPath: '/compute' },
      { label: 'Total Memory', expectedPath: '/compute' },
      { label: 'Provisioned Storage', expectedPath: '/storage' },
      { label: 'ESXi Hosts', expectedPath: '/hosts' },
      { label: 'Clusters', expectedPath: '/cluster' },
      { label: 'Templates', expectedPath: '/discovery' },
    ];

    for (const { label, expectedPath } of metricTests) {
      test(`clicking "${label}" navigates to ${expectedPath}`, async ({ page }) => {
        const card = page.locator('.metric-card--clickable', { hasText: label }).first();
        await card.click();
        await expect(page).toHaveURL(new RegExp(`${expectedPath}$`));
      });
    }
  });

  // ── Config tile navigation ─────────────────────────────────────────────────

  test.describe('Config tile navigation', () => {
    const configTests: Array<{ label: string; expectedTab: string }> = [
      { label: 'Configuration Issues', expectedTab: 'vms' },
      { label: 'Tools Not Installed', expectedTab: 'vmware-tools' },
      { label: 'Old Snapshots', expectedTab: 'snapshots' },
      { label: 'CD-ROM Connected', expectedTab: 'cd-roms' },
      { label: 'VMs with Snapshots', expectedTab: 'snapshots' },
    ];

    for (const { label, expectedTab } of configTests) {
      test(`clicking "${label}" navigates to /tables?tab=${expectedTab}`, async ({ page }) => {
        const tile = page.locator('.dashboard-page__config-tile', { hasText: label }).first();
        await tile.click();
        await expect(page).toHaveURL(new RegExp(`/tables\\?tab=${expectedTab}$`));
      });
    }
  });

  // ── TablesPage tab selection ───────────────────────────────────────────────

  test.describe('TablesPage tab selection', () => {
    const tabTests: Array<{ configLabel: string; tabPattern: RegExp }> = [
      { configLabel: 'Configuration Issues', tabPattern: /^VMs/ },
      { configLabel: 'Tools Not Installed', tabPattern: /^VMware Tools/ },
      { configLabel: 'Old Snapshots', tabPattern: /^Snapshots/ },
      { configLabel: 'CD-ROM Connected', tabPattern: /^CD-ROMs/ },
      { configLabel: 'VMs with Snapshots', tabPattern: /^Snapshots/ },
    ];

    for (const { configLabel, tabPattern } of tabTests) {
      test(`"${configLabel}" selects the correct tab`, async ({ page }) => {
        const tile = page.locator('.dashboard-page__config-tile', { hasText: configLabel }).first();
        await tile.click();
        await page.waitForURL(/\/tables/);

        const selectedTab = page.getByRole('tab', { name: tabPattern, selected: true });
        await expect(selectedTab).toBeVisible();
      });
    }
  });

  // ── Tooltip isolation (stopPropagation) ────────────────────────────────────

  test.describe('Tooltip isolation', () => {
    test('clicking MetricCard info button does not navigate away', async ({ page }) => {
      const card = page.locator('.metric-card--clickable', { hasText: 'Total VMs' }).first();
      const infoBtn = card.locator('.metric-card__info-button');
      await infoBtn.click();
      await expect(page).toHaveURL(/\/dashboard$/);
    });

    test('clicking config tile info button does not navigate away', async ({ page }) => {
      const tile = page.locator('.dashboard-page__config-tile', { hasText: 'Configuration Issues' }).first();
      const infoBtn = tile.locator('.dashboard-page__info-button');
      await infoBtn.click();
      await expect(page).toHaveURL(/\/dashboard$/);
    });
  });

  // ── Hover arrow visibility ─────────────────────────────────────────────────

  test.describe('Hover arrow visibility', () => {
    test('MetricCard shows nav arrow on hover', async ({ page }) => {
      const card = page.locator('.metric-card--clickable', { hasText: 'Total VMs' }).first();
      const arrow = card.locator('.metric-card__nav-arrow');

      // Before hover, arrow should have default opacity (0.5)
      await expect(arrow).toHaveCSS('opacity', '0.5');

      await card.hover();

      // After hover, arrow should have full opacity
      await expect(arrow).toHaveCSS('opacity', '1');
    });

    test('config tile shows nav arrow on hover', async ({ page }) => {
      const tile = page.locator('.dashboard-page__config-tile--clickable', { hasText: 'Configuration Issues' }).first();
      const arrow = tile.locator('.dashboard-page__config-nav-arrow');

      // Before hover, arrow should have default opacity (0.5)
      await expect(arrow).toHaveCSS('opacity', '0.5');

      await tile.hover();

      // After hover, arrow should have full opacity
      await expect(arrow).toHaveCSS('opacity', '1');
    });
  });
});
