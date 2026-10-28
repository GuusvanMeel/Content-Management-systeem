import { test as setup, expect, request  } from '@playwright/test';
import fs from 'node:fs';

const orgFile  = 'playwright/.auth/org.json';
const adminFile = 'playwright/.auth/admin.json';

const runInfoFile = 'playwright/.auth/run-org.json';

setup.describe.configure({ mode: 'serial' })

setup('inloggen als testadmin', async ({ page }) => {
  await page.goto('/admin/login');
  await page.getByRole('textbox', { name: 'Gebruikersnaam' }).fill(process.env.E2E_ADMIN_LOGIN);
  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(process.env.E2E_ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Inloggen' }).click();

  // Wacht tot je echt ingelogd bent. Pas dit aan aan wat de beheerpagina toont.
  await expect(page).toHaveURL(/\/admin(?!\/login)/);

  await page.context().storageState({ path: adminFile });
});

setup('inloggen als testorganisatie', async ({ page }) => {
  // 1. Organisatie aanmaken via de API, met de sessie van de admin.
  const name = `E2E-RUN-${Date.now()}`;
  const loginCode = name;
  const api = await request.newContext({
    baseURL: 'https://localhost',
    ignoreHTTPSErrors: true,
    storageState: adminFile,
        extraHTTPHeaders: { 'X-Requested-With': 'cms' },
  });
  const res = await api.post('/api/admin/organisations', {
    data: { name, loginCode , password: process.env.E2E_PASSWORD /*, overige verplichte velden */ },
  });

  expect(res.ok()).toBeTruthy();
  const org = await res.json(); // controleer of id en code erin zitten
  await api.dispose();

  // 2. Onthouden voor de tests en de opruiming.
  fs.writeFileSync(runInfoFile, JSON.stringify({ id: org.id, name, loginCode: org.loginCode, questLinkCode: org.questLinkCode }));
  
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Organisatiecode' }).fill(org.loginCode);
  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(process.env.E2E_PASSWORD);
  await page.getByRole('button', { name: 'Inloggen' }).click();

  // Wacht tot je echt ingelogd bent, voordat je de sessie opslaat.
  await expect(page.getByRole('navigation', { name: 'Hoofdmenu' })).toBeVisible();

  await page.context().storageState({ path: orgFile  });
});

