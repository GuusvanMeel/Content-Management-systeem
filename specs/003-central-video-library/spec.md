# Feature Specification: Centrale videobibliotheek, beschikbaarheid en beschrijvingen

**Feature Branch**: `Development` (spec-map: `specs/003-central-video-library`)

**Created**: 2026-10-23

**Status**: Draft

**Input**: User description: "Central video library, availability and descriptions (FR-14). De
videobibliotheek van feature 002 wordt een centrale bibliotheek die organisaties delen. De
uploader kiest per video: Algemeen beschikbaar, Selectief beschikbaar (de uploader kiest welke
organisaties toegang krijgen) of Alleen eigen organisatie. De standaardkeuze voor nieuwe video's
is instelbaar zonder codewijziging; bestaande video's worden 'Alleen eigen organisatie'. Een
video krijgt een beschrijving, los van de naam. Zoeken, sorteren en filteren in de bibliotheek.
Alleen de eigenaar wijzigt of verwijdert een video; de beheerder heeft geen videofuncties.
Buiten scope: cursussen, de regel dat een video pas echt verdwijnt als geen gepubliceerde cursus
hem gebruikt, de Quest-app, dubbele video's herkennen, videobeheer door de beheerder."

**Bronnen**: `docs/Requirements.docx` FR-14; ERD `docs/Diagrams.simp`, entiteiten `Video`
(velden `description` en `visibility`) en `VideoAccess`. Bouwt voort op feature 001
(organisaties, afscherming, sessies) en feature 002 (videobibliotheek, uploaden, zacht
verwijderen).

## Clarifications

### Session 2026-10-23

- Q: Waar staat de standaardbeschikbaarheid voor nieuwe video's? → A: In de serverconfiguratie
  (`.env`); het projectteam wijzigt haar en herstart de server. Niet in de beheeromgeving, zodat
  die geen videofuncties krijgt. Zonder of met een ongeldige waarde geldt "Alleen eigen
  organisatie".
- Q: Hoe lang mag een beschrijving maximaal zijn? → A: 1000 tekens.
- Q: Toont de bibliotheek alle video's in één lijst of per pagina? → A: In één lijst met alle
  beschikbare video's, zonder pagina's of steeds verder laden; zoeken, sorteren en filteren
  werken direct op die lijst.
- Q: Vraagt het systeem om bevestiging als de beschikbaarheid beperkter wordt? → A: Alleen als
  er organisaties hun toegang verliezen, met het aantal: "3 organisaties kunnen deze video
  daarna niet meer zien." Ruimer maken wordt direct opgeslagen.
- Q: Mag elke organisatie bij "Selectief beschikbaar" de namen van alle andere organisaties
  zien? → A: Ja, de lijst toont de namen van alle actieve organisaties en verder niets (geen
  organisatiecodes of andere gegevens).
- Q: Waar openen de videogegevens: als eigen pagina of in een venster boven de bibliotheek?
  → A: In een venster boven de bibliotheek; na sluiten staat de lijst er precies zo als
  ervoor (zoekterm, filter, sortering en scrollpositie). Naam, beschrijving en beschikbaarheid
  wijzigt de eigenaar in hetzelfde venster.

### Session 2026-10-23 (na de eerste implementatie)

- Q: Hoe vallen video's van andere organisaties op? → A: Met een duidelijk zichtbaar label
  (pil) met de naam van de eigenaar, in een eigen kleur, in de lijst en in het videovenster.
  Eigen video's krijgen een onopvallend, neutraal label "Eigen". Klikken op de pil van een
  andere organisatie filtert de bibliotheek op die organisatie; het actieve filter staat als
  verwijderbaar label "Organisatie: <naam> ✕" naast het zoekveld en werkt samen met zoeken,
  sorteren en het filter eigen/andere.
- Q: Hoe ziet de teller bij de beschrijving eruit? → A: "<aantal> tekens over"; bij 0 (ook als
  de grens door plakken is bereikt of overschreden) wordt de teller rood. Meer tekens invoeren
  kan niet; wat er bij plakken niet meer in past, wordt weggelaten met de melding "De
  beschrijving mag maximaal 1000 tekens zijn; de rest is niet overgenomen." Dit geldt in het
  uploadvenster en in het videovenster.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Beschikbaarheid kiezen bij het uploaden (Priority: P1)

