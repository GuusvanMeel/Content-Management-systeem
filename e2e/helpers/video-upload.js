// Hulpfuncties voor de tests van spec 002 (videobibliotheek). Nieuw bestand.
import path from 'node:path';
import { expect } from '@playwright/test';

/** Pad naar een testvideo uit backend/tests/fixtures/videos/. Het werkpad is e2e/ bij `npx playwright test`. */
export const videoFixture = (name) => path.resolve('../backend/tests/fixtures/videos', name);

/**
 * Inloggen via het scherm in een eigen pagina (zoals in organisation-manage.spec.js).
 * Wacht tot het hoofdmenu zichtbaar is, zodat de test pas doorgaat als je echt bent ingelogd.
 * Voor een mislukte login (foutmelding verwachten) is deze helper niet bedoeld.
 */
export async function loginViaScreen(page, loginCode, password) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Organisatiecode' }).fill(loginCode);
  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(password);
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page.getByRole('navigation', { name: 'Hoofdmenu' })).toBeVisible();
}

/**
 * TODO: start een upload en breek hem af tussen twee stukken (rond 40%), voor scenario 12, 13, 14, 29, 30 en 31.
 * Idee: genereer een bestand groter dan een stuk van 32 MB en laat page.route het tweede PATCH-verzoek afbreken
 * (route.abort()); of vertraag de upload. Zie "Helper: halve upload" in docs/e2e-plan-spec-002.md.
 */
export async function startHalfUpload(/* page, bestand */) {
  throw new Error('startHalfUpload is nog niet geschreven');
}
