import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker, TEST_PASSWORD } from '../../helpers/org-api.js';
import { videoFixture, loginViaScreen } from '../../helpers/video-upload.js';

// Scenario 3 t/m 9: bestanden die de bibliotheek moet weigeren of accepteren. Elke test: eigen organisatie, eigen browsercontext, inloggen via het scherm.
// Bron: docs/e2e-plan-spec-002.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('scenario 3: clip.mov wordt geweigerd', async ({ browser }) => {
  // A. videoFixture('clip.mov') kiezen. Melding in rood, "Uploaden" uit.
  // Controleer met page.on('request', ...) dat er niets is verstuurd.
  const org = await t.organisation({ name: uniqueName('E2E-SC3') });
  const page = await (await t.browserContext(browser)).newPage();
  const dialog = page.getByRole('dialog');

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);
  await page.goto('/videos');

  const sent = [];
  page.on('request', (request) => {
    if (request.url().includes('video-uploads')) sent.push(request.url());
  });

  await page.locator('[data-test="file-input"]').setInputFiles([videoFixture('clip.mov')]);

  await expect(dialog.getByRole('alert')).toContainText('Dit bestandstype kan niet worden gebruikt');
  await expect(dialog.getByRole('button', { name: 'Uploaden' })).toBeDisabled();
  expect(sent).toHaveLength(0);
});

test('scenario 4: een H.265-video wordt geweigerd', async ({ browser }) => {
  // A. videoFixture('h265-512x256.mp4'). Melding over H.264, "Uploaden" uit, niets verstuurd.
  const org = await t.organisation({ name: uniqueName('E2E-SC4') });
  const page = await (await t.browserContext(browser)).newPage();
  const dialog = page.getByRole('dialog');

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);
  await page.goto('/videos');

  const sent = [];
  page.on('request', (request) => {
    if (request.url().includes('video-uploads')) sent.push(request.url());
  });

  await page.locator('[data-test="file-input"]').setInputFiles([videoFixture('h265-512x256.mp4')]);

  await expect(dialog.getByRole('alert')).toContainText(/H\.264/);
  await expect(dialog.getByRole('button', { name: 'Uploaden' })).toBeDisabled();
  expect(sent).toHaveLength(0);
});

test('scenario 5: een MOV met .mp4-naam wordt geweigerd', async ({ browser }) => {
  // A. videoFixture('quicktime-512x256.mp4'). Dezelfde melding als scenario 3.
  const org = await t.organisation({ name: uniqueName('E2E-SC5') });
  const page = await (await t.browserContext(browser)).newPage();
  const dialog = page.getByRole('dialog');

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);
  await page.goto('/videos');

  await page.locator('[data-test="file-input"]').setInputFiles([videoFixture('quicktime-512x256.mp4')]);

  await expect(dialog.getByRole('alert')).toContainText('Dit bestandstype kan niet worden gebruikt');
  await expect(dialog.getByRole('button', { name: 'Uploaden' })).toBeDisabled();
});

test('scenario 6: geen 360-graden-video: beide bestanden worden geweigerd', async ({ browser }) => {
  // A. not-360-640x360.mp4 en square-1024x1024.mp4 tegelijk. Beide in rood, "Uploaden" uit.
  // Na "Uit de lijst halen" van beide is er niets meer te uploaden.
  const org = await t.organisation({ name: uniqueName('E2E-SC6') });
  const page = await (await t.browserContext(browser)).newPage();
  const dialog = page.getByRole('dialog');

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);
  await page.goto('/videos');

  await page.locator('[data-test="file-input"]').setInputFiles([
    videoFixture('not-360-640x360.mp4'),
    videoFixture('square-1024x1024.mp4'),
  ]);

  await expect(dialog.getByRole('alert')).toHaveCount(2);
  await expect(dialog.getByRole('alert').first()).toContainText('Dit is geen 360°-video');
  await expect(dialog.getByRole('alert').last()).toContainText('Dit is geen 360°-video');
  await expect(dialog.getByRole('button', { name: 'Uploaden' })).toBeDisabled();

  await dialog.getByRole('button', { name: 'not-360-640x360.mp4 uit de lijst halen' }).click();
  await expect(dialog.getByRole('alert')).toHaveCount(1);
  await expect(dialog.getByRole('button', { name: 'Uploaden' })).toBeDisabled();

  // De laatste regel weghalen sluit het venster: er is niets meer te uploaden.
  await dialog.getByRole('button', { name: 'square-1024x1024.mp4 uit de lijst halen' }).click();
  await expect(dialog).toBeHidden();
});

