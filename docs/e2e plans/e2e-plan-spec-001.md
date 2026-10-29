# E2E-plan spec 001: organisaties, accounts en inloggen

Bron: `specs/001-.../quickstart.md`. Dit document zegt per scenario of het met Playwright wordt geautomatiseerd, hoe, en in welk bestand.

## Legenda

| Label | Betekenis |
|---|---|
| **A** | Automatiseren met Playwright |
| **A+H** | Een deel automatiseren, het uiterlijk blijft handmatig |
| **H** | Handmatig laten (uiterlijk of gevoel, of niet te doen in Playwright) |
| **B** | Al gedekt door de backendtests (`api-test`); niet nog eens in Playwright |

## Uitgangspunten

- Mapnaam: `e2e/tests/001-<zelfde naam als specs-map>/`.
- Beheertests gebruiken de sessie van `playwright-admin` (`storageState: playwright/.auth/admin.json`). Tests die uitgelogd moeten beginnen (1, 6) gebruiken een lege sessie: `test.use({ storageState: { cookies: [], origins: [] } })`.
- Organisatietests gebruiken de sessie van `PLAYWRIGHT-TEST` (`org.json`), of een eigen organisatie die de test zelf aanmaakt.
- Elke test maakt zijn eigen organisaties aan, met een naam die begint met `E2E-` plus een tijdstempel, en verwijdert die in `afterEach`. De opruimronde in `global-teardown.js` verwijdert wat is blijven staan. De vaste organisaties `PLAYWRIGHT-TEST` en `PLAYWRIGHT-TEST-2` blijven altijd staan.
- De vaste naam "Zwembad De Hoven" uit de quickstart werkt niet bij herhaalde runs. Gebruik een unieke naam en controleer dat de afgeleide code het patroon volgt (de naam in hoofdletters, spaties als streepjes).

## Scenario's

| # | Wat | Label | Aanpak in Playwright | Bestand |
|---|---|---|---|---|
| 1 | Beheerder, fout wachtwoord | A | Lege sessie, foutmelding controleren, geen toegang tot `/admin` | `admin-login.spec.js` |
| 2 | Nieuwe organisatie, code wordt afgeleid | A | Unieke naam typen, codeveld controleren | `organisation-create.spec.js` |
| 3 | Wachtwoord van 9 tekens | A | Foutmelding en dat de organisatie niet is aangemaakt | `organisation-create.spec.js` |
| 4 | Wachtwoord van 10+ tekens | A | Organisatie in overzicht; logboek toont `create` | `organisation-create.spec.js` |
| 5 | Tweede organisatie met dezelfde code | A | Zelfde naam nogmaals aanmaken; melding "code al in gebruik" | `organisation-create.spec.js` |
| 6 | Uitloggen en `/admin` openen | A | Doorgestuurd naar `/admin/login` | `admin-login.spec.js` |
| 7 | Inloggen als organisatie | A | Eigen aangemaakte organisatie; naam zichtbaar | `organisation-login.spec.js` |
| 8 | Inloggen met de Quest-koppelcode | A | Algemene foutmelding. Zoek eerst op hoe je de koppelcode krijgt (zie `contracts/api.md`) | `organisation-login.spec.js` |
| 9 | Organisatie roept admin-API aan | A | Met `request` en de organisatiesessie: `GET /api/admin/organisations` verwacht 403 | `organisation-login.spec.js` |
| 10 | Huisstijl A en B verschillen | A+H | Automatiseren: A stelt waarden in, B ziet de standaardwaarden (controleer de opgeslagen waarden). Handmatig: hoe de kleuren eruitzien | `branding.spec.js` |
| 11 | Ongeldig logo (.txt als .png, 3 MB) | A | `setInputFiles` met een buffer uit de test; beide geweigerd, vorig logo blijft | `branding.spec.js` |
| 12 | Logo-URL direct openen | A | `request.get` op de URL; controleer de headers `X-Content-Type-Options` en `Content-Security-Policy` | `branding.spec.js` |
| 13 | Wachtwoord resetten terwijl A is ingelogd | A | Twee browsercontexten (`browser.newContext()`): A blijft ingelogd, na uitloggen werkt alleen het nieuwe wachtwoord | `organisation-manage.spec.js` |
| 13b | Code wijzigen terwijl A is ingelogd | A | Twee contexten: A gaat bij de volgende actie naar `/login` met "Je sessie is verlopen. Log opnieuw in." | `organisation-manage.spec.js` |
| 14 | Verwijderen annuleren | A | Bevestiging annuleren; organisatie bestaat nog | `organisation-manage.spec.js` |
| 15 | Verwijderen bevestigen | A | Weg uit overzicht, inloggen faalt, code opnieuw gebruiken wordt geweigerd | `organisation-manage.spec.js` |
| 16 | Logboek | A | Controleer dat de acties van de eigen test erin staan, nieuwste eerst, zonder wachtwoorden. Zoek op de naam van de eigen organisatie, want het logboek is gedeeld | `audit-log.spec.js` |
| 17 | 10 mislukte pogingen, dan een juiste | A | Eigen organisatie. Let op: zie het risico hieronder | `login-throttling.spec.js` |
| 18 | Sessie verloopt na de time-out (organisatie) | B | De backendtests zetten `lastActivityAt` terug en controleren 401. Niet in Playwright wachten | n.v.t. |
| 19 | Activiteit verlengt de sessie | B | Idem | n.v.t. |
| 20 | Time-out als beheerder | B | Idem | n.v.t. |
| 21 | Geen achtergrondverzoeken | H | Eenmalig handmatig bij een wijziging aan de frontend | n.v.t. |
| 22 | Browser sluiten en heropenen | H | Niet te automatiseren | n.v.t. |
| 23 | Cookie-eigenschappen | A | `context.cookies()`: `sid` heeft geen vervaldatum, `httpOnly`, `secure` en `sameSite: Strict` | `session-cookie.spec.js` |
| 24 | Opruimtaak verlopen sessies | B | Gedekt door de backendtests (opruimfunctie direct aangeroepen) | n.v.t. |
| SC-003 | Isolatiecontrole | B | Integratietest `organisation-isolation` | n.v.t. |

