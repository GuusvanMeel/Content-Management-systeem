---

description: "Takenlijst voor de feature Organisaties, accounts en inloggen"
---

# Tasks: Organisaties, accounts en inloggen

**Input**: Design documents from `/specs/001-organisation-accounts-login/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md),
[contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md)

**Tests**: het plan (research R12) en [quickstart.md](quickstart.md) vragen om
integratietests tegen een echte MariaDB, met name de isolatietest voor SC-003. Per user story
zijn daarom gerichte testtaken opgenomen; schrijf ze vóór de implementatie en controleer dat
ze eerst falen.

**Organization**: taken zijn gegroepeerd per user story, zodat elke story los te bouwen en te
testen is.

**Conventies** (constitution VI): code, bestands-, tabel- en veldnamen in het Engels;
commentaar en documentatie in het Nederlands; UI-teksten in het Nederlands. Tabel- en
veldnamen exact zoals in [data-model.md](data-model.md).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Paden zijn relatief aan de repository-root (webapp: `backend/`, `frontend/`, `nginx/`)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: projectstructuur, dependencies en containers

- [ ] T001 Maak de mappen `backend/`, `frontend/` en `nginx/` aan volgens plan.md en breid `.gitignore` in de root uit met `.env`, `node_modules/`, `dist/`, `uploads/`, `nginx/certs/` en `docs/*.simp.user`
- [ ] T002 [P] Maak `backend/package.json` met `"type": "module"`, dependencies `express@5`, `knex`, `mysql2`, `argon2`, `multer`, `cookie-parser`, devDependencies `vitest`, `supertest`, `eslint`, en scripts `start` (`node src/server.js`), `test` (`vitest run`), `migrate` (`knex migrate:latest`)
- [ ] T003 [P] Maak de Vue 3-app met Vite in `frontend/` (`frontend/package.json`, `frontend/vite.config.js`, `frontend/index.html`) met dependencies `vue`, `vue-router`, `pinia`, devDependencies `vitest`, `@vue/test-utils`, `jsdom`, `eslint`; in `vite.config.js` een dev-proxy van `/api` en `/media` naar `http://localhost:3000`
- [ ] T004 [P] Maak `.env.example` in de root met (zonder waarden) `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_ROOT_PASSWORD`, `TEST_DB_NAME`, `API_PORT`, `UPLOADS_DIR`, `COOKIE_SECURE` en Nederlandse toelichting per variabele (constitution IV)
- [ ] T005 [P] Maak `backend/Dockerfile` op basis van `node:22-alpine` (`npm ci --omit=dev`, `CMD ["node", "src/server.js"]`) en `frontend/Dockerfile` als multi-stage build (stage `build` met `npm ci && npm run build`, eindstage `nginx:stable-alpine` die `dist/` naar `/usr/share/nginx/html` kopieert en `nginx/default.conf` gebruikt)
- [ ] T006 Maak `nginx/default.conf`: HTTP → HTTPS-redirect; HTTPS met certificaten uit `/etc/nginx/certs/`; frontend uit `/usr/share/nginx/html` met SPA-fallback naar `index.html`; `location /api/` → `proxy_pass http://api:3000`; `location /media/` → `alias /data/uploads/` met headers `X-Content-Type-Options: nosniff` en `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` (research R7); `client_max_body_size 3m`
- [ ] T007 [P] Maak `nginx/dev-cert.sh` dat met `openssl` een zelfondertekend certificaat voor `localhost` in `nginx/certs/` zet (map staat in `.gitignore`), met Nederlands commentaar
- [ ] T008 Maak `docker-compose.yml` met services `db` (`mariadb:11.8`, volume `db-data`, variabelen uit `.env`), `api` (build `backend/`, `depends_on: db`, volume `uploads:/data/uploads`), `web` (build `frontend/`, poorten 80 en 443, volume `uploads:/data/uploads:ro`, `./nginx/certs:/etc/nginx/certs:ro`) en onder profiel `test` de services `db-test` (`mariadb:11.8`, `tmpfs` voor data) en `api-test` (build `backend/` met devDependencies, `command: npm test`, `depends_on: db-test`)
- [ ] T009 [P] Maak ESLint-configuratie in `backend/eslint.config.js` en `frontend/eslint.config.js` (ES modules, `no-unused-vars`, voor de frontend `eslint-plugin-vue`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: configuratie, database, sessies, foutafhandeling en frontend-basis die alle stories nodig hebben

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [ ] T010 Maak `backend/src/config/env.js` dat alle variabelen uit `.env.example` inleest, verplichte variabelen controleert en bij een ontbrekende variabele met een duidelijke Nederlandse foutmelding stopt; exporteer een bevroren config-object
- [ ] T011 Maak `backend/knexfile.js` en `backend/src/db/knex.js` (client `mysql2`, `charset: 'utf8mb4'`, `timezone: 'Z'`, migraties in `backend/src/db/migrations/`, aparte configuratie `test` die `TEST_DB_NAME` gebruikt)
- [ ] T012 Maak migratie `backend/src/db/migrations/20261021000001_create_administrator.js` voor tabel `Administrator`: `id` INT PK auto-increment; `username` VARCHAR(100) NOT NULL UNIQUE; `passwordHash` VARCHAR(255) NOT NULL
- [ ] T013 Maak migratie `backend/src/db/migrations/20261021000002_create_organisation.js` voor tabel `Organisation`: `id` INT PK auto-increment; `name` VARCHAR(255) NOT NULL; `loginCode` VARCHAR(50) NOT NULL UNIQUE; `passwordHash` VARCHAR(255) NOT NULL; `questLinkCode` VARCHAR(50) NOT NULL UNIQUE; `deletedAt` DATETIME NULL ("`NULL` = actief")
- [ ] T014 Maak migratie `backend/src/db/migrations/20261021000003_create_session.js` voor tabel `Session`: `id` INT PK auto-increment; `tokenHash` CHAR(64) NOT NULL UNIQUE ("SHA-256 (hex) van het cookie-token"); `administratorId` INT NULL FK → `Administrator.id`; `organisationId` INT NULL FK → `Organisation.id` met index; `createdAt` DATETIME NOT NULL; `lastUsedAt` DATETIME NOT NULL; `CHECK ((administratorId IS NULL) <> (organisationId IS NULL))`
- [ ] T015 [P] Maak `backend/src/lib/password.js` met `hashPassword(plain)` en `verifyPassword(hash, plain)` via argon2id (standaardparameters van het pakket) en `validatePassword(plain)` die een fout geeft als de lengte niet tussen 10 en 128 tekens ligt (FR-013, research R5)
- [ ] T016 [P] Maak `backend/src/lib/errors.js` met klasse `AppError(status, code, message, fields?)` en hulpfuncties `validationError(fields)` (400 `validation_failed`), `notFound()` (404), `conflict(fields)` (409), `notAuthenticated()` (401), `forbidden()` (403)
- [ ] T017 Maak `backend/src/middleware/errorHandler.js` die elke fout omzet naar `{ "error": { "code", "message", "fields"? } }` (contracts/api.md), multer-fout `LIMIT_FILE_SIZE` omzet naar `413 logo_too_large` met melding "Het logo mag maximaal 2 MB zijn.", en onbekende fouten logt en als `500` met een algemene Nederlandse melding teruggeeft
- [ ] T018 [P] Maak `backend/src/middleware/csrf.js` die bij `POST`, `PUT`, `PATCH` en `DELETE` de header `X-Requested-With: cms` eist, anders `403 csrf_header_missing` (research R4)
- [ ] T019 Maak `backend/src/modules/auth/sessionRepository.js` met `createSession({ administratorId?, organisationId? })` (genereert 32 willekeurige bytes als token, slaat alleen de SHA-256-hex op, geeft het token terug), `findByToken(token)`, `deleteByToken(token)`, `deleteByOrganisationId(organisationId, trx?)` en `touch(id)` (werkt `lastUsedAt` hooguit eens per minuut bij)
- [ ] T020 Maak `backend/src/middleware/session.js`: leest cookie `sid`, zoekt de sessie op en zet `req.auth` op `{ role: 'admin', administratorId, username }` of `{ role: 'organisation', organisationId }` (alleen als de organisatie `deletedAt IS NULL` heeft); exporteer `setSessionCookie(res, token)` (`HttpOnly`, `Secure` volgens `COOKIE_SECURE`, `SameSite=Strict`, `Path=/`, `Max-Age` 400 dagen, bij elk geldig verzoek opnieuw gezet) en `clearSessionCookie(res)`; geen vervaltijd op de sessie zelf (FR-019)
- [ ] T021 [P] Maak `backend/src/middleware/requireAdmin.js` en `backend/src/middleware/requireOrganisation.js` (zonder sessie `401 not_authenticated`, met verkeerde rol `403 forbidden`); `requireOrganisation.js` exporteert ook `getOrganisationId(req)` die het id uitsluitend uit `req.auth` haalt (research R8)
- [ ] T022 Maak `backend/src/modules/auth/authRoutes.js` met `POST /api/auth/logout` (altijd `204`, sessierij verwijderen en cookie wissen) en `GET /api/auth/me` (vorm per rol zoals in contracts/api.md, organisatienaam en `loginCode` uit de database; zonder sessie `401`)
- [ ] T023 Maak `backend/src/app.js` (exporteert `createApp()`: `express.json()`, `cookie-parser`, `csrf`, `session`, routers onder `/api`, `errorHandler` als laatste) en `backend/src/server.js` (start op `API_PORT`)
- [ ] T024 Maak `backend/scripts/create-admin.js`: gebruikersnaam als argument (getrimd, 3–100 tekens, uniek), wachtwoord twee keer verborgen vragen via `readline` (nooit als argument, research R10), controleren met `validatePassword`, opslaan met `hashPassword`; Nederlandse meldingen en exitcode ≠ 0 bij fouten
- [ ] T025 Maak testinfrastructuur: `backend/vitest.config.js` (tests sequentieel, `globalSetup` voert migraties uit op de testdatabase) en `backend/tests/helpers/testApp.js` met `resetDatabase()` (alle tabellen leegmaken), `createAdmin(username, password)`, `createOrganisationRow({ name, loginCode, password })` en `loginAs(...)` die een Supertest-agent met cookie en header `X-Requested-With: cms` teruggeeft
- [ ] T026 [P] Maak `frontend/src/api/client.js`: fetch-wrapper met `credentials: 'same-origin'`, JSON, header `X-Requested-With: cms`; zet het foutformaat om naar een `ApiError` met `code`, `message`, `fields`; bij `401` buiten de inlogverzoeken: doorsturen naar `/login` of `/admin/login` (afhankelijk van de huidige route) met de melding "Je bent uitgelogd. Log opnieuw in." (contracts/ui.md)
- [ ] T027 [P] Maak `frontend/src/stores/auth.js` (Pinia): `fetchMe()` via `GET /api/auth/me`, state `role`, `username`, `organisation`, actie `logout()` via `POST /api/auth/logout`
- [ ] T028 Maak `frontend/src/main.js`, `frontend/src/App.vue` en `frontend/src/router/index.js` met een globale guard die op `meta.requiresAdmin`, `meta.requiresOrganisation` en `meta.guestOnly` reageert zoals in de tabel van contracts/ui.md (nog zonder routes; die komen per story)
- [ ] T029 [P] Maak `backend/src/config/defaultStyle.js` en `frontend/src/config/defaultStyle.js` met dezelfde standaardkleuren (`primaryColour`, `secondaryColour` als `#RRGGBB`) en het pad van het standaardlogo, plus `frontend/src/assets/default-logo.svg` en `frontend/src/styles/theme.css` met CSS-variabelen `--colour-primary` en `--colour-secondary`; commentaar in beide config-bestanden dat ze gelijk moeten blijven (research R9)

**Checkpoint**: fundament klaar: containers starten, migraties draaien, `GET /api/auth/me` geeft `401`

---

## Phase 3: User Story 1 - Beheerder logt in en maakt een organisatie aan (Priority: P1) 🎯 MVP

**Goal**: de beheerder logt in op de beheeromgeving, ziet het overzicht en maakt organisaties aan met een voorgestelde code; elke aanmaak staat in het logboek

**Independent Test**: inloggen als beheerder (via `create-admin.js`), een organisatie aanmaken en controleren dat die met naam en code in het overzicht staat (quickstart scenario's 1–6)

### Tests for User Story 1

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation**

- [ ] T030 [P] [US1] Unittests in `backend/tests/unit/codes.test.js`: `normalizeLoginCode(' zwembad-a ')` → `ZWEMBAD-A`; suggestie "Zwembad De Hoven" → `ZWEMBAD-DE-HOVEN`; "Café Ëiland!" → `CAFE-EILAND`; lange naam wordt ingekort tot 46 tekens; regex `^[A-Z0-9][A-Z0-9-]{1,48}[A-Z0-9]$` weigert `-AB`, `AB-`, `A`; `generateQuestLinkCode()` geeft 8 tekens uit het Crockford-base32-alfabet zonder `-`
- [ ] T031 [P] [US1] Integratietests in `backend/tests/integration/adminAuth.test.js`: juiste login → `204` + cookie `sid`; fout wachtwoord en onbekende gebruiker → `401 invalid_credentials` met exact "Gebruikersnaam of wachtwoord onjuist."; `GET /api/auth/me` als beheerder; `GET /api/admin/organisations` zonder sessie → `401`; schrijvend verzoek zonder `X-Requested-With` → `403`; er bestaat geen registratieroute (`POST /api/auth/register` → `404`, FR-003)
- [ ] T032 [P] [US1] Integratietests in `backend/tests/integration/organisationsCreate.test.js`: aanmaken → `201` met gegenereerde `questLinkCode`; wachtwoord van 9 tekens → `400` met `fields.password`; naam met alleen spaties → `400`; code `zwembad-a` als `ZWEMBAD-A` al bestaat → `409` met `fields.loginCode`; code gelijk aan een bestaande `questLinkCode` → `409`; code-suggestie geeft `-2` als de basiscode bezet is; lijst gesorteerd op naam zonder verwijderde organisaties; na aanmaken één `AdminActionLog`-rij met `action = 'create'` en zonder wachtwoord of hash in `details`

### Implementation for User Story 1

- [ ] T033 [P] [US1] Maak `backend/src/lib/codes.js`: `normalizeLoginCode` (trimmen, hoofdletters), `isValidLoginCode` met regex `^[A-Z0-9][A-Z0-9-]{1,48}[A-Z0-9]$` (3–50 tekens), `suggestLoginCodeBase(name)` (Unicode NFD, accenten weg, hoofdletters, elke reeks tekens buiten `A-Z0-9` → `-`, `-` aan begin/eind weg, inkorten tot 46 tekens) en `generateQuestLinkCode()` (8 tekens uit `0123456789ABCDEFGHJKMNPQRSTVWXYZ` via `crypto.randomInt`) (research R6)
- [ ] T034 [US1] Maak migratie `backend/src/db/migrations/20261021000004_create_admin_action_log.js` voor tabel `AdminActionLog`: `id` INT PK auto-increment; `administratorId` INT NOT NULL FK → `Administrator.id`; `organisationId` INT NOT NULL FK → `Organisation.id`; `action` ENUM(`create`, `update`, `delete`, `passwordReset`) NOT NULL; `details` JSON NULL ("nooit wachtwoorden of hashes"); `createdAt` DATETIME NOT NULL met index
- [ ] T035 [P] [US1] Maak `backend/src/modules/actionLog/actionLogRepository.js` met alleen `insertEntry(trx, { administratorId, organisationId, action, details })` (zet `createdAt`); geen update- of delete-functies (FR-028)
- [ ] T036 [US1] Maak `backend/src/modules/organisations/organisationRepository.js` met `listActive()` (`deletedAt IS NULL`, gesorteerd op `name`), `findActiveById(id)`, `isCodeTaken(code, { excludeId? })` (true als de code gelijk is aan een `loginCode` óf `questLinkCode` van welke organisatie dan ook, ook verwijderde) en `insertOrganisation(trx, row)`
- [ ] T037 [US1] Maak `backend/src/modules/organisations/organisationService.js` met `suggestCode(name)` (basis uit `suggestLoginCodeBase`, bij bezet `-2`, `-3`, ...; lege basis → `validationError`) en `createOrganisation({ name, loginCode, password }, administratorId)`: naam trimmen en 1–255 tekens, code normaliseren en valideren, `validatePassword`, bij bezette code `conflict({ loginCode: 'Deze code is al in gebruik.' })`, unieke `questLinkCode` genereren (opnieuw proberen bij botsing met een `loginCode` of `questLinkCode`), hashen, en in één transactie de organisatie invoegen plus `insertEntry` met `action: 'create'` en `details: { name, loginCode }` (FR-004, FR-005, FR-006, FR-027)
- [ ] T038 [US1] Maak `backend/src/modules/auth/authService.js` met `loginAdmin(username, password)`: gebruiker opzoeken, bij een onbekende gebruiker toch een argon2-verificatie tegen een vaste dummy-hash doen (gelijke responstijd), bij falen `401 invalid_credentials` "Gebruikersnaam of wachtwoord onjuist."; bij succes `createSession({ administratorId })`; voeg `POST /api/auth/admin/login` toe aan `backend/src/modules/auth/authRoutes.js` die `setSessionCookie` aanroept en `204` geeft
- [ ] T039 [US1] Maak `backend/src/modules/organisations/adminOrganisationRoutes.js` met `GET /api/admin/organisations`, `GET /api/admin/organisations/code-suggestion?name=` en `POST /api/admin/organisations` (responsevormen uit contracts/api.md) en koppel de router in `backend/src/app.js` achter `requireAdmin`
- [ ] T040 [P] [US1] Maak `frontend/src/views/AdminLoginView.vue`: velden gebruikersnaam en wachtwoord, foutmelding uit de API, na succes `fetchMe()` en naar `/admin`
- [ ] T041 [P] [US1] Maak `frontend/src/components/AdminLayout.vue` (kop met standaardhuisstijl, navigatie "Organisaties", knop "Uitloggen") en `frontend/src/views/admin/OrganisationListView.vue` (tabel met naam en organisatiecode, knop "Nieuwe organisatie")
- [ ] T042 [US1] Maak `frontend/src/views/admin/OrganisationFormView.vue` in aanmaakmodus: velden naam, organisatiecode en wachtwoord (hint "minimaal 10 tekens"); bij wijzigen van de naam na 300 ms een voorstel ophalen via de code-suggestie en invullen zolang de beheerder de code niet zelf heeft aangepast (FR-004a); veldfouten uit `fields` tonen; na succes naar `/admin`
- [ ] T043 [US1] Voeg routes `/admin/login` (`guestOnly`), `/admin` en `/admin/organisations/new` (`requiresAdmin`, binnen `AdminLayout`) toe aan `frontend/src/router/index.js`

**Checkpoint**: User Story 1 werkt zelfstandig: beheerder kan inloggen en organisaties aanmaken

---

## Phase 4: User Story 2 - Docent logt in namens een organisatie (Priority: P1)

**Goal**: een docent logt in met organisatiecode en wachtwoord en werkt namens die organisatie

**Independent Test**: organisatie aanmaken, inloggen op `/login` met de code (in kleine letters) en het wachtwoord, organisatienaam zien, uitloggen (quickstart scenario's 7, 8, 17)

### Tests for User Story 2

- [ ] T044 [P] [US2] Integratietests in `backend/tests/integration/organisationAuth.test.js`: login met code in kleine letters → `204`; fout wachtwoord, onbekende code, Quest-koppelcode als code en een organisatie met gevulde `deletedAt` → allemaal `401` met exact "Organisatiecode of wachtwoord onjuist." (FR-017); 10 mislukte pogingen gevolgd door een juiste → juiste slaagt meteen (FR-018); `GET /api/organisation` geeft eigen naam en code; na `POST /api/auth/logout` geeft `GET /api/auth/me` `401`

### Implementation for User Story 2

- [ ] T045 [US2] Voeg `loginOrganisation(loginCode, password)` toe aan `backend/src/modules/auth/authService.js` (code normaliseren, alleen organisaties met `deletedAt IS NULL`, dummy-hash bij onbekende code, geen blokkering of vertraging, `createSession({ organisationId })`) en route `POST /api/auth/organisation/login` aan `backend/src/modules/auth/authRoutes.js`
- [ ] T046 [US2] Maak `backend/src/modules/organisationSelf/organisationSelfRoutes.js` met `GET /api/organisation` (`{ id, name, loginCode }` op basis van `getOrganisationId(req)`) en koppel de router in `backend/src/app.js` achter `requireOrganisation`
- [ ] T047 [P] [US2] Maak `frontend/src/views/LoginView.vue`: velden organisatiecode en wachtwoord, tekst "Wachtwoord vergeten? Neem contact op met de beheerder." (FR-020), geen registratielink, foutmelding uit de API, na succes naar `/`
- [ ] T048 [P] [US2] Maak `frontend/src/components/OrganisationLayout.vue` (kop met logo en organisatienaam, knop "Uitloggen") en `frontend/src/views/HomeView.vue` (welkomsttekst met de naam van de organisatie)
- [ ] T049 [US2] Voeg routes `/login` (`guestOnly`) en `/` (`requiresOrganisation`, binnen `OrganisationLayout`) toe aan `frontend/src/router/index.js`

**Checkpoint**: User Stories 1 en 2 werken: beheerder maakt een organisatie aan, docent logt ermee in

---

## Phase 5: User Story 3 - Organisatie ziet alleen haar eigen gegevens (Priority: P1)

**Goal**: aantoonbaar dat een organisatie nooit gegevens van een andere organisatie of de beheeromgeving kan zien of wijzigen

**Independent Test**: twee organisaties; als A alle organisatieroutes aanroepen met id's van B in query en body, en alle beheerroutes aanroepen (quickstart "Isolatiecontrole")

### Tests for User Story 3

- [ ] T050 [P] [US3] Integratietest `backend/tests/integration/organisationIsolation.test.js`: maak organisaties A en B; als A roep elke route onder `/api/organisation` aan met extra `?organisationId=<B>` en `organisationId: <B>` in de body en controleer dat alleen gegevens van A terugkomen en B ongewijzigd is; als A roep elke route onder `/api/admin` aan → `403` (SC-003, SC-004); houd de lijst met organisatieroutes in één array bovenaan het bestand zodat latere stories routes kunnen toevoegen
- [ ] T051 [P] [US3] Frontend-test `frontend/tests/router.test.js`: met organisatiesessie leidt `/admin` en `/admin/organisations/new` naar `/admin/login`; zonder sessie leidt `/` naar `/login` (contracts/ui.md)

### Implementation for User Story 3

- [ ] T052 [US3] Controleer `backend/src/modules/organisationSelf/` en `backend/src/middleware/requireOrganisation.js`: geen route leest een organisatie-id uit `req.params`, `req.query` of `req.body`; voeg in `backend/src/app.js` commentaar toe dat elke toekomstige route onder `/api/organisation` `getOrganisationId(req)` MUST gebruiken (research R8); los alle bevindingen uit T050/T051 op

**Checkpoint**: alle P1-stories klaar; de MVP is af

---

## Phase 6: User Story 4 - Beheerder beheert organisaties en wachtwoorden (Priority: P2)

**Goal**: naam en code wijzigen, wachtwoord resetten, organisatie zacht verwijderen, logboek inzien

**Independent Test**: organisatie aanmaken, naam en code wijzigen, wachtwoord resetten, verwijderen en het logboek controleren (quickstart scenario's 13–16)

### Tests for User Story 4

- [ ] T053 [P] [US4] Integratietests in `backend/tests/integration/organisationsManage.test.js`: `PATCH` naam → `200`; `PATCH` zonder velden → `400`; `PATCH` code naar een bezette code → `409`; `PATCH` code → bestaande sessie van de organisatie geeft daarna `401` en alleen de nieuwe code werkt (FR-010); `PUT .../password` met 9 tekens → `400`; `PUT .../password` → oud wachtwoord faalt, nieuw werkt, en een **bestaande sessie blijft geldig** (FR-010: wachtwoordreset beëindigt geen sessies); `DELETE` → `204`, organisatie niet meer in de lijst, inloggen faalt, bestaande sessie geeft `401`, nieuwe organisatie met dezelfde code → `409`, tweede `DELETE` → `404`; logregels `update` (met `details` `{ name: { old, new } }` en/of `loginCode`), `passwordReset` (`details` null) en `delete`, nergens een wachtwoord of hash
- [ ] T054 [P] [US4] Integratietests in `backend/tests/integration/actionLog.test.js`: `GET /api/admin/action-log` geeft nieuwste eerst, `pageSize` 50, `total`, gebruikersnaam van de beheerder en `organisation.deleted: true` voor een verwijderde organisatie; er bestaan geen `PUT`/`PATCH`/`DELETE`-routes op `/api/admin/action-log` (→ `404`)

### Implementation for User Story 4

- [ ] T055 [US4] Breid `backend/src/modules/organisations/organisationRepository.js` uit met `updateOrganisation(trx, id, { name?, loginCode? })`, `updatePasswordHash(trx, id, hash)` en `softDelete(trx, id)` (zet `deletedAt = NOW()`)
- [ ] T056 [US4] Breid `backend/src/modules/organisations/organisationService.js` uit: `updateOrganisation(id, { name?, loginCode? }, administratorId)` (minstens één veld, zelfde validatie als bij aanmaken, uniciteit met `excludeId`, `404` voor onbekend/verwijderd; bij gewijzigde `loginCode` in dezelfde transactie `deleteByOrganisationId`; logregel `update` met alleen gewijzigde velden als `{ old, new }`), `resetPassword(id, password, administratorId)` (valideren, hashen, logregel `passwordReset` met `details: null`; sessies **niet** beëindigen) en `deleteOrganisation(id, administratorId)` (`softDelete`, `deleteByOrganisationId`, logregel `delete`, alles in één transactie)
- [ ] T057 [US4] Voeg `PATCH /api/admin/organisations/:id`, `PUT /api/admin/organisations/:id/password` en `DELETE /api/admin/organisations/:id` toe aan `backend/src/modules/organisations/adminOrganisationRoutes.js` (statuscodes uit contracts/api.md)
- [ ] T058 [US4] Maak `backend/src/modules/actionLog/actionLogService.js` en `backend/src/modules/actionLog/actionLogRoutes.js` met `GET /api/admin/action-log?page=` (50 per pagina, `ORDER BY createdAt DESC, id DESC`, join met `Administrator.username` en `Organisation.name`, `deleted` op basis van `deletedAt`); koppel in `backend/src/app.js` achter `requireAdmin`
- [ ] T059 [P] [US4] Breid `frontend/src/views/admin/OrganisationFormView.vue` uit met een wijzigmodus (naam en code vooraf ingevuld, geen automatische suggestie) en een aparte sectie "Wachtwoord opnieuw instellen" met eigen opslaan-knop en bevestigingsmelding
- [ ] T060 [P] [US4] Maak `frontend/src/components/ConfirmDialog.vue` en voeg aan `frontend/src/views/admin/OrganisationListView.vue` per rij de knoppen "Wijzigen" en "Verwijderen" toe; verwijderen vraagt eerst bevestiging met de naam van de organisatie en doet niets bij annuleren (FR-011)
- [ ] T061 [P] [US4] Maak `frontend/src/views/admin/ActionLogView.vue`: tabel met datum/tijd (lokale tijd), beheerder, actie in het Nederlands (aangemaakt, gewijzigd, verwijderd, wachtwoord gereset), organisatie (met "(verwijderd)" indien van toepassing) en de details; paginering
- [ ] T062 [US4] Voeg routes `/admin/organisations/:id` en `/admin/log` toe aan `frontend/src/router/index.js` en de navigatielink "Logboek" aan `frontend/src/components/AdminLayout.vue`

**Checkpoint**: User Stories 1–4 werken; volledig beheer van organisaties

---

## Phase 7: User Story 5 - Organisatie stelt haar huisstijl in (Priority: P3)

**Goal**: primaire kleur, secundaire kleur en logo instellen, met terugval op de standaardhuisstijl

**Independent Test**: organisatie zonder huisstijl ziet de standaard; kleuren en logo instellen en terugzien; een andere organisatie ziet nog de standaard (quickstart scenario's 10–12)

### Tests for User Story 5

- [ ] T063 [P] [US5] Unittests in `backend/tests/unit/logoValidation.test.js`: geldige PNG en JPG (magic bytes) toegestaan; tekstbestand met naam `.png` geweigerd; geldige SVG toegestaan; SVG met `<script>`, met een `on*`-attribuut (bijv. `onload`), met een externe `href`/`xlink:href` (`http:`, `https:`, `//`) of met een andere root dan `<svg>` geweigerd
- [ ] T064 [P] [US5] Integratietests in `backend/tests/integration/style.test.js`: zonder huisstijl alle onderdelen `isDefault: true`; `PUT` met `#0055a4` slaat `#0055A4` op; ongeldige kleur → `400`; `null` zet terug naar standaard; logo-upload PNG → `200` en bestand staat in `UPLOADS_DIR/logos/`; bestand van 3 MB → `413` en vorig logo blijft; ongeldig bestand → `400 invalid_logo` en vorig logo blijft; vervangen verwijdert het oude bestand; `DELETE .../logo` geeft standaardlogo; `DELETE /api/organisation/style` verwijdert de rij; voeg de stijlroutes toe aan de routelijst in `backend/tests/integration/organisationIsolation.test.js`

### Implementation for User Story 5

- [ ] T065 [US5] Maak migratie `backend/src/db/migrations/20261021000005_create_organisation_style.js` voor tabel `OrganisationStyle`: `id` INT PK auto-increment; `organisationId` INT NOT NULL UNIQUE FK → `Organisation.id`; `primaryColour` CHAR(7) NULL; `secondaryColour` CHAR(7) NULL; `logoImage` VARCHAR(255) NULL ("bestandsnaam in `uploads/logos/` (UUID + `.png`/`.jpg`/`.svg`); `NULL` = standaardlogo")
- [ ] T066 [P] [US5] Maak `backend/src/lib/logoValidation.js` met `detectLogoType(buffer)` die `png`, `jpg` of `svg` teruggeeft of een `AppError` `400 invalid_logo` met een Nederlandse melding gooit (PNG/JPG op magic bytes; SVG: geldige XML met `<svg>`-root, geen `<script>`, geen `on*`-attributen, geen externe verwijzingen) (research R7, FR-025)
- [ ] T067 [P] [US5] Maak `backend/src/modules/style/styleRepository.js` met `findByOrganisationId(organisationId)`, `upsertStyle(organisationId, fields)` en `deleteByOrganisationId(organisationId)`; elke functie heeft `organisationId` als verplichte parameter
- [ ] T068 [US5] Maak `backend/src/modules/style/styleService.js`: `getEffectiveStyle(organisationId)` (per onderdeel eigen waarde of waarde uit `backend/src/config/defaultStyle.js`, met `isDefault`; logo-URL `/media/logos/<bestandsnaam>` of het standaardlogo-pad), `updateColours(organisationId, { primaryColour, secondaryColour })` (hoofdletters, regex `^#[0-9A-F]{6}$`, `null` = standaard, rij verwijderen als alle drie velden `NULL` zijn), `replaceLogo(organisationId, buffer)` (type bepalen, opslaan als `<uuid>.<ext>` in `UPLOADS_DIR/logos/`, database bijwerken, daarna oud bestand verwijderen; bij een fout het nieuwe bestand opruimen), `removeLogo(organisationId)` en `resetStyle(organisationId)`
- [ ] T069 [US5] Maak `backend/src/modules/style/styleRoutes.js` met `GET /api/organisation/style`, `PUT /api/organisation/style`, `PUT /api/organisation/style/logo` (multer `memoryStorage`, veld `logo`, `limits.fileSize` 2 × 1024 × 1024), `DELETE /api/organisation/style/logo` en `DELETE /api/organisation/style`, allemaal met `getOrganisationId(req)`; koppel in `backend/src/app.js` achter `requireOrganisation`
- [ ] T070 [P] [US5] Maak `frontend/src/stores/style.js` (Pinia): `loadStyle()` via `GET /api/organisation/style`, `applyStyle()` zet `--colour-primary` en `--colour-secondary` op `document.documentElement` en levert de logo-URL; `applyDefault()` zet de waarden uit `frontend/src/config/defaultStyle.js`
- [ ] T071 [US5] Maak `frontend/src/views/StyleSettingsView.vue`: twee kleurkiezers met voorbeeld, logo-upload (accept `.png,.jpg,.jpeg,.svg`) met voorbeeld en melding bij fouten, knoppen "Logo verwijderen" en "Terug naar standaard"; na opslaan direct `applyStyle()` (SC-006)
- [ ] T072 [US5] Voeg route `/settings/style` (`requiresOrganisation`) toe aan `frontend/src/router/index.js`, navigatielink "Huisstijl" en het logo uit de style-store aan `frontend/src/components/OrganisationLayout.vue`; roep `loadStyle()` aan na inloggen en bij het laden van de app met een organisatiesessie, en `applyDefault()` op beheerroutes en na uitloggen (FR-026)

**Checkpoint**: alle user stories werken zelfstandig

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: documentatie, ERD, controles

- [ ] T073 [P] Werk het ERD `docs/Diagrams.simp` handmatig bij in Software Ideas Modeler volgens [data-model.md § ERD-wijzigingen](data-model.md#erd-wijzigingen): `Organisation.deletedAt`, entiteiten `Session` en `AdminActionLog`, `OrganisationStyle.organisationId` uniek (constitution: Bronnen en domeinregels)
- [ ] T074 [P] Schrijf `README.md` in de root (Nederlands): vereisten, `.env` aanmaken uit `.env.example`, `nginx/dev-cert.sh`, `docker compose up -d --build`, migraties, `create-admin.js`, tests draaien, en de opmerking dat productie een echt TLS-certificaat nodig heeft
- [ ] T075 Draai `eslint` in `backend/` en `frontend/` en los alle meldingen op; controleer dat namen Engels en commentaar Nederlands zijn (constitution VI)
- [ ] T076 Beveiligingscontrole: `git ls-files` bevat geen `.env`, certificaten of geheimen; cookie-flags kloppen in `backend/src/middleware/session.js`; `/media/logos/`-headers kloppen in `nginx/default.conf`; logregels bevatten nergens wachtwoorden
- [ ] T077 Voer alle scenario's uit [quickstart.md](quickstart.md) uit (1–17 en 13b) plus `docker compose --profile test run --rm api-test` en de frontend-tests, en noteer afwijkingen

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: geen afhankelijkheden
- **Foundational (Phase 2)**: na Setup; blokkeert alle user stories
- **User Stories (Phase 3–7)**: na Foundational
- **Polish (Phase 8)**: na de gewenste user stories (T073 en T074 kunnen al eerder)

### User Story Dependencies

- **US1 (P1)**: alleen Foundational
- **US2 (P1)**: Foundational; voor de handmatige test is een organisatie nodig (via US1 of `createOrganisationRow` in de tests), dus in de praktijk na US1
- **US3 (P1)**: na US2 (heeft organisatieroutes nodig om te testen)
- **US4 (P2)**: na US1 (breidt de organisatiemodule en beheerschermen uit)
- **US5 (P3)**: na US2 (organisatiesessie en `OrganisationLayout`); breidt de isolatietest van US3 uit
- US4 en US5 raken verschillende bestanden en kunnen parallel na US3

### Within Each User Story

- Tests eerst schrijven en laten falen
- Migratie → repository → service → routes → frontend-view → router
- Story afronden en valideren vóór de volgende prioriteit

### Parallel Opportunities

- Setup: T002, T003, T004, T005, T007, T009 parallel
- Foundational: T015, T016, T018, T021, T026, T027, T029 parallel (na T010–T014 voor de backend-delen die de database gebruiken)
- US1: T030, T031, T032 parallel; daarna T033, T035, T040, T041 parallel
- US4 en US5 kunnen na US3 door twee mensen tegelijk worden opgepakt

---

## Parallel Example: User Story 1

```bash
# Tests voor User Story 1 tegelijk:
Task: "Unittests codes in backend/tests/unit/codes.test.js"
Task: "Integratietests beheerderslogin in backend/tests/integration/adminAuth.test.js"
Task: "Integratietests organisatie aanmaken in backend/tests/integration/organisationsCreate.test.js"

# Onafhankelijke bouwstenen tegelijk:
Task: "backend/src/lib/codes.js"
Task: "backend/src/modules/actionLog/actionLogRepository.js"
Task: "frontend/src/views/AdminLoginView.vue"
Task: "frontend/src/components/AdminLayout.vue + OrganisationListView.vue"
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

1. Phase 1 Setup en Phase 2 Foundational afronden
2. US1: beheerder logt in en maakt organisaties aan → valideren
3. US2: docent logt in → valideren
4. US3: isolatie aantonen → valideren
5. **STOP**: dit is het minimum om de rest van de workflow (cursussen, publiceren, Quest) op te bouwen

### Incremental Delivery

1. Setup + Foundational
2. US1 → US2 → US3 (MVP)
3. US4 (beheer en logboek)
4. US5 (huisstijl, Should-requirement; mag volgens de stakeholderprioriteit wachten tot de cursusworkflow werkt)
5. Polish

---

## Notes

- [P] = verschillende bestanden, geen afhankelijkheid van onafgemaakte taken
- Commit na elke taak of logische groep op `Development`
- FR-010 geldt alleen voor codewijziging en verwijderen; een wachtwoordreset laat sessies staan (T053, T056)
- Geen sessie-vervaltijd en geen blokkering na mislukte pogingen (FR-018, FR-019): niet toevoegen
