import { type Page, expect } from '@playwright/test';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = path.resolve(__dirname, '../fixtures/test-rvtools.xlsx');

/**
 * Upload the test RVTools fixture file and wait for the dashboard to load.
 */
export async function loadTestData(page: Page) {
  await page.goto('/');

  // The DropZone has a hidden <input type="file"> with class "drop-zone__input"
  const fileInput = page.locator('input.drop-zone__input');
  await fileInput.setInputFiles(FIXTURE_PATH);

  // App navigates to /dashboard after successful parse
  await page.waitForURL('**/dashboard', { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Executive Dashboard' })).toBeVisible();
}

/**
 * Navigate within the SPA via SideNav clicks (preserves React Context state).
 * Use this instead of page.goto() which causes a full reload and loses data.
 */
export async function navigateViaSideNav(page: Page, linkText: string, expectedPath: RegExp, parentMenu?: string) {
  if (parentMenu) {
    const menu = page.locator('.cds--side-nav__submenu', { hasText: parentMenu });
    const expanded = await menu.getAttribute('aria-expanded');
    if (expanded !== 'true') {
      await menu.click();
    }
  }
  const link = page.getByRole('link', { name: linkText }).or(
    page.locator('.cds--side-nav__link, .cds--side-nav__menu-item', { hasText: linkText })
  );
  await link.first().click();
  await expect(page).toHaveURL(expectedPath);
}
