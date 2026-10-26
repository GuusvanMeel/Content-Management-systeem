# Feature Specification: Volgorde en vertakkingen van onderdelen, met controle op volledigheid

**Feature Branch**: `Development` (spec-map: `specs/005-course-step-branching`)

**Created**: 2026-10-26

**Status**: Draft

**Input**: User description: "Feature: order and branching of course steps (FR-08), with a live
completeness check in the editor. A teacher can connect the steps of a draft course to define the
order and the branches. Saving as a draft is always possible, also when the course is not complete
(FR-010 of feature 004 stays). Publishing is not part of this feature. Connections: a video step
has at most one next step; a question step has per answer at most one next step; several answers
may go to the same step; loops are allowed; exactly one start step; the end is derived, not
marked; deleting a step removes the connections that point to it, undo restores everything.
Completeness check shown live, per step and for the whole course, never blocks saving: one start
step, at least one end step, every step reachable, a question step has a next step for every
answer or for none, every step has a route to an end, and the rules of feature 004 stay. Follow
the database diagram; step ids stay stable. Restore the connections of the earlier prototype
editor (edges, connection points, the 'Daarna' selector and the route overview). Show the
information at a glance, prefer one-click actions, allow creating a connected new step from an
existing step. Decide in clarify whether a new course starts with a small example. Out of scope:
publishing (FR-09), versions (FR-11), the course library (FR-12), the Quest app."

