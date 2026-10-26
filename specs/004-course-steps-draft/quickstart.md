# Quickstart: valideren van cursussen en onderdelen (concept)

Gids om na de implementatie aan te tonen dat de feature werkt. Endpoints staan in
[contracts/api.md](contracts/api.md), schermen in [contracts/ui.md](contracts/ui.md), regels in
[data-model.md](data-model.md). Voorbereiding (`.env`, certificaat, `docker compose up`,
beheerder) zoals in de README van de root.

## Voorbereiding

1. Bouw en start, en voer de migraties uit:

   ```bash
   docker compose up -d --build
   ```

   ```bash
   docker compose exec api npx knex migrate:latest
   ```

2. Zorg voor drie organisaties A, B en C (feature 001) en video's (feature 003): A heeft een
   eigen video; B heeft een video "Algemeen beschikbaar", een video "Selectief beschikbaar" voor
   A en een video "Alleen eigen organisatie"; C heeft een video "Selectief beschikbaar" alleen
   voor B.

## Geautomatiseerde tests

```bash
docker compose --profile test run --rm --build api-test
```

```bash
docker compose run --rm --build web-build npm test
```

Verwacht: alles groen, inclusief `courseIsolation.test.js` (SC-003, ook de thumbnailroute),
`courseSave.test.js` (SC-002, SC-004), `courseVideos.test.js` (SC-005),
`courseUnavailableVideo.test.js` (SC-005a, FR-016, FR-016a) en, in de frontend,
`unavailable-video-warning.test.js` (FR-020b, SC-005b).

## Handmatige scenario's

| # | Stappen (als docent van A, tenzij anders) | Verwacht |
| --- | --- | --- |
| 1 | Cursussen openen zonder cursussen | "Er zijn nog geen cursussen." (US1-4) |
| 2 | Nieuwe cursus met lege naam → Aanmaken | Velden rood, "Vul een naam en een beschrijving in.", niets aangemaakt |
| 3 | Nieuwe cursus met naam en beschrijving | Editor opent, label "Concept"; in de lijst "0 video's · 0 vragen" |
| 4 | Video-onderdeel toevoegen, video kiezen | Kiezer toont precies: eigen video, B-algemeen, B-selectief; niet B-eigen of C-selectief (SC-005). Eerste onderdeel krijgt "Start" |
| 5 | Tweede video-onderdeel zonder video, opslaan | Opgeslagen; blok toont "Kies een video" |
| 6 | Vraag-onderdeel toevoegen, 4 antwoorden, 3e goed, feedback invullen, één antwoord leeg laten, opslaan, pagina verversen | Alles staat er nog precies zo (SC-002); vijfde antwoord toevoegen kan niet |
| 7 | Antwoord verwijderen tot er 2 over zijn; het goede antwoord verwijderen | Bij 2 geen verwijderknop meer; het eerste antwoord wordt goed |
| 8 | Ander onderdeel als start markeren, opslaan, verversen | Alleen dat onderdeel heeft "Start" |
| 9 | Onderdeel verwijderen, Ctrl+Z | Terug zonder bevestigingsvraag; knop toont weer "Opgeslagen" als niets anders gewijzigd is |
| 10 | Iets wijzigen, terug naar Cursussen | Vraag "Wijzigingen niet opgeslagen"; Annuleren houdt de editor open |
| 11 | Iets wijzigen, pagina verversen | Vraag van de browser |
| 12 | Netwerk uit (devtools offline), opslaan | "De cursus is niet opgeslagen. Probeer het opnieuw."; wijzigingen blijven; netwerk aan, opnieuw opslaan → geen dubbele onderdelen |
| 13 | Dezelfde video in een tweede cursus gebruiken | Lukt (FR-015) |
| 14 | Als A: B-selectief in een onderdeel zetten en opslaan. Als B: die video "Alleen eigen organisatie" maken. Als A de cursus openen | Blok toont nog naam, thumbnail en duur; opslaan lukt; in Video's en in de kiezer staat de video niet meer (FR-016) |
| 15 | Als B: het adres van de cursus van A openen | "Cursus niet gevonden" (SC-003) |
| 16 | Cursus verwijderen in de lijst | Vraag "Cursus verwijderen?", daarna weg uit de lijst; adres geeft "Cursus niet gevonden" |
| 17 | Twee tabbladen met dezelfde cursus, in beide iets anders wijzigen en opslaan | De laatste opslag staat er na verversen; geen waarschuwing |
| 18 | Na 14: het onderdeel verwijderen | Waarschuwing "Video niet meer beschikbaar"; Annuleren → onderdeel blijft (FR-020b) |
| 19 | Na 14: in het onderdeel "Wijzig" → andere video kiezen, en apart "Video weghalen" | Beide eerst dezelfde waarschuwing; Annuleren laat de video staan; Doorgaan voert het uit |
| 20 | Na 18 met Doorgaan: Ctrl+Z, opslaan | Onderdeel en video terug, opslaan lukt |
| 21 | Na 18 met Doorgaan: opslaan, dan Ctrl+Z en opnieuw opslaan | Opslaan geweigerd met "Kies een video uit de bibliotheek." bij dat onderdeel |
| 22 | Een onderdeel met een gewone video verwijderen of de video vervangen | Geen waarschuwing (SC-005b) |
| 23 | Als B: video "Algemeen beschikbaar" zacht verwijderen terwijl A hem gebruikt; als A de cursus openen | Zoals 14: naam, thumbnail en duur staan er nog; niet meer in Video's of de kiezer |

