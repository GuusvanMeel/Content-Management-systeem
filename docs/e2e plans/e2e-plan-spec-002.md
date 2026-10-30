# E2E-plan spec 002: 360°-videobibliotheek

Bron: `specs/002-video-library/quickstart.md`. Dit document zegt per scenario of het met Playwright wordt geautomatiseerd, hoe, en in welk bestand. Opgebouwd zoals het plan voor spec 001 (`e2e-plan-spec-001.md`).

## Legenda

| Label | Betekenis |
|---|---|
| **A** | Automatiseren met Playwright |
| **A+H** | Een deel automatiseren, het uiterlijk of een deel op de server blijft handmatig |
| **H** | Handmatig laten (omgevingsvariabele wijzigen, uren wachten, grote bestanden, gevoel) |
| **B** | Al gedekt door de backendtests; niet nog eens in Playwright |

## Uitgangspunten

- Mapnaam: `e2e/tests/002-video-library/`.
- **Eigen organisatie per test** via `createTracker()` (`helpers/org-api.js`). Tests draaien parallel; in een gedeelde organisatie zien ze elkaars video's. De gedeelde run-organisatie (`org.json`) wordt in deze map niet gebruikt.
- Een test logt in via het scherm in een eigen `t.browserContext(browser)` met `loginViaScreen(page, org.loginCode, TEST_PASSWORD)`. Alleen voor een directe API-aanroep als die organisatie gebruikt de test `t.login(...)`.
- Elke zelf gemaakte context of verbinding krijgt expliciet een `storageState`; zonder erft hij de sessie uit `org.json` en beëindigt een login die. De tracker doet dit al.
- Een test met twee gebruikers of twee "browsers" maakt twee contexten (`t.browserContext(browser)`, twee keer).
- Namen van organisaties: `uniqueName('E2E-SC<nummer>')`, uniek per test. De tracker ruimt na afloop op.
- Testbestanden: `videoFixture('<bestand>')` uit `backend/tests/fixtures/videos/` (pad vanaf `e2e/`). Dat werkt ook in CI, omdat de repo daar is uitgecheckt.
- Bestanden kies je met `page.locator('[data-test="file-input"]').setInputFiles([...])`; het uploadvenster opent dan vanzelf. De knop "Uploaden" staat in dat venster (`getByRole('dialog')`).
- Wacht op een upload met een timeout van 30 s (`{ timeout: 30_000 }`); de standaard is te kort voor upload en controle op de server.
- Grote bestanden (GB's) horen niet in Playwright. Grenzen worden aan de backendtests of aan de handmatige controle overgelaten.
- Videoafspelen valt buiten Playwright: de Chromium van Playwright speelt geen H.264 of AAC af. Controleer dat het beeld of het element er is, niet dat het speelt.

## Helpers (`e2e/helpers/video-upload.js`)

- `videoFixture(naam)`: pad naar een testvideo.
- `loginViaScreen(page, loginCode, password)`: inloggen via het scherm; wacht tot het hoofdmenu zichtbaar is.
- `holdUploads(page)`: houdt de uploadverzoeken van de pagina vast, zodat een upload "bezig" of "wachtend" blijft staan. Geeft `release()` terug. Roep hem aan voordat je het bestand kiest.
- `startHalfUpload(page, bestand)`: zie hieronder.

### Halve upload

Scenario 12, 13, 14, 29, 30 en 31 hebben een onderbroken upload nodig. Een testvideo is klein en daarmee in één stuk klaar, dus de helper maakt de stukken klein:

1. `page.route` op `upload-settings` vervangt `chunkSizeBytes` door 8 kB. `valid-512x256.mp4` (19 kB) bestaat dan uit drie stukken, en de browser gebruikt die grootte voor de tus-upload.
2. `page.route` op de uploadverzoeken laat het eerste `PATCH` door en breekt elk volgend `PATCH` af (`route.abort`), alsof de verbinding wegvalt. De browser probeert het opnieuw (`Verbinding verbroken, opnieuw proberen…`).
3. De server heeft dan 8 kB, bij `valid-512x256.mp4` 42%. De helper geeft `percent` terug.
4. `resume()` stopt het afbreken; de upload gaat bij de volgende poging verder en rondt af.

De helper logt niet in en opent `/videos` zelf: roep hem aan na `loginViaScreen`, en bezoek `/videos` daarvoor niet, want de instellingen worden bij het openen opgehaald.

De opgeslagen upload staat in de `localStorage` van de browsercontext. "Browser sluiten" (scenario 13, 29, 30, 31) is daarom `page.close()` gevolgd door een nieuwe pagina in **dezelfde** context. Een tweede context (scenario 14, 29) is een andere browser.

## Scenario's

| # | Wat | Label | Aanpak in Playwright | Bestand |
|---|---|---|---|---|
| 1 | Lege bibliotheek | A | Eigen, lege organisatie; lege-bibliotheektekst en twee knoppen "Video toevoegen" in `main` (het knopje rechtsonder is een derde) | `video-upload.spec.js` |
| 2 | Geldige video uploaden | A | `valid-512x256.mp4` kiezen via de bestandskiezer en uploaden; naam, duur (`00:00:02`), "Geüpload op" en "Eigen" in de lijst | `video-upload.spec.js` |
| 3 | `clip.mov` wordt geweigerd | A | Melding (`role alert`) "Dit bestandstype kan niet worden gebruikt", "Uploaden" uit; met `page.on('request')` controleren dat niets naar `video-uploads` is verstuurd | `video-upload-validation.spec.js` |
| 4 | H.265-video wordt geweigerd | A | Zelfde aanpak; melding noemt H.264 | `video-upload-validation.spec.js` |
| 5 | MOV met `.mp4`-naam wordt geweigerd | A | Zelfde melding als scenario 3 | `video-upload-validation.spec.js` |
| 6 | Geen 360° (twee bestanden tegelijk) | A | Beide met de melding "Dit is geen 360°-video"; "Uploaden" uit; na "Uit de lijst halen" van de eerste één melding over; na de tweede sluit het venster | `video-upload-validation.spec.js` |
| 7 | Te hoge resolutie, daarna maximale resolutie | A | Eerste geweigerd; venster sluiten met "Annuleren"; tweede kiezen: geen fout, "Uploaden" aan, de video komt in de bibliotheek | `video-upload-validation.spec.js` |
| 8 | Opus-audio en stille video | A | Beide tegelijk: geen fout, "Uploaden" aan, beide in de bibliotheek | `video-upload-validation.spec.js` |
| 9 | Alleen audio; corrupt bestand | A | `audio-only.mp4`: melding in het venster. `corrupt.mp4`: geen fout in het venster (de browser kan hem niet beoordelen); na de upload het venster "Video niet toegevoegd" met de melding en daarna een lege bibliotheek | `video-upload-validation.spec.js` |
| 10 | Maximale bestandsgrootte (`VIDEO_MAX_SIZE_GB`) | H | Omgevingsvariabele wijzigen en API herstarten kan Playwright niet. Eerst nagaan of de backendtests dit al dekken (dan B) | n.v.t. |
| 10b | Maximale resolutie (`VIDEO_MAX_WIDTH` en `_HEIGHT`) | H | Zelfde als 10 | n.v.t. |
| 11 | Te weinig vrije opslagruimte | H | Zelfde als 10; mogelijk al B | n.v.t. |
| 12 | Verbinding valt weg tijdens upload | A | `startHalfUpload`; het paneel toont "Verbinding verbroken…"; `resume()`; de upload rondt af en de video staat in de bibliotheek | `video-resume.spec.js` |
| 13 | Browser sluiten en hervatten | A | `startHalfUpload`, `page.close()`, nieuwe pagina in dezelfde context; hetzelfde bestand kiezen (met `holdUploads`): "Hervat" in het paneel, het eerste verzoek is `HEAD`, de `Upload-Offset` is groter dan 0, de upload rondt af | `video-resume.spec.js` |
| 14 | Andere browser begint bij 0% | A | Tweede browsercontext, zelfde organisatie, ingelogd: geen melding over een onderbroken upload; hetzelfde bestand begint met `POST` en zonder "Hervat" | `video-resume.spec.js` |
| 15 | Drie bestanden tegelijk | A | Met `holdUploads`: één bezig, twee "Wacht…"; na `release()` alle drie in de bibliotheek | `video-upload.spec.js` |
| 16 | Knopje rechtsonder zonder uploads | A | Op "Video's" aanwezig, opent de bestandskiezer; op "Huisstijl" niet | `video-upload.spec.js` |
| 16b | Knopje tijdens upload | A+H | Automatiseren: het paneel blijft ingeklapt terwijl de upload loopt (`holdUploads`). Handmatig: het uiterlijk van ring en animatie, en de variant met verminderde beweging (FR-006d), die bewust niet geautomatiseerd is | `video-upload.spec.js` |
| 16c | Lijst klapt vanzelf uit en in | A+H | Automatiseren: bij "Toegevoegd aan de bibliotheek" klapt het paneel uit en na ongeveer 4 s weer in; hetzelfde bij "Verbinding verbroken…" (alle uploadverzoeken afbreken met `route.abort`). Handmatig: het uiterlijk | `video-upload.spec.js` |
| 16d | Knopje op "Huisstijl" tijdens upload | A | Upload loopt door (naam `1 bezig, 0 wachtend`); het knopje klapt niet vanzelf uit; klik opent de lijst en die blijft open na afronding (langer dan 4 s) tot je opnieuw klikt | `video-upload.spec.js` |
| 17 | Tabblad sluiten tijdens upload | A | `page.on('dialog')` en `page.close({ runBeforeUnload: true })`; de dialoog heeft type `beforeunload`; na "Blijven" is het tabblad open en loopt de upload door. De tekst van de browserwaarschuwing is niet te controleren | `video-upload.spec.js` |
| 18 | Uitloggen tijdens upload | A | Bevestigingsvraag (`alertdialog`); "Annuleren": ingelogd, upload loopt door; "Uitloggen": loginpagina, geen knopje meer. Hervatten staat in scenario 29 t/m 31 | `video-upload.spec.js` |
| 19 | Upload annuleren | A+H | Automatiseren: "Annuleren" in het paneel; de regel verdwijnt en het knopje heet weer "Video toevoegen". Backend of handmatig: dat `incoming/` geen upload meer bevat | `video-upload.spec.js` |
| 20 | Upload van meer dan 60 minuten | H | Duurt een uur; sessie-time-out is al backend (spec 001) | n.v.t. |
| 21 | Video verwijderen | A+H | Automatiseren: twee video's; de eerste verwijderen en bevestigen (weg uit de lijst); de tweede verwijderen en annuleren (blijft). Backend of handmatig: bestand en miniatuur nog op schijf, `deletedAt` gevuld | `video-delete-isolation.spec.js` |
| 22 | B ziet de video's van A niet | A | Twee eigen organisaties; A uploadt, B ziet de lege-bibliotheektekst en geen video's | `video-delete-isolation.spec.js` |
| 23 | B kan de miniatuur van A niet openen | A | De `src` van de miniatuur van A, opgevraagd als B via `t.login`, geeft 404; ook `/internal/videos/thumbnails/...` geeft 404 | `video-delete-isolation.spec.js` |
| 24 | A kan de eigen miniatuur openen | A | De miniatuur geeft 200 en een `image/…`-content-type. De `X-Accel-Redirect`-header is via nginx niet zichtbaar | `video-delete-isolation.spec.js` |
| 25 | `/media/videos/...` en `/media/thumbnails/...` bestaan niet | A | Twee `request.get`-aanroepen op `https://localhost/media/...`; beide 404 | `video-delete-isolation.spec.js` |
| 26 | Verlopen upload wordt opgeruimd (`UPLOAD_EXPIRY_HOURS`) | H | Een uur wachten en variabele wijzigen; mogelijk al B (opruimfunctie direct aanroepen) | n.v.t. |
| 27 | 5 tot 10 GB: afronden binnen 60 seconden | H | Grote video en een stopwatch; niet voor CI | n.v.t. |
| 28 | 200 video's in 2 seconden zichtbaar | B | Staat in `videoLibrary.test.js` | n.v.t. |
| 29 | Onderbroken upload meldt zich bovenaan | A | `startHalfUpload`, `page.close()`, nieuwe pagina in dezelfde context: "Je bent eerder begonnen met uploaden van valid-512x256, 42% klaar."; in een andere context (zelfde organisatie) niet | `video-resume.spec.js` |
| 30 | "Verwijderen" bij die melding | A | Melding weg, ook na opnieuw laden. Dat de upload uit `incoming/` is, blijft backend of handmatig | `video-resume.spec.js` |
| 31 | Hetzelfde bestand opnieuw kiezen | A | Melding verdwijnt; het paneel toont "Hervat"; na `release()` rondt de upload af | `video-resume.spec.js` |

## Samenvatting

| Label | Aantal |
|---|---|
| A (automatiseren) | 24 (1 t/m 9, 12 t/m 15, 16, 16d, 17, 18, 22 t/m 25, 29 t/m 31) |
| A+H | 4 (16b, 16c, 19, 21) |
| H | 6 (10, 10b, 11, 20, 26, 27) |
| B | 1 (28) |

## Risico's en aandachtspunten

- **Parallelle uploads:** `VIDEO_MAX_PARALLEL_UPLOADS` (standaard 1) wordt alleen door de browser afgedwongen, per tabblad. Tests die tegelijk draaien, hinderen elkaar daarmee niet.
- **Vrije schijfruimte in CI:** `VIDEO_MIN_FREE_SPACE_GB` staat standaard op 20. Een CI-runner heeft vaak minder vrij en weigert dan elke upload met "niet genoeg opslagruimte". De `.env` van de e2e-job in `.github/workflows/ci.yml` bevat daarom `VIDEO_MIN_FREE_SPACE_GB=1`.
- **Wachttijden:** de tests wachten op `expect` en op een vaste pauze van 5 s (scenario 16d: het paneel klapt niet in). Op een trage runner kunnen ze sporadisch falen; draai ze voor het opnemen in CI meermaals (`--repeat-each`).
- **Standaardbeschikbaarheid (spec 003):** scenario 22, 23 en 24 kloppen zolang nieuwe video's "Alleen eigen organisatie" zijn. Dat is de standaard zonder `VIDEO_DEFAULT_VISIBILITY` in `.env`. Het uploadvenster bevat ook beschikbaarheid en beschrijving (spec 003); de uploadtests laten die op de standaard staan.
- **Afspelen:** zie de uitgangspunten; niet automatiseren.

## Beperkingen van de tests

- Scenario 3 en 4: dat er niets is verstuurd, is een zwakke controle, omdat "Uploaden" al uit staat.
- Scenario 17: alleen het type van de dialoog is te controleren, niet de tekst.
- Scenario 16d: dat het paneel niet inklapt, volgt uit de vaste pauze; zonder wijziging in de app is dat niet te saboteren.
- Scenario 23: het interne pad wordt met een verzonnen bestandsnaam opgevraagd.

## Open punten

- Scenario 10, 10b, 11 en 26: nagaan of de backendtests deze al dekken. Zo ja, label B.
