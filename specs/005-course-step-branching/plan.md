# Implementation Plan: Volgorde en vertakkingen van onderdelen, met controle op volledigheid

**Branch**: `Development` (feature `005-course-step-branching`) | **Date**: 2026-10-26 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/005-course-step-branching/spec.md`

## Summary

De docent verbindt onderdelen tot een route: een video-onderdeel heeft één vervolg, elk antwoord
van een vraag een eigen vervolg; lussen mogen. Het einde volgt uit de route. De editor toont de
route als pijlen, maakt met één klik een verbonden nieuw onderdeel, en controleert live of de
cursus af is (oranje meldingen, rood na een klik op opslaan). Opslaan blijft altijd mogelijk.

Technisch: geen nieuwe tabellen; de bestaande velden `CourseStep.nextCourseStepId` en
`Answer.nextCourseStepId` worden gevuld. Het opslaan-verzoek krijgt per onderdeel een `key`, en
verbindingen verwijzen naar sleutels, zodat nieuwe onderdelen in dezelfde opslag verbonden kunnen
worden; de server lost ze op in dezelfde transactie. De controle is één pure functie in de
frontend. De verbindingen in de editor komen terug uit het prototype (git `1914a00`). Een nieuwe
cursus begint met een vertakkend voorbeeld. Zie [research.md](research.md).

## Technical Context

**Language/Version**: JavaScript (ES modules), Node.js 22 LTS; Vue 3 (bestaande stack)

**Primary Dependencies**: backend: Express 5, Knex + mysql2; frontend: Vue 3, Vite, Vue Router,
Pinia, `@vue-flow/core` (+ background, minimap), `@dagrejs/dagre`. Geen nieuwe dependencies.

**Storage**: MariaDB 11.8; geen schemawijziging: `CourseStep.nextCourseStepId` en
`Answer.nextCourseStepId` bestaan al (feature 004, ON DELETE SET NULL)

**Testing**: Vitest + Supertest tegen een echte MariaDB-testdatabase (backend), Vitest + Vue
Test Utils (frontend)

**Target Platform**: Linux-VPS met Docker Compose; moderne desktopbrowsers

**Project Type**: webapplicatie (frontend + backend)

**Performance Goals**: controle na een wijziging binnen 0,2 s bij 50 onderdelen (SC-004; de
functie zelf < 1 ms); opslaan en openen blijven zoals feature 004 (SC-007 daar)

**Constraints**: opslaan blijft alles of niets en nooit tegengehouden door de controle (FR-009);
verbindingen alleen binnen hetzelfde concept (FR-008); id's stabiel (FR-007)

**Scale/Scope**: tot enkele tientallen onderdelen per cursus; 0 nieuwe en 2 gewijzigde
API-routes ([contracts/api.md](contracts/api.md)); de editor ([contracts/ui.md](contracts/ui.md))

Er zijn geen open NEEDS CLARIFICATION-punten; alle keuzes staan in [research.md](research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principe | Toets | Status |
| --- | --- | --- |
| I. Vaste technologiestack | Vue 3, Express 5, MariaDB 11.8; geen nieuwe dependencies (vue-flow en dagre zaten al in het prototype) | ✅ |
| II. Docker op één VPS | Geen nieuwe services of instellingen | ✅ |
| III. Video's via nginx | Niet geraakt; thumbnails blijven via de cursusroute van feature 004 | ✅ |
| IV. Geen geheimen in git | Geen nieuwe geheimen | ✅ |
| V. Zachte verwijdering | Cursussen blijven zacht verwijderd; onderdelen in een concept worden echt verwijderd (feature 004 R7) en hun inkomende verbindingen worden leeg (FR-006). Een onbeschikbare video wordt gemeld, omdat bij publiceren een vervanger nodig is | ✅ |
| VI. Taalconventies | Code, routes, velden (`key`, `nextStepKey`, `nextStepId`), meldingcodes Engels; meldingteksten en UI Nederlands | ✅ |
| Bronnen en domeinregels | Volgt het ERD; geen nieuwe velden. `key`/`nextStepKey` bestaan alleen in het verzoek, niet in de database | ✅ |
| Ontwikkelworkflow | specify → clarify → plan; werk op `Development` | ✅ |

**Na Phase 1 opnieuw getoetst**: geen schendingen.

## Project Structure

### Documentation (this feature)

```text
specs/005-course-step-branching/
├── plan.md              # Dit bestand
├── research.md          # Phase 0
├── data-model.md        # Phase 1: verbindingen, afgeleide route, meldingen
├── quickstart.md        # Phase 1: validatiegids
├── contracts/
│   ├── api.md           # Phase 1: gewijzigd concept-document en opslaan
│   └── ui.md            # Phase 1: canvas, menu, meldingen, lijst
└── tasks.md             # Phase 2 (/speckit-tasks)
```

### Source Code (repository root)

Alleen wat nieuw is of verandert ten opzichte van feature 004:

```text
backend/
├── src/
│   ├── lib/courseDraft.js                 # + key, nextStepKey en hun regels (R2)
│   └── modules/courses/
│       ├── courseRepository.js            # insertCourse met voorbeeld (R3); verbindingen zetten
│       └── courseService.js               # saveDraft: sleutels oplossen (R1); getDraft: nextStepId
└── tests/
    ├── unit/courseDraft.test.js           # + regels R2
    └── integration/
        ├── courseConnections.test.js      # nieuw (R8)
        ├── courseCrud.test.js             # voorbeeld van FR-028
        └── (bestaande cursustests)        # payloads krijgen een key

frontend/
├── src/
│   ├── lib/
│   │   ├── course.js                      # verbindingen terug (R6), isEnd, invoegen met goed antwoord
│   │   ├── completeness.js                # nieuw: de controle (R4)
│   │   └── courseMapping.js               # nextStepId ↔ next/target; key/nextStepKey
│   ├── editor/
│   │   ├── context.js                     # connect/disconnect/addLinked, issues, flaggedIssueIds (R5)
│   │   ├── CourseEditor.vue               # "n nog te doen" / "Cursus is compleet" met lijst
│   │   ├── CanvasEditor.vue               # randen, handles, één-klik-menu (R6)
│   │   ├── CourseEdge.vue                 # terug uit het prototype
│   │   ├── RouteTree.vue                  # terug uit het prototype
│   │   ├── OverviewList.vue               # route-overzicht met "Niet bereikbaar"
│   │   ├── ConnectMenu.vue                # nieuw: menu bij een verbindingspunt
│   │   ├── StepBadges.vue                 # nieuw: Start/Einde/← n en de stip per blok
│   │   ├── CompletenessStatus.vue         # nieuw: "n nog te doen" / "Cursus is compleet"
│   │   ├── VideoNode.vue / QuestionNode.vue  # handles, Start/Einde/← n, stip
│   │   └── NodeEditForm.vue               # "Daarna" en "Gaat naar…"
└── tests/
    ├── completeness.test.js
    ├── course-connections.test.js
    ├── issue-colours.test.js
    ├── node-badges.test.js
    ├── route-overview.test.js
    └── course-mapping.test.js             # + verbindingen
```

**Structure Decision**: dezelfde opzet als feature 004. Het menu bij een verbindingspunt wordt een
eigen component (`ConnectMenu.vue`), omdat het nu ook bestaande onderdelen en "Verbinding
weghalen" toont en vanuit klik én slepen opent.

## Complexity Tracking

Geen schendingen.
