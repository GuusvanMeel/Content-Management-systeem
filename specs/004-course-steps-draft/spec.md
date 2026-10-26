# Feature Specification: Cursussen en onderdelen (concept)

**Feature Branch**: `Development` (spec-map: `specs/004-course-steps-draft`)

**Created**: 2026-10-26

**Status**: Draft

**Input**: User description: "Feature: courses and steps (FR-06, FR-07, FR-10), draft only. A
logged-in teacher can create, edit and delete courses of their own organisation and add steps
(scenario parts) to them. Courses are drafts: nothing is published in this feature. Courses
have a required name and description, belong to exactly one organisation, are only visible to
that organisation, are soft deleted and can be saved as a draft at any time, also when
incomplete; a draft is never visible on the Quest. Steps are video steps (exactly one video
from the library, no question) or question steps (no video, a question with 2 to 4 answers and
exactly one correct answer), stored in one table; never both, never neither; separate blocks in
the interface. A video can be used in several courses and steps. A step can be marked as start
step and/or end step. Follow the database diagram (Course, CourseVersion, CourseStep, answers);
a draft is the course's open version; linking steps is out of scope. Use the existing course
editor prototype and replace its fake data with the real API. Out of scope: order and
branching (FR-08), the completeness check, publishing (FR-09), versions (FR-11), course library
and sharing (FR-12), the Quest app."