test('scenario 7: te hoge resolutie wordt geweigerd, de maximale resolutie niet', async ({ browser }) => {
  // A. too-large-6144x3072.mp4: melding, "Uploaden" uit.
  // Daarna valid-max-5760x2880.mp4: geen fout, upload wordt geaccepteerd.
  const org = await t.organisation({ name: uniqueName('E2E-SC7') });
  const page = await (await t.browserContext(browser)).newPage();
  const dialog = page.getByRole('dialog');
  const uploadButton = dialog.getByRole('button', { name: 'Uploaden' });

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);
  await page.goto('/videos');

  await page.locator('[data-test="file-input"]').setInputFiles([videoFixture('too-large-6144x3072.mp4')]);

  await expect(dialog.getByRole('alert')).toContainText('te hoog voor de VR-bril');
  await expect(uploadButton).toBeDisabled();

  // Venster sluiten en de video op de maximale resolutie kiezen.
  await dialog.getByRole('button', { name: 'Annuleren' }).click();
  await expect(dialog).toBeHidden();

  await page.locator('[data-test="file-input"]').setInputFiles([videoFixture('valid-max-5760x2880.mp4')]);

  await expect(uploadButton).toBeEnabled();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await uploadButton.click();

  await expect(page.getByRole('main').getByText('valid-max-5760x2880', { exact: true })).toBeVisible({ timeout: 30_000 });
});

test('scenario 8: Opus-audio en een stille video worden geaccepteerd', async ({ browser }) => {
  // A. valid-opus-audio-512x256.mp4 en valid-silent-1024x512.mp4 tegelijk. Beide zonder fout, na "Uploaden" beide in de bibliotheek.
  const org = await t.organisation({ name: uniqueName('E2E-SC8') });
  const page = await (await t.browserContext(browser)).newPage();
  const dialog = page.getByRole('dialog');
  const uploadButton = dialog.getByRole('button', { name: 'Uploaden' });

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);
  await page.goto('/videos');

  await page.locator('[data-test="file-input"]').setInputFiles([
    videoFixture('valid-opus-audio-512x256.mp4'),
    videoFixture('valid-silent-1024x512.mp4'),
  ]);

  // "Uploaden" gaat pas aan als beide bestanden gecontroleerd en goed zijn.
  await expect(uploadButton).toBeEnabled();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await uploadButton.click();

  await expect(page.getByRole('main').getByText('valid-opus-audio-512x256', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('main').getByText('valid-silent-1024x512', { exact: true })).toBeVisible({ timeout: 30_000 });
});

test('scenario 9: alleen-audio en een corrupt bestand worden niet toegevoegd', async ({ browser }) => {
  // A. audio-only.mp4: melding in het venster.
  // corrupt.mp4: geen fout in het venster; na de upload "Video niet toegevoegd" en niets in de bibliotheek.
  const org = await t.organisation({ name: uniqueName('E2E-SC9') });
  const page = await (await t.browserContext(browser)).newPage();
  const dialog = page.getByRole('dialog');
  const uploadButton = dialog.getByRole('button', { name: 'Uploaden' });

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);
  await page.goto('/videos');

  await page.locator('[data-test="file-input"]').setInputFiles([videoFixture('audio-only.mp4')]);

  await expect(dialog.getByRole('alert')).toContainText('kan niet als video worden geopend');
  await expect(uploadButton).toBeDisabled();

  await dialog.getByRole('button', { name: 'Annuleren' }).click();
  await expect(dialog).toBeHidden();

  // corrupt.mp4 kan de browser niet beoordelen: geen fout in het venster, de server weigert hem pas na de upload.
  await page.locator('[data-test="file-input"]').setInputFiles([videoFixture('corrupt.mp4')]);

  await expect(uploadButton).toBeEnabled();
  await expect(dialog.getByRole('alert')).toHaveCount(0);
  await uploadButton.click();

  const rejection = page.getByRole('dialog', { name: 'Video niet toegevoegd' });
  await expect(rejection).toBeVisible({ timeout: 30_000 });
  await expect(rejection).toContainText('kan niet als video worden geopend');
  await rejection.getByRole('button', { name: 'OK' }).click();

  await expect(page.getByText("Er staan nog geen video's in de bibliotheek")).toBeVisible();
});
