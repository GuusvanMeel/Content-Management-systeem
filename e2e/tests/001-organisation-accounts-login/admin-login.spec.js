import { test, expect } from '@playwright/test';

// Deze tests beginnen uitgelogd, zonder de opgeslagen sessie.
test.use({ storageState: { cookies: [], origins: [] } });

test('scenario 1: fout wachtwoord geeft een melding en geen toegang', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByRole('textbox', { name: 'Gebruikersnaam' }).fill('playwright-admin');
  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill('Hetfoutewachtwoord');
  await page.getByRole('button', { name: 'Inloggen' }).click();

  await expect(page.getByText('Gebruikersnaam of wachtwoord onjuist.')).toBeVisible();
  await expect(page).toHaveURL(/\/admin\/login/); // nog steeds op de loginpagina
});

test('scenario 6: /admin zonder sessie stuurt naar /admin/login', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
});