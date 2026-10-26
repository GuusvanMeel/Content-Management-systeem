---
description: "Takenlijst voor de feature Volgorde en vertakkingen van onderdelen, met controle op volledigheid"
---

# Tasks: Volgorde en vertakkingen van onderdelen, met controle op volledigheid

**Input**: Design documents from `/specs/005-course-step-branching/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md),
[contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md)

**Tests**: zoals in feature 004 (research R8): per story gerichte tests tegen een echte MariaDB
(Vitest + Supertest) en frontendtests (Vitest + Vue Test Utils). Schrijf ze vóór de implementatie
en controleer dat ze eerst falen.

**Organization**: taken zijn gegroepeerd per user story, zodat elke story los te bouwen en te
testen is.

**Conventies** (constitution VI): code, commentaar, routes, velden (`key`, `nextStepKey`,
`nextStepId`) en meldingcodes Engels; UI-teksten, meldingteksten en `message` Nederlands.
Veldnamen in de database exact zoals in het ERD (`nextCourseStepId`).

**Bestaande code**: feature 004 levert `backend/src/lib/courseDraft.js`,
`backend/src/modules/courses/` (repository, service, routes), de testhelpers in
`backend/tests/helpers/testApp.js` (`createCourseRow`, `createStepRow`), en in de frontend
`lib/course.js`, `lib/courseMapping.js`, `lib/history.js`, `editor/context.js` en de
editorcomponenten. Het prototype met verbindingen staat in git commit `1914a00`
(`frontend/src/lib/course.js`, `lib/validate.js`, `editor/CanvasEditor.vue`,
`editor/CourseEdge.vue`, `editor/RouteTree.vue`, `editor/NodeEditForm.vue`). Alle bestaande tests
moeten groen blijven.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US6, as numbered in spec.md)
- Paden zijn relatief aan de repository-root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: de prototypebestanden terughalen als vertrekpunt

- [X] T001 [P] Zet `frontend/src/editor/CourseEdge.vue` terug uit git (`git show 1914a00:frontend/src/editor/CourseEdge.vue`) zonder hem al te gebruiken; pas alleen imports aan die niet meer bestaan (`useApp` → `useEditor`), zodat lint groen blijft
- [X] T002 [P] Zet `frontend/src/editor/RouteTree.vue` terug uit git (`1914a00`) op dezelfde manier; vervang `videoThumb`/`ed.app.videosById` door `ed.stepVideos[videoId]?.thumbnailUrl` en `nodeLabel(n, ed.stepVideos)`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: verbindingen opslaan en laden (sleutels), het model met `next`/`target`, en de pure
helpers die alle stories gebruiken

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational

- [X] T003 [P] Breid `backend/tests/unit/courseDraft.test.js` uit (research R2): `key` verplicht, tekst ≤ 64, uniek → anders `steps.<n>.key` "Dit onderdeel heeft geen geldige sleutel."; `nextStepKey` `null` of een `key` uit het verzoek → anders "Dit vervolg bestaat niet in deze cursus." (ook bij `steps.<n>.answers.<m>.nextStepKey`); video met `nextStepKey` gelijk aan de eigen `key` → "Een video-onderdeel kan niet naar zichzelf wijzen."; vraag met een eigen `nextStepKey` → "Een vraag gaat verder via haar antwoorden."; een antwoord mag naar de eigen vraag wijzen
- [X] T004 [P] Schrijf `backend/tests/integration/courseConnections.test.js` (SC-002, SC-006, FR-007, FR-008): verbindingen naar onderdelen die in dezelfde opslag nieuw zijn; een lus (video B → video A); een antwoord naar de eigen vraag; twee antwoorden naar hetzelfde onderdeel; `GET` geeft `nextStepId` bij video's en antwoorden en geen `nextStepId` bij een vraag; id's en verbindingen gelijk over drie opeenvolgende opslagen; hetzelfde verzoek twee keer (zonder nieuwe id's) geeft geen dubbelingen en dezelfde route; een onderdeel weglaten waar naar gewezen werd → de verwijzing wordt `null`; elke ongeldige verbinding uit T003 → `400` en de database ongewijzigd; `CourseStep.nextCourseStepId` van een vraag blijft `NULL`
- [X] T005 [P] Breid `frontend/tests/course-mapping.test.js` uit: `toEditor` zet `nextStepId` om naar `next` (video) en `target` (antwoord) als `s<id>`; `toPayload` geeft elk onderdeel `key` = editorsleutel en `nextStepKey`/answer `nextStepKey` = de sleutel van het doel of `null`; heen en terug zonder verlies

### Implementation for Foundational

- [X] T006 Breid `backend/src/lib/courseDraft.js` uit met de regels van T003 (`key`, `nextStepKey`, meldingen uit contracts/api.md); `validateDraft` geeft `key` en `nextStepKey` door in de genormaliseerde onderdelen en antwoorden
- [X] T007 Breid `saveDraft` in `backend/src/modules/courses/courseService.js` uit (research R1): onderdelen en antwoorden eerst met `nextCourseStepId: null` schrijven, dan een kaart `key → id` maken en `CourseStep.nextCourseStepId` (alleen video) en `Answer.nextCourseStepId` zetten, alles in dezelfde transactie; voeg de nodige update-functies toe aan `backend/src/modules/courses/courseRepository.js`; `getDraft`/`toDraftDocument` geeft `nextStepId` bij video-onderdelen en antwoorden (lees `nextCourseStepId` mee in `listSteps` en `listAnswers`)
- [X] T008 Werk de bestaande backendtests bij die `PUT` gebruiken (`courseSave.test.js`, `courseVideos.test.js`, `courseUnavailableVideo.test.js`, `courseCrud.test.js`, `courseIsolation.test.js`, `seedCourses.test.js`): elk onderdeel in een verzoek krijgt een `key`; de verwachte documenten krijgen `nextStepId: null`
- [X] T009 [P] Breid `frontend/src/lib/courseMapping.js` uit volgens T005: `nextStepId` ↔ `next`/`target`, en in `toPayload` `key` en `nextStepKey` voor elk onderdeel en antwoord
- [X] T010 Zet in `frontend/src/lib/course.js` de verbindingen terug uit `1914a00` (research R6): `next` op een video-knooppunt, `target` op een antwoord (beide `null` in `newVideoNode`/`newQuestionNode`), `outgoing`, `incoming`, `connect` (weigert een video naar zichzelf), `disconnect`, `positionBelow`, `addLinkedNode` en `isEnd`; `deleteNode` maakt elke `next`/`target` naar het verwijderde onderdeel `null` (FR-006); `isEnd` = video zonder `next` of vraag zonder enig antwoord met `target` (FR-005); `addLinkedNode` zet bij een nieuwe vraag het **goede** antwoord op het oude vervolg (clarify Q2); `nodeLabel` en `orderedNodes` blijven, `orderedNodes` loopt weer breedte-eerst vanaf de start met losse onderdelen achteraan
- [X] T011 Breid `frontend/src/editor/context.js` uit met `connect(source, handle, target)`, `disconnect(source, handle)` en `addLinked(sourceId, handle, type, pos)` (alle via `lib/course.js`), zodat ze onder ongedaan maken vallen; de `transform` van feature 004 (FR-020d) laat `next`/`target` ongemoeid

**Checkpoint**: verbindingen gaan heen en terug tussen editor en database; nog niets zichtbaar op het canvas

---

## Phase 3: User Story 1 - Onderdelen verbinden tot een route (Priority: P1) 🎯 MVP

**Goal**: pijlen, verbindingspunten, "Daarna"/"Gaat naar…", opslaan; een nieuwe cursus begint met het vertakkende voorbeeld (FR-001–FR-009, FR-019, FR-021, FR-028)

**Independent Test**: video → vraag met twee antwoorden → twee video's verbinden, opslaan, verversen: de pijlen staan er nog (spec US1)

### Tests for User Story 1

- [X] T012 [P] [US1] Pas `backend/tests/integration/courseCrud.test.js` aan op FR-028 (research R3): `POST /courses` geeft een startvraag "Wat doe je?" met "Ik grijp in" (goed, `sortOrder` 0) en "Ik wacht af" (`sortOrder` 1), elk met `nextStepId` naar een eigen video-onderdeel zonder video op (−130, 260) en (130, 260); de lijst telt 2 video's en 1 vraag
- [X] T013 [P] [US1] Schrijf `frontend/tests/course-connections.test.js` (deel verbinden): `ed.connect` zet `next`/`target`; een tweede verbinding vervangt de eerste; video naar zichzelf wordt geweigerd; antwoord naar de eigen vraag mag; `disconnect` haalt weg; "Daarna" in `NodeEditForm.vue` toont de onderdelen zonder het onderdeel zelf plus "Geen volgend onderdeel (einde)"; "Gaat naar…" per antwoord toont ook de eigen vraag; na opslaan (gesimuleerd) en `toEditor` zijn de verbindingen gelijk

### Implementation for User Story 1

- [X] T014 [US1] Laat `insertCourse` in `backend/src/modules/courses/courseRepository.js` het voorbeeld van FR-028 maken (data-model.md § Nieuwe cursus) in plaats van één video-onderdeel; werk `specs/004-course-steps-draft/quickstart.md` scenario 3 en 4 bij met een verwijzing naar FR-028 van feature 005
- [X] T015 [US1] Zet in `frontend/src/editor/CanvasEditor.vue` de randen terug uit `1914a00` (`edges` uit `outgoing`, type `course` met `CourseEdge.vue`, pijlpunt) en de verbindingslogica (`onConnectStart`, `onConnect`, `onConnectEnd`, `isValidConnection` zonder video-naar-zichzelf, `selectEdge`, Delete/Backspace op een geselecteerde pijl → `ed.disconnect`); voeg `selectedEdge`/`selectEdge` weer toe aan `editor/context.js`
- [X] T016 [P] [US1] Zet in `frontend/src/editor/VideoNode.vue` de handles terug uit `1914a00` (`in` boven, `next` onder met "+") en in `frontend/src/editor/QuestionNode.vue` de handles per antwoord (letter-vakjes)
- [X] T017 [US1] Zet in `frontend/src/editor/NodeEditForm.vue` "Daarna" (video) en "Gaat naar…" per antwoord terug uit `1914a00`, met de opties uit contracts/ui.md § Bewerkformulier, via `ed.connect`/`ed.disconnect`
- [X] T018 [US1] Laat `frontend/src/editor/CourseEdge.vue` (T001) werken met de huidige editor: label met de antwoordletter, selecteren via `ed.selectEdge`, geselecteerde stijl

**Checkpoint**: US1 werkt los: verbinden, wijzigen, weghalen, opslaan; nieuwe cursus met voorbeeld

---

## Phase 4: User Story 2 - Zien of de cursus af is (Priority: P1)

**Goal**: de live controle met oranje/rode meldingen en de lijst "nog te doen" (FR-010–FR-018, FR-022a, FR-023)

**Independent Test**: vraag met één verbonden antwoord → melding bij het andere; verbinden → weg; opslaan lukt steeds en maakt open meldingen rood (spec US2)

### Tests for User Story 2

- [X] T019 [P] [US2] Schrijf `frontend/tests/completeness.test.js` (SC-003): voor elke code uit data-model.md § Melding een cursus die alleen die regel schendt → precies die melding (code, tekst, `nodeId`/`answerId`), en een geldige variant → geen melding; "geen start" geeft alleen `noStart` (plus de regels per onderdeel) en geen `unreachable`/`noEnd`/`neverEnds`; een lege cursus geeft alleen `empty`; een vraag zonder enig vervolg is een einde en geeft geen `answerOpen`; een lus met uitgang geeft geen `neverEnds`, zonder uitgang wel; het voorbeeld van FR-028 geeft alleen twee keer `noVideo`; een onbeschikbare video geeft `videoUnavailable`; `id`'s zijn stabiel (`<code>:<nodeId>:<answerId>`); 50 onderdelen met vertakkingen: `checkCourse` < 200 ms (SC-004)
- [X] T020 [P] [US2] Schrijf `frontend/tests/issue-colours.test.js` (FR-022a): een nieuwe melding is oranje; na `ed.saveDraft()` (ook als die mislukt) is ze rood en het concept toch opgeslagen; een melding die daarna ontstaat is oranje; een opgeloste melding verdwijnt; na opslaan met nieuwe sleutels blijven rode meldingen rood; de balk toont "n nog te doen" (rood als er een rode bij is) of "Cursus is compleet"; klik op een melding roept `ed.open(nodeId)` aan

### Implementation for User Story 2

- [X] T021 [P] [US2] Maak `frontend/src/lib/completeness.js` met `checkCourse(course, stepVideos)` → `{ issues, byNode, complete }` volgens research R4 en de teksten van data-model.md § Melding
- [X] T022 [US2] Voeg in `frontend/src/editor/context.js` `issues` (`computed` op `checkCourse`) en `flaggedIssueIds` (reactieve set) toe; `saveDraft` vult `flaggedIssueIds` met de `id`'s van de meldingen op het moment van klikken (ook bij een mislukte opslag) en vervangt na opslaan de sleutels erin; `isFlagged(issue)` voor de kleur (research R5)
- [X] T023 [US2] Voeg in `frontend/src/editor/CourseEditor.vue` de knop "n nog te doen" (oranje of rood) met lijst toe, of "Cursus is compleet" met vinkje; klik op een melding → `ed.open(nodeId)`, of bij `noStart`/`empty` het canvas in beeld (`fitView`); toon in `NodeEditForm.vue` de meldingen van het onderdeel bovenaan in dezelfde kleur

**Checkpoint**: US1 + US2: verbinden met directe controle

---

## Phase 5: User Story 3 - Begin en einde in één oogopslag (Priority: P2)

**Goal**: "Start", "Einde", "← n" en de stip op elk blok (FR-022)

**Independent Test**: route met twee eindes en een onderdeel met twee binnenkomende pijlen: alles zichtbaar zonder te klikken (spec US3)

### Tests for User Story 3

- [X] T024 [P] [US3] Schrijf `frontend/tests/node-badges.test.js`: `VideoNode.vue` toont "Einde" zonder `next` en niet met `next`; `QuestionNode.vue` toont "Einde" als geen antwoord een `target` heeft en niet zodra één antwoord er een heeft; "← 2" bij twee binnenkomende verbindingen, niets bij één; stip met de eerste melding, oranje of rood volgens `ed.isFlagged`; geen stip bij een compleet blok

### Implementation for User Story 3

- [X] T025 [US3] Voeg in `frontend/src/editor/VideoNode.vue` en `frontend/src/editor/QuestionNode.vue` de labels "Einde" (`isEnd`) en "← n" (`incoming(course, id).length` > 1) toe naast "Start", en de stip met de eerste melding uit `ed.issues.byNode` in oranje of rood (kleur nooit het enige signaal: de tekst staat erbij)

**Checkpoint**: US3 werkt

---

## Phase 6: User Story 4 - Een verbonden onderdeel maken vanuit een bestaand onderdeel (Priority: P2)

**Goal**: één klik op een verbindingspunt opent het menu; nieuw onderdeel verbonden en ertussen (FR-020, FR-026)

**Independent Test**: klik op "+" onder een video → "Nieuwe vraag": vraag eronder, verbonden, formulier open (spec US4)

### Tests for User Story 4

- [X] T026 [P] [US4] Breid `frontend/tests/course-connections.test.js` uit: `ed.addLinked` met een video plaatst het nieuwe onderdeel onder de bron en verbindt het; per antwoord naast elkaar; als de handle al verbonden was komt het ertussen (video: `next` = oude vervolg; vraag: goede antwoord = oude vervolg, ander antwoord `null`); een test op `ConnectMenu.vue`: opties "Nieuw video-onderdeel", "Nieuwe vraag", de bestaande onderdelen (zonder de video zelf), "Verbinding weghalen" alleen bij een verbonden handle, zoekveld bij meer dan 8 onderdelen, Escape sluit zonder wijziging

### Implementation for User Story 4

- [X] T027 [US4] Maak `frontend/src/editor/ConnectMenu.vue` volgens contracts/ui.md § Canvas (menu met nieuwe onderdelen, doorzoekbare lijst "Bestaand onderdeel", "Verbinding weghalen", Escape/klik buiten sluit)
- [X] T028 [US4] Laat `frontend/src/editor/CanvasEditor.vue` het menu openen bij één klik op een handle (connect-start + connect-end zonder beweging, zoals het prototype) bij die handle, en bij slepen naar een lege plek op die plek; een nieuw onderdeel uit het menu gaat via `ed.addLinked` en opent daarna (`popover`: dialoog, `inspector`: paneel)

**Checkpoint**: US4 werkt

---

## Phase 7: User Story 6 - Onderdelen verwijderen met behoud van overzicht (Priority: P2)

**Goal**: verwijderen haalt verbindingen weg, ongedaan maken zet alles terug (FR-006, SC-007)

**Independent Test**: A → B → C, B verwijderen: A is einde, C niet bereikbaar; Ctrl+Z: A → B → C (spec US6)

### Tests for User Story 6

- [X] T029 [P] [US6] Breid `frontend/tests/course-connections.test.js` uit: na `ed.removeNode` hebben alle bronnen (video's en antwoorden) geen vervolg meer en meldt de controle dat; `history.undo()` zet het onderdeel en alle verbindingen van en naar het onderdeel terug (route gelijk aan ervoor, SC-007), ook als de verwijdering tussendoor is opgeslagen; het startonderdeel verwijderen geeft alleen `noStart`; samen met een onbeschikbare video (feature 004 FR-020d) komt het onderdeel terug zonder video maar mét zijn verbindingen

### Implementation for User Story 6

- [X] T030 [US6] Controleer en maak af in `frontend/src/lib/course.js` en `frontend/src/editor/context.js` dat `deleteNode`/`removeNode` alle verwijzingen leegmaakt en dat de geschiedenis alles terugzet; los gevonden fouten uit T029 op

**Checkpoint**: US6 werkt

---

## Phase 8: User Story 5 - De route als overzicht lezen (Priority: P3)

**Goal**: weergave "Lijst" als uitgeschreven route (FR-024) en "Canvas ordenen" volgens de route (FR-025)

**Independent Test**: route met een lus en een los onderdeel: "Verder bij …" en "Niet bereikbaar" (spec US5)

### Tests for User Story 5

- [X] T031 [P] [US5] Schrijf `frontend/tests/route-overview.test.js`: `OverviewList.vue` met `RouteTree.vue` toont de route vanaf de start met A/B-vertakkingen, "Einde", "Verder bij “…”" bij een lus, "Nog niet verbonden" bij een open antwoord in een vraag met vervolgen, "Niet bereikbaar" met losse onderdelen, en zonder start "Nog geen startonderdeel"; klik roept `ed.open` aan; `autoLayout` zet een vervolg onder zijn bron

### Implementation for User Story 5

- [X] T032 [US5] Herschrijf `frontend/src/editor/OverviewList.vue` naar de route-weergave uit `1914a00` met `RouteTree.vue` (T002), met "Nog niet verbonden" alleen voor antwoorden in een vraag die wél vervolgen heeft, en het blok "Niet bereikbaar"
- [X] T033 [US5] Zet `autoLayout` in `frontend/src/lib/course.js` weer op dagre volgens de route (randen uit `outgoing`), met losse onderdelen onderaan, zoals in `1914a00` (FR-025)

**Checkpoint**: alle stories werken

---

## Phase 9: Polish & Cross-Cutting Concerns

- [X] T034 [P] Werk `specs/004-course-steps-draft/contracts/api.md` (`POST` geeft het voorbeeld) bij met een verwijzing naar feature 005
- [X] T035 Draai `docker compose --profile test run --rm --build api-test` en `docker compose --profile test run --rm --build web-build npm test`; los fouten op tot alles groen is
- [X] T036 [P] Draai `npm run lint` in `backend/` en `frontend/`; controleer de taalconventies (constitution VI)
- [ ] T037 Voer de handmatige scenario's 1–16 en de ongeldige verzoeken uit [quickstart.md](quickstart.md) uit en noteer afwijkingen

---

**Notities bij de uitvoering (2026-10-26)**:

- Eigen componenten in plaats van alles in bestaande bestanden: `editor/StepBadges.vue` ("Start",
  "Einde", "← n" en de stip; gebruikt door `VideoNode.vue` en `QuestionNode.vue`) en
  `editor/CompletenessStatus.vue` ("n nog te doen" / "Cursus is compleet"; staat in de balk van
  `CourseEditor.vue`, T023).
- Kleuren: nieuwe tokens `--todo` en `--todo-soft` in `frontend/src/styles.css` voor de oranje
  "nog te doen"-stijl.
- Testhulpen: `frontend/tests/editorHarness.js` (editor met een concept-document) en
  `frontend/tests/editorStubs.js` (vervanger voor de vue-flow-`Handle` buiten een canvas). Twee
  tests van feature 004 zijn omgedraaid omdat deze feature het gedrag bewust verandert: het
  bewerkformulier heeft nu "Gaat naar…" per antwoord, en een vraagblok heeft verbindingspunten.
- De controle stuurt bij een klik op een melding zonder onderdeel ("Kies een startonderdeel",
  "Voeg een onderdeel toe", "De route heeft geen einde") het hele canvas in beeld via
  `focusRequest` met `id: null`.
- Gemeten: `checkCourse` op 50 onderdelen met vertakkingen ruim onder 200 ms (`completeness.test.js`).
- T035: in Docker 301/301 backendtests en 249/249 frontendtests groen; T036: ESLint schoon in
  beide projecten.
- T037 (handmatige quickstart) staat nog open; de editor is nog niet in een browser geprobeerd.

## Verbeterronde na de handmatige test (T037, 2026-10-26)

- [X] R1 Feedback bij opslaan: na een geslaagde opslag kort "Concept opgeslagen" met vinkje of
  "Opgeslagen, nog n punten open", en de knop kort groen; zonder animatie bij
  `prefers-reduced-motion` (`editor/CourseEditor.vue`).
- [ ] R2 Tussenpunt van een verbinding slepen en met dubbelklik terugzetten. **Uitgesteld** (zie
  `docs/backlog.md`, "Lijnen verplaatsen en lijnstijl"). Gebouwd en daarna weer gericht verwijderd:
  migratie, API-velden, validatie, editor en tests; de opdrachtgever heeft de migratie teruggedraaid.
- [ ] R3 Lijnstijl "Vloeiend"/"Hoekig" voor het hele canvas en een eigen stijl per pijl.
  **Uitgesteld**, samen met R2.
- [X] R4 Overlappende lijnen: pijlen die in hetzelfde onderdeel binnenkomen lopen in een eigen baan
  (`editor/edgeStyle.js`, `laneOffsets`); vaste kleur per antwoordletter, ook op het label, letter
  blijft zichtbaar; pijlen van video's neutraal; bij aanwijzen of selecteren wordt de pijl dikker,
  lichten bron en doel op en dimt de rest (`focusEdge`/`focusEnds` in `editor/context.js`).
- [X] R5 "← n" alleen nog als tooltip op het blok ("Wordt bereikt vanuit 2 verbindingen"); de
  lus-aanduiding blijft op de pijl (gebogen pijl, en "↺" bij het label).
- [X] R6 Nog-te-doen-lijst gegroepeerd (`ISSUE_GROUPS`/`groupIssues` in `lib/completeness.js`,
  `editor/CompletenessStatus.vue`): Cursus (apart), Antwoorden zonder vervolg, Video-onderdelen zonder
  video, Onbereikbare onderdelen, Lussen zonder uitgang en Lege vragen en antwoorden. Inklapbaar,
  met aantal, open bij minder dan 5 punten.
- [X] R7 Grote knop "Canvas ordenen" naast "Opslaan als concept", zonder bevestiging, met melding
  "Canvas geordend" en "Ongedaan maken" (`tidyCanvas` in `editor/context.js`); het kleine icoon op
  het canvas is weg.
- [X] R8 Quickstart: scenario 6 en 15 herschreven, scenario's 17–26 toegevoegd.

**Notities bij de verbeterronde**:

- Afwijking R6: de zes groepen zijn de vijf voorbeelden uit de opdracht plus "Lege vragen en
  antwoorden" voor `noQuestion` en `emptyAnswer`; `videoUnavailable` valt onder
  "Video-onderdelen zonder video". Er zijn geen nieuwe berichttypes.
- Afwijking R5: de lus-aanduiding was alleen de gebogen pijl; bij een lus staat nu ook "↺" naast de
  antwoordletter (of alleen "↺" bij een video), zodat een lus ook zonder vorm te herkennen is.
- Afwijking R5: de tooltip-teller telt vanaf 1 verbinding ("Wordt bereikt vanuit 1 verbinding");
  zonder binnenkomende verbinding is er geen tooltip.
- R2/R3 uitgesteld: de bediening in de browser werkte nog niet naar wens. Het voorgestelde schema
  (zeven kolommen) en de eisen staan in `docs/backlog.md`. `docs/Diagrams` is niet aangepast; de
  velden die daar al in staan, worden door de code niet gebruikt.
- Niet in een browser gecontroleerd: het echte aanwijzen op het vue-flow-canvas (hover, dimmen,
  banen), de groene knop en de animatie, en `prefers-reduced-motion`. De tests dekken de logica,
  niet de weergave.

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: geen afhankelijkheden
- **Foundational (Phase 2)**: na Setup; blokkeert alle stories
- **US1 (Phase 3)**: na Foundational
- **US2 (Phase 4)**: na Foundational; de controle werkt zonder canvas-randen (via "Daarna"/testdata), dus los van US1 te testen
- **US3 (Phase 5)**: na US2 (stip gebruikt `issues`) en T016 (handles in de blokken)
- **US4 (Phase 6)**: na US1 (handles en randen)
- **US6 (Phase 7)**: na Foundational; meldingen na verwijderen vragen US2
- **US5 (Phase 8)**: na Foundational (T002)
- **Polish (Phase 9)**: na alle gewenste stories

### Within Each User Story

- Tests eerst, en eerst falend
- Backend: courseDraft → repository → service
- Frontend: lib → context → componenten

### Parallel Opportunities

- T001 en T002; T003–T005; T009 naast T006–T007
- Na Foundational: US1 (canvas) en US2 (controle) door twee mensen; US5 kan parallel

## Parallel Example: User Story 2

```text
Task: "T019 completeness.test.js"
Task: "T020 issue-colours.test.js"
Task: "T021 lib/completeness.js"
# daarna
Task: "T022 context.js: issues en flaggedIssueIds"
Task: "T023 CourseEditor.vue: nog te doen / compleet"
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 + Phase 2
2. Phase 3 (US1): verbinden en opslaan, nieuw voorbeeld
3. **STOP en VALIDATE**: quickstart scenario's 1, 6–8

### Incremental Delivery

1. US1 → route bouwen
2. US2 → directe controle (oranje/rood)
3. US3 → begin en einde in één oogopslag
4. US4 → verbonden onderdeel met één klik
5. US6 → verwijderen met behoud van overzicht
6. US5 → route-overzicht en ordenen
7. Polish → regressie, lint, quickstart