## Over 18 t/m 24

De sessietijd zit aan de serverkant, en de backendtests dekken dat al zonder te wachten. Playwright zou hier minuten wachten en de time-out in `.env` moeten aanpassen, voor een resultaat dat al getest is. Scenario 23 is wel goedkoop en nuttig (cookie-eigenschappen zijn een beveiligingsregel), dus die automatiseren we wel.

## Risico's en aandachtspunten

- **Scenario 17 (mislukte pogingen):** hangt de blokkade aan het IP-adres, dan kunnen de mislukte pogingen ook andere tests laten falen. Controleer FR-018 in `data-model.md` of `contracts/api.md`. Zet deze test in een eigen bestand en laat hem als laatste draaien.
- **Scenario 1 en 17:** ook hier telt de rate-limit mee. Doe niet te veel mislukte pogingen per run.
- **Twee contexten (13, 13b):** de eerdere cookieklacht (een tweede login op hetzelfde account zet de eerste sessie uit) speelt hier. Geef elke context een eigen login met een eigen organisatie.
- **Scenario 8:** controleer hoe je een Quest-koppelcode krijgt en dat de testorganisatie er een heeft.

## Aanbevolen bouwvolgorde

1. `admin-login.spec.js` (1, 6): de simpelste, om de aanpak te oefenen.
2. `organisation-create.spec.js` (2 t/m 5), met een helper voor unieke namen en opruimen.
3. `organisation-login.spec.js` (7, 8, 9).
4. `branding.spec.js` (10 gedeeltelijk, 11, 12).
5. `organisation-manage.spec.js` (13, 13b, 14, 15).
6. `audit-log.spec.js` (16), `session-cookie.spec.js` (23), `login-throttling.spec.js` (17).

## Samenvatting

| Label | Aantal |
|---|---|
| A (automatiseren) | 18 (1 t/m 9, 11 t/m 17 inclusief 13b, en 23) |
| A+H | 1 (10) |
| B (gedekt door backendtests) | 5 (18, 19, 20, 24 en SC-003) |
| H (handmatig) | 2 (21, 22) |
