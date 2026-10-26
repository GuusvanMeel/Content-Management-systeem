# Quickstart: valideren van volgorde en vertakkingen

Gids om na de implementatie aan te tonen dat de feature werkt. Endpoints staan in
[contracts/api.md](contracts/api.md), schermen in [contracts/ui.md](contracts/ui.md), regels in
[data-model.md](data-model.md). Voorbereiding zoals in
[feature 004 quickstart](../004-course-steps-draft/quickstart.md) (geen nieuwe migraties).

## Geautomatiseerde tests

```bash
docker compose --profile test run --rm --build api-test
```

```bash
docker compose --profile test run --rm --build web-build npm test
```

Verwacht: alles groen, inclusief `courseConnections.test.js` (SC-002, SC-006),
`completeness.test.js` (SC-003, SC-004), `course-connections.test.js` (SC-007) en
`issue-colours.test.js` (FR-022a).

## Handmatige scenario's (als docent van een organisatie met een paar video's)

| # | Stappen | Verwacht |
| --- | --- | --- |
| 1 | Nieuwe cursus aanmaken | Vraag "Wat doe je?" met "Start", twee pijlen A en B naar twee videoblokken met "Einde"; balk "2 nog te doen" (oranje): twee keer "Kies een video" (FR-028) |
| 2 | In beide videoblokken een video kiezen | Balk "Cursus is compleet" |
| 3 | Klik op het "+" onder video A → "Nieuwe vraag" | Vraag komt onder video A, verbonden, formulier open; video A is geen "Einde" meer; de nieuwe vraag is een "Einde" (geen enkel antwoord verbonden) |
| 4 | In die vraag antwoord A naar een nieuwe video verbinden (klik op "A" → "Nieuw video-onderdeel") | Antwoord B gemeld: "Antwoord B is nog niet verbonden" (oranje) |
| 5 | Opslaan als concept | Opgeslagen; de melding bij antwoord B wordt rood; balk rood |
| 6 | Antwoord B terug naar video A slepen (lus) | Pijl B loopt terug omhoog met "B ↺"; melding weg; met de muis op video A verschijnt de tooltip "Wordt bereikt vanuit 2 verbindingen" (geen "← 2" op het blok) |
| 7 | Pagina verversen | Alle pijlen staan er nog precies zo (SC-002) |
| 8 | Klik op de pijl van A naar de nieuwe video, Delete | Pijl weg; "Antwoord A is nog niet verbonden"; de losse video "Niet bereikbaar vanaf de start" |
| 9 | Twee video's naar elkaar laten wijzen, los van de rest, één als start markeren | "De route heeft geen einde" en bij beide "Vanaf hier eindigt de route nooit" |
| 10 | Een onderdeel verwijderen waar twee pijlen naartoe gaan, dan Ctrl+Z | Na verwijderen: de bronnen zonder vervolg en gemeld; na Ctrl+Z: onderdeel en beide pijlen terug (SC-007) |
| 11 | Het startvakje uitzetten | Alleen "Kies een startonderdeel" (geen bereikbaarheidsmeldingen) |
| 12 | Klik op een melding in de lijst "nog te doen" | Het onderdeel opent en komt in beeld |
| 13 | Weergave "Lijst" | Route vanaf de start met A/B-vertakkingen, "Einde", "Verder bij “…”" bij de lus, losse onderdelen onder "Niet bereikbaar" |
| 14 | Knop "Canvas ordenen" in de bovenbalk | Blokken volgens de route, vertakkingen naast elkaar; geen bevestigingsvraag; melding "Canvas geordend" met "Ongedaan maken" |
| 15 | Video-onderdeel: in het menu en bij "Daarna" zichzelf zoeken | Een video-onderdeel kan zichzelf niet als vervolg kiezen: het onderdeel staat niet in het menu en "Daarna" biedt het niet aan. Anders ontstaat een eindeloze lus zonder keuze: de video zou zich steeds herhalen zonder dat de cursist iets kan kiezen (FR-003) |
| 16 | Een "+" dat al verbonden is → "Nieuwe vraag" | Vraag ertussen; antwoord A naar het oude vervolg, antwoord B gemeld |

## Verbeterronde na de handmatige test (2026-10-26)

| # | Stappen | Verwacht |
| --- | --- | --- |
| 17 | Iets wijzigen in een cursus zonder meldingen, "Opslaan als concept" (punt 1) | Kort "Concept opgeslagen" met een vinkje naast de knop; de knop kleurt kort groen; daarna weer "Opgeslagen" |
| 18 | Hetzelfde met nog 3 meldingen open (punt 1) | Kort "Opgeslagen, nog 3 punten open"; de meldingen worden rood, maar het opslaan zelf ziet er geslaagd uit |
| 19 | Besturingssysteem op "minder beweging" zetten en opslaan (punt 1) | Dezelfde tekst, zonder animatie of kleurovergang |
| 20 | Tussenpunt van een pijl slepen (punt 2) | **Uitgesteld**: zie `docs/backlog.md`, "Lijnen verplaatsen en lijnstijl" |
| 21 | Lijnstijl "Vloeiend"/"Hoekig" voor het canvas en per pijl (punt 3) | **Uitgesteld**: zie `docs/backlog.md` |
| 22 | Een vraag waarvan antwoord A en B naar hetzelfde onderdeel gaan (punt 4) | Twee pijlen die naast elkaar binnenkomen (niet over elkaar), elk in de kleur van hun letter, met "A" en "B" op de pijl; pijlen van video's grijs |
| 23 | Met de muis op een pijl, daarna een pijl aanklikken (punt 4) | De pijl wordt dikker, zijn bron en doel lichten op, de rest van het canvas wordt gedimd; weg met de muis of klik op het canvas: alles weer normaal |
| 24 | Met de muis op een blok waar geen of één pijl binnenkomt (punt 5) | Geen tooltip resp. "Wordt bereikt vanuit 1 verbinding"; nergens een permanente "← n" |
| 25 | Een route met een start-probleem, twee video's zonder video en een open antwoord; "n nog te doen" openen (punt 6) | Groep "Cursus" apart bovenaan, daaronder "Antwoorden zonder vervolg" (1) en "Video-onderdelen zonder video" (2); bij minder dan 5 punten open, anders dicht; klik op een kop klapt hem, klik op een regel opent het blok |
| 26 | "Canvas ordenen", daarna "Ongedaan maken" in de melding (punt 7) | De blokken staan weer waar ze stonden; Ctrl+Y ordent opnieuw |

## Ongeldige verzoeken (SC-006)

Stuur met een ingelogde sessie een `PUT` met elk van deze fouten; verwacht `400
validation_failed` en geen wijziging:


- `nextStepKey` dat niet in het verzoek voorkomt;
- video-onderdeel met `nextStepKey` gelijk aan de eigen `key`;
- vraag-onderdeel met een eigen `nextStepKey`;
- twee onderdelen met dezelfde `key`, of een onderdeel zonder `key`.

## Prestatie (SC-004)

Maak met `seed-courses.js` (feature 004) een cursus van 50 onderdelen, verbind er een aantal en
wijzig een antwoordtekst: de meldingen en de balk zijn direct bijgewerkt (geen merkbare vertraging);
`completeness.test.js` meet de functie zelf.
