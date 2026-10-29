import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker, BASE, TEST_PASSWORD } from '../../helpers/org-api.js';
import { videoFixture, loginViaScreen, startHalfUpload } from '../../helpers/video-upload.js';

// Scenario 12, 13, 14, 29, 30, 31: onderbroken en hervatte uploads. Alles hangt af van de halve-upload-helper in helpers/video-upload.js.
// Tests met test.fixme worden overgeslagen en zijn nog niet geschreven. Haal ".fixme" weg zodra je
// ze invult. Bron: docs/e2e-plan-spec-002.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test.fixme('scenario 12: verbinding valt weg tijdens een upload en komt terug', async ({ page, browser }) => {
  // A. Halve-upload-helper. context.setOffline(true), en weer aan.
  // "Verbinding verbroken, opnieuw proberen...", daarna verder vanaf hetzelfde percentage.
});

test.fixme('scenario 13: browser sluiten en hervatten', async ({ page, browser }) => {
  // A. Upload afbreken met de helper; nieuwe pagina in dezelfde context.
  // "Hervat"; eerste verzoek is HEAD; begint niet bij 0%.
});

test.fixme('scenario 14: een andere browser begint bij 0%', async ({ page, browser }) => {
  // A. Tweede browsercontext (t.browserContext) met dezelfde organisatie; hetzelfde bestand begint bij 0%.
});

test.fixme('scenario 29: een onderbroken upload meldt zich bovenaan', async ({ page, browser }) => {
  // A. Helper breekt af bij ongeveer 40%. "Je bent eerder begonnen met uploaden van <naam>, 40% klaar...".
  // In een andere browsercontext staat de melding niet.
});

test.fixme('scenario 30: de melding verwijderen haalt de upload weg', async ({ page, browser }) => {
  // A. Op "Verwijderen" klikken: melding weg. Of de upload uit incoming/ is, blijft backend of handmatig.
});

test.fixme('scenario 31: hetzelfde bestand opnieuw kiezen hervat de upload', async ({ page, browser }) => {
  // A. Na scenario 29 hetzelfde bestand kiezen: melding verdwijnt; upload hervat rond 40% met "Hervat".
});