Een docent voegt een 360°-video toe en kiest in het uploadvenster per video wie de video mag
zien: alle organisaties ("Algemeen beschikbaar"), alleen gekozen organisaties ("Selectief
beschikbaar") of alleen de eigen organisatie ("Alleen eigen organisatie"). De standaardkeuze is
al ingevuld; de docent kan die per video aanpassen.

**Why this priority**: dit is de kern van FR-14: zonder beschikbaarheid kan geen organisatie
video's van een andere organisatie gebruiken, en blijft elke organisatie zelf alle video's
opnemen.

**Independent Test**: als organisatie A een video uploaden met "Algemeen beschikbaar", een
tweede met "Selectief beschikbaar" voor organisatie B en een derde met "Alleen eigen
organisatie"; daarna als B en als C inloggen en controleren welke video's elk ziet.

**Acceptance Scenarios**:

1. **Given** een docent die een geldige video kiest, **When** het uploadvenster opent, **Then**
   staat per video het veld "Beschikbaarheid" met de drie keuzes, en is de ingestelde
   standaardkeuze al geselecteerd.
2. **Given** een video met "Algemeen beschikbaar", **When** een docent van een andere
   organisatie de bibliotheek opent, **Then** staat de video erin, gemarkeerd met de naam van de
   organisatie die hem uploadde.
3. **Given** een docent die "Selectief beschikbaar" kiest, **When** de keuze is gemaakt,
   **Then** kan de docent een of meer andere organisaties aanvinken uit een lijst met
   organisatienamen (de eigen organisatie staat er niet in), en kan de upload pas starten als er
   minstens één organisatie is gekozen.
4. **Given** een video die selectief beschikbaar is voor organisatie B, **When** B en C de
   bibliotheek openen, **Then** ziet B de video en C niet.
5. **Given** een video met "Alleen eigen organisatie", **When** een andere organisatie de
   bibliotheek opent of de video op een andere manier probeert op te vragen, **Then** ziet die
   organisatie hem niet en wordt elke poging geweigerd.
6. **Given** meerdere video's in het uploadvenster, **When** de docent per video een andere
   beschikbaarheid kiest, **Then** krijgt elke video de eigen keuze.

---

### User Story 2 - De centrale bibliotheek bekijken (Priority: P1)

Een docent opent de videobibliotheek en ziet de eigen video's en de video's van andere
organisaties die voor de eigen organisatie beschikbaar zijn. Bij elke video is duidelijk van
wie hij is. Video's van anderen kan de docent alleen bekijken, niet wijzigen of verwijderen.

**Why this priority**: zonder deze weergave heeft het delen geen nut; het is de plek waar
docenten video's van anderen vinden.

**Independent Test**: organisaties A en B elk een video laten uploaden die voor de ander
beschikbaar is; als A de bibliotheek openen en beide video's zien, waarbij de video van B de
naam van B toont en geen knoppen om te wijzigen of te verwijderen heeft.

**Acceptance Scenarios**:

1. **Given** eigen video's en beschikbare video's van anderen, **When** de docent de
   bibliotheek opent, **Then** staan ze samen in één lijst, met per video thumbnail, naam,
   beschrijving (ingekort), duur, grootte en uploaddatum. Video's van andere organisaties
   hebben een opvallende pil in een eigen kleur met de naam van de eigenaar; eigen video's een
   onopvallende, neutrale pil "Eigen".
2. **Given** een video van een andere organisatie, **When** de docent de video bekijkt,
   **Then** zijn er geen knoppen om de naam, beschrijving of beschikbaarheid te wijzigen of om
   te verwijderen, en wordt elke poging om dat toch te doen geweigerd.
3. **Given** een video, **When** de docent op de video klikt, **Then** opent een venster boven
   de bibliotheek met de videogegevens: thumbnail, naam, volledige beschrijving, duur, grootte,
   uploaddatum en eigenaar; bij een eigen video ook de beschikbaarheid (en bij "Selectief
   beschikbaar" de gekozen organisaties).
4. **Given** een bibliotheek met een zoekterm, een filter en een sortering, waarin de docent
   naar beneden heeft gescrold, **When** de docent een video opent en het venster weer sluit,
   **Then** staat de lijst er precies zo als ervoor.
5. **Given** een video van organisatie A die niet (meer) beschikbaar is voor B, **When** B de
   bibliotheek opent, **Then** staat de video er niet in en is ook de thumbnail niet op te
   vragen.
6. **Given** een eigen video, **When** een andere organisatie hem in haar bibliotheek ziet,
   **Then** ziet die andere organisatie niet met welke organisaties de video verder gedeeld is.

---

### User Story 3 - Een eigen video wijzigen (Priority: P2)

De eigenaar van een video wijzigt de naam, de beschrijving of de beschikbaarheid. Wordt de
beschikbaarheid beperkter, dan verdwijnt de video uit de bibliotheek van organisaties die geen
toegang meer hebben.

**Why this priority**: organisaties moeten fouten kunnen herstellen en later kunnen besluiten een
video breder of minder breed te delen; voor de eerste werkende versie is de keuze bij het
uploaden het belangrijkst.

**Independent Test**: als A een video van "Algemeen beschikbaar" naar "Selectief beschikbaar"
voor B zetten en controleren dat C de video niet meer ziet en B wel; daarna naam en beschrijving
wijzigen en controleren dat B de nieuwe gegevens ziet.

**Acceptance Scenarios**:

1. **Given** een eigen video, **When** de eigenaar de naam wijzigt, **Then** ziet elke
   organisatie die de video ziet de nieuwe naam.
2. **Given** een eigen video, **When** de eigenaar de beschrijving wijzigt of leegmaakt,
   **Then** ziet elke organisatie die de video ziet de nieuwe beschrijving, of geen beschrijving.
3. **Given** een video met "Algemeen beschikbaar", **When** de eigenaar die wijzigt naar
   "Selectief beschikbaar" voor B, **Then** ziet B de video nog wel en verdwijnt hij bij de
   volgende keer laden uit de bibliotheek van elke andere organisatie.
4. **Given** een selectief beschikbare video voor B en C, **When** de eigenaar C uit de lijst
   haalt, **Then** verdwijnt de video uit de bibliotheek van C en blijft hij bij B.
5. **Given** een gedeelde video, **When** de eigenaar die wijzigt naar "Alleen eigen
   organisatie", **Then** verdwijnt de video uit de bibliotheek van elke andere organisatie.
6. **Given** een video met "Alleen eigen organisatie", **When** de eigenaar die wijzigt naar
   "Algemeen beschikbaar", **Then** verschijnt de video in de bibliotheek van alle organisaties.
7. **Given** een video met "Algemeen beschikbaar" in een systeem met vier andere organisaties,
   **When** de eigenaar die wijzigt naar "Selectief beschikbaar" voor één organisatie,
   **Then** vraagt het systeem eerst "3 organisaties kunnen deze video daarna niet meer zien.";
   bij "Annuleren" blijft de video algemeen beschikbaar, bij "Wijzigen" wordt de wijziging
   opgeslagen. Bij een wijziging naar een ruimere beschikbaarheid komt er geen vraag.
8. **Given** een video van organisatie A, **When** B probeert naam, beschrijving of
   beschikbaarheid te wijzigen, ongeacht hoe het verzoek is samengesteld, **Then** wordt dit
   geweigerd en blijft de video ongewijzigd.

---

### User Story 4 - Een beschrijving toevoegen (Priority: P2)

Een docent geeft bij het uploaden (optioneel) een beschrijving van wat er in de video te zien is,
zodat andere docenten zonder de video te bekijken weten of hij bruikbaar is.

**Why this priority**: in een gedeelde bibliotheek is de naam alleen vaak te weinig om een video
te kiezen; zonder beschrijving werkt delen wel, maar minder goed.

**Independent Test**: een video uploaden met een beschrijving en een zonder; controleren dat de
beschrijving in de bibliotheek (ingekort) en in de videogegevens (volledig) staat, en dat de
video zonder beschrijving geen lege regel of foutmelding toont.

**Acceptance Scenarios**:

1. **Given** het uploadvenster, **When** de docent een beschrijving invult, **Then** krijgt de
   video die beschrijving.
2. **Given** het uploadvenster, **When** de docent geen beschrijving invult, **Then** wordt de
   video zonder beschrijving opgeslagen.
3. **Given** een beschrijving die langer is dan de maximale lengte, **When** de docent die
   typt of plakt, **Then** staat er "<aantal> tekens over", kan er niet meer worden ingevoerd
   dan het maximum, wordt de teller rood bij "0 tekens over", en ziet de docent bij plakken de
   melding dat de rest niet is overgenomen. Dit geldt in het uploadvenster en in het
   videovenster.
4. **Given** een beschrijving met meerdere regels, **When** de videogegevens worden getoond,
   **Then** blijven de regels behouden.

---

### User Story 5 - Zoeken, sorteren en filteren (Priority: P2)

In een gedeelde bibliotheek met honderden video's zoekt de docent op naam, beschrijving of
organisatie, sorteert de lijst en filtert op eigen video's of video's van anderen.

**Why this priority**: met video's van meerdere organisaties wordt de lijst te lang om door te
bladeren; zonder zoeken is de centrale bibliotheek in de praktijk lastig te gebruiken.

**Independent Test**: een bibliotheek met honderden video's van meerdere organisaties vullen,
zoeken op een woord uit een beschrijving en op een organisatienaam, sorteren op duur en
filteren op "Van andere organisaties", en controleren dat de juiste video's in de juiste
volgorde staan.

**Acceptance Scenarios**:

1. **Given** de bibliotheek, **When** de docent een zoekterm invult, **Then** staan alleen
   video's waarvan de naam, de beschrijving of de naam van de eigenaar de zoekterm bevat
   (hoofdletters en kleine letters maken niet uit).
2. **Given** de bibliotheek, **When** de docent sorteert op naam, uploaddatum, duur of grootte,
   **Then** staan de video's in die volgorde, oplopend of aflopend naar keuze; standaard staat
   de nieuwste video bovenaan.
3. **Given** de bibliotheek, **When** de docent filtert op "Eigen video's" of "Van andere
   organisaties", **Then** staan alleen die video's in de lijst; "Alle video's" toont beide.
4. **Given** een zoekterm, een sortering en een filter tegelijk, **When** de lijst wordt
   getoond, **Then** gelden ze alle drie.
5. **Given** een zoekopdracht zonder resultaten, **When** de lijst leeg blijft, **Then** ziet de
   docent "Geen video's gevonden" met een knop om de zoekterm en het filter te wissen.
6. **Given** een bibliotheek met honderden video's, **When** de docent zoekt, sorteert of
   filtert, **Then** is het resultaat vrijwel direct zichtbaar (zie SC-005).
7. **Given** video's van meerdere andere organisaties, **When** de docent op de pil
   "Brandweer Academie Noord" bij een video klikt (in de lijst of in het videovenster),
   **Then** staan alleen de video's van die organisatie in de lijst en staat naast het zoekveld
   het label "Organisatie: Brandweer Academie Noord ✕".
8. **Given** een actief organisatiefilter, **When** de docent ook een zoekterm, een sortering of
   het filter eigen/andere kiest, **Then** gelden ze allemaal tegelijk; **When** de docent het
   label wegklikt, **Then** vervalt alleen het organisatiefilter.

---

### Edge Cases

- **Bestaande video's**: alle video's van feature 002 hebben "Alleen eigen organisatie" en
  blijven dat tot de eigenaar het wijzigt. Ze hebben geen beschrijving.
- **Selectief zonder organisaties**: "Selectief beschikbaar" zonder gekozen organisatie wordt
  geweigerd met de melding "Kies minstens één organisatie, of kies ‘Alleen eigen organisatie’."
- **De eigen organisatie kiezen bij selectief**: kan niet; de eigen organisatie staat niet in de
  lijst.
- **Een gekozen organisatie wordt door de beheerder verwijderd**: ze kan niet meer inloggen, dus
  ziet ze de video niet meer. Ze verdwijnt uit de lijst met gekozen organisaties bij de video.
  Blijft er bij een selectief beschikbare video geen actieve organisatie over, dan ziet alleen
  de eigenaar de video nog; het videovenster toont "Selectief beschikbaar: geen organisaties
  meer gekozen. Alleen jouw organisatie ziet deze video." De beschikbaarheid verandert niet
  vanzelf.
- **De eigenaar wordt door de beheerder verwijderd**: haar video's verdwijnen uit de
  bibliotheek van alle organisaties (feature 001, FR-014). Wat er gebeurt met cursussen die die
  video's al gebruiken, regelt de feature voor cursussen.
- **Nieuwe organisatie**: een organisatie die later wordt aangemaakt, ziet meteen alle
  video's met "Algemeen beschikbaar"; selectief gedeelde video's ziet ze pas als een eigenaar
  haar toevoegt.
- **Beperken terwijl een andere organisatie de bibliotheek open heeft**: bij de volgende keer
  laden of de volgende actie op die video (bijv. de videogegevens openen) is de video weg;
  een al geladen lijst wordt niet op de achtergrond ververst (geen polling, feature 001).
- **Van selectief naar een andere keuze en terug**: de eerder gekozen organisaties worden niet
  onthouden; bij opnieuw "Selectief beschikbaar" kiest de eigenaar ze opnieuw.
- **Video's die een andere organisatie al in een cursus gebruikt**: buiten scope; wat er met
  cursussen gebeurt als de beschikbaarheid beperkter wordt of de video wordt verwijderd, regelt
  de feature voor cursussen.
- **Een verwijderde video**: verdwijnt voor alle organisaties uit de bibliotheek (zacht
  verwijderen, feature 002); de beschikbaarheid blijft bij de video bewaard.
- **Naam wijzigen naar leeg of alleen spaties**: wordt geweigerd met de melding "Vul een naam
  in."; langer dan 255 tekens wordt geweigerd.
- **Beschrijving met alleen spaties**: telt als geen beschrijving.
- **Zoeken op een deel van een woord**: "dieps" vindt "diepste"; zoeken houdt geen rekening met
  hoofdletters.
- **Twee video's met dezelfde naam van verschillende organisaties**: toegestaan; de eigenaar
  maakt het verschil zichtbaar.
- **De beheerder**: heeft geen enkele videofunctie; alle functies en schermen voor video's zijn
  alleen voor ingelogde organisaties.

## Requirements *(mandatory)*

### Functional Requirements

**Beschikbaarheid**

- **FR-001**: Elke video MUST precies één van drie beschikbaarheden hebben: "Algemeen
  beschikbaar" (alle actieve organisaties), "Selectief beschikbaar" (de eigenaar en de gekozen
  organisaties) of "Alleen eigen organisatie" (alleen de eigenaar).
- **FR-002**: Het uploadvenster MUST per video een veld "Beschikbaarheid" tonen met de drie
  keuzes, waarbij de ingestelde standaardkeuze al geselecteerd is. De docent MUST per video een
  andere keuze kunnen maken.
- **FR-003**: De standaardkeuze voor nieuwe video's MUST instelbaar zijn zonder codewijziging,
  in de configuratie van de server: het projectteam wijzigt haar en herstart daarna de server.
  Zonder instelling, of bij een ongeldige waarde, is de standaard "Alleen eigen organisatie".
  De instelling geldt alleen voor de voorselectie in het uploadvenster; bestaande video's
  veranderen er niet door.
- **FR-004**: Bij "Selectief beschikbaar" MUST de docent een of meer organisaties kunnen kiezen
  uit een lijst met de namen van alle actieve organisaties behalve de eigen organisatie,
  alfabetisch. De lijst MUST alleen namen bevatten: organisatiecodes, Quest-koppelcodes en
  andere gegevens van organisaties MUST NOT aan andere organisaties worden getoond. Zonder
  gekozen organisatie MUST de keuze geweigerd worden met de melding "Kies minstens één
  organisatie, of kies ‘Alleen eigen organisatie’." Dit geldt bij het uploaden en bij het
  wijzigen.
- **FR-005**: Alle video's die al bestonden voordat deze feature beschikbaar is, MUST "Alleen
  eigen organisatie" hebben.
- **FR-006**: De gekozen organisaties van een video MUST alleen voor de eigenaar zichtbaar zijn;
  andere organisaties zien niet met wie een video verder gedeeld is.
- **FR-007**: Zodra de beschikbaarheid niet meer "Selectief beschikbaar" is, MUST de lijst met
  gekozen organisaties vervallen.

**Centrale bibliotheek**

- **FR-008**: De bibliotheek van een organisatie MUST alle niet-verwijderde video's tonen die
  voor die organisatie beschikbaar zijn: de eigen video's, alle video's met "Algemeen
  beschikbaar" van andere actieve organisaties, en video's met "Selectief beschikbaar" waarvoor
  de organisatie gekozen is.
- **FR-009**: Bij elke video in de bibliotheek en in het videovenster MUST de eigenaar zichtbaar
  zijn. Een video van een andere organisatie MUST een duidelijk zichtbare pil hebben met de
  naam van die organisatie, in een kleur die alleen daarvoor wordt gebruikt en die los staat
  van de huisstijl. Een eigen video MUST een onopvallende, neutrale pil "Eigen" hebben, zodat
  het verschil in één oogopslag te zien is.
- **FR-010**: Video's van een verwijderde organisatie MUST NOT meer in de bibliotheek van andere
  organisaties staan (feature 001, FR-014).
- **FR-011**: Een organisatie MUST video's van anderen alleen kunnen bekijken (gegevens en
  thumbnail). Afspelen in de browser blijft buiten scope (feature 002, FR-018).
