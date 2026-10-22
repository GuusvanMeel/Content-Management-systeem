---

description: "Takenlijst voor de feature 360°-videobibliotheek (eigen organisatie)"
---

# Tasks: 360°-videobibliotheek (eigen organisatie)

**Input**: Design documents from `/specs/002-video-library/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md),
[contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md)

**Tests**: het plan en de opdracht vragen om backendtests tegen `db-test` met geldige en
ongeldige testvideo's (research R12). Per user story zijn daarom testtaken opgenomen; schrijf ze
vóór de implementatie en controleer dat ze eerst falen.

**Organization**: taken zijn gegroepeerd per user story, zodat elke story los te bouwen en te
testen is.

**Conventies** (constitution v2.0.0, principe VI): alles in de code Engels (namen, commentaar,
foutcodes, logregels, configuratiesleutels); alleen voor de klant zichtbare teksten (UI en het
veld `message` in API-fouten) Nederlands, letterlijk zoals in [contracts/api.md](contracts/api.md)
en [contracts/ui.md](contracts/ui.md). Tabel- en veldnamen exact zoals in
[data-model.md](data-model.md). Bestaande patronen uit feature 001 volgen (bijv.
`backend/src/jobs/sessionCleanup.js`, `backend/src/modules/style/`,
`backend/tests/helpers/testApp.js`).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)
- Paden zijn relatief aan de repository-root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependencies, ffmpeg, volume, nginx, testvideo's

- [X] T001 [P] Voeg `@tus/server` en `@tus/file-store` (beide 2.x) toe aan `backend/package.json` met `npm install` zodat `backend/package-lock.json` meekomt
- [X] T002 [P] Voeg `tus-js-client` (4.x) toe aan `frontend/package.json` met `npm install` zodat `frontend/package-lock.json` meekomt
- [X] T003 [P] Voeg in `backend/Dockerfile` in de stage `base` `RUN apk add --no-cache ffmpeg` toe, zodat zowel de `test`- als de `prod`-image `ffprobe` en `ffmpeg` hebben (research R4)
- [X] T004 Werk `docker-compose.yml` bij: nieuw volume `videos`; service `api` krijgt `VIDEOS_DIR: /data/videos` en `videos:/data/videos`; service `web` krijgt `videos:/data/videos:ro`; service `api-test` krijgt `VIDEOS_DIR: /tmp/videos` (research R2)
- [X] T005 [P] Voeg aan `.env.example` toe, met Engels commentaar per regel en zonder waarden: `VIDEOS_DIR` ("/data/videos in Docker; never inside UPLOADS_DIR, which is public"), `VIDEO_MAX_SIZE_GB` (default 10), `VIDEO_MIN_FREE_SPACE_GB` (default 20), `VIDEO_MAX_PARALLEL_UPLOADS` (default 1, browser only), `UPLOAD_EXPIRY_HOURS` (default 24)
- [X] T006 Werk `nginx/default.conf` bij volgens research R7: (a) nieuwe `location ^~ /api/organisation/video-uploads` (zonder slash aan het eind, zodat ook `POST /api/organisation/video-uploads` matcht) met dezelfde `proxy_pass` en `proxy_set_header`-regels als `location /api/`, plus `client_max_body_size 40m;`, `proxy_request_buffering off;`, `proxy_http_version 1.1;`, `client_body_timeout 120s;`, `proxy_send_timeout 300s;`, `proxy_read_timeout 300s;`; (b) nieuwe `location /internal/videos/ { internal; alias /data/videos/; add_header X-Content-Type-Options "nosniff" always; }`; de server-brede `client_max_body_size 3m` en `location /media/` blijven ongewijzigd; Engels commentaar per blok waarom
- [X] T007 [P] Maak `backend/tests/fixtures/videos/make-fixtures.sh` (ffmpeg, bron `testsrc`/`sine`, 1–2 s, lage kwaliteit, elk bestand < 200 KB) die precies deze bestanden maakt: `valid-512x256.mp4` (H.264 + AAC), `valid-silent-1024x512.mp4` (H.264, geen geluid), `valid-opus-audio-512x256.mp4` (H.264 + Opus), `valid-4096x2048.mp4` (H.264, 1 frame per seconde), `not-360-640x360.mp4`, `square-1024x1024.mp4`, `too-large-4352x2176.mp4`, `h265-512x256.mp4` (libx265), `quicktime-512x256.mp4` (H.264, `-f mov`, major brand `qt`), `audio-only.mp4`, `corrupt.mp4` (2 KB willekeurige bytes), `clip.mov` (H.264 512×256, `-f mov`); voer het script uit en commit de bestanden; voeg `backend/tests/fixtures/videos/README.md` toe met de tabel uit research R12
- [X] T008 [P] Zet in `backend/vitest.config.js` naast `UPLOADS_DIR` ook `process.env.VIDEOS_DIR = path.join(os.tmpdir(), 'cms-test-videos')`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: configuratie, tabel `Video`, opslagmodule, repository, testhulpmiddelen en
frontend-hulpfuncties die alle stories nodig hebben

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T009 Breid `backend/src/config/env.js` uit: `VIDEOS_DIR` verplicht (in de lijst `required`, `path.resolve(repoRoot, …)`), `VIDEO_MAX_SIZE_GB` (`positiveInteger`, 10), `VIDEO_MIN_FREE_SPACE_GB` (20), `VIDEO_MAX_PARALLEL_UPLOADS` (1), `UPLOAD_EXPIRY_HOURS` (24), en afgeleide waarden `VIDEO_MAX_SIZE_BYTES` en `VIDEO_MIN_FREE_SPACE_BYTES` (× 1024³, research R5) plus de constante `VIDEO_CHUNK_SIZE_BYTES = 32 * 1024 * 1024`
- [X] T010 Maak migratie `backend/src/db/migrations/20261022000001_create_video.js` voor tabel `Video` exact volgens data-model.md: `id` INT PK auto-increment; `ownerOrganisationId` INT unsigned NOT NULL FK → `Organisation.id`; `name` VARCHAR(255) NOT NULL; `description` TEXT NULL; `storageKey` VARCHAR(500) NOT NULL UNIQUE; `thumbnailStorageKey` VARCHAR(500) NULL; `fileSizeBytes` BIGINT NOT NULL; `durationSeconds` INT NULL; `visibility` ENUM(`public`, `selective`, `private`) NOT NULL; `uploadedAt` DATETIME NOT NULL ("UTC"); `deletedAt` DATETIME NULL ("`NULL` = in de bibliotheek"); index `(ownerOrganisationId, deletedAt, uploadedAt)`; **geen** status-, reden- of voortgangsvelden en **geen** tabel `VideoAccess`
- [X] T011 [P] Maak `backend/src/lib/videoStorage.js` (research R2) met `save(key, sourcePath)` (`mkdir -p` van de doelmap, daarna `rename`), `getPath(key)`, `getInternalUrl(key)` (→ `/internal/videos/<key>`), `remove(key)` (negeert `ENOENT`), `freeBytes()` (`fs.statfs(VIDEOS_DIR)`: `bavail * bsize`), `incomingDir()` (→ `<VIDEOS_DIR>/incoming`) en `newVideoKeys(organisationId)` (→ `{ storageKey: 'videos/<org>/<uuid>.mp4', thumbnailStorageKey: 'thumbnails/<org>/<uuid>.jpg' }` met `crypto.randomUUID()`); elke functie met een key controleert die tegen `^(videos|thumbnails)/\d+/[0-9a-f-]{36}\.(mp4|jpg)$` en gooit anders een fout; dit is de enige module die videobestanden aanraakt
- [X] T012 [P] Unittests in `backend/tests/unit/videoStorage.test.js`: `save` verplaatst een bestand naar `<VIDEOS_DIR>/<key>`; `remove` van een niet-bestaand bestand gooit niet; keys met `..`, absolute paden of een ander patroon worden geweigerd; `getInternalUrl` geeft `/internal/videos/<key>`; `freeBytes` geeft een positief getal
- [X] T013 Maak `backend/src/modules/videos/videoRepository.js` met de queries uit data-model.md: `insertVideo(row)`, `listActiveForOrganisation(organisationId)` (`deletedAt IS NULL`, `ORDER BY uploadedAt DESC, id DESC`), `findActiveOwn(id, organisationId)` en `softDeleteOwn(id, organisationId)` (`SET deletedAt = UTC_TIMESTAMP()` met `deletedAt IS NULL`; geeft het aantal geraakte rijen terug); elke functie heeft `organisationId` als verplichte parameter
- [X] T014 Breid `backend/tests/helpers/testApp.js` uit: `resetDatabase()` leegt eerst `Video` en verwijdert ook `config.VIDEOS_DIR`; nieuwe helper `createVideoRow({ organisationId, name, … })` die een rij plus een kleine JPEG op `thumbnailStorageKey` aanmaakt (voor bibliotheek- en verwijdertests)
- [X] T015 [P] Maak `backend/tests/helpers/tus.js` met `createUpload(agent, { size, filename, name, extraMetadata })` (POST met `Tus-Resumable`, `Upload-Length`, base64 `Upload-Metadata`; geeft response en upload-URL), `headUpload(agent, url)`, `patchChunk(agent, url, offset, buffer)` (`Content-Type: application/offset+octet-stream`) en `uploadFixture(agent, fixtureName, { chunkSize = 64 * 1024, name })` die een bestand uit `backend/tests/fixtures/videos/` in delen verstuurt en de laatste response teruggeeft
- [X] T016 [P] Maak `frontend/src/lib/format.js` met `formatSize(bytes)` (1024-basis, "MB" onder 1 GB, anders "GB", één decimaal met komma: `3221225472` → `3,0 GB`), `formatDurationHms(seconds)` (`uu:mm:ss`, bijv. `95` → `00:01:35`) en `formatDate(iso)` (`dd-mm-jjjj`, lokale tijd), plus tests in `frontend/tests/format.test.js`
- [X] T017 [P] Maak `frontend/src/api/videos.js` met `listVideos()`, `deleteVideo(id)` en `getUploadSettings()` via de bestaande `api()` uit `frontend/src/api/client.js`; exporteer in `frontend/src/api/client.js` ook `notifyUnauthorized(error)` die de geregistreerde `onUnauthorized`-handler aanroept (voor tus-fouten die niet via `api()` lopen)

**Checkpoint**: migratie draait, opslagmodule getest, testhulpmiddelen klaar

---

## Phase 3: User Story 1 - Docent uploadt een 360°-video (Priority: P1) 🎯 MVP

**Goal**: een docent uploadt een MP4; na de laatste byte controleert de server het bestand,
maakt een thumbnail en legt alleen een geldige video vast; anders ziet de docent meteen de reden.
Uploads lopen door bij navigeren, één tegelijk met wachtrij, met waarschuwing bij weggaan.

**Independent Test**: inloggen als organisatie, `valid-512x256.mp4` uploaden en zien dat de
uploadindicator "Toegevoegd aan de bibliotheek" meldt en er een `Video`-rij met bestanden is;
een ongeldige fixture uploaden en de juiste melding zien (quickstart 2–11, 15–18)

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T018 [P] [US1] Unittests in `backend/tests/unit/videoVerification.test.js` met de fixtures: de vier `valid-*`-bestanden geven `{ durationSeconds, width, height }`; `not-360-640x360.mp4` en `square-1024x1024.mp4` → `video_not_360`; `too-large-4352x2176.mp4` → `video_resolution_too_high`; `h265-512x256.mp4` → `video_unsupported_codec`; `quicktime-512x256.mp4` → `video_unsupported_format`; `audio-only.mp4` en `corrupt.mp4` → `video_unreadable`; `makeThumbnail` maakt een JPEG van 1024×512 (controle met ffprobe); `probeVideo` plus `makeThumbnail` op `valid-4096x2048.mp4` duren samen minder dan 20 s (FR-015)
- [X] T019 [P] [US1] Integratietests in `backend/tests/integration/videoUpload.test.js` (met `backend/tests/helpers/tus.js`): `valid-512x256.mp4` in meerdere delen → laatste `PATCH` `200` met `{ video: { id, name, durationSeconds, fileSizeBytes, uploadedAt, thumbnailUrl } }`; de rij heeft `visibility = 'private'`, `description = NULL`, `ownerOrganisationId` van de sessie, keys volgens het patroon; video en thumbnail staan in `VIDEOS_DIR` en `incoming/` is leeg; elke ongeldige fixture → `422` met de juiste `code` en exact de `message` uit contracts/api.md, geen rij, geen bestanden in `videos/`, `thumbnails/` of `incoming/`; `POST` met bestandsnaam `clip.mov` → `415 video_unsupported_format`; `Upload-Length` = max + 1 → `413 video_too_large`; naam van 256 tekens → `400`; lege naam → bestandsnaam zonder `.mp4`; lege naam met een bestandsnaam van 300 tekens → naam van precies 255 tekens; lege naam met bestandsnaam `.mp4` → naam `Video`; `Upload-Metadata` met `organisationId` van organisatie B → video hoort toch bij A; `vi.spyOn(videoStorage, 'freeBytes')` te laag → `POST` `507 insufficient_storage`; zonder `X-Requested-With` → `403`; zonder sessie → `401`; een `PATCH` verlengt de sessie (`setLastActivity(token, 59)`, `PATCH`, `lastActivityAt` weer recent)
- [X] T020 [P] [US1] Frontend-tests in `frontend/tests/uploads-store.test.js` (`tus-js-client` gemockt): `.mov` en een bestand boven `maxFileSizeBytes` worden zonder upload geweigerd met exact de teksten uit contracts/ui.md; bij drie bestanden en `maxParallelUploads = 1` loopt er één en wachten er twee; annuleren of weigeren van de lopende start de volgende; een wachtend bestand kan uit de wachtrij; `beforeunload` is alleen geregistreerd zolang er iets loopt of wacht

### Implementation for User Story 1

- [X] T021 [P] [US1] Maak `backend/src/lib/videoVerification.js` (research R4): `probeVideo(path)` voert `ffprobe -v error -print_format json -show_format -show_streams` uit via `execFile` met time-out 20 s en controleert in deze volgorde: leesbaar en een videostream (anders `video_unreadable`); `format.format_name` bevat `mp4` en `format.tags.major_brand` (getrimd) is niet `qt` (anders `video_unsupported_format`); eerste videostream `codec_name === 'h264'` (anders `video_unsupported_codec`); `width === 2 * height` en `sample_aspect_ratio` afwezig, `0:1` of `1:1` (anders `video_not_360`); `width <= 4096 && height <= 2048` (anders `video_resolution_too_high`); geluid niet controleren; geeft `{ durationSeconds: Math.round(format.duration), width, height }`; `makeThumbnail(src, dest, durationSeconds)` met `ffmpeg -ss <max(1, 10% duur), maar kleiner dan de duur> -i src -frames:v 1 -vf scale=1024:512 -q:v 4 dest`, time-out 20 s (samen 40 s, zodat FR-015 haalbaar blijft); fouten als `VideoRejectedError` met `code`, `status = 422` en de Nederlandse `message` uit de tabel in contracts/api.md
- [X] T022 [US1] Maak `backend/src/modules/videos/videoService.js` met `finaliseUpload(upload)`: pad van het incoming-bestand, `probeVideo`, `newVideoKeys(organisationId)`, thumbnail eerst naar een tijdelijk bestand in `incoming/`, dan `videoStorage.save` voor video en thumbnail, dan `insertVideo` met `name` (getrimd; leeg → `filename` zonder `.mp4`, ingekort tot 255 tekens; dan nog leeg → `Video`), `ownerOrganisationId = Number(upload.metadata.organisationId)`, `fileSizeBytes = upload.size`, `durationSeconds`, `visibility: 'private'`, `description: null`, `uploadedAt: UTC`; daarna de tus-`.json` verwijderen; bij `VideoRejectedError` incoming-bestanden en tijdelijke thumbnail verwijderen en de fout doorgeven; bij een databasefout de al opgeslagen bestanden met `videoStorage.remove` opruimen; geeft het video-object in de vorm van contracts/api.md (`thumbnailUrl: /api/organisation/videos/<id>/thumbnail`)
- [X] T023 [US1] Maak `backend/src/modules/videos/videoUploadGuard.js` (research R3, R5, R6) als Express-middleware vóór tus: bij `POST` `Upload-Length` verplicht en ≤ `VIDEO_MAX_SIZE_BYTES` (anders `413 video_too_large` "Een video mag maximaal 10 GB zijn." met het getal uit de config), `filename` in `Upload-Metadata` eindigt (hoofdletterongevoelig) op `.mp4` (anders `415`), `name` ≤ 255 tekens na trimmen (anders `400 validation_failed`, `fields.name`), `freeBytes() - Upload-Length >= VIDEO_MIN_FREE_SPACE_BYTES` (anders `507 insufficient_storage` met de melding uit de spec); daarna `Upload-Metadata` herschrijven: `organisationId` van de client verwijderen en `organisationId` uit `getOrganisationId(req)` toevoegen; bij `HEAD`/`PATCH`/`DELETE` op `/:uploadId` de upload-info uit de FileStore lezen en bij onbekend of `metadata.organisationId` ≠ sessie `404 not_found`; bij `PATCH` `freeBytes() - (size - offset) >= VIDEO_MIN_FREE_SPACE_BYTES`, anders de upload verwijderen en `507`; alle fouten in het API-foutformaat
- [X] T024 [US1] Maak `backend/src/modules/videos/tusServer.js` met `createTusServer()`: `new Server({ path: '/api/organisation/video-uploads', datastore: new FileStore({ directory: incomingDir() }), maxSize: VIDEO_MAX_SIZE_BYTES, respectForwardedHeaders: true, relativeLocation: true, onUploadFinish })`; `onUploadFinish` roept `finaliseUpload` aan en geeft `200` met `{ video }` als JSON-body terug, of bij `VideoRejectedError` `422` met `{ error: { code, message } }` en vang via `onResponseError` (of het equivalent in de geïnstalleerde versie) een FileStore-fout met `code: 'ENOSPC'` af: verwijder de onvoltooide upload en antwoord `507 insufficient_storage` met de melding uit de spec (research R6); gebruik de hook-API van de geïnstalleerde `@tus/server`-versie en verder geen hooks
- [X] T025 [US1] Maak `backend/src/modules/videos/videoUploadRoutes.js` (routes `/video-uploads` en `/video-uploads/:uploadId` voor alle methodes: `videoUploadGuard` → `tusServer.handle`) en `backend/src/modules/videos/videoRoutes.js` met voorlopig alleen `GET /videos/upload-settings` (`{ maxFileSizeBytes, maxParallelUploads, chunkSizeBytes, acceptedExtensions: ['.mp4'], uploadEndpoint: '/api/organisation/video-uploads' }`); koppel beide in `backend/src/app.js` aan `app.use('/api/organisation', requireOrganisation, …)` en controleer dat `express.json` de tus-bodies niet leest
- [X] T026 [US1] Zet in `backend/src/server.js` `server.requestTimeout = 15 * 60 * 1000` met Engels commentaar waarom (research R7: een deel van 32 MB op een trage verbinding plus de controle)
- [X] T027 [US1] Maak `frontend/src/stores/uploads.js` (Pinia, research R10): laadt `getUploadSettings()` één keer; `addFiles(files, { name })` controleert per bestand extensie `.mp4` en grootte (anders direct een regel "Geweigerd" met de tekst uit contracts/ui.md, zonder upload); wachtrij met hooguit `maxParallelUploads` tegelijk; per upload een `tus.Upload` met `endpoint`, `chunkSize`, `headers: { 'X-Requested-With': 'cms' }`, `metadata: { filename, name }`, `removeFingerprintOnSuccess: true`; houdt per item `state` (`queued`, `uploading`, `verifying`, `done`, `rejected`, `error`), `bytesUploaded`, `bytesTotal`, `message` bij; `verifying` zodra alle bytes verstuurd zijn; bij succes de video uit de laatste response en `addedCount++`; bij een fout de `message` uit de JSON-body (`422`, `507`, `413`, `415`); `cancel(id)` (wachtend: weghalen; lopend: `abort(true)` zodat tus een `DELETE` stuurt); `abortAll()` (lopend: `abort(false)`, dus later hervatbaar); getter `hasActive`; registreert `beforeunload` alleen zolang `hasActive`
- [X] T028 [P] [US1] Maak `frontend/src/components/UploadIndicator.vue` die de store toont met de toestanden en teksten uit de tabel in contracts/ui.md (wachten, bezig met percentage en `formatSize` van verstuurd/totaal, gecontroleerd, toegevoegd, geweigerd, te weinig ruimte), knoppen "Annuleren", "Verwijderen uit wachtrij" en "Sluiten", en inklappen tot "Uploaden: 1 bezig, 2 wachtend"
- [X] T029 [US1] Toon `UploadIndicator` in `frontend/src/components/OrganisationLayout.vue` en laat "Uitloggen" bij `uploads.hasActive` eerst `confirmDialog` tonen met exact de tekst uit contracts/ui.md ("Er loopt nog een upload. …"); na bevestigen `uploads.abortAll()` en dan uitloggen
- [X] T030 [US1] Herschrijf het begin van `frontend/src/views/VideosView.vue`: verwijder de prototype-logica (`useApp`, `readMeta`, `fakeUpload`, naam-wijzigen-modal, "Gebruikt in", WebM); kop "Video's" met knop "Video toevoegen" en verborgen `<input type="file" accept=".mp4,video/mp4" multiple>`; bij één bestand een `Modal` "Video toevoegen" met veld "Naam" (voorgevuld met de bestandsnaam zonder extensie, `maxlength="255"`) en knop "Uploaden"; bij meerdere bestanden direct `uploads.addFiles(files)`

**Checkpoint**: uploaden, controleren en weigeren werkt end-to-end; de uploadindicator werkt op elke pagina

---

## Phase 4: User Story 2 - Onderbroken upload hervatten (Priority: P1)

**Goal**: een korte storing herstelt zichzelf; na een langere onderbreking gaat de upload verder
als de docent hetzelfde bestand kiest; vergeten uploads worden na 24 uur opgeruimd

**Independent Test**: een upload halverwege onderbreken en hervatten zonder bij 0% te beginnen;
een upload laten verlopen en zien dat de opruimtaak hem verwijdert (quickstart 12–14, 19, 26)

### Tests for User Story 2

- [X] T031 [P] [US2] Integratietests in `backend/tests/integration/videoResume.test.js`: de helft van `valid-silent-1024x512.mp4` versturen, `HEAD` geeft dat `Upload-Offset`; `PATCH` met een verkeerd offset → `409`; de rest versturen → `200` met video; `HEAD`/`PATCH`/`DELETE` op de upload-URL van A met een sessie van B → `404` en A's upload ongewijzigd; `DELETE` door A → `204` en databestand plus `.json` weg uit `incoming/`; met `freeBytes` te laag halverwege → `PATCH` `507` en de upload is uit `incoming/` verwijderd; een `vi.spyOn` op de schrijfmethode van de FileStore die een fout met `code: 'ENOSPC'` gooit → `507 insufficient_storage` en de upload is uit `incoming/` verwijderd
- [X] T032 [P] [US2] Integratietests in `backend/tests/integration/uploadCleanup.test.js`: een half verstuurde upload waarvan het databestand met `fs.utimes` 25 uur oud is gemaakt, wordt door `runUploadCleanup()` verwijderd (data en `.json`); een upload van 1 uur oud blijft staan; een losse `.json` van 25 uur oud wordt verwijderd
- [X] T033 [P] [US2] Frontend-tests in `frontend/tests/uploads-resume.test.js` (`tus-js-client` gemockt): als `findPreviousUploads()` een vorige upload geeft, wordt `resumeFromPreviousUpload` aangeroepen en is het item gemarkeerd als "Hervat"; een `401 session_expired` op een `PATCH` geeft de tekst "Upload onderbroken. Log opnieuw in en kies hetzelfde bestand om verder te gaan." en roept `notifyUnauthorized` aan; tijdens automatisch opnieuw proberen staat "Verbinding verbroken, opnieuw proberen…"

### Implementation for User Story 2

- [X] T034 [US2] Maak `backend/src/jobs/uploadCleanup.js` naar het patroon van `backend/src/jobs/sessionCleanup.js` (research R9): `runUploadCleanup()` verwijdert in `incomingDir()` elk databestand waarvan `mtime` ouder is dan `UPLOAD_EXPIRY_HOURS` samen met `<id>.json`, en losse `.json`- of databestanden ouder dan die grens; logt het aantal in het Engels; `startUploadCleanup()` draait direct en daarna elke 15 minuten (`unref`), fouten worden gelogd; start de taak in `backend/src/server.js`
- [X] T035 [US2] Breid `frontend/src/stores/uploads.js` uit: vóór `start()` `upload.findPreviousUploads()` en bij een treffer `upload.resumeFromPreviousUpload(previous[0])` met `resumed = true`; `retryDelays: [0, 3000, 10000, 30000, 60000]` en een toestand `retrying` via `onShouldRetry` (geen retry bij `401`, `404`, `413`, `415`, `422`, `507`); bij `401` toestand `expired` met de tekst uit contracts/ui.md en `notifyUnauthorized(error)`; bij `404` op hervatten de oude vingerafdruk verwijderen en opnieuw bij 0 beginnen
- [X] T036 [US2] Toon in `frontend/src/components/UploadIndicator.vue` de toestanden "Hervat", "Verbinding verbroken, opnieuw proberen…" en "Upload onderbroken. Log opnieuw in en kies hetzelfde bestand om verder te gaan." uit contracts/ui.md

**Checkpoint**: uploads van meerdere GB zijn hervatbaar; `incoming/` raakt niet vol met vergeten uploads

---

## Phase 5: User Story 3 - Videobibliotheek bekijken (Priority: P1)

**Goal**: de bibliotheek toont de eigen video's met thumbnail, naam, duur, grootte en
uploaddatum; thumbnails gaan na een toegangscontrole via nginx

**Independent Test**: als A en B elk een video hebben, ziet A alleen de eigen video met alle
gegevens en thumbnail; de thumbnail van B geeft `404` (quickstart 1, 22–25, 28)

### Tests for User Story 3

- [X] T037 [P] [US3] Integratietests in `backend/tests/integration/videoLibrary.test.js` (met `createVideoRow`): `GET /api/organisation/videos` geeft alleen niet-verwijderde video's van de eigen organisatie, nieuwste eerst, in de vorm van contracts/api.md; `GET /api/organisation/videos/:id/thumbnail` geeft voor een eigen video `200` met `Content-Type: image/jpeg` en `Cache-Control: private, max-age=3600`, en `404` voor een video van B, een verwijderde video, een onbekend id en een niet-numeriek id; `GET /api/organisation/videos/upload-settings` geeft de waarden uit de config
- [X] T038 [P] [US3] Unittests in `backend/tests/unit/sendStoredFile.test.js`: in productiemodus zet de functie `X-Accel-Redirect: /internal/videos/thumbnails/<org>/<uuid>.jpg`, `Content-Type` en `Cache-Control` en stuurt geen body; anders roept ze `res.sendFile` aan met het pad uit `videoStorage.getPath`
- [X] T039 [US3] Voeg aan `ORGANISATION_ROUTES` in `backend/tests/integration/organisationIsolation.test.js` toe: `get /api/organisation/videos`, `get /api/organisation/videos/upload-settings`, `get /api/organisation/videos/<id van B>/thumbnail`, `post /api/organisation/video-uploads`, `head`/`patch`/`delete` op een upload-URL van B; verwacht nergens gegevens of wijzigingen van B (SC-005)
- [X] T040 [P] [US3] Frontend-tests in `frontend/tests/videos-view.test.js`: een lijst van twee video's toont per video thumbnail, naam, `00:01:35`, `3,0 GB` en de datum; een lege lijst toont de tekst uit contracts/ui.md met de knop "Video toevoegen"; na `uploads.addedCount++` wordt de lijst opnieuw geladen

### Implementation for User Story 3

- [X] T041 [P] [US3] Maak `backend/src/lib/sendStoredFile.js` (research R8): `sendStoredFile(res, key, { contentType, cacheControl })`; bij `config.NODE_ENV === 'production'` alleen de headers `X-Accel-Redirect: getInternalUrl(key)`, `Content-Type`, `Cache-Control` en `res.end()`; anders `res.sendFile(getPath(key))` met dezelfde headers; Engels commentaar dat de ontwikkeltak de verantwoorde uitzondering uit plan.md (Complexity Tracking) is
- [X] T042 [US3] Voeg `listVideos(organisationId)` en `getThumbnailKey(id, organisationId)` (gooit `404` als `findActiveOwn` niets vindt) toe aan `backend/src/modules/videos/videoService.js`, en `GET /videos` en `GET /videos/:id/thumbnail` (id moet een positief geheel getal zijn, anders `404`) aan `backend/src/modules/videos/videoRoutes.js`, allebei met `getOrganisationId(req)`
- [X] T043 [US3] Breid `frontend/src/views/VideosView.vue` uit met het raster uit contracts/ui.md: per video `<img loading="lazy" :src="thumbnailUrl" :alt="name">`, naam, `formatDurationHms`, `formatSize` en `formatDate`; nieuwste eerst; lege-bibliotheektekst; laden bij openen van de pagina en opnieuw zodra `uploads.addedCount` verandert; geen afspeelknop
- [X] T044 [US3] Maak `backend/scripts/seed-videos.js <organisatiecode> <aantal>` (alleen voor ontwikkeling; weigert te draaien bij `NODE_ENV=production`) dat voor de organisatie met die code `<aantal>` `Video`-rijen plus kleine thumbnails aanmaakt via `videoStorage`, en voeg aan `backend/tests/integration/videoLibrary.test.js` een test toe die 200 video's aanmaakt en controleert dat `GET /api/organisation/videos` ze allemaal teruggeeft binnen 2 s (SC-006)

**Checkpoint**: alle P1-stories klaar; de MVP is af

---

## Phase 6: User Story 4 - Video verwijderen (Priority: P2)

**Goal**: een video zacht verwijderen na bevestiging; bestand en thumbnail blijven bestaan

**Independent Test**: een video verwijderen en zien dat hij uit de bibliotheek is, terwijl de rij
`deletedAt` heeft en de bestanden nog bestaan (quickstart 21)

### Tests for User Story 4

- [X] T045 [P] [US4] Integratietests in `backend/tests/integration/videoDelete.test.js`: `DELETE /api/organisation/videos/:id` → `204`; de video staat niet meer in `GET /videos`; de rij heeft `deletedAt` gevuld; video- en thumbnailbestand bestaan nog; een tweede `DELETE` → `404`; `DELETE` van een video van B → `404` en B's rij ongewijzigd (`deletedAt` nog `NULL`); voeg ook `delete /api/organisation/videos/<id van B>` toe aan `ORGANISATION_ROUTES` in `backend/tests/integration/organisationIsolation.test.js` (hoort bij deze story omdat de route pas hier ontstaat)
- [X] T046 [P] [US4] Frontend-test in `frontend/tests/videos-view.test.js`: "Verwijderen" toont de bevestiging met de tekst uit contracts/ui.md; annuleren roept de API niet aan; bevestigen roept `deleteVideo` aan, toont "Video verwijderd" en laadt de lijst opnieuw

### Implementation for User Story 4

- [X] T047 [US4] Voeg `deleteVideo(id, organisationId)` toe aan `backend/src/modules/videos/videoService.js` (`softDeleteOwn`; 0 rijen → `404`; bestanden niet aanraken) en `DELETE /videos/:id` (`204`) aan `backend/src/modules/videos/videoRoutes.js`
- [X] T048 [US4] Voeg in `frontend/src/views/VideosView.vue` per video de knop "Verwijderen" toe met `confirmDialog({ title: 'Video verwijderen?', body: '“<naam>” verdwijnt uit de videobibliotheek.', confirmLabel: 'Verwijderen', danger: true })`, daarna `deleteVideo`, `toast('Video verwijderd')` en opnieuw laden

**Checkpoint**: alle user stories werken zelfstandig

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: documentatie, beveiligingscontrole, lint, validatie

- [X] T049 [P] Werk `README.md` in de root bij (Nederlands): nieuwe `.env`-variabelen, volume `videos`, dat `ffmpeg` op het `PATH` moet staan om de backendtests buiten Docker te draaien, en hoe `backend/tests/fixtures/videos/make-fixtures.sh` de testvideo's opnieuw maakt
- [X] T050 Beveiligingscontrole: met de stack draaiend geven `https://localhost/media/videos/…`, `https://localhost/media/thumbnails/…` en `https://localhost/internal/videos/…` allemaal `404`; in productiemodus stuurt de API voor thumbnails alleen headers (geen bytes); `VIDEOS_DIR` valt niet onder `UPLOADS_DIR`; nergens in de code wordt een pad uit gebruikersinvoer opgebouwd buiten `videoStorage.js`
- [X] T051 Draai `npm run lint` in `backend/` en `frontend/` en los alle meldingen op; controleer constitution VI (Engelse code, commentaar en foutcodes; Nederlandse `message`- en UI-teksten)
- [X] T052 Voer alle scenario's uit [quickstart.md](quickstart.md) uit (1–28) plus `docker compose --profile test run --rm api-test` en `docker compose run --rm web-build npm test`, en noteer afwijkingen

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: geen afhankelijkheden
- **Foundational (Phase 2)**: na Setup; blokkeert alle user stories
- **User Stories (Phase 3–6)**: na Foundational
- **Polish (Phase 7)**: na de gewenste user stories (T049 kan eerder)

