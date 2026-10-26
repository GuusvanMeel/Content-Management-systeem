# Implementation Plan: Cursussen en onderdelen (concept)

**Branch**: `Development` (feature `004-course-steps-draft`) | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-course-steps-draft/spec.md`

## Summary

Een docent maakt cursussen van de eigen organisatie aan, wijzigt en verwijdert ze (zacht), en
vult ze met video-onderdelen en vraag-onderdelen. Alles is concept; er wordt niets gepubliceerd.
De bestaande cursus-editor uit het prototype blijft het uitgangspunt, maar werkt voortaan op
echte gegevens met een knop "Opslaan als concept", ongedaan maken/opnieuw, en een vraag bij
verlaten met niet-opgeslagen wijzigingen.

Technisch: vijf nieuwe tabellen precies volgens het ERD (`Course`, `OrganisationCourse`,
`CourseVersion`, `CourseStep`, `Answer`). Een concept is de `CourseVersion` zonder
`publishedAt`. Eén repositoryfunctie bepaalt welke cursussen een organisatie mag zien. Opslaan
is één `PUT` met het hele concept, dat in één transactie wordt gecontroleerd en weggeschreven
(bijwerken, aanmaken, verwijderen wat ontbreekt). Welke video gekozen mag worden, volgt de
bestaande `visibleVideosQuery` uit feature 003, die niet verandert. Een video die na gebruik
onbeschikbaar of verwijderd is, blijft in zijn onderdeel staan met naam, duur en thumbnail; die
gegevens komen alleen via de eigen cursus, en de thumbnail via een cursusroute per onderdeel.
Weghalen van zo'n video geeft in de editor eerst een waarschuwing. In de frontend verdwijnt de localStorage-store van het
prototype; een omzetting tussen API-document en editormodel houdt de editorcomponenten
grotendeels gelijk. Zie [research.md](research.md).

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js 22 LTS; Vue 3 (bestaande stack, features 001–003)

**Primary Dependencies**: backend: Express 5, Knex + mysql2; frontend: Vue 3, Vite, Vue Router,
Pinia, `@vue-flow` en `@dagrejs/dagre` (al in het prototype). Geen nieuwe dependencies.

**Storage**: MariaDB 11.8: nieuwe tabellen `Course`, `OrganisationCourse`, `CourseVersion`,
`CourseStep`, `Answer` ([data-model.md](data-model.md)); `Video` en `VideoAccess` ongewijzigd

**Testing**: Vitest + Supertest tegen een echte MariaDB-testdatabase (backend), Vitest + Vue
Test Utils (frontend)

**Target Platform**: Linux-VPS met Docker Compose; moderne desktopbrowsers

**Project Type**: webapplicatie (frontend + backend)

**Performance Goals**: cursuslijst met 50 cursussen en een concept met 50 onderdelen elk binnen
2 s in beeld (SC-007); lijst en openen zijn elk een vast klein aantal queries, onafhankelijk van
het aantal onderdelen

**Constraints**: één VPS (constitution II); geen polling (feature 001); opslaan is alles of
niets (FR-009); laatste opslag wint (Clarifications); maximaal 200 onderdelen per concept en een
JSON-limiet van 1 MB op de opslagroute (research R8)

**Scale/Scope**: tientallen organisaties, tientallen cursussen per organisatie, tot enkele
tientallen onderdelen per cursus; 6 nieuwe API-routes ([contracts/api.md](contracts/api.md)); 2
gewijzigde schermen en een gewijzigde editor ([contracts/ui.md](contracts/ui.md))

Er zijn geen open NEEDS CLARIFICATION-punten; alle keuzes staan in [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Toets | Status |
| --- | --- | --- |
| I. Vaste technologiestack | Vue 3, Express 5 (ES modules), MariaDB 11.8; geen nieuwe dependencies | ✅ |
| II. Docker op één VPS | Geen nieuwe services of instellingen; alleen migraties | ✅ |
| III. Video's via nginx, API alleen voor toegangscontrole | Cursussen verwijzen alleen naar `Video.id`. De thumbnail van een video-onderdeel gaat via een nieuwe cursusroute die alleen de toegang controleert en het bestand via `sendStoredFile` (`X-Accel-Redirect`) laat bezorgen (R5a). Er worden geen videobytes verstuurd | ✅ |
| IV. Geen geheimen in git | Geen nieuwe geheimen of `.env`-variabelen | ✅ |
| V. Zachte verwijdering | Cursussen krijgen `deletedAt`; standaardqueries sluiten ze uit (R2). Onderdelen en antwoorden hebben geen `deletedAt` in het ERD en worden in een concept echt verwijderd (R7). Een onderdeel houdt zijn verwijzing naar een verwijderde video en toont naam, duur en thumbnail (FR-016, R5a); de bestanden van zacht verwijderde video's blijven bestaan | ✅ |
| VI. Taalconventies (v2.0.0) | Tabellen, velden, routes, foutcodes en commentaar Engels; UI-teksten en `message` Nederlands; documentatie Nederlands | ✅ |
| Bronnen en domeinregels | Tabellen volgen het ERD letterlijk; geen veld voor "einde" (Clarifications). Afwijkingen: geen. Een CHECK-constraint en indexen zijn fysieke details, geen ERD-wijziging | ✅ |
| Ontwikkelworkflow | specify → clarify → plan; werk op `Development` | ✅ |

**Na Phase 1 opnieuw getoetst**: geen schendingen. `CourseStep.description` en
`nextCourseStepId` / `Answer.nextCourseStepId` worden aangemaakt maar blijven NULL; dat volgt het
ERD en de spec (FR-017, FR-019).

**Opnieuw getoetst na de wijziging voor onbeschikbare video's (2026-10-26)**: geen schendingen.
De nieuwe thumbnailroute controleert alleen toegang en laat nginx het bestand leveren (III); de
bibliotheekregel blijft ongewijzigd; er komen geen tabellen of velden bij.

## Project Structure

### Documentation (this feature)

```text
specs/004-course-steps-draft/
├── plan.md              # Dit bestand
├── research.md          # Phase 0: technische keuzes
├── data-model.md        # Phase 1: tabellen, regels, opslaan
├── quickstart.md        # Phase 1: validatiegids
├── contracts/
│   ├── api.md           # Phase 1: cursusroutes
│   └── ui.md            # Phase 1: cursuslijst en editor
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Alleen wat nieuw is of verandert:

```text
backend/
├── scripts/
│   └── seed-courses.js               # 50 cursussen × 50 onderdelen voor SC-007 (R11)
├── src/
│   ├── app.js                        # + courseRoutes; JSON-limiet 1 MB voor PUT /courses/:id (R8)
│   ├── db/migrations/
│   │   ├── 20261026000001_create_course.js
│   │   ├── 20261026000002_create_organisation_course.js
│   │   ├── 20261026000003_create_course_version.js
│   │   ├── 20261026000004_create_course_step.js
│   │   └── 20261026000005_create_answer.js
│   ├── lib/
│   │   └── courseDraft.js            # controle van het concept-document (R4)
│   └── modules/
│       └── courses/
│           ├── courseRepository.js   # ownCoursesQuery (R2), lijst, laden, opslaan, verwijderen
│           ├── courseService.js      # aanmaken, opslaan in één transactie (R3), videocontrole (R5)
│           └── courseRoutes.js       # GET/POST /courses, GET/PUT/DELETE /courses/:id,
│                                     #   GET /courses/:id/steps/:stepId/videos/:videoId/thumbnail (R5a)
└── tests/
    ├── unit/courseDraft.test.js
    └── integration/
        ├── courseCrud.test.js
        ├── courseIsolation.test.js   # SC-003
        ├── courseSave.test.js        # SC-002, SC-004
        ├── courseVideos.test.js      # SC-005
        └── courseUnavailableVideo.test.js  # SC-005a, FR-016, FR-016a: blijft staan, niet kiesbaar,
                                            #   thumbnailroute 200 voor eigen, 404 voor anderen

frontend/
├── src/
│   ├── api/courses.js                # nieuw
│   ├── lib/
│   │   ├── courseMapping.js          # API-document ↔ editormodel (R9)
│   │   ├── course.js                 # zonder koppelingen, titel en publicatiestatus
│   │   ├── history.js                # snap volgens nieuw model; id's vervangen na opslaan (R10);
│   │   │                             #   transform bij undo/redo voor FR-020d (R5b)
│   │   ├── publishing.js             # verwijderd
│   │   └── validate.js               # verwijderd
│   ├── data/seed.js                  # verwijderd
│   ├── stores/app.js                 # verwijderd; editorVariant → lib/editorPreference.js
│   ├── editor/
│   │   ├── CourseEditor.vue          # nieuw: de editor op de geladen kopie (balk, opslaan, vertrekvraag)
│   │   ├── context.js                # werkt op lokale kopie; opslaan, dirty, geen connect/disconnect;
│   │   │                             #   savedVideos en lostVideoNotices (FR-020d);
│   │   │                             #   stepVideos-kaart en confirmLosingVideo (R5b)
│   │   ├── CanvasEditor.vue          # geen randen of verbindingshandles
│   │   ├── NodeEditForm.vue          # geen Titel, Daarna of koppeling per antwoord; feedback bij vraag;
│   │   │                             #   "Video weghalen" (FR-020c)
│   │   ├── VideoNode.vue / QuestionNode.vue  # geen handles; "Kies een video"; video uit stepVideos
│   │   ├── VideoPicker.vue           # bibliotheek via api/videos.js (eigen + beschikbaar); waarschuwing
│   │   │                             #   vóór vervangen van een onbeschikbare video (FR-020b)
│   │   ├── OverviewList.vue          # platte lijst (R9)
│   │   ├── CourseEdge.vue            # verwijderd
│   │   └── RouteTree.vue             # verwijderd
│   └── views/
│       ├── CoursesView.vue           # API in plaats van store; status altijd "Concept"
│       └── EditorView.vue            # laden, Opslaan als concept, vertrekvraag; geen publiceren/te doen
└── tests/
    ├── course-mapping.test.js
    ├── unavailable-video-warning.test.js
    ├── question-node.test.js
    ├── course-dirty.test.js
    └── courses-view.test.js
```

**Structure Decision**: dezelfde webapplicatie-opzet als features 001–003. Cursussen krijgen een
eigen backendmodule `courses` naast `videos`; de enige koppeling is dat `courseService` voor de
videocontrole `visibleVideosQuery` uit de videomodule gebruikt.

## Complexity Tracking

Geen schendingen. De uitzondering uit feature 002 (in ontwikkeling en tests stuurt de API
thumbnailbytes zelf) blijft ongewijzigd van toepassing.
