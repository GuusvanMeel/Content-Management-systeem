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
  minimum. *Vervangen na de handmatige test: maximaal 5760×2880 en instelbaar, zie hieronder.*
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

### Session 2026-10-22 (na de handmatige test)

- Q: Wanneer wordt een bestand gecontroleerd? → A: Alle controles (extensie, grootte, codec,
  resolutie, beeldverhouding) gebeuren al in het uploadvenster, vóórdat de upload begint, door
  de gegevens van het bestand in de browser te lezen zonder het te versturen. Fouten staan in
  het venster en de knop "Uploaden" blijft uit tot het bestand geldig is. Kan de browser een
  bestand niet lezen, dan mag het toch door en beslist de controle op de server na de upload.
  Die servercontrole blijft altijd als laatste vangnet. De grenzen komen van de server.
- Q: Wat is de maximale resolutie? → A: 5760×2880 beeldpunten, instelbaar (breedte en hoogte
  apart); server en browser lezen dezelfde instelling. De controle "twee keer zo breed als hoog"
  blijft.
- Q: Hoe worden meldingen geformuleerd? → A: In gewoon Nederlands voor docenten zonder
  technische kennis, zonder termen als "2:1"; elke melding zegt wat er mis is en wat de docent
  in plaats daarvan kan doen.
- Q: Wat ziet de docent van een onderbroken upload? → A: De browser die de upload begon, toont
  in de bibliotheek: "Je bent eerder begonnen met uploaden van <naam>, X% klaar. Kies het
  bestand opnieuw om verder te gaan, of verwijder het." Dit gebruikt alleen wat de browser zelf
  onthoudt; er komt niets bij in de database.
- Q: Hoe zichtbaar is de uploadindicator? → A: Een klein rondje met het uploadpictogram en een
  voortgangsring rechtsonder. Op de videopagina staat het er altijd, ook zonder uploads; op
  andere pagina's alleen zolang er uploads zijn. Het begint ingeklapt en blijft ingeklapt bij het
  starten en tijdens de voortgang. Alleen op de videopagina klapt het vanzelf uit bij iets wat de
  docent moet zien (upload klaar, fout of weigering, verbroken verbinding) en na 4 seconden weer
  in. Klikken opent de balk met uploads; zijn er geen uploads, dan opent klikken het
  uploadvenster. Bij het starten van een upload valt een bestandspictogram in het rondje (niet
  bij "verminderde beweging"). Weigeringen na de upload verschijnen daarnaast als melding midden
  in het scherm. *(Aangepast na de tweede en derde handmatige test.)*

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Docent uploadt een 360°-video (Priority: P1)

Een ingelogde docent kiest in de videobibliotheek "Video toevoegen", selecteert een MP4-bestand
van de computer en geeft de video een naam (standaard de bestandsnaam zonder extensie). Nog
vóór de upload controleert het uploadvenster het bestand; is er iets mis, dan staat dat in het
venster in gewone taal en kan de upload niet starten. Daarna toont de upload de voortgang.
Direct na de upload controleert de server het bestand nog een keer en maakt een thumbnail; is
alles in orde, dan staat de video meteen in de bibliotheek.

**Why this priority**: zonder video's kan geen cursus gemaakt worden; dit is de eerste stap in de
workflow die de stakeholder als prioriteit heeft (cursus maken → publiceren → Quest).

**Independent Test**: inloggen als organisatie, een geldige 360°-video (MP4, H.264, twee keer zo
breed als hoog) uploaden en controleren dat die direct daarna met thumbnail, naam en gegevens in
de bibliotheek staat; een ongeldig bestand kiezen en zien dat het venster de fout toont en
"Uploaden" uit staat.

**Acceptance Scenarios**:

1. **Given** een ingelogde docent, **When** die een geldige 360°-video kiest, **Then** toont het
   uploadvenster een voorbeeldbeeld (als de browser dat kan maken), de naam en de grootte, staat
   "Uploaden" aan, en na "Uploaden" ziet de docent de voortgang, daarna kort "Video wordt
   gecontroleerd…", en daarna staat de video met thumbnail, naam, duur, grootte en uploaddatum in
   de bibliotheek.
