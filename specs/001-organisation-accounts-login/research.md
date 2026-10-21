# Research: Organisaties, accounts en inloggen

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Datum**: 2026-10-21

De stack ligt vast in de constitution (Vue, Express met ES modules, MariaDB 11.8, Docker op één
VPS). Dit document legt de keuzes vast die daarbinnen nog open stonden.

## R1. Runtime en frameworkversies

- **Decision**: Node.js 22 LTS, Express 5, Vue 3 met Vite, Vue Router en Pinia.
- **Rationale**: Node 22 is LTS en ondersteunt ES modules volledig. Express 5 vangt fouten uit
  async handlers zelf af, wat foutafhandeling vereenvoudigt. Vue Router en Pinia zijn de
  standaardkeuzes binnen het Vue-ecosysteem.
- **Alternatives considered**: Express 4 (vraagt een extra wrapper voor async-fouten); Nuxt
  (server-side rendering is niet nodig voor een intern CMS en voegt een extra Node-proces toe).

## R2. Databasetoegang en migraties

- **Decision**: Knex als querybuilder en migratietool, met de `mysql2`-driver richting MariaDB.
  Tabel- en kolomnamen volgen het ERD letterlijk (`Organisation`, `loginCode`, ...).
- **Rationale**: Knex geeft versiebeheerde migraties en geparametriseerde queries zonder een
  volledige ORM. Het ERD blijft de bron van waarheid; namen gelijk houden voorkomt vertaalfouten.
- **Alternatives considered**: losse SQL-bestanden met een eigen runner (meer eigen code);
  Sequelize/Prisma (zwaarder, eigen modelconventies die afwijken van het ERD).
- **Let op**: MariaDB op Linux is hoofdlettergevoelig voor tabelnamen
  (`lower_case_table_names=0`); queries gebruiken daarom exact de ERD-namen.

## R3. Sessies (FR-010, FR-019)

- **Decision**: eigen sessietabel `Session` in MariaDB. Na inloggen krijgt de browser een
  willekeurig token (32 bytes) in een cookie met `HttpOnly`, `Secure`, `SameSite=Strict`; de
  database bewaart alleen de SHA-256-hash van het token. Een sessie heeft geen vervaltijd; de
  cookie krijgt de maximale levensduur die browsers toestaan (400 dagen) en wordt bij elk
  verzoek verlengd.
- **Rationale**: FR-010 vraagt dat alle sessies van één organisatie in één keer beëindigd
  kunnen worden bij codewijziging en verwijderen (niet bij een wachtwoordreset):
  `DELETE FROM Session WHERE organisationId = ?`. Dat is met een eigen tabel
  triviaal en met JWT's niet mogelijk zonder blocklist. Door alleen de hash op te slaan is een
  databaselek geen sessielek.
- **Alternatives considered**: JWT (niet in te trekken, FR-010 niet haalbaar);
  `express-session` met een MariaDB-store (sessies zijn daar niet op organisatie te zoeken
  zonder de sessiedata te parsen).

## R4. CSRF-bescherming

- **Decision**: `SameSite=Strict`-cookie plus de eis dat elk schrijvend verzoek
  `Content-Type: application/json` of `multipart/form-data` heeft én de header
  `X-Requested-With: cms` meestuurt. Frontend en API draaien op hetzelfde domein (nginx).
- **Rationale**: met dezelfde origin en `SameSite=Strict` kan een andere site de cookie niet
  meesturen; de verplichte header blokkeert ook eenvoudige formulier-posts. Geen extra
  tokenbeheer nodig.
- **Alternatives considered**: CSRF-tokens per sessie (meer complexiteit, geen extra
  bescherming in deze opzet).

## R5. Wachtwoord-hashing (FR-013)

- **Decision**: argon2id via het `argon2`-pakket met de standaardparameters van het pakket.
  Minimale lengte 10 tekens, maximaal 128 (tegen misbruik met enorme invoer).
- **Rationale**: argon2id is de huidige aanbeveling (OWASP). Het pakket levert prebuilt
  binaries voor `node:22-alpine`. Omdat FR-018 geen blokkering na mislukte pogingen kent, is
  een trage hash extra belangrijk tegen raden.
- **Alternatives considered**: bcrypt (prima, maar kapt wachtwoorden af op 72 bytes).

## R6. Organisatiecode en Quest-koppelcode (FR-004a, FR-005, FR-006)

- **Decision**:
  - `loginCode` wordt opgeslagen in hoofdletters, toegestaan zijn `A-Z`, `0-9` en `-`,
    lengte 3–50, niet beginnend of eindigend met `-`. Invoer wordt getrimd en omgezet naar
    hoofdletters, waardoor vergelijken vanzelf hoofdletterongevoelig is. Een unieke index op
    `loginCode` dwingt uniciteit af, ook voor zacht verwijderde organisaties (de rij blijft
    bestaan).
  - Voorstel: naam → accenten verwijderen (Unicode NFD) → hoofdletters → elke reeks andere
    tekens wordt `-` → inkorten tot 46 tekens → bij conflict `-2`, `-3`, ... toevoegen.
  - `questLinkCode`: 8 tekens uit het Crockford-base32-alfabet zonder `-`, willekeurig
    gegenereerd, met een unieke index. De service controleert bij aanmaken/wijzigen van een
    `loginCode` ook dat die niet gelijk is aan een bestaande `questLinkCode`, en andersom.
- **Rationale**: normaliseren bij opslaan is eenvoudiger en betrouwbaarder dan rekenen op
  collaties. Het afwijkende formaat van de koppelcode maakt verwarring onwaarschijnlijk; de
  extra controle maakt het uitgesloten.
