import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker, TEST_PASSWORD } from '../../helpers/org-api.js';

// Begint uitgelogd: anders stuurt /login een ingelogde organisatie meteen door naar "/".
test.use({ storageState: { cookies: [], origins: [] } });

const t = createTracker();
test.afterEach(() => t.cleanup());

// Dit bestand doet 10 mislukte inlogpogingen. Er is geen blokkade (FR-018), maar draai het liever
// los van de rest als je zelf ook net veel mislukte pogingen deed.
test('scenario 17: tien mislukte pogingen blokkeren een juiste poging niet', async ({ page }) => {
  const org = await t.organisation({ name: uniqueName('E2E-SC17') });
  const anon = await t.anonymousApi();

  for (let i = 1; i <= 10; i++) {
    const res = await anon.post('/api/auth/organisation/login', {
      data: { loginCode: org.loginCode, password: `Fout-wachtwoord-${i}` },
    });
    expect(res.status(), `mislukte poging ${i}`).toBe(401);
  }

  // Daarna een juiste poging via het scherm: die slaagt meteen.
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Organisatiecode' }).fill(org.loginCode);
  await page.getByRole('textbox', { name: 'Wachtwoord' }).fill(TEST_PASSWORD);
  await page.getByRole('button', { name: 'Inloggen' }).click();
  await expect(page.getByRole('navigation', { name: 'Hoofdmenu' })).toBeVisible();
});
