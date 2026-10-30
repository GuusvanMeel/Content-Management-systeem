import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker, BASE, TEST_PASSWORD } from '../../helpers/org-api.js';
import { videoFixture, loginViaScreen, holdUploads } from '../../helpers/video-upload.js';

// Scenario 1, 2, 15, 16 t/m 19: uploaden, voortgang en het knopje rechtsonder. Eigen organisatie per test.
// Tests met test.fixme worden overgeslagen en zijn nog niet geschreven. Haal ".fixme" weg zodra je
// ze invult. Bron: docs/e2e-plan-spec-002.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('scenario 1: een lege bibliotheek toont de lege-tekst en 2 knoppen "Video toevoegen"', async ({ browser }) => {
  // A. Eigen, lege organisatie. /videos openen.
  const org = await t.organisation({ name: uniqueName('E2E-SC1') });
  const page = await (await t.browserContext(browser)).newPage();
  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);

  await page.goto('/videos');

  const buttons = page.getByRole('main').getByRole('button', { name: 'Video toevoegen' });

  await expect(page.getByText("Er staan nog geen video's in de bibliotheek")).toBeVisible();
  await expect(buttons).toHaveCount(2);

});

test('scenario 2: een geldige video wordt geupload en staat in de bibliotheek', async ({ browser }) => {
  // A. videoFixture('valid-512x256.mp4') kiezen en uploaden.
  const org = await t.organisation({ name: uniqueName('E2E-SC2') });
  const page = await (await t.browserContext(browser)).newPage();

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);

  await page.goto('/videos');

  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByRole('main').getByRole('button', { name: 'Video toevoegen' }).first().click(),
  ]);
  await chooser.setFiles(videoFixture('valid-512x256.mp4'));
  await page.getByRole('button', { name: 'Uploaden' }).click();


  await expect(page.getByRole('main').getByText('valid-512x256')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('00:00:02')).toBeVisible();
  await expect(page.getByText('Geüpload op')).toBeVisible();
  await expect(page.getByText('Eigen', { exact: true })).toBeVisible();

  // "Toegevoegd aan de bibliotheek"; daarna naam, duur, grootte, datum en miniatuur in de lijst.
});

test('scenario 15: drie bestanden tegelijk: eén bezig, twee wachten', async ({ browser }) => {
  // A. Drie bestanden kiezen. Eén bezig, twee "Wacht...".
  const org = await t.organisation({ name: uniqueName('E2E-SC15') });
  const page = await (await t.browserContext(browser)).newPage();

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);

  await page.goto('/videos');

  const release = await holdUploads(page);


  await page.locator('[data-test="file-input"]').setInputFiles([
    videoFixture('valid-512x256.mp4'),
    videoFixture('valid-max-5760x2880.mp4'),
    videoFixture('valid-opus-audio-512x256.mp4'),
  ]);
  await page.getByRole('button', { name: 'Uploaden' }).click();

  // Eén bezig, twee wachtend.
  const toggle = page.getByRole('region', { name: 'Uploads' }).getByRole('button', { name: /Uploads tonen/ });
  await expect(toggle).toHaveAccessibleName('Uploads tonen (Uploaden: 1 bezig, 2 wachtend)');

  await toggle.click();   // paneel uitklappen
  const panel = page.locator('[data-test="panel"]');
  await expect(panel.getByText('Wacht…')).toHaveCount(2);

  // Laat de uploads los: ze starten na elkaar en komen alle drie in de bibliotheek.
  release();
  await expect(page.getByRole('main').getByText('valid-512x256', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('main').getByText('valid-opus-audio-512x256', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('main').getByText('valid-max-5760x2880', { exact: true })).toBeVisible({ timeout: 30_000 });
});

test('scenario 16: het knopje rechtsonder staat op "Videos" ook zonder uploads', async ({ browser }) => {
  // A. Op /videos aanwezig, klik opent de bestandskiezer. Op /settings/style niet.
  const org = await t.organisation({ name: uniqueName('E2E-SC16') });
  const page = await (await t.browserContext(browser)).newPage();

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);
  await page.goto('/videos');

  const circle = page.locator('[data-test="circle"]');
  await expect(circle).toBeVisible();

  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), circle.click()]);
  expect(chooser).toBeTruthy();
  await page.getByRole('link', { name: 'Huisstijl' }).click();
  await expect(circle).toHaveCount(0);

});