**Bronnen**: `docs/Requirements.docx` FR-06, FR-07, FR-10; ERD `docs/Diagrams.simp`, entiteiten
`Course`, `CourseVersion`, `CourseStep`, `Answer` en `OrganisationCourse`. Bouwt voort op
feature 001 (organisaties, afscherming, sessies), feature 002 (videobibliotheek, zacht
verwijderen) en feature 003 (centrale bibliotheek, beschikbaarheid van video's). Het
uitgangspunt voor de interface is het bestaande prototype van de cursus-editor (cursuslijst en
editor met de weergaven "Canvas", "Canvas + paneel" en "Lijst").

## Clarifications

### Session 2026-10-26

- Q: Hoe wordt een eindonderdeel vastgelegd, en kan een vraag-onderdeel een einde zijn? → A: Het
  ERD blijft zoals het is: er komt geen eigen veld voor "einde". Een onderdeel is een einde als
  het geen volgend onderdeel heeft: bij een video-onderdeel is het volgende onderdeel leeg, bij
  een vraag-onderdeel heeft geen enkel antwoord een volgend onderdeel. Ook een vraag-onderdeel
  kan dus een einde zijn. Omdat koppelen buiten deze feature valt, kan de docent een einde nog
  niet zelf markeren; dat komt met FR-08.
- Q: Mag een onderdeel onvolledig bewaard worden? → A: Ja. De soort van een onderdeel (video of
  vraag) ligt vast vanaf het aanmaken en wordt apart bewaard; de inhoud mag in een concept nog
  onvolledig zijn. Een video-onderdeel mag nog geen video hebben, maar nooit een vraag of
  antwoorden. Een vraag-onderdeel heeft nooit een video en heeft altijd 2 tot 4 antwoorden met
  precies één goed antwoord, ook als de vraagtekst en de antwoordteksten nog leeg zijn.
- Q: Bewaren de wijzigingen automatisch of met een knop? → A: Met een knop "Opslaan als
  concept". Wil de docent de editor verlaten met niet-opgeslagen wijzigingen, dan vraagt het
  systeem eerst om bevestiging.
- Q: Wat gebeurt er als twee docenten dezelfde cursus tegelijk bewerken en allebei opslaan? → A:
  De laatste opslag geldt, zonder waarschuwing; de eerder opgeslagen wijzigingen van de ander
  worden overschreven.
- Q: Waarvoor dient de feedbacktekst van een onderdeel, en bij welke soort? → A: Alleen bij
  vraag-onderdelen: een tekst die de cursist na het beantwoorden ziet, bijvoorbeeld uitleg over
  het goede antwoord. Een video-onderdeel heeft geen feedback.
- Q: Blijven ongedaan maken en opnieuw uit het prototype? → A: Ja, voor wijzigingen in de
  editor; opslaan wist de geschiedenis niet. Een onderdeel verwijderen vraagt daarom geen
  bevestiging meer, want ongedaan maken zet het terug.
- Q: Wat gebeurt er met het veld "Titel" van een video-onderdeel uit het prototype? → A: Het
  verdwijnt. Een video-onderdeel heet naar zijn video, een vraag-onderdeel naar zijn vraag. Het
  ERD-veld `description` van een onderdeel wordt in deze feature niet gebruikt en blijft leeg.

### Session 2026-10-26 (wijziging na het plan: onbeschikbaar geworden video's)

- Q: Wat gebeurt er met een video in een onderdeel als de organisatie er geen toegang meer toe
  heeft (beschikbaarheid beperkt, of de video verwijderd door de eigenaar)? → A: Hij blijft een
  gewoon deel van zijn onderdeel en wordt in de cursus-editor getoond met naam, thumbnail en
  duur. Hij staat niet in de bibliotheek en kan niet opnieuw gekozen worden voor een onderdeel.
  De regels van de bibliotheek (lijst, zoeken, details, kiezer) veranderen niet. De thumbnail
  loopt via een route die bij het onderdeel van een eigen cursus hoort, niet via een ruimere
  toegangsregel in de bibliotheek; alleen naam, thumbnail en duur worden zo getoond, en een
  andere organisatie krijgt "niet gevonden".
- Q: Wat ziet de docent als hij zo'n video uit de cursus haalt? → A: Bij het verwijderen van
  het onderdeel, en bij het weghalen of vervangen van de video, verschijnt een waarschuwing: de
  video is niet meer beschikbaar voor de organisatie (privé of verwijderd), dus na het weghalen
  kan hij niet opnieuw worden toegevoegd. De docent bevestigt of annuleert. Alleen voor video's
  die niet meer gekozen kunnen worden; voor gewone video's verandert niets. Ongedaan maken werkt
  zoals voorheen.

### Session 2026-10-26 (bevindingen van de handmatige test)

- Q: Waarmee begint een nieuwe cursus? → A: Niet met een leeg canvas, maar met één
  video-onderdeel zonder video, gemarkeerd als startonderdeel, met "Kies een video" (FR-001a). Een
  voorbeeld met een vraag die zich in twee video's splitst, hoort bij FR-08 en valt buiten deze
  feature.
- Q: Wat gebeurt er als de docent het weghalen van een onbeschikbare video heeft bevestigd en
  opgeslagen, en daarna ongedaan maakt? → A: Het onderdeel komt terug, maar met een leeg
  videoblok en de melding "Deze video is niet meer beschikbaar en kan niet worden teruggezet."
  De volgende opslag wordt dus niet geweigerd (FR-020d).
- Q: Mag een concept een video-onderdeel zonder video bevatten? → A: Ja, zoals FR-010 en FR-012
  al zeggen; de controle op volledigheid komt met publiceren (FR-09).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Een cursus aanmaken en terugvinden (Priority: P1)

Een ingelogde docent opent "Cursussen", ziet de cursussen van de eigen organisatie en maakt een
nieuwe cursus aan met een naam en een beschrijving. De cursus wordt als concept bewaard en
verschijnt in de lijst; de docent komt direct in de editor van die cursus.

**Why this priority**: Zonder cursus kunnen er geen onderdelen worden toegevoegd; dit is de
kleinste stap die echte waarde oplevert en het prototype vervangt door bewaarde gegevens.

**Independent Test**: Log in als docent, maak een cursus aan, ververs de pagina en log opnieuw
in: de cursus staat nog in de lijst met status "Concept". Log in als een andere organisatie: de
cursus is daar niet te zien.

**Acceptance Scenarios**:

1. **Given** een ingelogde docent op "Cursussen", **When** de docent op "Nieuwe cursus" klikt,
   een naam en een beschrijving invult en op "Aanmaken" klikt, **Then** wordt de cursus bewaard
   als concept van de eigen organisatie en opent de editor van die cursus, met één
   video-onderdeel zonder video dat als startonderdeel is gemarkeerd en "Kies een video" toont
   (FR-001a).
2. **Given** het venster "Nieuwe cursus", **When** de docent de naam of de beschrijving leeg
   laat en op "Aanmaken" klikt, **Then** wordt er niets aangemaakt, worden de lege velden rood en
   staat er "Vul een naam en een beschrijving in."
3. **Given** een organisatie met cursussen, **When** de docent "Cursussen" opent, **Then** ziet
   de docent alle niet-verwijderde cursussen van de eigen organisatie, met per cursus de naam,
   het aantal video-onderdelen en vraag-onderdelen, wanneer de cursus het laatst is bewerkt en
   de status "Concept", de laatst bewerkte bovenaan.
4. **Given** een organisatie zonder cursussen, **When** de docent "Cursussen" opent, **Then**
   staat er "Er zijn nog geen cursussen." met een knop om de eerste cursus te maken.
5. **Given** een cursus van organisatie A, **When** een docent van organisatie B de lijst opent
   of het adres van die cursus rechtstreeks opvraagt, **Then** ziet die docent de cursus niet en
   krijgt bij het adres de melding "Cursus niet gevonden".

---

### User Story 2 - Een video-onderdeel toevoegen (Priority: P1)

In de editor voegt de docent een video-onderdeel toe en kiest daarvoor een video uit de
videobibliotheek: een eigen video of een video die voor de organisatie beschikbaar is. Het
onderdeel verschijnt als blok in de editor en blijft bewaard.

**Why this priority**: Video's zijn de kern van een VR-scenario; een cursus met alleen
video-onderdelen is al een bruikbaar concept.

**Independent Test**: Open een cursus, voeg een video-onderdeel toe met een video van een andere
organisatie die "Algemeen beschikbaar" is, klik op "Opslaan als concept" en ververs de pagina:
het onderdeel staat er nog met die video. Gebruik dezelfde video in een tweede cursus: dat lukt.

**Acceptance Scenarios**:

1. **Given** een cursus in de editor, **When** de docent een video-onderdeel toevoegt, een video
   kiest en opslaat, **Then** is het onderdeel bewaard met precies die ene video en zonder vraag.
2. **Given** een nieuw video-onderdeel waarvoor nog geen video is gekozen, **When** de docent
   opslaat, **Then** wordt het onderdeel bewaard als video-onderdeel zonder video; het blok toont
   "Kies een video".
3. **Given** de video-kiezer, **When** de docent de lijst bekijkt, **Then** staan er precies de
   video's die de organisatie in de videobibliotheek ziet (eigen video's en video's die voor haar
   beschikbaar zijn, feature 003), en geen verwijderde video's of video's die nog verwerkt worden.
