import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker, BASE, TEST_PASSWORD } from '../../helpers/org-api.js';
import { videoFixture, loginViaScreen } from '../../helpers/video-upload.js';

// Scenario 21 t/m 25: verwijderen en afscherming tussen organisaties. Scenario 22 en 23 hebben twee eigen organisaties nodig.
// Tests met test.fixme worden overgeslagen en zijn nog niet geschreven. Haal ".fixme" weg zodra je
// ze invult. Bron: docs/e2e-plan-spec-002.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test.fixme('scenario 21: een video verwijderen en annuleren', async ({ page, browser }) => {
  // A+H. Eerste verwijderen en bevestigen: weg uit de bibliotheek. Tweede annuleren: blijft staan.
  // Handmatig of backend: bestand en miniatuur nog op schijf, deletedAt gevuld.
});

test.fixme('scenario 22: organisatie B ziet de videos van A niet', async ({ page, browser }) => {
  // A. Twee eigen organisaties (t.organisation). A heeft een video, B opent /videos en ziet een lege lijst.
});

test.fixme('scenario 23: B kan de miniatuur van A niet openen', async ({ page, browser }) => {
  // A. request.get als B op de thumbnailUrl van A en op /internal/videos/thumbnails/...; beide 404.
  // Open punt in het plan: dit scenario mag volgens jou vervallen.
});

test.fixme('scenario 24: A kan de eigen miniatuur wel openen', async ({ page, browser }) => {
  // A, beperkt. De afbeelding komt binnen (200, afbeelding). De X-Accel-Redirect-header is via nginx niet zichtbaar.
});

test.fixme('scenario 25: /media/videos en /media/thumbnails bestaan niet', async ({ page, browser }) => {
  // A. Twee request.get-aanroepen op https://localhost/media/videos/... en /media/thumbnails/...; beide 404.
});