test('scenario 16b: het knopje tijdens een upload (gedrag)', async ({ browser }) => {
  // A+H. Ingeklapt blijven; 
  const org = await t.organisation({ name: uniqueName('E2E-SC16-B') });
  const page = await (await t.browserContext(browser)).newPage();

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);

  await page.goto('/videos');
  const release = await holdUploads(page);

  await page.locator('[data-test="file-input"]').setInputFiles([videoFixture('valid-512x256.mp4')]);
  await page.getByRole('button', { name: 'Uploaden' }).click();

  await expect(page.locator('[data-test="circle"]')).toHaveAccessibleName(/1 bezig, 0 wachtend/);

  await expect(page.locator('[data-test="panel"]')).toBeHidden();


  release();

});

test('scenario 16c: de lijst klapt vanzelf uit en weer in', async ({ browser }) => {
  // A+H. Bij "Toegevoegd" en bij "Verbinding verbroken..." klapt de lijst uit en na ongeveer 4 s weer in.
  const org = await t.organisation({ name: uniqueName('E2E-SC16-C') });
  const page = await (await t.browserContext(browser)).newPage();
  const panel = page.locator('[data-test="panel"]');

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);

  await page.goto('/videos');
  const release = await holdUploads(page);

  await page.locator('[data-test="file-input"]').setInputFiles([videoFixture('valid-512x256.mp4')]);
  await page.getByRole('button', { name: 'Uploaden' }).click();
  await expect(page.locator('[data-test="circle"]')).toHaveAccessibleName(/1 bezig, 0 wachtend/);

  await expect(panel).toBeHidden();


  release();
  await expect(panel).toBeVisible({ timeout: 30_000 });
  await expect(panel).toContainText('Toegevoegd aan de bibliotheek');
  await expect(panel).toBeHidden({ timeout: 10_000 });
  //deel 2, een upload aborten door slechte verbinding.
  await page.route('**/api/organisation/video-uploads**', (route) => route.abort());

  await page.locator('[data-test="file-input"]').setInputFiles([videoFixture('valid-512x256.mp4')]);
  await page.getByRole('button', { name: 'Uploaden', exact: true }).click();

  await expect(panel).toBeVisible({ timeout: 30_000 });
  await expect(panel).toContainText('Verbinding verbroken');
  await expect(panel).toBeHidden({ timeout: 10_000 });
});

test('scenario 16d: het knopje op "Huisstijl" tijdens een upload', async ({ browser }) => {
  // A. Upload loopt door; het knopje klapt niet vanzelf uit; klik opent de lijst en die blijft open tot je opnieuw klikt.
  const org = await t.organisation({ name: uniqueName('E2E-SC16-D') });
  const page = await (await t.browserContext(browser)).newPage();

  const circle = page.locator('[data-test="circle"]');
  const panel = page.locator('[data-test="panel"]');


  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);

  await page.goto('/videos');
  const release = await holdUploads(page);

  await page.locator('[data-test="file-input"]').setInputFiles([videoFixture('valid-512x256.mp4')]);
  await page.getByRole('button', { name: 'Uploaden' }).click();

  await page.getByRole('link', { name: 'Huisstijl' }).click();
  await expect(circle).toHaveAccessibleName(/1 bezig, 0 wachtend/);
  await expect(panel).toBeHidden();

  // klik opent de lijst
  await circle.click();
  await expect(panel).toBeVisible();
  await expect(panel).toContainText('valid-512x256');

  // upload afronden: de lijst blijft open
  release();
  await expect(panel).toContainText('Toegevoegd aan de bibliotheek', { timeout: 30_000 });
  await page.waitForTimeout(5_000); // langer dan AUTO_COLLAPSE_MS (4 s)
  await expect(panel).toBeVisible();

  // opnieuw klikken sluit hem
  await circle.click();
  await expect(panel).toBeHidden();

});