- **FR-012**: Klikken op een video in de bibliotheek MUST een venster boven de bibliotheek openen
  met de videogegevens: thumbnail, naam, volledige beschrijving (met behoud van regels), duur,
  grootte, uploaddatum en eigenaar; voor de eigenaar ook de beschikbaarheid en, bij "Selectief
  beschikbaar", de gekozen organisaties. Na het sluiten van het venster MUST de bibliotheek er
  precies zo uitzien als ervoor: dezelfde zoekterm, hetzelfde filter, dezelfde sortering en
  dezelfde scrollpositie.
- **FR-012a**: De eigenaar MUST naam, beschrijving en beschikbaarheid in hetzelfde venster
  kunnen wijzigen en opslaan; "Annuleren" sluit het venster zonder iets te wijzigen.
- **FR-013**: Elke poging van een organisatie om een video of thumbnail op te vragen die niet
  voor haar beschikbaar is, MUST geweigerd worden, ongeacht hoe het verzoek is samengesteld, met
  dezelfde reactie als voor een video die niet bestaat.

**Eigendom en wijzigen**

- **FR-014**: Alleen de eigenaar van een video (de organisatie die hem uploadde) MUST de naam,
  de beschrijving en de beschikbaarheid kunnen wijzigen en de video kunnen verwijderen. Bij
  video's van anderen MUST het scherm geen knoppen daarvoor tonen, en elke poging van een andere
  organisatie MUST geweigerd worden, ongeacht hoe het verzoek is samengesteld.
