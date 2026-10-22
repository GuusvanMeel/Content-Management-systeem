# Quickstart: valideren van de 360°-videobibliotheek

Gids om na de implementatie aan te tonen dat de feature werkt. Endpoints staan in
[contracts/api.md](contracts/api.md), schermen in [contracts/ui.md](contracts/ui.md), velden en
bestanden in [data-model.md](data-model.md), keuzes in [research.md](research.md).

## Voorbereiding

1. Vul in `.env` de nieuwe variabelen in (zie `.env.example`): `VIDEOS_DIR=/data/videos` en
   eventueel `VIDEO_MAX_SIZE_GB`, `VIDEO_MIN_FREE_SPACE_GB`, `VIDEO_MAX_PARALLEL_UPLOADS`,
   `UPLOAD_EXPIRY_HOURS`, `VIDEO_MAX_WIDTH`, `VIDEO_MAX_HEIGHT` (standaarden: 10, 20, 1, 24,
   5760, 2880).
2. Bouw en start opnieuw (de API-image krijgt `ffmpeg`, nginx een nieuwe configuratie, Compose
   een nieuw volume `videos`):

   ```bash
   docker compose up -d --build
   ```

3. Voer de migratie uit:

   ```bash
   docker compose exec api npx knex migrate:latest
   ```

4. Zorg voor twee organisaties (A en B) en log als A in op `https://localhost/login`.
5. Testbestanden: gebruik de bestanden uit `backend/tests/fixtures/videos/` (research R12) en
   voor de grote scenario's een eigen 360°-video van 2–5 GB (MP4, H.264, twee keer zo breed als
   hoog, ≤ 5760×2880).

## Geautomatiseerde tests

```bash
docker compose --profile test run --rm api-test
```

```bash
docker compose run --rm web-build npm test
```

Verwacht: alle tests groen, tegen `db-test`, met de echte ffprobe/ffmpeg uit de test-image.

## Handmatige scenario's