4. **Given** een video die al in een ander onderdeel of een andere cursus wordt gebruikt,
   **When** de docent die video kiest, **Then** lukt dat; een video kan in meerdere onderdelen en
   cursussen voorkomen.
5. **Given** een bestaand video-onderdeel, **When** de docent een andere video kiest en
   opslaat, **Then** is de wijziging bewaard en heet het blok naar de nieuwe video.
6. **Given** een opgeslagen video-onderdeel waarvan de video daarna privé is gemaakt of is
   verwijderd door de eigenaar, **When** de docent de cursus opent, **Then** staat het onderdeel
   er gewoon met de naam, thumbnail en duur van de video, en kan de docent het concept opslaan
   zonder iets aan dat onderdeel te veranderen.
7. **Given** zo'n onbeschikbaar geworden video, **When** de docent de video-kiezer of de
   videobibliotheek opent, **Then** staat die video er niet tussen; hij kan niet voor een ander
   of nieuw onderdeel worden gekozen.

---

### User Story 3 - Een vraag-onderdeel toevoegen (Priority: P1)

De docent voegt een vraag-onderdeel toe: een vraag met 2 tot 4 antwoorden, waarvan er precies
één goed is. Het vraag-onderdeel is in de editor een ander soort blok dan een video-onderdeel.

**Why this priority**: Vragen maken van een reeks video's een leerscenario; samen met story 2
vormen ze de inhoud van een cursus.

**Independent Test**: Voeg een vraag-onderdeel toe met drie antwoorden en markeer het tweede als
goed, sla op en ververs de pagina: de vraag, de drie antwoorden en het goede antwoord staan er
nog.

**Acceptance Scenarios**:

1. **Given** een cursus in de editor, **When** de docent een vraag-onderdeel toevoegt, **Then**
   verschijnt een vraagblok met twee (nog lege) antwoorden, waarvan het eerste als goed is
   gemarkeerd, en zonder video.
2. **Given** een vraag met 2 of 3 antwoorden, **When** de docent een antwoord toevoegt, **Then**
   komt er een antwoord bij; bij 4 antwoorden kan er geen antwoord meer bij.
3. **Given** een vraag met 3 of 4 antwoorden, **When** de docent een antwoord verwijdert,
   **Then** verdwijnt het; bij 2 antwoorden kan er geen antwoord meer af. Was het verwijderde
   antwoord het goede, dan wordt het eerste overgebleven antwoord het goede.
4. **Given** een vraag, **When** de docent een ander antwoord als goed markeert, **Then** is
   alleen dat antwoord goed; er is nooit meer of minder dan één goed antwoord.
5. **Given** een vraag-onderdeel met een lege vraag of lege antwoorden, **When** de docent
   opslaat, **Then** wordt het bewaard zoals het is, met zijn antwoorden en het goede antwoord.

---

### User Story 4 - Onderdelen wijzigen, verwijderen en het startonderdeel kiezen (Priority: P2)

De docent past onderdelen aan, verwijdert ze en geeft aan welk onderdeel het startonderdeel is.

**Why this priority**: Nodig om een concept bij te werken; de volgorde en vertakkingen tussen
onderdelen, en daarmee ook welke onderdelen een einde zijn, komen pas met FR-08.

**Independent Test**: Markeer een onderdeel als start, verwijder een ander onderdeel, sla op en
ververs de pagina: de startmarkering staat er nog en het verwijderde onderdeel is weg.

**Acceptance Scenarios**:

1. **Given** een cursus met onderdelen, **When** de docent een onderdeel als startonderdeel
   markeert, **Then** is dat het enige startonderdeel van de cursus; een eerder startonderdeel
   is dat niet meer.
2. **Given** een lege cursus, **When** de docent het eerste onderdeel toevoegt, **Then** wordt
   dat automatisch het startonderdeel.
3. **Given** een onderdeel, **When** de docent het verwijdert, **Then** verdwijnt het zonder
   bevestigingsvraag met zijn antwoorden uit de cursus (definitief na opslaan). Was het het
   startonderdeel, dan heeft de cursus daarna geen startonderdeel tot de docent een ander
   markeert. Uitzondering: zie scenario 6.
4. **Given** een onderdeel dat de docent net heeft verwijderd of gewijzigd, **When** de docent
   op ongedaan maken klikt (of Ctrl+Z), **Then** staat het onderdeel er weer zoals het was,
   inclusief antwoorden en startmarkering; opnieuw (Ctrl+Y) voert de wijziging weer uit.
