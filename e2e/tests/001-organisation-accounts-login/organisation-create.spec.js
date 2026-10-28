import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker } from '../../helpers/org-api.js';

test.use({ storageState: 'playwright/.auth/admin.json' });

const t = createTracker();
test.afterEach(() => t.cleanup());

test('scenario 2: de code wordt afgeleid van de naam', async ({ page }) => {
  const name = uniqueName('E2E-SC2');      // 1. naam bedenken, bijvoorbeeld "E2E-1761565000123"
  t.trackName(name);             // 2. onthouden, zodat afterEach hem kan verwijderen

  // 3. de organisatie aanmaken via de interface, met die naam
  await page.goto('/admin');
    await page.getByRole('link', { name: 'Nieuwe organisatie' }).click();

  await page.getByRole('textbox', { name: 'Naam' }).fill(name);

  await expect(page.getByRole('textbox', { name: 'Code' })).toHaveValue(name.toUpperCase());
});

test('Scenario 3: Nieuwe organisatie, wachtwoord is te kort', async ({ page }) => {

  const name = uniqueName('E2E-SC3');      // 1. naam bedenken, bijvoorbeeld "E2E-1761565000123"
  t.trackName(name);

  await page.goto('/admin');
    await page.getByRole('link', { name: 'Nieuwe organisatie' }).click();

  await page.getByRole('textbox', { name: 'Naam' }).fill(name);



  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill("123456789");

  await page.getByRole('button', { name: 'Aanmaken' }).click();
  await expect(page.getByText('Het wachtwoord moet minimaal')).toBeVisible();

  await page.goto('/admin/');
  await expect(page.getByText(name)).toHaveCount(0);
})

test('scenario 4: nieuwe organisatie staat in het overzicht en in het logboek', async ({ page }) => {
  const name = uniqueName('E2E-SC4');
  t.trackName(name);

  await page.goto('/admin');
  await page.getByRole('link', { name: 'Nieuwe organisatie' }).click();

  await page.getByRole('textbox', { name: 'Naam' }).fill(name);
  // Wacht tot de code is voorgesteld, voordat je opslaat.
  await expect(page.getByRole('textbox', { name: 'Organisatiecode' })).toHaveValue(name);

  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill('1234567890');
  await page.getByRole('button', { name: 'Aanmaken' }).click();

  // 1. Doorgestuurd naar het overzicht, met de nieuwe organisatie erin.
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText(name).first()).toBeVisible();

  // 2. Het logboek toont de actie.
  await page.getByRole('link', { name: 'Logboek' }).click();
  await expect(page.getByText(name).first()).toBeVisible();
});
test('scenario 5: dezelfde code een tweede keer wordt geweigerd', async ({ page }) => {
  const name = uniqueName('E2E-SC5');
  t.trackName(name); // de eerste organisatie wordt in afterEach opgeruimd

  // 1. Maak de eerste organisatie aan.
  await page.goto('/admin');
  await page.getByRole('link', { name: 'Nieuwe organisatie' }).click();
  await page.getByRole('textbox', { name: 'Naam' }).fill(name);
  await expect(page.getByRole('textbox', { name: 'Organisatiecode' })).toHaveValue(name);
  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill('1234567890');
  await page.getByRole('button', { name: 'Aanmaken' }).click();
  await expect(page).toHaveURL(/\/admin$/);

  // 2. Probeer een tweede organisatie met dezelfde code, nu in kleine letters.
  const secondName = `${name}-TWEE`;
  await page.getByRole('link', { name: 'Nieuwe organisatie' }).click();
  await page.getByRole('textbox', { name: 'Naam' }).fill(secondName);
  await expect(page.getByRole('textbox', { name: 'Organisatiecode' })).toHaveValue(secondName);
  await page.getByRole('textbox', { name: 'Organisatiecode' }).fill(name.toLowerCase());
  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill('1234567890');
  await page.getByRole('button', { name: 'Aanmaken' }).click();

  // 3. De melding verschijnt en je blijft op het formulier.
  await expect(page.getByText(/al in gebruik/i)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Nieuwe organisatie' })).toBeVisible();
});