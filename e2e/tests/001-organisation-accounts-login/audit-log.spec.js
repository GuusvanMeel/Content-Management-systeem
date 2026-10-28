import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker, ADMIN_STATE, TEST_PASSWORD, NEW_PASSWORD } from '../../helpers/org-api.js';

// Scenario 16 kijkt als beheerder naar het logboek. De acties worden via de API uitgevoerd
// (snel en betrouwbaar); het logboek zelf wordt in de pagina gecontroleerd.
test.use({ storageState: ADMIN_STATE });

const t = createTracker();
test.afterEach(() => t.cleanup());

test('scenario 16: het logboek toont alle acties, nieuwste eerst, zonder wachtwoorden', async ({ page }) => {
  const admin = await t.admin();
  const finalName = uniqueName('E2E-SC16-NIEUW');

  // Vier acties op een eigen organisatie, in deze volgorde.
  const org = await t.organisation({ name: uniqueName('E2E-SC16') }); // Aangemaakt
  const rename = await admin.patch(`/api/admin/organisations/${org.id}`, { data: { name: finalName } }); // Gewijzigd
  expect(rename.status()).toBe(200);
  const reset = await admin.put(`/api/admin/organisations/${org.id}/password`, { data: { password: NEW_PASSWORD } }); // Wachtwoord gereset
  expect(reset.status()).toBe(204);
  const remove = await admin.delete(`/api/admin/organisations/${org.id}`); // Verwijderd
  expect(remove.status()).toBe(204);

  await page.goto('/admin/log');

  // Het logboek toont de huidige naam van de organisatie, dus alle vier de regels bevatten finalName.
  const rows = page.getByRole('row').filter({ hasText: finalName });
  await expect(rows).toHaveCount(4);

  // Nieuwste eerst (FR-028).
  await expect(rows.nth(0)).toContainText('Verwijderd');
  await expect(rows.nth(1)).toContainText('Wachtwoord gereset');
  await expect(rows.nth(2)).toContainText('Gewijzigd');
  await expect(rows.nth(3)).toContainText('Aangemaakt');

  // Geen wachtwoorden in het logboek.
  const text = await page.getByRole('main').innerText();
  expect(text).not.toContain(TEST_PASSWORD);
  expect(text).not.toContain(NEW_PASSWORD);
});