5. **Given** een onderdeel van een bepaalde soort, **When** de docent het bewerkt, **Then** kan
   de soort niet veranderen: van een video-onderdeel kan geen vraag-onderdeel worden gemaakt en
   andersom.
6. **Given** een video-onderdeel met een video die niet meer beschikbaar is voor de organisatie,
   **When** de docent het onderdeel verwijdert, of de video eruit haalt of door een andere
   vervangt, **Then** verschijnt eerst de waarschuwing "Video niet meer beschikbaar" (FR-020b).
   Bij "Annuleren" verandert er niets; bij bevestigen gaat de actie door. Ongedaan maken zet het
   onderdeel en de video daarna gewoon terug, zolang de verwijdering nog niet is opgeslagen.
   Is de verwijdering wel opgeslagen, dan zet ongedaan maken het onderdeel terug met een leeg
   videoblok en de melding "Deze video is niet meer beschikbaar en kan niet worden teruggezet." (FR-020d).
7. **Given** een video-onderdeel met een gewone, beschikbare video, **When** de docent het
   onderdeel verwijdert of de video vervangt, **Then** verschijnt er geen waarschuwing.

---

### User Story 5 - Een cursus wijzigen en verwijderen (Priority: P2)

De docent wijzigt de naam en beschrijving van een cursus en verwijdert een cursus die niet meer
nodig is.

**Why this priority**: Onderhoud van concepten; minder dringend dan aanmaken en vullen.

**Independent Test**: Wijzig de naam van een cursus en ververs: de nieuwe naam staat in de lijst.
Verwijder de cursus: hij verdwijnt uit de lijst en is via zijn adres niet meer te openen, maar
bestaat nog als zacht verwijderd record.

**Acceptance Scenarios**:

1. **Given** een cursus in de editor, **When** de docent naam of beschrijving wijzigt en
   opslaat, **Then** is de wijziging bewaard en staat de nieuwe naam in de lijst.
2. **Given** een lege naam of beschrijving, **When** de docent op "Opslaan als concept" klikt,
   **Then** wordt er niets opgeslagen, wordt het lege veld rood en staat er "Vul een naam en een
   beschrijving in."
3. **Given** de cursuslijst, **When** de docent op verwijderen klikt, **Then** vraagt het
   systeem "Cursus verwijderen?" met de naam van de cursus; na bevestigen verdwijnt de cursus uit
   de lijst en krijgt de docent "Cursus verwijderd" te zien.
4. **Given** een verwijderde cursus, **When** iemand het adres van die cursus opvraagt, **Then**
   verschijnt "Cursus niet gevonden".

---

### Edge Cases

- **Video wordt onbeschikbaar na gebruik**: De eigenaar verwijdert een video, of maakt hem niet
  meer beschikbaar voor deze organisatie, terwijl een concept hem gebruikt. Het onderdeel houdt
  zijn video; de editor toont hem gewoon met naam, thumbnail en duur, en opslaan blijft lukken.
  In de bibliotheek en de video-kiezer staat hij niet meer. Haalt de docent hem weg, dan volgt
  eerst een waarschuwing (FR-020b). Is de weghaling eenmaal opgeslagen, dan kan de video niet
  meer terug: zet de docent het onderdeel daarna met ongedaan maken terug, dan komt het terug met
  een leeg videoblok en de melding "Deze video is niet meer beschikbaar en kan niet worden teruggezet." (FR-020d). Opslaan lukt daarna gewoon;
  het onderdeel is dan een video-onderdeel zonder video.
- **Thumbnail via een cursus van een ander**: Vraagt organisatie B de thumbnail op via een
  onderdeel van een cursus van A, dan krijgt B "niet gevonden", ook als B die video zelf in de
  bibliotheek ziet. Een onderdeel zonder video of een vraag-onderdeel heeft geen thumbnail.
- **Onvolledig concept**: Een cursus zonder onderdelen, zonder startonderdeel, met een
  video-onderdeel zonder video, of met lege vraag- of antwoordteksten kan gewoon opgeslagen
  worden; er komt geen melding "te doen" en geen publicatieknop, want de volledigheidscontrole en
  publiceren vallen buiten deze feature.
- **Einde**: Zolang er geen koppelingen zijn (FR-08), heeft geen enkel onderdeel een volgend
  onderdeel. De editor toont daarom nog geen eindmarkering; die volgt later uit de koppelingen.
- **Niet-opgeslagen wijzigingen**: Verlaat de docent de editor (terug naar de lijst, ander menu,
  pagina sluiten of verversen) met niet-opgeslagen wijzigingen, dan vraagt het systeem eerst of
  de wijzigingen verloren mogen gaan. Kiest de docent "Annuleren", dan blijft de editor open.
- **Video uit een andere organisatie**: Een video van een andere organisatie mag gebruikt
  worden zolang hij voor de eigen organisatie beschikbaar is; de eigenaar van de video ziet niet
  in welke cursussen hij gebruikt wordt.
