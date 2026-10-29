# E2E-plan spec 002: 360°-videobibliotheek

Bron: `specs/002-video-library/quickstart.md`. Dit document zegt per scenario of het met Playwright wordt geautomatiseerd, hoe, en in welk bestand. Opgebouwd zoals het plan voor spec 001 (`e2e-plan-spec-001.md`), met wat daarbij is geleerd.

## Legenda

| Label | Betekenis |
|---|---|
| **A** | Automatiseren met Playwright |
| **A+H** | Een deel automatiseren, het uiterlijk of een deel op de server blijft handmatig |
| **H** | Handmatig laten (omgevingsvariabele wijzigen, uren wachten, grote bestanden, gevoel) |
| **B** | Al gedekt door de backendtests; niet nog eens in Playwright |

## Uitgangspunten

- Mapnaam: `e2e/tests/002-video-library/`.
- **Eigen organisatie per test** via `createTracker()` (`helpers/org-api.js`) zodra de test video's schrijft of de lijst telt. Tests draaien parallel; in een gedeelde organisatie zien ze elkaars video's. Gedeelde run-organisatie (`org.json`) alleen voor tests die niets wegschrijven.
- Een test die inlogt in een eigen organisatie, doet dat met `t.login(...)` (API) of in een eigen `t.browserContext(browser)` (scherm).
- Elke zelf gemaakte context of verbinding krijgt expliciet een `storageState`; zonder erft hij de sessie uit `org.json` en beëindigt een login die.
- Testbestanden: `../backend/tests/fixtures/videos/...` (vanaf `e2e/`). Dat werkt ook in CI, omdat de repo daar is uitgecheckt.
- Namen van organisaties: `uniqueName('E2E-...')`. De tracker ruimt na afloop op.
- Grote bestanden (GB's) horen niet in Playwright. Grenzen worden aan de backendtests of aan de handmatige controle overgelaten.
- Videoafspelen valt buiten Playwright: de Chromium van Playwright speelt geen H.264 of AAC af. Controleer dat het beeld of het element er is, niet dat het speelt.

## Scenario's

| # | Wat | Label | Aanpak in Playwright | Bestand |
|---|---|---|---|---|
| 1 | Lege bibliotheek | A | Eigen, lege organisatie; lege-bibliotheektekst en knop "Video toevoegen" | `video-upload.spec.js` |
| 2 | Geldige video uploaden | A | `valid-512x256.mp4` kiezen en uploaden; "Toegevoegd aan de bibliotheek", daarna naam, duur, grootte, datum en miniatuur in de lijst | `video-upload.spec.js` |
| 3 | `clip.mov` wordt geweigerd | A | Foutmelding in rood, "Uploaden" uit; met `page.on('request')` controleren dat niets is verstuurd | `video-upload-validation.spec.js` |
| 4 | H.265-video wordt geweigerd | A | Zelfde aanpak, andere melding | `video-upload-validation.spec.js` |
| 5 | MOV met `.mp4`-naam wordt geweigerd | A | Zelfde aanpak | `video-upload-validation.spec.js` |
| 6 | Geen 360° (twee bestanden tegelijk) | A | Beide met melding; "Uit de lijst halen" van beide; niets meer te uploaden | `video-upload-validation.spec.js` |
| 7 | Te hoge resolutie, daarna maximale resolutie | A | Eerste geweigerd; tweede geaccepteerd en geüpload | `video-upload-validation.spec.js` |
| 8 | Opus-audio en stille video | A | Beide zonder fout; beide in de bibliotheek | `video-upload-validation.spec.js` |
| 9 | Alleen audio; corrupt bestand | A | `audio-only.mp4`: melding in het venster; `corrupt.mp4`: na upload "Video niet toegevoegd" en niets in de lijst | `video-upload-validation.spec.js` |
| 10 | Maximale bestandsgrootte (`VIDEO_MAX_SIZE_GB`) | H | Omgevingsvariabele wijzigen en API herstarten kan Playwright niet. Controleer eerst of de backendtests dit al dekken (dan B) | n.v.t. |
| 10b | Maximale resolutie (`VIDEO_MAX_WIDTH` en `_HEIGHT`) | H | Zelfde als 10 | n.v.t. |
| 11 | Te weinig vrije opslagruimte | H | Zelfde als 10; mogelijk al B | n.v.t. |
| 12 | Verbinding valt weg tijdens upload | A | Halve-upload-helper (zie hieronder); `context.setOffline(true)` en weer aan; "Verbinding verbroken, opnieuw proberen…", daarna verder | `video-resume.spec.js` |
| 13 | Browser sluiten en hervatten | A | Upload afbreken met de helper; nieuwe pagina in dezelfde context; "Hervat", eerste verzoek is `HEAD`, begint niet bij 0% | `video-resume.spec.js` |
| 14 | Andere browser begint bij 0% | A | Tweede browsercontext met dezelfde organisatie; nieuw bestand begint bij 0% | `video-resume.spec.js` |
| 15 | Drie bestanden tegelijk | A | Eén bezig, twee "Wacht…". Uploads vertragen met `page.route`, anders zie je de wachtstatus niet | `video-upload.spec.js` |
| 16 | Knopje rechtsonder zonder uploads | A | Op "Video's" aanwezig, opent de bestandskiezer; op "Huisstijl" niet | `video-upload.spec.js` |
| 16b | Knopje tijdens upload | A+H | Automatiseren: ingeklapt blijven, geen animatie met `page.emulateMedia({ reducedMotion: 'reduce' })`. Handmatig: hoe de ring en animatie eruitzien | `video-upload.spec.js` |
| 16c | Lijst klapt vanzelf uit en in | A+H | Automatiseren: lijst klapt uit bij "Toegevoegd" en bij "Verbinding verbroken…", daarna weer in (`expect` met timeout rond 4 s). Handmatig: het uiterlijk | `video-upload.spec.js` |
| 16d | Knopje op "Huisstijl" tijdens upload | A | Upload loopt door; knopje klapt niet vanzelf uit; klik opent de lijst en die blijft open | `video-upload.spec.js` |
| 17 | Tabblad sluiten tijdens upload | A | `page.on('dialog')` met `page.close({ runBeforeUnload: true })`; waarschuwing verschijnt | `video-upload.spec.js` |
| 18 | Uitloggen tijdens upload | A | Bevestigingsvraag; na "Uitloggen" onderbroken; daarna hervatbaar (helper) | `video-upload.spec.js` |
| 19 | Upload annuleren | A+H | Automatiseren: regel verdwijnt uit het scherm. Handmatig of backend: dat `incoming/` leeg is | `video-upload.spec.js` |
| 20 | Upload van meer dan 60 minuten | H | Duurt een uur; sessie-time-out is al backend (spec 001) | n.v.t. |
| 21 | Video verwijderen | A+H | Automatiseren: eerste weg uit de bibliotheek, tweede blijft bij annuleren. Handmatig of backend: bestand en miniatuur nog op schijf, `deletedAt` gevuld | `video-delete-isolation.spec.js` |
| 22 | B ziet de video's van A niet | A | Twee eigen organisaties; A uploadt (of de test zet een video klaar), B ziet een lege lijst | `video-delete-isolation.spec.js` |
| 23 | B kan de miniatuur van A niet openen | A | `request.get` als B op de `thumbnailUrl` van A en op `/internal/videos/thumbnails/...`; beide 404. Zie open punten | `video-delete-isolation.spec.js` |
| 24 | A kan de eigen miniatuur openen | A | Beperkt tot: de afbeelding komt binnen (200, afbeelding). De `X-Accel-Redirect`-header is via nginx niet zichtbaar | `video-delete-isolation.spec.js` |
| 25 | `/media/videos/...` en `/media/thumbnails/...` bestaan niet | A | Twee `request.get`-aanroepen; beide 404 | `video-delete-isolation.spec.js` |
| 26 | Verlopen upload wordt opgeruimd (`UPLOAD_EXPIRY_HOURS`) | H | Een uur wachten en variabele wijzigen; mogelijk al B (opruimfunctie direct aanroepen) | n.v.t. |
| 27 | 5 tot 10 GB: afronden binnen 60 seconden | H | Grote video en een stopwatch; niet voor CI | n.v.t. |
| 28 | 200 video's in 2 seconden zichtbaar | B | Staat in `videoLibrary.test.js` | n.v.t. |
| 29 | Onderbroken upload meldt zich bovenaan | A | Helper breekt af bij ±40%; "Je bent eerder begonnen met uploaden van <naam>, 40% klaar…"; in een andere browsercontext niet | `video-resume.spec.js` |
| 30 | "Verwijderen" bij die melding | A | Melding weg. Of de upload uit `incoming/` is, blijft backend of handmatig | `video-resume.spec.js` |
| 31 | Hetzelfde bestand opnieuw kiezen | A | Melding verdwijnt; upload hervat rond 40% met "Hervat" | `video-resume.spec.js` |

## Samenvatting

| Label | Aantal |
|---|---|
| A (automatiseren) | 24 (1 t/m 9, 12 t/m 15, 16, 16d, 17, 18, 22 t/m 25, 29 t/m 31) |
| A+H | 4 (16b, 16c, 19, 21) |
| H | 6 (10, 10b, 11, 20, 26, 27) |
| B | 1 (28) |

## Helper: halve upload

Scenario's 12, 13, 14, 29, 30 en 31 hebben een onderbroken upload nodig, en een kleine testvideo is in een tel klaar. De aanpak:

1. Genereer in de test een bestand van een paar tientallen MB (een geldige MP4 plus opvulling is niet bruikbaar; kies een bestand dat de server accepteert en dat groter is dan één stuk van 32 MB, of laat de upload anders vertragen).
2. Laat `page.route(...)` het tweede `PATCH`-verzoek van de upload afbreken (`route.abort()`).
3. De upload staat dan deterministisch op het punt tussen twee stukken.

Bouw dit één keer als helper (bijvoorbeeld `helpers/video-upload.js`) en gebruik hem in alle zes. Controleer eerst of de testvideo's uit `backend/tests/fixtures/videos/` groot genoeg zijn voor meer dan één stuk; zo niet, dan is vertragen met `page.route` een tweede mogelijkheid.

## Risico's en aandachtspunten

- **Parallelle uploads:** `VIDEO_MAX_PARALLEL_UPLOADS` staat standaard op 1. Controleer of dat per organisatie geldt of voor de hele server. Geldt het voor de hele server, dan kunnen tests die tegelijk uploaden elkaar weigeren. Zet dan voor deze map `workers: 1`, of verhoog de waarde in de CI-`.env`.
- **Vrije schijfruimte in CI:** `VIDEO_MIN_FREE_SPACE_GB` staat standaard op 20. Een CI-runner heeft vaak minder vrij en weigert dan elke upload met "niet genoeg opslagruimte". Zet in de `.env` van de e2e-job `VIDEO_MIN_FREE_SPACE_GB=1`.
- **Standaardbeschikbaarheid (spec 003):** scenario 22 en 23 kloppen zolang nieuwe video's "Alleen eigen organisatie" zijn. Dat is de standaard zonder `VIDEO_DEFAULT_VISIBILITY` in `.env`. Als spec 003 het uploadvenster uitbreidt, moeten de uploadtests daarop worden aangepast.
- **Bestandspad vanuit `e2e/`:** gebruik `path.resolve('../backend/tests/fixtures/videos/<bestand>')`. Het werkpad is de map `e2e/` bij `npx playwright test`.
- **Afspelen:** zie de uitgangspunten; niet automatiseren.

## Open punten

- Scenario 23, 24 en 25 zijn opgenomen als A. Guus gaf aan dat ze mogen vervallen. Ze zijn goedkoop (losse `request.get`-aanroepen) en testen de afscherming van videobestanden. Besluit nog te nemen.
- Scenario 10, 10b, 11 en 26: controleren of de backendtests deze al dekken. Zo ja, label B.

## Aanbevolen bouwvolgorde

1. `video-upload-validation.spec.js` (3 t/m 9): geen halve uploads nodig, de simpelste.
2. `video-upload.spec.js` (1, 2, 16, 17, 18, 19), daarna 15 en 16b/16c/16d.
3. `video-delete-isolation.spec.js` (21 t/m 25).
4. De halve-upload-helper en `video-resume.spec.js` (12, 13, 14, 29, 30, 31) als laatste.