- **FR-015**: De naam van een video MUST na het uploaden gewijzigd kunnen worden (1–255 tekens,
  niet alleen spaties).
- **FR-016**: Een wijziging van naam of beschrijving MUST direct gelden voor elke organisatie die
  de video ziet, vanaf het volgende laden.
- **FR-017**: Wordt de beschikbaarheid beperkter, dan MUST de video vanaf het volgende verzoek
  uit de bibliotheek verdwijnen van elke organisatie die geen toegang meer heeft, en MUST die
  organisatie de video en de thumbnail niet meer kunnen opvragen. Wat er gebeurt met cursussen
  die de video al gebruiken, valt buiten deze feature.
- **FR-017a**: Verliezen een of meer organisaties door een wijziging hun toegang, dan MUST het
  systeem eerst om bevestiging vragen met het aantal organisaties: "<aantal> organisaties kunnen
  deze video daarna niet meer zien." (bij één: "1 organisatie kan deze video daarna niet meer
  zien."), met de knoppen "Wijzigen" en "Annuleren". Bij annuleren MUST de beschikbaarheid
  ongewijzigd blijven. Verliest niemand toegang (de beschikbaarheid wordt gelijk of ruimer), dan
  MUST de wijziging zonder bevestiging worden opgeslagen.
- **FR-018**: Verwijderen MUST zacht blijven, zoals in feature 002 (FR-019, FR-020): de video
  verdwijnt voor alle organisaties uit de bibliotheek en de gegevens en bestanden blijven
  bewaard, inclusief de beschikbaarheid.
