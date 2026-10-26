import { test, expect } from '@playwright/test';

test('nieuwe cursus aanmaken', async ({ page }) => {
  const name = `Testcursus ${Date.now()}`;

  await page.goto('/');
  await page.getByRole('navigation', { name: 'Hoofdmenu' }).getByRole('link', { name: 'Cursussen' }).click();
  await page.getByRole('button', { name: 'Nieuwe cursus' }).click();
  await page.locator('[data-test="course-name"]').fill(name);
  await page.locator('[data-test="course-description"]').fill('Dit is een cursus');
  await page.getByRole('button', { name: 'Aanmaken' }).click();

  // Controleer het resultaat. Pas dit aan aan wat de app na Aanmaken toont.
  await expect(page.getByText(name)).toBeVisible();
});