# Quickstart: valideren van de centrale videobibliotheek

Gids om na de implementatie aan te tonen dat de feature werkt. Endpoints staan in
[contracts/api.md](contracts/api.md), schermen in [contracts/ui.md](contracts/ui.md), regels in
[data-model.md](data-model.md). Voorbereiding (`.env`, certificaat, `docker compose up`,
beheerder) zoals in de README van de root.

## Voorbereiding

1. Voeg aan `.env` toe (of laat weg voor de standaard `private`):

   ```bash
   VIDEO_DEFAULT_VISIBILITY=private
   ```

2. Bouw en start, en voer de migratie uit:

   ```bash
   docker compose up -d --build
   ```

   ```bash
   docker compose exec api npx knex migrate:latest
   ```

3. Maak als beheerder drie organisaties aan: A ("Zwembad A"), B ("Zwembad B") en C ("Zwembad C").
4. Controleer dat bestaande video's van feature 002 nog `private` zijn (SC-006):

   ```bash
   docker compose exec db sh -c 'mariadb -u"$MARIADB_USER" -p"$MARIADB_PASSWORD" "$MARIADB_DATABASE" -e "SELECT visibility, COUNT(*) FROM Video GROUP BY visibility"'
   ```

   Verwacht: alleen `private`.

## Geautomatiseerde tests

```bash
docker compose --profile test run --rm --build api-test
```

```bash
docker compose run --rm --build web-build npm test
```

Verwacht: alles groen, inclusief `videoVisibility.test.js` (matrix van drie organisaties ×
drie beschikbaarheden), `videoEdit.test.js` en `videoUploadChoices.test.js`.

## Handmatige scenario's

| # | Stappen | Verwacht resultaat | Spec |
| --- | --- | --- | --- |
| 1 | Als A: video toevoegen | "Alleen eigen organisatie" staat voorgeselecteerd; velden Beschrijving en Beschikbaarheid per bestand | FR-002, FR-021 |
| 2 | Als A: drie video's uploaden: "Algemeen" (met beschrijving), "Selectief" voor B, "Alleen eigen" | Alle drie in de bibliotheek van A met de neutrale grijze pil "Eigen" en de beschikbaarheid | FR-001, FR-009 |
| 3 | "Selectief" kiezen zonder organisatie | Melding "Kies minstens één organisatie…", Uploaden staat uit | FR-004 |
| 4 | Als B inloggen | B ziet de algemene en de selectieve video met een paarse pil "Zwembad A" (in de lijst en in het videovenster), niet de privévideo; eigen video's van B hebben de grijze pil "Eigen"; geen knoppen Wijzigen/Verwijderen bij de video's van A | FR-008, FR-009, FR-014 |
| 5 | Als C inloggen | C ziet alleen de algemene video | FR-008, SC-001 |
| 6 | Als C in devtools `GET /api/organisation/videos/<id selectief>` en `/thumbnail` | Beide `404` | FR-013 |
| 7 | Als B `PATCH` en `DELETE` op de algemene video van A (devtools) | `403 not_owner`; video ongewijzigd | FR-014, SC-002 |
| 8 | Als A de algemene video openen, Wijzigen, naar "Selectief" voor B | Bevestiging "1 organisatie kan deze video daarna niet meer zien."; na "Wijzigen" ziet C hem na herladen niet meer, B wel | FR-017, FR-017a, SC-003 |
| 9 | Als A dezelfde video naar "Algemeen beschikbaar" | Geen bevestiging; C ziet hem weer | FR-017a |
| 10 | Als A naam en beschrijving wijzigen, met een tweede regel | B ziet na herladen de nieuwe naam en beide regels in het videovenster | FR-016, FR-012 |
| 11 | Beschrijving van 1001 tekens plakken, in het uploadvenster en daarna bij Wijzigen in het videovenster | Teller staat in rood op "0 tekens over", de tekst is afgekapt op 1000 tekens met de rode melding "De beschrijving mag maximaal 1000 tekens zijn; de rest is niet overgenomen."; verder typen voegt niets toe. Eén teken weghalen: "1 teken over", teller en melding niet meer rood. Via de API: `400` met "De beschrijving mag maximaal 1000 tekens zijn." | FR-020, FR-021 |
| 12 | Als B zoeken op een woord uit de beschrijving, op "zwembad a" en op "cafe" bij een video "Café" | Juiste video's; hoofdletters en accenten maken niet uit | FR-023 |
| 13 | Sorteren op duur en grootte, filter "Van andere organisaties", zoekterm erbij | Alle drie gelden tegelijk | FR-024, FR-025 |
| 14 | Zoeken op iets zonder resultaat | "Geen video's gevonden" + knop "Zoekterm en filter wissen", die ook het organisatiefilter wist | FR-026 |
| 15 | Naar beneden scrollen, video openen, venster sluiten | Zelfde zoekterm, filter, sortering en scrollpositie | FR-012 |
| 16 | Als beheerder: verwijder A | B en C zien de video's van A niet meer | FR-010 |
| 17 | Als beheerder: zoek in de beheeromgeving naar videofuncties | Geen | FR-027, SC-007 |
| 18 | Zet `VIDEO_DEFAULT_VISIBILITY=public`, `docker compose up -d api`, nieuwe upload | "Algemeen beschikbaar" voorgeselecteerd; bestaande video's ongewijzigd. Daarna `onzin` → `private` voorgeselecteerd en een waarschuwing in `docker compose logs api` | FR-003 |
| 19 | Upload starten met "Selectief" voor B; tijdens de upload B verwijderen (beheerder) | Video wordt opgeslagen als "Alleen eigen organisatie" | research R4 |
| 20 | Als C (met algemene video's van A en B): klik in de lijst op de paarse pil "Zwembad A" | Alleen video's van A; naast het zoekveld "Organisatie: Zwembad A ✕"; het videovenster opent niet | FR-025b |
| 21 | Met dat filter: zoekterm invullen, sorteren op duur, filter "Eigen video's" kiezen | Alle filters gelden samen; bij "Eigen video's" blijft de lijst leeg met "Geen video's gevonden" | FR-025b, FR-026 |
| 22 | Label "Organisatie: Zwembad A ✕" wegklikken | Alleen het organisatiefilter vervalt; zoekterm, sortering en eigen/andere blijven | FR-025b |
| 23 | Een video van B openen en in het videovenster op de pil "Zwembad B" klikken | Venster sluit; bibliotheek gefilterd op B met het label "Organisatie: Zwembad B ✕" | FR-025b |
| 24 | Klik op de grijze pil "Eigen" | Er gebeurt niets (geen filter) | FR-025b |

## Prestaties (SC-005)

Het script weigert te draaien met `NODE_ENV=production` (de standaard in de api-container), dus
zet het voor dit ene commando op `development`:

```bash
docker compose exec -e NODE_ENV=development api node scripts/seed-videos.js ZWEMBAD-A 500 public
```

Open als B de bibliotheek met de devtools open: de lijst met 500 video's van A staat binnen 2
seconden in beeld, en zoeken, sorteren en filteren reageren binnen 1 seconde. Ruim daarna op
door A te verwijderen of de testdatabase opnieuw te maken.
