# Feature Specification: Organisaties, accounts en inloggen

**Feature Branch**: `Development` (spec-map: `specs/001-organisation-accounts-login`)

**Created**: 2026-10-20

**Status**: Draft

**Input**: User description: "Organisations, accounts and login for the CMS. Een beheerder beheert
het systeem; docenten/trainers gebruiken het CMS namens een organisatie. De beheerder maakt
organisaties aan (inclusief account met unieke organisatiecode en wachtwoord), past ze aan,
verwijdert ze en reset wachtwoorden. Docenten loggen in met organisatiecode en wachtwoord. Een
organisatie ziet alleen haar eigen gegevens en kan een eigen huisstijl instellen. Buiten scope:
cursussen, video's, publiceren, Quest-koppeling. Zie requirements FR-01 t/m FR-05 en het ERD
(Administrator, Organisation, OrganisationStyle)."

## Clarifications

### Session 2026-10-20

- Q: Wat gebeurt er met de cursussen en video's van een organisatie die de beheerder verwijdert?
  → A: De organisatie wordt zacht verwijderd: ze kan niet meer inloggen en haar code blijft
  gereserveerd. Haar cursussen en video's volgen de bestaande verwijderregels: ze verdwijnen uit
  de bibliotheken, blijven bruikbaar voor organisaties die ze al gebruiken, en worden pas echt
  verwijderd als niemand ze meer gebruikt.
- Q: Mag een ingelogde organisatie haar eigen wachtwoord wijzigen? → A: Nee, alleen de beheerder
  stelt wachtwoorden in of reset ze.
- Q: Na hoeveel inactiviteit wordt een gebruiker automatisch uitgelogd? → A: Nooit; een sessie
  eindigt alleen bij expliciet uitloggen (of door FR-010).
- Q: Typt de beheerder de organisatiecode zelf of maakt het systeem die aan? → A: Het systeem
  stelt een code voor op basis van de naam; de beheerder kan die accepteren of aanpassen.
- Q: Wat gebeurt er na herhaalde mislukte inlogpogingen? → A: Niets; er is geen blokkering of
  vertraging bij herhaalde mislukte pogingen.
- Q: Moet het systeem een logboek bijhouden van wat de beheerder doet? → A: Ja, acties van de
  beheerder (aanmaken, wijzigen, verwijderen, wachtwoord resetten) met datum/tijd en
  organisatie, in te zien in de beheeromgeving; inlogpogingen worden niet gelogd.
- Q: Moeten lopende sessies eindigen als de beheerder het wachtwoord reset? → A: Nee; alleen
  het wijzigen van de code en het verwijderen van de organisatie beëindigen sessies (FR-010).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Beheerder logt in en maakt een organisatie aan (Priority: P1)

De beheerder logt in op het CMS met een gebruikersnaam en wachtwoord en komt in de aparte
beheeromgeving. Daar maakt de beheerder een nieuwe organisatie aan door een naam, een organisatiecode en
een wachtwoord in te vullen. In dezelfde stap ontstaat het account van die organisatie. De
beheerder geeft de organisatiecode en het wachtwoord daarna zelf door aan de organisatie.

**Why this priority**: zonder organisaties kan niemand anders het CMS gebruiken. Er is geen
zelfregistratie, dus dit is het startpunt van de hele workflow (cursus maken → publiceren →
downloaden op de Quest → uitvoeren).

**Independent Test**: inloggen als beheerder, een organisatie aanmaken en controleren dat die in
het overzicht van organisaties staat met de ingevoerde naam en organisatiecode.

**Acceptance Scenarios**:

1. **Given** een bestaande beheerder, **When** de beheerder inlogt met de juiste gebruikersnaam en het
   juiste wachtwoord, **Then** verschijnt de beheeromgeving met het overzicht van organisaties.
2. **Given** een ingelogde beheerder, **When** de beheerder een organisatie aanmaakt met een naam, een
   nog niet gebruikte organisatiecode en een geldig wachtwoord, **Then** staat de organisatie in
   het overzicht en kan met die code en dat wachtwoord worden ingelogd.
3. **Given** een organisatie met code "ZWEMBAD-A", **When** de beheerder een tweede organisatie
   met dezelfde code probeert aan te maken, **Then** weigert het systeem dit met een duidelijke
   melding en wordt er niets aangemaakt.
4. **Given** iemand die niet als beheerder is ingelogd (niet ingelogd of ingelogd als
   organisatie), **When** de beheeromgeving wordt geopend, **Then** is er geen
   toegang en worden geen organisatiegegevens getoond.