Controleer na scenario 16 dat de cursus zacht verwijderd is (SC-006):

```bash
docker compose exec db sh -c 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE" -e "SELECT id, deletedAt FROM Course"'
```

Verwacht: de cursus staat er nog, met een gevulde `deletedAt`.

## Ongeldige verzoeken buiten de interface (SC-004)

Stuur met een ingelogde sessie (cookie en `X-Requested-With: cms`) een `PUT` met elk van deze
fouten; verwacht steeds `400 validation_failed` en geen wijziging in de database:

- video-onderdeel met `questionText` of `answers`;
- vraag-onderdeel met `videoId`;
- vraag met 1 of 5 antwoorden, of met 0 of 2 goede antwoorden;
- bestaand onderdeel met een andere `stepType`;
- twee onderdelen met `isStart: true`;
- `videoId` van de video "Alleen eigen organisatie" van B.

## Thumbnail van een onbeschikbare video (FR-016a, SC-005a)

Na scenario 14, met `<c>` de cursus van A en `<s>` het onderdeel met de beperkte video:

- Als A: `GET /api/organisation/courses/<c>/steps/<s>/video-thumbnail` → `200`, een JPEG.
- Als A: `GET /api/organisation/videos/<videoId>/thumbnail` → `404` (bibliotheek ongewijzigd).
- Als B (eigenaar van de video): dezelfde cursusroute → `404`.
- Als C: dezelfde cursusroute → `404`.
- Als A, met het id van een vraag-onderdeel of van een onderdeel zonder video → `404`.
- Als A, na het verwijderen van de cursus → `404`.
- Als A: in `GET /api/organisation/courses/<c>` heeft `video` alleen `id`, `name`,
  `durationSeconds`, `thumbnailUrl` en `available: false`.

## Prestatie (SC-007)

```bash
docker compose exec -e NODE_ENV=development api node scripts/seed-courses.js <loginCode> 50 50
```

Het script weigert te draaien met `NODE_ENV=production` (zoals `seed-videos.js`); argumenten:
inlogcode van de organisatie, aantal cursussen, onderdelen per cursus. De video-onderdelen
gebruiken video's die de organisatie al ziet; zijn die er niet, dan alleen vraag-onderdelen.

Open als die organisatie Cursussen en een cursus van 50 onderdelen; beide moeten binnen 2 s in
beeld staan (devtools, tabblad Netwerk, tot het laatste verzoek klaar is).
