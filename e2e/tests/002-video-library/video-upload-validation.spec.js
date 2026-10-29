import { test, expect } from '@playwright/test';
import { uniqueName } from '../../helpers/admin.js';
import { createTracker, BASE, TEST_PASSWORD } from '../../helpers/org-api.js';
import { videoFixture, loginViaScreen } from '../../helpers/video-upload.js';

// Scenario 3 t/m 9: bestanden die de bibliotheek moet weigeren of accepteren. Elke test: eigen organisatie, eigen browsercontext, inloggen via het scherm.
// Tests met test.fixme worden overgeslagen en zijn nog niet geschreven. Haal ".fixme" weg zodra je
// ze invult. Bron: docs/e2e-plan-spec-002.md.

const t = createTracker();
test.afterEach(() => t.cleanup());

test.fixme('scenario 3: clip.mov wordt geweigerd', async ({ page, browser }) => {
  // A. videoFixture('clip.mov') kiezen. Melding in rood, "Uploaden" uit.
  // Controleer met page.on('request', ...) dat er niets is verstuurd.
});

test.fixme('scenario 4: een H.265-video wordt geweigerd', async ({ page, browser }) => {
  // A. videoFixture('h265-512x256.mp4'). Melding over H.264, "Uploaden" uit, niets verstuurd.
});

test.fixme('scenario 5: een MOV met .mp4-naam wordt geweigerd', async ({ page, browser }) => {
  // A. videoFixture('quicktime-512x256.mp4'). Dezelfde melding als scenario 3.
});

test.fixme('scenario 6: geen 360-graden-video: beide bestanden worden geweigerd', async ({ page, browser }) => {
  // A. not-360-640x360.mp4 en square-1024x1024.mp4 tegelijk. Beide in rood, "Uploaden" uit.
  // Na "Uit de lijst halen" van beide is er niets meer te uploaden.
});

test.fixme('scenario 7: te hoge resolutie wordt geweigerd, de maximale resolutie niet', async ({ page, browser }) => {
  // A. too-large-6144x3072.mp4: melding, "Uploaden" uit.
  // Daarna valid-max-5760x2880.mp4: geen fout, upload wordt geaccepteerd.
});

test.fixme('scenario 8: Opus-audio en een stille video worden geaccepteerd', async ({ page, browser }) => {
  // A. valid-opus-audio-512x256.mp4 en valid-silent-1024x512.mp4 tegelijk. Beide zonder fout, na "Uploaden" beide in de bibliotheek.
});

test.fixme('scenario 9: alleen-audio en een corrupt bestand worden niet toegevoegd', async ({ page, browser }) => {
  // A. audio-only.mp4: melding in het venster.
  // corrupt.mp4: geen fout in het venster; na de upload "Video niet toegevoegd" en niets in de bibliotheek.
});
