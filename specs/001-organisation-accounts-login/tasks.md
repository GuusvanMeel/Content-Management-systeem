---

description: "Takenlijst voor de feature Organisaties, accounts en inloggen"
---

# Tasks: Organisaties, accounts en inloggen

**Input**: Design documents from `/specs/001-organisation-accounts-login/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md),
[contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md)

**Tests**: het plan (research R12) en [quickstart.md](quickstart.md) vragen om
integratietests tegen een echte MariaDB, met name de isolatietest (SC-003) en de sessietests
(SC-008). Per story zijn daarom gerichte testtaken opgenomen; schrijf ze vóór de implementatie
en controleer dat ze eerst falen.

**Organization**: taken zijn gegroepeerd per user story, zodat elke story los te bouwen en te
testen is.

**Conventies** (constitution VI, v2.0.0): alles in de code is Engels, ook codecommentaar,
routes (API en frontend), foutcodes, logregels, configuratiesleutels en meldingen van
scripts voor ontwikkelaars/beheer. Nederlands alleen voor teksten die de klant ziet:
UI-teksten en het veld `message` in API-foutresponses. Documentatie blijft Nederlands. Tabel- en
veldnamen exact zoals in [data-model.md](data-model.md) (MariaDB op Linux is
hoofdlettergevoelig voor tabelnamen, research R2).

**Bestaande code**: `frontend/` bevat al een Vue 3-prototype (cursussen, video's, editor,
huisstijl in `localStorage`, organisatiekeuze in de kopbalk). Deze feature bouwt daarop voort:
het prototype voor cursussen en video's blijft ongewijzigd werken (buiten scope), maar komt
achter de organisatielogin. `backend/` bevat alleen een `index.js` met `/health`; die wordt
vervangen door de structuur uit plan.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Paden zijn relatief aan de repository-root (webapp: `backend/`, `frontend/`, `nginx/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: dependencies, configuratie en containers

- [X] T001 Breid `.gitignore` in de root uit met `uploads/` en `nginx/certs/` (de bestaande regels `node_modules/`, `.env`, `*.log`, `dist/`, `videos/`, `dbdata/` blijven staan) en maak de lege map `nginx/` aan
- [X] T002 [P] Werk `backend/package.json` bij: houd `"type": "module"`, zet `"main": "src/server.js"`, voeg dependencies `knex`, `mysql2`, `argon2`, `multer`, `cookie-parser` toe naast `express@^5`, devDependencies `vitest`, `supertest`, `eslint`, `@eslint/js`, `globals`, en scripts `start` (`node src/server.js`), `test` (`vitest run`), `migrate` (`knex migrate:latest`), `lint` (`eslint .`); voer `npm install` uit in `backend/` zodat `backend/package-lock.json` meekomt
- [X] T003 [P] Werk de bestaande Vue-app bij in `frontend/package.json` en `frontend/vite.config.js`: devDependencies `vitest`, `@vue/test-utils`, `jsdom`, `eslint`, `@eslint/js`, `eslint-plugin-vue`, `globals`, scripts `test` (`vitest run`) en `lint` (`eslint .`); in `vite.config.js` `base` van `'./'` naar `'/'` (nodig voor history-routes zoals `/admin/login`), `server.proxy` voor `/api` en `/media` naar `http://localhost:3000`, en `test: { environment: 'jsdom', include: ['tests/**/*.test.js'] }`; voer `npm install` uit in `frontend/`
- [X] T004 [P] Maak `.env.example` in de root met (zonder waarden) `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `TEST_DB_NAME`, `API_PORT`, `UPLOADS_DIR`, `COOKIE_SECURE` en `SESSION_IDLE_TIMEOUT_MINUTES` (standaard 60; "alleen voor handmatig testen tijdelijk lager zetten", research R3), met een Engelse toelichting als commentaar per variabele (constitution IV en VI)
- [X] T005 [P] Maak `backend/Dockerfile` op basis van `node:22-alpine` (`npm ci --omit=dev`, `CMD ["node", "src/server.js"]`, met een build-argument of aparte stage `test` die ook devDependencies installeert) en `frontend/Dockerfile` als multi-stage build (stage `build` met `npm ci && npm run build`, eindstage `nginx:stable-alpine` die `dist/` naar `/usr/share/nginx/html` kopieert en `nginx/default.conf` gebruikt; build-context is de repository-root zodat `nginx/` bereikbaar is)
- [X] T006 Maak `nginx/default.conf`: HTTP → HTTPS-redirect; HTTPS met certificaten uit `/etc/nginx/certs/`; frontend uit `/usr/share/nginx/html` met SPA-fallback (`try_files $uri /index.html`); `location /api/` → `proxy_pass http://api:3000`; `location /media/` → `alias /data/uploads/` met headers `X-Content-Type-Options: nosniff` en `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` (research R7); `client_max_body_size 3m`
- [X] T007 [P] Maak `nginx/dev-cert.sh` dat met `openssl` een zelfondertekend certificaat voor `localhost` in `nginx/certs/` zet (map staat in `.gitignore`), met Engels commentaar
- [X] T008 Maak `docker-compose.yml` met services `db` (`mariadb:11.8`, volume `db-data`, variabelen uit `.env`), `api` (build `backend/`, `depends_on: db`, volume `uploads:/data/uploads`, `env_file: .env`), `web` (build met `frontend/Dockerfile`, poorten 80 en 443, volume `uploads:/data/uploads:ro`, `./nginx/certs:/etc/nginx/certs:ro`, `depends_on: api`) en onder profiel `test` de services `db-test` (`mariadb:11.8`, `tmpfs` voor `/var/lib/mysql`), `api-test` (build `backend/` met devDependencies, `command: npm test`, `DB_HOST=db-test`, `depends_on: db-test`) en `web-build` (build-stage `build` van `frontend/Dockerfile`, voor `docker compose run --rm web-build npm test` uit quickstart.md)
- [X] T009 [P] Maak ESLint-configuratie (flat config) in `backend/eslint.config.js` (ES modules, Node-globals, `no-unused-vars`) en `frontend/eslint.config.js` (ES modules, browser-globals, `eslint-plugin-vue` recommended)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: configuratie, database, sessies (inclusief de 60 minuten-regel), foutafhandeling
en de frontend-basis die alle stories nodig hebben

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Backend-basis

