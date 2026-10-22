# Implementation Plan: 360°-videobibliotheek (eigen organisatie)

**Branch**: `Development` (feature `002-video-library`) | **Date**: 2026-10-22 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-video-library/spec.md`

## Summary

Een docent uploadt 360°-video's (MP4/H.264, 2:1, ≤ 5760×2880 instelbaar, ≤ 10 GB) naar de bibliotheek van
de eigen organisatie, ziet de bibliotheek met thumbnail, naam, duur, grootte en uploaddatum, en
verwijdert video's zacht. Uploads zijn hervatbaar, lopen door bij navigeren in het CMS en staan
in een wachtrij in de browser. Na de handmatige test controleert het uploadvenster een bestand
al vóór de upload; fouten staan daar in gewone taal en blokkeren de knop "Uploaden".

Technisch: het open **tus-protocol** (`@tus/server` + `@tus/file-store` in de Express-API,
`tus-js-client` in de browser) in delen van 32 MB. Vóór de upload leest **mp4box.js** in de
browser alleen de kop van het MP4-bestand en past dezelfde regels toe als de server (R13). Na
het laatste deel controleert de API het
bestand met **ffprobe** en maakt **ffmpeg** de thumbnail, binnen hetzelfde verzoek; alleen een
geldige video krijgt een rij in `Video` (exact het ERD, geen status). Alle bestandstoegang loopt
via één module `videoStorage.js` op een nieuw, niet-publiek volume `videos`. Thumbnails worden
na een toegangscontrole door nginx geleverd via `X-Accel-Redirect`. Een opruimtaak verwijdert
onvoltooide uploads na 24 uur zonder nieuw deel. Zie [research.md](research.md).

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js 22 LTS; Vue 3

**Primary Dependencies**: bestaand (Express 5, Knex + mysql2, Vue 3, Vue Router, Pinia) plus
nieuw: `@tus/server` en `@tus/file-store` 2.x (backend), `tus-js-client` 4.x en `mp4box` 2.x
(frontend, BSD-3-Clause),
`ffmpeg`/`ffprobe` (Alpine-pakket in de API-image). Alles gratis/open source.

**Storage**: MariaDB 11.8, nieuwe tabel `Video` ([data-model.md](data-model.md)); bestanden op
het nieuwe Docker-volume `videos` (`/data/videos`), via `backend/src/lib/videoStorage.js`

**Testing**: Vitest + Supertest tegen `db-test` (zoals 001), met echte testvideo's in
`backend/tests/fixtures/videos/` en ffprobe/ffmpeg in de test-image; frontend met Vitest en Vue
Test Utils

**Target Platform**: Linux-VPS met Docker Compose; desktopbrowsers voor het CMS

**Project Type**: webapplicatie (frontend + backend), uitbreiding van feature 001

**Performance Goals**: controle + thumbnail ≤ 60 s na de upload voor 10 GB (FR-015); bibliotheek
met 200 video's ≤ 2 s (SC-006); hervatten verliest hooguit één deel van 32 MB (SC-002)

**Constraints**: één VPS en geen betaalde diensten; video's niet publiek (geen `/media`); geen
status-, reden- of voortgangsvelden in de database; ≥ 20 GB vrij na elke upload; geen S3

**Scale/Scope**: tientallen organisaties, honderden video's per organisatie, bestanden tot
10 GB; 4 API-routes + tus-endpoint ([contracts/api.md](contracts/api.md)), 1 scherm + de
uploadindicator ([contracts/ui.md](contracts/ui.md))

Er zijn geen open NEEDS CLARIFICATION-punten; alle keuzes staan in [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Getoetst aan constitution v2.0.0.

| Principe | Toets | Status |
| --- | --- | --- |
| I. Vaste technologiestack | Express 5 (ES modules), Vue 3, MariaDB 11.8; nieuwe bibliotheken zijn gewone npm-pakketten binnen die stack; ffmpeg is een systeemhulpmiddel, geen ander framework | ✅ |
| II. Docker op één VPS | Nieuw volume `videos` in Compose; geen externe opslag of diensten; S3 bewust niet gebouwd | ✅ |
| III. Video's via nginx, API alleen voor toegangscontrole | Video's als bestanden op schijf, database bevat alleen metadata en keys; thumbnails via `X-Accel-Redirect`; de API stuurt in productie geen video- of thumbnailbytes. Uploaden is geen "serveren" en loopt via de API (tus) | ✅ (zie Complexity Tracking voor ontwikkelmodus) |
| IV. Geen geheimen in git | Nieuwe `.env`-variabelen zijn geen geheimen; `.env.example` wordt aangevuld; testvideo's bevatten geen gevoelige data | ✅ |
| V. Zachte verwijdering | `Video.deletedAt`; bestand en thumbnail blijven staan; standaardqueries filteren `deletedAt IS NULL` | ✅ |
| VI. Taalconventies | Code, foutcodes, logregels en configuratiesleutels Engels; `message` en UI-teksten Nederlands; documentatie Nederlands | ✅ |
| Bronnen en domeinregels | `Video` volgt het ERD exact (geen nieuwe velden); `VideoAccess` nog niet aangemaakt (FR-14). ERD hoeft niet te veranderen | ✅ |
| Ontwikkelworkflow | specify → clarify → plan doorlopen; werk op `Development` | ✅ |

**Na Phase 1 opnieuw getoetst**: geen schendingen. De enige afwijking (bytes via de API in
ontwikkelmodus) is dezelfde als voor `/media` in feature 001 en staat hieronder verantwoord.

## Project Structure

### Documentation (this feature)

```text
specs/002-video-library/
├── plan.md              # Dit bestand
├── research.md          # Phase 0: tus, opslag, controle, nginx/API-instellingen, tests
├── data-model.md        # Phase 1: tabel Video, tijdelijke uploads, bestanden, configuratie
├── quickstart.md        # Phase 1: validatiegids
├── contracts/
│   ├── api.md           # Phase 1: bibliotheekroutes en tus-endpoint
│   └── ui.md            # Phase 1: bibliotheek, uploadindicator, waarschuwingen
└── tasks.md             # Phase 2 (/speckit-tasks, nog niet aangemaakt)
```

### Source Code (repository root)

Nieuw (+) en gewijzigd (~) ten opzichte van feature 001:

```text
docker-compose.yml                 ~ volume videos (api rw, web ro); VIDEOS_DIR voor api en api-test
.env.example                       ~ VIDEOS_DIR, VIDEO_MAX_SIZE_GB, VIDEO_MIN_FREE_SPACE_GB,
                                     VIDEO_MAX_PARALLEL_UPLOADS, UPLOAD_EXPIRY_HOURS