2. **Given** een ingelogde docent, **When** die een bestand kiest dat geen `.mp4`-bestand is
   (bijv. `.mov`, `.avi`, `.pdf`), **Then** staat in het uploadvenster naast het bestand in rood
   "Dit bestandstype kan niet worden gebruikt. Kies een MP4-video (de bestandsnaam eindigt op .mp4)." en blijft "Uploaden" uit; er wordt niets verstuurd.
3. **Given** een ingelogde docent, **When** die een bestand kiest dat groter is dan 10 GB,
   **Then** staat in het venster "Deze video is groter dan 10 GB. Maak de video korter of sla hem op in een lagere kwaliteit." en blijft "Uploaden" uit.
4. **Given** een MP4-bestand met H.265-video of een andere codec, **When** de docent het kiest,
   **Then** staat in het venster "Deze video is op een manier opgeslagen die de VR-bril niet kan afspelen. Sla de video in je bewerkingsprogramma opnieuw op als MP4 met de instelling ‘H.264’." en blijft "Uploaden" uit.
5. **Given** een MP4/H.264-video die niet twee keer zo breed als hoog is, **When** de docent het
   kiest, **Then** staat in het venster "Dit is geen 360°-video. Kies een video die met een 360°-camera is gemaakt; zo'n beeld is twee keer zo breed als hoog." en blijft "Uploaden" uit.
6. **Given** een 360°-video groter dan 5760×2880 beeldpunten, **When** de docent het kiest,
   **Then** staat in het venster "De beeldkwaliteit van deze video is te hoog voor de VR-bril. Sla de video opnieuw op met een lagere resolutie: maximaal 5760 × 2880 beeldpunten." en blijft "Uploaden" uit.
7. **Given** een bestand dat de browser niet kan lezen, **When** de docent het kiest, **Then**
   mag het toch geüpload worden en beslist de controle op de server; is het ongeldig, dan ziet
   de docent de reden in een duidelijke melding midden in het scherm (niet alleen in de hoek),
   wordt het bestand verwijderd en komt er niets in de bibliotheek.
8. **Given** een lopende upload, **When** de docent naar een andere pagina in het CMS gaat (bijv.
   "Huisstijl"), **Then** loopt de upload door en blijft rechtsonder een klein rondje met het
   uploadpictogram zichtbaar, waarvan de ring de voortgang toont. Bij het starten valt een
   bestandspictogram in het rondje; het klapt niet uit bij het starten of bij voortgang. Op de
   videopagina klapt het alleen vanzelf uit als de upload klaar is, bij een fout of weigering of
   bij een verbroken verbinding, en na 4 seconden weer in.
9. **Given** een lopende upload, **When** de docent het tabblad sluit, de pagina herlaadt of
   naar een andere website gaat, **Then** waarschuwt de browser eerst dat er een upload loopt;
   gaat de docent toch weg, dan is de upload onderbroken en later te hervatten (User Story 2).
10. **Given** een bestand met de extensie `.mp4` dat beschadigd is of geen video bevat, **When**
    het in het venster of na de upload wordt gecontroleerd, **Then** ziet de docent
    "Dit bestand kan niet als video worden geopend. Controleer of de video op je computer goed afspeelt en probeer het opnieuw." en komt er niets in de bibliotheek.

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
6. **Given** een onderbroken upload van "Duikplank" die op 42% stond, **When** de docent in
   dezelfde browser de videobibliotheek opent, **Then** staat daar "Je bent eerder begonnen met
   uploaden van Duikplank, 42% klaar. Kies het bestand opnieuw om verder te gaan, of verwijder
   het." met een knop "Verwijderen"; in een andere browser staat deze melding er niet.
7. **Given** die melding, **When** de docent "Verwijderen" kiest, **Then** verdwijnt de melding
   en worden de al ontvangen delen op de server opgeruimd.

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
- Meerdere bestanden tegelijk kiezen: het uploadvenster toont ze allemaal met per bestand de
  controle; ongeldige bestanden staan in rood en kunnen uit de lijst worden gehaald; "Uploaden"
  staat pas aan als alle bestanden in de lijst geldig zijn. Daarna start de eerste en wacht de
  rest in de wachtrij van de uploadindicator (FR-006b). Een geweigerd of geannuleerd bestand
  laat de volgende in de wachtrij starten.