- [X] T010 Maak `backend/src/config/env.js` dat alle variabelen uit `.env.example` inleest, verplichte variabelen controleert en bij een ontbrekende variabele met een duidelijke Engelse foutmelding in de log stopt; `SESSION_IDLE_TIMEOUT_MINUTES` is optioneel, standaard `60`, en moet een positief geheel getal zijn; `COOKIE_SECURE` standaard `true`; exporteer een bevroren config-object
- [X] T011 Maak `backend/knexfile.js` en `backend/src/db/knex.js` (client `mysql2`, `charset: 'utf8mb4'`, `timezone: 'Z'`, migraties in `backend/src/db/migrations/`, aparte configuratie `test` die `TEST_DB_NAME` gebruikt)
- [X] T012 Maak migratie `backend/src/db/migrations/20261021000001_create_administrator.js` voor tabel `Administrator`: `id` INT PK auto-increment; `username` VARCHAR(100) NOT NULL UNIQUE ("getrimd; 3–100 tekens"); `passwordHash` VARCHAR(255) NOT NULL ("argon2id-hash; wachtwoord 10–128 tekens")
- [X] T013 Maak migratie `backend/src/db/migrations/20261021000002_create_organisation.js` voor tabel `Organisation`: `id` INT PK auto-increment; `name` VARCHAR(255) NOT NULL; `loginCode` VARCHAR(50) NOT NULL UNIQUE; `passwordHash` VARCHAR(255) NOT NULL; `questLinkCode` VARCHAR(50) NOT NULL UNIQUE; `deletedAt` DATETIME NULL ("`NULL` = actief"); de unieke indexen gelden ook voor verwijderde rijen (geen partiële index), zodat codes gereserveerd blijven (FR-012)
- [X] T014 Maak migratie `backend/src/db/migrations/20261021000003_create_session.js` voor tabel `Session`: `id` INT PK auto-increment; `tokenHash` CHAR(64) NOT NULL UNIQUE ("SHA-256 (hex) van het cookie-token"); `administratorId` INT NULL FK → `Administrator.id`; `organisationId` INT NULL FK → `Organisation.id` met index; `createdAt` DATETIME NOT NULL ("UTC"); `lastActivityAt` DATETIME NOT NULL met index ("UTC; bij inloggen gezet en bij elk geauthenticeerd verzoek bijgewerkt naar `UTC_TIMESTAMP()`"); `CHECK ((administratorId IS NULL) <> (organisationId IS NULL))` via `knex.raw`
- [X] T015 [P] Maak `backend/src/lib/password.js` met `hashPassword(plain)` en `verifyPassword(hash, plain)` via argon2id (standaardparameters van het pakket), `validatePassword(plain)` die een `validationError({ password: 'Het wachtwoord moet minimaal 10 tekens zijn.' })` geeft als de lengte niet tussen 10 en 128 tekens ligt (FR-013, research R5), en een vaste `DUMMY_HASH` voor gelijke responstijd bij onbekende gebruikers
- [X] T016 [P] Maak `backend/src/lib/errors.js` met klasse `AppError(status, code, message, fields?)` en hulpfuncties `validationError(fields)` (400 `validation_failed`), `notFound()` (404 `not_found`), `conflict(fields)` (409 `conflict`), `notAuthenticated()` (401 `not_authenticated`, "Je bent niet ingelogd."), `sessionExpired()` (401 `session_expired`, "Je sessie is verlopen. Log opnieuw in."), `forbidden()` (403 `forbidden`) en `invalidCredentials(message)` (401 `invalid_credentials`)
- [X] T017 Maak `backend/src/middleware/errorHandler.js` die elke `AppError` omzet naar `{ "error": { "code", "message", "fields"? } }` (`fields` alleen bij `validation_failed`, contracts/api.md), multer-fout `LIMIT_FILE_SIZE` omzet naar `413 logo_too_large` met melding "Het logo mag maximaal 2 MB zijn.", en onbekende fouten in het Engels logt (met stacktrace) en als `500 internal_error` teruggeeft met de algemene melding voor de klant "Er ging iets mis. Probeer het later opnieuw."
- [X] T018 [P] Maak `backend/src/middleware/csrf.js` die bij `POST`, `PUT`, `PATCH` en `DELETE` de header `X-Requested-With: cms` eist, anders `403 csrf_header_missing` (research R4)
- [X] T019 Maak `backend/src/modules/auth/sessionRepository.js` met `createSession({ administratorId?, organisationId? })` (32 willekeurige bytes via `crypto.randomBytes` als base64url-token, slaat alleen de SHA-256-hex op, `createdAt` en `lastActivityAt` = `UTC_TIMESTAMP()`, geeft het token terug), `findByToken(token, timeoutMinutes)` (geeft de rij plus `expired: true|false`, berekend in de database met `lastActivityAt >= UTC_TIMESTAMP() - INTERVAL ? MINUTE`), `touch(id)` (zet `lastActivityAt = UTC_TIMESTAMP()` bij **elk** geauthenticeerd verzoek, niet gethrottled), `deleteById(id)`, `deleteByToken(token)`, `deleteByOrganisationId(organisationId, trx?)` (FR-010) en `deleteExpired(timeoutMinutes)` (`DELETE FROM Session WHERE lastActivityAt < UTC_TIMESTAMP() - INTERVAL ? MINUTE`, geeft het aantal verwijderde rijen terug)
- [X] T020 Maak `backend/src/middleware/session.js`: leest cookie `sid`; zonder cookie `req.authState = 'none'`; met cookie de sessie opzoeken met `config.SESSION_IDLE_TIMEOUT_MINUTES`; bestaat de rij niet, is hij verlopen, of hoort hij bij een organisatie met gevulde `deletedAt`, dan de rij verwijderen, de cookie wissen en `req.authState = 'expired'`; anders `touch(id)`, `req.authState = 'ok'` en `req.auth` = `{ role: 'admin', administratorId, username, sessionId }` of `{ role: 'organisation', organisationId, sessionId }`; exporteer `setSessionCookie(res, token)` (`HttpOnly`, `Secure` volgens `COOKIE_SECURE`, `SameSite=Strict`, `Path=/`, **zonder** `Expires`/`Max-Age`: een sessiecookie, FR-019) en `clearSessionCookie(res)`
- [X] T021 [P] Maak `backend/src/middleware/requireAdmin.js` en `backend/src/middleware/requireOrganisation.js`: `req.authState === 'none'` → `401 not_authenticated`, `'expired'` → `401 session_expired` (FR-019a), verkeerde rol → `403 forbidden`; `requireOrganisation.js` exporteert ook `getOrganisationId(req)` die het id uitsluitend uit `req.auth` haalt (research R8)
- [X] T022 [P] Maak `backend/src/jobs/sessionCleanup.js` met `runSessionCleanup()` (roept `deleteExpired(config.SESSION_IDLE_TIMEOUT_MINUTES)` aan en logt het aantal in het Engels (bijv. `session cleanup: removed 3 expired sessions`)) en `startSessionCleanup()` die meteen één keer draait en daarna elke 15 minuten via `setInterval` (met `unref()`); fouten worden gelogd en stoppen de API niet; geeft een `stop()`-functie terug (FR-019b, research R3a)
- [X] T023 Maak `backend/src/modules/auth/authRoutes.js` met `POST /api/auth/logout` (altijd `204`, ook zonder of met verlopen sessie; sessierij verwijderen en cookie wissen) en `GET /api/auth/me` (`401 not_authenticated` / `401 session_expired` volgens `req.authState`; als beheerder `{ role: 'admin', username }`, als organisatie `{ role: 'organisation', organisation: { id, name, loginCode } }` uit de database)
- [X] T024 Maak `backend/src/app.js` (exporteert `createApp()`: `express.json()`, `cookie-parser`, `csrf`, `session`, routers onder `/api`, `GET /api/health` → `{ status: 'ok' }`, `errorHandler` als laatste) en `backend/src/server.js` (start op `API_PORT` en roept `startSessionCleanup()` aan; `createApp()` start de opruimtaak níet, zodat tests hem direct aanroepen); verwijder `backend/index.js`
- [X] T025 Maak `backend/scripts/create-admin.js`: gebruikersnaam als argument (getrimd, 3–100 tekens, uniek), wachtwoord twee keer verborgen vragen via `readline` (nooit als argument, research R10), controleren met `validatePassword`, opslaan met `hashPassword`; Engelse meldingen (het script wordt door het projectteam bij installatie gedraaid, niet door de klant) en exitcode ≠ 0 bij fouten
- [X] T026 Maak testinfrastructuur: `backend/vitest.config.js` (`fileParallelism: false`, `globalSetup` in `backend/tests/helpers/globalSetup.js` voert migraties uit op de testdatabase) en `backend/tests/helpers/testApp.js` met `resetDatabase()` (alle tabellen leegmaken, kindtabellen eerst), `createAdmin(username, password)`, `createOrganisationRow({ name, loginCode, password, questLinkCode?, deletedAt? })`, `agentWithSession({ administratorId? , organisationId? })` (maakt via `createSession` een sessie aan en geeft een Supertest-agent met cookie `sid` en header `X-Requested-With: cms`, zonder login-route), en `setLastActivity(token, minutesAgo)` (zet `lastActivityAt` van die sessie terug)
- [X] T027 [P] Integratietests in `backend/tests/integration/sessions.test.js` (FR-019, FR-019a, FR-019b, SC-008), elk voor zowel een beheerders- als een organisatiesessie: zonder cookie geeft `GET /api/auth/me` `401 not_authenticated`; met een onbekend token `401 session_expired` en een `Set-Cookie` die `sid` wist; `lastActivityAt` 61 minuten terug → `401 session_expired`, de rij is verwijderd en de cookie gewist; 59 minuten terug → `200` en `lastActivityAt` staat daarna binnen enkele seconden van `UTC_TIMESTAMP()`; een sessie van een organisatie met gevulde `deletedAt` → `401 session_expired`; `runSessionCleanup()` verwijdert alleen rijen ouder dan de time-out; `POST /api/auth/logout` geeft `204` en verwijdert de rij; schrijvend verzoek zonder `X-Requested-With` → `403 csrf_header_missing`