### User Story Dependencies

- **US1 (P1)**: alleen Foundational
- **US2 (P1)**: na US1 (breidt de tus-opzet, de guard en de upload-store uit)
- **US3 (P1)**: alleen Foundational voor de backend (tests gebruiken `createVideoRow`); de frontend-herlaadtrigger `addedCount` komt uit US1, dus in de praktijk na US1. Kan parallel met US2
- **US4 (P2)**: na US3 (verwijderknop zit in het raster; `videoRoutes.js` en `videoService.js` worden uitgebreid)

### Within Each User Story

- Tests eerst schrijven en laten falen
- Backend: hulpmodule → service → middleware/routes; frontend: store → component → view
- Story afronden en valideren vóór de volgende prioriteit

### Parallel Opportunities

- Setup: T001, T002, T003, T005, T007, T008 parallel; T004 en T006 los (raken Compose en nginx)
- Foundational: T011, T012, T015, T016, T017 parallel na T009/T010
- US1: T018, T019, T020 parallel; daarna T021 en T028 parallel
- US2 (backend: T034) en US3 (backend: T041, T042) kunnen na US1 door twee mensen tegelijk
- Binnen US3: T037, T038, T040 parallel; T041 parallel met T042

---

## Parallel Example: User Story 1

```bash
# Tests voor User Story 1 tegelijk:
Task: "Unittests ffprobe-regels in backend/tests/unit/videoVerification.test.js"
Task: "Integratietests upload in backend/tests/integration/videoUpload.test.js"
Task: "Frontend-tests wachtrij in frontend/tests/uploads-store.test.js"

# Onafhankelijke bouwstenen tegelijk:
Task: "backend/src/lib/videoVerification.js"
Task: "frontend/src/components/UploadIndicator.vue"
```