5. **Given** een bezoeker van het CMS, **When** gezocht wordt naar een manier om zelf een account
   aan te maken, **Then** is die er niet.

---

### User Story 2 - Docent logt in namens een organisatie (Priority: P1)

Een docent of trainer logt in met de organisatiecode en het wachtwoord van de eigen organisatie.
Na het inloggen werkt de docent in het CMS namens die organisatie en ziet alleen de gegevens van
die organisatie.

**Why this priority**: inloggen als organisatie is de voorwaarde voor alle andere CMS-functies
(cursussen, video's) die in latere features komen.

**Independent Test**: een organisatie aanmaken via de beheeromgeving, uitloggen, inloggen met de
organisatiecode en het wachtwoord, en controleren dat het CMS de naam van de juiste organisatie
toont.

**Acceptance Scenarios**:

1. **Given** een organisatie met code "ZWEMBAD-A", **When** een docent inlogt met "ZWEMBAD-A" en
   het juiste wachtwoord, **Then** is de docent ingelogd namens die organisatie.
2. **Given** een organisatie, **When** een docent inlogt met een fout wachtwoord of een
   onbekende code, **Then** wordt de toegang geweigerd met een algemene melding die niet
   verraadt of de code bestaat.
3. **Given** een ingelogde docent, **When** de docent uitlogt, **Then** is er geen toegang meer
   tot het CMS totdat opnieuw wordt ingelogd.
4. **Given** een docent die de Quest-koppelcode van de eigen organisatie invult als
   organisatiecode, **When** daarmee wordt ingelogd, **Then** wordt de toegang geweigerd.

---

### User Story 3 - Organisatie ziet alleen haar eigen gegevens (Priority: P1)

Elke organisatie werkt in een afgeschermde omgeving. Een ingelogde organisatie kan gegevens van
andere organisaties niet zien, opvragen of wijzigen, ook niet door handmatig een adres of
kenmerk van een andere organisatie te gebruiken.

**Why this priority**: het systeem ondersteunt meerdere organisaties (FR-03); lekken van
gegevens tussen organisaties is een beveiligingsprobleem en ondermijnt het vertrouwen.

**Independent Test**: twee organisaties aanmaken, als organisatie A inloggen en proberen de
gegevens (bijvoorbeeld de huisstijl) van organisatie B op te vragen en te wijzigen; beide
pogingen moeten mislukken.

**Acceptance Scenarios**:

1. **Given** organisaties A en B, **When** A is ingelogd, **Then** ziet A alleen haar eigen naam,
   huisstijl en gegevens.
2. **Given** organisaties A en B, **When** A probeert de gegevens van B op te vragen of te
   wijzigen, **Then** weigert het systeem dit en blijven de gegevens van B ongewijzigd.

---

### User Story 4 - Beheerder beheert organisaties en wachtwoorden (Priority: P2)

De beheerder kan de naam en de accountgegevens (organisatiecode) van een organisatie aanpassen,
het wachtwoord van een organisatie opnieuw instellen als die het vergeten is, en een organisatie
verwijderen.

**Why this priority**: accounts hebben geen e-mailadres, dus een vergeten wachtwoord kan alleen
via de beheerder worden hersteld. Aanpassen en verwijderen is nodig voor dagelijks beheer, maar
niet voor de eerste werkende workflow.

**Independent Test**: een organisatie aanmaken, de naam en code aanpassen, het wachtwoord
resetten, en controleren dat inloggen alleen nog met de nieuwe code en het nieuwe wachtwoord
lukt; daarna de organisatie verwijderen en controleren dat inloggen niet meer lukt.

**Acceptance Scenarios**:

1. **Given** een organisatie, **When** de beheerder de naam wijzigt, **Then** toont het CMS de
   nieuwe naam aan de beheerder en aan de organisatie.
2. **Given** een organisatie, **When** de beheerder de organisatiecode wijzigt naar een nog niet
   gebruikte code, **Then** kan alleen nog met de nieuwe code worden ingelogd.
3. **Given** een organisatie die haar wachtwoord vergeten is, **When** de beheerder een nieuw
   wachtwoord instelt, **Then** werkt het oude wachtwoord niet meer en het nieuwe wel.
4. **Given** een organisatie, **When** de beheerder haar verwijdert (na bevestiging), **Then**
   staat zij niet meer in het overzicht, kan niet meer met haar code worden ingelogd, en kan
   haar code niet aan een nieuwe organisatie worden gegeven.
5. **Given** een organisatie, **When** de beheerder op verwijderen klikt maar de bevestiging
   annuleert, **Then** blijft de organisatie ongewijzigd bestaan.
6. **Given** de beheerder heeft een organisatie aangemaakt, gewijzigd, verwijderd of haar
   wachtwoord gereset, **When** de beheerder het logboek in de beheeromgeving opent, **Then** staat elke
   actie erin met datum/tijd, soort actie en organisatie.

---

### User Story 5 - Organisatie stelt haar huisstijl in (Priority: P3)

Een ingelogde organisatie stelt een primaire kleur, een secundaire kleur en een logo in. Het CMS
gebruikt die huisstijl voor deze organisatie. Zolang er geen huisstijl is ingesteld, gebruikt het
CMS een standaardhuisstijl.

**Why this priority**: herkenbaarheid is waardevol (FR-04 is een Should), maar niet nodig om de
workflow te laten werken.

**Independent Test**: inloggen als organisatie zonder huisstijl en de standaardhuisstijl zien;
kleuren en logo instellen en zien dat het CMS ze toepast; een andere organisatie ziet nog steeds
haar eigen of de standaardhuisstijl.

**Acceptance Scenarios**:

1. **Given** een organisatie zonder huisstijl, **When** zij inlogt, **Then** ziet zij de
   standaardhuisstijl.
2. **Given** een ingelogde organisatie, **When** zij een primaire kleur, secundaire kleur en
   logo opslaat, **Then** past het CMS die huisstijl toe voor die organisatie.
3. **Given** een organisatie die alleen een primaire kleur heeft ingesteld, **When** zij het CMS
   gebruikt, **Then** worden voor de ontbrekende onderdelen de standaardwaarden gebruikt.
4. **Given** een organisatie, **When** zij een bestand uploadt dat geen afbeelding is of te
   groot is als logo, **Then** weigert het systeem dit met een duidelijke melding en blijft het
   vorige logo staan.
5. **Given** een organisatie met een eigen huisstijl, **When** zij de huisstijl verwijdert of
   terugzet, **Then** wordt weer de standaardhuisstijl gebruikt.

---

### Edge Cases

- Organisatiecodes worden hoofdletterongevoelig vergeleken: "zwembad-a" en "ZWEMBAD-A" gelden als
  dezelfde code, zowel bij uniciteit als bij inloggen.
- Een organisatiecode mag nooit gelijk zijn aan een bestaande Quest-koppelcode, zodat de twee
  codes niet met elkaar verward kunnen worden.
- Wat gebeurt er als een organisatie is ingelogd terwijl de beheerder haar code wijzigt of haar
  verwijdert? De lopende sessie(s) van die organisatie vervallen; bij de volgende actie moet
  opnieuw worden ingelogd.
- Wat gebeurt er als een organisatie is ingelogd terwijl de beheerder haar wachtwoord reset? De
  lopende sessie(s) blijven gewoon werken; het nieuwe wachtwoord geldt pas bij de volgende keer
  inloggen.
- Velden met alleen spaties (naam, code) worden als leeg behandeld en geweigerd.
- Een ongeldige kleurwaarde (geen geldige kleur) wordt geweigerd.
- Een verwijderde organisatie houdt haar organisatiecode bezet: de beheerder kan die code niet
  aan een nieuwe organisatie geven.
- Cursussen en video's van een verwijderde organisatie die al door andere organisaties gebruikt
  worden, blijven voor die organisaties bruikbaar (zie FR-014).

## Requirements *(mandatory)*

### Functional Requirements

**Beheerder en beheeromgeving**

- **FR-001**: Het systeem MUST de beheerder laten inloggen met een gebruikersnaam en wachtwoord.
- **FR-002**: Het systeem MUST een aparte beheeromgeving binnen het CMS bieden die uitsluitend
  toegankelijk is voor een ingelogde beheerder; organisaties krijgen hier nooit toegang toe.
- **FR-003**: Het systeem MUST NOT een mogelijkheid bieden om zelf een account te registreren.

**Organisaties aanmaken en beheren**

- **FR-004**: De beheerder MUST een organisatie kunnen aanmaken met een naam, een
  organisatiecode en een wachtwoord; het account van de organisatie ontstaat in dezelfde stap.
- **FR-004a**: Het systeem MUST bij het aanmaken een organisatiecode voorstellen die is afgeleid
  van de ingevoerde naam (bijv. "Zwembad De Hoven" → "ZWEMBAD-DE-HOVEN") en nog niet in gebruik
  is (zo nodig met een volgnummer). De beheerder MUST het voorstel kunnen accepteren of
  aanpassen; een aangepaste code moet nog steeds aan FR-005 voldoen.
- **FR-005**: Het systeem MUST afdwingen dat elke organisatiecode uniek is
  (hoofdletterongevoelig), ook ten opzichte van verwijderde organisaties, en niet gelijk is aan
  een Quest-koppelcode.
- **FR-006**: Het systeem MUST bij het aanmaken van een organisatie automatisch een unieke
  Quest-koppelcode voor die organisatie vastleggen, die verschilt van de organisatiecode. Het
  gebruik van deze koppelcode valt buiten deze feature.
- **FR-007**: De beheerder MUST een overzicht kunnen zien van alle organisaties met hun naam en
  organisatiecode.
- **FR-008**: De beheerder MUST de naam en de organisatiecode van een organisatie kunnen
  aanpassen.
- **FR-009**: De beheerder MUST het wachtwoord van een organisatie opnieuw kunnen instellen.
  Een organisatie MUST NOT haar eigen wachtwoord kunnen wijzigen; dat kan alleen de beheerder.
- **FR-010**: Het systeem MUST bij het wijzigen van de code of het verwijderen van een
  organisatie alle actieve sessies van die organisatie beëindigen. Een wachtwoordreset beëindigt
  lopende sessies niet.
- **FR-011**: De beheerder MUST een organisatie kunnen verwijderen, na een expliciete
  bevestiging. Verwijderen is zacht: de organisatie krijgt een verwijdertijdstip en blijft als
  record bestaan.
- **FR-012**: Een verwijderde organisatie MUST NOT meer kunnen inloggen en MUST NOT meer in het
  overzicht van de beheerder staan. Haar organisatiecode blijft gereserveerd (FR-005).
- **FR-013**: Wachtwoorden (van beheerder en organisaties) MUST minimaal 10 tekens lang zijn en
  MUST NOT leesbaar worden opgeslagen of getoond, ook niet aan de beheerder.
- **FR-014**: Bij het verwijderen van een organisatie MUST het systeem haar cursussen en video's
  verwijderen volgens de bestaande verwijderregels voor cursussen en video's: ze verdwijnen uit
  de bibliotheken, blijven bruikbaar voor organisaties die ze al gebruiken, en worden pas echt
  verwijderd als niemand ze meer gebruikt. Zolang cursussen en video's nog niet bestaan (latere
  features), legt deze feature alleen het zacht verwijderen van de organisatie zelf vast; de
  features voor cursussen en video's MUST deze regel toepassen op inhoud van verwijderde
  organisaties.

