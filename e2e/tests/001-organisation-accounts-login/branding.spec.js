import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker, BASE } from '../../helpers/org-api.js';

// Dit bestand gebruikt de standaardsessie uit de config (de organisatie van deze run, org.json)
// voor scenario 11. Scenario 10 en 12 maken hun eigen organisaties via de API.

const t = createTracker();
test.afterEach(() => t.cleanup());

test('scenario 10: de huisstijl van organisatie A raakt organisatie B niet', async () => {
  const a = await t.organisation({ name: uniqueName('E2E-SC10A') });
  const b = await t.organisation({ name: uniqueName('E2E-SC10B') });
  const apiA = await t.login(a.loginCode);
  const apiB = await t.login(b.loginCode);

  // A stelt een eigen primaire kleur in.
  const put = await apiA.put('/api/organisation/style', { data: { primaryColour: '#112233' } });
  expect(put.status()).toBe(200);

  // A ziet de eigen kleur, ook bij opnieuw ophalen.
  const styleA = await (await apiA.get('/api/organisation/style')).json();
  expect(styleA.primaryColour).toEqual({ value: '#112233', isDefault: false });

  // B ziet nog de standaardstijl.
  const styleB = await (await apiB.get('/api/organisation/style')).json();
  expect(styleB.primaryColour.isDefault).toBe(true);
  expect(styleB.primaryColour.value).not.toBe('#112233');
  expect(styleB.logo.isDefault).toBe(true);

  // Het uiterlijk van de kleuren zelf (hoe het eruitziet) blijft handmatig.
});

test('scenario 11: ongeldige logo\'s worden geweigerd en het vorige logo blijft', async ({ page }) => {
  await page.goto('/settings/style');
  const logoInput = page.locator('#logo-file'); // verborgen bestandsveld achter de knop "Uploaden"
  const before = await (await page.request.get(`${BASE}/api/organisation/style`)).json();

  // a) een tekstbestand met de naam nep.png: de server kijkt naar de inhoud, niet naar de naam.
  await logoInput.setInputFiles({
    name: 'nep.png',
    mimeType: 'image/png',
    buffer: Buffer.from('dit is geen afbeelding'),
  });
  await expect(page.getByRole('alert')).toContainText('PNG-, JPG- of SVG-afbeelding');

  // b) een bestand van 3 MB: de pagina weigert het al voor het wordt verstuurd.
  await logoInput.setInputFiles({
    name: 'groot.png',
    mimeType: 'image/png',
    buffer: Buffer.alloc(3 * 1024 * 1024),
  });
  await expect(page.getByRole('alert')).toContainText('maximaal 2 MB');

  // Het logo is niet veranderd.
  const after = await (await page.request.get(`${BASE}/api/organisation/style`)).json();
  expect(after.logo).toEqual(before.logo);
});

test('scenario 12: een geuploade logo wordt met veiligheidsheaders geserveerd', async () => {
  const org = await t.organisation({ name: uniqueName('E2E-SC12') });
  const api = await t.login(org.loginCode);

  // Een geldige PNG van 1 bij 1 pixel.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
  const upload = await api.put('/api/organisation/style/logo', {
    multipart: { logo: { name: 'logo.png', mimeType: 'image/png', buffer: png } },
  });
  expect(upload.status()).toBe(200);
  const { logo } = await upload.json();
  expect(logo.isDefault).toBe(false);

  // Het logo-URL direct opvragen: nginx serveert het met nosniff en een strikte CSP (research R7).
  const res = await api.get(logo.url);
  expect(res.status()).toBe(200);
  expect(res.headers()['x-content-type-options']).toBe('nosniff');
  expect(res.headers()['content-security-policy']).toContain("default-src 'none'");
});