**Bronnen**: `docs/Requirements.docx` FR-08 ("De gebruiker moet de volgorde en vertakkingen van
scenario-onderdelen binnen een cursus kunnen bepalen."), FR-10; ERD `docs/Diagrams.simp`,
velden `CourseStep.nextCourseStepId` en `Answer.nextCourseStepId`. Bouwt voort op feature 004
(cursussen, onderdelen, concept, "Opslaan als concept", ongedaan maken, onbeschikbare video's).
De verbindingen in de editor komen terug uit het prototype van vóór feature 004 (randen,
verbindingspunten, "Daarna", het route-overzicht), dat in de git-geschiedenis staat.

## Clarifications

### Session 2026-10-26

- Q: Waarmee begint een nieuwe cursus? → A: Met een klein voorbeeld: een vraag "Wat doe je?" als
  startonderdeel, met de antwoorden "Ik grijp in" (goed) en "Ik wacht af", die elk naar een eigen
  video-onderdeel zonder video leiden. Dit vervangt FR-001a van feature 004 (één video-onderdeel
  als start).
- Q: Welk antwoord neemt het oude vervolg over als er een nieuwe vraag tussen twee onderdelen
  wordt gezet? → A: Het goede antwoord (bij een nieuwe vraag antwoord A); het andere antwoord
  heeft nog geen vervolg en wordt gemeld als "Antwoord B is nog niet verbonden".
- Q: Toont ook de cursuslijst of een cursus compleet is? → A: Nee, alleen de editor. De
  cursuslijst blijft zoals in feature 004; een controle op de server komt met publiceren (FR-09).
- Q: Wanneer toont een blok dat het onvolledig is? → A: Meteen, met een rustige oranje stip en de
  eerste melding. Klikt de docent op "Opslaan als concept" terwijl er nog meldingen zijn, dan
  worden die meldingen rood; opslaan lukt wel gewoon (FR-022a).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Onderdelen verbinden tot een route (Priority: P1)

De docent verbindt onderdelen met elkaar: na een video-onderdeel komt het volgende onderdeel, en
bij een vraag gaat elk antwoord naar een eigen vervolg. Zo ontstaat de route van de cursus, met
vertakkingen per antwoord. De verbindingen zijn als pijlen op het canvas te zien en blijven na
opslaan bewaard.

**Why this priority**: Zonder volgorde is een cursus een losse verzameling onderdelen; dit is de
kern van FR-08.

**Independent Test**: Maak een cursus met een video, een vraag met twee antwoorden en twee
video's als vervolg. Verbind ze, sla op en ververs: de pijlen staan er nog precies zo.

**Acceptance Scenarios**:

1. **Given** twee video-onderdelen, **When** de docent het verbindingspunt onder het eerste naar
   het tweede sleept, **Then** loopt er een pijl van het eerste naar het tweede, en staat in het
   bewerkformulier van het eerste bij "Daarna" het tweede onderdeel.
2. **Given** een video-onderdeel met al een volgend onderdeel, **When** de docent het naar een
   ander onderdeel verbindt, **Then** vervangt de nieuwe verbinding de oude; een video-onderdeel
   heeft nooit meer dan één volgend onderdeel.
3. **Given** een vraag met drie antwoorden, **When** de docent antwoord A naar video 1 en
   antwoorden B en C naar video 2 verbindt, **Then** heeft elk antwoord zijn eigen pijl, met de
   letter van het antwoord erbij, en mogen B en C naar hetzelfde onderdeel gaan.
4. **Given** een vraag, **When** de docent een fout antwoord terug verbindt naar een eerder
   video-onderdeel, **Then** wordt die lus geaccepteerd en als pijl terug getoond.
5. **Given** een verbinding, **When** de docent die selecteert en verwijdert (of bij "Daarna"
   "Geen volgend onderdeel" kiest), **Then** verdwijnt de verbinding.
6. **Given** verbonden onderdelen, **When** de docent opslaat en de pagina ververst, **Then**
   staan alle verbindingen er nog, ook verbindingen naar onderdelen die in dezelfde opslag nieuw
   zijn aangemaakt.

---

### User Story 2 - Zien of de cursus af is (Priority: P1)

Terwijl de docent bouwt, laat de editor direct zien wat er nog ontbreekt: per onderdeel op het
blok, en voor de hele cursus in een lijst "nog te doen". Een klik op een punt in de lijst brengt
de docent naar het onderdeel. De controle houdt opslaan nooit tegen.

**Why this priority**: Een vertakte route raakt snel onvolledig (een los antwoord, een
onderdeel dat nergens heen gaat); zonder directe controle merkt de docent dat pas bij publiceren.

**Independent Test**: Maak een vraag waarvan één van twee antwoorden is verbonden: het blok en
de lijst melden het andere antwoord. Verbind het: de melding verdwijnt meteen. Sla tussendoor op:
dat lukt steeds.

**Acceptance Scenarios**:

1. **Given** een cursus in de editor, **When** de docent iets wijzigt, **Then** is de controle
   meteen (zonder opslaan of herladen) bijgewerkt, op de blokken en in de lijst "nog te doen".
2. **Given** een cursus met meldingen, **When** de docent op "Opslaan als concept" klikt,
   **Then** wordt het concept gewoon opgeslagen (FR-010 van feature 004) en worden de meldingen
   rood (FR-022a).
3. **Given** de lijst "nog te doen", **When** de docent op een melding klikt, **Then** opent het
   betreffende onderdeel en komt het in beeld; bij "Kies een startonderdeel" of "Voeg een
   onderdeel toe" komt het hele canvas in beeld.
4. **Given** een cursus zonder meldingen, **When** de docent naar de balk kijkt, **Then** staat
   daar "Cursus is compleet" in plaats van "nog te doen".
5. **Given** de regels in FR-010 t/m FR-018, **When** een regel wordt geschonden, **Then**
   verschijnt precies de bijbehorende melding bij het juiste onderdeel en in de lijst.

---

### User Story 3 - Begin en einde in één oogopslag (Priority: P2)

Op het canvas ziet de docent zonder te klikken: welk onderdeel de start is, welke onderdelen een
einde zijn, hoeveel verbindingen er naar een onderdeel lopen en of een onderdeel compleet is. Een
einde wordt niet gemarkeerd maar volgt uit de route: een onderdeel zonder vervolg is een einde.

**Why this priority**: Overzicht maakt de route begrijpelijk voor docenten zonder technische
kennis (NFR-03, ontwerpbevindingen); het bouwt voort op story 1 en 2.

**Independent Test**: Bouw een route met twee eindes en een onderdeel waar twee pijlen
binnenkomen: zonder iets te openen zijn "Start", twee keer "Einde", het aantal "2" binnenkomende
verbindingen en de complete/onvolledige blokken te zien.

**Acceptance Scenarios**:

1. **Given** een video-onderdeel zonder volgend onderdeel, **When** de docent naar het canvas
   kijkt, **Then** draagt het blok het label "Einde".
2. **Given** een vraag waarvan geen enkel antwoord een vervolg heeft, **When** de docent kijkt,
   **Then** draagt het blok het label "Einde"; zodra één antwoord een vervolg krijgt, verdwijnt
   "Einde" en worden de andere antwoorden als "nog niet verbonden" gemeld.
3. **Given** een onderdeel waar meer dan één verbinding binnenkomt, **When** de docent kijkt,
   **Then** toont het blok het aantal binnenkomende verbindingen.
4. **Given** een onderdeel met een melding, **When** de docent kijkt, **Then** heeft het blok een
   oranje stip met de eerste melding erop; een compleet blok heeft geen markering.
5. **Given** een onderdeel met een oranje melding, **When** de docent op "Opslaan als concept"
   klikt, **Then** wordt het concept opgeslagen en wordt de melding rood; lost de docent haar
   daarna op, dan verdwijnt ze (FR-022a).

---

### User Story 4 - Een verbonden onderdeel maken vanuit een bestaand onderdeel (Priority: P2)

Vanaf het verbindingspunt van een onderdeel (of van een antwoord) maakt de docent met één klik een
nieuw video-onderdeel of een nieuwe vraag dat er meteen aan vast zit, of kiest een bestaand
onderdeel als vervolg.

**Why this priority**: Zo bouwt de docent de route stap voor stap zonder eerst losse blokken te
maken en ze daarna te verbinden (ontwerpbevinding: één klik in plaats van dubbelklikken).

**Independent Test**: Klik op het verbindingspunt van een video-onderdeel en kies "Nieuwe vraag":
er staat een vraag onder, al verbonden, en het bewerkformulier van die vraag is open.

**Acceptance Scenarios**:

1. **Given** een onderdeel, **When** de docent één keer op het verbindingspunt klikt, **Then**
   verschijnt een keuzemenu met "Nieuw video-onderdeel", "Nieuwe vraag" en de bestaande
   onderdelen.
2. **Given** dat menu, **When** de docent "Nieuw video-onderdeel" of "Nieuwe vraag" kiest,
   **Then** komt het nieuwe onderdeel onder het bronblok (per antwoord naast elkaar), is het
   verbonden en opent het voor bewerken.
3. **Given** een verbindingspunt dat al ergens naartoe wijst, **When** de docent er een nieuw
   onderdeel aan maakt, **Then** komt het nieuwe onderdeel ertussen: de bron wijst naar het
   nieuwe onderdeel en het nieuwe onderdeel naar het oude vervolg. Bij een nieuwe vraag gaat het
   goede antwoord (A) naar het oude vervolg en wordt antwoord B gemeld als "nog niet verbonden".
4. **Given** het verbindingspunt, **When** de docent het naar een lege plek sleept en loslaat,
   **Then** verschijnt hetzelfde menu en komt het nieuwe onderdeel op die plek.

---

### User Story 5 - De route als overzicht lezen (Priority: P3)

In de weergave "Lijst" leest de docent de route als een uitgeschreven overzicht: vanaf de start,
met per vraag de antwoorden als vertakkingen, "Einde" waar de route stopt, "Verder bij …" waar
een route terugloopt naar een eerder onderdeel, en apart de onderdelen die niet bereikbaar zijn.

**Why this priority**: Handig om de logica te controleren of door te nemen met collega's; de
canvas-weergaven dekken het bouwen al.

**Independent Test**: Open "Lijst" bij een route met een lus en een los onderdeel: de lus staat
er als "Verder bij …" en het losse onderdeel onder "Niet bereikbaar".

**Acceptance Scenarios**:

1. **Given** een route, **When** de docent "Lijst" kiest, **Then** staat de route vanaf de start
   uitgeschreven, met vertakkingen per antwoord (A, B, …).
2. **Given** een antwoord zonder vervolg in een vraag die wél vervolgen heeft, **When** de
   docent de lijst bekijkt, **Then** staat bij dat antwoord "Nog niet verbonden".
3. **Given** een onderdeel in de lijst, **When** de docent erop klikt, **Then** opent het op het
   canvas.

---

### User Story 6 - Onderdelen verwijderen met behoud van overzicht (Priority: P2)

Verwijdert de docent een onderdeel, dan verdwijnen ook de verbindingen ernaartoe; de onderdelen
of antwoorden die ernaar wezen hebben daarna geen vervolg meer en worden als nog te doen gemeld.
Ongedaan maken zet het onderdeel én alle verbindingen terug.

**Why this priority**: Voorkomt verbindingen naar niets; het verwijderen zelf bestaat al sinds
feature 004.

**Independent Test**: Verwijder het middelste onderdeel van een route A → B → C: A heeft geen
vervolg meer en is "Einde", C is "Niet bereikbaar". Ctrl+Z: A → B → C staat er weer.

**Acceptance Scenarios**:

1. **Given** onderdelen die naar onderdeel X wijzen, **When** de docent X verwijdert, **Then**
   hebben die onderdelen of antwoorden geen vervolg meer, en meldt de controle wat er nu
   ontbreekt.
2. **Given** een verwijderd onderdeel, **When** de docent ongedaan maakt, **Then** komen het
   onderdeel en alle verbindingen van en naar dat onderdeel terug.
3. **Given** het startonderdeel, **When** de docent het verwijdert, **Then** heeft de cursus
   geen start meer en meldt de controle "Kies een startonderdeel".

---

### Edge Cases

- **Video naar zichzelf**: Een video-onderdeel kan niet naar zichzelf wijzen; die lus heeft
  nooit een uitgang. De editor staat het niet toe en de server weigert het.
- **Antwoord naar de eigen vraag**: Mag (de vraag wordt opnieuw gesteld), zolang een ander
  antwoord een uitgang heeft; anders meldt de controle "Vanaf hier eindigt de route nooit".
- **Lus zonder uitgang**: Twee video's die naar elkaar wijzen, zonder andere uitgang: beide
  krijgen "Vanaf hier eindigt de route nooit", en de cursus "De route heeft geen einde" als er
  ook geen bereikbaar einde is.
- **Geen start**: Na het verwijderen of uitzetten van het startonderdeel meldt de controle
  "Kies een startonderdeel"; verder worden dan geen meldingen over bereikbaarheid getoond (zonder
  start is alles onbereikbaar).
- **Lege cursus**: Zonder onderdelen (bijvoorbeeld nadat de docent het voorbeeld van FR-028 heeft
  verwijderd) meldt de controle alleen "Voeg een onderdeel toe".
- **Nieuwe cursus**: Opent met het voorbeeld van FR-028 en de meldingen "Kies een video" bij de
  twee video-onderdelen; verder is de route compleet.
- **Onbeschikbare video**: Een video-onderdeel met een video die niet meer beschikbaar is
  (feature 004, FR-016) wordt gemeld met "Kies een andere video: deze is niet meer beschikbaar",
  omdat bij publiceren een vervangende video nodig is (constitutie, principe V).
- **Verbinding naar een onderdeel dat net is verwijderd en weer teruggezet**: Na ongedaan maken
  wijzen alle verbindingen weer naar het juiste onderdeel, ook als de verwijdering tussendoor is
  opgeslagen.
- **Ongeldige verbinding buiten de interface**: Een verzoek dat naar een onderdeel van een andere
  cursus of een niet-bestaand onderdeel wijst, een video naar zichzelf laat wijzen, of een
  vervolg zet op een antwoord van een video-onderdeel, wordt geweigerd en verandert niets.
- **Twee docenten tegelijk**: Zoals in feature 004: de laatste opslag geldt.
- **Grote routes**: Bij 50 onderdelen met vertakkingen blijft de controle direct (zie SC-004).

## Requirements *(mandatory)*

### Functional Requirements

**Verbindingen**

- **FR-001**: De docent MUST per video-onderdeel hoogstens één volgend onderdeel kunnen
  instellen, wijzigen en weghalen (ERD-veld `CourseStep.nextCourseStepId`).
- **FR-002**: De docent MUST per antwoord van een vraag-onderdeel hoogstens één volgend onderdeel
  kunnen instellen, wijzigen en weghalen (ERD-veld `Answer.nextCourseStepId`). Meerdere antwoorden
  MOGEN naar hetzelfde onderdeel gaan. Een vraag-onderdeel heeft zelf geen vervolg naast dat van
  zijn antwoorden.
- **FR-003**: Een verbinding MAG naar elk onderdeel van dezelfde cursus wijzen, ook naar een
  eerder onderdeel (lus) of, bij een antwoord, naar de eigen vraag. Een video-onderdeel MUST NOT
  naar zichzelf wijzen.
- **FR-004**: Een cursus heeft hoogstens één startonderdeel; de keuze werkt zoals in feature 004
  (vakje "Startonderdeel").
- **FR-005**: Een einde MUST NOT handmatig worden gemarkeerd; een onderdeel is een einde als het
  geen vervolg heeft: een video-onderdeel zonder volgend onderdeel, of een vraag-onderdeel waarvan
  geen enkel antwoord een vervolg heeft (bevestigt FR-019 van feature 004; er bestaat geen
  handmatige eindmarkering die moet verdwijnen).
- **FR-006**: Verwijdert de docent een onderdeel, dan MUST elke verbinding naar dat onderdeel
  verdwijnen; de onderdelen en antwoorden die ernaar wezen hebben daarna geen vervolg. Ongedaan
  maken MUST het onderdeel en alle verbindingen van en naar dat onderdeel terugzetten.
- **FR-007**: Verbindingen MUST met het concept worden opgeslagen ("Opslaan als concept"), in
  dezelfde opslag als de onderdelen, ook naar onderdelen die in die opslag nieuw zijn. De id's
  van onderdelen MUST tussen opslagen gelijk blijven, zodat verbindingen niet verschuiven.
- **FR-008**: De server MUST verbindingen weigeren die naar een onderdeel buiten dit concept
  wijzen, een video-onderdeel naar zichzelf laten wijzen, of een vervolg op een antwoord van een
  video-onderdeel zetten (er zijn er geen), ook buiten de interface om. Een geweigerde opslag
  verandert niets.
- **FR-009**: Opslaan als concept MUST altijd mogelijk blijven, ook als de controle meldingen
  geeft (FR-010 van feature 004). Dit concept is nog steeds nergens buiten de editor zichtbaar.

**Controle op volledigheid** (live in de editor; houdt opslaan nooit tegen)

- **FR-010**: De cursus MUST precies één startonderdeel hebben; anders de melding "Kies een
  startonderdeel".
- **FR-011**: Vanaf de start MUST minstens één einde bereikbaar zijn; anders "De route heeft geen
  einde".
- **FR-012**: Elk onderdeel MUST vanaf de start bereikbaar zijn; anders bij dat onderdeel "Niet
  bereikbaar vanaf de start".
- **FR-013**: Een vraag-onderdeel MUST voor alle antwoorden een vervolg hebben, of voor geen enkel
  antwoord (dan is het een einde). Heeft minstens één antwoord een vervolg, dan MUST elk antwoord
  zonder vervolg worden gemeld: "Antwoord B is nog niet verbonden".
- **FR-014**: Vanaf elk bereikbaar onderdeel MUST een route naar een einde bestaan; anders bij dat
  onderdeel "Vanaf hier eindigt de route nooit" (een lus zonder uitgang).
- **FR-015**: De regels van feature 004 blijven en worden ook gemeld: een video-onderdeel zonder
  video ("Kies een video"), een video die niet meer beschikbaar is ("Kies een andere video: deze
  is niet meer beschikbaar"), een vraag zonder tekst ("Vul de vraag in"), een antwoord zonder
  tekst ("Antwoord A is leeg"); 2–4 antwoorden en precies één goed antwoord dwingt de editor al af.
- **FR-016**: Een cursus zonder onderdelen MUST alleen "Voeg een onderdeel toe" melden.
- **FR-017**: De controle MUST na elke wijziging direct zijn bijgewerkt, zonder opslaan of
  herladen, en MUST ook gelden na ongedaan maken en opnieuw.
- **FR-018**: De naam en beschrijving van de cursus worden niet in deze controle gemeld; die zijn
  bij opslaan al verplicht (feature 004, FR-005).

**Editor en interface**

- **FR-019**: Het canvas MUST de verbindingen als pijlen tonen (per antwoord met de letter van het
  antwoord) en verbindingspunten op de blokken hebben: één onder een video-onderdeel, één per
  antwoord onder een vraag. Een verbinding MUST te maken zijn door te slepen van een
  verbindingspunt naar een blok, en te verwijderen door haar te selecteren en op Delete te
  drukken.
- **FR-020**: Eén klik op een verbindingspunt MUST een menu openen met "Nieuw video-onderdeel",
  "Nieuwe vraag" en de bestaande onderdelen; slepen naar een lege plek MUST hetzelfde menu
  openen. Een nieuw onderdeel uit dat menu MUST meteen verbonden zijn, onder de bron worden
  geplaatst (of op de losgelaten plek) en voor bewerken openen. Wijst het verbindingspunt al
  ergens naartoe, dan MUST het nieuwe onderdeel ertussen komen: een nieuw video-onderdeel wijst
  naar het oude vervolg, bij een nieuwe vraag het goede antwoord (A); antwoord B blijft zonder
  vervolg.
- **FR-021**: Het bewerkformulier MUST bij een video-onderdeel het veld "Daarna" hebben (keuze uit
  de onderdelen en "Geen volgend onderdeel (einde)") en bij elk antwoord een keuze "Gaat naar…"
  met dezelfde opties.
- **FR-022**: Elk blok MUST in één oogopslag tonen: "Start" bij het startonderdeel, "Einde" bij
  een einde (FR-005), het aantal binnenkomende verbindingen als dat meer dan één is, en of het
  onvolledig is (een stip en de eerste melding). Een compleet blok heeft geen markering.
- **FR-022a**: Een melding MUST meteen verschijnen in een rustige oranje stijl ("nog te doen",
  geen fout). Klikt de docent op "Opslaan als concept", dan MUST elke melding die er op dat moment
  is rood worden, op het blok en in de lijst "nog te doen"; het concept wordt toch opgeslagen
  (FR-009). Een melding die na die opslag ontstaat, begint weer oranje; een opgeloste melding
  verdwijnt. Kleur is nooit het enige signaal: de melding staat er ook als tekst.
- **FR-023**: De balk van de editor MUST het aantal meldingen tonen ("3 nog te doen", oranje, of
  rood zodra er een rode melding bij is (FR-022a)) met een
  lijst die per melding naar het onderdeel (of het startonderdeel-vakje) brengt, of "Cursus is
  compleet" als er geen meldingen zijn.
- **FR-024**: De weergave "Lijst" MUST de route vanaf de start uitschrijven: vertakkingen per
  antwoord, "Einde" waar de route stopt, "Verder bij “…”" bij een lus, "Nog niet verbonden" bij
  een antwoord zonder vervolg, en een apart blok "Niet bereikbaar" met de losse onderdelen.
- **FR-025**: "Canvas ordenen" MUST de blokken volgens de route ordenen (van boven naar beneden,
  vertakkingen naast elkaar), zoals in het prototype.
- **FR-026**: Acties MUST met één klik werken; er is geen actie die alleen met dubbelklikken kan.
- **FR-027**: Alle teksten die de docent ziet MUST in het Nederlands zijn.
- **FR-028**: Een nieuwe cursus MUST beginnen met een klein voorbeeld dat laat zien hoe
  vertakken werkt (vervangt FR-001a van feature 004): een vraag-onderdeel "Wat doe je?" als
  startonderdeel, met de antwoorden "Ik grijp in" (goed) en "Ik wacht af"; elk antwoord is
  verbonden met een eigen video-onderdeel zonder video, en beide video-onderdelen zijn een einde.
  Op het canvas staat de vraag bovenaan en staan de twee video-onderdelen er naast elkaar onder.
  De docent kan het voorbeeld gewoon wijzigen of verwijderen. Zolang er geen video's zijn gekozen,
  meldt de controle bij beide video-onderdelen "Kies een video".

### Key Entities *(include if feature involves data)*

- **CourseStep** (bestaat, feature 004): krijgt in deze feature een gevuld `nextCourseStepId`
  voor video-onderdelen met een vervolg. Bij een vraag-onderdeel blijft dit veld leeg; het vervolg
  zit bij de antwoorden.
- **Answer** (bestaat, feature 004): krijgt een gevuld `nextCourseStepId` voor antwoorden met een
  vervolg.
- **Route** (geen tabel): de verbindingen samen, vanaf het startonderdeel. Eindes, bereikbaarheid
  en meldingen worden hieruit afgeleid en niet opgeslagen.
- **Melding** (geen tabel): één punt van de controle, met een tekst en (meestal) het onderdeel of
  antwoord waar het over gaat.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Een docent zonder technische kennis bouwt zonder hulp binnen 10 minuten een route
  van een video, een vraag met twee antwoorden en twee vervolgvideo's, en ziet daarna "Cursus is
  compleet".
- **SC-002**: 100% van de verbindingen die een docent maakt en opslaat, staat er na verversen en
  opnieuw inloggen nog precies zo, ook na meerdere opslagen achter elkaar.
- **SC-003**: Voor elke regel in FR-010 t/m FR-016 geeft een cursus die de regel schendt precies
  de bijbehorende melding, en een cursus die alle regels volgt geen enkele melding (0 vals
  positief, 0 vals negatief in de testset).
- **SC-004**: Bij een cursus van 50 onderdelen met vertakkingen is de controle na een wijziging
  binnen 0,2 seconde zichtbaar bijgewerkt.
- **SC-005**: 0% van de pogingen om een concept met meldingen op te slaan wordt door de controle
  tegengehouden.
- **SC-006**: 0% van de verzoeken met een ongeldige verbinding (FR-008) slaagt.
- **SC-007**: Na het verwijderen van een onderdeel en ongedaan maken is de route in 100% van de
  gevallen gelijk aan die van vóór het verwijderen.

## Assumptions

- De controle draait in de editor; de server controleert alleen of verbindingen geldig zijn
  (FR-008), niet of de cursus volledig is. Publiceren (FR-09) gaat later dezelfde regels
  gebruiken om publiceren tegen te houden.
- De cursuslijst toont geen aantal meldingen en geen "compleet" (Clarifications); de controle is
  alleen in de editor zichtbaar. De server krijgt dezelfde regels pas met publiceren (FR-09).
- Feature 004 kent geen handmatige eindmarkering (het einde volgt daar al uit FR-019); deze feature
  maakt het einde alleen zichtbaar op het blok en in de lijst.
- Een vraag-onderdeel zet nooit zijn eigen `nextCourseStepId`; dat veld blijft leeg en wordt bij
  het opslaan genegeerd of geweigerd.
- Het gedrag rond onbeschikbare video's uit feature 004 (waarschuwing, ongedaan maken na een
  opgeslagen weghaling) blijft ongewijzigd en werkt samen met de verbindingen: een teruggezet
  onderdeel houdt zijn verbindingen.
- De verbindingen, verbindingspunten, "Daarna", het route-overzicht en "Canvas ordenen" volgen het
  prototype in de git-geschiedenis (commit `1914a00` en eerder), aangepast aan de regels hierboven
  (een vraag zonder enkel vervolg is een einde).
- Buiten scope: publiceren en intrekken (FR-09) en het tegenhouden van publiceren bij meldingen,
  versies (FR-11), de cursusbibliotheek en delen (FR-12), de Quest-app.