- **FR-019**: Video's van andere organisaties MUST NOT aan een cursus toegevoegd kunnen worden
  binnen deze feature; dat komt met de feature voor cursussen.

**Beschrijving**

- **FR-020**: Een video MUST een optionele beschrijving kunnen hebben, los van de naam, van
  maximaal 1000 tekens. Een langere beschrijving MUST geweigerd worden met de melding "De
  beschrijving mag maximaal 1000 tekens zijn." Een beschrijving met alleen spaties telt als geen
  beschrijving.
- **FR-021**: Het uploadvenster MUST per video een optioneel veld "Beschrijving" hebben, en het
  videovenster MUST bij wijzigen hetzelfde veld hebben. Onder het veld MUST de teller
  "<aantal> tekens over" staan, geteld zoals de server telt. Bij 0 tekens over MUST de teller
  rood zijn. Het veld MUST niet meer tekens toestaan dan het maximum; tekst die bij plakken niet
  meer past, MUST worden weggelaten met de melding "De beschrijving mag maximaal 1000 tekens
  zijn; de rest is niet overgenomen."
- **FR-022**: De bibliotheek MUST de beschrijving ingekort tonen (de eerste regels); de
  videogegevens MUST de volledige beschrijving tonen. Een video zonder beschrijving MUST geen
  lege ruimte of placeholdertekst in de lijst tonen.