**Inloggen als organisatie**

- **FR-015**: Een docent MUST kunnen inloggen met de organisatiecode en het wachtwoord van de eigen
  organisatie; na het inloggen werkt de docent namens precies die organisatie.
- **FR-016**: Elke organisatie MUST precies één account hebben en elk account MUST bij precies
  één organisatie horen.
- **FR-017**: Bij een mislukte inlogpoging MUST het systeem een algemene foutmelding tonen die
  niet verraadt of de code of gebruikersnaam bestaat.
- **FR-018**: Het systeem blokkeert of vertraagt herhaalde mislukte inlogpogingen niet; elke
  poging wordt los beoordeeld.
- **FR-019**: Gebruikers (beheerder en organisaties) MUST kunnen uitloggen. Een sessie
  verloopt niet automatisch door inactiviteit; zij eindigt alleen bij uitloggen of in de
  gevallen van FR-010.
- **FR-020**: Het systeem MUST NOT een zelfstandige "wachtwoord vergeten"-functie bieden; het
  inlogscherm MUST verwijzen naar de beheerder voor een nieuw wachtwoord.

**Afscherming tussen organisaties**

- **FR-021**: Een ingelogde organisatie MUST alleen haar eigen gegevens kunnen zien en beheren.
- **FR-022**: Elke poging van een organisatie om gegevens van een andere organisatie op te vragen
  of te wijzigen MUST geweigerd worden, ongeacht hoe het verzoek is samengesteld.

