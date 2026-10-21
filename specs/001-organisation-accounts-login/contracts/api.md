# API-contract: Organisaties, accounts en inloggen

Basis-URL: `/api` (zelfde domein als de frontend, via nginx). Alle bodies zijn JSON, behalve
de logo-upload (`multipart/form-data`).

## Algemeen

- **Authenticatie**: cookie `sid` (`HttpOnly`, `Secure`, `SameSite=Strict`, `Path=/`), gezet
  bij inloggen (research R3).
- **CSRF**: elk `POST`/`PUT`/`PATCH`/`DELETE`-verzoek MUST de header `X-Requested-With: cms`
  bevatten, anders `403 csrf_header_missing` (research R4).
- **Foutformaat** (alle 4xx/5xx):

  ```json
  { "error": { "code": "validation_failed", "message": "Leesbare melding in het Nederlands",
               "fields": { "loginCode": "Deze code is al in gebruik." } } }
  ```

  `fields` is alleen aanwezig bij `400 validation_failed`.
- **Statuscodes**: `401 not_authenticated` (geen of ongeldige sessie), `403 forbidden` (verkeerde
  rol), `404 not_found` (ook voor verwijderde organisaties), `409 conflict` (uniciteit).

## Authenticatie

### `POST /api/auth/admin/login`

Body: `{ "username": "string", "password": "string" }`

- `204` + cookie `sid` bij succes.
- `401 invalid_credentials`, melding "Gebruikersnaam of wachtwoord onjuist." (FR-017).

### `POST /api/auth/organisation/login`

Body: `{ "loginCode": "string", "password": "string" }` (code hoofdletterongevoelig)

- `204` + cookie `sid` bij succes.
- `401 invalid_credentials`, melding "Organisatiecode of wachtwoord onjuist." Ook voor
  verwijderde organisaties en voor een Quest-koppelcode (FR-012, FR-017).
- Geen blokkering of vertraging na herhaalde mislukte pogingen (FR-018).

### `POST /api/auth/logout`

- `204`; sessierij verwijderd en cookie gewist. Ook `204` als er geen sessie was.

### `GET /api/auth/me`

- `200` als beheerder: `{ "role": "admin", "username": "beheer" }`
- `200` als organisatie: `{ "role": "organisation", "organisation": { "id": 3, "name": "Zwembad De Hoven", "loginCode": "ZWEMBAD-DE-HOVEN" } }`
- `401 not_authenticated`.

## Beheer (alleen beheerderssessie, anders `401`/`403`)

### `GET /api/admin/organisations`

- `200`: `{ "organisations": [ { "id": 3, "name": "...", "loginCode": "...", "questLinkCode": "7K2M9QXA" } ] }`
- Alleen niet-verwijderde organisaties, gesorteerd op naam (FR-007, FR-012).

### `GET /api/admin/organisations/code-suggestion?name=Zwembad%20De%20Hoven`

- `200`: `{ "loginCode": "ZWEMBAD-DE-HOVEN" }` (vrij volgens FR-005; zo nodig met `-2`, `-3`)
- `400 validation_failed` als `name` leeg is of geen bruikbare tekens bevat.

### `POST /api/admin/organisations`

Body: `{ "name": "string", "loginCode": "string", "password": "string" }`

- `201`: de nieuwe organisatie (zelfde vorm als in de lijst). `questLinkCode` wordt door het
  systeem gegenereerd (FR-006). Logregel `create` (FR-027).
- `400 validation_failed`: lege naam, ongeldig codeformaat, wachtwoord korter dan 10 tekens.
- `409 conflict` (`fields.loginCode`): code bestaat al (ook bij verwijderde organisaties) of is
  gelijk aan een Quest-koppelcode.

### `PATCH /api/admin/organisations/:id`

Body: `{ "name"?: "string", "loginCode"?: "string" }` (minstens één veld)

- `200`: de bijgewerkte organisatie. Logregel `update` met oude en nieuwe waarden.
- Bij gewijzigde `loginCode`: alle sessies van de organisatie beëindigd (FR-010).
- `400`, `404`, `409` zoals hierboven.

### `PUT /api/admin/organisations/:id/password`

Body: `{ "password": "string" }`

- `204`. Lopende sessies van de organisatie blijven geldig (FR-010). Logregel `passwordReset`
  zonder wachtwoord (FR-027).
- `400` (te kort), `404`.

### `DELETE /api/admin/organisations/:id`

- `204`. Zet `deletedAt`, beëindigt alle sessies, logregel `delete` (FR-010, FR-011).
- `404` als de organisatie niet bestaat of al verwijderd is.
- De bevestigingsvraag zit in de frontend (FR-011).

### `GET /api/admin/action-log?page=1`

- `200`:

  ```json
  { "entries": [ { "id": 12, "createdAt": "2026-10-21T09:14:03Z", "action": "passwordReset",
                   "administrator": "beheer",
                   "organisation": { "id": 3, "name": "Zwembad De Hoven", "deleted": false },
                   "details": null } ],
    "page": 1, "pageSize": 50, "total": 12 }
  ```

- Nieuwste eerst (FR-028). Er bestaan geen routes om logregels te wijzigen of te verwijderen.

## Organisatie (alleen organisatiesessie, anders `401`/`403`)

Geen enkele route accepteert een organisatie-id; het id komt uit de sessie (FR-022, research R8).

### `GET /api/organisation`

- `200`: `{ "id": 3, "name": "...", "loginCode": "..." }`

### `GET /api/organisation/style`

- `200`:

  ```json
  { "primaryColour":   { "value": "#0055A4", "isDefault": false },
    "secondaryColour": { "value": "#FFD100", "isDefault": true },
    "logo":            { "url": "/media/logos/2f1c...png", "isDefault": false } }
  ```

  Bij een standaardlogo is `url` het pad van het standaardlogo in de frontend-build (FR-024).

### `PUT /api/organisation/style`

Body: `{ "primaryColour": "#0055A4" | null, "secondaryColour": "#FFD100" | null }`
(`null` = terug naar standaard)

- `200`: effectieve huisstijl (zoals `GET`).
- `400 validation_failed` bij een ongeldige kleur (formaat `#RRGGBB`).

### `PUT /api/organisation/style/logo`

`multipart/form-data`, veld `logo`.

- `200`: effectieve huisstijl. Een eventueel vorig logo wordt verwijderd.
- `400 invalid_logo`: geen PNG/JPG/SVG of onveilige SVG, met melding (FR-025).
- `413 logo_too_large`: groter dan 2 MB, melding "Het logo mag maximaal 2 MB zijn."
- Bij een fout blijft het vorige logo staan.

### `DELETE /api/organisation/style/logo`

- `200`: effectieve huisstijl met het standaardlogo.

### `DELETE /api/organisation/style`

- `200`: effectieve huisstijl, volledig standaard (user story 5, scenario 5).

## Statische bestanden (nginx, geen API)

- `GET /media/logos/<uuid>.<ext>`: geserveerd door nginx uit het volume `uploads`, met
  `X-Content-Type-Options: nosniff` en een strikte `Content-Security-Policy` (research R7).