- Twee tabbladen of twee computers van dezelfde organisatie: elk heeft een eigen wachtrij; de
  limiet geldt per browsertabblad, dus dan kunnen er toch twee uploads tegelijk lopen. Dat is
  aanvaard; de server weigert alleen bij te weinig schijfruimte (FR-004a).
- Dezelfde video twee keer uploaden: toegestaan; het worden twee aparte video's.
- Een bestand met de extensie `.mp4` dat eigenlijk een ander formaat is: wordt al in het
  uploadvenster geweigerd als de browser het kan lezen, anders bij de controle op de server.
- De browser kan de gegevens van een bestand niet lezen (bijv. een ongebruikelijke opbouw van
  het bestand): het venster laat de upload toe; de servercontrole na de upload beslist (FR-013b).
- Een bestand is in het venster goedgekeurd maar wordt toch door de server geweigerd (de browser
  las iets anders dan ffprobe): de docent ziet de reden in een melding midden in het scherm.
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
  andere formaten of codecs MUST geweigerd worden. Bij een verkeerd bestandstype is de melding
  "Dit bestandstype kan niet worden gebruikt. Kies een MP4-video (de bestandsnaam eindigt op .mp4)."; bij een verkeerde codec "Deze video is op een manier opgeslagen die de VR-bril niet kan afspelen. Sla de video in je bewerkingsprogramma opnieuw op als MP4 met de instelling ‘H.264’."
- **FR-003**: Het systeem MUST alleen 360°-video's accepteren: het beeld MUST precies twee keer
  zo breed als hoog zijn (equirectangulair). 360°-metadata in het bestand is niet vereist. Een
  video met een andere verhouding MUST geweigerd worden met de melding "Dit is geen 360°-video. Kies een video die met een 360°-camera is gemaakt; zo'n beeld is twee keer zo breed als hoog."
- **FR-002a**: Het geluidsspoor MUST NOT gecontroleerd worden: een video zonder geluid of met
  geluid in welk formaat dan ook wordt op dit punt geaccepteerd. Alleen het beeld (formaat,
  codec, verhouding, resolutie) bepaalt of een video wordt geaccepteerd.
- **FR-003a**: Het beeld MUST maximaal 5760×2880 beeldpunten zijn (breedte en hoogte apart
  instelbaar door het projectteam zonder codewijziging; server en browser gebruiken dezelfde
  instelling). Er is geen minimumresolutie. Een grotere video MUST geweigerd worden met de
  melding "De beeldkwaliteit van deze video is te hoog voor de VR-bril. Sla de video opnieuw op met een lagere resolutie: maximaal 5760 × 2880 beeldpunten." (met de ingestelde getallen).
- **FR-004**: Een video MUST maximaal 10 GB groot zijn; grotere bestanden MUST vóór de start
  van de upload geweigerd worden met de melding "Deze video is groter dan 10 GB. Maak de video korter of sla hem op in een lagere kwaliteit." (met het ingestelde getal). Er is
  geen totale opslaglimiet per organisatie.
- **FR-004a**: Vóór de start van een upload MUST het systeem controleren of er na de upload nog
  minstens 20 GB vrije schijfruimte op de server overblijft (vrije ruimte − bestandsgrootte ≥
  20 GB). Zo niet, dan MUST de upload geweigerd worden met de melding "Er is op dit moment niet
  genoeg opslagruimte. Neem contact op met de beheerder." Hervatten van een onderbroken upload
  valt onder dezelfde controle voor het nog te versturen deel.
- **FR-005**: Bij het uploaden MUST de docent een naam kunnen opgeven (1–255 tekens); zonder
  naam MUST de bestandsnaam zonder extensie worden gebruikt, ingekort tot 255 tekens. Blijft er
  dan geen naam over (bijv. een bestand dat `.mp4` heet), dan MUST de naam "Video" zijn.
- **FR-006**: Tijdens het uploaden MUST de docent de voortgang kunnen zien (percentage en
  geüploade/totale grootte) en de upload kunnen annuleren.