**Zoeken, sorteren en filteren**

- **FR-023**: De docent MUST in de bibliotheek kunnen zoeken op naam, beschrijving en naam van de
  eigenaar. Zoeken MUST een deel van een woord vinden en MUST geen verschil maken tussen
  hoofdletters en kleine letters.
- **FR-024**: De docent MUST kunnen sorteren op naam, uploaddatum, duur en grootte, oplopend of
  aflopend. Standaard MUST de nieuwste video bovenaan staan.
- **FR-025**: De docent MUST kunnen filteren op "Alle video's", "Eigen video's" en "Van andere
  organisaties". Zoeken, sorteren en filteren MUST samen werken.
- **FR-025a**: De bibliotheek MUST alle beschikbare video's in één lijst tonen, zonder pagina's
  en zonder steeds verder laden. Zoeken, sorteren en filteren MUST direct op die lijst werken,
  zonder de bibliotheek opnieuw te laden.
- **FR-025b**: Klikken op de pil van een andere organisatie (in de lijst of in het videovenster)
  MUST de bibliotheek filteren op die organisatie; vanuit het videovenster sluit het venster
  daarbij. Het actieve filter MUST naast het zoekveld staan als label "Organisatie: <naam> ✕";
  klikken op het label (of het kruisje) MUST alleen dat filter wissen. Het organisatiefilter
  MUST samenwerken met zoeken, sorteren en het filter eigen/andere. De pil "Eigen" filtert niet.
