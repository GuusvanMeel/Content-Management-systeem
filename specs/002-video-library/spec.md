# Feature Specification: 360°-videobibliotheek (eigen organisatie)

**Feature Branch**: `Development` (spec-map: `specs/002-video-library`)

**Created**: 2026-10-22

**Status**: Draft

**Input**: User description: "360° video library (own organisation). Een ingelogde docent van een
organisatie kan 360°-video's toevoegen aan de videobibliotheek van de organisatie, de bibliotheek
bekijken en video's verwijderen. Grote uploads (meerdere GB) moeten hervat kunnen worden. Alleen
ondersteunde formaten en alleen 360°-video's. Bibliotheek toont thumbnail, naam en gegevens
(duur, grootte, uploaddatum, status); afspelen hoort er niet bij. Status (verwerken, beschikbaar,
mislukt). Video's horen bij één organisatie en zijn alleen voor die organisatie zichtbaar.
Verwijderen is zacht. Een video moet later in meerdere cursussen bruikbaar zijn. Buiten scope:
cursussen en scenario-onderdelen, delen/centrale bibliotheek (FR-14), beschikbaarheidsopties,
de Quest-app." (De status uit deze beschrijving is later geschrapt, zie Clarifications.)

**Bronnen**: `docs/Requirements.docx` FR-13 (en NFR-01, NFR-03); ERD `docs/Diagrams.simp`,
entiteit `Video`. Bouwt voort op feature 001 (inloggen als organisatie, afscherming tussen
organisaties, sessieregels).

## Clarifications

### Session 2026-10-22

- Q: Waaraan herkent het systeem een 360°-video? → A: Alleen aan de beeldverhouding: het beeld
  moet precies 2:1 zijn (twee keer zo breed als hoog, equirectangulair). 360°-metadata in het
  bestand is niet nodig; 3D-360° (boven-onder) wordt niet ondersteund.
- Q: Wat is de maximale grootte per video, en is er een opslaglimiet per organisatie? → A:
  Maximaal 10 GB per video; geen opslaglimiet per organisatie.
- Q: Welke formaten worden ondersteund? → A: Alleen MP4-bestanden met H.264-video, omdat de
  Unity-app op de Quest alleen MP4/H.264 afspeelt. MOV en H.265 worden niet ondersteund.
- Q: Hebben video's een status (verwerken, beschikbaar, mislukt)? → A: Nee. Een video verschijnt
  pas in de bibliotheek als hij volledig is geüpload en gecontroleerd. Direct na de upload
  controleert het systeem het bestand (formaat, codec, 360°) en maakt het de thumbnail. Is het
  bestand ongeldig, dan wordt het verwijderd en ziet de docent meteen de reden. Er wordt geen
  status, geen reden en geen uploadvoortgang in de database opgeslagen. Een onderbroken upload
  wordt hervat doordat de docent hetzelfde bestand opnieuw kiest; onvoltooide uploads worden na
  een time-out door een geplande taak opgeruimd.
- Q: Is er een maximale resolutie voor een 360°-video? → A: Ja, maximaal 4096×2048 pixels; geen
  minimum.
- Q: Loopt een upload door als de docent naar een andere pagina in het CMS gaat? → A: Ja; de
  upload loopt door op elke CMS-pagina met een zichtbare uploadindicator, en bij het verlaten van
  het CMS of sluiten van het tabblad verschijnt een waarschuwing.
- Q: Wat gebeurt er met het geluidsspoor van een video? → A: Het geluid wordt niet
  gecontroleerd: video's met of zonder geluid, in welk geluidsformaat ook, worden geaccepteerd.
- Q: Hoeveel vrije schijfruimte moet de server houden voordat nieuwe uploads worden geweigerd?
  → A: Een nieuwe upload wordt vóór de start geweigerd als er na de upload minder dan 20 GB vrij
  zou blijven; de docent krijgt de melding contact op te nemen met de beheerder.
