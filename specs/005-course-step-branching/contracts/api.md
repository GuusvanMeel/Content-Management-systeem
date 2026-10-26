# API-contract: verbindingen tussen onderdelen

Wijzigingen op het contract van [feature 004](../../004-course-steps-draft/contracts/api.md).
Alles wat hier niet staat, blijft gelijk (sessie, CSRF, foutformaat, isolatie, thumbnailroute).

## Gewijzigd: het concept-document

Bij een video-onderdeel en bij elk antwoord komt `nextStepId` (`null` of het `id` van een
onderdeel van dezelfde cursus). Een vraag-onderdeel heeft geen eigen `nextStepId`.

```json
{
  "id": 12, "name": "…", "description": "…", "status": "draft", "updatedAt": "…",
  "steps": [
    { "id": 103, "stepType": "question", "isStart": true, "positionX": 0, "positionY": 0,
      "questionText": "Wat doe je?", "feedback": null,
      "answers": [
        { "id": 501, "answerText": "Ik grijp in", "isCorrect": true, "nextStepId": 104 },
        { "id": 502, "answerText": "Ik wacht af", "isCorrect": false, "nextStepId": 105 }
      ] },
    { "id": 104, "stepType": "video", "isStart": false, "positionX": -130, "positionY": 260,
      "videoId": null, "video": null, "nextStepId": null },
    { "id": 105, "stepType": "video", "isStart": false, "positionX": 130, "positionY": 260,
      "videoId": null, "video": null, "nextStepId": null }
  ]
}
```

## Gewijzigd: `POST /api/organisation/courses`

- `201`: het concept-document met het voorbeeld van FR-028 (zoals hierboven: een startvraag met
  twee antwoorden, elk naar een eigen video-onderdeel zonder video).

## Gewijzigd: `PUT /api/organisation/courses/:id`

Elk onderdeel krijgt een verplichte `key`; verbindingen verwijzen naar sleutels:

```json
{
  "name": "…", "description": "…",
  "steps": [
    { "key": "s103", "id": 103, "stepType": "question", "isStart": true, "positionX": 0, "positionY": 0,
      "questionText": "Wat doe je?", "feedback": null,
      "answers": [
        { "id": 501, "answerText": "Ik grijp in", "isCorrect": true, "nextStepKey": "n_7k2a" },
        { "id": 502, "answerText": "Ik wacht af", "isCorrect": false, "nextStepKey": "s103" }
      ] },
    { "key": "n_7k2a", "stepType": "video", "isStart": false, "positionX": 0, "positionY": 260,
      "videoId": 17, "nextStepKey": null }
  ]
}
```

- `key`: verplicht, tekst ≤ 64 tekens, uniek in het verzoek. Wordt niet opgeslagen.
- `nextStepKey` (video-onderdeel en antwoord): `null` of de `key` van een onderdeel in dit
  verzoek. Een antwoord mag naar de eigen vraag wijzen.
- `200`: het opgeslagen concept-document (met `nextStepId`).
- `400 validation_failed` (niets opgeslagen), naast de fouten van feature 004:
  - `steps.<n>.key`: "Dit onderdeel heeft geen geldige sleutel." (ontbreekt, te lang of dubbel)
  - `steps.<n>.nextStepKey` / `steps.<n>.answers.<m>.nextStepKey`: "Dit vervolg bestaat niet in
    deze cursus."
  - `steps.<n>.nextStepKey`: "Een video-onderdeel kan niet naar zichzelf wijzen."
  - `steps.<n>.nextStepKey` bij een vraag: "Een vraag gaat verder via haar antwoorden."
- De volledigheid (start, einde, bereikbaarheid, losse antwoorden) wordt **niet** gecontroleerd;
  een onvolledige route wordt gewoon opgeslagen (FR-009).