test('scenario 17: het tabblad sluiten tijdens een upload geeft een waarschuwing', async ({ browser }) => {
  // A. page.on('dialog', ...) en page.close({ runBeforeUnload: true }).
  const org = await t.organisation({ name: uniqueName('E2E-SC17') });
  const page = await (await t.browserContext(browser)).newPage();

  const circle = page.locator('[data-test="circle"]');


  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);

  await page.goto('/videos');
  const release = await holdUploads(page);

  await page.locator('[data-test="file-input"]').setInputFiles([videoFixture('valid-512x256.mp4')]);
  await page.getByRole('button', { name: 'Uploaden' }).click();

  let dialogType;
page.on('dialog', async (dialog) => {
  dialogType = dialog.type();
  await dialog.dismiss(); // "Blijven" kiezen
});

await page.close({ runBeforeUnload: true });

await expect.poll(() => dialogType).toBe('beforeunload');
expect(page.isClosed()).toBe(false);          // tabblad is niet dicht gegaan
await expect(circle).toHaveAccessibleName(/1 bezig, 0 wachtend/); // upload loopt door
release();
});

test('scenario 18: uitloggen tijdens een upload vraagt bevestiging', async ({  browser }) => {
  //  Bevestigingsvraag; na "Uitloggen" is de upload onderbroken en later hervatbaar (halve-upload-helper).
   const org = await t.organisation({ name: uniqueName('E2E-SC18') });
  const page = await (await t.browserContext(browser)).newPage();
  const circle = page.locator('[data-test="circle"]');
  const dialog = page.getByRole('alertdialog');

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);

  await page.goto('/videos');
  await holdUploads(page);

  await page.locator('[data-test="file-input"]').setInputFiles([videoFixture('valid-512x256.mp4')]);
  await page.getByRole('button', { name: 'Uploaden' }).click();
  await expect(circle).toHaveAccessibleName(/1 bezig, 0 wachtend/);

  // eerst annuleren: je blijft ingelogd en de upload loopt door
  await page.getByRole('button', { name: 'Uitloggen' }).click();
  await expect(dialog).toContainText('Er loopt nog een upload');
  await dialog.getByRole('button', { name: 'Annuleren' }).click();
  await expect(dialog).toBeHidden();
  await expect(circle).toHaveAccessibleName(/1 bezig, 0 wachtend/);

  // dan bevestigen: upload onderbroken, uitgelogd
  await page.getByRole('button', { name: 'Uitloggen' }).click();
  await dialog.getByRole('button', { name: 'Uitloggen' }).click();
  await expect(page.getByRole('button', { name: 'Inloggen' })).toBeVisible();
  await expect(circle).toHaveCount(0);
});



test('scenario 19: een lopende upload annuleren', async ({  browser }) => {
  // A+H. Automatiseren: de regel verdwijnt uit het scherm.
     const org = await t.organisation({ name: uniqueName('E2E-SC19') });
  const page = await (await t.browserContext(browser)).newPage();
  const circle = page.locator('[data-test="circle"]');

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);

  await page.goto('/videos');
  await holdUploads(page);

  await page.locator('[data-test="file-input"]').setInputFiles([videoFixture('valid-512x256.mp4')]);
  await page.getByRole('button', { name: 'Uploaden' }).click();
  await expect(circle).toHaveAccessibleName(/1 bezig, 0 wachtend/);

  await circle.click();

    await page.getByRole('button', { name: 'Annuleren' }).click();

await expect(circle).toHaveAccessibleName('Video toevoegen');     // geen uploads meer
  await expect(page.locator('[data-test="panel"]')).toBeHidden();  



});