- Q: Hoeveel uploads mag een organisatie tegelijk doen? → A: Eén tegelijk; extra bestanden
  wachten in een wachtrij in de uploadindicator en starten automatisch. De limiet wordt alleen
  in de browser (uploadindicator) afgedwongen en is instelbaar; de server beschermt zich alleen
  via de controle op vrije schijfruimte (FR-004a).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Docent uploadt een 360°-video (Priority: P1)

Een ingelogde docent kiest in de videobibliotheek "Video toevoegen", selecteert een MP4-bestand
van de computer en geeft de video een naam (standaard de bestandsnaam zonder extensie). De upload
toont de voortgang. Direct na de upload controleert het systeem het bestand en maakt het een
thumbnail; is alles in orde, dan staat de video meteen in de bibliotheek. Is het bestand
ongeldig, dan ziet de docent meteen waarom en komt de video niet in de bibliotheek.

**Why this priority**: zonder video's kan geen cursus gemaakt worden; dit is de eerste stap in de
workflow die de stakeholder als prioriteit heeft (cursus maken → publiceren → Quest).

**Independent Test**: inloggen als organisatie, een geldige 360°-video (MP4, H.264, 2:1) uploaden
en controleren dat die direct daarna met thumbnail, naam en gegevens in de bibliotheek staat.

**Acceptance Scenarios**:

1. **Given** een ingelogde docent, **When** die een geldige 360°-video uploadt, **Then** ziet de
   docent tijdens de upload de voortgang (percentage en geüploade/totale grootte), daarna kort
   "Video wordt gecontroleerd…", en daarna staat de video met thumbnail, naam, duur, grootte en
   uploaddatum in de bibliotheek.
2. **Given** een ingelogde docent, **When** die een bestand kiest dat geen `.mp4`-bestand is
   (bijv. `.mov`, `.avi`, `.pdf`), **Then** wordt het geweigerd vóórdat de upload begint, met de
   melding "Alleen MP4-video's (H.264) worden ondersteund."
3. **Given** een ingelogde docent, **When** die een bestand kiest dat groter is dan 10 GB,
   **Then** wordt het geweigerd vóórdat de upload begint, met de melding dat een video maximaal
   10 GB mag zijn.
4. **Given** een MP4-bestand met H.265-video of een andere codec, **When** de upload klaar is en
   het bestand wordt gecontroleerd, **Then** ziet de docent meteen de melding dat alleen H.264
   wordt ondersteund, wordt het bestand verwijderd en komt er niets in de bibliotheek.
5. **Given** een geldige MP4/H.264-video met een beeldverhouding die niet 2:1 is, **When** het
   bestand wordt gecontroleerd, **Then** ziet de docent meteen de melding "Dit is geen
   360°-video: het beeld moet twee keer zo breed zijn als hoog (2:1).", wordt het bestand
   verwijderd en komt er niets in de bibliotheek.
6. **Given** een geldige MP4/H.264-video met verhouding 2:1 die groter is dan 4096×2048 pixels
   (bijv. 5760×2880), **When** het bestand wordt gecontroleerd, **Then** ziet de docent meteen
   de melding "De resolutie is te hoog: een video mag maximaal 4096×2048 pixels zijn.", wordt het
   bestand verwijderd en komt er niets in de bibliotheek.
7. **Given** een lopende upload, **When** de docent naar een andere pagina in het CMS gaat (bijv.
   "Huisstijl"), **Then** loopt de upload door en blijft een uploadindicator met naam en
   percentage zichtbaar; als de upload klaar is of geweigerd wordt, ziet de docent dat in die
   indicator, ook op een andere pagina.
8. **Given** een lopende upload, **When** de docent het tabblad sluit, de pagina herlaadt of
   naar een andere website gaat, **Then** waarschuwt de browser eerst dat er een upload loopt;
   gaat de docent toch weg, dan is de upload onderbroken en later te hervatten (User Story 2).
9. **Given** een bestand met de extensie `.mp4` dat beschadigd is of geen video bevat, **When**
   het bestand wordt gecontroleerd, **Then** ziet de docent meteen de melding dat het bestand
   niet gelezen kan worden, en wordt het verwijderd.

