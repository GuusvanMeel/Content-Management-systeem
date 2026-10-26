# Research: Cursussen en onderdelen (concept)

Technische keuzes voor [spec.md](spec.md). Elke keuze: besluit, motivatie, overwogen
alternatieven. Er waren geen open NEEDS CLARIFICATION-punten in de Technical Context; dit document
legt de ontwerpkeuzes vast.

## R1. Cursus, eigenaar en concept in de database

**Besluit**: Een nieuwe cursus is in één transactie drie regels: `Course` (met `createdAt`,
`updatedAt`, `deletedAt` NULL, `parentCourseId` NULL, `isSharedInLibrary` false),
`OrganisationCourse` (`isOwner` true, `addedAt` nu) en `CourseVersion` met `versionNumber` 1 en
`publishedAt` NULL. Die open versie is het concept; naam en beschrijving staan daarin. Onderdelen
(`CourseStep`) horen bij de versie, niet bij de cursus. In dezelfde transactie krijgt het concept
één `CourseStep` van soort `video` met `videoId` NULL en `isStart` true op (0, 0), zodat de editor
niet leeg opent (FR-001a).

**Motivatie**: Volgt het ERD letterlijk (constitution, "Bronnen en domeinregels"). Door het
concept nu al als versie op te slaan, hoeven publiceren (FR-09) en versies (FR-11) later alleen
`publishedAt` te zetten en een nieuwe open versie te maken; er hoeft niets te verhuizen.

**Alternatieven**: Naam en beschrijving op `Course` zetten: wijkt af van het ERD. Een
`organisationId` op `Course`: staat niet in het ERD; eigendom loopt via `OrganisationCourse`.

## R2. Welke cursussen een organisatie ziet

**Besluit**: Eén repositoryfunctie `ownCoursesQuery(organisationId)` is de enige definitie:
`Course` join `OrganisationCourse` met `organisationId` uit de sessie en `isOwner = true`,
`Course.deletedAt IS NULL`, plus de open versie (`publishedAt IS NULL`). Lijst, openen, opslaan
en verwijderen gebruiken die allemaal; wat er niet uit komt is `404 not_found`, ook als het een
cursus van een andere organisatie is (FR-003). Het organisatie-id komt altijd uit
`getOrganisationId(req)`, net als bij video's.

**Motivatie**: Dezelfde opzet als `visibleVideosQuery` (specs/003 R1): één plek om te
controleren, en een isolatietest die voor alle routes geldt. `isOwner` wordt nu al gecontroleerd,
zodat gedeelde cursussen (FR-12) later niet per ongeluk bewerkbaar worden.

**Alternatieven**: Per route een eigen controle: meer kans op een vergeten controle.

## R3. Opslaan als één document (Opslaan als concept)

**Besluit**: De editor stuurt bij "Opslaan als concept" het hele concept in één verzoek:
`PUT /api/organisation/courses/:id` met naam, beschrijving en alle onderdelen met hun antwoorden.
De server controleert alles en schrijft het in één transactie weg:

- onderdelen met een `id` die bij dit concept hoort, worden bijgewerkt;
- onderdelen zonder `id` worden aangemaakt;
- onderdelen van het concept die niet in het verzoek staan, worden verwijderd (met hun antwoorden);
- voor antwoorden binnen een onderdeel geldt dezelfde regel;
- `Course.updatedAt` wordt de huidige tijd.

Het antwoord is het opgeslagen concept met alle (nieuwe) id's. Een `id` die niet bij dit concept
hoort, of een `id` van een onderdeel met een andere soort, geeft `400 validation_failed`.

**Motivatie**: Past bij FR-009 (alles of niets) en bij ongedaan maken in de editor: de editor
werkt op een lokale kopie en stuurt de eindtoestand. Opnieuw proberen na een verloren antwoord
maakt niets dubbel: de nieuwe onderdelen van de eerste poging staan niet in het tweede verzoek
(de editor kent hun id's niet) en worden dus verwijderd, en het tweede verzoek maakt ze opnieuw
aan. De inhoud is daarna precies wat de docent ziet (edge case "Opslaan mislukt"). Laatste opslag
wint (Clarifications): er is geen versie- of tijdstempelcontrole.

**Alternatieven**: Per wijziging een los verzoek (POST/PATCH/DELETE per onderdeel): past niet bij
één knop "Opslaan als concept", niet in één transactie, en lastig met ongedaan maken. Alles
verwijderen en opnieuw invoegen: verandert bij elke opslag alle id's, wat FR-08 (koppelingen via
`nextCourseStepId`) later breekt.