- **Ongeldige aanvraag**: Een aanvraag die een video-onderdeel een vraag, antwoorden of feedback geeft, een
  vraag-onderdeel een video geeft, de soort van een bestaand onderdeel verandert, een vraag met
  minder dan 2 of meer dan 4 antwoorden bewaart, of geen of meerdere goede antwoorden, wordt
  geweigerd, ook als die buiten de interface om wordt verstuurd.
- **Cursus van een andere organisatie**: Elke aanvraag om een cursus of onderdeel van een andere
  organisatie te lezen, te wijzigen of te verwijderen, of een onderdeel aan zo'n cursus toe te
  voegen, wordt behandeld alsof de cursus niet bestaat.
- **Twee docenten tegelijk**: Twee docenten van dezelfde organisatie bewerken dezelfde cursus;
  de laatste opslag geldt voor de hele cursus en overschrijft zonder waarschuwing wat de ander
  eerder opsloeg. Er is geen vergrendeling, controle op tussentijdse wijzigingen of samenvoegen.
- **Opslaan mislukt**: Lukt opslaan niet (bijvoorbeeld doordat de verbinding wegvalt), dan ziet
  de docent "De cursus is niet opgeslagen. Probeer het opnieuw.", blijven alle wijzigingen in de
  editor staan en gaat er bij opnieuw proberen niets dubbel. Opslaan gebeurt in zijn geheel of
  helemaal niet.
- **Sessie verlopen**: Verloopt de sessie tijdens het bewerken, dan meldt de editor bij opslaan
  dat de docent opnieuw moet inloggen (feature 001); niet-opgeslagen wijzigingen gaan daarbij
  verloren.
- **Lange teksten**: Naam, beschrijving, vraag en antwoorden hebben een maximumlengte; meer
  tekens invoeren kan niet (zelfde gedrag als de videobeschrijving in feature 003).

## Requirements *(mandatory)*

### Functional Requirements

**Cursussen**

- **FR-001**: Een ingelogde docent MUST een cursus kunnen aanmaken met een naam en een
  beschrijving; beide zijn verplicht en mogen niet uit alleen spaties bestaan.
- **FR-001a**: Een nieuwe cursus MUST beginnen met precies één video-onderdeel zonder video,
  gemarkeerd als startonderdeel, zodat de editor niet leeg opent. De docent kan dat onderdeel
  gewoon wijzigen of verwijderen.
- **FR-002**: Elke cursus MUST bij precies één organisatie horen: de organisatie van de docent
  die hem aanmaakte (eigenaar).
- **FR-003**: Een organisatie MUST alleen haar eigen cursussen kunnen zien, openen, wijzigen en
  verwijderen; voor cursussen van andere organisaties MUST het systeem reageren alsof ze niet
  bestaan (zelfde afscherming als feature 001).
- **FR-004**: Het systeem MUST een lijst tonen met de niet-verwijderde cursussen van de eigen
  organisatie, met per cursus de naam, het aantal video-onderdelen, het aantal vraag-onderdelen,
  wanneer hij het laatst is bewerkt en de status "Concept", gesorteerd op laatst bewerkt (nieuwste
  bovenaan).
- **FR-005**: De docent MUST naam en beschrijving van een cursus kunnen wijzigen; een lege naam
  of beschrijving MUST NOT opgeslagen worden: het opslaan wordt dan geweigerd met de melding "Vul
  een naam en een beschrijving in."
- **FR-006**: De docent MUST een cursus kunnen verwijderen na een bevestiging. Verwijderen MUST
  zacht gebeuren: de cursus krijgt een verwijdertijdstip, verdwijnt uit de lijst en is niet meer
  te openen, maar de gegevens blijven in de database.
- **FR-007**: Een cursus MUST altijd als concept opgeslagen kunnen worden, ook als hij
  onvolledig is (geen onderdelen, geen startonderdeel, video-onderdelen zonder video, lege vraag-
  of antwoordteksten). Alleen naam en beschrijving van de cursus zijn verplicht (FR-005).
- **FR-008**: Alle cursussen in deze feature MUST concepten zijn: de open, niet-gepubliceerde
  versie van de cursus. Een concept MUST NOT zichtbaar of opvraagbaar zijn voor de Quest.
- **FR-009**: Wijzigingen in de editor (naam en beschrijving, onderdelen, antwoorden,
  startmarkering, plaats op het canvas, verwijderde onderdelen) MUST pas bewaard worden als de
  docent op "Opslaan als concept" klikt. Opslaan MUST in zijn geheel slagen of in zijn geheel
  mislukken; lukt het niet, dan MUST de docent een melding zien en MUST de editor de wijzigingen
  behouden. De editor MUST laten zien of er niet-opgeslagen wijzigingen zijn.
- **FR-009a**: Verlaat de docent de editor met niet-opgeslagen wijzigingen (binnen de applicatie
  of door de pagina te sluiten of te verversen), dan MUST het systeem eerst om bevestiging
  vragen. Een nieuwe cursus aanmaken ("Aanmaken") en een cursus verwijderen vanuit de lijst
  gebeuren direct, zonder aparte opslagknop.

**Onderdelen**