---

### User Story 2 - Onderbroken upload hervatten (Priority: P1)

Video's zijn groot (tot 10 GB). Als de upload wordt onderbroken (internet valt weg, laptop gaat
in slaapstand, browser wordt gesloten), hoeft de docent niet opnieuw te beginnen: bij een korte
storing gaat de upload vanzelf verder, en anders kiest de docent hetzelfde bestand opnieuw en
gaat de upload verder vanaf het punt waar hij was gebleven.

**Why this priority**: zonder hervatten is het uploaden van een bestand van meerdere GB over een
gewone verbinding in de praktijk niet betrouwbaar; de stakeholder noemt dit expliciet.

**Independent Test**: een upload van een groot bestand starten, halverwege de netwerkverbinding
verbreken en herstellen, en controleren dat de upload doorgaat vanaf het bereikte percentage;
daarna de browser sluiten tijdens een upload, opnieuw openen, hetzelfde bestand kiezen en
controleren dat de upload niet bij 0% begint.

**Acceptance Scenarios**:

1. **Given** een lopende upload, **When** de netwerkverbinding kort wegvalt en terugkomt,
   **Then** gaat de upload automatisch verder vanaf het bereikte punt, zonder actie van de
   docent.
2. **Given** een upload die is onderbroken doordat de browser werd gesloten, **When** de docent
   in dezelfde browser opnieuw "Video toevoegen" kiest en hetzelfde bestand selecteert, **Then**
   gaat de upload verder vanaf het bereikte punt en ziet de docent dat het een hervatte upload
   is.
3. **Given** een onderbroken upload, **When** de docent een ander bestand kiest, **Then** start
   dat als een nieuwe upload; de onderbroken upload blijft hervatbaar tot de time-out.
4. **Given** een lopende upload, **When** de docent "Annuleren" kiest, **Then** stopt de upload
   en worden de al ontvangen delen opgeruimd.
5. **Given** een onderbroken upload die niet binnen de time-out wordt hervat, **When** de
   geplande opruimtaak draait, **Then** worden de al ontvangen delen verwijderd en begint een
   nieuwe poging met hetzelfde bestand weer bij 0%.

---

### User Story 3 - Videobibliotheek bekijken (Priority: P1)

De docent opent de videobibliotheek en ziet alle video's van de eigen organisatie, met per video
een thumbnail, naam, duur, bestandsgrootte en uploaddatum. Video's van andere organisaties zijn
nooit zichtbaar.

**Why this priority**: de docent moet kunnen zien welke video's er zijn voordat ze later in
cursussen worden gebruikt.

**Independent Test**: als organisatie A en B elk een video uploaden; als A de bibliotheek openen
en alleen de video van A zien, met alle gegevens.

**Acceptance Scenarios**:

1. **Given** een organisatie met video's, **When** de docent de bibliotheek opent, **Then**
   ziet de docent per video thumbnail, naam, duur (uu:mm:ss), grootte (MB of GB) en
   uploaddatum, nieuwste eerst.
2. **Given** een organisatie zonder video's, **When** de docent de bibliotheek opent, **Then**
   ziet de docent een lege bibliotheek met de uitleg dat er nog geen video's zijn en een knop
   "Video toevoegen".
3. **Given** een upload die nog loopt of is onderbroken, **When** de bibliotheek wordt
   getoond, **Then** staat die video er niet in; alleen volledig geüploade en gecontroleerde
   video's staan in de bibliotheek.
4. **Given** organisaties A en B met elk video's, **When** A de bibliotheek opent of op een
   andere manier probeert video's of thumbnails van B op te vragen, **Then** ziet A alleen de
   eigen video's en wordt elke poging naar B geweigerd.

---

### User Story 4 - Video verwijderen (Priority: P2)

De docent verwijdert een video die niet meer nodig is. De video verdwijnt uit de bibliotheek
maar wordt nog niet echt van de server verwijderd (zachte verwijdering), zodat cursussen die de
video later gebruiken niet stukgaan.