**Huisstijl**

- **FR-023**: Een ingelogde organisatie MUST een primaire kleur, een secundaire kleur en een logo
  kunnen instellen, wijzigen en weer verwijderen.
- **FR-024**: Het systeem MUST voor elk onderdeel van de huisstijl dat niet is ingesteld de
  waarde uit de standaardhuisstijl gebruiken.
- **FR-025**: Het systeem MUST als logo alleen afbeeldingen accepteren (PNG, JPG of SVG) van
  maximaal 2 MB, en ongeldige bestanden weigeren met een duidelijke melding.
- **FR-026**: Het CMS MUST de huisstijl van de ingelogde organisatie toepassen op de schermen
  die de organisatie ziet; de beheeromgeving gebruikt altijd de standaardhuisstijl.

**Logboek**

- **FR-027**: Het systeem MUST elke actie van de beheerder op een organisatie vastleggen:
  aanmaken, wijzigen (naam of code), verwijderen en wachtwoord resetten, met datum/tijd, soort
  actie en de betreffende organisatie. Wachtwoorden MUST NOT in het logboek staan.
- **FR-028**: De beheerder MUST het logboek kunnen inzien in de beheeromgeving, nieuwste actie
  eerst. Logboekregels MUST NOT gewijzigd of verwijderd kunnen worden via het CMS.