- **FR-026**: Levert zoeken of filteren niets op, dan MUST de bibliotheek "Geen video's gevonden"
  tonen met een knop die zoekterm, het filter eigen/andere en het organisatiefilter wist.

**Beheerder**

- **FR-027**: De beheerder MUST NOT video's kunnen zien, uploaden, wijzigen of verwijderen; de
  beheeromgeving blijft alleen voor organisaties en accounts, ook voor de standaardbeschikbaarheid
  (die staat in de serverconfiguratie, FR-003).

### Key Entities *(include if feature involves data)*

- **Video** (bestaat, feature 002): krijgt in deze feature een gekozen beschikbaarheid (ERD-veld
  `visibility`: algemeen, selectief of alleen eigen organisatie) en een optionele beschrijving
  (ERD-veld `description`). Beide velden staan al in de bestaande tabel; nieuw is dat ze worden
  gebruikt.
- **VideoAccess** (nieuw, staat al in het ERD): de koppeling tussen een selectief beschikbare
  video en een organisatie die toegang heeft. Eén regel per video en organisatie; alleen in
  gebruik bij "Selectief beschikbaar".
- **Organisation** (bestaat, feature 001): eigenaar van video's en mogelijk gekozen voor
  selectief beschikbare video's van anderen.
- **Standaardbeschikbaarheid**: geen gegeven in de database, maar een instelling in de
  serverconfiguratie met één van de drie keuzes (FR-003); het ERD verandert er niet door.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: In een test met drie organisaties en video's met elk van de drie beschikbaarheden
  ziet elke organisatie precies de video's die volgens FR-008 voor haar beschikbaar zijn: 0
  video's te veel en 0 te weinig.