**Why this priority**: nodig om de bibliotheek overzichtelijk te houden, maar niet voor de eerste
werkende workflow.

**Independent Test**: een video uploaden, verwijderen (na bevestiging) en controleren dat die
niet meer in de bibliotheek staat, terwijl het bestand en de gegevens nog bestaan.

**Acceptance Scenarios**:

1. **Given** een video in de bibliotheek, **When** de docent "Verwijderen" kiest en bevestigt,
   **Then** verdwijnt de video uit de bibliotheek.
2. **Given** een video in de bibliotheek, **When** de docent "Verwijderen" kiest maar de
   bevestiging annuleert, **Then** blijft de video ongewijzigd staan.
3. **Given** een verwijderde video, **When** wordt gecontroleerd of het bestand nog op de
   server staat, **Then** zijn het videobestand, de thumbnail en de gegevens nog aanwezig en
   gemarkeerd als verwijderd.
4. **Given** organisatie A, **When** A probeert een video van organisatie B te verwijderen,
   **Then** wordt dit geweigerd en blijft de video van B ongewijzigd.

---

### Edge Cases

- Een upload duurt langer dan 60 minuten: elk ontvangen deel telt als activiteit, dus de sessie
  verloopt niet zolang de upload loopt (feature 001, FR-019). Is de sessie toch verlopen (bijv.
  upload onderbroken en meer dan 60 minuten later hervat), dan moet de docent opnieuw inloggen
  en kan de upload daarna worden hervat door hetzelfde bestand te kiezen.
- De docent sluit de pagina terwijl het bestand na de upload wordt gecontroleerd: de controle
  gaat op de server door. Is het bestand geldig, dan staat de video daarna gewoon in de
  bibliotheek; is het ongeldig, dan wordt het verwijderd en ziet de docent de reden niet. Wie de
  video niet terugziet, kan het opnieuw proberen en krijgt dan de reden te zien.
- Hervatten werkt alleen in dezelfde browser op dezelfde computer (de browser onthoudt welke
  upload bij welk bestand hoort). Op een andere computer begint een upload van hetzelfde bestand
  opnieuw bij 0%.
- Meerdere bestanden tegelijk kiezen: de eerste start, de rest wacht in de wachtrij van de
  uploadindicator en start automatisch daarna (FR-006b). Een geweigerd of geannuleerd bestand
  laat de volgende in de wachtrij starten.
- Twee tabbladen of twee computers van dezelfde organisatie: elk heeft een eigen wachtrij; de
  limiet geldt per browsertabblad, dus dan kunnen er toch twee uploads tegelijk lopen. Dat is
  aanvaard; de server weigert alleen bij te weinig schijfruimte (FR-004a).
- Dezelfde video twee keer uploaden: toegestaan; het worden twee aparte video's.
- Een bestand met de extensie `.mp4` dat eigenlijk een ander formaat is: wordt bij de controle
  na de upload geweigerd met de melding dat alleen MP4/H.264 wordt ondersteund.
- De server heeft onvoldoende schijfruimte: een nieuwe upload wordt vóór de start geweigerd als
  er daarna minder dan 20 GB vrij zou blijven (FR-004a). Raakt de schijf toch vol tijdens een
  upload (bijv. door meerdere uploads tegelijk), dan stopt die upload met dezelfde melding en
  worden de al ontvangen delen opgeruimd.
- Naam leeg of alleen spaties: de bestandsnaam zonder extensie wordt gebruikt. Naam langer dan
  255 tekens wordt geweigerd.
- De organisatie wordt door de beheerder verwijderd: haar video's volgen de bestaande regel
  (feature 001, FR-014) en zijn niet meer zichtbaar, omdat niemand meer als die organisatie kan
  inloggen.
- Een verwijderde video kan niet via de bibliotheek worden teruggehaald (herstellen valt buiten
  deze feature).

## Requirements *(mandatory)*

### Functional Requirements

**Uploaden**

