# API-contract: centrale videobibliotheek

Bouwt voort op het contract van feature 002 ([api.md](../../002-video-library/contracts/api.md))
en feature 001: basis-URL `/api`, sessiecookie `sid`, CSRF-header `X-Requested-With: cms` op
schrijvende verzoeken, foutformaat `{ "error": { "code", "message", "fields"? } }`. Alle routes
hieronder vragen een **organisatiesessie** (anders `401`/`403`); het organisatie-id komt altijd
uit de sessie. `code` is Engels, `message` is Nederlands. De beheerder heeft geen videoroutes
(FR-027).

## Gemeenschappelijk: een video in antwoorden

```json
{ "id": 17, "name": "Zwembad overzicht",
  "description": "Overzicht van het diepe bad vanaf de badmeesterstoel.\nGeschikt als start.",
  "durationSeconds": 95, "fileSizeBytes": 3221225472, "uploadedAt": "2026-10-22T09:14:03Z",
  "thumbnailUrl": "/api/organisation/videos/17/thumbnail",
  "owner": { "id": 3, "name": "Zwembad De Hoven", "isOwn": true },
  "visibility": "selective" }
```

- `description` is `null` als er geen beschrijving is.
- `visibility` (`public` | `selective` | `private`) staat er **alleen bij eigen video's**; bij
  video's van anderen ontbreekt het veld (FR-006).

## Gewijzigd

### `GET /api/organisation/videos`

- `200`: `{ "videos": [ <video> ] }`: alle video's die voor de organisatie zichtbaar zijn
  (data-model.md § Zichtbaarheid), nieuwste eerst, **zonder paginering** (FR-025a). Zoeken,
  sorteren en filteren gebeuren in de browser.

### `GET /api/organisation/videos/:id/thumbnail`

- Zoals in feature 002, maar toegestaan voor elke video die zichtbaar is voor de organisatie;
  anders `404 not_found` (FR-013, FR-017).

### `DELETE /api/organisation/videos/:id`

- `204`: zacht verwijderd (feature 002).
- `403 not_owner`, melding "Alleen de organisatie die deze video heeft geüpload, kan hem
  wijzigen of verwijderen.": de video is zichtbaar maar van een andere organisatie.
- `404 not_found`: onbekend, verwijderd of niet zichtbaar.

### `GET /api/organisation/videos/upload-settings`

- Zoals in feature 002, plus `"defaultVisibility": "private"` (uit `VIDEO_DEFAULT_VISIBILITY`)
  en `"descriptionMaxLength": 1000`.

### `POST /api/organisation/video-uploads` (tus, upload aanmaken)

`Upload-Metadata` (base64-waarden, tus 1.0) krijgt naast `filename` en `name`:

| Sleutel | Waarde | Verplicht |
| --- | --- | --- |
| `visibility` | `public`, `selective` of `private` | nee; ontbreekt → `defaultVisibility` |
| `description` | tekst, max. 1000 tekens | nee |
| `accessOrganisationIds` | komma-gescheiden id's, bijv. `4,9` | alleen bij `selective` |

- Ongeldige keuzes → `400 validation_failed` met `fields` (`description`, `visibility` of
  `accessOrganisationIds`), vóór er iets wordt opgeslagen (research R4, R5).
- De header mag tot 32 KB groot zijn (research R4).
- Bij het afronden worden de keuzes opnieuw gecontroleerd; inmiddels verwijderde organisaties
  vallen weg, en blijft er bij `selective` niemand over, dan wordt de video `private`.
- `HEAD`, `PATCH` en `DELETE` op een upload: ongewijzigd.

## Nieuw

### `GET /api/organisation/videos/:id`

- `200`: `<video>`, en voor de eigenaar bij `selective` ook
  `"accessOrganisations": [ { "id": 4, "name": "Brandweer Academie Noord" } ]` (alleen actieve
  organisaties, op naam gesorteerd). Voor andere organisaties ontbreken `visibility` en
  `accessOrganisations`.
- `404 not_found`: onbekend, verwijderd of niet zichtbaar.

### `PATCH /api/organisation/videos/:id`

Body (minstens één veld):

```json
{ "name": "Zwembad overzicht", "description": "…" , "visibility": "selective",
  "accessOrganisationIds": [4, 9] }
```

- `description`: `null` of `""` maakt de beschrijving leeg.
- `accessOrganisationIds`: verplicht en niet leeg als `visibility` `selective` is (ook als
  `visibility` niet wordt meegestuurd en de video al `selective` is en de lijst wordt
  meegestuurd); genegeerd bij `public` en `private`.
- `200`: de bijgewerkte `<video>` met (bij `selective`) `accessOrganisations`.
- `400 validation_failed` met `fields`:
  - `name`: "Vul een naam in." / "De naam mag maximaal 255 tekens lang zijn."
  - `description`: "De beschrijving mag maximaal 1000 tekens zijn."
  - `visibility`: "Kies een beschikbaarheid."
  - `accessOrganisationIds`: "Kies minstens één organisatie, of kies ‘Alleen eigen
    organisatie’." / "Kies alleen organisaties uit de lijst."
- `403 not_owner` en `404 not_found` zoals bij `DELETE`.
- Bij een andere beschikbaarheid dan `selective` worden alle gekozen organisaties verwijderd
  (FR-007). Alles gebeurt in één transactie.

### `GET /api/organisation/organisations`

- `200`: `{ "organisations": [ { "id": 4, "name": "Brandweer Academie Noord" } ] }`: alle
  actieve organisaties behalve de eigen, gesorteerd op naam. Alleen `id` en `name` (FR-004);
  nooit organisatie- of Quest-koppelcodes.
