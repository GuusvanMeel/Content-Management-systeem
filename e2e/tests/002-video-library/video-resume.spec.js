import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker, TEST_PASSWORD } from '../../helpers/org-api.js';
import { videoFixture, loginViaScreen, holdUploads, startHalfUpload } from '../../helpers/video-upload.js';

// Scenario 12, 13, 14, 29, 30, 31: onderbroken en hervatte uploads. Ze gebruiken startHalfUpload (helpers/video-upload.js):
// de upload strandt na het eerste stuk van 8 kB, zodat de server een deel van het bestand heeft.
// Bron: docs/e2e-plan-spec-002.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('scenario 12: verbinding valt weg tijdens een upload en komt terug', async ({ browser }) => {
  // A. Halve-upload-helper. De verbinding "valt weg" doordat de helper verzoeken afbreekt, en komt terug met resume().
  // "Verbinding verbroken, opnieuw proberen...", daarna verder en klaar.
  const org = await t.organisation({ name: uniqueName('E2E-SC12') });
  const page = await (await t.browserContext(browser)).newPage();
  const panel = page.locator('[data-test="panel"]');

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);
  const half = await startHalfUpload(page);

  await expect(panel).toContainText('Verbinding verbroken');

  half.resume();
  await expect(page.getByRole('main').getByText('valid-512x256', { exact: true })).toBeVisible({ timeout: 30_000 });
});

test('scenario 13: browser sluiten en hervatten', async ({ browser }) => {
  // A. Upload afbreken met de helper; nieuwe pagina in dezelfde context.
  // "Hervat"; eerste verzoek is HEAD; begint niet bij 0%.
  const org = await t.organisation({ name: uniqueName('E2E-SC13') });
  const context = await t.browserContext(browser);
  const page = await context.newPage();

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);
  await startHalfUpload(page);
  await page.close();   // "browser sluiten": de context houdt de opgeslagen upload (localStorage) vast

  const page2 = await context.newPage();
  const panel = page2.locator('[data-test="panel"]');
  const methods = [];
  page2.on('request', (request) => {
    if (request.url().includes('video-uploads')) methods.push(request.method());
  });
  await page2.goto('/videos');
  const release = await holdUploads(page2);
  const head = page2.waitForResponse((r) => r.request().method() === 'HEAD' && r.url().includes('video-uploads'));

  await page2.locator('[data-test="file-input"]').setInputFiles([videoFixture('valid-512x256.mp4')]);
  await page2.getByRole('dialog').getByRole('button', { name: 'Uploaden' }).click();
  await page2.locator('[data-test="circle"]').click();
  await expect(panel).toContainText('Hervat');

  release();
  const offset = (await head).headers()['upload-offset'];
  expect(Number(offset)).toBeGreaterThan(0);   // de server had al een deel: niet vanaf 0
  expect(methods[0]).toBe('HEAD');
  await expect(page2.getByRole('main').getByText('valid-512x256', { exact: true })).toBeVisible({ timeout: 30_000 });
});

test('scenario 14: een andere browser begint bij 0%', async ({ browser }) => {
  // A. Tweede browsercontext (t.browserContext) met dezelfde organisatie; hetzelfde bestand begint bij 0%.
  const org = await t.organisation({ name: uniqueName('E2E-SC14') });
  const page = await (await t.browserContext(browser)).newPage();
  const page2 = await (await t.browserContext(browser)).newPage();
  const panel = page2.locator('[data-test="panel"]');

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);
  await startHalfUpload(page);

  await loginViaScreen(page2, org.loginCode, TEST_PASSWORD);
  const methods = [];
  page2.on('request', (request) => {
    if (request.url().includes('video-uploads')) methods.push(request.method());
  });
  await page2.goto('/videos');
  await holdUploads(page2);

  await expect(page2.locator('[data-test="resume-notice"]')).toHaveCount(0);
  await page2.locator('[data-test="file-input"]').setInputFiles([videoFixture('valid-512x256.mp4')]);
  await page2.getByRole('dialog').getByRole('button', { name: 'Uploaden' }).click();
  await page2.locator('[data-test="circle"]').click();

  await expect(panel).toContainText('0%');
  await expect(panel).not.toContainText('Hervat');
  await expect.poll(() => methods[0]).toBe('POST');   // een nieuwe upload begint met aanmaken, niet met HEAD
});