- **FR-001**: Een ingelogde organisatie MUST een videobestand kunnen uploaden naar de eigen
  videobibliotheek.
- **FR-002**: Het systeem MUST alleen MP4-bestanden met H.264-video accepteren. MOV, H.265 en
  andere formaten of codecs MUST geweigerd worden met de melding "Alleen MP4-video's (H.264)
  worden ondersteund." De extensie wordt vóór de upload gecontroleerd; container en codec
  worden direct na de upload gecontroleerd.
- **FR-003**: Het systeem MUST alleen 360°-video's accepteren: het beeld MUST een
  beeldverhouding van precies 2:1 hebben (breedte = 2 × hoogte, equirectangulair).
  360°-metadata in het bestand is niet vereist. Een video met een andere verhouding MUST
  geweigerd worden met de melding "Dit is geen 360°-video: het beeld moet twee keer zo breed zijn
  als hoog (2:1)."
- **FR-002a**: Het geluidsspoor MUST NOT gecontroleerd worden: een video zonder geluid of met
  geluid in welk formaat dan ook wordt op dit punt geaccepteerd. Alleen het beeld (formaat,
  codec, verhouding, resolutie) bepaalt of een video wordt geaccepteerd.
- **FR-003a**: Het beeld MUST maximaal 4096×2048 pixels zijn (breedte ≤ 4096 en hoogte ≤ 2048);
  er is geen minimumresolutie. Een grotere video MUST geweigerd worden met de melding "De
  resolutie is te hoog: een video mag maximaal 4096×2048 pixels zijn."
- **FR-004**: Een video MUST maximaal 10 GB groot zijn; grotere bestanden MUST vóór de start
  van de upload geweigerd worden met de melding "Een video mag maximaal 10 GB zijn." Er is geen
  totale opslaglimiet per organisatie.
- **FR-004a**: Vóór de start van een upload MUST het systeem controleren of er na de upload nog
  minstens 20 GB vrije schijfruimte op de server overblijft (vrije ruimte − bestandsgrootte ≥
  20 GB). Zo niet, dan MUST de upload geweigerd worden met de melding "Er is op dit moment niet
  genoeg opslagruimte. Neem contact op met de beheerder." Hervatten van een onderbroken upload
  valt onder dezelfde controle voor het nog te versturen deel.
- **FR-005**: Bij het uploaden MUST de docent een naam kunnen opgeven (1–255 tekens); zonder
  naam MUST de bestandsnaam zonder extensie worden gebruikt, ingekort tot 255 tekens. Blijft er
  dan geen naam over (bijv. een bestand dat `.mp4` heet), dan MUST de naam "Video" zijn.
- **FR-006**: Tijdens het uploaden MUST de docent de voortgang zien (percentage en
  geüploade/totale grootte) en de upload kunnen annuleren.
- **FR-006a**: Een upload MUST doorlopen als de docent binnen het CMS naar een andere pagina
  gaat. Zolang er een upload loopt, MUST op elke CMS-pagina een uploadindicator zichtbaar zijn
  met per upload de naam, het percentage en een knop om te annuleren; het resultaat (in de
  bibliotheek gezet, of de reden van weigering) MUST daar ook verschijnen.
- **FR-006b**: In één browsertabblad MUST maximaal één upload tegelijk lopen (standaard 1,
  instelbaar door het projectteam zonder codewijziging). Extra gekozen bestanden MUST in de
  uploadindicator in een wachtrij komen ("Wacht…") en automatisch starten zodra de vorige klaar,
  geweigerd of geannuleerd is; een wachtend bestand MUST uit de wachtrij verwijderd kunnen
  worden. De server dwingt deze limiet niet af.
- **FR-006c**: Als de docent het CMS verlaat, het tabblad sluit of de pagina herlaadt terwijl
  er een upload loopt, MUST de browser eerst waarschuwen. Uitloggen tijdens een upload MUST
  eerst om bevestiging vragen en onderbreekt de upload.

**Hervatten en opruimen**

