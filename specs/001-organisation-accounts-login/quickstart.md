# Quickstart: valideren van organisaties, accounts en inloggen

Gids om na de implementatie aan te tonen dat de feature werkt. Details van endpoints staan in
[contracts/api.md](contracts/api.md), schermen in [contracts/ui.md](contracts/ui.md), velden en
regels in [data-model.md](data-model.md).

## Voorbereiding

1. Kopieer `.env.example` naar `.env` en vul de databasewachtwoorden in (constitution IV:
   `.env` wordt nooit gecommit).
2. Start alles:

   ```bash
   docker compose up -d --build
   ```

3. Voer de migraties uit:

   ```bash
   docker compose exec api npx knex migrate:latest
   ```

4. Maak de eerste beheerder aan (wachtwoord wordt gevraagd):

   ```bash
   docker compose exec api node scripts/create-admin.js beheer
   ```

5. Open `https://localhost/admin/login` (lokaal met het zelfondertekende certificaat uit de
   ontwikkelconfiguratie, zodat `Secure`-cookies werken).

## Geautomatiseerde tests

```bash
docker compose --profile test run --rm api-test
```

```bash
docker compose run --rm web-build npm test
```

Verwacht: alle tests groen. De integratietests dekken minimaal de scenario's hieronder.

## Handmatige scenario's

| # | Stappen | Verwacht resultaat | Spec |
| --- | --- | --- | --- |
| 1 | Log in als beheerder met een fout wachtwoord | Melding "Gebruikersnaam of wachtwoord onjuist."; geen toegang | FR-001, FR-017 |
| 2 | Log in als beheerder, kies "Nieuwe organisatie", typ naam "Zwembad De Hoven" | Codeveld toont `ZWEMBAD-DE-HOVEN` | FR-004a |
| 3 | Vul een wachtwoord van 9 tekens in en sla op | Foutmelding bij wachtwoord; niets aangemaakt | FR-013 |
| 4 | Wachtwoord van 10+ tekens, opslaan | Organisatie staat in overzicht; logboek toont `create` | FR-004, FR-027 |
| 5 | Maak een tweede organisatie met code `zwembad-de-hoven` | Melding dat de code al in gebruik is | FR-005 |
| 6 | Log uit; open `/admin` | Doorgestuurd naar `/admin/login` | FR-002 |
| 7 | Log in op `/login` met `zwembad-de-hoven` en het wachtwoord | Ingelogd; naam van de organisatie zichtbaar | FR-015 |
| 8 | Log als organisatie in met de Quest-koppelcode in plaats van de organisatiecode | Algemene foutmelding | FR-005, FR-017 |
| 9 | Ingelogd als organisatie: roep `GET /api/admin/organisations` aan (browser-devtools) | `403` | FR-002, SC-004 |
| 10 | Maak organisatie B; ingelogd als A: open huisstijl, stel kleuren en logo in | A ziet eigen huisstijl; B ziet nog de standaard | FR-023, FR-024, FR-021 |
| 11 | Upload als logo een `.txt` hernoemd naar `.png`, en een bestand van 3 MB | Beide geweigerd met melding; vorig logo blijft | FR-025 |
| 12 | Open het geüploade logo-URL direct in de browser | Afbeelding getoond; response heeft `X-Content-Type-Options` en `Content-Security-Policy` | R7 |
| 13 | Als beheerder: reset het wachtwoord van A terwijl A in een andere browser is ingelogd | A blijft ingelogd en kan doorwerken; na uitloggen werkt het oude wachtwoord niet meer, het nieuwe wel | FR-009, FR-010 |
| 13b | Als beheerder: wijzig de code van A terwijl A in een andere browser is ingelogd | A wordt bij de volgende actie naar `/login` gestuurd met "Je sessie is verlopen. Log opnieuw in."; alleen de nieuwe code werkt | FR-008, FR-010, FR-019a |
| 14 | Als beheerder: verwijder A, annuleer de bevestiging | A bestaat nog | FR-011 |
| 15 | Verwijder A en bevestig | A weg uit overzicht; inloggen als A faalt; nieuwe organisatie met A's code geweigerd; logboek toont `delete` | FR-011, FR-012, FR-027 |
| 16 | Open het logboek | Alle acties uit deze lijst, nieuwste eerst, zonder wachtwoorden | FR-028 |
| 17 | Doe 10 mislukte inlogpogingen achter elkaar en daarna een juiste | Juiste poging slaagt meteen | FR-018 |

## Sessieduur (FR-019, FR-019a, FR-019b, SC-008)

Zet voor deze scenario's in `.env` tijdelijk `SESSION_IDLE_TIMEOUT_MINUTES=2` en herstart de
API (`docker compose up -d api`). **Zet de waarde daarna terug op 60** (of verwijder de regel).

| # | Stappen | Verwacht resultaat | Spec |
| --- | --- | --- | --- |
| 18 | Log in als organisatie, doe 3 minuten niets, klik dan op "Huisstijl" | Inlogpagina met de melding "Je sessie is verlopen. Log opnieuw in."; na inloggen terug op "Huisstijl" | FR-019, FR-019a |
| 19 | Log in als organisatie en klik 5 minuten lang ongeveer elke minuut op een menu-item | Blijft ingelogd: elke actie verlengt de sessie | FR-019, SC-008 |
| 20 | Herhaal 18 als beheerder op `/admin` | Zelfde gedrag; melding op `/admin/login` | FR-019 |
| 21 | Log in, laat het tabblad 3 minuten open staan zonder iets te doen en kijk of de pagina zelf verzoeken doet (devtools, tabblad Network) | Geen verzoeken op de achtergrond; na 3 minuten is de sessie verlopen | contracts/ui.md |
| 22 | Log in als organisatie, sluit de browser volledig (alle vensters) en open hem opnieuw op `/` | Inlogpagina zonder verloopmelding: de cookie is weg. Herstelt de browser de vorige sessie ("verdergaan waar je was"), dan kan de cookie blijven bestaan; de sessie verloopt dan alsnog na de time-out | FR-019 |
| 23 | Controleer de cookie in devtools (Application → Cookies) na inloggen | `sid` heeft geen vervaldatum ("Session"), en `HttpOnly`, `Secure` en `SameSite=Strict` staan aan | research R3 |
| 24 | Wacht na scenario 18 maximaal 15 minuten en tel de verlopen rijen: `docker compose exec db mariadb -u <DB_USER> -p <DB_NAME> -e "SELECT COUNT(*) FROM Session WHERE lastActivityAt < UTC_TIMESTAMP() - INTERVAL 2 MINUTE"` | `0`: de opruimtaak heeft verlopen sessies verwijderd | FR-019b |

De geautomatiseerde tests dekken dit ook zonder te wachten: ze zetten `lastActivityAt` van een
sessie 61 minuten terug en verwachten `401 session_expired`, zetten hem 59 minuten terug en
verwachten dat de sessie nog geldig is en verlengd wordt, en roepen de opruimfunctie direct aan.

## Isolatiecontrole (SC-003)

De integratietest `organisation-isolation` maakt twee organisaties aan en probeert als A elke
organisatieroute uit [contracts/api.md](contracts/api.md) zo aan te roepen dat gegevens van B
geraakt worden (o.a. extra `organisationId` in body en query). Verwacht: in alle gevallen
alleen gegevens van A, en de gegevens van B ongewijzigd.
