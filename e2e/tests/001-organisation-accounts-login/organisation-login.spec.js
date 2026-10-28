import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import { createTracker } from '../../helpers/org-api.js';

// Begint uitgelogd, met een eigen verse sessie.
test.use({ storageState: { cookies: [], origins: [] } });

const t = createTracker();
test.afterEach(() => t.cleanup());

test('scenario 7: inloggen met de code in kleine letters toont de organisatienaam', async ({ page }) => {
  const { name, loginCode } = JSON.parse(fs.readFileSync('playwright/.auth/run-org.json', 'utf8'));

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Organisatiecode' }).fill(loginCode.toLowerCase());
  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(process.env.E2E_PASSWORD);
  await page.getByRole('button', { name: 'Inloggen' }).click();

  await expect(page.getByRole('navigation', { name: 'Hoofdmenu' })).toBeVisible();
  await expect(page.getByText(name).first()).toBeVisible();
});

test('scenario 8: de Quest-koppelcode werkt niet als organisatiecode', async ({ page }) => {
  const { questLinkCode } = JSON.parse(fs.readFileSync('playwright/.auth/run-org.json', 'utf8'));
  expect(questLinkCode, 'run-org.json bevat geen questLinkCode; controleer auth.setup.js').toBeTruthy();

  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Organisatiecode' }).fill(questLinkCode);
  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(process.env.E2E_PASSWORD);
  await page.getByRole('button', { name: 'Inloggen' }).click();

  // Dezelfde algemene melding als bij een fout wachtwoord (FR-017), en je blijft op de loginpagina.
  await expect(page.getByRole('alert')).toContainText('Organisatiecode of wachtwoord onjuist.');
  await expect(page).toHaveURL(/\/login/);
});

test('scenario 9: een organisatie krijgt 403 op de beheer-API', async () => {
  const { loginCode } = JSON.parse(fs.readFileSync('playwright/.auth/run-org.json', 'utf8'));
  const api = await t.login(loginCode, process.env.E2E_PASSWORD);

  for (const path of ['/api/admin/organisations', '/api/admin/action-log']) {
    const res = await api.get(path);
    expect(res.status(), `GET ${path}`).toBe(403);
    expect((await res.json()).error.code).toBe('forbidden');
  }
});
