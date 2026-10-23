# Research: Centrale videobibliotheek, beschikbaarheid en beschrijvingen

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Datum**: 2026-10-23

De stack ligt vast (constitution I) en bouwt voort op features 001 en 002. Dit document legt de
keuzes vast die binnen deze feature nog open stonden.

## R1. Wie mag welke video zien

- **Decision**: één repositoryfunctie `visibleVideosQuery(organisationId)` bepaalt de video's
  die een organisatie mag zien. Lijst, details, thumbnail en de controle vóór wijzigen gebruiken
  allemaal die functie. Een video is zichtbaar voor organisatie X als `Video.deletedAt IS NULL`,
  de eigenaar niet verwijderd is (`Organisation.deletedAt IS NULL`), en:
  - X is de eigenaar, of
  - `visibility = 'public'`, of
  - `visibility = 'selective'` en er bestaat een `VideoAccess`-regel (video, X).

  In SQL: `Video v JOIN Organisation o ON o.id = v.ownerOrganisationId LEFT JOIN VideoAccess a
  ON a.videoId = v.id AND a.organisationId = ?` met de voorwaarden hierboven. De naam van de
  eigenaar komt uit dezelfde join.
- **Rationale**: als de toegangsregel op één plek staat, kunnen lijst en thumbnail niet uit
  elkaar lopen (FR-013, SC-002). Eén query met een `LEFT JOIN` op de primaire sleutel van
  `VideoAccess` blijft snel bij honderden video's.
- **Alternatives considered**: per route een eigen controle (foutgevoelig; één vergeten
  controle is een lek); alle zichtbare video-id's per organisatie vooraf berekenen en opslaan
  (moet bij elke wijziging en elke nieuwe organisatie worden bijgewerkt).

## R2. Tabel `VideoAccess`

- **Decision**: migratie `20261023000001_create_video_access.js` maakt `VideoAccess` zoals in
  het ERD: `videoId` (FK → `Video.id`) en `organisationId` (FK → `Organisation.id`), samen de
  primaire sleutel. Extra index op `organisationId` (zoeken "welke video's zijn met mij
  gedeeld"). `Video` krijgt geen nieuwe velden: `description TEXT NULL` en
  `visibility ENUM('public','selective','private')` bestaan al en komen overeen met het ERD.
  Bestaande video's hebben al `visibility = 'private'` (feature 002); de migratie controleert dat
  niet opnieuw maar de quickstart wel (SC-006).
- **Rationale**: het ERD is de bron van waarheid (constitution); de bestaande tabel wijkt er
  niet van af, dus alleen de ontbrekende tabel komt erbij.
- **Alternatives considered**: een JSON-kolom met organisatie-id's op `Video` (niet in het ERD,
  niet te indexeren voor "met mij gedeeld").

## R3. Standaardbeschikbaarheid in `.env`

- **Decision**: `VIDEO_DEFAULT_VISIBILITY` met de waarde `public`, `selective` of `private`.
  Ontbreekt de variabele, dan `private`. Een ongeldige waarde start de API niet met een fout
  (zoals de andere variabelen), maar valt terug op `private` met een waarschuwing in de log; zo
  kan een typefout de API niet platleggen en geldt toch de veilige keuze (FR-003). De waarde
  komt als `defaultVisibility` in `GET /api/organisation/videos/upload-settings`. Bij
  `selective` als standaard staat in het uploadvenster "Selectief beschikbaar" voorgeselecteerd
  zonder gekozen organisaties; de docent moet er dan een kiezen of een andere keuze maken.
- **Rationale**: uitkomst van clarify (Q1: A). Sluit aan bij de andere instellingen uit
  feature 002 (wijzigen = `.env` + `docker compose up -d api`).
- **Alternatives considered**: de API laten stoppen bij een ongeldige waarde (te streng voor een
  voorkeursinstelling); instelling in de beheeromgeving (afgewezen in clarify).

## R4. Keuzes meesturen met de upload

- **Decision**: de keuzes gaan mee in de tus-header `Upload-Metadata` van het
  `POST`-verzoek dat de upload aanmaakt, naast `filename` en `name`:
  - `visibility`: `public` | `selective` | `private`
  - `description`: de beschrijving (mag ontbreken of leeg zijn)
  - `accessOrganisationIds`: komma-gescheiden id's, alleen bij `selective`

  De upload-guard controleert ze bij het aanmaken (dezelfde regels als bij wijzigen, R5); een
  fout geeft `400 validation_failed` met `fields`, voordat er ook maar één deel is verstuurd.
  tus bewaart de metadata bij de upload, dus bij hervatten hoeft niets opnieuw. Bij het afronden
  controleert de service de keuzes opnieuw (een gekozen organisatie kan intussen verwijderd
  zijn): verwijderde organisaties vallen weg; blijft er bij `selective` geen enkele over, dan
  wordt de video `private` opgeslagen. Video, beschrijving en `VideoAccess`-regels worden in één
  transactie vastgelegd.

  Header-grootte: een beschrijving van 1000 tekens is in UTF-8 hooguit 4000 bytes, base64 ca.
  5,4 KB; samen met naam, bestandsnaam en een paar honderd organisatie-id's kan de header tot ca.
  13 KB worden. Daarom: nginx `large_client_header_buffers 4 32k;` en de Node-server met
  `maxHeaderSize: 32768` (standaard 16 KB voor alle headers samen).
