import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/org.json';

setup('inloggen als testorganisatie', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Organisatiecode' }).fill(process.env.E2E_ORG_CODE);
  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(process.env.E2E_PASSWORD);
  await page.getByRole('button', { name: 'Inloggen' }).click();

  // Wacht tot je echt ingelogd bent, voordat je de sessie opslaat.
  await expect(page.getByRole('navigation', { name: 'Hoofdmenu' })).toBeVisible();

  await page.context().storageState({ path: authFile });
});