# Data model: Cursussen en onderdelen (concept)

Bron: ERD `docs/Diagrams.simp`. Alle vijf tabellen zijn nieuw en volgen het ERD veld voor veld;
het ERD verandert niet. Tijden zijn UTC (`UTC_TIMESTAMP()`), zoals bij `Video`.

## Tabellen

### Course

| Veld | Type | Null | Gebruik in deze feature |
| --- | --- | --- | --- |
| `id` | INT, PK, auto | nee | |
| `parentCourseId` | INT, FK → `Course.id` | ja | altijd NULL (FR-12) |
| `isSharedInLibrary` | BOOLEAN | nee | altijd false (FR-12) |
| `createdAt` | DATETIME | nee | bij aanmaken |
| `updatedAt` | DATETIME | nee | bij aanmaken, opslaan en verwijderen; sortering van de lijst |
| `deletedAt` | DATETIME | ja | NULL = actief; gezet = zacht verwijderd (constitution V) |

Index: (`deletedAt`, `updatedAt`).

### OrganisationCourse

| Veld | Type | Null | Gebruik |
| --- | --- | --- | --- |
| `organisationId` | INT, FK → `Organisation.id` | nee | uit de sessie |
| `courseId` | INT, FK → `Course.id` | nee | |
| `isOwner` | BOOLEAN | nee | altijd true in deze feature |
| `addedAt` | DATETIME | nee | bij aanmaken |

PK (`organisationId`, `courseId`); index (`courseId`).

### CourseVersion

| Veld | Type | Null | Gebruik |
| --- | --- | --- | --- |
| `id` | INT, PK, auto | nee | |
| `courseId` | INT, FK → `Course.id` | nee | |
| `versionNumber` | INT | nee | 1 voor het concept in deze feature |
| `name` | VARCHAR(255) | nee | verplicht, getrimd, max. 255 tekens |
| `description` | TEXT | nee | verplicht, getrimd, max. 1000 tekens |
| `publishedAt` | DATETIME | ja | NULL = concept (open versie); altijd NULL in deze feature |

Uniek (`courseId`, `versionNumber`). Elke cursus heeft in deze feature precies één versie: het
concept. Het concept vinden = versie van de cursus met `publishedAt IS NULL`.

### CourseStep

| Veld | Type | Null | Gebruik |
| --- | --- | --- | --- |
| `id` | INT, PK, auto | nee | |
| `courseVersionId` | INT, FK → `CourseVersion.id` | nee | |
| `isStart` | BOOLEAN | nee | hoogstens één true per versie |
| `stepType` | ENUM('video','question') | nee | vast vanaf het aanmaken |
| `description` | TEXT | ja | altijd NULL (FR-017) |
| `feedback` | TEXT | ja | alleen bij `question`; max. 1000 tekens; leeg = NULL |
| `videoId` | INT, FK → `Video.id` | ja | alleen bij `video`; NULL = nog geen video gekozen |
| `questionText` | TEXT | ja | alleen bij `question`; max. 1000 tekens; mag leeg zijn |
| `nextCourseStepId` | INT, FK → `CourseStep.id`, ON DELETE SET NULL | ja | altijd NULL (FR-08) |
| `positionX` | INT | nee | plaats op het canvas |
| `positionY` | INT | nee | plaats op het canvas |

Index (`courseVersionId`), index (`videoId`).

CHECK (vangnet voor FR-012/FR-013, research R4):
`(stepType = 'video' AND questionText IS NULL AND feedback IS NULL) OR (stepType = 'question' AND videoId IS NULL)`.

Een vraag-onderdeel met een lege vraag bewaart `questionText` als lege tekst `''`, niet als NULL,
zodat "vraag-onderdeel" en "heeft een vraagveld" altijd samengaan.

### Answer

| Veld | Type | Null | Gebruik |
| --- | --- | --- | --- |
| `id` | INT, PK, auto | nee | |
| `courseStepId` | INT, FK → `CourseStep.id` | nee | alleen naar een `question`-onderdeel |
| `answerText` | VARCHAR(255) | nee | max. 255 tekens; nog niet ingevuld = `''` |
| `isCorrect` | BOOLEAN | nee | precies één true per onderdeel |
| `sortOrder` | TINYINT | nee | 0–3, de volgorde A–D in de editor |
| `nextCourseStepId` | INT, FK → `CourseStep.id`, ON DELETE SET NULL | ja | altijd NULL (FR-08) |