| # | Stappen | Verwacht resultaat | Spec |
| --- | --- | --- | --- |
| 1 | Open "Video's" bij een lege organisatie | Lege-bibliotheektekst en knop "Video toevoegen" | US3-2 |
| 2 | Kies `valid-512x256.mp4`, laat de naam staan, upload | Voortgang, "Video wordt gecontroleerd…", daarna "Toegevoegd aan de bibliotheek"; video met thumbnail, naam, duur, grootte en datum | FR-001, FR-013, FR-017 |
| 3 | Kies `clip.mov` | Uploadvenster opent; naast het bestand in rood "Dit bestandstype kan niet worden gebruikt. Kies een MP4-video (de bestandsnaam eindigt op .mp4)."; "Uploaden" staat uit; niets verstuurd (devtools → Network) | FR-002, FR-013 |
| 4 | Kies `h265-512x256.mp4` | In het venster in rood "Deze video is op een manier opgeslagen die de VR-bril niet kan afspelen. Sla de video in je bewerkingsprogramma opnieuw op als MP4 met de instelling ‘H.264’."; "Uploaden" staat uit; niets verstuurd | FR-002, FR-013 |
| 5 | Kies `quicktime-512x256.mp4` (een MOV met `.mp4`-naam) | In het venster in rood "Dit bestandstype kan niet worden gebruikt. Kies een MP4-video (de bestandsnaam eindigt op .mp4)."; "Uploaden" staat uit | FR-002, FR-013 |
| 6 | Kies `not-360-640x360.mp4` en `square-1024x1024.mp4` tegelijk | Beide in rood "Dit is geen 360°-video. Kies een video die met een 360°-camera is gemaakt; zo'n beeld is twee keer zo breed als hoog."; "Uploaden" staat uit; na "Uit de lijst halen" van beide is er niets meer te uploaden | FR-003, FR-013 |
| 7 | Kies `too-large-6144x3072.mp4`; daarna `valid-max-5760x2880.mp4` | Eerste in rood "De beeldkwaliteit van deze video is te hoog voor de VR-bril. Sla de video opnieuw op met een lagere resolutie: maximaal 5760 × 2880 beeldpunten." en "Uploaden" uit; tweede zonder fout, "Uploaden" aan en de upload wordt geaccepteerd | FR-003a, FR-013 |
| 8 | Kies `valid-opus-audio-512x256.mp4` en `valid-silent-1024x512.mp4` tegelijk | Beide zonder fout in het venster; na "Uploaden" beide in de bibliotheek | FR-002a |
| 9 | Kies `audio-only.mp4`; daarna `corrupt.mp4` | `audio-only.mp4`: in het venster in rood "Dit bestand kan niet als video worden geopend. Controleer of de video op je computer goed afspeelt en probeer het opnieuw.". `corrupt.mp4` kan de browser niet lezen: geen fout in het venster, "Uploaden" aan; na de upload verschijnt midden in het scherm "Video niet toegevoegd" met "Dit bestand kan niet als video worden geopend. Controleer of de video op je computer goed afspeelt en probeer het opnieuw." en er komt niets in de bibliotheek | FR-013b, FR-014 |
| 10 | Zet tijdelijk `VIDEO_MAX_SIZE_GB=1`, herstart de API, kies een bestand > 1 GB | In het venster in rood "Deze video is groter dan 1 GB. …"; "Uploaden" uit; zet de waarde terug | FR-004 |
| 10b | Zet tijdelijk `VIDEO_MAX_WIDTH=1000` en `VIDEO_MAX_HEIGHT=500`, herstart de API, kies `valid-silent-1024x512.mp4` | In het venster in rood de melding over te hoge beeldkwaliteit met "maximaal 1000 × 500 beeldpunten"; zet de waarden terug | FR-003a |
| 11 | Zet tijdelijk `VIDEO_MIN_FREE_SPACE_GB` hoger dan de vrije ruimte, herstart, upload | "Er is op dit moment niet genoeg opslagruimte…"; zet de waarde terug | FR-004a |
| 12 | Start een upload van 2–5 GB, zet halverwege de netwerkverbinding uit (devtools → Offline) en na 20 s weer aan | "Verbinding verbroken, opnieuw proberen…", daarna verder vanaf hetzelfde percentage | FR-008, SC-002 |
| 13 | Start dezelfde upload, sluit de browser op ±50%, open hem opnieuw, log in, kies hetzelfde bestand | "Hervat"; begint rond 50%, niet bij 0% (devtools: eerste verzoek is `HEAD`) | FR-007, FR-009 |
| 14 | Als 13, maar kies op een andere computer of in een andere browser hetzelfde bestand | Begint bij 0% (nieuwe upload) | spec, Edge Cases |
| 15 | Kies drie bestanden tegelijk | Eén bezig, twee "Wacht…"; ze starten na elkaar | FR-006b |
| 16 | Open "Video's" zonder uploads en klik op het ronde knopje rechtsonder | Het knopje staat er ook zonder uploads; klikken opent de bestandskiezer en daarna het uploadvenster. Op "Huisstijl" staat het knopje er niet zolang er geen uploads zijn | FR-006a |
| 16b | Start een upload op "Video's" | Een bestandspictogram valt in het knopje; het knopje blijft ingeklapt en de ring loopt vol. Met "verminderde beweging" aan in Windows/macOS: geen animatie | FR-006a, FR-006d |
| 16c | Laat de upload afronden op "Video's"; doe daarna een upload en zet halverwege de verbinding uit (devtools → Offline) | Bij "Toegevoegd aan de bibliotheek" en bij "Verbinding verbroken…" klapt de lijst vanzelf uit en na ±4 s weer in | FR-006a |
| 16d | Klik tijdens een upload op "Huisstijl" en terug, en klik daar op het knopje | Upload loopt door; op "Huisstijl" klapt het knopje niet vanzelf uit; klikken opent de lijst en die blijft open tot je opnieuw klikt | FR-006a |
| 17 | Probeer tijdens een upload het tabblad te sluiten | Waarschuwing van de browser | FR-006c |
| 18 | Klik tijdens een upload op "Uitloggen" | Bevestigingsvraag; na "Uitloggen" is de upload onderbroken en later hervatbaar | FR-006c |
| 19 | Annuleer een lopende upload | Regel verdwijnt; `incoming/` bevat die upload niet meer | FR-010 |
| 20 | Laat een upload van > 60 minuten lopen zonder iets aan te klikken | Upload wordt afgerond; sessie niet verlopen | FR-012 |
| 21 | Verwijder een video en bevestig; annuleer bij een tweede | Eerste weg uit bibliotheek, bestand en thumbnail nog op schijf en `deletedAt` gevuld; tweede blijft | FR-019, FR-020, SC-007 |
| 22 | Log in als B en open "Video's" | Geen video's van A | FR-022 |
| 23 | Als B: open in de adresbalk de `thumbnailUrl` van een video van A, en `https://localhost/internal/videos/thumbnails/…` | Beide `404` | FR-022, research R8 |
| 24 | Als A: open de `thumbnailUrl` en bekijk de response-headers | Afbeelding getoond; API-response had `X-Accel-Redirect` (nginx-log of `curl -I` via de API-container) | research R8 |
| 25 | Probeer `https://localhost/media/videos/…` en `/media/thumbnails/…` | `404`: video's staan niet onder `/media` | research R2 |
| 26 | Zet tijdelijk `UPLOAD_EXPIRY_HOURS=1`, onderbreek een upload, wacht ruim 1 uur en 15 minuten | Bestanden van die upload zijn uit `incoming/` verwijderd; opnieuw kiezen begint bij 0%; zet de waarde terug | FR-011, SC-008 |
| 27 | Upload een geldige video van ±5–10 GB en meet de tijd tussen 100% en "Toegevoegd" | ≤ 60 s | FR-015, SC-003 |
| 28 | Maak 200 video's voor organisatie A met `docker compose exec api node scripts/seed-videos.js <organisatiecode> 200` en open "Video's" | Binnen 2 s zichtbaar (ook automatisch getest in `videoLibrary.test.js`) | SC-006 |
| 29 | Upload een video, onderbreek bij ±40% (tabblad sluiten), open "Video's" opnieuw in dezelfde browser | Bovenaan "Je bent eerder begonnen met uploaden van <naam>, 40% klaar. Kies het bestand opnieuw om verder te gaan, of verwijder het."; in een andere browser niet | FR-009a |
| 30 | Klik bij die melding op "Verwijderen" | Melding weg; de upload staat niet meer in `incoming/` | FR-009a, FR-010 |
| 31 | Kies na scenario 29 hetzelfde bestand opnieuw | Melding verdwijnt; upload hervat rond 40% met "Hervat" | FR-009, FR-009a |

## Controle op de server

```bash
docker compose exec api ls -R /data/videos
```

Verwacht: alleen bestanden onder `videos/<orgId>/` en `thumbnails/<orgId>/` voor geaccepteerde
video's, en onder `incoming/` alleen lopende of onderbroken uploads.
