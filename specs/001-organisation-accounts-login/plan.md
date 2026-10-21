# Implementation Plan: Organisaties, accounts en inloggen

**Branch**: `Development` (feature `001-organisation-accounts-login`) | **Date**: 2026-10-21 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-organisation-accounts-login/spec.md`

## Summary

De beheerder logt in op een aparte beheeromgeving en maakt daar organisaties aan (naam,
voorgestelde en aanpasbare organisatiecode, wachtwoord), wijzigt ze, reset wachtwoorden en
verwijdert ze zacht; elke actie komt in een logboek. Docenten loggen in met organisatiecode en
wachtwoord, zien alleen de gegevens van hun eigen organisatie en kunnen een huisstijl
(twee kleuren en een logo) instellen.

Technisch: een Express 5-API (ES modules) met sessies in een eigen MariaDB-tabel zodat de
beheerder alle sessies van een organisatie kan beëindigen; gewone sessies: een sessiecookie
(weg bij sluiten van de browser) en een glijdende time-out van 60 minuten inactiviteit, met
periodiek opruimen van verlopen sessies; argon2id voor wachtwoorden; het
organisatie-id komt uitsluitend uit de sessie; logo's staan op schijf en worden door nginx
geserveerd. Vue 3-frontend met aparte routes voor beheer en organisatie. Alles in Docker
Compose (nginx, api, MariaDB 11.8). Zie [research.md](research.md).

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js 22 LTS; Vue 3

**Primary Dependencies**: backend: Express 5, Knex + mysql2, argon2, multer, cookie-parser;
frontend: Vue 3, Vite, Vue Router, Pinia

**Storage**: MariaDB 11.8 (tabellen uit [data-model.md](data-model.md)); logo-bestanden in
Docker-volume `uploads`, geserveerd door nginx

**Testing**: Vitest (backend en frontend), Supertest tegen een echte MariaDB-testdatabase,
Vue Test Utils

**Target Platform**: Linux-VPS met Docker Compose; moderne desktopbrowsers voor het CMS

**Project Type**: webapplicatie (frontend + backend)

**Performance Goals**: interactief gebruik door een handvol gelijktijdige gebruikers;
schermen laden binnen 1 s; inloggen binnen 1 s ondanks argon2id

**Constraints**: één VPS (constitution II); geen geheimen in git (IV); HTTPS verplicht in
productie vanwege `Secure`-cookies; logo max. 2 MB; sessie verloopt na 60 minuten
inactiviteit en bij sluiten van de browser (FR-019)

**Scale/Scope**: tientallen organisaties, één of enkele beheerders; 8 schermen
([contracts/ui.md](contracts/ui.md)), 17 API-routes ([contracts/api.md](contracts/api.md))

Er zijn geen open NEEDS CLARIFICATION-punten; alle keuzes staan in [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Toets | Status |
| --- | --- | --- |
| I. Vaste technologiestack | Vue 3, Express 5 met `"type": "module"`, MariaDB 11.8 | ✅ |
| II. Docker op één VPS | Drie Compose-services (`web`, `api`, `db`); data in volumes `db-data` en `uploads`; geen externe diensten | ✅ |
| III. Video's via nginx | Geen video's in deze feature. Logo's volgen hetzelfde patroon: bestand op schijf, nginx serveert, API geeft geen bytes terug | ✅ |
| IV. Geen geheimen in git | DB-wachtwoorden alleen in `.env` (in `.gitignore`), `.env.example` zonder waarden; beheerderswachtwoord interactief via script; argon2id-hashes | ✅ |
| V. Zachte verwijdering | Organisaties krijgen `deletedAt` (keuze uit clarify); cursussen/video's bestaan nog niet, FR-014 legt de regel vast voor latere features | ✅ |
| VI. Taalconventies (v2.0.0) | Alle code Engels: tabellen/velden (ERD-namen), routes (API en frontend; prototyperoutes worden hernoemd), commentaar, foutcodes, logregels. Nederlands alleen voor de klant: UI-teksten en `message` in API-foutresponses. Documentatie en specificaties Nederlands | ✅ |
| Bronnen en domeinregels | Schema volgt het ERD; nieuwe velden/tabellen staan in [data-model.md § ERD-wijzigingen](data-model.md#erd-wijzigingen) en moeten in het ERD worden doorgevoerd | ⚠️ actie: ERD bijwerken |
| Ontwikkelworkflow | specify → clarify → plan doorlopen; werk op `Development` | ✅ |

**Na Phase 1 opnieuw getoetst**: geen schendingen. Het enige actiepunt is het bijwerken van
het ERD; dat is administratief en blokkeert de implementatie niet, maar hoort in dezelfde
pull request te zitten.

Opmerking: de constitution verwijst nog naar de oude bestandsnamen in `docs/`
(`Requirements stakeholder verwerkt_4.docx`, `Futurelabs VR Lifeguard v7.simp`); de huidige
namen zijn `docs/requirements.docx` en `docs/Diagrams.simp`. Een PATCH-amendement lost dit op.

## Project Structure

### Documentation (this feature)

```text
specs/001-organisation-accounts-login/
├── plan.md              # Dit bestand
├── research.md          # Phase 0: technische keuzes
├── data-model.md        # Phase 1: tabellen, regels, levenscyclus, ERD-wijzigingen
├── quickstart.md        # Phase 1: validatiegids
├── contracts/
│   ├── api.md           # Phase 1: REST-endpoints
│   └── ui.md            # Phase 1: schermen en routes
└── tasks.md             # Phase 2 (/speckit-tasks, nog niet aangemaakt)
```

### Source Code (repository root)

```text
docker-compose.yml          # services web, api, db (+ profiel test: db-test, api-test)
.env.example                # alle variabelen, zonder echte waarden

