<!--
Sync Impact Report
- Versie: (template, onversioneerd) → 1.0.0
- Principes (nieuw, vervangen de templateplaatshouders):
  I. Vaste technologiestack
  II. Docker op één VPS
  III. Video's via nginx, API alleen voor toegangscontrole
  IV. Geen geheimen in git
  V. Zachte verwijdering (deletedAt)
  VI. Taalconventies
- Toegevoegde secties: Bronnen en domeinregels, Ontwikkelworkflow, Governance
- Verwijderde secties: geen
- Templates: niet aangepast (lezen de constitution tijdens runtime)
- Uitgestelde TODO's: geen
-->

# Futurelabs VR Lifeguard CMS Constitution

## Core Principles

### I. Vaste technologiestack

- De frontend MUST in Vue gebouwd worden.
- De backend MUST een Express.js-applicatie in JavaScript zijn die ES modules gebruikt
  (`"type": "module"`, `import`/`export`; geen CommonJS `require`).
- De database MUST MariaDB 11.8 zijn.
- Afwijken van deze stack (andere taal, framework of database) vereist een amendement op
  deze constitution.

**Rationale**: één vaste, kleine stack houdt het project overzichtelijk en onderhoudbaar
voor een klein team.

### II. Docker op één VPS

- Alle onderdelen (frontend, API, database, nginx) MUST als Docker-containers draaien,
  samen gedefinieerd in Docker Compose.
- De productieomgeving MUST op één enkele VPS draaien; ontwerpen MUST NOT uitgaan van
  meerdere servers, managed cloud-diensten of externe objectopslag.
- Persistente data (database en videobestanden) MUST in volumes of bind mounts staan,
  zodat containers zonder dataverlies opnieuw gebouwd kunnen worden.

**Rationale**: één VPS is de gekozen hostingvorm; eenvoud en voorspelbare kosten gaan
voor schaalbaarheid.

### III. Video's via nginx, API alleen voor toegangscontrole

- 360°-video's MUST als bestanden op schijf worden opgeslagen, niet in de database.
- nginx MUST de videobytes serveren. De API MUST alleen controleren of de aanvrager
  toegang heeft (bijvoorbeeld via `auth_request` of `X-Accel-Redirect`) en MUST NOT
  zelf videobytes streamen of teruggeven.
- De database bewaart alleen metadata en het bestandspad van een video.

**Rationale**: video's zijn groot; nginx is hier efficiënt in (range requests, caching),
terwijl Node.js-processen vrij blijven voor API-verzoeken.

### IV. Geen geheimen in git

- Wachtwoorden, API-sleutels, tokens en andere geheimen MUST NOT in git gecommit worden.
- Geheimen MUST alleen in `.env`-bestanden staan; `.env` MUST in `.gitignore` staan.
- Een `.env.example` met alle benodigde variabelen en zonder echte waarden MUST in de
  repository aanwezig zijn.
- Gebruikerswachtwoorden MUST gehasht worden opgeslagen met een sterk algoritme
  (bijv. bcrypt of argon2), nooit als platte tekst.

**Rationale**: een gelekt geheim in de git-geschiedenis is vrijwel niet meer te
verwijderen.

### V. Zachte verwijdering (deletedAt)

- Het verwijderen van video's en cursussen MUST zacht gebeuren: er wordt een
  `deletedAt`-tijdstempel gezet; het record en (voor video's) het bestand blijven bestaan.
- Standaardqueries MUST records met een gevulde `deletedAt` uitsluiten, tenzij een
  functie expliciet met verwijderde records moet werken (zoals de versiegeschiedenis).
- Oude cursusversies in de geschiedenis MUST hun verwijzingen naar zacht verwijderde
  video's behouden; bij opnieuw publiceren MUST een vervangende video gekozen worden.

**Rationale**: de stakeholder heeft bevestigd dat verwijderen zacht is, zodat de
versiegeschiedenis van cursussen intact blijft (zie FR-11 en FR-13).

### VI. Taalconventies

- Namen van tabellen, velden, variabelen, functies, bestanden, API-routes en andere code
  MUST in het Engels zijn.
- Documentatie, specificaties en codecommentaar MUST in het Nederlands zijn.
- Teksten in de gebruikersinterface volgen de specificatie van de betreffende feature.

**Rationale**: Engelse code sluit aan bij frameworks en bibliotheken; Nederlandse
documentatie sluit aan bij het team en de stakeholder.

## Bronnen en domeinregels

- De requirements (`docs/Requirements.docx`) en het ERD
  (`docs/Diagrams.simp`) zijn de bron van waarheid voor
  functionaliteit en datamodel. Specificaties en plannen MUST hiernaar verwijzen en
  afwijkingen expliciet benoemen.
- Het databaseschema MUST het ERD volgen; wijzigingen aan het datamodel MUST ook in het
  ERD worden doorgevoerd.
- Prioriteit volgens de stakeholder: eerst moet de volledige workflow werken (cursus
  maken in het CMS, publiceren, downloaden op de Quest en uitvoeren) voordat
  Should-requirements worden opgepakt.

## Ontwikkelworkflow

- Features doorlopen de Spec Kit-flow: specify → (clarify) → plan → tasks → implement.
- Elk plan MUST een Constitution Check bevatten die bovenstaande principes toetst;
  afwijkingen MUST in het plan gemotiveerd worden.
- Ontwikkeling gebeurt op de branch `Development`; `main` bevat alleen werk dat via een
  pull request is samengevoegd.

## Governance

- Deze constitution gaat boven andere werkafspraken binnen dit project.
- Wijzigingen gebeuren via een amendement op `.specify/memory/constitution.md`, met een
  korte motivering en een bijgewerkt versienummer.
- Versiebeheer volgt semantic versioning: MAJOR voor het verwijderen of herdefiniëren van
  principes, MINOR voor nieuwe principes of secties, PATCH voor verduidelijkingen.
- Elke pull request en review MUST controleren of de wijziging aan deze principes voldoet.

**Version**: 1.0.0 | **Ratified**: 2026-10-20 | **Last Amended**: 2026-10-20
