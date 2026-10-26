# Data model: Volgorde en vertakkingen van onderdelen

Bron: ERD `docs/Diagrams.simp`. Geen nieuwe tabellen of velden; de tabellen staan in
[feature 004 data-model.md](../004-course-steps-draft/data-model.md). Deze feature vult twee
velden die daar leeg bleven.

## Gevulde velden

| Veld | Wanneer gevuld | Regels |
| --- | --- | --- |
| `CourseStep.nextCourseStepId` | video-onderdeel met een vervolg | wijst naar een onderdeel van **dezelfde** versie; niet naar zichzelf; bij een vraag-onderdeel altijd `NULL` |
| `Answer.nextCourseStepId` | antwoord met een vervolg | wijst naar een onderdeel van dezelfde versie, ook naar de eigen vraag of een eerder onderdeel |

Beide FK's hebben `ON DELETE SET NULL` (feature 004): wordt een onderdeel verwijderd, dan verliezen
verwijzingen ernaartoe hun vervolg (FR-006). Bij opslaan zet de server alle verbindingen opnieuw
volgens het verzoek (research R1), dus de database volgt altijd precies de editor.

## Opslaan met sleutels (research R1)

In het verzoek, niet in de database:

- `steps[].key`: verplicht, tekst ≤ 64, uniek in het verzoek.
- `steps[].nextStepKey` (alleen video): `null` of een `key` uit het verzoek; niet de eigen `key`.
- `steps[].answers[].nextStepKey`: `null` of een `key` uit het verzoek.

Volgorde in de transactie: (1) onderdelen en antwoorden zoals in feature 004, met
`nextCourseStepId = NULL`; (2) kaart `key → id`; (3) `nextCourseStepId` zetten.

## Afgeleid (niet opgeslagen)

- **Einde**: video-onderdeel met `next` leeg, of vraag-onderdeel waarvan geen antwoord een
  `target` heeft (FR-005).
- **Binnenkomend**: aantal verbindingen (video-`next` en antwoord-`target`) naar een onderdeel.
- **Bereikbaar**: breedte-eerst vanaf het startonderdeel over alle verbindingen.
- **Kan eindigen**: eindes, plus elk onderdeel met een verbinding naar een onderdeel dat kan
  eindigen (vaste punt).

## Melding (alleen in de editor, research R4)

| Code | Tekst | Bij | FR |
| --- | --- | --- | --- |
| `empty` | Voeg een onderdeel toe | cursus | FR-016 |
| `noStart` | Kies een startonderdeel | cursus | FR-010 |
| `noEnd` | De route heeft geen einde | cursus | FR-011 |
| `unreachable` | Niet bereikbaar vanaf de start | onderdeel | FR-012 |
| `answerOpen` | Antwoord B is nog niet verbonden | onderdeel + antwoord | FR-013 |
| `neverEnds` | Vanaf hier eindigt de route nooit | onderdeel | FR-014 |
| `noVideo` | Kies een video | onderdeel | FR-015 |
| `videoUnavailable` | Kies een andere video: deze is niet meer beschikbaar | onderdeel | FR-015 |
| `noQuestion` | Vul de vraag in | onderdeel | FR-015 |
| `emptyAnswer` | Antwoord A is leeg | onderdeel + antwoord | FR-015 |

`id` = `<code>:<nodeId>:<answerId>` (lege delen weggelaten). Kleur (FR-022a): rood als de `id` in
`flaggedIssueIds` zit (de meldingen bij de laatste klik op opslaan), anders oranje.

## Nieuwe cursus (FR-028, research R3)

```text
[Vraag "Wat doe je?" · Start]  (0, 0)
   A "Ik grijp in" (goed) ──▶ [Video zonder video · Einde]  (−130, 260)
   B "Ik wacht af"        ──▶ [Video zonder video · Einde]  (130, 260)
```
