// Hulpfuncties voor de tests van spec 001 die organisaties via de API klaarzetten en opruimen.
// Dit bestand is nieuw; helpers/admin.js is niet aangepast.
import { request as pwRequest } from '@playwright/test';

// Poort 80 stuurt in nginx door naar https (301). Een POST zou via zo'n redirect een GET worden,
// dus API-aanroepen in deze tests gaan rechtstreeks naar https.
export const BASE = 'https://localhost';
export const CSRF = { 'X-Requested-With': 'cms' }; // verplicht bij POST/PUT/PATCH/DELETE (contracts/api.md)
export const ADMIN_STATE = 'playwright/.auth/admin.json';

// Alleen voor tijdelijke testorganisaties; geen geheimen.
export const TEST_PASSWORD = 'E2e-testwachtwoord-1';
export const NEW_PASSWORD = 'E2e-nieuwwachtwoord-2';

/**
 * Houdt bij wat een test aanmaakt (organisaties, API-sessies, browsercontexten) en ruimt dat op.
 * Gebruik: const t = createTracker(); test.afterEach(() => t.cleanup());
 */
export function createTracker() {
  const orgIds = [];
  const orgNames = []; // organisaties die via het scherm zijn aangemaakt: alleen de naam is bekend
  const apis = [];
  const contexts = [];
  let adminApi = null;

  const tracker = {
    /** API-verbinding met de sessie van playwright-admin (uit admin.json). */
    async admin() {
      if (!adminApi) {
        adminApi = await pwRequest.newContext({
          baseURL: BASE,
          ignoreHTTPSErrors: true,
          extraHTTPHeaders: CSRF,
          storageState: ADMIN_STATE,
        });
        apis.push(adminApi);
      }
      return adminApi;
    },

    /** Maakt een organisatie aan via de admin-API en onthoudt het id voor het opruimen. */
    async organisation({ name, loginCode = name, password = TEST_PASSWORD }) {
      const api = await tracker.admin();
      const res = await api.post('/api/admin/organisations', { data: { name, loginCode, password } });
      if (res.status() !== 201) {
        throw new Error(`Organisatie aanmaken mislukt: ${res.status()} ${await res.text()}`);
      }
      const org = await res.json();
      orgIds.push(org.id);
      return org;
    },

    /** Onthoudt de naam van een organisatie die de test via het scherm aanmaakt; cleanup zoekt het id op en verwijdert hem. */
    trackName(name) {
      orgNames.push(name);
    },

    /** Losse API-verbinding, ingelogd als organisatie (eigen sessie, raakt org.json niet). */
    async login(loginCode, password = TEST_PASSWORD) {
      const api = await tracker.anonymousApi();
      const res = await api.post('/api/auth/organisation/login', { data: { loginCode, password } });
      if (res.status() !== 204) {
        throw new Error(`Inloggen als organisatie mislukt: ${res.status()} ${await res.text()}`);
      }
      return api;
    },

    /** API-verbinding zonder sessie. */
    async anonymousApi() {
      // Expliciet een lege sessie: zonder storageState erft deze verbinding de sessie uit org.json
      // (use.storageState van de config) en beëindigt een login hem (zie startSession in authRoutes.js).
      const api = await pwRequest.newContext({
        baseURL: BASE,
        ignoreHTTPSErrors: true,
        extraHTTPHeaders: CSRF,
        storageState: { cookies: [], origins: [] },
      });
      apis.push(api);
      return api;
    },

    /** Nieuwe, lege browsercontext (een tweede "browser"). browser.newContext() erft de config niet. */
    async browserContext(browser) {
      // Expliciet een lege sessie: zonder storageState erft de context de sessie uit org.json (config).
      const context = await browser.newContext({
        baseURL: BASE,
        ignoreHTTPSErrors: true,
        storageState: { cookies: [], origins: [] },
      });
      contexts.push(context);
      return context;
    },

    /** Verwijdert wat is aangemaakt. Een organisatie die de test al verwijderde (404) is niet erg. */
    async cleanup() {
      if (orgIds.length) {
        const api = await tracker.admin();
        for (const id of orgIds) await api.delete(`/api/admin/organisations/${id}`).catch(() => {});
      }
      if (orgNames.length) {
        const api = await tracker.admin();
        const res = await api.get('/api/admin/organisations');
        const list = res.ok() ? (await res.json()).organisations ?? [] : [];
        for (const name of orgNames) {
          for (const org of list.filter((o) => o.name === name)) {
            await api.delete(`/api/admin/organisations/${org.id}`).catch(() => {});
          }
        }
      }
      orgIds.length = 0;
      orgNames.length = 0;
      for (const context of contexts) await context.close().catch(() => {});
      for (const api of apis) await api.dispose().catch(() => {});
      contexts.length = 0;
      apis.length = 0;
      adminApi = null;
    },
  };
  return tracker;
}