## Parallel Example: User Story 3

```bash
Task: "Integratietests bibliotheek in backend/tests/integration/videoLibrary.test.js"
Task: "Unittests X-Accel in backend/tests/unit/sendStoredFile.test.js"
Task: "Frontend-tests in frontend/tests/videos-view.test.js"
Task: "backend/src/lib/sendStoredFile.js"
```

---

## Implementation Strategy

### MVP First (User Stories 1–3)

1. Phase 1 Setup en Phase 2 Foundational afronden
2. US1: uploaden met controle → valideren met de fixtures
3. US2: hervatten en opruimen → valideren met een upload van meerdere GB
4. US3: bibliotheek bekijken → valideren met twee organisaties
5. **STOP**: video's zijn nu bruikbaar als bouwsteen voor de feature cursussen

### Incremental Delivery

1. Setup + Foundational
2. US1 → US2 → US3 (MVP)
3. US4 (verwijderen)
4. Polish

---

## Notes

- [P] = verschillende bestanden, geen afhankelijkheid van onafgemaakte taken
- Commit na elke taak of logische groep op `Development`
- Geen status-, reden- of voortgangsvelden in de database en geen `VideoAccess`-tabel (spec,
  data-model.md): niet toevoegen
- De limiet van één upload tegelijk zit alleen in de browser; de server dwingt hem niet af
- De cursus-editor (`frontend/src/editor/VideoPicker.vue`) blijft op de prototypedata; niet
  aanpassen in deze feature