- **Rationale**: in feature 002 bestaat een video pas na een geslaagde controle en er wordt geen
  uploadstatus in de database bewaard; de metadata van tus is precies de plek waar gegevens van
  een lopende upload horen. Vooraf controleren voorkomt dat iemand 10 GB uploadt met een
  ongeldige keuze.
- **Alternatives considered**: na de upload een apart `PATCH`-verzoek met beschrijving en
  beschikbaarheid (sluit de docent het tabblad tussen afronden en dat verzoek, dan krijgt de
  video de standaard; een video zou kort zichtbaar kunnen zijn met de verkeerde keuze); een
  tijdelijke rij in de database bij het starten (in strijd met de opzet van feature 002).

## R5. Eén set controleregels (`videoChoices.js`)

- **Decision**: `backend/src/lib/videoChoices.js` bevat de controles die upload-guard,
  afronden en `PATCH` delen:
  - naam: getrimd, 1–255 tekens (bij wijzigen verplicht als hij wordt meegestuurd);
  - beschrijving: getrimd; leeg of alleen witruimte → `NULL`; maximaal 1000 tekens geteld als
    Unicode-codepunten (`[...text].length`), anders `fields.description` met "De beschrijving
    mag maximaal 1000 tekens zijn."; regeleinden blijven, `\r\n` wordt `\n`;
  - beschikbaarheid: een van de drie waarden;
  - organisaties: alleen bij `selective`, minstens één, alleen id's van actieve organisaties,
    niet de eigen organisatie, zonder dubbele. Onbekende of verwijderde id's → `fields.
    accessOrganisationIds` "Kies alleen organisaties uit de lijst." Geen enkele →
    "Kies minstens één organisatie, of kies ‘Alleen eigen organisatie’." (FR-004).
- **Rationale**: dezelfde regels voor uploaden en wijzigen, op één plek getest.
- **Alternatives considered**: de controles in elke route apart (lopen uit elkaar).

## R6. Bevestiging bij beperken en het aantal organisaties

- **Decision**: de browser berekent het aantal organisaties dat toegang verliest:
  `publiek → n` = alle andere actieve organisaties (uit de keuzelijst, R10), `selectief → de
  gekozen`, `privé → 0`; verloren = huidige groep − nieuwe groep. Is dat aantal > 0, dan vraagt
  het venster eerst om bevestiging (FR-017a). De server slaat altijd op wat de eigenaar stuurt;
  er is geen "proefrun"-endpoint. De pure functie staat in `frontend/src/lib/videoAccess.js`.
- **Rationale**: alle gegevens zijn al in het venster aanwezig; een extra endpoint voegt niets
  toe. Als er tussen openen en opslaan een organisatie bijkomt, wijkt het getal hooguit met één
  af; dat is aanvaard.
- **Alternatives considered**: de server laten tellen met een `dryRun`-parameter (extra route
  en test voor een melding).

## R7. Zoeken, sorteren en filteren in de browser

- **Decision**: `GET /api/organisation/videos` geeft alle zichtbare video's in één keer (geen
  paginering, clarify Q1: A). `frontend/src/lib/videoLibrary.js` filtert en sorteert als pure
  functies op die lijst:
  - zoeken: genormaliseerd (Unicode NFD, accenten weg, kleine letters) op naam, beschrijving en
    naam van de eigenaar; "cafe" vindt dus ook "Café";
  - filteren: `all` / `own` / `others`;
  - sorteren: `uploadedAt` (standaard aflopend), `name` (met `Intl.Collator('nl')`),
    `durationSeconds`, `fileSizeBytes`, elk oplopend of aflopend; bij gelijke waarden op `id`.

  Zoekterm, filter en sortering staan in de state van `VideosView`; het videovenster opent er
  bovenop, dus na sluiten is alles en ook de scrollpositie ongewijzigd (FR-012). Ze worden niet
  onthouden tussen bezoeken. Thumbnails laden met `loading="lazy"`, zodat 500 video's de pagina
  niet vertragen.
- **Rationale**: honderden rijen filteren in JavaScript duurt enkele milliseconden; de lijst
  komt al in één keer binnen. Zoeken zonder serververzoek is direct en houdt de sessieregels
  eenvoudig (geen verzoeken per toetsaanslag).
- **Alternatives considered**: zoeken in de database met `LIKE` (extra verzoeken, en
  accentongevoelig zoeken hangt dan van de collatie af); full-text index (overbodig bij deze
  aantallen).

## R8. Thumbnail van video's van anderen

- **Decision**: `GET /api/organisation/videos/:id/thumbnail` gebruikt de zichtbaarheidsquery
  (R1) in plaats van "eigen video"; verder ongewijzigd (`X-Accel-Redirect`, `Cache-Control:
  private, max-age=3600`).
- **Rationale**: principe III blijft gelden: de API beslist alleen over toegang. Na beperken
  geeft elk nieuw verzoek `404` (FR-017); een thumbnail die een browser al eerder ophaalde, kan
  daar nog tot een uur in de cache staan. Dat is aanvaard: het is een afbeelding die die
  organisatie al gezien heeft, en de video staat niet meer in haar bibliotheek.
- **Alternatives considered**: `no-cache` (elke bibliotheek met 500 video's zou dan 500
  gecontroleerde verzoeken doen, elk met een sessie-update).

## R9. Wijzigen en eigendom

- **Decision**: `PATCH /api/organisation/videos/:id` met een of meer van `name`,
  `description`, `visibility`, `accessOrganisationIds`. Volgorde van controles: is de video
  zichtbaar voor de organisatie (R1)? Zo niet → `404 not_found` (zelfde als niet bestaand,
  FR-013). Is ze niet de eigenaar → `403 not_owner`. Daarna de regels van R5 en in één
  transactie: `Video` bijwerken, `VideoAccess` vervangen (alle regels van de video weg, nieuwe
  erin) bij `selective`, of alle regels weg bij een andere beschikbaarheid (FR-007).
  `DELETE /api/organisation/videos/:id` volgt dezelfde volgorde (`404` / `403` / `204`).
- **Rationale**: een organisatie die een video kan zien, weet dat hij bestaat; `403` verraadt
  dan niets nieuws en geeft een duidelijkere fout. Voor alles wat ze niet kan zien blijft het
  `404`.
- **Alternatives considered**: altijd `404` voor andermans video (minder duidelijk bij
  testen, geen veiligheidswinst).

## R10. Lijst met organisatienamen

- **Decision**: nieuwe route `GET /api/organisation/organisations` →
  `{ "organisations": [ { "id": 4, "name": "Brandweer Academie Noord" } ] }`: alle actieve
  organisaties behalve de eigen, gesorteerd op naam. Alleen `id` en `name` (clarify Q3: A); nooit
  `loginCode` of `questLinkCode`. In een eigen module `organisationDirectory`.
- **Rationale**: de keuzelijst heeft id's nodig om te versturen en namen om te tonen; meer niet.
- **Alternatives considered**: de lijst meesturen in `upload-settings` (vermengt instellingen
  met gegevens); namen uit de bibliotheek afleiden (mist organisaties zonder gedeelde video's).

## R11. Verwijderde organisaties

- **Decision**: de zichtbaarheidsquery sluit video's uit van een eigenaar met `deletedAt`
  (FR-010). In de lijst met gekozen organisaties van een video (`GET /videos/:id`, alleen voor
  de eigenaar) staan alleen actieve organisaties; regels voor verwijderde organisaties blijven in
  de database staan (zacht verwijderd, kunnen niet inloggen) en verdwijnen bij de volgende
  wijziging van de video. Ze tellen niet mee in het aantal bij R6.
- **Rationale**: geen opruimtaak nodig; een verwijderde organisatie kan toch niet inloggen.

## R12. Antwoorden van de API

- **Decision**: elke video in lijst en details heeft `description`, `owner: { id, name,
  isOwn }`; alleen bij eigen video's ook `visibility`. `GET /videos/:id` geeft voor de eigenaar
  ook `accessOrganisations: [ { id, name } ]`. Andere organisaties krijgen `visibility` en
  `accessOrganisations` niet (FR-006).
- **Rationale**: alleen de eigenaar mag weten met wie een video gedeeld is; de lijst blijft
  klein genoeg (500 × 1000 tekens ≈ 0,5 MB in het slechtste geval).

## R13. Testen

- **Decision**: backend-integratietests met drie organisaties (A eigenaar, B gekozen, C niet
  gekozen) en video's met alle drie beschikbaarheden: lijst, details, thumbnail, wijzigen en
  verwijderen voor elke combinatie (SC-001, SC-002); beperken en direct daarna opvragen
  (SC-003); uploaden met keuzes in de metadata, ongeldige keuzes vóór het eerste deel, en een
  gekozen organisatie die tijdens de upload wordt verwijderd. Unittests voor `videoChoices.js`.
  Frontend-unittests voor `videoLibrary.js` (zoeken met accenten, sorteren, filteren,
  combinaties) en `videoAccess.js` (aantal dat toegang verliest). Een prestatietest met 500
  video's via `scripts/seed-videos.js` (feature 002) in de quickstart.
- **Rationale**: de toegangsregels zijn het risico van deze feature; de matrixtest dekt ze
  volledig.