test('scenario 29: een onderbroken upload meldt zich bovenaan', async ({ browser }) => {
  // A. Helper breekt af bij ongeveer 40%. "Je bent eerder begonnen met uploaden van <naam>, 40% klaar...".
  // In een andere browsercontext staat de melding niet.
  const org = await t.organisation({ name: uniqueName('E2E-SC29') });
  const context = await t.browserContext(browser);
  const page = await context.newPage();

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);
  const half = await startHalfUpload(page);
  await page.close();

  const page2 = await context.newPage();
  await page2.goto('/videos');
  await expect(page2.locator('[data-test="resume-notice"]')).toContainText(
    `Je bent eerder begonnen met uploaden van valid-512x256, ${half.percent}% klaar.`,
  );

  // Een andere browser (andere context, zelfde organisatie) ziet de melding niet.
  const other = await (await t.browserContext(browser)).newPage();
  await loginViaScreen(other, org.loginCode, TEST_PASSWORD);
  await other.goto('/videos');
  await expect(other.getByText("Er staan nog geen video's in de bibliotheek")).toBeVisible();
  await expect(other.locator('[data-test="resume-notice"]')).toHaveCount(0);
});

test('scenario 30: de melding verwijderen haalt de upload weg', async ({ browser }) => {
  // A. Op "Verwijderen" klikken: melding weg. Of de upload uit incoming/ is, blijft backend of handmatig.
  const org = await t.organisation({ name: uniqueName('E2E-SC30') });
  const context = await t.browserContext(browser);
  const page = await context.newPage();

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);
  await startHalfUpload(page);
  await page.close();

  const page2 = await context.newPage();
  const notice = page2.locator('[data-test="resume-notice"]');
  await page2.goto('/videos');
  await expect(notice).toBeVisible();

  await notice.getByRole('button', { name: 'Verwijderen' }).click();
  await expect(notice).toHaveCount(0);

  // Ook na opnieuw laden komt de melding niet terug.
  await page2.reload();
  await expect(page2.getByText("Er staan nog geen video's in de bibliotheek")).toBeVisible();
  await expect(notice).toHaveCount(0);
});

test('scenario 31: hetzelfde bestand opnieuw kiezen hervat de upload', async ({ browser }) => {
  // A. Na scenario 29 hetzelfde bestand kiezen: melding verdwijnt; upload hervat rond 40% met "Hervat".
  const org = await t.organisation({ name: uniqueName('E2E-SC31') });
  const context = await t.browserContext(browser);
  const page = await context.newPage();

  await loginViaScreen(page, org.loginCode, TEST_PASSWORD);
  await startHalfUpload(page);
  await page.close();

  const page2 = await context.newPage();
  const notice = page2.locator('[data-test="resume-notice"]');
  const panel = page2.locator('[data-test="panel"]');
  await page2.goto('/videos');
  await expect(notice).toBeVisible();
  const release = await holdUploads(page2);

  await page2.locator('[data-test="file-input"]').setInputFiles([videoFixture('valid-512x256.mp4')]);
  await page2.getByRole('dialog').getByRole('button', { name: 'Uploaden' }).click();

  await expect(notice).toHaveCount(0);
  await page2.locator('[data-test="circle"]').click();
  await expect(panel).toContainText('Hervat');

  release();
  await expect(page2.getByRole('main').getByText('valid-512x256', { exact: true })).toBeVisible({ timeout: 30_000 });
});