### Frontend-basis

- [X] T028 [P] Maak `frontend/src/api/client.js`: fetch-wrapper met `credentials: 'same-origin'`, JSON (en `FormData` zonder `Content-Type` voor uploads), altijd header `X-Requested-With: cms`; zet het foutformaat om naar een `ApiError` met `status`, `code`, `message`, `fields`; bij een `401` op een ander verzoek dan `/api/auth/*/login` en `/api/auth/me`: reset de auth-store en navigeer naar `/admin/login` (als de huidige route met `/admin` begint) of `/login`, met query `redirect=<huidige route>` en, alleen bij `session_expired`, `reason=expired` (contracts/ui.md); geen polling of automatische verzoeken op de achtergrond
- [X] T029 [P] Maak `frontend/src/stores/auth.js` (Pinia): state `role`, `username`, `organisation`, `loaded`; `fetchMe()` via `GET /api/auth/me` (bij `401` de state leegmaken zonder door te sturen), `loginAdmin(username, password)`, `loginOrganisation(loginCode, password)` (beide daarna `fetchMe()`), `logout()` via `POST /api/auth/logout` en daarna naar de juiste inlogpagina met `reason=logout`, en `reset()`
- [X] T030 Zet `frontend/src/router.js` om naar `createWebHistory()` met een globale `beforeEach`-guard die eenmalig `auth.fetchMe()` aanroept en reageert op `meta.requiresAdmin` (anders naar `/admin/login?redirect=…`), `meta.requiresOrganisation` (anders naar `/login?redirect=…`) en `meta.guestOnly` (ingelogde beheerder → `/admin`, ingelogde organisatie → `/`) zoals in de tabel van contracts/ui.md; maak `frontend/src/components/OrganisationLayout.vue` met de kopbalk, navigatie (Cursussen, Video's), de `watchEffect` die `--brand`/`--brand-2` zet en `RouterView` uit de huidige `frontend/src/App.vue`, **zonder** de organisatiekeuze (`#org-switch`) en met een knop "Uitloggen"; hernoem de Nederlandse prototyperoutes naar het Engels (constitution VI): `/cursussen` → `/courses`, `/cursussen/:id` → `/courses/:id`, `/organisatie` → `/organisation`, inclusief alle `RouterLink`s, `router.push`-aanroepen en padcontroles in `frontend/src/App.vue`, `frontend/src/views/CoursesView.vue`, `frontend/src/views/EditorView.vue` en `frontend/src/views/VideosView.vue` (de zichtbare linkteksten blijven Nederlands); zet de routes `/courses`, `/courses/:id`, `/videos` en `/organisation` als kinderen van een route met `component: OrganisationLayout` en `meta.requiresOrganisation`; beperk `frontend/src/App.vue` tot `<RouterView />` plus de bestaande toasts en het bevestigingsvenster uit `frontend/src/lib/ui.js`
- [X] T031 [P] Maak de standaardhuisstijl (research R9): `backend/src/config/defaultStyle.js` en `frontend/src/config/defaultStyle.js` met dezelfde waarden `primaryColour: '#2C4A6E'`, `secondaryColour: '#9AA9BC'` (de huidige `DEFAULT_BRANDING` uit `frontend/src/data/seed.js`) en `logoUrl: '/default-logo.svg'`, met Engels commentaar in beide bestanden dat ze gelijk moeten blijven; zet het standaardlogo in `frontend/public/default-logo.svg` (kopie van `frontend/src/assets/logo-yonder.svg` tot het projectteam een ander logo kiest; `public/` in plaats van `src/assets/` omdat de backend een vaste URL zonder Vite-hash moet kunnen teruggeven); laat `DEFAULT_BRANDING` in `frontend/src/data/seed.js` uit `frontend/src/config/defaultStyle.js` komen
- [X] T032 [P] Maak `frontend/tests/setup.js` (maakt per test een verse Pinia aan en mockt `fetch`) en neem het op als `setupFiles` in `frontend/vite.config.js`

**Checkpoint**: fundament klaar: containers starten, migraties draaien, `GET /api/auth/me` geeft `401 not_authenticated`, `sessions.test.js` is groen, het prototype is alleen nog bereikbaar na inloggen (nog niet mogelijk tot US2)

---

## Phase 3: User Story 1 - Beheerder logt in en maakt een organisatie aan (Priority: P1) 🎯 MVP

**Goal**: de beheerder logt in op de beheeromgeving, ziet het overzicht en maakt organisaties
aan met een voorgestelde code; elke aanmaak staat in het logboek

**Independent Test**: inloggen als beheerder (via `create-admin.js`), een organisatie aanmaken
en controleren dat die met naam en code in het overzicht staat (quickstart scenario's 1–6)

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [X] T033 [P] [US1] Unittests in `backend/tests/unit/codes.test.js`: `normalizeLoginCode(' zwembad-a ')` → `ZWEMBAD-A`; `suggestLoginCodeBase('Zwembad De Hoven')` → `ZWEMBAD-DE-HOVEN`; `'Café Ëiland!'` → `CAFE-EILAND`; een naam van 80 tekens wordt ingekort tot maximaal 46 tekens zonder `-` aan het eind; `isValidLoginCode` met regex `^[A-Z0-9](?:[A-Z0-9-]{1,48})[A-Z0-9]$` weigert `-AB`, `AB-`, `A`, `AB` en een code van 51 tekens en accepteert `ABC` en `ZWEMBAD-A`; `generateQuestLinkCode()` geeft 8 tekens uit `0123456789ABCDEFGHJKMNPQRSTVWXYZ`
- [X] T034 [P] [US1] Unittests in `backend/tests/unit/password.test.js`: `validatePassword` weigert 9 en 129 tekens en accepteert 10 en 128; `verifyPassword(await hashPassword(x), x)` is `true`, met een ander wachtwoord `false`; de hash begint met `$argon2id$`
- [X] T035 [P] [US1] Integratietests in `backend/tests/integration/adminAuth.test.js`: juiste login op `POST /api/auth/admin/login` → `204` + cookie `sid` met `HttpOnly`, `SameSite=Strict`, `Path=/` en zonder `Expires`/`Max-Age`; fout wachtwoord en onbekende gebruiker → `401 invalid_credentials` met exact "Gebruikersnaam of wachtwoord onjuist."; daarna `GET /api/auth/me` → `{ role: 'admin', username }`; `GET /api/admin/organisations` zonder sessie → `401 not_authenticated`; met organisatiesessie → `403`; er bestaat geen registratieroute (`POST /api/auth/register` → `404`, FR-003)
- [X] T036 [P] [US1] Integratietests in `backend/tests/integration/organisationsCreate.test.js`: aanmaken → `201` met `id`, `name`, `loginCode` en een gegenereerde `questLinkCode` van 8 tekens die verschilt van `loginCode`; wachtwoord van 9 tekens → `400` met `fields.password`; naam met alleen spaties → `400` met `fields.name`; code `zwembad-a` als `ZWEMBAD-A` al bestaat → `409` met `fields.loginCode`; idem als de bestaande organisatie verwijderd is (`deletedAt` gevuld); code gelijk aan een bestaande `questLinkCode` → `409`; `GET .../code-suggestion?name=Zwembad%20De%20Hoven` → `ZWEMBAD-DE-HOVEN`, en `ZWEMBAD-DE-HOVEN-2` als de basiscode bezet is; lege `name` → `400`; lijst gesorteerd op naam zonder verwijderde organisaties; na aanmaken één `AdminActionLog`-rij met `action = 'create'` en geen wachtwoord of hash in `details`; nergens in de responses een `passwordHash`

### Implementation for User Story 1

- [X] T037 [P] [US1] Maak `backend/src/lib/codes.js`: `normalizeLoginCode` (trimmen, hoofdletters), `isValidLoginCode` met regex `^[A-Z0-9](?:[A-Z0-9-]{1,48})[A-Z0-9]$` (3–50 tekens), `suggestLoginCodeBase(name)` (Unicode NFD, accenten weg, hoofdletters, elke reeks tekens buiten `A-Z0-9` → `-`, `-` aan begin/eind weg, inkorten tot 46 tekens en opnieuw `-` aan het eind weghalen) en `generateQuestLinkCode()` (8 tekens uit `0123456789ABCDEFGHJKMNPQRSTVWXYZ` via `crypto.randomInt`) (research R6)
- [X] T038 [US1] Maak migratie `backend/src/db/migrations/20261021000004_create_admin_action_log.js` voor tabel `AdminActionLog`: `id` INT PK auto-increment; `administratorId` INT NOT NULL FK → `Administrator.id`; `organisationId` INT NOT NULL FK → `Organisation.id`; `action` ENUM(`create`, `update`, `delete`, `passwordReset`) NOT NULL; `details` JSON NULL ("nooit wachtwoorden of hashes"); `createdAt` DATETIME NOT NULL met index
- [X] T039 [P] [US1] Maak `backend/src/modules/actionLog/actionLogRepository.js` met alleen `insertEntry(trx, { administratorId, organisationId, action, details })` (zet `createdAt = UTC_TIMESTAMP()`, `details` als JSON-string of `NULL`); geen update- of delete-functies (FR-028)
- [X] T040 [US1] Maak `backend/src/modules/organisations/organisationRepository.js` met `listActive()` (`deletedAt IS NULL`, gesorteerd op `name`, zonder `passwordHash`), `findActiveById(id)`, `findActiveByLoginCode(code)` (inclusief `passwordHash`, voor inloggen), `isCodeTaken(code, { excludeId? })` (true als de code gelijk is aan een `loginCode` óf `questLinkCode` van welke organisatie dan ook, ook verwijderde) en `insertOrganisation(trx, row)`
- [X] T041 [US1] Maak `backend/src/modules/organisations/organisationService.js` met `suggestCode(name)` (basis uit `suggestLoginCodeBase`, korter dan 3 tekens of leeg → `validationError({ name })`; bij bezet `-2`, `-3`, ... tot een vrije code) en `createOrganisation({ name, loginCode, password }, administratorId)`: naam trimmen en 1–255 tekens (anders `fields.name`), code normaliseren en met `isValidLoginCode` controleren (anders `fields.loginCode`), `validatePassword`, bij bezette code `conflict({ loginCode: 'Deze code is al in gebruik.' })`, unieke `questLinkCode` genereren (opnieuw bij botsing met een `loginCode` of `questLinkCode`), hashen, en in één transactie de organisatie invoegen plus `insertEntry` met `action: 'create'` en `details: { name, loginCode }`; vang een `ER_DUP_ENTRY` op als `409` (FR-004, FR-004a, FR-005, FR-006, FR-027)
- [X] T042 [US1] Maak `backend/src/modules/auth/authService.js` met `loginAdmin(username, password)`: gebruikersnaam trimmen en opzoeken; bij een onbekende gebruiker toch `verifyPassword(DUMMY_HASH, password)` (gelijke responstijd); bij falen `invalidCredentials('Gebruikersnaam of wachtwoord onjuist.')`; bij succes `createSession({ administratorId })` en het token teruggeven; voeg `POST /api/auth/admin/login` toe aan `backend/src/modules/auth/authRoutes.js` die een eventuele oude sessie uit de cookie verwijdert, `setSessionCookie` aanroept en `204` geeft (FR-001, FR-017, FR-018: geen blokkering)
- [X] T043 [US1] Maak `backend/src/modules/organisations/adminOrganisationRoutes.js` met `GET /api/admin/organisations`, `GET /api/admin/organisations/code-suggestion?name=` en `POST /api/admin/organisations` (responsevormen uit contracts/api.md: `{ id, name, loginCode, questLinkCode }`) en koppel de router in `backend/src/app.js` onder `/api/admin` achter `requireAdmin`
- [X] T044 [P] [US1] Maak `frontend/src/views/AdminLoginView.vue`: velden gebruikersnaam en wachtwoord, foutmelding uit de API, bovenaan "Je sessie is verlopen. Log opnieuw in." bij `?reason=expired` en "Je bent uitgelogd." bij `?reason=logout` (geen melding zonder `reason`); na succes `auth.loginAdmin()` en naar `?redirect` (alleen als die met `/admin` begint) of anders `/admin`; altijd de standaardhuisstijl
- [X] T045 [P] [US1] Maak `frontend/src/components/AdminLayout.vue` (kopbalk in de standaardhuisstijl uit `frontend/src/config/defaultStyle.js`, navigatie "Organisaties", gebruikersnaam van de beheerder, knop "Uitloggen" via `auth.logout()`, `RouterView`) en `frontend/src/views/admin/OrganisationListView.vue` (tabel met naam en organisatiecode uit `GET /api/admin/organisations`, knop "Nieuwe organisatie")
- [X] T046 [US1] Maak `frontend/src/views/admin/OrganisationFormView.vue` in aanmaakmodus: velden naam, organisatiecode en wachtwoord (hint "minimaal 10 tekens", type `password`); bij wijzigen van de naam na 300 ms een voorstel ophalen via `code-suggestion` en invullen zolang de beheerder de code niet zelf heeft aangepast (FR-004a, contracts/ui.md); veldfouten uit `fields` naast het juiste veld tonen; na succes een toast via `frontend/src/lib/ui.js` en naar `/admin`
- [X] T047 [US1] Voeg aan `frontend/src/router.js` de routes `/admin/login` (`AdminLoginView`, `meta.guestOnly`) en `/admin` met kinderen `''` (`OrganisationListView`) en `organisations/new` (`OrganisationFormView`) toe, binnen `AdminLayout` met `meta.requiresAdmin`

**Checkpoint**: User Story 1 werkt zelfstandig: beheerder kan inloggen en organisaties aanmaken

---

## Phase 4: User Story 2 - Docent logt in namens een organisatie (Priority: P1)

**Goal**: een docent logt in met organisatiecode en wachtwoord en werkt namens die organisatie

**Independent Test**: organisatie aanmaken, inloggen op `/login` met de code (in kleine
letters) en het wachtwoord, organisatienaam zien, uitloggen (quickstart scenario's 7, 8, 17)

### Tests for User Story 2

- [X] T048 [P] [US2] Integratietests in `backend/tests/integration/organisationAuth.test.js`: login met code in kleine letters en spaties eromheen → `204` + cookie `sid`; fout wachtwoord, onbekende code, de eigen Quest-koppelcode als code en een organisatie met gevulde `deletedAt` → allemaal `401 invalid_credentials` met exact "Organisatiecode of wachtwoord onjuist." (FR-012, FR-017); 10 mislukte pogingen gevolgd door een juiste → de juiste slaagt meteen (FR-018); `GET /api/organisation` geeft `{ id, name, loginCode }`; `GET /api/auth/me` geeft `role: 'organisation'`; na `POST /api/auth/logout` geeft `GET /api/auth/me` `401`
- [X] T049 [P] [US2] Frontend-test `frontend/tests/api-client.test.js`: een `401 session_expired` op `GET /api/organisation` vanaf `/videos` navigeert naar `/login?redirect=/videos&reason=expired`; een `401 not_authenticated` vanaf `/admin` navigeert naar `/admin/login?redirect=/admin` zonder `reason`; een `401` op een login-verzoek navigeert niet; elk verzoek heeft de header `X-Requested-With: cms`

### Implementation for User Story 2

- [X] T050 [US2] Voeg `loginOrganisation(loginCode, password)` toe aan `backend/src/modules/auth/authService.js` (code met `normalizeLoginCode`, opzoeken met `findActiveByLoginCode` zodat verwijderde organisaties en Quest-koppelcodes niet gevonden worden, `DUMMY_HASH` bij onbekende code, `invalidCredentials('Organisatiecode of wachtwoord onjuist.')`, geen blokkering of vertraging, `createSession({ organisationId })`) en route `POST /api/auth/organisation/login` aan `backend/src/modules/auth/authRoutes.js` (FR-015, FR-017, FR-018)
- [X] T051 [US2] Maak `backend/src/modules/organisationSelf/organisationSelfRoutes.js` met `GET /api/organisation` (`{ id, name, loginCode }` op basis van `getOrganisationId(req)`, `404` als de organisatie niet (meer) actief is) en koppel de router in `backend/src/app.js` onder `/api/organisation` achter `requireOrganisation`
- [X] T052 [P] [US2] Maak `frontend/src/views/LoginView.vue`: velden organisatiecode en wachtwoord, tekst "Wachtwoord vergeten? Neem contact op met de beheerder." (FR-020), geen registratielink (FR-003), foutmelding uit de API, bovenaan "Je sessie is verlopen. Log opnieuw in." bij `?reason=expired` en "Je bent uitgelogd." bij `?reason=logout`; na succes `auth.loginOrganisation()` en naar `?redirect` (alleen als die niet met `/admin` begint) of anders `/`; altijd de standaardhuisstijl
- [X] T053 [P] [US2] Maak `frontend/src/views/HomeView.vue` (welkomsttekst met de naam van de organisatie uit de auth-store en links naar Cursussen en Video's) en toon in `frontend/src/components/OrganisationLayout.vue` de organisatienaam uit `auth.organisation.name` in plaats van `app.org.name`
- [X] T054 [US2] Voeg aan `frontend/src/router.js` de route `/login` (`LoginView`, `meta.guestOnly`) toe en vervang de redirect `/` → `/courses` door `HomeView` als kind van de `OrganisationLayout`-route (`meta.requiresOrganisation`)

**Checkpoint**: User Stories 1 en 2 werken: beheerder maakt een organisatie aan, docent logt ermee in en komt in het (prototype-)CMS

---

## Phase 5: User Story 3 - Organisatie ziet alleen haar eigen gegevens (Priority: P1)

**Goal**: aantoonbaar dat een organisatie nooit gegevens van een andere organisatie of de
beheeromgeving kan zien of wijzigen

**Independent Test**: twee organisaties; als A alle organisatieroutes aanroepen met id's van B
in query en body, en alle beheerroutes aanroepen (quickstart "Isolatiecontrole")

### Tests for User Story 3

- [X] T055 [P] [US3] Integratietest `backend/tests/integration/organisationIsolation.test.js`: maak organisaties A en B; als A roep elke route uit de array `ORGANISATION_ROUTES` (bovenaan het bestand, voorlopig alleen `GET /api/organisation`) aan met extra `?organisationId=<B>` en `{ organisationId: <B>, id: <B> }` in de body en controleer dat alleen gegevens van A terugkomen en B ongewijzigd is; als A roep elke beheerroute uit contracts/api.md aan (ook met het id van B) → `403` (SC-003, SC-004); latere stories voegen hun routes aan `ORGANISATION_ROUTES` toe
- [X] T056 [P] [US3] Frontend-test `frontend/tests/router.test.js`: met een organisatiesessie (gemockte `GET /api/auth/me`) leiden `/admin` en `/admin/organisations/new` naar `/admin/login`; zonder sessie leidt `/` naar `/login?redirect=/` en `/videos` naar `/login?redirect=/videos`; als beheerder leidt `/admin/login` naar `/admin` (contracts/ui.md)

### Implementation for User Story 3

- [X] T057 [US3] Controleer `backend/src/modules/organisationSelf/`, `backend/src/modules/auth/` en `backend/src/middleware/requireOrganisation.js`: geen route onder `/api/organisation` leest een organisatie-id uit `req.params`, `req.query` of `req.body`; voeg in `backend/src/app.js` bij het koppelen van `/api/organisation` Engels commentaar toe dat elke toekomstige route daar `getOrganisationId(req)` MUST gebruiken (research R8); los alle bevindingen uit T055/T056 op

**Checkpoint**: alle P1-stories klaar; de MVP is af

---

## Phase 6: User Story 4 - Beheerder beheert organisaties en wachtwoorden (Priority: P2)

**Goal**: naam en code wijzigen, wachtwoord resetten, organisatie zacht verwijderen, logboek
inzien

**Independent Test**: organisatie aanmaken, naam en code wijzigen, wachtwoord resetten,
verwijderen en het logboek controleren (quickstart scenario's 13–16)

### Tests for User Story 4

- [X] T058 [P] [US4] Integratietests in `backend/tests/integration/organisationsManage.test.js`: `PATCH` naam → `200` en `GET /api/organisation` van die organisatie toont de nieuwe naam; `PATCH` zonder velden → `400`; `PATCH` code naar een bezette code (ook van een verwijderde organisatie) → `409`; `PATCH` met dezelfde code in kleine letters → `200` zonder sessies te beëindigen; `PATCH` naar een nieuwe code → een bestaande sessie van de organisatie geeft daarna `401 session_expired` en alleen de nieuwe code werkt (FR-010); `PUT .../password` met 9 tekens → `400`; `PUT .../password` → `204`, oud wachtwoord faalt, nieuw werkt, en een **bestaande sessie blijft geldig** (FR-010); `DELETE` → `204`, organisatie niet meer in de lijst, inloggen faalt, bestaande sessie geeft `401 session_expired`, nieuwe organisatie met dezelfde code → `409`, tweede `DELETE` en `PATCH`/`PUT` op de verwijderde organisatie → `404`; logregels `update` (met `details` `{ name: { old, new } }` en/of `{ loginCode: { old, new } }`, alleen gewijzigde velden), `passwordReset` (`details` `NULL`) en `delete`; nergens een wachtwoord of hash in `AdminActionLog`
- [X] T059 [P] [US4] Integratietests in `backend/tests/integration/actionLog.test.js`: `GET /api/admin/action-log` geeft nieuwste eerst (bij gelijke `createdAt` hoogste `id` eerst), `page`, `pageSize` 50, `total`, `administrator` (gebruikersnaam) en `organisation: { id, name, deleted: true }` voor een verwijderde organisatie; 51 regels → pagina 2 bevat er 1; `PUT`/`PATCH`/`DELETE` op `/api/admin/action-log` en `/api/admin/action-log/1` → `404`; als organisatie → `403`

### Implementation for User Story 4

- [X] T060 [US4] Breid `backend/src/modules/organisations/organisationRepository.js` uit met `updateOrganisation(trx, id, { name?, loginCode? })`, `updatePasswordHash(trx, id, hash)` en `softDelete(trx, id)` (zet `deletedAt = UTC_TIMESTAMP()`, alleen als `deletedAt IS NULL`)
- [X] T061 [US4] Breid `backend/src/modules/organisations/organisationService.js` uit: `updateOrganisation(id, { name?, loginCode? }, administratorId)` (minstens één veld, zelfde validatie als bij aanmaken, uniciteit met `excludeId`, `404` voor onbekend/verwijderd; als de genormaliseerde `loginCode` echt verandert in dezelfde transactie `deleteByOrganisationId`; logregel `update` met alleen gewijzigde velden als `{ old, new }`), `resetPassword(id, password, administratorId)` (valideren, hashen, logregel `passwordReset` met `details: null`; sessies **niet** beëindigen) en `deleteOrganisation(id, administratorId)` (`softDelete`, `deleteByOrganisationId`, logregel `delete`, alles in één transactie) (FR-008 – FR-012, FR-027)
- [X] T062 [US4] Voeg `PATCH /api/admin/organisations/:id`, `PUT /api/admin/organisations/:id/password` en `DELETE /api/admin/organisations/:id` toe aan `backend/src/modules/organisations/adminOrganisationRoutes.js` (`:id` als positief geheel getal, anders `404`; statuscodes uit contracts/api.md), plus `GET /api/admin/organisations/:id` voor het wijzigformulier (zelfde vorm als in de lijst, `404` voor verwijderd)
- [X] T063 [US4] Maak `backend/src/modules/actionLog/actionLogService.js` en `backend/src/modules/actionLog/actionLogRoutes.js` met `GET /api/admin/action-log?page=` (`page` ≥ 1, standaard 1; 50 per pagina; `ORDER BY createdAt DESC, id DESC`; join met `Administrator.username` en `Organisation.name`; `deleted` op basis van `deletedAt`; `createdAt` als ISO-string in UTC); koppel in `backend/src/app.js` onder `/api/admin` achter `requireAdmin`
- [X] T064 [P] [US4] Breid `frontend/src/views/admin/OrganisationFormView.vue` uit met een wijzigmodus (route `/admin/organisations/:id`: naam en code vooraf ingevuld via `GET /api/admin/organisations/:id`, geen automatische suggestie, melding dat een codewijziging de organisatie uitlogt) en een aparte sectie "Wachtwoord opnieuw instellen" met eigen veld, eigen opslaan-knop en bevestigingstoast
- [X] T065 [P] [US4] Voeg aan `frontend/src/views/admin/OrganisationListView.vue` per rij de knoppen "Wijzigen" (naar `/admin/organisations/:id`) en "Verwijderen" toe; verwijderen vraagt eerst bevestiging via `confirmDialog` uit `frontend/src/lib/ui.js` met de naam van de organisatie in de tekst (`danger: true`) en doet niets bij annuleren (FR-011); na verwijderen de lijst verversen
- [X] T066 [P] [US4] Maak `frontend/src/views/admin/ActionLogView.vue`: tabel met datum/tijd (lokale tijd, `nl-NL`), beheerder, actie in het Nederlands (aangemaakt, gewijzigd, verwijderd, wachtwoord gereset), organisatie (met "(verwijderd)" indien `deleted`) en de details als "oud → nieuw"; knoppen vorige/volgende pagina op basis van `total`
- [X] T067 [US4] Voeg aan `frontend/src/router.js` de kinderen `organisations/:id` (`OrganisationFormView`) en `log` (`ActionLogView`) van `/admin` toe en de navigatielink "Logboek" aan `frontend/src/components/AdminLayout.vue`

**Checkpoint**: User Stories 1–4 werken; volledig beheer van organisaties

---

## Phase 7: User Story 5 - Organisatie stelt haar huisstijl in (Priority: P3)

**Goal**: primaire kleur, secundaire kleur en logo instellen, met terugval op de
standaardhuisstijl

**Independent Test**: organisatie zonder huisstijl ziet de standaard; kleuren en logo instellen
en terugzien; een andere organisatie ziet nog de standaard (quickstart scenario's 10–12)

### Tests for User Story 5

- [X] T068 [P] [US5] Unittests in `backend/tests/unit/logoValidation.test.js`: geldige PNG en JPG (magic bytes) → `png`/`jpg`; tekstbestand met naam `.png` → `invalid_logo`; geldige SVG → `svg`; SVG met `<script>`, met een `on*`-attribuut (bijv. `onload`), met een externe `href`/`xlink:href` (`http:`, `https:`, `//`, `data:`), met `<foreignObject>` of met een andere root dan `<svg>` → `invalid_logo`
- [X] T069 [P] [US5] Integratietests in `backend/tests/integration/style.test.js`: zonder huisstijl alle onderdelen `isDefault: true` en `logo.url` = `/default-logo.svg`; `PUT` met `#0055a4` slaat `#0055A4` op en de secundaire kleur blijft standaard; ongeldige kleur (`red`, `#12345`) → `400` met `fields`; `null` zet terug naar standaard; logo-upload PNG → `200` en het bestand staat in `UPLOADS_DIR/logos/` als `<uuid>.png`; bestand van 3 MB → `413 logo_too_large` en vorig logo blijft; ongeldig bestand → `400 invalid_logo` en vorig logo blijft; vervangen verwijdert het oude bestand van schijf; `DELETE .../logo` geeft standaardlogo en verwijdert het bestand; `DELETE /api/organisation/style` verwijdert de rij en het logobestand; een rij waarvan alle drie velden `NULL` worden, wordt verwijderd; voeg alle vijf stijlroutes toe aan `ORGANISATION_ROUTES` in `backend/tests/integration/organisationIsolation.test.js` en controleer daar dat de huisstijl van B na de pogingen van A ongewijzigd is

### Implementation for User Story 5

- [X] T070 [US5] Maak migratie `backend/src/db/migrations/20261021000005_create_organisation_style.js` voor tabel `OrganisationStyle`: `id` INT PK auto-increment; `organisationId` INT NOT NULL UNIQUE FK → `Organisation.id` ("0 of 1 huisstijl per organisatie"); `primaryColour` CHAR(7) NULL ("`^#[0-9A-F]{6}$` (opgeslagen in hoofdletters); `NULL` = standaard"); `secondaryColour` CHAR(7) NULL (idem); `logoImage` VARCHAR(255) NULL ("bestandsnaam in `uploads/logos/` (UUID + `.png`/`.jpg`/`.svg`); `NULL` = standaardlogo")
- [X] T071 [P] [US5] Maak `backend/src/lib/logoValidation.js` met `detectLogoType(buffer)` die `png`, `jpg` of `svg` teruggeeft of een `AppError(400, 'invalid_logo', 'Gebruik een PNG-, JPG- of SVG-afbeelding.')` gooit (PNG/JPG op magic bytes; SVG: UTF-8-tekst die als XML met `<svg>`-root te lezen is, zonder `<script>`, `<foreignObject>`, `on*`-attributen of `href`/`xlink:href` naar `http:`, `https:`, `//` of `data:`) (research R7, FR-025)
- [X] T072 [P] [US5] Maak `backend/src/modules/style/styleRepository.js` met `findByOrganisationId(organisationId)`, `upsertStyle(organisationId, fields)` (insert of update op de unieke `organisationId`) en `deleteByOrganisationId(organisationId)`; elke functie heeft `organisationId` als verplichte eerste parameter en gooit een fout als die ontbreekt (research R8)
- [X] T073 [US5] Maak `backend/src/modules/style/styleService.js`: `getEffectiveStyle(organisationId)` (per onderdeel eigen waarde of waarde uit `backend/src/config/defaultStyle.js`, met `isDefault`; logo-URL `/media/logos/<bestandsnaam>` of `defaultStyle.logoUrl`), `updateColours(organisationId, { primaryColour, secondaryColour })` (hoofdletters, regex `^#[0-9A-F]{6}$`, `null` = standaard, rij verwijderen als alle drie velden `NULL` zijn), `replaceLogo(organisationId, buffer)` (type bepalen, opslaan als `<crypto.randomUUID()>.<ext>` in `UPLOADS_DIR/logos/` (map aanmaken als hij ontbreekt), database bijwerken, daarna het oude bestand verwijderen; bij een fout het nieuwe bestand opruimen), `removeLogo(organisationId)` en `resetStyle(organisationId)` (rij en logobestand verwijderen); alle functies geven de effectieve huisstijl terug (FR-023, FR-024)
- [X] T074 [US5] Maak `backend/src/modules/style/styleRoutes.js` met `GET /api/organisation/style`, `PUT /api/organisation/style`, `PUT /api/organisation/style/logo` (multer `memoryStorage`, veld `logo`, `limits.fileSize` 2 × 1024 × 1024), `DELETE /api/organisation/style/logo` en `DELETE /api/organisation/style`, allemaal met `getOrganisationId(req)`; koppel in `backend/src/app.js` onder `/api/organisation` achter `requireOrganisation`
- [X] T075 [P] [US5] Maak `frontend/src/stores/style.js` (Pinia): state met de effectieve huisstijl; `loadStyle()` via `GET /api/organisation/style`; `applyStyle()` zet `--brand`, `--brand-ink` (via `inkFor` uit `frontend/src/lib/util.js`), `--brand-2` en `--brand-2-ink` op `document.documentElement` en levert `logoUrl`; `applyDefault()` doet hetzelfde met de waarden uit `frontend/src/config/defaultStyle.js`; acties `saveColours`, `uploadLogo(file)`, `removeLogo`, `resetStyle` die de API aanroepen en daarna `applyStyle()`
- [X] T076 [US5] Maak `frontend/src/views/StyleSettingsView.vue` op basis van de huisstijlsectie uit `frontend/src/views/OrganisationView.vue`: twee kleurkiezers met voorbeeld (opslaan via `saveColours`), logo-upload (`accept=".png,.jpg,.jpeg,.svg"`, maximaal 2 MB; foutmelding uit de API tonen, vorig logo blijft zichtbaar) met voorbeeld, knoppen "Logo verwijderen" en "Terug naar standaard" (via `confirmDialog`); na opslaan direct `applyStyle()` (SC-006); verwijder daarna `frontend/src/views/OrganisationView.vue` (de prototypekaart "Koppelcode" verdwijnt: zelfregistratie bestaat niet, FR-003, en de Quest-koppelcode valt buiten deze feature)
- [X] T077 [US5] Pas `frontend/src/router.js` aan: route `/settings/style` (`StyleSettingsView`, kind van de `OrganisationLayout`-route) en `/organisation` → redirect naar `/settings/style`; pas `frontend/src/components/OrganisationLayout.vue` aan: navigatielink "Huisstijl", logo uit `style.logoUrl` via `OrgLogo` en `loadStyle()` + `applyStyle()` bij het mounten; roep `applyDefault()` aan in `AdminLayout.vue`, `LoginView.vue`, `AdminLoginView.vue` en na `auth.logout()` (FR-026); vervang in `OrganisationLayout.vue` de `watchEffect` op `app.branding` (verhuisd in T030) door de style-store, en verwijder `updateBranding`/`branding` uit `frontend/src/stores/app.js` als niets ze meer gebruikt

**Checkpoint**: alle user stories werken zelfstandig

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: documentatie, ERD, controles

- [X] T078 [P] Werk het ERD `docs/Diagrams.simp` handmatig bij in Software Ideas Modeler volgens [data-model.md § ERD-wijzigingen](data-model.md#erd-wijzigingen): `Organisation.deletedAt DATETIME NULL`, entiteit `Session` (met `lastActivityAt` en index daarop), entiteit `AdminActionLog`, `OrganisationStyle.organisationId` uniek (constitution: Bronnen en domeinregels)
- [X] T079 [P] Werk `README.md` in de root bij (Nederlands): vereisten, `.env` aanmaken uit `.env.example`, `nginx/dev-cert.sh`, `docker compose up -d --build`, migraties, `create-admin.js`, tests draaien (`docker compose --profile test run --rm api-test` en `docker compose run --rm web-build npm test`), `SESSION_IDLE_TIMEOUT_MINUTES` en de opmerking dat productie een echt TLS-certificaat nodig heeft; werk `frontend/README.md` bij zodat er niet meer staat dat alles alleen in de browser leeft
- [X] T080 Draai `npm run lint` in `backend/` en `frontend/` en los alle meldingen op; controleer in alle code (ook het bestaande prototype in `frontend/src/`) dat namen, routes, commentaar, foutcodes en logregels Engels zijn en dat Nederlands alleen in UI-teksten en API-meldingen voor de klant staat; vertaal Nederlandse woorden in bestaand commentaar (bijv. "huisstijl" in `frontend/src/App.vue`) (constitution VI)
- [X] T081 Beveiligingscontrole: `git ls-files` bevat geen `.env`, certificaten of geheimen; cookie-flags in `backend/src/middleware/session.js` (`HttpOnly`, `Secure`, `SameSite=Strict`, geen `Max-Age`/`Expires`); `/media/`-headers in `nginx/default.conf`; logregels en API-responses bevatten nergens wachtwoorden of `passwordHash`; de frontend doet geen verzoeken op de achtergrond (zoek naar `setInterval`/polling in `frontend/src/`)
- [X] T082 Voer alle scenario's uit [quickstart.md](quickstart.md) uit (1–17, 13b en de sessiescenario's 18–24 met `SESSION_IDLE_TIMEOUT_MINUTES=2`, daarna terug naar 60) plus `docker compose --profile test run --rm api-test` en `docker compose run --rm web-build npm test`, en noteer afwijkingen

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: geen afhankelijkheden
- **Foundational (Phase 2)**: na Setup; blokkeert alle user stories
- **User Stories (Phase 3–7)**: na Foundational
- **Polish (Phase 8)**: na de gewenste user stories (T078 en T079 kunnen al eerder)

### User Story Dependencies

- **US1 (P1)**: alleen Foundational
- **US2 (P1)**: Foundational; de backendtests gebruiken `createOrganisationRow` en zijn dus los van US1; voor de handmatige test is een organisatie nodig, dus in de praktijk na US1
- **US3 (P1)**: na US2 (heeft organisatieroutes nodig om te testen) en US1 (beheerroutes in de isolatietest)
- **US4 (P2)**: na US1 (breidt de organisatiemodule en beheerschermen uit)
- **US5 (P3)**: na US2 (organisatiesessie en `OrganisationLayout`); breidt de isolatietest van US3 uit
- US4 en US5 raken verschillende bestanden, behalve `frontend/src/router.js` en `backend/src/app.js` (kleine, losse toevoegingen), en kunnen parallel na US3

### Within Each User Story

- Tests eerst schrijven en laten falen
- Migratie → repository → service → routes → frontend-view → router
- Story afronden en valideren vóór de volgende prioriteit

### Parallel Opportunities

- Setup: T002, T003, T004, T005, T007, T009 parallel
- Foundational: T015, T016, T018 parallel met T010–T014; daarna T021, T022, T027 parallel; frontend T028, T029, T031, T032 parallel met de hele backend-basis
- US1: T033–T036 parallel; daarna T037, T039, T044, T045 parallel
- US2: T048, T049 parallel; T052, T053 parallel
- US3: T055, T056 parallel
- US4: T058, T059 parallel; T064, T065, T066 parallel
- US5: T068, T069 parallel; T071, T072, T075 parallel
- US4 en US5 kunnen na US3 door twee mensen tegelijk worden opgepakt

---

## Parallel Example: Foundational

```bash
# Backend-bouwstenen zonder database tegelijk:
Task: "backend/src/lib/password.js"
Task: "backend/src/lib/errors.js"
Task: "backend/src/middleware/csrf.js"

# Frontend-basis tegelijk met de backend:
Task: "frontend/src/api/client.js"
Task: "frontend/src/stores/auth.js"
Task: "standaardhuisstijl in backend/src/config/defaultStyle.js en frontend/src/config/defaultStyle.js"
```

## Parallel Example: User Story 1

```bash
# Tests voor User Story 1 tegelijk:
Task: "Unittests codes in backend/tests/unit/codes.test.js"
Task: "Unittests wachtwoorden in backend/tests/unit/password.test.js"
Task: "Integratietests beheerderslogin in backend/tests/integration/adminAuth.test.js"
Task: "Integratietests organisatie aanmaken in backend/tests/integration/organisationsCreate.test.js"

# Onafhankelijke bouwstenen tegelijk:
Task: "backend/src/lib/codes.js"
Task: "backend/src/modules/actionLog/actionLogRepository.js"
Task: "frontend/src/views/AdminLoginView.vue"
Task: "frontend/src/components/AdminLayout.vue + frontend/src/views/admin/OrganisationListView.vue"
```

## Parallel Example: User Story 4

```bash
Task: "Integratietests beheer in backend/tests/integration/organisationsManage.test.js"
Task: "Integratietests logboek in backend/tests/integration/actionLog.test.js"
Task: "Wijzigmodus in frontend/src/views/admin/OrganisationFormView.vue"
Task: "Verwijderknop in frontend/src/views/admin/OrganisationListView.vue"
Task: "frontend/src/views/admin/ActionLogView.vue"
```

## Parallel Example: User Story 5

```bash
Task: "Unittests logo-validatie in backend/tests/unit/logoValidation.test.js"
Task: "Integratietests huisstijl in backend/tests/integration/style.test.js"
Task: "backend/src/lib/logoValidation.js"
Task: "backend/src/modules/style/styleRepository.js"
Task: "frontend/src/stores/style.js"
```

---

## Implementation Strategy

### MVP First (User Stories 1–3)

1. Phase 1 Setup en Phase 2 Foundational afronden (inclusief de sessietests)
2. US1: beheerder logt in en maakt organisaties aan → valideren
3. US2: docent logt in → valideren
4. US3: isolatie aantonen → valideren
5. **STOP**: dit is het minimum om de rest van de workflow (cursussen, publiceren, Quest) op te bouwen

### Incremental Delivery

1. Setup + Foundational
2. US1 → US2 → US3 (MVP)
3. US4 (beheer en logboek)
4. US5 (huisstijl, Should-requirement; mag volgens de stakeholderprioriteit wachten tot de cursusworkflow werkt; tot die tijd gebruikt het prototype de standaardhuisstijl)
5. Polish

---

## Notes

- [P] = verschillende bestanden, geen afhankelijkheid van onafgemaakte taken
- Commit na elke taak of logische groep op `Development`
- Sessieregels (FR-019, 2026-10-21): sessiecookie zonder vervaldatum + 60 minuten glijdende time-out in de database, voor beheerder en organisatie gelijk; elk geauthenticeerd verzoek verlengt; verlopen → `401 session_expired`; opruimen elke 15 minuten (T019–T022, T027)
- FR-010 geldt alleen voor codewijziging en verwijderen; een wachtwoordreset laat sessies staan (T058, T061)
- Geen blokkering of vertraging na mislukte inlogpogingen (FR-018) en geen logging van inlogpogingen (FR-029): niet toevoegen
- Cursussen en video's in `frontend/` blijven prototype (`localStorage`) en vallen buiten deze feature; ze komen alleen achter de organisatielogin