- **FR-010**: De docent MUST onderdelen aan een cursus kunnen toevoegen, wijzigen en verwijderen.
  Er zijn precies twee soorten: video-onderdeel en vraag-onderdeel.
- **FR-011**: Elk onderdeel MUST een vastgelegde soort hebben: video of vraag. De soort wordt
  bij het aanmaken gekozen, apart bewaard en MUST NOT daarna veranderen. Er bestaat dus nooit een
  onderdeel dat geen van beide soorten is.
- **FR-012**: Een video-onderdeel MUST hoogstens één video hebben en MUST NOT een vraag of
  antwoorden hebben. In een concept MAG de video nog ontbreken.
- **FR-013**: Een vraag-onderdeel MUST NOT een video hebben en MUST altijd minimaal 2 en
  maximaal 4 antwoorden hebben, waarvan er precies één als goed is gemarkeerd. De vraagtekst en
  de antwoordteksten MOGEN in een concept nog leeg zijn; de antwoorden zelf bestaan wel.
- **FR-013a**: Het systeem MUST aanvragen die FR-011 tot en met FR-013 schenden weigeren, ook
  als ze buiten de interface om worden verstuurd.
- **FR-014**: De video-kiezer MUST precies de video's tonen die de organisatie in de
  videobibliotheek ziet (eigen video's en video's die voor haar beschikbaar zijn, feature 003),
  zonder verwijderde video's en zonder video's die nog niet klaar zijn. Het systeem MUST bij het
  bewaren controleren dat de gekozen video voor de organisatie beschikbaar is; de enige
  uitzondering is de video die het onderdeel al had (FR-016). De regels van de videobibliotheek
  (lijst, zoeken, details, kiezer, thumbnail) MUST NOT veranderen door deze feature.
- **FR-015**: Een video MUST in meerdere onderdelen en in meerdere cursussen gebruikt kunnen
  worden.
- **FR-016**: Wordt een gebruikte video later verwijderd door de eigenaar of onbeschikbaar voor
  de organisatie, dan MUST hij een gewoon deel van zijn onderdeel blijven: de editor toont hem
  met naam, thumbnail en duur, en het concept MUST opgeslagen kunnen worden zolang dat onderdeel
  dezelfde video houdt. Zo'n video MUST NOT in de bibliotheek of de video-kiezer verschijnen en
  MUST NOT voor een ander of nieuw onderdeel gekozen kunnen worden.
- **FR-016a**: Naam, thumbnail en duur van de video in een onderdeel MUST alleen via de eigen
  cursus van de organisatie op te vragen zijn, en alleen voor de video van dat onderdeel. Er
  MUST verder niets van zo'n video zichtbaar worden (geen eigenaar, beschrijving of
  beschikbaarheid). Een andere organisatie, een verwijderde cursus, een onderdeel zonder video of
  een vraag-onderdeel MUST "niet gevonden" geven. De toegangsregel van de bibliotheek MUST
  hiervoor NOT worden verruimd.
- **FR-017**: Alleen een vraag-onderdeel MUST optioneel een feedbacktekst kunnen hebben
  (ERD-veld `feedback`): de tekst die de cursist na het beantwoorden ziet, bijvoorbeeld uitleg
  over het goede antwoord. Een video-onderdeel MUST NOT feedback hebben; het bewerkformulier
  toont het veld daar niet. Een onderdeel heeft geen eigen titel of beschrijving: het veld
  "Titel" uit het prototype MUST verdwijnen en het ERD-veld `description` blijft in deze feature
  leeg.
- **FR-017a**: In de editor MUST een video-onderdeel heten naar de naam van zijn video ("Kies een
  video" zolang er geen video is), en een vraag-onderdeel naar zijn vraagtekst ("Nieuwe vraag"
  zolang die leeg is).
- **FR-018**: Precies nul of één onderdeel per cursus MUST het startonderdeel zijn. Markeert de
  docent een ander onderdeel als start, dan MUST het vorige dat niet meer zijn. Het eerste
  onderdeel dat aan een lege cursus wordt toegevoegd MUST automatisch het startonderdeel worden.
- **FR-019**: Er MUST geen apart gegeven voor "eindonderdeel" komen. Een onderdeel is een einde
  als het geen volgend onderdeel heeft: bij een video-onderdeel ontbreekt het volgende onderdeel,
  bij een vraag-onderdeel heeft geen enkel antwoord een volgend onderdeel. Zowel video- als
  vraag-onderdelen kunnen dus een einde zijn, en een onderdeel kan tegelijk start en einde zijn.
  Omdat koppelen buiten deze feature valt (FR-08), MUST de editor nog geen eindmarkering tonen
  en kan de docent een einde nog niet zelf aangeven.
- **FR-020**: Bij het verwijderen van een onderdeel MUST het onderdeel met zijn antwoorden uit
  de cursus verdwijnen, zonder bevestigingsvraag (ongedaan maken zet het terug, FR-020a), behalve
  in het geval van FR-020b.
