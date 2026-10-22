# API-contract: 360°-videobibliotheek

Bouwt voort op het contract van feature 001
([api.md](../../001-organisation-accounts-login/contracts/api.md)): zelfde basis-URL `/api`,
sessiecookie `sid`, CSRF-header `X-Requested-With: cms` op schrijvende verzoeken, foutformaat
`{ "error": { "code", "message", "fields"? } }`, en `401 not_authenticated` /
`401 session_expired`. Alle routes hieronder vragen een **organisatiesessie** (anders
`401`/`403`); het organisatie-id komt altijd uit de sessie (FR-022). `code` is Engels,
`message` is Nederlands.

## Bibliotheek

### `GET /api/organisation/videos`

- `200`:

  ```json
  { "videos": [
      { "id": 17, "name": "Zwembad overzicht", "durationSeconds": 95,
        "fileSizeBytes": 3221225472, "uploadedAt": "2026-10-22T09:14:03Z",
        "thumbnailUrl": "/api/organisation/videos/17/thumbnail" } ] }
  ```

- Alleen video's van de eigen organisatie met `deletedAt IS NULL`, nieuwste eerst (FR-017).
  Geen paginering.

### `GET /api/organisation/videos/:id/thumbnail`

- Productie: `200` zonder body van de API, met `X-Accel-Redirect:
  /internal/videos/thumbnails/<org>/<uuid>.jpg`, `Content-Type: image/jpeg`,
  `Cache-Control: private, max-age=3600`; nginx stuurt de afbeelding (research R8).
- Ontwikkeling/tests: `200` met de JPEG zelf.
- `404 not_found` als de video niet bestaat, verwijderd is of van een andere organisatie is.

### `DELETE /api/organisation/videos/:id`

- `204`: `deletedAt` gezet; bestand en thumbnail blijven bestaan (FR-020).
- `404 not_found`: onbekend, al verwijderd of van een andere organisatie.

### `GET /api/organisation/videos/upload-settings`

- `200`:

  ```json
  { "maxFileSizeBytes": 10737418240, "maxParallelUploads": 1,
    "chunkSizeBytes": 33554432, "acceptedExtensions": [".mp4"],
    "uploadEndpoint": "/api/organisation/video-uploads" }
  ```

- Waarden uit `.env` (research R10). `maxParallelUploads` wordt alleen in de browser gebruikt.

## Hervatbaar uploaden (tus 1.0)

Endpoint: `/api/organisation/video-uploads`. Ondersteunde tus-extensies: `creation`,
`termination`. Elk verzoek stuurt `Tus-Resumable: 1.0.0`, de sessiecookie en (bij `POST`,
`PATCH`, `DELETE`) `X-Requested-With: cms`. Elk verzoek met een geldige sessie verlengt de
sessie (FR-012).

### `POST /api/organisation/video-uploads` (upload aanmaken)

Headers:
- `Upload-Length`: grootte van het bestand in bytes (verplicht; uitgestelde lengte wordt niet
  ondersteund).
- `Upload-Metadata`: `filename <base64>,name <base64>` (`name` mag leeg zijn → bestandsnaam
  zonder extensie, FR-005). Een meegestuurde `organisationId` wordt genegeerd en door de server
  vervangen (research R3).

Antwoorden:
- `201` + `Location: /api/organisation/video-uploads/<uploadId>`.
- `400 validation_failed`, `fields.name`: naam langer dan 255 tekens.
- `413 video_too_large`: "Een video mag maximaal 10 GB zijn." (FR-004)
- `415 video_unsupported_format`: bestandsnaam eindigt niet op `.mp4`: "Alleen MP4-video's
  (H.264) worden ondersteund." (FR-002)
- `507 insufficient_storage`: "Er is op dit moment niet genoeg opslagruimte. Neem contact op met
  de beheerder." (FR-004a)

### `HEAD /api/organisation/video-uploads/:uploadId` (stand opvragen)

- `200` + `Upload-Offset` (aantal ontvangen bytes) + `Upload-Length`.
- `404 not_found`: onbekend, opgeruimd of van een andere organisatie.

### `PATCH /api/organisation/video-uploads/:uploadId` (deel versturen)

Headers: `Content-Type: application/offset+octet-stream`, `Upload-Offset` (moet gelijk zijn
aan de stand op de server). Body: hooguit `chunkSizeBytes` bytes.

- `204` + nieuw `Upload-Offset`: deel opgeslagen, upload nog niet compleet.
- **Laatste deel** (offset bereikt `Upload-Length`): de server controleert het bestand en maakt
  de thumbnail binnen hetzelfde verzoek (≤ 60 s, FR-015):
  - `200` met de nieuwe video in dezelfde vorm als een element uit `GET /videos`
    (`{ "video": { … } }`); de video staat nu in de bibliotheek.
  - `422` met één van deze codes; het bestand is verwijderd en er is niets opgeslagen (FR-014):

    | `code` | `message` |
    | --- | --- |
    | `video_unsupported_format` | Alleen MP4-video's (H.264) worden ondersteund. |
    | `video_unsupported_codec` | Alleen MP4-video's (H.264) worden ondersteund. Deze video gebruikt een andere codec. |
    | `video_not_360` | Dit is geen 360°-video: het beeld moet twee keer zo breed zijn als hoog (2:1). |
    | `video_resolution_too_high` | De resolutie is te hoog: een video mag maximaal 4096×2048 pixels zijn. |
    | `video_unreadable` | Dit bestand kan niet gelezen worden. Controleer of het een werkende video is. |

- `409`: `Upload-Offset` klopt niet met de stand op de server (client vraagt opnieuw `HEAD`).
- `404 not_found`: onbekend, opgeruimd of van een andere organisatie.
- `507 insufficient_storage`: te weinig ruimte voor het resterende deel, of de schijf raakte
  tijdens het schrijven vol; de onvoltooide upload is verwijderd (FR-004a, research R6).

### `DELETE /api/organisation/video-uploads/:uploadId` (annuleren)

- `204`: ontvangen delen verwijderd (FR-010).
- `404 not_found`: onbekend, opgeruimd of van een andere organisatie.

## Interne nginx-locatie (geen API)

- `/internal/videos/…`: `internal`, alleen bereikbaar via `X-Accel-Redirect` van de API.
  Direct opvragen geeft `404`.
- Video's staan **niet** onder `/media/`.