## R4. Regels voor een onderdeel

**Besluit**: Eén module `backend/src/lib/courseDraft.js` controleert het hele document voordat er
iets wordt geschreven en geeft per veld een Nederlandse melding:

| Regel | Bron |
| --- | --- |
| naam en beschrijving verplicht, getrimd, max. 255 / 1000 tekens | FR-001, FR-005, FR-026 |
| `stepType` is `video` of `question`; bij een bestaand onderdeel gelijk aan de opgeslagen soort | FR-011 |
| video-onderdeel: `questionText`, `feedback` en `answers` leeg of afwezig; `videoId` null of een id | FR-012, FR-017 |
| vraag-onderdeel: `videoId` null; 2–4 antwoorden; precies één `isCorrect`; vraag max. 1000, feedback max. 1000, antwoord max. 255 tekens; lege teksten mogen | FR-013, FR-026 |
| hoogstens één onderdeel met `isStart` | FR-018 |
| hoogstens 200 onderdelen per concept | grens tegen te grote verzoeken |
| `positionX`/`positionY` gehele getallen binnen ±1 000 000 | FR-021 |

Tekens tellen in Unicode-codepunten, zoals in feature 003 (`characterCount`). `description` en
`nextCourseStepId` worden niet gelezen uit het verzoek en blijven NULL (FR-017, FR-019).

**Motivatie**: Dezelfde aanpak als `videoChoices.js` (specs/003 R5): pure functies, goed
unit-testbaar, en de server is de laatste controle (FR-013a, SC-004).

**Alternatieven**: Database-CHECK-constraints op `stepType`/`videoId`/`questionText`: mogelijk in
MariaDB, maar de meeste regels (aantal antwoorden, één goed antwoord, één start) gaan over
meerdere regels en moeten toch in de applicatie. Een CHECK op `CourseStep`
(`stepType = 'video'` ⇒ `questionText IS NULL AND feedback IS NULL`; `stepType = 'question'` ⇒
`videoId IS NULL`) komt er wel bij als vangnet.

## R5. Welke video mag in een onderdeel

**Besluit**: Bij opslaan worden alle `videoId`'s in het verzoek in één query tegen
`visibleVideosQuery(organisationId)` (specs/003) gecontroleerd. Een id die niet zichtbaar is, wordt
alleen geaccepteerd als hetzelfde onderdeel die video al had (FR-016: de verwijzing blijft staan
als de video later onbeschikbaar wordt). Anders `400 validation_failed` met "Kies een video uit de
bibliotheek." bij dat onderdeel.

Die controle is ook de enige plek waar "niet opnieuw kiezen" (FR-016) wordt afgedwongen: een
onbeschikbare video kan niet in een nieuw onderdeel of een ander bestaand onderdeel terechtkomen.
Een onderdeel dat na een opgeslagen verwijdering met ongedaan maken terugkomt, heeft geen
geldig id meer (R10) en telt dus als nieuw: geweigerd, zoals de spec zegt.

**Motivatie**: Hergebruikt de enige definitie van zichtbaarheid; geen tweede regel die uit de pas
kan lopen (SC-005). De bibliotheekregels blijven ongewijzigd (FR-014).

**Alternatieven**: Onbeschikbare video's bij openen automatisch uit het onderdeel halen: in strijd
met FR-016 en met constitution V (verwijzingen blijven).

## R5a. Video's van een onderdeel tonen, ook als ze onbeschikbaar zijn