- **FR-007**: Een onderbroken upload MUST hervat kunnen worden vanaf het laatst ontvangen deel,
  zonder het al ontvangen deel opnieuw te versturen.
- **FR-008**: Bij een korte onderbreking van de verbinding MUST de upload automatisch verder
  gaan zodra de verbinding terug is.
- **FR-009**: Na een langere onderbreking (bijv. browser gesloten) MUST de upload hervat worden
  doordat de docent in dezelfde browser hetzelfde bestand opnieuw kiest; het systeem herkent
  dan zelf dat het om een onderbroken upload gaat. Een onderbroken upload wordt niet in de
  bibliotheek getoond.
- **FR-010**: Bij annuleren MUST het systeem de al ontvangen delen opruimen.
- **FR-011**: Een geplande taak MUST onvoltooide uploads die 24 uur geen nieuw deel hebben
  ontvangen, verwijderen.
- **FR-012**: Zolang een upload loopt, MUST de sessie van de docent niet verlopen door
  inactiviteit (elk ontvangen deel telt als activiteit).

**Controleren na de upload**

- **FR-013**: Direct nadat een upload volledig is ontvangen, MUST het systeem het bestand
  controleren (MP4, H.264, beeldverhouding 2:1, maximaal 4096×2048, leesbaar), de duur en grootte bepalen en een
  thumbnail maken. Pas als dat allemaal is gelukt, MUST de video in de bibliotheek komen.
- **FR-014**: Is het bestand ongeldig, dan MUST het systeem het bestand meteen verwijderen,
  MUST er niets over de video worden opgeslagen, en MUST de docent direct de reden zien (geen
  360°-video, resolutie te hoog, niet-ondersteund formaat of codec, bestand onleesbaar).
- **FR-015**: De controle en het maken van de thumbnail MUST voor een video van 10 GB binnen 60
  seconden na het afronden van de upload klaar zijn.
- **FR-016**: Video's hebben geen status: elke video in de bibliotheek is volledig geüpload,
  gecontroleerd en bruikbaar.

**Bibliotheek bekijken**

- **FR-017**: De bibliotheek MUST alle niet-verwijderde video's van de eigen organisatie tonen,
  nieuwste eerst, met per video: thumbnail, naam, duur (uu:mm:ss), bestandsgrootte (MB of GB,
  één decimaal) en uploaddatum.
- **FR-018**: De video zelf MUST NOT in de browser afgespeeld kunnen worden binnen deze feature.

**Verwijderen**

- **FR-019**: De docent MUST een video kunnen verwijderen na een expliciete bevestiging met de
  naam van de video.
- **FR-020**: Verwijderen MUST zacht zijn: de video krijgt een verwijdertijdstip, verdwijnt uit
  de bibliotheek, en het videobestand, de thumbnail en de gegevens blijven bewaard. Definitief
  verwijderen (wanneer geen gepubliceerde cursus de video meer gebruikt) valt onder de feature
  voor cursussen.

**Afscherming en eigendom**

- **FR-021**: Elke video MUST bij precies één organisatie horen (de organisatie die hem
  uploadde).
- **FR-022**: Een organisatie MUST alleen haar eigen video's, thumbnails en uploads kunnen zien,
  uploaden, hervatten, annuleren en verwijderen; elke poging om dat voor een andere organisatie
  te doen MUST geweigerd worden, ongeacht hoe het verzoek is samengesteld (zelfde afscherming als
  feature 001, FR-021/FR-022).
- **FR-023**: Een video MUST NOT aan één cursus gekoppeld zijn; het datamodel MUST toestaan dat
  één video later in meerdere cursussen wordt gebruikt.
- **FR-024**: Video's van andere organisaties en een centrale bibliotheek MUST NOT zichtbaar
  zijn; elke nieuwe video krijgt de beschikbaarheid "alleen eigen organisatie" (de keuze uit
  FR-14 komt in een latere feature).

### Key Entities *(include if feature involves data)*

