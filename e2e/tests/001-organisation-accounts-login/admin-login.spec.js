import { test, expect } from '@playwright/test';

// Deze tests beginnen uitgelogd, zonder de opgeslagen sessie.
test.use({ storageState: { cookies: [], origins: [] } });

const cases = [
  { omschrijving: 'fout wachtwoord', gebruiker: process.env.E2E_ADMIN_LOGIN, wachtwoord: 'Hetfoutewachtwoord' },
  { omschrijving: 'onbekende gebruiker', gebruiker: 'bestaat-niet', wachtwoord: process.env.E2E_ADMIN_PASSWORD },
];

for (const c of cases) {
  test(`scenario 1: ${c.omschrijving} geeft dezelfde melding en geen toegang`, async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByRole('textbox', { name: 'Gebruikersnaam' }).fill(c.gebruiker);
    await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(c.wachtwoord);
    await page.getByRole('button', { name: 'Inloggen' }).click();

    await expect(page.getByText('Gebruikersnaam of wachtwoord onjuist.')).toBeVisible();
    await expect(page).toHaveURL(/\/admin\/login/);
  });
}

test('scenario 6: /admin zonder sessie stuurt naar /admin/login', async ({ page }) => {

    await page.goto('/admin/login');
  await page.getByRole('textbox', { name: 'Gebruikersnaam' }).fill(process.env.E2E_ADMIN_LOGIN);
  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(process.env.E2E_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page).toHaveURL(/\/admin(?!\/login)/);

  // 2. Uitloggen.
  await page.getByRole('button', { name: 'Uitloggen' }).click();
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login/);
});