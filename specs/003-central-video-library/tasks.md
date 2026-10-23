---

description: "Takenlijst voor de feature Centrale videobibliotheek, beschikbaarheid en beschrijvingen"
---

# Tasks: Centrale videobibliotheek, beschikbaarheid en beschrijvingen

**Input**: Design documents from `/specs/003-central-video-library/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md),
[contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md)

**Tests**: zoals in features 001 en 002 (research R13): de toegangsregels zijn het grootste
risico, dus per story gerichte tests tegen een echte MariaDB. Schrijf ze vóór de implementatie
en controleer dat ze eerst falen.

**Organization**: taken zijn gegroepeerd per user story, zodat elke story los te bouwen en te
testen is.

**Conventies** (constitution VI, v2.0.0): alles in de code is Engels, ook commentaar, routes,
foutcodes, logregels en configuratiesleutels. Nederlands alleen voor teksten die de klant ziet:
UI-teksten en het veld `message` in API-foutresponses. Tabel- en veldnamen exact zoals in het
ERD (`Video`, `VideoAccess`, `videoId`, `organisationId`, `visibility`, `description`).

**Bestaande code**: feature 002 heeft de videomodule in `backend/src/modules/videos/`
(`videoRepository.js`, `videoService.js`, `videoRoutes.js`, `videoUploadGuard.js`,
`tusServer.js`), de testhelpers `backend/tests/helpers/testApp.js` (`createVideoRow`) en
`backend/tests/helpers/tus.js` (`createUpload`, `uploadFixture`, `encodeMetadata`), en in de
frontend `VideosView.vue`, `UploadDialog.vue`, `stores/uploads.js` en `api/videos.js`. Deze
feature breidt die uit; de bestaande tests van 002 moeten groen blijven (na de aanpassingen in
T011).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Paden zijn relatief aan de repository-root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: configuratie en headerlimieten

- [X] T001 [P] Voeg `VIDEO_DEFAULT_VISIBILITY` toe aan `.env.example` met Engels commentaar: "Default availability pre-selected in the upload dialog: public, selective or private (default private; an invalid value also means private)" (research R3)
- [X] T002 [P] Lees `VIDEO_DEFAULT_VISIBILITY` in `backend/src/config/env.js` als `config.VIDEO_DEFAULT_VISIBILITY`: toegestane waarden `public`, `selective`, `private`; ontbreekt → `private`; een ongeldige waarde → `private` plus `console.warn('VIDEO_DEFAULT_VISIBILITY "<value>" is invalid; using private')`, zonder de API te laten stoppen (research R3, FR-003); voeg ook `VIDEO_DESCRIPTION_MAX_LENGTH: 1000` toe als vaste waarde
- [X] T003 [P] Zet in `backend/src/server.js` de server op met `http.createServer({ maxHeaderSize: 32768 }, createApp())` in plaats van `createApp().listen(...)`, met behoud van `server.requestTimeout` en de opruimtaken, en Engels commentaar dat een tus `Upload-Metadata`-header met een beschrijving van 1000 tekens tot ca. 13 KB kan worden (research R4)
- [X] T004 [P] Voeg in `nginx/default.conf` in het HTTPS-`server`-blok `large_client_header_buffers 4 32k;` toe, met Engels commentaar met dezelfde reden (research R4)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: tabel, één toegangsregel, gedeelde controles en de lijst met organisatienamen die alle stories nodig hebben

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational

- [X] T005 [P] Unittests in `backend/tests/unit/videoChoices.test.js` voor `backend/src/lib/videoChoices.js`: `normalizeDescription`: `null`, `""` en `"   "` → `null`; `"  tekst \r\n regel 2 "` → `"tekst \n regel 2"`; precies 1000 tekens (ook met emoji, geteld als codepunten via `[...text].length`) is goed, 1001 geeft `fields.description` "De beschrijving mag maximaal 1000 tekens zijn."; `validateName`: `"  "` → "Vul een naam in.", 256 tekens → "De naam mag maximaal 255 tekens lang zijn."; `validateVisibility`: alleen `public`, `selective`, `private`, anders "Kies een beschikbaarheid."; `parseOrganisationIds`: `"4,9"` en `[4, 9]` → `[4, 9]`, dubbele id's worden samengevoegd, niet-gehele waarden geven "Kies alleen organisaties uit de lijst."
- [X] T006 [P] Integratietests in `backend/tests/integration/organisationDirectory.test.js`: `GET /api/organisation/organisations` als organisatie A met organisaties A, B, C en een verwijderde D → `{ organisations: [B, C] }` op naam gesorteerd, elk precies `{ id, name }` (geen `loginCode`, `questLinkCode` of andere velden); zonder sessie `401`; als beheerder `403`

### Implementation for Foundational

- [X] T007 Maak migratie `backend/src/db/migrations/20261023000001_create_video_access.js` voor tabel `VideoAccess`: `videoId` INT UNSIGNED NOT NULL FK → `Video.id`; `organisationId` INT UNSIGNED NOT NULL FK → `Organisation.id`; primaire sleutel (`videoId`, `organisationId`); index op `organisationId`; Engels commentaar dat de tabel het ERD volgt en alleen regels bevat voor video's met `visibility = 'selective'` (data-model.md); `down` verwijdert de tabel. `Video` niet wijzigen
- [X] T008 [P] Maak `backend/src/lib/videoChoices.js` met de gedeelde regels uit research R5: `validateName(raw, { required })` (getrimd, 1–255 tekens), `normalizeDescription(raw)` (getrimd, `\r\n` → `\n`, leeg of alleen witruimte → `null`, "maximaal 1000 tekens" geteld als codepunten), `validateVisibility(raw)` (`public` | `selective` | `private`), `parseOrganisationIds(raw)` (komma-gescheiden string of array → unieke positieve gehele getallen) en `async validateAccessOrganisations(ids, ownerOrganisationId, trx?)`: bij een lege lijst `fields.accessOrganisationIds` "Kies minstens één organisatie, of kies ‘Alleen eigen organisatie’."; bij id's die geen actieve organisatie zijn of gelijk aan de eigenaar "Kies alleen organisaties uit de lijst."; geeft de gecontroleerde id's terug. Alle fouten via `validationError(fields)` uit `backend/src/lib/errors.js`
- [X] T009 Breid `backend/src/modules/videos/videoRepository.js` uit met `visibleVideosQuery(organisationId)` volgens research R1 en data-model.md § Zichtbaarheid: `Video v JOIN Organisation o ON o.id = v.ownerOrganisationId LEFT JOIN VideoAccess a ON a.videoId = v.id AND a.organisationId = ?`, waar `v.deletedAt IS NULL`, `o.deletedAt IS NULL` en (`v.ownerOrganisationId = ?` OF `v.visibility = 'public'` OF (`v.visibility = 'selective'` EN `a.videoId IS NOT NULL`)); kolommen `v.id`, `v.name`, `v.description`, `v.durationSeconds`, `v.fileSizeBytes`, `v.uploadedAt`, `v.visibility`, `v.ownerOrganisationId`, `v.thumbnailStorageKey`, `o.name as ownerName`. Daarop: `listVisible(organisationId)` (nieuwste eerst, dan `id` aflopend) en `findVisible(id, organisationId)`. Vervang `listActiveForOrganisation` en `findActiveOwn` door deze functies en pas de aanroepers aan
- [X] T010 Pas `toVideoDto(row, organisationId)` in `backend/src/modules/videos/videoService.js` aan naar het formaat uit contracts/api.md § Gemeenschappelijk: plus `description` (`null` als leeg) en `owner: { id, name, isOwn }`; `visibility` **alleen** als `isOwn` (FR-006). Laat `listVideos` `listVisible` gebruiken en `getThumbnailKey` `findVisible` (FR-008, FR-013, research R8)
- [X] T011 Werk de bestaande tests van feature 002 bij voor het nieuwe antwoordformaat: de `toEqual`-verwachtingen in `backend/tests/integration/videoLibrary.test.js` krijgen `description: null`, `owner: { id, name, isOwn: true }` en `visibility: 'private'`; voeg aan `createVideoRow` in `backend/tests/helpers/testApp.js` de opties `visibility = 'private'`, `description = null` en `accessOrganisationIds = []` toe (die laatste schrijft `VideoAccess`-regels); controleer dat `videoDelete.test.js`, `videoUpload.test.js` en `videoResume.test.js` groen blijven
- [X] T012 [P] Maak `backend/src/modules/organisationDirectory/organisationDirectoryRoutes.js` met `GET /organisations` → `{ organisations: [{ id, name }] }`: actieve organisaties (`deletedAt IS NULL`) behalve `getOrganisationId(req)`, op naam gesorteerd, alleen `id` en `name` (FR-004, research R10); koppel de router in `backend/src/app.js` onder `/api/organisation` achter `requireOrganisation`
- [X] T013 Voeg aan `GET /api/organisation/videos/upload-settings` in `backend/src/modules/videos/videoRoutes.js` `defaultVisibility: config.VIDEO_DEFAULT_VISIBILITY` en `descriptionMaxLength: 1000` toe (contracts/api.md)
- [X] T014 [P] Voeg aan `frontend/src/api/videos.js` toe: `getVideo(id)` (`GET /api/organisation/videos/:id`), `updateVideo(id, changes)` (`PATCH`) en `listOtherOrganisations()` (`GET /api/organisation/organisations`, geeft de array terug)
- [X] T015 [P] Maak `frontend/src/lib/textLength.js` met `characterCount(text)` (`[...(text ?? '')].length`, zoals de server telt, research R5) en `limitCharacters(text, max)` (knipt af op `max` codepunten); unittest in `frontend/tests/text-length.test.js`: "abc" → 3, een emoji telt als 1, `limitCharacters` op 1000 met emoji's laat precies 1000 codepunten over

**Checkpoint**: migratie draait, `GET /videos` geeft het nieuwe formaat via de toegangsregel, de tests van 002 zijn groen, T005 en T006 slagen

---

## Phase 3: User Story 1 - Beschikbaarheid kiezen bij het uploaden (Priority: P1) 🎯 MVP

**Goal**: per video bij het uploaden "Algemeen", "Selectief" (met organisaties) of "Alleen eigen organisatie" kiezen, met de standaard uit `.env` voorgeselecteerd; andere organisaties zien de video volgens die keuze

**Independent Test**: als A drie video's uploaden met elk een andere beschikbaarheid (Selectief voor B); als B en C de bibliotheek openen en precies de juiste video's zien (quickstart scenario's 1–5)

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T016 [US1] Breid `createUpload` en `uploadFixture` in `backend/tests/helpers/tus.js` uit met de opties `visibility`, `description` en `accessOrganisationIds` (komma-gescheiden in de metadata); nodig voor de uploadtests hieronder
- [X] T017 [P] [US1] Integratietests in `backend/tests/integration/videoUploadChoices.test.js` (met `uploadFixture`/`createUpload` uit `backend/tests/helpers/tus.js`, die metadata `visibility`, `description` en `accessOrganisationIds` moeten kunnen meesturen): upload met `visibility=public` → video `public` zonder `VideoAccess`; `selective` met B → video `selective` met één regel (video, B); zonder `visibility` → `config.VIDEO_DEFAULT_VISIBILITY`; `selective` zonder organisaties, met de eigen organisatie, met een onbekend id, of `visibility=onzin` → `400 validation_failed` met het juiste veld in `fields`, vóór het eerste deel, en geen bestand in `incoming`; een gekozen organisatie die tijdens de upload wordt verwijderd (`deletedAt` zetten vóór het laatste deel) → video `private` zonder `VideoAccess`-regels (research R4); een metadata-header van ca. 12 KB (beschrijving van 1000 tekens met meerbyte-tekens + 50 organisatie-id's) wordt geaccepteerd
- [X] T018 [P] [US1] Integratietests in `backend/tests/integration/videoVisibility.test.js`: organisaties A, B, C; A heeft een `public`-, een `selective`-video (voor B) en een `private`-video (via `createVideoRow`); controleer voor A, B en C dat `GET /api/organisation/videos` precies de verwachte video's geeft (A: 3, B: 2, C: 1, SC-001), dat `owner` klopt (`isOwn` alleen bij A), dat `visibility` alleen bij A in het antwoord staat, en dat een verwijderde eigenaar (A `deletedAt`) de video's voor B en C laat verdwijnen (FR-010); een zacht verwijderde video staat bij niemand
- [X] T019 [P] [US1] Frontend-test in `frontend/tests/upload-dialog.test.js` (uitbreiden): het uploadvenster toont per bestand de drie beschikbaarheidskeuzes met `defaultVisibility` uit de instellingen voorgeselecteerd; bij "Selectief beschikbaar" zonder vinkje staat "Uploaden" uit met de melding "Kies minstens één organisatie, of kies ‘Alleen eigen organisatie’."; zonder andere organisaties is "Selectief beschikbaar" uitgeschakeld met "Er zijn nog geen andere organisaties."; `submit` geeft per bestand `visibility` en `accessOrganisationIds` mee
- [X] T020 [P] [US1] Frontend-test in `frontend/tests/uploads-store.test.js` (uitbreiden): `addFiles([{ file, name, description, visibility, accessOrganisationIds }])` stuurt in de tus-metadata `visibility`, `description` (weggelaten als leeg) en `accessOrganisationIds` als komma-gescheiden string (alleen bij `selective`)

### Implementation for User Story 1

- [X] T021 [US1] Controleer in `guardCreate` in `backend/src/modules/videos/videoUploadGuard.js` de metadata `visibility` (ontbreekt → `config.VIDEO_DEFAULT_VISIBILITY`), `description` en `accessOrganisationIds` met `backend/src/lib/videoChoices.js`, vóór de controle op schijfruimte; bij een fout `400 validation_failed` met `fields` (contracts/api.md, research R4). Bewaar niets extra's: tus bewaart de metadata zelf
- [X] T022 [US1] Pas `finaliseUpload` in `backend/src/modules/videos/videoService.js` aan: lees `visibility`, `description` en `accessOrganisationIds` uit `upload.metadata`; controleer ze opnieuw; laat id's van inmiddels verwijderde organisaties vallen en sla bij `selective` zonder overgebleven organisatie op als `private` (research R4); voeg in één `db.transaction` de `Video`-rij (met `description` via `normalizeDescription` en de gekozen `visibility`) en de `VideoAccess`-regels in. Pas `insertVideo` in `backend/src/modules/videos/videoRepository.js` aan zodat hij een transactie accepteert, en voeg `replaceAccess(trx, videoId, organisationIds)` toe (verwijdert alle regels van de video, voegt de nieuwe in)
- [X] T023 [P] [US1] Maak `frontend/src/components/AvailabilityPicker.vue` volgens contracts/ui.md § Beschikbaarheid kiezen: props `modelValue` (`{ visibility, accessOrganisationIds }`) en `organisations` (`[{ id, name }]`), emit `update:modelValue`; drie keuzerondjes met de uitlegteksten; bij "Selectief beschikbaar" vinkjes met organisatienamen (alfabetisch), met een zoekveldje als er meer dan 10 organisaties zijn; zonder vinkje de melding "Kies minstens één organisatie, of kies ‘Alleen eigen organisatie’."; zonder organisaties is "Selectief beschikbaar" uitgeschakeld met "Er zijn nog geen andere organisaties."; exporteer ook `isAvailabilityValid(value)`
- [X] T024 [US1] Breid `frontend/src/components/UploadDialog.vue` uit: haal bij openen één keer `listOtherOrganisations()` op; per bestand een `AvailabilityPicker` met `settings.defaultVisibility` als beginwaarde (`selective` als standaard start zonder gekozen organisaties); "Uploaden" staat ook uit als een bestand een ongeldige beschikbaarheid heeft; `submit` geeft per bestand `{ file, name, visibility, accessOrganisationIds }` door (contracts/ui.md § Uploadvenster)
- [X] T025 [US1] Breid `addFiles` en `start` in `frontend/src/stores/uploads.js` uit: bewaar per item `visibility`, `description` en `accessOrganisationIds` en stuur ze in de tus-metadata (`accessOrganisationIds` als komma-gescheiden string, alleen bij `selective`; lege velden weglaten); `startUploads` in `frontend/src/views/VideosView.vue` geeft de velden door. Een `400 validation_failed` op het aanmaken toont de `message` van het eerste veld in `fields` als weigering in de uploadindicator

**Checkpoint**: User Story 1 werkt zelfstandig: uploaden met elke beschikbaarheid, en B en C zien de juiste video's (met de lijst uit Phase 2)

---

## Phase 4: User Story 2 - De centrale bibliotheek bekijken (Priority: P1)

**Goal**: eigen en beschikbare video's samen in één lijst, met de eigenaar zichtbaar; een videovenster met de gegevens; video's van anderen alleen bekijken

**Independent Test**: A en B hebben elk een video die voor de ander beschikbaar is; als A beide zien, de video van B met "Van <B>" en zonder knoppen; in het venster alle gegevens; een niet-beschikbare video en thumbnail geven `404` (quickstart scenario's 4–6)

### Tests for User Story 2

- [X] T026 [P] [US2] Breid `backend/tests/integration/videoVisibility.test.js` uit voor `GET /api/organisation/videos/:id` en `GET /api/organisation/videos/:id/thumbnail` voor elke combinatie van A, B, C × `public`, `selective`, `private`: zichtbaar → `200` (thumbnail met `image/jpeg`), niet zichtbaar → `404 not_found`, zelfde antwoord als voor een onbekend id (FR-013); bij `GET /:id` als A van een `selective`-video ook `accessOrganisations: [{ id, name }]` (alleen actieve organisaties, op naam), als B zonder `visibility` en `accessOrganisations` (FR-006); een `selective`-video van A waarvan de enige gekozen organisatie B is verwijderd (`deletedAt`): `GET /:id` als A geeft `accessOrganisations: []` en `visibility: 'selective'`, en B en C krijgen `404`
- [X] T027 [P] [US2] Breid `backend/tests/integration/videoDelete.test.js` uit: B verwijdert de `public`-video van A → `403 not_owner` met de melding "Alleen de organisatie die deze video heeft geüpload, kan hem wijzigen of verwijderen." en de video blijft; C verwijdert de `selective`-video van A (niet voor C) → `404`; A verwijdert → `204` en de video verdwijnt bij B en C (FR-014, FR-018)
- [X] T028 [P] [US2] Frontend-test in `frontend/tests/video-details-dialog.test.js`: `VideoDetailsDialog` toont voor een video van een ander naam, beschrijving (regels bewaard), duur, grootte, datum en "Van <naam>", en alleen de knop "Sluiten"; voor een eigen video ook de beschikbaarheidstekst ("Selectief beschikbaar: <namen>") en de knoppen "Wijzigen" en "Verwijderen"; voor een eigen `selective`-video met `accessOrganisations: []` de tekst "Selectief beschikbaar: geen organisaties meer gekozen. Alleen jouw organisatie ziet deze video."; bij `404` "Deze video is niet meer beschikbaar." en een `changed`-event
- [X] T029 [P] [US2] Frontend-test in `frontend/tests/videos-view.test.js` (uitbreiden): per video het label "Eigen video" of "Van <naam>"; "Verwijderen" alleen bij eigen video's; klikken op een video opent het videovenster; na sluiten is de lijst ongewijzigd

### Implementation for User Story 2

- [X] T030 [US2] Voeg `getVideoDetails(id, organisationId)` toe aan `backend/src/modules/videos/videoService.js`: `findVisible` → anders `404`; `toVideoDto` plus, voor de eigenaar bij `selective`, `accessOrganisations` (actieve organisaties uit `VideoAccess`, op naam; research R11, R12). Voeg in `backend/src/modules/videos/videoRepository.js` `listAccessOrganisations(videoId)` toe
- [X] T031 [US2] Voeg `GET /videos/:id` toe aan `backend/src/modules/videos/videoRoutes.js` (na `/videos/upload-settings`, met `videoId(req)`), en pas `deleteVideo` in `videoService.js` aan naar de volgorde uit research R9: niet zichtbaar → `404 not_found`; zichtbaar maar niet de eigenaar → `403 not_owner` met "Alleen de organisatie die deze video heeft geüpload, kan hem wijzigen of verwijderen."; anders zacht verwijderen (`softDeleteOwn`)
- [X] T032 [P] [US2] Maak `frontend/src/components/VideoDetailsDialog.vue` (met `Modal.vue`) volgens contracts/ui.md § Videovenster, bekijkmodus: prop `videoId`; laadt `getVideo(id)`; grote thumbnail, naam, beschrijving met `white-space: pre-line` (nooit `v-html`), duur `uu:mm:ss`, grootte, uploaddatum (helpers uit `frontend/src/lib/format.js`), eigenaar; voor de eigenaar de beschikbaarheid ("Algemeen beschikbaar", "Selectief beschikbaar: <namen>", bij een lege lijst "Selectief beschikbaar: geen organisaties meer gekozen. Alleen jouw organisatie ziet deze video.", of "Alleen eigen organisatie") en de knoppen "Wijzigen" (voorlopig uitgeschakeld tot US3) en "Verwijderen"; sluiten via "Sluiten", Escape of klik naast het venster; bij `404` de melding "Deze video is niet meer beschikbaar." en emit `changed`
- [X] T033 [US2] Pas `frontend/src/views/VideosView.vue` aan: per video het label "Eigen video" of "Van <organisatienaam>" en bij eigen video's een klein label "Algemeen", "Selectief" of "Alleen eigen organisatie"; "Verwijderen" alleen bij eigen video's; klikken op een video opent `VideoDetailsDialog` boven de lijst (de lijst blijft gemount, zodat scrollpositie en state blijven, FR-012); na `changed` of verwijderen uit het venster de bibliotheek opnieuw laden; thumbnails met `loading="lazy"`

**Checkpoint**: User Stories 1 en 2 werken: delen bij het uploaden en de gedeelde bibliotheek bekijken

---

## Phase 5: User Story 3 - Een eigen video wijzigen (Priority: P2)

**Goal**: de eigenaar wijzigt naam, beschrijving en beschikbaarheid in het videovenster; bij beperken eerst een bevestiging met het aantal organisaties dat toegang verliest

**Independent Test**: als A een algemene video naar "Selectief" voor B zetten (met bevestiging), daarna ziet C hem niet meer en B wel; naam en beschrijving wijzigen en zien dat B de nieuwe gegevens ziet (quickstart scenario's 7–10)

### Tests for User Story 3

- [X] T034 [P] [US3] Integratietests in `backend/tests/integration/videoEdit.test.js`: `PATCH /api/organisation/videos/:id` als A: naam wijzigen (B ziet de nieuwe naam); beschrijving wijzigen en met `null` of `""` leegmaken; `public` → `selective` voor B: C krijgt daarna bij `GET /videos`, `GET /videos/:id` en de thumbnail niets meer of `404`, B wel (SC-003); `selective` → `private`: alle `VideoAccess`-regels van de video weg (FR-007); `selective` met B en C → alleen B: C verliest toegang; lege body → `400`; `selective` zonder organisaties, met de eigen organisatie of een onbekend id → `400` met `fields.accessOrganisationIds`; naam `"  "` → `400` "Vul een naam in."; beschrijving van 1001 tekens → `400`; als B op een zichtbare video van A → `403 not_owner` en de video is ongewijzigd; als C op een niet-zichtbare → `404`; het antwoord heeft het formaat van `GET /videos/:id`
- [X] T035 [P] [US3] Frontend-unittests in `frontend/tests/video-access.test.js` voor `frontend/src/lib/videoAccess.js`: `countLosingAccess(current, next, allOrganisationIds)`: `public` → `selective` [B] met 4 andere organisaties = 3; `public` → `private` = 4; `selective` [B, C] → `selective` [B] = 1; `selective` → `public` = 0; `private` → iets = 0; `confirmationText(1)` = "1 organisatie kan deze video daarna niet meer zien.", `confirmationText(3)` = "3 organisaties kunnen deze video daarna niet meer zien."
- [X] T036 [P] [US3] Breid `frontend/tests/video-details-dialog.test.js` uit: "Wijzigen" toont het formulier met naam, beschrijving en `AvailabilityPicker`; bij beperken eerst `confirmDialog` met de tekst uit `confirmationText`, bij "Annuleren" geen `PATCH` en het formulier blijft open; bij ruimer maken geen bevestiging; veldfouten uit `fields` onder het juiste veld; na opslaan "Wijzigingen opgeslagen" en een `changed`-event

### Implementation for User Story 3

- [X] T037 [US3] Voeg `updateVideo(id, organisationId, body)` toe aan `backend/src/modules/videos/videoService.js` volgens research R9 en contracts/api.md: zichtbaarheid (`404`) → eigenaar (`403 not_owner`) → minstens één veld (`400`) → controles met `backend/src/lib/videoChoices.js` (`name` 1–255, `description` "maximaal 1000 tekens", `visibility`, `accessOrganisationIds` verplicht en niet leeg bij `selective`); in één transactie `Video` bijwerken en `replaceAccess` bij `selective` of alle `VideoAccess`-regels van de video verwijderen bij `public`/`private` (FR-007); geeft `getVideoDetails` terug. Voeg in `backend/src/modules/videos/videoRepository.js` `updateVideoFields(trx, id, changes)` en `deleteAccess(trx, videoId)` toe
- [X] T038 [US3] Voeg `PATCH /videos/:id` toe aan `backend/src/modules/videos/videoRoutes.js` (alleen `name`, `description`, `visibility`, `accessOrganisationIds` uit de body; nooit een eigenaar of organisatie-id voor de video zelf)
- [X] T039 [P] [US3] Maak `frontend/src/lib/videoAccess.js` met `audience(value, allOrganisationIds)` (`public` → alle andere actieve organisaties, `selective` → de gekozen, `private` → leeg), `countLosingAccess(current, next, allOrganisationIds)` en `confirmationText(count)` (research R6, FR-017a)
- [X] T040 [US3] Voeg de wijzigmodus toe aan `frontend/src/components/VideoDetailsDialog.vue` (contracts/ui.md § Wijzigen): "Wijzigen" toont velden Naam (max. 255), Beschrijving (teller "nog N tekens" en afkappen via `characterCount` en `limitCharacters` uit `frontend/src/lib/textLength.js`, zoals in het uploadvenster; geen `maxlength`) en `AvailabilityPicker` (organisaties via `listOtherOrganisations()`), knoppen "Opslaan" en "Annuleren"; vóór opslaan `countLosingAccess`, en bij > 0 `confirmDialog({ title: 'Beschikbaarheid beperken?', body: confirmationText(n), confirmLabel: 'Wijzigen' })`; daarna `updateVideo`; veldfouten onder het juiste veld; na succes `toast('Wijzigingen opgeslagen')`, terug naar de bekijkmodus en emit `changed`

**Checkpoint**: User Stories 1–3 werken; de eigenaar kan alles achteraf wijzigen

---

## Phase 6: User Story 4 - Een beschrijving toevoegen (Priority: P2)

**Goal**: optionele beschrijving bij het uploaden, ingekort in de bibliotheek en volledig in het videovenster

**Independent Test**: een video met en een zonder beschrijving uploaden; de beschrijving staat ingekort in de lijst en volledig (met regels) in het venster; zonder beschrijving geen lege regel (quickstart scenario's 10–11)

### Tests for User Story 4

- [X] T041 [P] [US4] Breid `backend/tests/integration/videoUploadChoices.test.js` uit: upload met `description` "Regel 1\r\nRegel 2" → opgeslagen als "Regel 1\nRegel 2"; `"   "` → `null`; 1001 tekens → `400` met `fields.description` "De beschrijving mag maximaal 1000 tekens zijn." vóór het eerste deel
- [X] T042 [P] [US4] Breid `frontend/tests/upload-dialog.test.js` en `frontend/tests/videos-view.test.js` uit: het uploadvenster heeft per bestand een veld Beschrijving met de teller "nog 1000 tekens"; plakken van 1001 tekens (waarvan één emoji) laat precies 1000 tekens staan en de teller op "nog 0 tekens"; het venster geeft de beschrijving mee bij `submit`; in de bibliotheek staat een beschrijving ingekort (element met de klasse voor twee regels) en een video zonder beschrijving heeft geen beschrijvingselement

### Implementation for User Story 4

- [X] T043 [US4] Voeg in `frontend/src/components/UploadDialog.vue` per bestand het optionele veld "Beschrijving" toe (textarea, meerdere regels); de teller "nog N tekens" gebruikt `characterCount` uit `frontend/src/lib/textLength.js` met `settings.descriptionMaxLength`, en bij elke invoer kapt `limitCharacters` de tekst af op dat maximum, zodat er niet meer in past dan de server accepteert (geen `maxlength`, dat telt anders); geef `description` mee bij `submit` (FR-021)
- [X] T044 [US4] Toon in `frontend/src/views/VideosView.vue` de beschrijving onder de naam, ingekort tot twee regels met CSS (`-webkit-line-clamp: 2`, `white-space: pre-line`); zonder beschrijving geen element (FR-022)

**Checkpoint**: beschrijvingen werken bij uploaden, in de lijst en in het venster

---

## Phase 7: User Story 5 - Zoeken, sorteren en filteren (Priority: P2)

**Goal**: in één lijst met honderden video's zoeken op naam, beschrijving en eigenaar, sorteren en filteren, direct in de browser

**Independent Test**: bibliotheek met honderden video's van meerdere organisaties; zoeken op een woord uit een beschrijving en op een organisatienaam, sorteren op duur, filteren op "Van andere organisaties" (quickstart scenario's 12–15 en § Prestaties)

### Tests for User Story 5

- [X] T045 [P] [US5] Frontend-unittests in `frontend/tests/video-library.test.js` voor `frontend/src/lib/videoLibrary.js`: zoeken op naam, beschrijving en `owner.name`; hoofdletters en accenten maken niet uit ("cafe" vindt "Café", "ZWEMBAD a" vindt "Zwembad A"); een deel van een woord ("dieps" vindt "diepste"); filter `all`/`own`/`others` op `owner.isOwn`; sorteren op `uploadedAt`, `name` (Nederlandse volgorde via `Intl.Collator('nl')`), `durationSeconds` en `fileSizeBytes` in beide richtingen, bij gelijke waarden op `id`; zoeken, filter en sortering samen; 500 video's filteren en sorteren duurt minder dan 50 ms
- [X] T046 [P] [US5] Breid `frontend/tests/videos-view.test.js` uit: werkbalk met zoekveld (placeholder "Zoeken op naam, beschrijving of organisatie"), filterknoppen "Alle video's", "Eigen video's", "Van andere organisaties" en de sorteerlijst met de acht keuzes uit contracts/ui.md; standaard "Nieuwste eerst" en "Alle video's"; zonder resultaat "Geen video's gevonden" met "Zoekterm en filter wissen", die alles terugzet; zoeken doet geen API-verzoek; na openen en sluiten van het videovenster blijven zoekterm, filter en sortering staan

### Implementation for User Story 5

- [X] T047 [P] [US5] Maak `frontend/src/lib/videoLibrary.js` met `normalizeForSearch(text)` (NFD, accenten weg, kleine letters), `filterVideos(videos, { query, ownership })` en `sortVideos(videos, { field, direction })` (research R7); `SORT_OPTIONS` met de acht keuzes en hun Nederlandse labels uit contracts/ui.md
- [X] T048 [US5] Voeg aan `frontend/src/views/VideosView.vue` de werkbalk toe (zoekveld, filterknoppen, sorteerlijst) met state in de view; toon `sortVideos(filterVideos(videos, …), …)` als `computed`; de lege toestand "Geen video's gevonden" met de knop "Zoekterm en filter wissen" (FR-026); de bestaande lege-bibliotheekmelding van 002 alleen als er helemaal geen video's zijn

**Checkpoint**: alle user stories werken zelfstandig

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: documentatie, hulpscripts, controles

- [X] T049 [P] Voeg aan `backend/scripts/seed-videos.js` een optioneel derde argument toe: de beschikbaarheid (`public`, `selective` of `private`, standaard `private`; `selective` wordt geweigerd met een Engelse melding, omdat er dan organisaties nodig zijn), en werk de gebruiksregel bovenaan bij
- [X] T050 [P] Werk `README.md` in de root bij (Nederlands): `VIDEO_DEFAULT_VISIBILITY` in de tabel met video-instellingen; de beschikbaarheden en beschrijving kort uitgelegd; het seed-commando wordt `docker compose exec -e NODE_ENV=development api node scripts/seed-videos.js <organisatiecode> 200 [public|private]` (zonder `-e NODE_ENV=development` weigert het script in de productiecontainer)
- [X] T051 [P] Controleer dat het ERD `docs/Diagrams.simp` `VideoAccess` (`videoId`, `organisationId`, samen de sleutel) en de `Video`-velden `description` en `visibility` bevat zoals in de migraties; er zijn geen ERD-wijzigingen nodig (plan.md § Constitution Check). Noteer een afwijking als die er toch is
- [X] T052 Draai `npm run lint` en `npm test` in `backend/` (met de testdatabase) en `frontend/`, en los alle meldingen op; controleer dat namen, routes, foutcodes, logregels en commentaar Engels zijn en dat Nederlands alleen in UI-teksten en `message` staat (constitution VI)
- [X] T053 Beveiligingscontrole: geen route onder `/api/organisation` neemt een eigenaar- of organisatie-id voor de video uit de invoer; `GET /api/organisation/organisations` geeft alleen `id` en `name`; `visibility` en `accessOrganisations` staan alleen in antwoorden voor de eigenaar; de beheeromgeving (`/api/admin`, `frontend/src/views/admin/`) heeft geen videofuncties (FR-027, SC-007); beschrijvingen worden nergens als HTML gerenderd
- [ ] T054 Voer alle scenario's uit [quickstart.md](quickstart.md) uit (1–19 en § Prestaties met 500 video's) plus `docker compose --profile test run --rm --build api-test` en `docker compose run --rm --build web-build npm test`, en noteer afwijkingen

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: geen afhankelijkheden
- **Foundational (Phase 2)**: na Setup; blokkeert alle user stories
- **User Stories (Phase 3–7)**: na Foundational
- **Polish (Phase 8)**: na de gewenste user stories (T049–T051 kunnen al eerder)

### User Story Dependencies

- **US1 (P1)**: alleen Foundational (de lijst via de toegangsregel staat al in Phase 2)
- **US2 (P1)**: alleen Foundational; voor de handmatige test zijn gedeelde video's nodig (via US1 of `createVideoRow` in de tests)
- **US3 (P2)**: na US2 (wijzigmodus in `VideoDetailsDialog.vue`) en US1 (`AvailabilityPicker.vue`, `replaceAccess`)
- **US4 (P2)**: backend-deel al in US1 (metadata, `normalizeDescription`); frontend raakt `UploadDialog.vue` (na US1) en `VideosView.vue` (na US2)
- **US5 (P2)**: alleen Foundational voor `videoLibrary.js`; T048 raakt `VideosView.vue` en komt na T033 en T044
- `VideosView.vue` wordt in T025, T033, T044 en T048 gewijzigd en `UploadDialog.vue` in T024 en T043: die taken na elkaar uitvoeren

### Within Each User Story

- Tests eerst schrijven en laten falen
- Migratie → repository → service → routes → frontend-component → view
- Story afronden en valideren vóór de volgende prioriteit

### Parallel Opportunities

- Setup: T001–T004 allemaal parallel
- Foundational: T005, T006, T008, T012, T014, T015 parallel; T009 → T010 → T011 na elkaar (zelfde module)
- US1: eerst T016 (testhelper); daarna T017–T020 parallel; T023 parallel met T021–T022
- US2: T026–T029 parallel; T032 parallel met T030–T031
- US3: T034–T036 parallel; T039 parallel met T037–T038
- US5: T045 en T047 kunnen parallel met US3 en US4 (eigen bestand)

---

## Parallel Example: Foundational

```bash
Task: "Unittests videoChoices in backend/tests/unit/videoChoices.test.js"
Task: "Integratietests organisatielijst in backend/tests/integration/organisationDirectory.test.js"
Task: "backend/src/lib/videoChoices.js"
Task: "backend/src/modules/organisationDirectory/organisationDirectoryRoutes.js"
Task: "frontend/src/api/videos.js: getVideo, updateVideo, listOtherOrganisations"
```

## Parallel Example: User Story 1

```bash
# Tests tegelijk:
Task: "Uploadkeuzes in backend/tests/integration/videoUploadChoices.test.js"
Task: "Zichtbaarheidsmatrix in backend/tests/integration/videoVisibility.test.js"
Task: "Uploadvenster in frontend/tests/upload-dialog.test.js"
Task: "Uploads-store in frontend/tests/uploads-store.test.js"

