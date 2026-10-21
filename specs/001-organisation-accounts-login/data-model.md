# Data Model: Organisaties, accounts en inloggen

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Namen volgen het ERD (`docs/Diagrams.simp`) letterlijk. Nieuw ten opzichte van het ERD zijn
`Organisation.deletedAt`, `Session` en `AdminActionLog`; die moeten ook in het ERD worden
toegevoegd (zie [ERD-wijzigingen](#erd-wijzigingen)).

## Administrator

| Veld | Type | Null | Regels |
| --- | --- | --- | --- |
| `id` | INT, PK, auto-increment | nee | |
| `username` | VARCHAR(100) | nee | uniek; getrimd; 3–100 tekens |
| `passwordHash` | VARCHAR(255) | nee | argon2id-hash; wachtwoord 10–128 tekens (FR-013) |

- Wordt alleen aangemaakt via `scripts/create-admin.js` (R10), niet via de API.

## Organisation

| Veld | Type | Null | Regels |
| --- | --- | --- | --- |
| `id` | INT, PK, auto-increment | nee | |
| `name` | VARCHAR(255) | nee | getrimd; 1–255 tekens; niet alleen spaties |
| `loginCode` | VARCHAR(50) | nee | uniek; hoofdletters; `^[A-Z0-9](?:[A-Z0-9-]{1,48})[A-Z0-9]$`; niet gelijk aan een `questLinkCode` (FR-005) |
| `passwordHash` | VARCHAR(255) | nee | argon2id-hash; wachtwoord 10–128 tekens |
| `questLinkCode` | VARCHAR(50) | nee | uniek; 8 tekens Crockford-base32, door het systeem gegenereerd (FR-006); niet gelijk aan een `loginCode` |
| `deletedAt` | DATETIME | ja | **nieuw**; `NULL` = actief (FR-011) |

- Unieke indexen op `loginCode` en `questLinkCode` gelden ook voor verwijderde organisaties,
  dus de code blijft gereserveerd (FR-012).
- Alle gewone queries filteren op `deletedAt IS NULL` (constitution-principe V).

### Levenscyclus

```text
(niet bestaand) --aanmaken door beheerder--> actief --verwijderen door beheerder--> verwijderd
```

- **actief**: kan inloggen, staat in het beheeroverzicht.
- **verwijderd**: `deletedAt` gevuld; kan niet inloggen; staat niet in het overzicht; code
  blijft bezet. Herstellen valt buiten deze feature.
- Bij overgang naar verwijderd en bij wijzigen van `loginCode` worden alle `Session`-rijen van
  de organisatie verwijderd (FR-010). Een wachtwoordreset laat sessies ongemoeid.

## OrganisationStyle

| Veld | Type | Null | Regels |
| --- | --- | --- | --- |
| `id` | INT, PK, auto-increment | nee | |
| `organisationId` | INT, FK → `Organisation.id` | nee | uniek (0 of 1 huisstijl per organisatie) |
| `primaryColour` | CHAR(7) | ja | `^#[0-9A-F]{6}$` (opgeslagen in hoofdletters); `NULL` = standaard |
| `secondaryColour` | CHAR(7) | ja | idem |
| `logoImage` | VARCHAR(255) | ja | bestandsnaam in `uploads/logos/` (UUID + `.png`/`.jpg`/`.svg`); `NULL` = standaardlogo |

- Effectieve huisstijl = per veld eigen waarde, anders de standaardwaarde (FR-024).
- Een rij met alle drie velden `NULL` is gelijk aan "geen huisstijl"; de service verwijdert de
  rij dan.
- Bij vervangen of verwijderen van het logo wordt het oude bestand van schijf verwijderd (een
  logo is geen video of cursus, dus principe V geldt hier niet).

## Session

| Veld | Type | Null | Regels |
| --- | --- | --- | --- |
| `id` | INT, PK, auto-increment | nee | |
| `tokenHash` | CHAR(64) | nee | uniek; SHA-256 (hex) van het cookie-token |
| `administratorId` | INT, FK → `Administrator.id` | ja | precies één van `administratorId` / `organisationId` is gevuld |
| `organisationId` | INT, FK → `Organisation.id` | ja | index (voor FR-010) |
| `createdAt` | DATETIME | nee | UTC |
| `lastActivityAt` | DATETIME | nee | UTC; index; bij inloggen gezet en bij elk geauthenticeerd verzoek bijgewerkt naar `UTC_TIMESTAMP()` |

- **Geldig** zolang `lastActivityAt >= UTC_TIMESTAMP() - INTERVAL 60 MINUTE` (glijdende
  time-out, FR-019; de 60 komt uit `SESSION_IDLE_TIMEOUT_MINUTES`, research R3). Er is geen
  apart vervalveld: de vervaltijd is altijd `lastActivityAt` + time-out.
- De bijbehorende cookie is een sessiecookie zonder vervaldatum; sluiten van de browser maakt
  de sessie voor de gebruiker onbereikbaar, de rij verloopt daarna vanzelf.
- `CHECK ((administratorId IS NULL) <> (organisationId IS NULL))`.

### Levenscyclus van een sessie

```text
inloggen ──> actief ──(verzoek binnen 60 min: lastActivityAt := nu)──> actief
               │
               ├─ uitloggen ───────────────────────────────> rij verwijderd
               ├─ codewijziging / organisatie verwijderd ──> rij verwijderd (FR-010)
               └─ 60 min geen verzoek ──> verlopen ──┬─ volgend verzoek: 401 session_expired,
                                                    │  rij verwijderd
                                                    └─ opruimtaak: rij verwijderd
```

### Opruimen (FR-019b, research R3a)

- Bij het starten van de API en daarna elke 15 minuten:
  `DELETE FROM Session WHERE lastActivityAt < UTC_TIMESTAMP() - INTERVAL 60 MINUTE`.
- Opruimen is onderhoud: verlopen rijen worden ook vóór het opruimen al geweigerd.

## AdminActionLog

| Veld | Type | Null | Regels |
| --- | --- | --- | --- |
| `id` | INT, PK, auto-increment | nee | |
| `administratorId` | INT, FK → `Administrator.id` | nee | |
| `organisationId` | INT, FK → `Organisation.id` | nee | blijft geldig omdat organisaties zacht verwijderd worden |
| `action` | ENUM(`create`, `update`, `delete`, `passwordReset`) | nee | |
| `details` | JSON | ja | bijv. `{"name": {"old": "A", "new": "B"}}`; nooit wachtwoorden of hashes (FR-027) |
| `createdAt` | DATETIME | nee | index, voor sorteren nieuwste eerst |

- Alleen INSERT; er is geen code die logregels wijzigt of verwijdert (FR-028).
- Wordt in dezelfde transactie geschreven als de actie zelf (R11).

## Relaties

```text
Administrator 1 ──< Session >── 0..1 Organisation
Administrator 1 ──< AdminActionLog >── 1 Organisation
Organisation  1 ──── 0..1 OrganisationStyle
```

## ERD-wijzigingen

Door te voeren in `docs/Diagrams.simp` (constitution: datamodelwijzigingen ook in het ERD):

1. `Organisation`: veld `deletedAt DATETIME NULL` toevoegen.
2. Nieuwe entiteit `Session` zoals hierboven (met `lastActivityAt` en index daarop).
3. Nieuwe entiteit `AdminActionLog` zoals hierboven.
4. `OrganisationStyle.organisationId`: als uniek markeren (relatie 1 : 0..1).