- **FR-020b**: Verwijdert de docent een video-onderdeel waarvan de video niet meer beschikbaar is
  voor de organisatie, of haalt hij zo'n video uit het onderdeel of vervangt hij hem, dan MUST
  de editor eerst waarschuwen: "Video niet meer beschikbaar" — "Deze video is niet meer
  beschikbaar voor jouw organisatie (privé gemaakt of verwijderd). Haal je hem uit de cursus, dan
  kun je hem daarna niet opnieuw toevoegen." — "Doorgaan" / "Annuleren". Bij "Annuleren" MUST er
  niets veranderen. Voor beschikbare video's MUST deze waarschuwing NOT verschijnen. Ongedaan
  maken MUST na de waarschuwing werken zoals bij elke andere wijziging.
- **FR-020c**: In het bewerkformulier van een video-onderdeel MUST de docent de video ook
  kunnen weghalen zonder een andere te kiezen; het onderdeel blijft dan bestaan zonder video.
- **FR-020d**: Brengt ongedaan maken (of opnieuw) een onbeschikbare video terug in een onderdeel
  dat die video in de laatst opgeslagen versie niet meer heeft (het onderdeel of de video is
  verwijderd of vervangen en dat is opgeslagen), dan MUST de editor dat onderdeel terugzetten
  zonder video, met in het videoblok en het bewerkformulier de melding "Deze video is niet meer beschikbaar en kan niet worden teruggezet."
  De volgende opslag MUST daardoor niet worden geweigerd. De melding verdwijnt zodra de docent
  een video kiest. Is de weghaling nog niet opgeslagen, dan komt de video gewoon terug (FR-020b).
- **FR-020a**: De editor MUST ongedaan maken en opnieuw bieden (knoppen en Ctrl+Z / Ctrl+Y of
  Ctrl+Shift+Z) voor alle wijzigingen in de editor: naam en beschrijving, onderdelen toevoegen,
  wijzigen en verwijderen, antwoorden, startmarkering en plaats op het canvas. Ongedaan maken
  werkt alleen in de editor en wijzigt pas iets in de bewaarde cursus na "Opslaan als concept".
  Opslaan MUST de geschiedenis niet wissen; die verdwijnt bij het verlaten van de editor.
- **FR-021**: De plaats van elk onderdeel op het canvas MUST bewaard worden, zodat de editor na
  opnieuw openen dezelfde indeling toont.

**Editor en interface**

- **FR-022**: De editor MUST het bestaande prototype als uitgangspunt nemen (weergaven "Canvas",
  "Canvas + paneel" en "Lijst", het venster voor naam en beschrijving, de blokken en het
  bewerkformulier) en MUST de nepgegevens vervangen door bewaarde gegevens.
- **FR-023**: Video-onderdelen en vraag-onderdelen MUST in de editor als verschillende blokken
  zichtbaar zijn, en het startonderdeel MUST herkenbaar zijn. Een video-onderdeel zonder video
  MUST in zijn blok "Kies een video" tonen.
- **FR-024**: Functies uit het prototype die buiten deze feature vallen MUST NOT zichtbaar zijn:
  verbindingen tussen onderdelen leggen of tonen (ook "Daarna", "Einde van de cursus" en de
  koppeling per antwoord), de "te doen"-lijst, publiceren en intrekken, en de status
  "Gepubliceerd". De editor MUST een knop "Opslaan als concept" krijgen.
- **FR-025**: Alle teksten die de docent ziet MUST in het Nederlands zijn.

**Grenzen**

- **FR-026**: Naam van een cursus en tekst van een antwoord MUST maximaal 255 tekens zijn;
  beschrijving van een cursus, vraagtekst en feedback van een vraag-onderdeel MUST
  maximaal 1000 tekens zijn. Meer tekens invoeren MUST NOT kunnen.

### Key Entities *(include if feature involves data)*

- **Course** (nieuw, ERD): de cursus als geheel, met aanmaak-, wijzig- en verwijdertijdstip
  (`deletedAt`). Naam en beschrijving staan niet hier maar in de versie. `parentCourseId` en
  `isSharedInLibrary` worden in deze feature niet gebruikt (bibliotheek en delen, FR-12).
- **OrganisationCourse** (nieuw, ERD): koppelt een cursus aan een organisatie. In deze feature
  heeft elke cursus precies één regel: de eigenaar (`isOwner` waar).
- **CourseVersion** (nieuw, ERD): een versie van een cursus met naam, beschrijving en
  versienummer. Het concept is de open versie zonder publicatietijdstip (`publishedAt` leeg); in
  deze feature heeft elke cursus precies één versie, het concept.
- **CourseStep** (nieuw, ERD): een onderdeel van een cursusversie: soort (`stepType`: video of
  vraag, vast vanaf het aanmaken), startmarkering, optionele feedback (alleen bij een
  vraag-onderdeel), de video
  (alleen bij een video-onderdeel, in een concept mogelijk nog leeg), de vraagtekst (alleen bij
  een vraag-onderdeel, in een concept mogelijk nog leeg) en de plaats op het canvas. Het veld voor
  het volgende onderdeel en de beschrijving (`description`) blijven leeg in deze feature. Er komt
  geen veld voor "einde" bij; het ERD verandert niet.