# Daarna tegelijk met de backendtaken:
Task: "frontend/src/components/AvailabilityPicker.vue"
```

## Parallel Example: User Story 3

```bash
Task: "Wijzigen in backend/tests/integration/videoEdit.test.js"
Task: "Aantal dat toegang verliest in frontend/tests/video-access.test.js"
Task: "frontend/src/lib/videoAccess.js"
```

---

## Implementation Strategy

### MVP First (User Stories 1 en 2)

1. Phase 1 Setup en Phase 2 Foundational afronden
2. US1: beschikbaarheid kiezen bij uploaden → valideren met drie organisaties
3. US2: gedeelde bibliotheek met eigenaar en videovenster → valideren
4. **STOP**: dit is FR-14 in de kern; video's zijn te delen en te vinden

### Incremental Delivery

1. Setup + Foundational
2. US1 → US2 (MVP)
3. US3 (achteraf wijzigen, met bevestiging bij beperken)
4. US4 (beschrijving in de interface)
5. US5 (zoeken, sorteren, filteren)
6. Polish

---

## Notes

- [P] = verschillende bestanden, geen afhankelijkheid van onafgemaakte taken
- Commit na elke taak of logische groep op `Development`
- Eén toegangsregel (`visibleVideosQuery`) voor lijst, details, thumbnail, wijzigen en verwijderen; nergens een eigen controle bouwen (research R1)
- `VideoAccess`-regels verdwijnen alleen bij een wijziging van de beschikbaarheid; zacht verwijderde video's houden ze (constitution V)
- Video's van anderen zijn niet aan cursussen toe te voegen (FR-019): de video-kiezer in de cursus-editor gebruikt nog prototypevideo's en verandert niet
- Geen polling: wijzigingen van andere organisaties verschijnen bij het volgende laden
