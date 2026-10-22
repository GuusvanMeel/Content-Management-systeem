# Quickstart: valideren van de 360°-videobibliotheek

Gids om na de implementatie aan te tonen dat de feature werkt. Endpoints staan in
[contracts/api.md](contracts/api.md), schermen in [contracts/ui.md](contracts/ui.md), velden en
bestanden in [data-model.md](data-model.md), keuzes in [research.md](research.md).

## Voorbereiding

1. Vul in `.env` de nieuwe variabelen in (zie `.env.example`): `VIDEOS_DIR=/data/videos` en
   eventueel `VIDEO_MAX_SIZE_GB`, `VIDEO_MIN_FREE_SPACE_GB`, `VIDEO_MAX_PARALLEL_UPLOADS`,
   `UPLOAD_EXPIRY_HOURS` (standaarden: 10, 20, 1, 24).
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
   voor de grote scenario's een eigen 360°-video van 2–5 GB (MP4, H.264, 2:1, ≤ 4096×2048).

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
| 3 | Kies `clip.mov` | Meteen "Alleen MP4-video's (H.264) worden ondersteund."; niets verstuurd (devtools → Network) | FR-002 |
| 4 | Upload `h265-512x256.mp4` | Na de upload de codec-melding; niets in de bibliotheek; geen bestand in `incoming/` of `videos/` | FR-002, FR-014 |
| 5 | Upload `quicktime-512x256.mp4` | Melding "Alleen MP4-video's (H.264)…" | FR-002 |
| 6 | Upload `not-360-640x360.mp4` en `square-1024x1024.mp4` | Beide "Dit is geen 360°-video…" | FR-003 |
| 7 | Upload `too-large-4352x2176.mp4` | "De resolutie is te hoog…"; `valid-4096x2048.mp4` wordt wel geaccepteerd | FR-003a |
| 8 | Upload `valid-opus-audio-512x256.mp4` en `valid-silent-1024x512.mp4` | Beide geaccepteerd | FR-002a |
| 9 | Upload `corrupt.mp4` en `audio-only.mp4` | "Dit bestand kan niet gelezen worden…" | FR-014 |
| 10 | Zet tijdelijk `VIDEO_MAX_SIZE_GB=1`, herstart de API, kies een bestand > 1 GB | Meteen "Een video mag maximaal … GB zijn."; zet de waarde terug | FR-004 |
| 11 | Zet tijdelijk `VIDEO_MIN_FREE_SPACE_GB` hoger dan de vrije ruimte, herstart, upload | "Er is op dit moment niet genoeg opslagruimte…"; zet de waarde terug | FR-004a |
| 12 | Start een upload van 2–5 GB, zet halverwege de netwerkverbinding uit (devtools → Offline) en na 20 s weer aan | "Verbinding verbroken, opnieuw proberen…", daarna verder vanaf hetzelfde percentage | FR-008, SC-002 |
| 13 | Start dezelfde upload, sluit de browser op ±50%, open hem opnieuw, log in, kies hetzelfde bestand | "Hervat"; begint rond 50%, niet bij 0% (devtools: eerste verzoek is `HEAD`) | FR-007, FR-009 |
| 14 | Als 13, maar kies op een andere computer of in een andere browser hetzelfde bestand | Begint bij 0% (nieuwe upload) | spec, Edge Cases |
| 15 | Kies drie bestanden tegelijk | Eén bezig, twee "Wacht…"; ze starten na elkaar | FR-006b |
| 16 | Klik tijdens een upload op "Huisstijl" en terug | Upload loopt door; indicator blijft zichtbaar | FR-006a |
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

## Controle op de server

```bash
docker compose exec api ls -R /data/videos
```

Verwacht: alleen bestanden onder `videos/<orgId>/` en `thumbnails/<orgId>/` voor geaccepteerde
video's, en onder `incoming/` alleen lopende of onderbroken uploads.