nginx/
└── default.conf            # serveert frontend-build, /api → api, /media → volume uploads

backend/
├── package.json            # "type": "module"
├── knexfile.js
├── Dockerfile
├── scripts/
│   └── create-admin.js     # eerste beheerder aanmaken (R10)
├── src/
│   ├── server.js           # start de HTTP-server
│   ├── app.js              # Express-app, middleware, routes
│   ├── config/
│   │   ├── env.js          # leest en controleert .env
│   │   └── defaultStyle.js # standaardhuisstijl (R9)
│   ├── db/
│   │   ├── knex.js
│   │   └── migrations/     # Administrator, Organisation, OrganisationStyle, Session, AdminActionLog
│   ├── middleware/
│   │   ├── session.js      # cookie → req.auth, time-out controleren en verlengen
│   │   ├── requireAdmin.js
│   │   ├── requireOrganisation.js
│   │   ├── csrf.js
│   │   └── errorHandler.js
│   ├── jobs/
│   │   └── sessionCleanup.js # verlopen sessies elke 15 min opruimen (R3a)
│   ├── lib/
│   │   ├── password.js     # argon2id
│   │   ├── codes.js        # normaliseren/voorstellen loginCode, genereren questLinkCode
│   │   └── logoValidation.js
│   └── modules/
│       ├── auth/           # routes, service
│       ├── organisations/  # beheerroutes, service, repository
│       ├── organisationSelf/ # /api/organisation (eigen gegevens)
│       ├── style/          # huisstijl + logo-upload
│       └── actionLog/      # logboek schrijven en lezen
└── tests/
    ├── unit/               # codes, logoValidation, password
    └── integration/        # auth, organisations, style, actionLog, organisation-isolation

frontend/
├── package.json
├── Dockerfile              # build-stage; output naar nginx
├── src/
│   ├── main.js
│   ├── router/             # routes + guards (contracts/ui.md)
│   ├── stores/             # auth, style
│   ├── api/                # fetch-wrapper (X-Requested-With, foutformaat, 401-afhandeling)
│   ├── views/
│   │   ├── LoginView.vue
│   │   ├── AdminLoginView.vue
│   │   ├── HomeView.vue
│   │   ├── StyleSettingsView.vue
│   │   └── admin/          # OrganisationListView, OrganisationFormView, ActionLogView
│   ├── components/
│   └── assets/default-logo.svg
└── tests/
```

**Structure Decision**: webapplicatie met `backend/` en `frontend/` naast elkaar, plus
`nginx/` en `docker-compose.yml` in de root. De backend is per domein in modules opgedeeld
(`auth`, `organisations`, `style`, `actionLog`), zodat latere features (cursussen, video's)
er als nieuwe modules naast komen.

## Complexity Tracking

Geen schendingen van de constitution; deze sectie is niet van toepassing.
