# API-contract: cursussen en onderdelen (concept)

Zoals features 001–003: basis-URL `/api`, sessiecookie `sid`, CSRF-header
`X-Requested-With: cms` op schrijvende verzoeken, foutformaat
`{ "error": { "code", "message", "fields"? } }`. Alle routes vragen een **organisatiesessie**
(anders `401`/`403`); het organisatie-id komt altijd uit de sessie, nooit uit het verzoek.
`code` is Engels, `message` en de teksten in `fields` zijn Nederlands.

Een cursus die niet bestaat, verwijderd is of van een andere organisatie is, geeft op elke route
`404 not_found` (FR-003). Een `:id` die geen positief geheel getal is ook.

## Gemeenschappelijk: het concept-document

```json
{
  "id": 12,
  "name": "Redding in het diepe bad",
  "description": "Herken een drenkeling en kies de juiste redding.",
  "status": "draft",
  "updatedAt": "2026-10-26T10:15:00Z",
  "steps": [
    {
      "id": 101, "stepType": "video", "isStart": true,
      "positionX": 0, "positionY": 0,
      "videoId": 17,
      "video": { "id": 17, "name": "Zwembad overzicht", "durationSeconds": 95,
                 "thumbnailUrl": "/api/organisation/courses/12/steps/101/videos/17/thumbnail", "available": true }
    },
    {
      "id": 102, "stepType": "question", "isStart": false,
      "positionX": 0, "positionY": 260,
      "questionText": "Wat doe je eerst?",
      "feedback": "Eerst alarmeren, dan pas het water in.",
      "answers": [
        { "id": 501, "answerText": "Alarmeren", "isCorrect": true },
        { "id": 502, "answerText": "", "isCorrect": false }
      ]
    }
  ]
}
```

- Video-onderdeel: `videoId` is `null` als er nog geen video is gekozen; dan is `video` ook
  `null`. Anders bevat `video` altijd naam, duur en thumbnailroute, ook als de video niet meer
  beschikbaar is of door de eigenaar is verwijderd; dan is `available` `false` (research R5a).
  `video` bevat nooit meer dan deze vijf velden. `thumbnailUrl` is `null` als de video geen
  thumbnail heeft.
- `available: false` betekent: de video staat niet in de bibliotheek van de organisatie en mag
  niet in een ander of nieuw onderdeel worden gezet (zie `PUT`).
- Vraag-onderdeel: `questionText` en `answerText` kunnen `""` zijn; `feedback` is `null` als hij
  leeg is. `answers` staan in volgorde A–D.
- Onderdelen staan in volgorde van `id`. `description` en de velden voor het volgende onderdeel
  komen niet in het document.

## `GET /api/organisation/courses`

- `200`: `{ "courses": [ { "id", "name", "updatedAt", "videoStepCount", "questionStepCount", "status": "draft" } ] }`,
  nieuwste `updatedAt` eerst, alleen niet-verwijderde cursussen van de eigen organisatie (FR-004).

## `POST /api/organisation/courses`

- Body: `{ "name": string, "description": string }`.
- `201`: het concept-document van de nieuwe cursus. Sinds feature 005 is dat het vertakkende
  voorbeeld van FR-028 (zie [005 contracts/api.md](../../005-course-step-branching/contracts/api.md));
  het enkele start-video-onderdeel van FR-001a is daarmee vervangen.
- `400 validation_failed`, `fields.name` / `fields.description`: "Vul een naam en een
  beschrijving in." of "De naam mag maximaal 255 tekens lang zijn." / "De beschrijving mag
  maximaal 1000 tekens zijn."

## `GET /api/organisation/courses/:id`

- `200`: het concept-document.

## `PUT /api/organisation/courses/:id` (Opslaan als concept)

- Body: het hele concept, zonder `status`, `updatedAt` en `video`:

```json
{
  "name": "…", "description": "…",
  "steps": [
    { "id": 101, "stepType": "video", "isStart": true, "positionX": 0, "positionY": 0, "videoId": 17 },
    { "stepType": "question", "isStart": false, "positionX": 0, "positionY": 260,
      "questionText": "", "feedback": null,
      "answers": [ { "answerText": "", "isCorrect": true }, { "answerText": "", "isCorrect": false } ] }
  ]
}
```

- Een onderdeel of antwoord **met** `id` wordt bijgewerkt, **zonder** `id` aangemaakt; wat er in
  het concept staat maar niet in het verzoek, wordt verwijderd (data-model.md § Opslaan).
- JSON-limiet 1 MB (research R8); hoogstens 200 onderdelen.
- `200`: het opgeslagen concept-document met alle id's.
- `400 validation_failed`: niets is opgeslagen. `fields` gebruikt sleutels als `name`,
  `description`, `steps`, `steps.3.videoId`, `steps.3.answers`, `steps.3.answers.1.answerText`.
  Meldingen o.a.:
  - "Vul een naam en een beschrijving in."
  - "Kies een video uit de bibliotheek." (video niet zichtbaar en niet de al opgeslagen video van
    hetzelfde onderdeel, bijv. een onbeschikbare video in een nieuw of ander onderdeel)
  - "Een vraag heeft 2 tot 4 antwoorden."
  - "Kies precies één goed antwoord."
  - "Er kan maar één startonderdeel zijn."
  - "De soort van een onderdeel kan niet veranderen."
  - "Dit onderdeel hoort niet bij deze cursus." (onbekend `id`)
  - "Dit antwoord hoort niet bij dit onderdeel." (antwoord-`id` van een ander onderdeel of onbekend)
  - "Een video-onderdeel heeft geen vraag, antwoorden of feedback." / "Een vraag-onderdeel heeft
    geen video."
  - "Een cursus kan maximaal 200 onderdelen hebben."
  - lengtemeldingen zoals bij `POST`, en "De vraag mag maximaal 1000 tekens zijn.", "Een antwoord
    mag maximaal 255 tekens zijn.", "De feedback mag maximaal 1000 tekens zijn."
- `413 payload_too_large`: verzoek groter dan 1 MB.

## `DELETE /api/organisation/courses/:id`

- `204`: zacht verwijderd (FR-006).

## `GET /api/organisation/courses/:id/steps/:stepId/videos/:videoId/thumbnail`

- Thumbnail van de video in een video-onderdeel van het concept van een eigen cursus, ook als
  die video niet meer beschikbaar is of door de eigenaar is verwijderd (FR-016a, research R5a).
- `200`: `image/jpeg` via `X-Accel-Redirect` (in ontwikkeling en tests stuurt de API de bytes
  zelf, zoals bij de bibliotheekthumbnail); `Cache-Control: private, max-age=3600`.
- `:videoId` MUST de video zijn die het onderdeel nu heeft. Daardoor krijgt een onderdeel na het
  vervangen van zijn video een nieuwe URL, en toont de browser nooit een oude thumbnail uit zijn
  cache (bevinding 2 van de handmatige test).
- `404 not_found`: cursus niet zichtbaar voor de organisatie (andere organisatie, verwijderd,
  onbekend), onderdeel niet in het concept van deze cursus, vraag-onderdeel, onderdeel zonder
  video, een `:videoId` die niet de video van het onderdeel is, of video zonder thumbnail.

## Ongewijzigd: videobibliotheek

`GET /videos`, `GET /videos/:id`, `GET /videos/:id/thumbnail` en de kiezer volgen precies de regels
van feature 003. Een video die een organisatie niet meer mag zien, komt daar niet in voor
(`404`), ook niet als hij in een van haar cursussen staat.

## Niet in deze feature

Geen routes voor publiceren, intrekken, versies, delen of de Quest. Een concept is via geen
enkele route buiten `/api/organisation` op te vragen (FR-008, SC-008).