- **Alternatives considered**: hoofdletterongevoelige collatie (werkt, maar de getoonde code
  zou afhangen van hoe de beheerder hem typte).

## R7. Logo-opslag en -weergave (FR-023, FR-025)

- **Decision**: logo's worden als bestand opgeslagen in een Docker-volume
  (`/data/uploads/logos/`) met een willekeurige bestandsnaam (UUID + extensie) en door nginx
  geserveerd onder `/media/logos/`. Upload via `multer` met een limiet van 2 MB. De API
  controleert het bestandstype op de inhoud (magic bytes voor PNG/JPG; voor SVG: geldige XML
  met `<svg>`-root, zonder `<script>`, `on*`-attributen of externe verwijzingen). nginx stuurt
  voor `/media/logos/` de headers `X-Content-Type-Options: nosniff` en
  `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` mee.
- **Rationale**: sluit aan bij constitution-principe III (bestanden op schijf, nginx serveert).
  De willekeurige naam maakt logo's van andere organisaties niet te raden; een logo is geen
  vertrouwelijke informatie, dus een aparte toegangscontrole is niet nodig. De CSP-header
  voorkomt dat een SVG scripts uitvoert als iemand hem direct opent.
- **Alternatives considered**: logo in de database als blob (strijdig met de geest van
  principe III); SVG niet toestaan (spec vraagt SVG expliciet).

## R8. Afscherming tussen organisaties (FR-021, FR-022)

- **Decision**: routes voor organisaties (`/api/organisation/...`) nemen nooit een
  organisatie-id uit het verzoek aan; het id komt uitsluitend uit de sessie
  (`req.auth.organisationId`). Elke repository-functie voor organisatiegegevens heeft
  `organisationId` als verplichte parameter. Beheerroutes (`/api/admin/...`) staan achter
  middleware die alleen beheerderssessies doorlaat.
- **Rationale**: als het id nergens uit de invoer komt, kan het ook niet gemanipuleerd worden.
  Integratietests met twee organisaties bewijzen dit (SC-003).
- **Alternatives considered**: id in de URL met een controle per route (foutgevoelig: één
  vergeten controle is een lek).

## R9. Standaardhuisstijl (FR-024, FR-026)

- **Decision**: de standaardwaarden (twee kleuren en een standaardlogo) staan in één
  configuratiebestand in de backend. `GET /api/organisation/style` geeft de effectieve
  huisstijl terug (eigen waarde of standaard) plus per onderdeel of het de standaard is. De
  frontend zet de kleuren als CSS-variabelen op het hoofdelement. De beheeromgeving gebruikt
  altijd de standaard. Het standaardlogo staat als statisch bestand in de frontend-build.
- **Rationale**: één bron voor de standaard voorkomt dat frontend en backend uit elkaar lopen.
- **Alternatives considered**: standaard als rij in `OrganisationStyle` (verwarrend: die tabel
  hoort per organisatie te zijn).

## R10. Eerste beheerder aanmaken

- **Decision**: een script `backend/scripts/create-admin.js`, uit te voeren met
  `docker compose exec api node scripts/create-admin.js <gebruikersnaam>`. Het wachtwoord
  wordt interactief gevraagd (niet als argument, zodat het niet in de shellgeschiedenis komt).
- **Rationale**: de spec stelt dat de beheerder bij installatie wordt aangemaakt, niet via
  het CMS. Geen wachtwoord in `.env` nodig.
- **Alternatives considered**: automatisch aanmaken vanuit `.env` bij de eerste start (het
  wachtwoord blijft dan in het `.env`-bestand staan).

## R11. Logboek van beheerdersacties (FR-027 – FR-029)

- **Decision**: tabel `AdminActionLog` met `administratorId`, `organisationId`, `action`
  (`create`, `update`, `delete`, `passwordReset`), `details` (JSON met oude en nieuwe naam/code,
  nooit wachtwoorden) en `createdAt`. Het logrecord wordt in dezelfde databasetransactie
  geschreven als de actie zelf. Er zijn geen API-routes om logregels te wijzigen of te
  verwijderen. Weergave gepagineerd, 50 per pagina, nieuwste eerst.
- **Rationale**: dezelfde transactie garandeert dat elke geslaagde actie gelogd is en geen
  mislukte actie. Omdat organisaties zacht verwijderd worden, blijft de verwijzing geldig.

## R12. Testen

- **Decision**: Vitest voor backend en frontend. Backend-integratietests gebruiken Supertest
  tegen de Express-app en een echte MariaDB 11.8 (aparte testdatabase in Docker Compose,
  profiel `test`). Frontend-componenttests met Vue Test Utils.
- **Rationale**: één testrunner voor beide kanten. Tegen een echte MariaDB testen vangt
  verschillen in collatie en unieke indexen die een mock zou missen.
- **Alternatives considered**: Jest (ES-module-ondersteuning nog steeds omslachtig); SQLite in
  tests (andere SQL-dialecten en collaties).

## R13. Containers

- **Decision**: drie services in `docker-compose.yml`:
  - `db`: `mariadb:11.8`, data in volume `db-data`;
  - `api`: Node 22 (alpine), Express, uploads in volume `uploads`;
  - `web`: nginx die de gebouwde Vue-app serveert, `/api/` doorstuurt naar `api` en
    `/media/` rechtstreeks uit het volume `uploads` serveert.
  TLS-certificaten (Let's Encrypt) worden op de VPS via nginx geregeld; dat valt buiten deze
  feature, maar `Secure`-cookies vereisen HTTPS in productie.
- **Rationale**: voldoet aan principe II en III; nginx is meteen de plek waar later de
  video's worden geserveerd.
