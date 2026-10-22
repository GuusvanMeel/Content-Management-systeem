# Data Model: 360°-videobibliotheek (eigen organisatie)

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Eén nieuwe tabel: `Video`, exact zoals de entiteit `Video` in het ERD (`docs/Diagrams.simp`).
Er komen **geen** velden bij: geen status, geen reden bij mislukken, geen uploadvoortgang
(spec, Clarifications). De ERD-tabel `VideoAccess` (selectief delen, FR-14) wordt in deze
feature nog **niet** aangemaakt. Het ERD hoeft voor deze feature niet te veranderen.

## Video

| Veld | Type | Null | Regels |
| --- | --- | --- | --- |
| `id` | INT, PK, auto-increment | nee | |
| `ownerOrganisationId` | INT, FK → `Organisation.id` | nee | altijd uit de sessie (FR-021, FR-022), nooit uit invoer |
| `name` | VARCHAR(255) | nee | getrimd, 1–255 tekens; leeg → bestandsnaam zonder extensie, ingekort tot 255 tekens; dan nog leeg → `Video` (FR-005) |
| `description` | TEXT | ja | in deze feature altijd `NULL` (ERD-veld voor later) |
| `storageKey` | VARCHAR(500) | nee | uniek; `videos/<ownerOrganisationId>/<uuid>.mp4` (research R2) |
| `thumbnailStorageKey` | VARCHAR(500) | ja | in deze feature altijd gevuld: `thumbnails/<ownerOrganisationId>/<uuid>.jpg` |
| `fileSizeBytes` | BIGINT | nee | 1 – `VIDEO_MAX_SIZE_GB` × 1024³ (FR-004, research R5) |
| `durationSeconds` | INT | ja | in deze feature altijd gevuld; hele seconden, afgerond (FR-013) |
| `visibility` | ENUM(`public`, `selective`, `private`) | nee | in deze feature altijd `private` (FR-024) |
| `uploadedAt` | DATETIME | nee | UTC; moment waarop de controle slaagde en de rij werd ingevoegd |
| `deletedAt` | DATETIME | ja | `NULL` = in de bibliotheek; gevuld = zacht verwijderd (FR-020, constitution V) |

**Indexen**: `(ownerOrganisationId, deletedAt, uploadedAt)` voor de bibliotheekquery;
unieke index op `storageKey`.

**Relaties**: `Organisation 1 ──< Video` (eigenaar). Er is bewust geen koppeling naar een
cursus: later verwijzen cursusstappen (`CourseStep.videoId` in het ERD) naar een video, zodat
één video in meerdere cursussen kan staan (FR-023).

### Levenscyclus

```text
(geen rij) ──controle geslaagd──> in bibliotheek ──verwijderen──> zacht verwijderd
                                   deletedAt NULL                  deletedAt gevuld
```

- Een rij ontstaat **alleen** na een geslaagde controle (research R4). Een onvoltooide of
  afgekeurde upload laat geen rij achter.
- Zacht verwijderd: bestand en thumbnail blijven op schijf en de rij blijft bestaan; de video
  verschijnt niet meer in de bibliotheek en de thumbnailroute geeft `404`. Definitief
  verwijderen hoort bij de feature voor cursussen.
- Herstellen valt buiten deze feature.

### Queries

- **Bibliotheek** (FR-017): `WHERE ownerOrganisationId = ? AND deletedAt IS NULL ORDER BY
  uploadedAt DESC, id DESC`. Geen paginering nodig (SC-006: 200 video's).
- **Eén video** (thumbnail, verwijderen): `WHERE id = ? AND ownerOrganisationId = ? AND
  deletedAt IS NULL`; geen rij → `404` (ook voor een video van een andere organisatie).
- **Verwijderen**: `UPDATE Video SET deletedAt = UTC_TIMESTAMP() WHERE id = ? AND
  ownerOrganisationId = ? AND deletedAt IS NULL`; 0 rijen → `404`.

## Onvoltooide upload (geen tabel)

Een onvoltooide upload is tijdelijke data van tus in `/data/videos/incoming/` (research R1, R9):

| Bestand | Inhoud |
| --- | --- |
| `<uploadId>` | de tot nu toe ontvangen bytes |
| `<uploadId>.json` | tus-info: `size` (`Upload-Length`), `offset`, `metadata` (`filename`, `name`, `organisationId`), `creation_date` |

- `metadata.organisationId` wordt door de server gezet uit de sessie, nooit door de client
  (research R3), en bepaalt wie de upload mag hervatten of annuleren.
- Verdwijnt bij: geslaagde controle (verplaatst naar opslag), afgekeurde controle, annuleren
  (`DELETE`), te weinig schijfruimte tijdens een `PATCH` (vooraf gecontroleerd, of een
  `ENOSPC`-fout bij het schrijven), of 24 uur zonder nieuw deel (opruimtaak).

## Bestanden op schijf

Volume `videos`, gekoppeld op `/data/videos` (research R2):

```text
/data/videos/
├── incoming/                          # tus: onvoltooide uploads
├── videos/<organisationId>/<uuid>.mp4 # storageKey
└── thumbnails/<organisationId>/<uuid>.jpg  # thumbnailStorageKey, 1024×512 JPEG
```

## Configuratie (`.env`, zonder geheimen)

| Variabele | Standaard | Gebruik |
| --- | --- | --- |
| `VIDEOS_DIR` | – (verplicht; `/data/videos` in Docker) | wortel van de video-opslag |
| `VIDEO_MAX_SIZE_GB` | 10 | maximale grootte per video (FR-004) |
| `VIDEO_MIN_FREE_SPACE_GB` | 20 | vrije ruimte die moet overblijven (FR-004a) |
| `VIDEO_MAX_PARALLEL_UPLOADS` | 1 | uploads tegelijk per tabblad, alleen in de browser (FR-006b) |
| `VIDEO_MAX_WIDTH` | 5760 | maximale breedte in beeldpunten; server en browser (FR-003a) |
| `VIDEO_MAX_HEIGHT` | 2880 | maximale hoogte in beeldpunten; server en browser (FR-003a) |
| `UPLOAD_EXPIRY_HOURS` | 24 | opruimen van onvoltooide uploads (FR-011) |

## Onderbroken uploads in de browser (geen tabel)

De melding over onderbroken uploads (FR-009a, research R14) gebruikt alleen wat `tus-js-client`
zelf in `localStorage` van deze browser bewaart (upload-URL, grootte, `filename`, `name`) plus
een `HEAD` op de server voor het percentage. Er komt niets bij in de database.