- **FR-029**: Inlogpogingen (geslaagd of mislukt) worden niet gelogd.

### Key Entities *(include if feature involves data)*

- **Administrator (beheerder)**: beheert het systeem. Kenmerken: unieke gebruikersnaam,
  wachtwoord (niet leesbaar opgeslagen). Staat los van organisaties.
- **Organisation (organisatie, incl. account)**: een klant die het CMS gebruikt. De organisatie
  en haar account zijn één geheel. Kenmerken: naam, unieke organisatiecode om in te loggen,
  wachtwoord (niet leesbaar opgeslagen), Quest-koppelcode (uniek, anders dan de
  organisatiecode), verwijdertijdstip (leeg zolang de organisatie actief is). Heeft 0 of 1
  huisstijl. Is later eigenaar van cursussen en video's.
- **OrganisationStyle (huisstijl)**: de huisstijl van één organisatie. Kenmerken: primaire kleur,
  secundaire kleur, logo; elk onderdeel is optioneel en valt terug op de standaardhuisstijl.

- **AdminActionLog (logboekregel)**: één vastgelegde actie van de beheerder. Kenmerken:
  datum/tijd, soort actie, betreffende organisatie (ook als die inmiddels verwijderd is).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Een beheerder kan een nieuwe organisatie (inclusief account) aanmaken in minder
  dan 2 minuten.
- **SC-002**: Een docent kan inloggen met organisatiecode en wachtwoord in minder dan 30
  seconden, zonder uitleg vooraf.
- **SC-003**: In een test met minimaal twee organisaties slaagt 0% van de pogingen om gegevens
  van een andere organisatie te zien of te wijzigen.
- **SC-004**: 100% van de pogingen van niet-beheerders om de beheeromgeving te openen wordt
  geweigerd.
- **SC-005**: Een beheerder kan een vergeten wachtwoord van een organisatie in minder dan 1
  minuut opnieuw instellen.
- **SC-006**: Een organisatie zonder eigen huisstijl ziet in 100% van de schermen de
  standaardhuisstijl; een organisatie met eigen huisstijl ziet haar eigen kleuren en logo
  direct na het opslaan.
- **SC-007**: Docenten zonder technische kennis kunnen zelfstandig inloggen en hun huisstijl
  instellen (NFR-03).

## Assumptions

- Er is in de eerste versie één beheerder (of een klein aantal); de beheerder wordt bij de
  installatie aangemaakt en niet via het CMS. Beheerders beheren valt buiten deze feature.
- De beheerder geeft code en wachtwoord buiten het systeem door aan de organisatie.
- Alle docenten van een organisatie delen het ene account van die organisatie (FR-03: één
  account per organisatie in de eerste versie). Individuele gebruikersaccounts met e-mailadres
  (oude FR-02-tekst) vallen buiten scope.
- De standaardhuisstijl is één vaste set kleuren en een logo, bepaald door het projectteam.
- Cursussen, video's, publiceren, de centrale bibliotheken en de Quest-koppeling vallen buiten
  deze feature; deze feature legt alleen vast dat gegevens per organisatie afgeschermd zijn.
- Het ERD (`docs/Diagrams.simp`) bevat nog geen `deletedAt` op `Organisation`; dit veld moet in
  het ERD worden toegevoegd (constitution: wijzigingen aan het datamodel ook in het ERD).
- Een verwijderde organisatie herstellen valt buiten deze feature.
- Het ERD bevat nog geen entiteit voor het logboek van beheerdersacties; die moet in het ERD
  worden toegevoegd. Logboekregels worden onbeperkt bewaard.
