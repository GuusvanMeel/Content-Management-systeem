import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker, BASE, TEST_PASSWORD } from '../../helpers/org-api.js';
import { videoFixture, loginViaScreen } from '../../helpers/video-upload.js';

// Scenario 21 t/m 25: verwijderen en afscherming tussen organisaties. Scenario 22 en 23 hebben twee eigen organisaties nodig.
// Bron: docs/e2e-plan-spec-002.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('scenario 21: een video verwijderen en annuleren', async ({ browser }) => {
  // A+H. Eerste verwijderen en bevestigen: weg uit de bibliotheek. Tweede annuleren: blijft staan.
  // Handmatig of backend: bestand en miniatuur nog op schijf, deletedAt gevuld.
  const org = await t.organisation({ name: uniqueName('E2E-SC21') });
  const page = await (await t.browserContext(browser)).newPage();
  const main = page.getByRole('main');
  const confirm = page.getByRole('alertdialog');
  const first = page.locator('[data-test="video"]').filter({ hasText: 'valid-512x256' });
  const second = page.locator('[data-test="video"]').filter({ hasText: 'valid-silent-1024x512' });

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);
  await page.goto('/videos');

  await page.locator('[data-test="file-input"]').setInputFiles([
    videoFixture('valid-512x256.mp4'),
    videoFixture('valid-silent-1024x512.mp4'),
  ]);
  await page.getByRole('dialog').getByRole('button', { name: 'Uploaden' }).click();
  await expect(main.getByText('valid-512x256', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(main.getByText('valid-silent-1024x512', { exact: true })).toBeVisible({ timeout: 30_000 });

  // Eerste verwijderen en bevestigen: weg uit de bibliotheek.
  await first.getByRole('button', { name: 'Verwijderen' }).click();
  await confirm.getByRole('button', { name: 'Verwijderen' }).click();
  await expect(first).toHaveCount(0);
  await expect(second).toHaveCount(1);

  // Tweede verwijderen maar annuleren: blijft staan.
  await second.getByRole('button', { name: 'Verwijderen' }).click();
  await confirm.getByRole('button', { name: 'Annuleren' }).click();
  await expect(confirm).toBeHidden();
  await expect(second).toHaveCount(1);
});

test('scenario 22: organisatie B ziet de videos van A niet', async ({ browser }) => {
  // A. Twee eigen organisaties (t.organisation). A heeft een video, B opent /videos en ziet een lege lijst.
  const orgA = await t.organisation({ name: uniqueName('E2E-SC22-A') });
  const orgB = await t.organisation({ name: uniqueName('E2E-SC22-B') });
  const pageA = await (await t.browserContext(browser)).newPage();
  const pageB = await (await t.browserContext(browser)).newPage();

  await loginViaScreen(pageA, orgA.loginCode, TEST_PASSWORD);
  await pageA.goto('/videos');
  await pageA.locator('[data-test="file-input"]').setInputFiles([videoFixture('valid-512x256.mp4')]);
  await pageA.getByRole('dialog').getByRole('button', { name: 'Uploaden' }).click();
  await expect(pageA.getByRole('main').getByText('valid-512x256', { exact: true })).toBeVisible({ timeout: 30_000 });

  await loginViaScreen(pageB, orgB.loginCode, TEST_PASSWORD);
  await pageB.goto('/videos');

  await expect(pageB.getByText("Er staan nog geen video's in de bibliotheek")).toBeVisible();
  await expect(pageB.locator('[data-test="video"]')).toHaveCount(0);
});

test('scenario 23: B kan de miniatuur van A niet openen', async ({ browser }) => {
  // A. request.get als B op de thumbnailUrl van A en op /internal/videos/thumbnails/...; beide 404.
  // Open punt in het plan: dit scenario mag volgens jou vervallen.
  const orgA = await t.organisation({ name: uniqueName('E2E-SC23-A') });
  const orgB = await t.organisation({ name: uniqueName('E2E-SC23-B') });
  const pageA = await (await t.browserContext(browser)).newPage();
  const apiB = await t.login(orgB.loginCode);

  await loginViaScreen(pageA, orgA.loginCode, TEST_PASSWORD);
  await pageA.goto('/videos');
  await pageA.locator('[data-test="file-input"]').setInputFiles([videoFixture('valid-512x256.mp4')]);
  await pageA.getByRole('dialog').getByRole('button', { name: 'Uploaden' }).click();
  const thumbnail = pageA.getByRole('main').getByRole('img', { name: 'valid-512x256' });
  await expect(thumbnail).toBeVisible({ timeout: 30_000 });
  const thumbnailUrl = await thumbnail.getAttribute('src');

  // Als B: de miniatuur van A via de API, en het interne nginx-pad.
  expect((await apiB.get(thumbnailUrl)).status()).toBe(404);
  expect((await apiB.get('/internal/videos/thumbnails/bestaat-niet.jpg')).status()).toBe(404);
});

test('scenario 24: A kan de eigen miniatuur wel openen', async ({ browser }) => {
  // A, beperkt. De afbeelding komt binnen (200, afbeelding). De X-Accel-Redirect-header is via nginx niet zichtbaar.
  const org = await t.organisation({ name: uniqueName('E2E-SC24') });
  const page = await (await t.browserContext(browser)).newPage();

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);
  await page.goto('/videos');
  await page.locator('[data-test="file-input"]').setInputFiles([videoFixture('valid-512x256.mp4')]);
  await page.getByRole('dialog').getByRole('button', { name: 'Uploaden' }).click();
  const thumbnail = page.getByRole('main').getByRole('img', { name: 'valid-512x256' });
  await expect(thumbnail).toBeVisible({ timeout: 30_000 });
  const thumbnailUrl = await thumbnail.getAttribute('src');

  const res = await page.request.get(thumbnailUrl);
  expect(res.status()).toBe(200);
  expect(res.headers()['content-type']).toContain('image/');
});

test('scenario 25: /media/videos en /media/thumbnails bestaan niet', async ({ request }) => {
  // A. Twee request.get-aanroepen op https://localhost/media/videos/... en /media/thumbnails/...; beide 404.
  expect((await request.get(`${BASE}/media/videos/bestaat-niet.mp4`)).status()).toBe(404);
  expect((await request.get(`${BASE}/media/thumbnails/bestaat-niet.jpg`)).status()).toBe(404);
});