- **Answer** (nieuw, ERD): een antwoord bij een vraag-onderdeel met tekst, goed/fout en
  volgorde. Een vraag-onderdeel heeft er altijd 2 tot 4, precies één goed. De tekst is verplicht
  in het ERD; een nog niet ingevuld antwoord heeft een lege tekst. Het veld voor het volgende
  onderdeel blijft leeg in deze feature.
- **Video** (bestaat, features 002 en 003): wordt door video-onderdelen gebruikt; één video kan
  bij veel onderdelen horen. Wordt hij onbeschikbaar of verwijderd, dan blijft de verwijzing in
  het onderdeel staan; de video zelf en zijn bibliotheekregels veranderen niet.
- **Organisation** (bestaat, feature 001): eigenaar van cursussen.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Een docent zonder technische kennis kan zonder hulp binnen 5 minuten een cursus
  aanmaken met twee video-onderdelen en één vraag met drie antwoorden (NFR-03).
- **SC-002**: 100% van de cursussen, onderdelen, antwoorden, markeringen en canvasposities die
  een docent invoert en opslaat, staat er na verversen van de pagina en opnieuw inloggen nog
  precies zo.
- **SC-003**: 0% van de pogingen van een organisatie om een cursus of onderdeel van een andere
  organisatie te zien, te wijzigen of te verwijderen, slaagt.
- **SC-004**: 0% van de pogingen slaagt om een video-onderdeel met een vraag of antwoorden, een
  vraag-onderdeel met een video, een vraag met minder dan 2 of meer dan 4 antwoorden of zonder
  precies één goed antwoord te bewaren, of de soort van een onderdeel te veranderen.
- **SC-004a**: In 100% van de gevallen waarin de docent de editor wil verlaten met
  niet-opgeslagen wijzigingen, vraagt het systeem eerst om bevestiging; een mislukte
  opslagpoging laat in 0% van de gevallen een half opgeslagen cursus achter.
- **SC-005**: In de video-kiezer staan in een test met drie organisaties precies de video's die
  de organisatie in de videobibliotheek ziet: 0 te veel en 0 te weinig.
- **SC-005a**: Een video die na gebruik onbeschikbaar wordt (beperkt of verwijderd), staat in
  100% van de gevallen nog met naam, thumbnail en duur in het onderdeel, en in 0% van de gevallen
  in de bibliotheek, de kiezer of de bibliotheekroutes. Opvragen van die thumbnail via een cursus
  van een andere organisatie slaagt in 0% van de gevallen.
- **SC-005b**: De waarschuwing bij het weghalen verschijnt bij 100% van de onbeschikbare video's
  en bij 0% van de beschikbare video's.
- **SC-006**: Een verwijderde cursus komt in 0% van de gevallen nog in de lijst of via zijn
  adres in beeld, en bestaat in 100% van de gevallen nog in de database.
- **SC-007**: Met 50 cursussen staat de cursuslijst binnen 2 seconden in beeld, en een cursus met
  50 onderdelen opent binnen 2 seconden in de editor.
- **SC-008**: Geen enkel concept is via de Quest op te vragen.

## Assumptions

- De Quest heeft nog geen toegang tot cursussen; FR-008 is vervuld doordat er geen
  gepubliceerde versies bestaan en de Quest-app buiten deze feature valt.
- Onderdelen hebben in het ERD geen verwijdertijdstip; een onderdeel verwijderen uit een concept
  haalt het echt weg (zacht verwijderen geldt volgens de constitutie voor video's en cursussen).
- De soort van een onderdeel staat in het ERD-veld `stepType` en bepaalt welke inhoud het
  onderdeel mag hebben (FR-011 tot en met FR-013), ook als die inhoud in een concept nog
  onvolledig is.
- Een onderdeel verwijderen of de plaats van een blok wijzigen telt als niet-opgeslagen
  wijziging en is pas definitief na "Opslaan als concept".
- Ieder lid van een organisatie mag elke cursus van die organisatie bewerken; er zijn geen
  rollen binnen een organisatie (feature 001).
- Na ongedaan maken tot aan de laatst opgeslagen toestand telt de editor nog steeds als
  "niet-opgeslagen wijzigingen" zolang de inhoud afwijkt van wat bewaard is; komt de inhoud weer
  overeen, dan niet.
- De knop om het canvas automatisch te ordenen mag blijven; zonder verbindingen zet hij de
  blokken netjes onder elkaar, en de nieuwe posities worden bij opslaan bewaard.
- De maximumlengtes in FR-026 volgen het ERD (`VARCHAR(255)`) en, voor lange teksten, de grens
  van de videobeschrijving uit feature 003 (1000 tekens).
- De cursuslijst wordt niet op de achtergrond ververst; wijzigingen van een collega verschijnen
  bij het volgende laden.
- Er komt geen logboek van wijzigingen aan cursussen.
- Buiten scope: volgorde en vertakkingen tussen onderdelen (FR-08), de controle of een cursus
  volledig is, publiceren en intrekken (FR-09), versies en geschiedenis (FR-11), de
  cursusbibliotheek en delen (FR-12), de Quest-app, verwijderde cursussen herstellen.
