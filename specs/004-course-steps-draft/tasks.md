---
description: "Takenlijst voor de feature Cursussen en onderdelen (concept)"
---

# Tasks: Cursussen en onderdelen (concept)

**Input**: Design documents from `/specs/004-course-steps-draft/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md),
[data-model.md](data-model.md), [contracts/api.md](contracts/api.md),
[contracts/ui.md](contracts/ui.md), [quickstart.md](quickstart.md)

**Tests**: gevraagd (research R11 en de wijziging voor onbeschikbare video's): per story gerichte
tests tegen een echte MariaDB (Vitest + Supertest) en frontendtests (Vitest + Vue Test Utils).
Schrijf ze vóór de implementatie en controleer dat ze eerst falen.

**Organization**: taken zijn gegroepeerd per user story, zodat elke story los te bouwen en te
testen is.

**Conventies** (constitution VI, v2.0.0): alles in de code is Engels, ook commentaar, routes,
foutcodes, logregels en configuratiesleutels. Nederlands alleen voor teksten die de klant ziet:
UI-teksten en het veld `message` (en de teksten in `fields`) in API-foutresponses. Tabel- en
veldnamen exact zoals in het ERD (`Course`, `OrganisationCourse`, `CourseVersion`, `CourseStep`,
`Answer`, `courseVersionId`, `stepType`, `questionText`, `answerText`, `isCorrect`, `sortOrder`,
`positionX`, `positionY`, `nextCourseStepId`).

**Bestaande code**: features 001–003 leveren `backend/src/modules/videos/videoRepository.js`
(`visibleVideosQuery`, de enige bibliotheekregel; MUST NOT veranderen), `lib/sendStoredFile.js`
(`X-Accel-Redirect`), `lib/errors.js` (`AppError`, `validationError`, `notFound`),
`middleware/requireOrganisation.js` (`getOrganisationId`), de testhelpers in
`backend/tests/helpers/testApp.js` (`resetDatabase`, `createOrganisationRow`, `createVideoRow`,
`agentWithSession`), en in de frontend `api/client.js`, `api/videos.js`, `lib/ui.js`
(`confirmDialog`, `toast`), `lib/textLength.js` en het editorprototype in `frontend/src/editor/`.
Alle bestaande tests moeten groen blijven.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US5)
- Paden zijn relatief aan de repository-root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: tabellen volgens het ERD en testhelpers

- [ ] T001 [P] Maak `backend/src/db/migrations/20261026000001_create_course.js`: tabel `Course` met `id` (increments), `parentCourseId` INT unsigned nullable FK → `Course.id`, `isSharedInLibrary` BOOLEAN NOT NULL default false, `createdAt` DATETIME NOT NULL, `updatedAt` DATETIME NOT NULL, `deletedAt` DATETIME nullable; index (`deletedAt`, `updatedAt`); Engels commentaar "Table Course exactly as in the ERD (specs/004 data-model.md)"; `down` dropt de tabel
- [ ] T002 [P] Maak `backend/src/db/migrations/20261026000002_create_organisation_course.js`: `OrganisationCourse` met `organisationId` INT unsigned NOT NULL FK → `Organisation.id`, `courseId` INT unsigned NOT NULL FK → `Course.id`, `isOwner` BOOLEAN NOT NULL, `addedAt` DATETIME NOT NULL; PK (`organisationId`, `courseId`); index (`courseId`)
- [ ] T003 [P] Maak `backend/src/db/migrations/20261026000003_create_course_version.js`: `CourseVersion` met `id`, `courseId` INT unsigned NOT NULL FK → `Course.id`, `versionNumber` INT NOT NULL, `name` VARCHAR(255) NOT NULL, `description` TEXT NOT NULL, `publishedAt` DATETIME nullable ("NULL = concept (open versie)"); unique (`courseId`, `versionNumber`)
- [ ] T004 [P] Maak `backend/src/db/migrations/20261026000004_create_course_step.js`: `CourseStep` met `id`, `courseVersionId` INT unsigned NOT NULL FK → `CourseVersion.id`, `isStart` BOOLEAN NOT NULL, `stepType` ENUM('video','question') NOT NULL, `description` TEXT nullable ("altijd NULL (FR-017)"), `feedback` TEXT nullable, `videoId` INT unsigned nullable FK → `Video.id`, `questionText` TEXT nullable, `nextCourseStepId` INT unsigned nullable FK → `CourseStep.id` ON DELETE SET NULL, `positionX` INT NOT NULL, `positionY` INT NOT NULL; index (`courseVersionId`), index (`videoId`); plus via `knex.raw` de CHECK `(stepType = 'video' AND questionText IS NULL AND feedback IS NULL) OR (stepType = 'question' AND videoId IS NULL)` (research R4)
- [ ] T005 [P] Maak `backend/src/db/migrations/20261026000005_create_answer.js`: `Answer` met `id`, `courseStepId` INT unsigned NOT NULL FK → `CourseStep.id`, `answerText` VARCHAR(255) NOT NULL ("nog niet ingevuld = ''"), `isCorrect` BOOLEAN NOT NULL, `sortOrder` TINYINT NOT NULL (0–3), `nextCourseStepId` INT unsigned nullable FK → `CourseStep.id` ON DELETE SET NULL; index (`courseStepId`, `sortOrder`)
- [ ] T006 Breid `resetDatabase` in `backend/tests/helpers/testApp.js` uit met `Answer`, `CourseStep`, `CourseVersion`, `OrganisationCourse`, `Course` (kinderen eerst, vóór `Video` en `Organisation`) en voeg helpers toe: `createCourseRow({ organisationId, name, description, deletedAt })` (maakt `Course` + `OrganisationCourse` met `isOwner` true + `CourseVersion` 1 en geeft `{ courseId, versionId }`), `createStepRow({ versionId, stepType, videoId, questionText, isStart, answers })` en `restrictVideo(videoId)` / `softDeleteVideo(videoId)` (zet `visibility` op `private` resp. `deletedAt`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: één toegangsregel voor cursussen, de controle van het concept-document, opslaan als
geheel, en in de frontend de API, de omzetting en de editor op een lokale kopie

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

### Tests for Foundational

- [ ] T007 [P] Schrijf `backend/tests/unit/courseDraft.test.js` voor `validateDraft` (T010): naam/beschrijving verplicht en getrimd, 255/256 en 1000/1001 tekens, emoji telt als één teken; `stepType` alleen `video`/`question`; video-onderdeel met `questionText`, `feedback` of `answers` → fout "Een video-onderdeel heeft geen vraag, antwoorden of feedback."; vraag-onderdeel met `videoId` → "Een vraag-onderdeel heeft geen video."; 1 en 5 antwoorden → "Een vraag heeft 2 tot 4 antwoorden."; 0 en 2 goede → "Kies precies één goed antwoord."; twee `isStart` → "Er kan maar één startonderdeel zijn."; 201 onderdelen → "Een cursus kan maximaal 200 onderdelen hebben."; lege `questionText`/`answerText` toegestaan; `positionX` buiten ±1 000 000 of geen geheel getal → fout; foutsleutels als `steps.3.answers.1.answerText`
- [ ] T008 [P] Schrijf `backend/tests/integration/courseSave.test.js` (SC-002, SC-004): `PUT /api/organisation/courses/:id` maakt onderdelen zonder `id` aan en geeft id's terug; werkt onderdelen met `id` bij; verwijdert onderdelen en antwoorden die niet in het verzoek staan; hetzelfde verzoek twee keer na elkaar sturen (tweede keer zonder de nieuwe id's) geeft geen dubbele onderdelen; een `id` van een andere cursus of een niet-bestaand `id` → `400` "Dit onderdeel hoort niet bij deze cursus."; andere `stepType` voor een bestaand `id` → `400` "De soort van een onderdeel kan niet veranderen."; bij elke `400` is de database ongewijzigd (alles of niets); `Course.updatedAt` verandert bij opslaan; `CourseStep.description` en `nextCourseStepId` blijven NULL; laatste opslag wint (twee opslagen na elkaar, de tweede staat er); verzoek groter dan 1 MB → `413 payload_too_large`
- [ ] T009 [P] Schrijf `backend/tests/integration/courseIsolation.test.js` (SC-003): organisatie B krijgt `404 not_found` op `GET`, `PUT` en `DELETE /courses/:idVanA` en op `GET /courses/:idVanA/steps/:stepId/video-thumbnail`; B ziet de cursus niet in `GET /courses`; een niet-numeriek `:id` geeft `404`; zonder sessie `401`, met een beheerderssessie `403`; de data van A is na alle pogingen ongewijzigd

### Implementation for Foundational

- [ ] T010 [P] Maak `backend/src/lib/courseDraft.js` met `validateDraft(body)` dat het verzoek normaliseert (trim van naam/beschrijving, `\r\n` → `\n` in vraag/antwoord/feedback, lege feedback → `null`, lege vraag → `''`) en alle regels uit data-model.md § Regels controleert met de meldingen uit contracts/api.md; gooit één `validationError(fields)` met alle fouten; tekens tellen met `characterCount` (code points); leest `description` en `nextCourseStepId` nooit uit het verzoek (research R4)
- [ ] T011 Maak `backend/src/modules/courses/courseRepository.js` met `ownCoursesQuery(organisationId, trx)` als enige definitie: `Course` join `OrganisationCourse` (`organisationId` = parameter, `isOwner` = true) join `CourseVersion` (`publishedAt IS NULL`), `Course.deletedAt IS NULL` (research R2); plus `findOwnCourse(id, organisationId, trx)`, `listSteps(versionId, trx)` en `listAnswers(stepIds, trx)`; Engels commentaar dat elke cursusroute bij deze query start
- [ ] T012 Maak `backend/src/modules/courses/courseService.js` met `getDraft(courseId, organisationId)` (concept-document volgens contracts/api.md; onderdelen op `id`, antwoorden op `sortOrder`; vraag-onderdeel krijgt `questionText`, `feedback`, `answers`; video-onderdeel `videoId` en voorlopig `video: null`) en `saveDraft(courseId, organisationId, body)` dat in één transactie de stappen uit data-model.md § Opslaan uitvoert (bijwerken met `id`, invoegen zonder `id`, ontbrekende onderdelen eerst hun antwoorden en dan zelf verwijderen, antwoorden idem met `sortOrder` 0–3, `CourseVersion.name/description` bijwerken, `Course.updatedAt = UTC_TIMESTAMP()`), en daarna `getDraft` teruggeeft; onbekende of verkeerde id's en andere `stepType` → `validationError` (research R3)
- [ ] T013 Maak `backend/src/modules/courses/courseRoutes.js` met `GET /courses/:id` en `PUT /courses/:id` (alleen `name`, `description`, `steps` uit de body; id uit de URL via dezelfde `^[1-9]\d{0,9}$`-controle als `videoRoutes`, anders `404`), organisatie-id altijd via `getOrganisationId(req)`; koppel in `backend/src/app.js` `courseRoutes` aan `/api/organisation` en zet vóór de algemene `express.json` een `app.use('/api/organisation/courses', express.json({ limit: '1mb' }))` met Engels commentaar (research R8)
- [ ] T014 [P] Maak `frontend/src/api/courses.js` met `listCourses()`, `createCourse({ name, description })`, `getCourse(id)`, `saveCourse(id, draft)`, `deleteCourse(id)` via `api()` uit `api/client.js` (contracts/api.md)
- [ ] T015 [P] Maak `frontend/src/lib/courseMapping.js` met `toEditor(document)` → `{ course, stepVideos }` (`isStart` → `course.startId`, `positionX/Y` → `x/y`, `questionText` → `question`, `answerText` → `text`, `isCorrect` → `correct`, `video` → kaart `stepVideos[videoId] = { name, durationSeconds, thumbnailUrl, available }`) en `toPayload(course, savedIds)` (omgekeerd; stuurt `id` alleen mee voor onderdelen en antwoorden waarvan het id in `savedIds` staat, research R9/R10)
- [ ] T016 [P] Schrijf `frontend/tests/course-mapping.test.js`: `toPayload(toEditor(doc).course, ids)` geeft hetzelfde document terug (zonder `video`, `status`, `updatedAt`); tijdelijke sleutels en id's die niet in `savedIds` staan, gaan zonder `id` mee; `stepVideos` bevat naam, duur, thumbnail en `available`
- [ ] T017 Pas `frontend/src/lib/course.js` aan: verwijder `next`, `target`, `connect`, `disconnect`, `addLinkedNode`, `outgoing`, `incoming`, `isEnd`, `contentSnapshot`, `courseStatus`, `usedVideoIds` en `title`/`description` op onderdelen; `newVideoNode` = `{ id, type: 'video', x, y, videoId: null }`, `newQuestionNode` met twee lege antwoorden (eerste `correct`); `addNode` maakt het eerste onderdeel start; `deleteNode` zet `startId` op `null` als het start was; `orderedNodes` = start eerst, dan op `y`, dan `x`; `nodeLabel(node, stepVideos)` = videonaam / "Kies een video" / vraagtekst / "Nieuwe vraag"; `autoLayout` zet de blokken in `orderedNodes`-volgorde in één kolom (research R9)
- [ ] T018 Pas `frontend/src/lib/history.js` aan: `snap` = `{ name, description, startId, nodes }` in het nieuwe model (posities tellen mee); voeg `replaceIds(map)` toe dat tijdelijke sleutels in alle opgeslagen stappen en de huidige toestand vervangt door de nieuwe id's na opslaan (research R10)
- [ ] T019 Maak `frontend/src/lib/editorPreference.js` met `getEditorVariant()` / `setEditorVariant(v)` in `localStorage` (sleutel `cms:editor-variant`, waarden `popover` / `inspector` / `list`, standaard `inspector`), elke lees- en schrijfactie in try/catch
- [ ] T020 Herschrijf `frontend/src/editor/context.js`: `provideEditor({ course, stepVideos, history, save })` werkt op de lokale kopie; houdt `savedSnapshot` en `savedIds`; `dirty` = `snap(course) !== savedSnapshot`; `saveDraft()` stuurt `toPayload`, verwerkt het antwoord via `toEditor` (kaart verversen, `history.replaceIds`, nieuwe `savedSnapshot`), en bij een fout de melding "De cursus is niet opgeslagen. Probeer het opnieuw." (of de velden uit `fields` rood); verwijder `connect`, `disconnect`, `addLinked`, `selectEdge`, `validation`, `focusIssue`; `editorVariant` via `lib/editorPreference.js`
- [ ] T021 Herschrijf `frontend/src/views/EditorView.vue`: laadt de cursus met `getCourse(id)` (laden-toestand; `404` → "Cursus niet gevonden" met "Terug naar cursussen"); balk met terug, label "Concept", naam, weergaven, ongedaan maken/opnieuw (Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z) en knop "Opslaan als concept" (uit + "Opgeslagen" zonder wijzigingen, "Opslaan…" tijdens opslaan); weg: "te doen", "Publiceren", "Intrekken", `usePublishing`; `onBeforeRouteLeave` met `confirmDialog({ title: 'Wijzigingen niet opgeslagen', body: 'Je wijzigingen gaan verloren als je deze pagina verlaat.', confirmLabel: 'Verlaten', danger: true })` als `dirty`, en `beforeunload` zolang `dirty`; de vertrekvraag wordt overgeslagen bij een 401 (research R10)
- [ ] T022 Pas `frontend/src/editor/CanvasEditor.vue` aan: geen `edges`, geen `CourseEdge`, geen verbindingshandles, geen `onConnect`; blokken slepen past `x/y` aan (telt als wijziging); "Canvas ordenen" gebruikt `autoLayout`; verwijder `frontend/src/editor/CourseEdge.vue` en `frontend/src/editor/RouteTree.vue`
- [ ] T023 [P] Pas `frontend/src/editor/OverviewList.vue` aan: platte lijst van `orderedNodes` met `nodeLabel`, startlabel "Start", klik opent het onderdeel; geen routes of "losse onderdelen"
- [ ] T024 Verwijder `frontend/src/stores/app.js`, `frontend/src/data/seed.js`, `frontend/src/lib/publishing.js` en `frontend/src/lib/validate.js`, en alle imports ervan (o.a. in `editor/NodeEditForm.vue`, `editor/VideoNode.vue`, `editor/VideoPicker.vue`, `views/CoursesView.vue`); controleer met `npm run lint` in `frontend/` dat er geen verwijzingen meer zijn
- [ ] T025 [P] Schrijf `frontend/tests/course-dirty.test.js`: na laden geen wijzigingen; een vraagtekst wijzigen maakt `dirty`; ongedaan maken tot de opgeslagen toestand maakt `dirty` weer false; na een gesimuleerde opslag zijn tijdelijke sleutels vervangen in toestand en geschiedenis; een teruggezet onderdeel waarvan het id niet in `savedIds` staat, gaat zonder `id` in de payload

**Checkpoint**: een bestaande cursus (uit `createCourseRow`) is te openen, te wijzigen en op te slaan; isolatie en opslaan zijn getest

---

## Phase 3: User Story 1 - Een cursus aanmaken en terugvinden (Priority: P1) 🎯 MVP

**Goal**: cursus aanmaken, lijst van de eigen organisatie, afgeschermd van andere organisaties

**Independent Test**: maak een cursus aan, ververs en log opnieuw in: hij staat in de lijst als "Concept"; een andere organisatie ziet hem niet (spec US1)

### Tests for User Story 1

- [ ] T026 [P] [US1] Schrijf `backend/tests/integration/courseCrud.test.js` (deel aanmaken en lijst): `POST /courses` maakt `Course` (`isSharedInLibrary` false, `parentCourseId` NULL), `OrganisationCourse` (`isOwner` true) en `CourseVersion` (`versionNumber` 1, `publishedAt` NULL) en geeft `201` met `steps: []`; lege of alleen-spaties naam/beschrijving → `400` "Vul een naam en een beschrijving in."; 256 tekens naam → "De naam mag maximaal 255 tekens lang zijn."; 1001 tekens beschrijving → "De beschrijving mag maximaal 1000 tekens zijn."; `GET /courses` geeft alleen niet-verwijderde eigen cursussen, nieuwste `updatedAt` eerst, met `videoStepCount`, `questionStepCount` en `status: "draft"`
- [ ] T027 [P] [US1] Schrijf `frontend/tests/courses-view.test.js`: lege lijst toont "Er zijn nog geen cursussen." met "Maak de eerste cursus"; "Aanmaken" met lege velden maakt geen verzoek, maakt de velden rood en toont "Vul een naam en een beschrijving in."; een geslaagde aanmaak navigeert naar `/courses/<id>`; de rij toont "<n> video's · <n> vragen" en "Concept"

### Implementation for User Story 1

- [ ] T028 [US1] Voeg in `backend/src/modules/courses/courseRepository.js` `listOwnCourses(organisationId)` toe (één query met `COUNT(CASE WHEN stepType = 'video' …)` en `'question'` over de open versie, gesorteerd op `Course.updatedAt` desc, dan `id` desc; research R6) en `insertCourse(trx, organisationId, { name, description })` (drie regels met `UTC_TIMESTAMP()`, research R1)
- [ ] T029 [US1] Voeg in `backend/src/modules/courses/courseService.js` `listCourses(organisationId)` en `createCourse(organisationId, body)` toe (naam/beschrijving via dezelfde regels als `validateDraft`, in één transactie) en in `backend/src/modules/courses/courseRoutes.js` `GET /courses` en `POST /courses` (`201`)
- [ ] T030 [US1] Herschrijf `frontend/src/views/CoursesView.vue` op `api/courses.js`: laden-toestand, fout "De cursussen konden niet worden geladen." met "Opnieuw", lege toestand, rijen met naam, aantallen, "bewerkt <tijd geleden>" en label "Concept" (geen "te doen"); venster "Nieuwe cursus" met tekenteller "<n> tekens over" (max. 255 / 1000, zoals `DescriptionField.vue`) en `400`-velden uit `fields`

**Checkpoint**: US1 werkt los: aanmaken, lijst, isolatie

---

## Phase 4: User Story 2 - Een video-onderdeel toevoegen (Priority: P1)

**Goal**: video-onderdelen met een video uit de bibliotheek; een later onbeschikbare video blijft gewoon in zijn onderdeel staan (FR-014–FR-016a)

**Independent Test**: video-onderdeel met een algemeen beschikbare video van een andere organisatie, opslaan, verversen: hij staat er; dezelfde video in een tweede cursus lukt; na beperken van die video staat hij nog met naam, thumbnail en duur in het onderdeel, maar niet in de bibliotheek of kiezer (spec US2)

### Tests for User Story 2

- [ ] T031 [P] [US2] Schrijf `backend/tests/integration/courseVideos.test.js` (SC-005): met organisaties A, B, C en video's in de drie beschikbaarheden accepteert `PUT` precies de video's uit `visibleVideosQuery(A)` in een nieuw onderdeel en weigert de rest met `400` "Kies een video uit de bibliotheek." bij `steps.<n>.videoId`; video-onderdeel zonder video (`videoId: null`) opslaan lukt; dezelfde video in twee onderdelen en in twee cursussen lukt (FR-015); `GET /courses/:id` geeft bij een beschikbare video `video` met precies `id`, `name`, `durationSeconds`, `thumbnailUrl` (`/api/organisation/courses/<c>/steps/<s>/video-thumbnail`) en `available: true`
- [ ] T032 [P] [US2] Schrijf `backend/tests/integration/courseUnavailableVideo.test.js` (SC-005a, FR-016, FR-016a), voor beide gevallen "beperkt" (`restrictVideo`) en "zacht verwijderd" (`softDeleteVideo`): `GET /courses/:id` geeft nog `name`, `durationSeconds`, `thumbnailUrl` en `available: false`, en geen andere velden van de video (geen `owner`, `description`, `visibility`); opslaan zonder dat onderdeel te wijzigen lukt; dezelfde `videoId` in een nieuw onderdeel of een ander bestaand onderdeel → `400` "Kies een video uit de bibliotheek."; de video staat niet in `GET /videos` en `GET /videos/:id` en `GET /videos/:id/thumbnail` geven `404` (bibliotheek ongewijzigd); `GET /courses/:c/steps/:s/video-thumbnail` geeft `200` met het JPEG-bestand voor een beschikbare, een beperkte en een verwijderde video
- [ ] T033 [P] [US2] Voeg aan `backend/tests/integration/courseUnavailableVideo.test.js` de `404`-gevallen van de thumbnailroute toe: organisatie B (eigenaar van de video, die hem zelf wel mag zien) via de cursus van A; organisatie C; de cursus van A na zacht verwijderen; een vraag-onderdeel; een video-onderdeel zonder video; een onderdeel uit een andere cursus van A met het `courseId` van deze cursus; een niet-bestaand `stepId`; een video zonder `thumbnailStorageKey`

### Implementation for User Story 2

- [ ] T034 [US2] Voeg in `backend/src/modules/courses/courseService.js` aan `saveDraft` de videocontrole toe: alle `videoId`'s uit het verzoek in één query tegen `visibleVideosQuery(organisationId, trx)`; een niet-zichtbare `videoId` alleen toegestaan als hetzelfde bestaande onderdeel (zelfde `id`) die `videoId` al opgeslagen had, anders `validationError({ 'steps.<n>.videoId': 'Kies een video uit de bibliotheek.' })` (research R5); `visibleVideosQuery` zelf MUST NOT veranderen
- [ ] T035 [US2] Vul in `backend/src/modules/courses/courseService.js` `getDraft` met `video` voor elk video-onderdeel met `videoId`: directe join `CourseStep.videoId → Video` zonder filter op `deletedAt` of zichtbaarheid, alleen `id`, `name`, `durationSeconds`, `thumbnailUrl` = `/api/organisation/courses/<courseId>/steps/<stepId>/video-thumbnail` (of `null` zonder `thumbnailStorageKey`) en `available` = id zit in één query op `visibleVideosQuery(organisationId)` (research R5a); voeg de bijbehorende query toe aan `courseRepository.js`
- [ ] T036 [US2] Voeg in `backend/src/modules/courses/courseRepository.js` `findStepVideoThumbnailKey(courseId, stepId, organisationId)` toe (via `ownCoursesQuery` → open versie → `CourseStep` met dat `id`, `stepType = 'video'`, `videoId` niet NULL → `Video.thumbnailStorageKey`, zonder filter op `Video.deletedAt`) en in `backend/src/modules/courses/courseRoutes.js` `GET /courses/:id/steps/:stepId/video-thumbnail` dat bij geen resultaat `404 not_found` geeft en anders `sendStoredFile(res, key, { contentType: 'image/jpeg', cacheControl: 'private, max-age=3600' })`; Engels commentaar dat dit de enige plek is waar een niet-zichtbare video wordt getoond en dat de bibliotheekregel niet wordt verruimd (FR-016a)
- [ ] T037 [US2] Herschrijf `frontend/src/editor/VideoPicker.vue`: video's uit `listVideos()` van `api/videos.js` (eigen en beschikbaar, met `OwnerPill` zoals de bibliotheek; leeg: "Nog geen video's. Upload ze bij Video's."); het huidige videoblok toont naam, duur en thumbnail uit `stepVideos`; "Wijzig" opent de lijst; kiezen voegt de video aan `stepVideos` toe met `available: true` en de bibliotheek-`thumbnailUrl`
- [ ] T038 [US2] Pas `frontend/src/editor/VideoNode.vue` aan: geen handles; toont thumbnail, naam en duur uit `ed.stepVideos[node.videoId]` (ook als `available` false is, zonder extra melding), "Kies een video" zonder video, label "Start"
- [ ] T039 [US2] Pas het videogedeelte van `frontend/src/editor/NodeEditForm.vue` aan: `VideoPicker`, "Video weghalen" (zet `videoId` op `null`, onderdeel blijft; FR-020c), "Startonderdeel" (aan/uit via `ed.setStart`), "Verwijderen"; geen "Titel" en geen "Daarna"
- [ ] T040 [US2] Voeg in `frontend/src/views/EditorView.vue` (of de editorbalk) een knop "Video" toe die via `ed.addNode('video')` een video-onderdeel toevoegt en het opent

**Checkpoint**: US2 werkt los: video-onderdelen opslaan, onbeschikbare video blijft zichtbaar in zijn onderdeel, thumbnail alleen via de eigen cursus

---

## Phase 5: User Story 3 - Een vraag-onderdeel toevoegen (Priority: P1)

**Goal**: vraag-onderdelen met 2–4 antwoorden, precies één goed, optionele feedback

**Independent Test**: vraag met drie antwoorden, tweede goed, opslaan, verversen: alles staat er nog (spec US3)

### Tests for User Story 3

- [ ] T041 [P] [US3] Voeg aan `backend/tests/integration/courseSave.test.js` toe: vraag-onderdeel met lege vraag en lege antwoorden opslaan lukt en geeft `questionText: ""` en `answerText: ""` terug; `feedback` wordt bewaard en lege feedback wordt `null`; `sortOrder` volgt de volgorde in het verzoek; feedback op een video-onderdeel → `400`
- [ ] T042 [P] [US3] Schrijf `frontend/tests/question-node.test.js`: nieuw vraagblok heeft twee lege antwoorden met het eerste goed; toevoegen stopt bij 4; verwijderen stopt bij 2; het goede antwoord verwijderen maakt het eerste overgebleven antwoord goed; een ander antwoord goed maken laat er precies één goed

### Implementation for User Story 3

- [ ] T043 [US3] Pas het vraaggedeelte van `frontend/src/editor/NodeEditForm.vue` aan: Vraag (max. 1000 tekens met `limitCharacters`), Antwoorden A–D met radioknop voor het goede antwoord (max. 255 tekens), toevoegen tot 4 en verwijderen tot 2 via `addAnswer`/`removeAnswer`/`setCorrect`, Feedback (optioneel, max. 1000, hint "Wat de cursist na het antwoorden ziet"), "Startonderdeel", "Verwijderen"; geen koppeling per antwoord
- [ ] T044 [P] [US3] Pas `frontend/src/editor/QuestionNode.vue` aan: geen handles; vraagtekst of "Nieuwe vraag", antwoorden A–D met het goede gemarkeerd, label "Start"
- [ ] T045 [US3] Voeg in `frontend/src/views/EditorView.vue` (of de editorbalk) een aparte knop "Vraag" toe die via `ed.addNode('question')` een vraag-onderdeel toevoegt en het opent

**Checkpoint**: US1–US3 samen: een volledig concept met video's en vragen

---

## Phase 6: User Story 4 - Onderdelen wijzigen, verwijderen en het startonderdeel kiezen (Priority: P2)

**Goal**: start kiezen, verwijderen met ongedaan maken, soort vast, en de waarschuwing bij het weghalen van een onbeschikbare video (FR-018, FR-020–FR-020c)

**Independent Test**: start markeren, onderdeel verwijderen, opslaan, verversen; onderdeel met een onbeschikbare video verwijderen geeft eerst de waarschuwing (spec US4)

### Tests for User Story 4

- [ ] T046 [P] [US4] Schrijf `frontend/tests/unavailable-video-warning.test.js` (FR-020b, SC-005b): met `stepVideos[v].available === false` vraagt de editor `confirmDialog` met titel "Video niet meer beschikbaar" vóór (a) het onderdeel verwijderen, (b) "Video weghalen", (c) een andere video kiezen; "Annuleren" laat onderdeel en `videoId` ongewijzigd en `dirty` false; "Doorgaan" voert de actie uit; daarna zet ongedaan maken onderdeel en video terug; met `available: true` wordt `confirmDialog` bij geen van de drie acties aangeroepen
- [ ] T047 [P] [US4] Voeg aan `frontend/tests/course-dirty.test.js` toe: een onderdeel als start markeren maakt het vorige niet-start; het startonderdeel verwijderen laat `startId` `null`; verwijderen toont de melding "Onderdeel verwijderd" met "Ongedaan maken" en zonder vraag

### Implementation for User Story 4

- [ ] T048 [US4] Voeg in `frontend/src/editor/context.js` `confirmLosingVideo(node)` toe: geeft direct `true` als `node.type !== 'video'`, er geen `videoId` is of `stepVideos[videoId]?.available !== false`; anders `confirmDialog({ title: 'Video niet meer beschikbaar', body: 'Deze video is niet meer beschikbaar voor jouw organisatie (privé gemaakt of verwijderd). Haal je hem uit de cursus, dan kun je hem daarna niet opnieuw toevoegen.', confirmLabel: 'Doorgaan', danger: true })`; maak `removeNode` async en laat het eerst `confirmLosingVideo` aanroepen; daarna als voorheen (zonder vraag, toast "Onderdeel verwijderd" met "Ongedaan maken") (research R5b)
- [ ] T049 [US4] Laat "Video weghalen" in `frontend/src/editor/NodeEditForm.vue` en het kiezen van een andere video in `frontend/src/editor/VideoPicker.vue` eerst `ed.confirmLosingVideo(node)` aanroepen; bij annuleren sluit de kiezer zonder wijziging
- [ ] T050 [US4] Zorg in `frontend/src/editor/context.js` en `NodeEditForm.vue` dat `setStart(id)` alleen `course.startId` zet (één start), dat "Startonderdeel" uitzetten `startId` op `null` zet, en dat er nergens een knop is om de soort van een onderdeel te wijzigen

**Checkpoint**: US4 werkt los, inclusief de waarschuwing voor onbeschikbare video's

---

## Phase 7: User Story 5 - Een cursus wijzigen en verwijderen (Priority: P2)

**Goal**: naam/beschrijving wijzigen via opslaan, zacht verwijderen vanuit de lijst

**Independent Test**: naam wijzigen, opslaan, verversen: nieuwe naam in de lijst; verwijderen: weg uit de lijst, adres geeft "Cursus niet gevonden", record bestaat nog (spec US5)

### Tests for User Story 5

- [ ] T051 [P] [US5] Voeg aan `backend/tests/integration/courseCrud.test.js` toe: `PUT` met nieuwe naam werkt `CourseVersion.name` bij en verandert de volgorde in `GET /courses`; `DELETE /courses/:id` geeft `204`, zet `Course.deletedAt` en `updatedAt`, laat versie, onderdelen, antwoorden en `OrganisationCourse` staan; daarna geven `GET`, `PUT`, `DELETE` en de thumbnailroute `404` en ontbreekt de cursus in de lijst (SC-006)

### Implementation for User Story 5

- [ ] T052 [US5] Voeg in `backend/src/modules/courses/courseRepository.js` `softDeleteOwnCourse(id, organisationId)` toe (alleen via `ownCoursesQuery`, `deletedAt = updatedAt = UTC_TIMESTAMP()`, research R7) en in `courseRoutes.js` `DELETE /courses/:id` (`204`, anders `404`)
- [ ] T053 [US5] Verwijderen in `frontend/src/views/CoursesView.vue`: `confirmDialog({ title: 'Cursus verwijderen?', body: '“<naam>” wordt verwijderd.', confirmLabel: 'Verwijderen', danger: true })`, daarna `deleteCourse(id)`, rij weg en `toast('Cursus verwijderd')`
- [ ] T054 [US5] Venster "Naam en beschrijving" in `frontend/src/views/EditorView.vue`: wijzigt de lokale kopie (telt als wijziging, valt onder ongedaan maken); tekenteller zoals bij aanmaken; "Opslaan als concept" met lege naam of beschrijving stuurt geen verzoek, opent het venster met de lege velden rood en "Vul een naam en een beschrijving in."

**Checkpoint**: alle stories werken

---

## Phase 8: Polish & Cross-Cutting Concerns

- [ ] T055 [P] Maak `backend/scripts/seed-courses.js` (`node scripts/seed-courses.js <loginCode> <courses> <stepsPerCourse>`, weigert met `NODE_ENV=production`, zoals `seed-videos.js`): cursussen met afwisselend video-onderdelen (met video's uit `visibleVideosQuery`) en vraag-onderdelen met 3 antwoorden; zonder zichtbare video's alleen vraag-onderdelen (quickstart.md § Prestatie)
- [ ] T056 [P] Controleer dat `backend/src/modules/videos/videoRepository.js`, `videoService.js` en `videoRoutes.js` niet zijn gewijzigd (`git diff --stat` op die bestanden is leeg) en dat alle tests van features 001–003 groen zijn
- [ ] T057 Draai `docker compose --profile test run --rm --build api-test` en `docker compose run --rm --build web-build npm test`; los fouten op tot alles groen is
- [ ] T058 Voer de handmatige scenario's 1–23, de controles in § Thumbnail van een onbeschikbare video en § Ongeldige verzoeken, en de prestatiemeting uit [quickstart.md](quickstart.md) uit, en noteer afwijkingen
- [ ] T059 [P] Draai `npm run lint` in `backend/` en `frontend/`; controleer dat alle code, commentaar, routes en foutcodes Engels zijn en alle UI-teksten en `message`-velden Nederlands (constitution VI)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: geen afhankelijkheden
- **Foundational (Phase 2)**: na Setup; blokkeert alle stories
- **US1 (Phase 3)**: na Foundational
- **US2 (Phase 4)** en **US3 (Phase 5)**: na Foundational; los van US1 testbaar via `createCourseRow`; in de UI is aanmaken (US1) handig maar niet nodig
- **US4 (Phase 6)**: na Foundational; de waarschuwing (T048–T049) bouwt op de kiezer en het formulier uit US2 (T037, T039)
- **US5 (Phase 7)**: na Foundational; T053 bouwt op `CoursesView.vue` uit US1 (T030)
- **Polish (Phase 8)**: na alle gewenste stories

### Within Each User Story

- Tests eerst, en eerst falend
- Backend: repository → service → routes
- Frontend: lib/context → componenten → view

### Parallel Opportunities

- T001–T005 (migraties) parallel
- T007–T009 (foundational tests), T010, T014–T016 parallel
- Binnen US2: T031–T033 parallel; daarna backend (T034–T036) en frontend (T037–T040) parallel door twee mensen
- US1, US2 en US3 kunnen na Foundational parallel

## Parallel Example: User Story 2

```text
Task: "T031 courseVideos.test.js"
Task: "T032 courseUnavailableVideo.test.js (blijft staan, niet kiesbaar, thumbnail 200)"
Task: "T033 courseUnavailableVideo.test.js (thumbnailroute 404-gevallen)"
# daarna
Task: "T034–T036 backend: videocontrole, video in het document, thumbnailroute"
Task: "T037–T040 frontend: kiezer, videoblok, formulier, knop Video"
```

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1 + Phase 2
2. Phase 3 (US1): aanmaken en lijst
3. **STOP en VALIDATE**: quickstart scenario's 1–3 en 15

### Incremental Delivery

1. US1 → aanmaken en terugvinden
2. US2 → video-onderdelen, incl. onbeschikbare video's en de cursus-thumbnailroute
3. US3 → vraag-onderdelen (met US2: een volledig concept)
4. US4 → start, verwijderen, waarschuwing bij onbeschikbare video's
5. US5 → wijzigen en verwijderen van cursussen
6. Polish → prestatie, regressie, quickstart