nginx/
└── default.conf                   ~ location ^~ /api/organisation/video-uploads (research R7),
                                     location /internal/videos/ (internal, X-Accel)

backend/
├── Dockerfile                     ~ apk add ffmpeg (base-stage, dus ook test-image)
├── (.env)                         ~ VIDEO_MAX_WIDTH, VIDEO_MAX_HEIGHT (standaard 5760, 2880)
├── scripts/
│   └── seed-videos.js             + 200 testvideo-rijen voor SC-006 (alleen ontwikkeling)
├── package.json                   ~ @tus/server, @tus/file-store
├── src/
│   ├── server.js                  ~ requestTimeout 15 min; startUploadCleanup()
│   ├── app.js                     ~ videoRoutes en videoUploadRoutes onder /api/organisation
│   ├── config/env.js              ~ nieuwe variabelen
│   ├── db/migrations/
│   │   └── 20261022000001_create_video.js   + tabel Video (ERD)
│   ├── jobs/
│   │   └── uploadCleanup.js       + onvoltooide uploads opruimen (R9)
│   ├── lib/
│   │   ├── videoMessages.js       + meldingen in gewone taal (R15)
│   │   ├── videoStorage.js        + save / getPath / getInternalUrl / remove / freeBytes (R2)
│   │   ├── videoVerification.js   + ffprobe-regels en thumbnail met ffmpeg (R4)
│   │   └── sendStoredFile.js      + X-Accel-Redirect in productie, sendFile in ontwikkeling (R8)
│   └── modules/videos/
│       ├── videoRepository.js     + queries uit data-model.md
│       ├── videoService.js        + bibliotheek, verwijderen, afronden na controle
│       ├── videoRoutes.js         + GET/DELETE videos, thumbnail, upload-settings
│       ├── videoUploadGuard.js    + eigenaar/limieten/vrije ruimte vóór tus (R3, R5, R6)
│       └── tusServer.js           + tus-configuratie, FileStore in incoming/, onUploadFinish
└── tests/
    ├── fixtures/videos/           + testvideo's + make-fixtures.sh (R12)
    ├── helpers/tus.js             + hulpfuncties voor POST/HEAD/PATCH in tests
    ├── unit/videoVerification.test.js, videoStorage.test.js, sendStoredFile.test.js
    └── integration/videoUpload.test.js, videoLibrary.test.js, uploadCleanup.test.js,
        organisationIsolation.test.js (~ videoroutes toegevoegd)

frontend/
├── package.json                   ~ tus-js-client
└── src/
    ├── api/videos.js              + bibliotheek-API en upload-settings
    ├── stores/uploads.js          + wachtrij, tus-uploads, resultaten, beforeunload (R10),
    │                                onderbroken uploads uit tus-urlStorage (R14)
    ├── components/
    │   ├── UploadIndicator.vue    + rond knopje op elke pagina; klapt uit bij nieuws op /videos
    │   ├── UploadDialog.vue       + uploadvenster: per bestand voorbeeld, naam, controle (R13)
    │   ├── UploadRejectedDialog.vue + melding midden in het scherm bij weigering door de server
    │   ├── ResumeNotice.vue       + melding over onderbroken uploads van deze browser (R14)
    │   └── OrganisationLayout.vue ~ indicator tonen; uitloggen met bevestiging bij uploads
    ├── lib/format.js              + grootte (GB/MB, 1024-basis), duur uu:mm:ss, datum
    ├── lib/videoCheck.js          + controle vóór de upload met mp4box.js (R13)
    ├── lib/videoMessages.js       + meldingen in gewone taal (R15)
    └── views/VideosView.vue       ~ herschreven op de API (prototype-logica eruit, R11)
    tests/uploads-store.test.js, videos-view.test.js, video-check.test.js (met de testvideo's
    uit backend/tests/fixtures/videos), upload-dialog.test.js, upload-indicator.test.js,
    resume-notice.test.js
```

**Structure Decision**: zelfde opzet als feature 001: een nieuwe backendmodule
`modules/videos/` naast de bestaande modules, gedeelde hulpmiddelen in `lib/`, een opruimtaak in
`jobs/`. Alle bestandstoegang voor video's zit in `lib/videoStorage.js`, zodat de opslag later
vervangen kan worden zonder de modules te raken.

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| In ontwikkelmodus en tests (`NODE_ENV !== 'production'`) stuurt de API thumbnailbytes zelf (`res.sendFile`) in plaats van via nginx (principe III) | Zonder nginx (lokaal draaien, Supertest) is er niets dat `X-Accel-Redirect` uitvoert | Altijd nginx vereisen voor ontwikkeling en tests maakt de testopzet zwaarder; in productie gaat het altijd via nginx, en een unittest controleert dat de productietak alleen de header zet. Dit is dezelfde uitzondering als `/media` in feature 001 |