Index (`courseStepId`, `sortOrder`).

## Regels (gecontroleerd in `courseDraft.js`, research R4)

1. Een vraag-onderdeel heeft 2–4 antwoorden, precies één met `isCorrect`; `sortOrder` volgt de
   volgorde in het verzoek (0, 1, 2, 3).
2. Een video-onderdeel heeft geen antwoorden, geen vraag en geen feedback.
3. `stepType` van een bestaand onderdeel verandert niet.
4. Hoogstens één onderdeel per versie heeft `isStart`.
5. `videoId` is zichtbaar voor de organisatie (`visibleVideosQuery`, specs/003), of gelijk aan de
   opgeslagen `videoId` van hetzelfde onderdeel (FR-016).
6. Teksten worden getrimd aan begin en eind (naam en beschrijving van de cursus) of alleen
   genormaliseerd naar `\n`-regeleinden (vraag, antwoord, feedback); lengtes in Unicode-codepunten.
7. Hoogstens 200 onderdelen per concept.

## Video van een onderdeel (research R5, R5a)

- **Kiezen** (bij opslaan): een `videoId` moet in `visibleVideosQuery(organisationId)` zitten,
  tenzij hetzelfde onderdeel die `videoId` al opgeslagen had. De bibliotheekregel zelf verandert
  niet.
- **Tonen** (bij openen): `CourseStep.videoId` → `Video` zonder filter op `deletedAt` of
  zichtbaarheid, alleen voor onderdelen van een eigen cursus. Alleen `id`, `name`,
  `durationSeconds` en de thumbnail worden gebruikt; `available` = zit in de bibliotheekregel.
- **Thumbnail**: eigen cursus (R2) → open versie → `CourseStep` met dat id, `stepType = 'video'`
  en `videoId` gelijk aan de video in de URL → `Video.thumbnailStorageKey` niet NULL. Anders `404`.

| Toestand van de video voor de organisatie | In bibliotheek/kiezer | In onderdeel getoond | Opnieuw kiesbaar | Waarschuwing bij weghalen |
| --- | --- | --- | --- | --- |
| zichtbaar (eigen, algemeen, selectief met toegang) | ja | ja, `available: true` | ja | nee |
| beperkt (geen toegang meer) | nee | ja, `available: false` | nee | ja |
| zacht verwijderd door eigenaar, of eigenaar verwijderd | nee | ja, `available: false` | nee | ja |

## Zichtbaarheid (research R2)

Een organisatie ziet een cursus als:
`OrganisationCourse.organisationId = <sessie>` AND `isOwner = true` AND `Course.deletedAt IS NULL`.
Alle cursusroutes starten bij die query; anders `404 not_found`.

## Levenscyclus

```text
(niet bestaand) --POST /courses--> concept met één start-video-onderdeel zonder video (FR-001a)
concept --PUT /courses/:id--> concept (zelfde versie, nieuwe inhoud)
concept --DELETE /courses/:id--> zacht verwijderd (deletedAt gezet; niet meer zichtbaar of te openen)
```

Publiceren (FR-09) en nieuwe versies (FR-11) vallen buiten deze feature.

## Opslaan van een concept (research R3)

In één transactie, na controle van het hele document:

1. `CourseVersion.name/description` bijwerken; `Course.updatedAt` = nu.
2. Voor elk onderdeel in het verzoek: met `id` → bijwerken (id moet bij deze versie horen en
   dezelfde `stepType` hebben); zonder `id` → invoegen.
3. Onderdelen van de versie die niet in het verzoek staan → eerst hun antwoorden, dan het
   onderdeel verwijderen.
4. Per vraag-onderdeel dezelfde aanpak voor antwoorden (bijwerken / invoegen / verwijderen wat
   ontbreekt); `sortOrder` opnieuw zetten.
5. Het opgeslagen concept teruggeven met alle id's.

Laatste opslag wint: er is geen controle op tussentijdse wijzigingen (Clarifications).