- **SC-002**: 0% van de pogingen van een organisatie om een video van een andere organisatie te
  wijzigen of te verwijderen, of een niet-beschikbare video of thumbnail op te vragen, slaagt.
- **SC-003**: Na het beperken van de beschikbaarheid ziet een organisatie die geen toegang meer
  heeft de video bij het eerstvolgende laden van de bibliotheek in 100% van de gevallen niet
  meer.
- **SC-004**: Een docent zonder technische kennis kan bij het uploaden zonder hulp de
  beschikbaarheid kiezen en een beschrijving invullen, en kan in de bibliotheek een video van
  een andere organisatie vinden (NFR-03).
- **SC-005**: Met 500 zichtbare video's in de bibliotheek staat de volledige lijst binnen 2
  seconden in beeld (zelfde doel als feature 002), en staat het resultaat van zoeken, sorteren
  of filteren binnen 1 seconde in beeld.
- **SC-006**: 100% van de video's uit feature 002 heeft na de invoering van deze feature
  "Alleen eigen organisatie" en is dus niet zichtbaar voor andere organisaties.
- **SC-007**: De beheeromgeving heeft geen schermen of functies voor video's.

## Assumptions

- De velden `description` en `visibility` van `Video` bestaan al in de database (feature 002)
  en komen overeen met het ERD; alleen de tabel `VideoAccess` (video en organisatie, samen de
  sleutel) moet nog worden aangemaakt. Er komen geen andere velden bij.
- "Alle organisaties" betekent alle actieve (niet-verwijderde) organisaties, ook organisaties
  die later worden aangemaakt.
- Elke organisatie kan via de keuzelijst bij "Selectief beschikbaar" de namen van alle andere
  actieve organisaties zien (FR-004); dat is bewust aanvaard (zie Clarifications), omdat
  selectief delen anders niet mogelijk is.
- De eigenaar van een video is altijd de organisatie die hem uploadde; eigendom overdragen valt
  buiten deze feature.
- Het videobestand zelf wordt niet in de browser afgespeeld (feature 002, FR-018); video's van
  anderen bekijken betekent hun gegevens en thumbnail zien.
- De video-kiezer in de cursus-editor gebruikt nog prototypevideo's; video's van andere
  organisaties in cursussen gebruiken komt met de feature voor cursussen.
- De bibliotheek wordt niet op de achtergrond ververst (geen polling, feature 001); wijzigingen
  van een andere organisatie verschijnen bij het volgende laden.
- Er komt geen logboek van wijzigingen aan video's; het logboek van feature 001 is alleen voor
  acties van de beheerder.
- Buiten scope: cursussen en scenario-onderdelen, de regel dat een video pas echt wordt verwijderd
  als geen gepubliceerde cursus hem gebruikt, de Quest-app, dubbele video's herkennen, videobeheer
  door de beheerder, eigendom overdragen, verwijderde video's herstellen.
