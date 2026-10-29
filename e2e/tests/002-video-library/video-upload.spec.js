import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker, BASE, TEST_PASSWORD } from '../../helpers/org-api.js';
import { videoFixture, loginViaScreen } from '../../helpers/video-upload.js';

// Scenario 1, 2, 15, 16 t/m 19: uploaden, voortgang en het knopje rechtsonder. Eigen organisatie per test.
// Tests met test.fixme worden overgeslagen en zijn nog niet geschreven. Haal ".fixme" weg zodra je
// ze invult. Bron: docs/e2e-plan-spec-002.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('scenario 1: een lege bibliotheek toont de lege-tekst en de knop "Video toevoegen"', async ({ browser }) => {
  // A. Eigen, lege organisatie. /videos openen.
  const org = await t.organisation({ name: uniqueName('E2E-SC1') });
  const page = await (await t.browserContext(browser)).newPage();
  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);

  await page.goto('/videos');

  await expect(page.getByText("Er staan nog geen video's in de bibliotheek")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Video toevoegen' }).first()).toBeVisible();

});

test.fixme('scenario 2: een geldige video wordt geupload en staat in de bibliotheek', async ({ page, browser }) => {
  // A. videoFixture('valid-512x256.mp4') kiezen en uploaden.
  // "Toegevoegd aan de bibliotheek"; daarna naam, duur, grootte, datum en miniatuur in de lijst.
});

test.fixme('scenario 15: drie bestanden tegelijk: eén bezig, twee wachten', async ({ page, browser }) => {
  // A. Drie bestanden kiezen. Eén bezig, twee "Wacht...".
  // Vertraag de uploads met page.route, anders zie je de wachtstatus niet.
});

test.fixme('scenario 16: het knopje rechtsonder staat op "Videos" ook zonder uploads', async ({ page, browser }) => {
  // A. Op /videos aanwezig, klik opent de bestandskiezer. Op /settings/style niet.
});

test.fixme('scenario 16b: het knopje tijdens een upload (gedrag)', async ({ page, browser }) => {
  // A+H. Ingeklapt blijven; met page.emulateMedia({ reducedMotion: 'reduce' }) geen animatie.
  // Handmatig: hoe de ring en animatie eruitzien.
});

test.fixme('scenario 16c: de lijst klapt vanzelf uit en weer in', async ({ page, browser }) => {
  // A+H. Bij "Toegevoegd" en bij "Verbinding verbroken..." klapt de lijst uit en na ongeveer 4 s weer in.
  // Handmatig: het uiterlijk.
});

test.fixme('scenario 16d: het knopje op "Huisstijl" tijdens een upload', async ({ page, browser }) => {
  // A. Upload loopt door; het knopje klapt niet vanzelf uit; klik opent de lijst en die blijft open tot je opnieuw klikt.
});

test.fixme('scenario 17: het tabblad sluiten tijdens een upload geeft een waarschuwing', async ({ page, browser }) => {
  // A. page.on('dialog', ...) en page.close({ runBeforeUnload: true }).
});

test.fixme('scenario 18: uitloggen tijdens een upload vraagt bevestiging', async ({ page, browser }) => {
  // A. Bevestigingsvraag; na "Uitloggen" is de upload onderbroken en later hervatbaar (halve-upload-helper).
});

test.fixme('scenario 19: een lopende upload annuleren', async ({ page, browser }) => {
  // A+H. Automatiseren: de regel verdwijnt uit het scherm.
  // Handmatig of backend: dat incoming/ leeg is.
});