- **FR-006a**: Een upload MUST doorlopen als de docent binnen het CMS naar een andere pagina
  gaat. Rechtsonder MUST een klein rondje met het uploadpictogram staan, met de totale voortgang
  als ring: op de videopagina altijd, ook als er geen uploads zijn; op andere CMS-pagina's alleen
  zolang er uploads in de lijst staan. Het rondje MUST ingeklapt beginnen en ingeklapt blijven als
  een upload start en terwijl hij vordert. Alleen op de videopagina MUST de indicator vanzelf
  uitklappen, en alleen bij gebeurtenissen die de docent moet zien: een upload is klaar, een fout
  of weigering (ook een verlopen sessie), of een verbroken verbinding; na 4 seconden MUST hij
  vanzelf weer inklappen. Klikken op het rondje MUST, als er uploads in de lijst staan, de
  uploadindicator openen of sluiten (per upload de naam, het percentage, een knop om te annuleren
  en het resultaat); een door klikken geopende indicator klapt niet vanzelf in. Staan er geen
  uploads in de lijst, dan MUST klikken het uploadvenster openen, net als de knop "Video
  toevoegen".
- **FR-006d**: Als een upload start, MUST een kort animatietje laten zien dat er een
  bestandspictogram in het rondje valt, zodat de docent ziet dat de upload begonnen is en waar.
  Heeft de docent in het systeem "verminderde beweging" ingesteld, dan MUST de animatie
  achterwege blijven.
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
  dan zelf dat het om een onderbroken upload gaat. Een onderbroken upload wordt niet als video in
  de bibliotheek getoond.
- **FR-009a**: Heeft deze browser een onderbroken upload, dan MUST de videobibliotheek daarover
  een melding tonen: "Je bent eerder begonnen met uploaden van <naam>, X% klaar. Kies het bestand opnieuw om verder te gaan, of verwijder het.", met een knop "Verwijderen" die de upload annuleert (FR-010).
  Het percentage komt van de server. De melding gebruikt alleen wat de browser zelf over de
  upload onthoudt: alleen de browser die de upload begon, toont haar, en er komt niets bij in de
  database. Een upload die op de server niet meer bestaat, wordt stil vergeten.
- **FR-010**: Bij annuleren MUST het systeem de al ontvangen delen opruimen.
- **FR-011**: Een geplande taak MUST onvoltooide uploads die 24 uur geen nieuw deel hebben
  ontvangen, verwijderen.
- **FR-012**: Zolang een upload loopt, MUST de sessie van de docent niet verlopen door
  inactiviteit (elk ontvangen deel telt als activiteit).

**Controleren vóór en na de upload**

- **FR-013**: Vóór de upload MUST het uploadvenster het bestand controleren door de gegevens van
  het bestand in de browser te lezen, zonder het te versturen: extensie, grootte, container,
  codec, resolutie en verhouding, met de grenzen van de server. Bij een fout MUST de melding in
  rood naast het bestand staan en MUST "Uploaden" uitgeschakeld blijven tot alle gekozen
  bestanden geldig zijn.
- **FR-013a**: Direct nadat een upload volledig is ontvangen, MUST de server het bestand
  opnieuw controleren (dezelfde regels, plus leesbaarheid), de duur en grootte bepalen en een
  thumbnail maken. Pas als dat allemaal is gelukt, MUST de video in de bibliotheek komen. Deze
  controle blijft altijd het laatste vangnet.
- **FR-013b**: Kan de browser de gegevens van een bestand niet lezen, dan MUST het venster de
  upload toch toestaan; de servercontrole (FR-013a) beslist dan.
- **FR-014**: Weigert de server een bestand na de upload, dan MUST het systeem het bestand meteen
  verwijderen, MUST er niets over de video worden opgeslagen, en MUST de docent de reden direct
  zien in een duidelijke melding midden in het scherm (niet alleen in de uploadindicator).
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
- **SC-004**: In een testset van niet-360°-video's, video's groter dan 5760×2880,
  H.265-video's, MOV-bestanden en andere bestanden wordt 100% geweigerd met een begrijpelijke
  melding; in een testset van geldige MP4/H.264-video's (twee keer zo breed als hoog, maximaal
  5760×2880) wordt 100% geaccepteerd. Elk ongeldig bestand dat de browser kan lezen, wordt al in
  het uploadvenster geweigerd, zonder dat er iets wordt verstuurd.
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