**Besluit**: Het concept-document geeft bij elk video-onderdeel met een video
`video: { id, name, durationSeconds, thumbnailUrl, available }`, altijd met naam, duur en
thumbnail, ook voor een onbeschikbare of verwijderde video. De gegevens komen uit een directe
join `CourseStep → Video` (zonder `deletedAt`- of zichtbaarheidsfilter), dus alleen voor video's
die in een onderdeel van een eigen cursus staan. `available` = de video zit in
`visibleVideosQuery(organisationId)` (één extra query met alle video-id's van het concept).
Verder wordt niets van de video meegegeven: geen eigenaar, beschrijving, beschikbaarheid of
bestandsgegevens.

De thumbnail van elk video-onderdeel loopt via een cursusroute:
`GET /api/organisation/courses/:courseId/steps/:stepId/videos/:videoId/thumbnail`. De route zoekt het
onderdeel via `ownCoursesQuery` (R2) → open versie → onderdeel met dat id, `stepType = 'video'`
en precies die `videoId`, en stuurt dan `Video.thumbnailStorageKey` via `sendStoredFile`
(`X-Accel-Redirect`, constitution III). Alles daarbuiten is `404 not_found`: andere organisatie,
verwijderde cursus, onbekend of verwijderd onderdeel, vraag-onderdeel, onderdeel zonder video,
video zonder thumbnail. De bibliotheekroute `/videos/:id/thumbnail` blijft precies zoals hij is.

De `videoId` staat in het pad omdat de route gecachet mag worden (`private, max-age=3600`): met
alleen het onderdeel-id bleef na het vervangen van de video de oude thumbnail uit de cache in
beeld (bevinding 2 van de handmatige test). Met de video in het pad hoort bij elke video een
eigen URL; `no-cache` was het alternatief, maar dan haalt de editor bij elk openen alle
thumbnails opnieuw op.

De route geldt voor álle video-onderdelen, beschikbaar of niet, zodat de editor één regel heeft.
Een net gekozen, nog niet opgeslagen video heeft nog geen onderdeel-id; de editor toont dan de
`thumbnailUrl` uit de bibliotheeklijst. Na opslaan komt de cursusroute uit het antwoord.

**Motivatie**: De bibliotheekregel (specs/003 R1) blijft de enige regel voor "welke video's mag
je zien en kiezen"; de uitzondering voor gebruikte video's zit in de cursus, waar hij hoort, en
lekt alleen naam, thumbnail en duur, en alleen via een eigen cursus (FR-016a). De
soft-deleted video's houden hun bestanden (constitution V), dus de thumbnail is er nog.

**Alternatieven**:
- De bibliotheekroute verruimen met "of de video staat in een eigen cursus": door de gebruiker
  uitgesloten, en maakt de bibliotheekregel ingewikkelder.
- Een route `/courses/:id/videos/:videoId/thumbnail`: werkt ook, maar laat een organisatie met
  een videoId gokken binnen haar eigen cursus; via het onderdeel-id is de koppeling ondubbelzinnig.
- Naam en thumbnail weglaten voor onbeschikbare video's (het eerdere plan): vervangen door deze
  wijziging.

## R5b. Waarschuwing bij weghalen van een onbeschikbare video

**Besluit**: De editor houdt een kaart `stepVideos` (videoId → `{ name, durationSeconds,
thumbnailUrl, available }`), gevuld uit het concept-document en aangevuld met video's die de
docent uit de bibliotheek kiest (altijd `available: true`). Een video "kan niet meer gekozen
worden" als `stepVideos[videoId].available === false`. Voor die video's vraagt de editor
`confirmDialog` (FR-020b) vóór drie acties: onderdeel verwijderen, video weghalen, andere video
kiezen. Bij annuleren gebeurt er niets (de kiezer gaat dicht zonder wijziging). Bij doorgaan
loopt de actie zoals altijd, dus ongedaan maken werkt vanzelf (de geschiedenis bewaart de
`videoId`; de kaart verandert niet). Voor beschikbare video's verandert niets (geen vraag).

**Motivatie**: Eén hulpfunctie `confirmLosingVideo(node)` in `editor/context.js`, gebruikt door
`removeNode`, de kiezer en "Video weghalen"; de kaart hoort niet in de geschiedenis, zodat
ongedaan maken en de vergelijking "niet-opgeslagen wijzigingen" alleen over de inhoud gaan.

**Alternatieven**: De beschikbaarheid in het knooppunt zelf opslaan: komt dan in de geschiedenis
en in de vergelijking terecht, wat niets toevoegt.

**Ongedaan maken na een opgeslagen weghaling (FR-020d, bevinding 3 van de handmatige test)**: de
editor houdt naast `savedKeys` ook `savedVideos` bij: opgeslagen onderdeel-sleutel → `videoId`
uit het laatst opgeslagen document. `useCourseHistory` krijgt een `transform` die bij ongedaan
maken en opnieuw de stap opschoont vóór hij wordt toegepast: elk video-onderdeel met een video
waarvoor `stepVideos[videoId].available === false` en waarvoor `savedVideos.get(node.id) !==
node.videoId`, krijgt `videoId: null`, en zijn sleutel komt in de (niet-opgeslagen, niet in de
geschiedenis) set `lostVideoNotices`. De opgeschoonde stap vervangt die stap in de geschiedenis,
zodat er geen extra stap bijkomt en opnieuw blijft werken. `VideoNode.vue` en `NodeEditForm.vue`
tonen bij een sleutel in die set "Deze video is niet meer beschikbaar en kan niet worden teruggezet."; kiezen van een video haalt de sleutel uit de set.
De server houdt zijn regel (R5) als vangnet; de editor stuurt zo'n video alleen nooit meer mee.
Eerder plan (vervangen): de volgende opslag liet de server weigeren met "Kies een video uit de
bibliotheek.", wat voor de docent onduidelijk was.

## R6. Cursuslijst

**Besluit**: `GET /api/organisation/courses` geeft per cursus `id`, `name`, `updatedAt`,
`videoStepCount`, `questionStepCount` en `status: "draft"`, nieuwste `updatedAt` eerst, in één
query (aantallen via `COUNT(CASE …)` op `CourseStep` van de open versie). Geen paginering: tot 50
cursussen binnen 2 s (SC-007) is met één query ruim haalbaar.

**Alternatieven**: Aantallen in de browser tellen door alle concepten op te halen: veel te veel
data voor een lijst.

## R7. Verwijderen

**Besluit**: `DELETE /api/organisation/courses/:id` zet `Course.deletedAt` (en `updatedAt`). De
versie, onderdelen, antwoorden en `OrganisationCourse` blijven staan. Onderdelen verwijderen in
het concept (R3) is wél echt verwijderen: `CourseStep` en `Answer` hebben geen `deletedAt` in het
ERD, en constitution V gaat over video's en cursussen.

## R8. Groter verzoek voor opslaan

**Besluit**: `PUT /api/organisation/courses/:id` krijgt een eigen JSON-limiet van 1 MB (een
`express.json({ limit: '1mb' })` die vóór de algemene parser van 100 kB op dat pad staat). nginx
staat voor `/api` al op 3 MB.

**Motivatie**: 200 onderdelen met maximale teksten in meerbyte-tekens passen niet in 100 kB; de
rest van de API houdt de kleine limiet.

## R9. Frontend: van prototype naar echte gegevens

**Besluit**:

- `stores/app.js`, `data/seed.js`, `lib/publishing.js` en `lib/validate.js` verdwijnen. De
  gekozen editorweergave (`editorVariant`) blijft per browser bewaard in `localStorage` (alleen
  een voorkeur, wrapped in try/catch).
- Nieuw: `api/courses.js` (lijst, aanmaken, openen, opslaan, verwijderen) en
  `lib/courseMapping.js`, dat het API-document omzet naar het bestaande editormodel en terug:
  `isStart` ↔ `course.startId`, `positionX/Y` ↔ `x/y`, `questionText` ↔ `question`, `answerText`
  ↔ `text`, `isCorrect` ↔ `correct`. Nieuwe onderdelen en antwoorden krijgen in de editor een
  tijdelijke sleutel (`uid()`); alleen id's die in de laatst opgeslagen toestand voorkomen, gaan
  mee in het verzoek (R10). De `video`-gegevens uit het document gaan niet in het knooppunt maar
  in de kaart `stepVideos` (R5b).
- `lib/course.js` verliest wat met koppelingen te maken heeft (`next`, `target`, `connect`,
  `disconnect`, `addLinkedNode`, `outgoing`, `incoming`, `isEnd`, `contentSnapshot`,
  `courseStatus`) en `title`/`description` op een onderdeel (FR-017). Een nieuw
  video-onderdeel en een nieuwe vraag krijgen geen `next`/`target` meer; een nieuwe cursus begint
  zonder onderdelen.
- Volgorde in de weergave "Lijst" (geen route meer): het startonderdeel eerst, daarna van boven
  naar beneden en van links naar rechts op het canvas. `RouteTree.vue` en `CourseEdge.vue`
  verdwijnen.
- "Canvas ordenen" (dagre) blijft; zonder randen zet dagre de blokken naast elkaar in één rij.
  Om ze onder elkaar te zetten (Assumptions) ordent de editor zonder dagre: in de lijstvolgorde,
  in één kolom.

**Motivatie**: De editorcomponenten blijven zo veel mogelijk gelijk (FR-022); de omzetting zit op
één plek en is unit-testbaar.

**Alternatieven**: Het editormodel ombouwen naar de API-vorm: raakt alle editorcomponenten zonder
voordeel voor de docent.

## R10. Niet-opgeslagen wijzigingen en ongedaan maken

**Besluit**: De editor houdt de laatst opgeslagen toestand als JSON-snapshot, gemaakt met
dezelfde `snap`-functie als de geschiedenis; canvasposities tellen mee (FR-009). "Niet-opgeslagen
wijzigingen" betekent: huidige snapshot ≠ opgeslagen snapshot. Zo telt ongedaan maken tot de
opgeslagen toestand weer als opgeslagen (Assumptions). De knop "Opslaan als concept" is actief
bij wijzigingen; daarna staat er kort "Opgeslagen". `useCourseHistory` blijft; `snap` gebruikt
het nieuwe model (zonder `next`/`target`). Na opslaan vervangt de editor de tijdelijke sleutels
door de nieuwe id's, in de huidige toestand én in alle stappen van de geschiedenis. Zet de docent
daarna een onderdeel terug dat inmiddels verwijderd en opgeslagen is, dan heeft het een id dat
niet meer bestaat; de editor maakt zo'n id bij de volgende opslag weer tijdelijk, zodat het
onderdeel opnieuw wordt aangemaakt in plaats van een fout te geven. Had dat onderdeel een
onbeschikbare video, dan komt het terug zonder video (R5b, FR-020d).

Verlaten met wijzigingen: `onBeforeRouteLeave` in `EditorView` vraagt met `confirmDialog`
"Wijzigingen niet opgeslagen" ("Je wijzigingen gaan verloren." / "Verlaten" / "Annuleren");
`beforeunload` vangt sluiten en verversen af (de browser toont dan zijn eigen vraag), net als bij
lopende uploads in `stores/uploads.js`.

Sessie verlopen: de bestaande 401-afhandeling in `api/client.js` stuurt naar het inlogscherm. De
vertrekvraag wordt dan overgeslagen (anders blokkeert ze het doorsturen); niet-opgeslagen
wijzigingen gaan verloren, zoals de spec zegt.

## R11. Testen

**Besluit**:

- Backend unit: `courseDraft.test.js`: alle regels uit R4, incl. randen (2 en 4 antwoorden, 0 of 2
  goede, 255/256 en 1000/1001 tekens, emoji telt als één teken).
- Backend integratie (Supertest + echte MariaDB, zoals features 001–003):
  `courseCrud.test.js` (aanmaken, lijst, wijzigen, zacht verwijderen, 404 na verwijderen),
  `courseIsolation.test.js` (organisatie B op alle routes van A: 404; SC-003),
  `courseSave.test.js` (opslaan als document, id's, verwijderen van ontbrekende onderdelen,
  herhaald verzoek zonder dubbelingen, soort niet wijzigbaar, één start, alles-of-niets bij een
  fout; SC-002, SC-004), `courseVideos.test.js` (video's van drie organisaties × drie
  beschikbaarheden in de kiezerregel; SC-005) en `courseUnavailableVideo.test.js` (SC-005a,
  FR-016, FR-016a), met:
  - na beperken én na zacht verwijderen: `GET /courses/:id` geeft naam, duur, `thumbnailUrl` en
    `available: false`, en verder geen velden van de video;
  - opslaan zonder dat onderdeel te wijzigen lukt; dezelfde `videoId` in een nieuw of ander
    onderdeel geeft `400` "Kies een video uit de bibliotheek.";
  - de video staat niet in `GET /videos`, en `GET /videos/:id` en `/videos/:id/thumbnail` geven
    `404` (bibliotheek ongewijzigd);
  - `GET /courses/:id/steps/:stepId/videos/:videoId/thumbnail` geeft `200` met het thumbnailbestand voor
    zowel een beschikbare als een onbeschikbare en een verwijderde video;
  - dezelfde thumbnailroute geeft `404` voor organisatie B (ook als B de video zelf mag zien), na
    het zacht verwijderen van de cursus, voor een vraag-onderdeel, een onderdeel zonder video, een
    onderdeel uit een andere cursus van dezelfde organisatie, en een niet-bestaand onderdeel.
  `courseIsolation.test.js` neemt de thumbnailroute op in de lijst routes waarop B `404` krijgt.
- Frontend: `course-mapping.test.js` (heen en terug zonder verlies), `course-dirty.test.js`
  (wijzigen, ongedaan maken tot opgeslagen toestand), `courses-view.test.js` (lege lijst, aanmaken
  met lege velden) en `unavailable-video-warning.test.js` (waarschuwing bij verwijderen, weghalen
  en vervangen van een onbeschikbare video; annuleren laat alles staan; geen waarschuwing bij een
  beschikbare video; ongedaan maken na bevestigen zet onderdeel en video terug).
- Prestatie (SC-007): `backend/scripts/seed-courses.js` maakt 50 cursussen met 50 onderdelen;
  handmatig meten volgens [quickstart.md](quickstart.md).