- **Video**: een gecontroleerde 360°-video van één organisatie. Kenmerken: eigenaar
  (organisatie), naam, bestand op de server, thumbnail, bestandsgrootte, duur, uploaddatum,
  beschikbaarheid (in deze feature altijd "alleen eigen organisatie"), verwijdertijdstip.
  Bestaat al in het ERD (`Video`); er komen geen velden bij. Een video wordt pas vastgelegd na
  een geslaagde controle; er is geen status, geen reden bij mislukken en geen uploadvoortgang.
- Een **onvoltooide upload** is geen gegeven in het datamodel: het is tijdelijke data van het
  uploadproces op de server, die na afronding, annuleren of de time-out verdwijnt.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Een docent zonder technische kennis kan zonder hulp een 360°-video uploaden en
  terugvinden in de bibliotheek (NFR-03).
- **SC-002**: Een upload van 4 GB die op 50% wordt onderbroken, kan worden hervat en verstuurt
  daarna niet meer dan ongeveer de resterende 2 GB (hooguit één deel extra).
- **SC-003**: Een geldige video van 10 GB staat binnen 60 seconden na het afronden van de upload
  in de bibliotheek; een ongeldig bestand geeft binnen die tijd een melding.
- **SC-004**: In een testset van niet-360°-video's, video's groter dan 4096×2048,
  H.265-video's, MOV-bestanden en andere bestanden wordt 100% geweigerd met een begrijpelijke
  melding; in een testset van geldige MP4/H.264-video's met verhouding 2:1 en maximaal
  4096×2048 wordt 100% geaccepteerd.
- **SC-005**: In een test met twee organisaties slaagt 0% van de pogingen om video's, thumbnails
  of uploads van de andere organisatie te zien, te hervatten of te verwijderen.
- **SC-006**: De bibliotheek van een organisatie met 200 video's is binnen 2 seconden zichtbaar.
- **SC-007**: Na verwijderen staat de video niet meer in de bibliotheek, terwijl het bestand en de
  gegevens in 100% van de gevallen nog aanwezig zijn.
- **SC-008**: Binnen 24 uur en 15 minuten na de laatste activiteit van een onvoltooide upload
  is 100% van de ontvangen delen opgeruimd (24 uur time-out plus hooguit één looptijd van de
  opruimtaak).

## Assumptions

- Alleen ingelogde organisaties (docenten) gebruiken de videobibliotheek; de beheerder heeft in
  deze feature geen toegang tot video's.
- Alleen MP4/H.264 wordt geaccepteerd omdat de Unity-app op de Quest alleen dat afspeelt; omzetten
  (transcoderen) van andere formaten valt buiten deze feature.
- De time-out voor onvoltooide uploads is 24 uur na het laatst ontvangen deel.
- Of het geluid van een video op de Quest afspeelt, wordt niet bij het uploaden gecontroleerd
  (FR-002a); een geluidsformaat dat de Quest-app niet afspeelt, blijkt pas in de headset.
- De thumbnail is één beeld uit de video (niet het allereerste frame, dat vaak zwart is),
  getoond als platte equirectangulaire afbeelding.
- De naam van een video kan na het uploaden niet worden gewijzigd binnen deze feature.
- Er is geen zoek- of filterfunctie in de bibliotheek; bij het verwachte aantal video's volstaat
  een lijst, nieuwste eerst.
- De video's worden op de eigen server opgeslagen (constitution II en III); de beschikbare
  schijfruimte van de VPS is de praktische bovengrens, en de beheerder houdt die in de gaten.
- Het ERD-veld `visibility` van `Video` krijgt voor elke nieuwe video de waarde "alleen eigen
  organisatie" (`private`); het kiezen ervan hoort bij FR-14.
- Het ERD-veld `uploadedAt` is de uploaddatum die de bibliotheek toont: het moment waarop de
  controle is geslaagd en de video is vastgelegd.
- Buiten scope: cursussen en scenario-onderdelen, delen met andere organisaties en de centrale
  videobibliotheek (FR-14), beschikbaarheidsopties, de Quest-app, afspelen in de browser,
  herstellen van verwijderde video's.
