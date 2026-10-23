# Implementation Plan: Centrale videobibliotheek, beschikbaarheid en beschrijvingen

**Branch**: `Development` (feature `003-central-video-library`) | **Date**: 2026-10-23 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-central-video-library/spec.md`

## Summary

De videobibliotheek van feature 002 wordt gedeeld tussen organisaties. Bij het uploaden kiest de
docent per video "Algemeen beschikbaar", "Selectief beschikbaar" (met gekozen organisaties) of
"Alleen eigen organisatie", en vult optioneel een beschrijving in (max. 1000 tekens). De
eigenaar kan naam, beschrijving en beschikbaarheid later wijzigen in een venster boven de
bibliotheek; andere organisaties zien beschikbare video's alleen, met de naam van de eigenaar.
Zoeken, sorteren en filteren werken in de browser op de volledige lijst.

Technisch: één nieuwe tabel `VideoAccess` (zoals in het ERD); de bestaande velden
`Video.visibility` en `Video.description` worden gebruikt. De keuzes bij het uploaden reizen mee
in de tus-metadata, worden gecontroleerd bij het aanmaken van de upload én bij het afronden, en
worden in één transactie met de video vastgelegd. Eén repositoryfunctie bepaalt welke video's
een organisatie mag zien; lijst, details en thumbnail gebruiken die allemaal. De
standaardbeschikbaarheid staat in `.env` (`VIDEO_DEFAULT_VISIBILITY`). Zie
[research.md](research.md).

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js 22 LTS; Vue 3 (bestaande stack, features 001–002)

**Primary Dependencies**: backend: Express 5, Knex + mysql2, `@tus/server` + `@tus/file-store`
(feature 002); frontend: Vue 3, Vite, Vue Router, Pinia, `tus-js-client`, mp4box.js (feature
002). Geen nieuwe dependencies.

**Storage**: MariaDB 11.8: nieuwe tabel `VideoAccess`; bestaande `Video` ongewijzigd
([data-model.md](data-model.md)). Videobestanden en thumbnails blijven op het volume `videos`.

**Testing**: Vitest + Supertest tegen een echte MariaDB-testdatabase (backend), Vitest + Vue
Test Utils (frontend)

**Target Platform**: Linux-VPS met Docker Compose; moderne desktopbrowsers

**Project Type**: webapplicatie (frontend + backend)

**Performance Goals**: bibliotheek met 500 zichtbare video's binnen 2 s in beeld; zoeken,
sorteren en filteren binnen 1 s (SC-005); de bibliotheekquery blijft één query met indexen

**Constraints**: één VPS (constitution II); video- en thumbnailbytes via nginx (III); geen
polling (feature 001); een tus `Upload-Metadata`-header kan tot ca. 13 KB worden (beschrijving
van 1000 tekens + gekozen organisaties), dus header-limieten van nginx en Node gaan omhoog
(research R4)

**Scale/Scope**: tientallen organisaties, honderden video's; 3 nieuwe API-routes en 2
gewijzigde ([contracts/api.md](contracts/api.md)); 1 nieuw venster en 2 gewijzigde schermen
([contracts/ui.md](contracts/ui.md))

Er zijn geen open NEEDS CLARIFICATION-punten; alle keuzes staan in [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Toets | Status |
| --- | --- | --- |
| I. Vaste technologiestack | Vue 3, Express 5 (ES modules), MariaDB 11.8; geen nieuwe dependencies | ✅ |
| II. Docker op één VPS | Geen nieuwe services; alleen een extra `.env`-variabele en een nginx-instelling | ✅ |
| III. Video's via nginx, API alleen voor toegangscontrole | Thumbnails blijven via `X-Accel-Redirect`; de API controleert alleen of de video voor de organisatie beschikbaar is. Video's worden nog steeds niet afgespeeld | ✅ |
| IV. Geen geheimen in git | `VIDEO_DEFAULT_VISIBILITY` is geen geheim; komt in `.env.example` | ✅ |
| V. Zachte verwijdering | Video's blijven zacht verwijderd; `VideoAccess`-regels zijn een instelling bij een video, geen video of cursus, en worden bij het verlaten van "Selectief beschikbaar" verwijderd (FR-007). Verwijderde video's houden hun `VideoAccess`-regels | ✅ |
| VI. Taalconventies (v2.0.0) | Alle code Engels (routes, velden, foutcodes, logregels, commentaar); UI-teksten en `message` in Nederlands; documentatie Nederlands | ✅ |
| Bronnen en domeinregels | `VideoAccess` volgt het ERD letterlijk (`videoId`, `organisationId`, samen de sleutel); `Video` verandert niet. De standaardinstelling staat niet in de database, dus het ERD blijft gelijk | ✅ |
| Ontwikkelworkflow | specify → clarify → plan; werk op `Development` | ✅ |

**Na Phase 1 opnieuw getoetst**: geen schendingen. Een extra index op
`VideoAccess.organisationId` is een fysieke index, geen ERD-wijziging.

## Project Structure

### Documentation (this feature)

```text
specs/003-central-video-library/
├── plan.md              # Dit bestand
├── research.md          # Phase 0: technische keuzes
├── data-model.md        # Phase 1: VideoAccess, regels, zichtbaarheid
├── quickstart.md        # Phase 1: validatiegids
├── contracts/
│   ├── api.md           # Phase 1: nieuwe en gewijzigde endpoints
│   └── ui.md            # Phase 1: bibliotheek, uploadvenster, videovenster
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Alleen wat nieuw is of verandert ten opzichte van feature 002:

```text
.env.example                          # + VIDEO_DEFAULT_VISIBILITY
nginx/default.conf                    # large_client_header_buffers voor grote Upload-Metadata (R4)

backend/
├── scripts/
│   └── seed-videos.js                # + optioneel derde argument: beschikbaarheid (prestatietest)
├── src/
│   ├── server.js                     # http.createServer met maxHeaderSize 32 KB (R4)
│   ├── config/env.js                 # + VIDEO_DEFAULT_VISIBILITY (R3)
│   ├── db/migrations/
│   │   └── 20261023000001_create_video_access.js
│   ├── lib/
│   │   └── videoChoices.js           # controle van naam, beschrijving, beschikbaarheid, organisaties (R5)
│   └── modules/
│       ├── organisationDirectory/
│       │   └── organisationDirectoryRoutes.js   # GET /api/organisation/organisations (R10)
│       └── videos/
│           ├── videoRepository.js    # + zichtbaarheidsquery, details, wijzigen, VideoAccess (R1)
│           ├── videoService.js       # + details, wijzigen, keuzes bij afronden van de upload
│           ├── videoRoutes.js        # + GET/PATCH /videos/:id; lijst en thumbnail via zichtbaarheid
│           └── videoUploadGuard.js   # + controle van de keuzes in Upload-Metadata
└── tests/
    ├── unit/videoChoices.test.js
    └── integration/
        ├── videoVisibility.test.js   # matrix van drie organisaties × drie beschikbaarheden (SC-001)
        ├── videoEdit.test.js         # wijzigen, alleen eigenaar, beperken (SC-002, SC-003)
        └── videoUploadChoices.test.js

frontend/
├── src/
│   ├── api/videos.js                 # + getVideo, updateVideo, listOtherOrganisations
│   ├── lib/
│   │   ├── videoLibrary.js           # zoeken, sorteren, filteren (pure functies, R7)
│   │   └── videoAccess.js            # tekst en aantal "verliest toegang" (R6)
│   ├── stores/uploads.js             # + visibility, description, accessOrganisationIds in de metadata
│   ├── components/
│   │   ├── AvailabilityPicker.vue    # drie keuzes + organisatielijst (uploadvenster en videovenster)
│   │   ├── VideoDetailsDialog.vue    # videogegevens; voor de eigenaar ook wijzigen
│   │   └── UploadDialog.vue          # + beschikbaarheid en beschrijving per video
│   └── views/VideosView.vue          # + eigenaar, beschrijving, zoeken/sorteren/filteren, venster
└── tests/
    ├── videoLibrary.test.js
    └── videoAccess.test.js
```

**Structure Decision**: dezelfde webapplicatie-opzet als features 001 en 002. De videomodule
breidt uit; de lijst met organisatienamen krijgt een eigen kleine module
(`organisationDirectory`), omdat die later ook voor gedeelde cursussen bruikbaar is en
`organisationSelf` alleen over de eigen organisatie gaat.

## Complexity Tracking

Geen nieuwe schendingen. De uitzondering uit feature 002 (in ontwikkeling en tests stuurt de API
thumbnailbytes zelf) blijft ongewijzigd van toepassing.