## Phase 8: Convergence

- [X] T053 Maak de maximale resolutie instelbaar: voeg `VIDEO_MAX_WIDTH` (standaard 5760) en `VIDEO_MAX_HEIGHT` (standaard 2880) toe aan `backend/src/config/env.js` (`positiveInteger`) en `.env.example` (Engels commentaar), laat `backend/src/lib/videoVerification.js` deze waarden gebruiken in plaats van 4096/2048, en voeg `maxWidth` en `maxHeight` toe aan `GET /api/organisation/videos/upload-settings` in `backend/src/modules/videos/videoRoutes.js` (test in `backend/tests/integration/videoLibrary.test.js`) per FR-003a (contradicts)
- [X] T054 Maak `backend/src/lib/videoMessages.js` met de meldingen in gewone taal uit research R15 (getallen uit de config: max GB, max breedte × hoogte) en gebruik die in `backend/src/lib/videoVerification.js`, `backend/src/modules/videos/videoUploadGuard.js` (413, 415) en `backend/src/modules/videos/tusServer.js` (507); werk de verwachte teksten bij in `backend/tests/integration/videoUpload.test.js`, `backend/tests/integration/videoResume.test.js` en `backend/tests/unit/videoVerification.test.js`, en voeg `backend/tests/unit/videoMessages.test.js` toe die elke tekst letterlijk vergelijkt met de tabel in research R15 per FR-002, FR-003, FR-003a, FR-004, research R15 (contradicts)
- [X] T055 Vervang in `backend/tests/fixtures/videos/make-fixtures.sh` `valid-4096x2048.mp4` door `valid-max-5760x2880.mp4` (H.264, precies 5760×2880) en `too-large-4352x2176.mp4` door `too-large-6144x3072.mp4` (H.264, twee keer zo breed als hoog, boven 5760×2880); genereer ze (Alpine-container met ffmpeg), verwijder de oude bestanden en werk `backend/tests/fixtures/videos/README.md` en alle tests die de oude namen gebruiken bij per FR-003a, SC-004, research R12 (partial)
- [X] T056 Voeg `mp4box` (2.x, BSD-3-Clause) toe aan `frontend/package.json`; maak `frontend/src/lib/videoMessages.js` (dezelfde teksten als de backend, met getallen uit `upload-settings`) en `frontend/src/lib/videoCheck.js` volgens research R13 (extensie en grootte; top-level boxen doorlopen met `File.slice`; alleen `ftyp` en `moov` aan mp4box.js geven; regels: merk `qt` → `video_unsupported_format`, geen videospoor → `video_unreadable`, codec niet `avc1`/`avc3` → `video_unsupported_codec`, breedte ≠ 2 × hoogte → `video_not_360`, boven `maxWidth`/`maxHeight` → `video_resolution_too_high`; niet te lezen of > 10 s → `unknown`, toegestaan); laat `frontend/src/stores/uploads.js` dezelfde meldingen gebruiken; test in `frontend/tests/video-check.test.js` met alle bestanden uit `backend/tests/fixtures/videos/` (zelfde uitkomst als de server; `corrupt.mp4` → `unknown`) en in `frontend/tests/video-messages.test.js` (teksten = research R15) per FR-013, FR-013b, research R13, R15 (missing)
- [X] T057 Maak `frontend/src/components/UploadDialog.vue` volgens contracts/ui.md "Uploadvenster": per gekozen bestand een voorbeeldbeeld (best effort via `<video>` + canvas, anders grijs vlak), het veld "Naam" (max. 255), bestandsnaam en grootte, de uitkomst van `videoCheck` ("Bestand wordt gecontroleerd…", of de melding in rood met "Uit de lijst halen"); "Uploaden" uitgeschakeld zolang een bestand wordt gecontroleerd of ongeldig is; "Annuleren" verstuurt niets; laat `frontend/src/views/VideosView.vue` het venster openen voor één én meer bestanden en bij "Uploaden" `uploads.addFiles` aanroepen met per bestand de naam; test in `frontend/tests/upload-dialog.test.js` per FR-005, FR-013, US1/AC1–6 (missing)
- [X] T058 Maak `frontend/src/components/UploadRejectedDialog.vue`: een venster midden in het scherm "Video niet toegevoegd" met de bestandsnaam, de `message` van de server en de knop "OK", gevoed door een wachtrij `rejections` in `frontend/src/stores/uploads.js` (alleen weigeringen door de server na het starten van een upload: 413, 415, 422, 507); toon het in `frontend/src/components/OrganisationLayout.vue` (elke pagina); test in `frontend/tests/upload-rejected-dialog.test.js` per FR-014, US1/AC7 (missing)
- [X] T059 Voeg aan `frontend/src/stores/uploads.js` `loadInterrupted()` en `discardInterrupted(entry)` toe volgens research R14 (`tus.defaultOptions.urlStorage.findAllUploads()`, uploads die in dit tabblad lopen overslaan, `HEAD` met `Tus-Resumable` voor het percentage, bij 404 de opgeslagen info stil verwijderen; verwijderen via `tus.Upload.terminate` met header `X-Requested-With: cms` plus `urlStorage.removeUpload`), maak `frontend/src/components/ResumeNotice.vue` met de tekst "Je bent eerder begonnen met uploaden van <naam>, X% klaar. Kies het bestand opnieuw om verder te gaan, of verwijder het." en de knop "Verwijderen", toon het bovenaan `frontend/src/views/VideosView.vue` (laden bij openen; de regel verdwijnt als dat bestand opnieuw gestart wordt); test in `frontend/tests/resume-notice.test.js` per FR-009a, US2/AC6–7 (missing)
- [X] T060 Herschrijf `frontend/src/components/UploadIndicator.vue` volgens contracts/ui.md: standaard een klein rond knopje rechtsonder met het uploadpictogram en de totale voortgang als ring; klikken klapt de lijst uit/in; alleen op `/videos` klapt het vanzelf uit bij nieuws (start/hervat, elke 10% voortgang, klaar, geweigerd, verbinding weg, sessie verlopen) en na 4 s zonder nieuws weer in; op andere pagina's niet vanzelf; werk `frontend/tests/uploads-resume.test.js` bij en test in `frontend/tests/upload-indicator.test.js` per FR-006a, US1/AC8 (partial)
- [X] T061 Werk `README.md` (`VIDEO_MAX_WIDTH`, `VIDEO_MAX_HEIGHT`, controle in het uploadvenster met mp4box.js) en `.env.example` bij per plan.md, research R10, R13 (partial)
- [ ] T062 Draai alle backendtests (`docker compose --profile test run --rm api-test`, met de nieuwe test-image), alle frontendtests en `npm run lint` in `backend/` en `frontend/`, herbouw de stack (`docker compose up -d --build`) en controleer quickstart-scenario's 3–9 (vóór de upload) waar dat zonder inloggen kan per quickstart.md (partial)
