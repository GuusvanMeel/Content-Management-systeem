import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker, ADMIN_STATE, TEST_PASSWORD, NEW_PASSWORD } from '../../helpers/org-api.js';

// Elke test maakt een eigen organisatie aan (E2E-...) en ruimt die op. De organisatie van deze
// run (PLAYWRIGHT / E2E-RUN) wordt hier nooit gewijzigd of verwijderd.

const t = createTracker();
test.afterEach(() => t.cleanup());

// Inloggen via het scherm in een eigen pagina ("een andere browser").
async function loginViaScreen(page, loginCode, password) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Organisatiecode' }).fill(loginCode);
  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(password);
  await page.getByRole('button', { name: 'Inloggen' }).click();
}

const mainMenu = (page) => page.getByRole('navigation', { name: 'Hoofdmenu' });

test('scenario 13: een wachtwoordreset beeindigt de sessie van de organisatie niet', async ({ browser }) => {
  const org = await t.organisation({ name: uniqueName('E2E-SC13') });
  const admin = await t.admin();

  // A is ingelogd in een andere browser.
  const pageA = await (await t.browserContext(browser)).newPage();
  await loginViaScreen(pageA, org.loginCode, TEST_PASSWORD);
  await expect(mainMenu(pageA)).toBeVisible();

  // De beheerder stelt een nieuw wachtwoord in.
  const reset = await admin.put(`/api/admin/organisations/${org.id}/password`, { data: { password: NEW_PASSWORD } });
  expect(reset.status()).toBe(204);

  // A kan gewoon doorwerken (FR-010).
  await mainMenu(pageA).getByRole('link', { name: 'Huisstijl' }).click();
  await expect(pageA.getByRole('heading', { name: 'Huisstijl' })).toBeVisible();

  // Na uitloggen werkt het oude wachtwoord niet meer en het nieuwe wel.
  await pageA.getByRole('button', { name: 'Uitloggen' }).click();
  await expect(pageA).toHaveURL(/\/login/);

  await loginViaScreen(pageA, org.loginCode, TEST_PASSWORD);
  await expect(pageA.getByRole('alert')).toContainText('Organisatiecode of wachtwoord onjuist.');

  await loginViaScreen(pageA, org.loginCode, NEW_PASSWORD);
  await expect(mainMenu(pageA)).toBeVisible();
});

test('scenario 13b: een codewijziging beeindigt de sessie en alleen de nieuwe code werkt', async ({ browser }) => {
  const org = await t.organisation({ name: uniqueName('E2E-SC13B') });
  const admin = await t.admin();

  const pageA = await (await t.browserContext(browser)).newPage();
  await loginViaScreen(pageA, org.loginCode, TEST_PASSWORD);
  await expect(mainMenu(pageA)).toBeVisible();

  // De beheerder wijzigt de code van A.
  const newCode = `${org.loginCode}-N`;
  const patch = await admin.patch(`/api/admin/organisations/${org.id}`, { data: { loginCode: newCode } });
  expect(patch.status()).toBe(200);

  // A klikt iets aan: de sessie is beeindigd, dus terug naar /login met de verlopen-melding.
  await mainMenu(pageA).getByRole('link', { name: 'Huisstijl' }).click();
  await expect(pageA).toHaveURL(/\/login/);
  await expect(pageA.getByRole('status')).toContainText('Je sessie is verlopen. Log opnieuw in.');

  // De oude code werkt niet meer, de nieuwe wel.
  await loginViaScreen(pageA, org.loginCode, TEST_PASSWORD);
  await expect(pageA.getByRole('alert')).toContainText('Organisatiecode of wachtwoord onjuist.');

  await loginViaScreen(pageA, newCode, TEST_PASSWORD);
  await expect(mainMenu(pageA)).toBeVisible();
});

test.describe('verwijderen in het beheerscherm', () => {
  test.use({ storageState: ADMIN_STATE });

  test('scenario 14: verwijderen annuleren laat de organisatie staan', async ({ page }) => {
    const org = await t.organisation({ name: uniqueName('E2E-SC14') });

    await page.goto('/admin');
    const row = page.getByRole('row').filter({ hasText: org.name });
    await row.getByRole('button', { name: 'Verwijderen' }).click();

    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toContainText(`${org.name} verwijderen?`);
    await dialog.getByRole('button', { name: 'Annuleren' }).click();

    await expect(dialog).toBeHidden();
    await expect(row).toBeVisible();

    // Ook in de API bestaat de organisatie nog.
    const admin = await t.admin();
    const { organisations } = await (await admin.get('/api/admin/organisations')).json();
    expect(organisations.some((o) => o.id === org.id)).toBe(true);
  });

  test('scenario 15: verwijderen bevestigen haalt de organisatie weg en houdt de code bezet', async ({ page }) => {
    const org = await t.organisation({ name: uniqueName('E2E-SC15') });

    await page.goto('/admin');
    const row = page.getByRole('row').filter({ hasText: org.name });
    await row.getByRole('button', { name: 'Verwijderen' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Verwijderen' }).click();

    // Weg uit het overzicht.
    await expect(row).toHaveCount(0);

    // Inloggen als de verwijderde organisatie faalt.
    const anon = await t.anonymousApi();
    const login = await anon.post('/api/auth/organisation/login', {
      data: { loginCode: org.loginCode, password: TEST_PASSWORD },
    });
    expect(login.status()).toBe(401);

    // Een nieuwe organisatie met dezelfde code wordt geweigerd (de code blijft bezet, FR-012).
    const admin = await t.admin();
    const again = await admin.post('/api/admin/organisations', {
      data: { name: uniqueName('E2E-SC15B'), loginCode: org.loginCode, password: TEST_PASSWORD },
    });
    expect(again.status()).toBe(409);
    expect((await again.json()).error.fields.loginCode).toBeTruthy();
  });
});
