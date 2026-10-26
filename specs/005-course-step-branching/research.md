# Research: Volgorde en vertakkingen van onderdelen

Technische keuzes voor [spec.md](spec.md). Elke keuze: besluit, motivatie, overwogen
alternatieven. Bouwt voort op de keuzes van feature 004 ([research](../004-course-steps-draft/research.md));
waar niets staat, geldt 004.

## R1. Verbindingen in het opslaan-verzoek: sleutels per onderdeel

**Besluit**: Elk onderdeel in `PUT /courses/:id` krijgt een verplichte `key` (tekst, max. 64
tekens, uniek binnen het verzoek). Een video-onderdeel heeft `nextStepKey`, elk antwoord heeft
`nextStepKey`; beide zijn `null` of de `key` van een onderdeel in hetzelfde verzoek. De editor
gebruikt zijn eigen sleutels (`s<id>` voor opgeslagen, `n_…`/`q_…` voor nieuwe onderdelen). De
server lost sleutels op ná het invoegen van nieuwe onderdelen, in dezelfde transactie:

1. onderdelen bijwerken/invoegen/verwijderen zoals in feature 004, met `nextCourseStepId` eerst
   `NULL`;
2. een kaart `key → id` maken;
3. `CourseStep.nextCourseStepId` en `Answer.nextCourseStepId` zetten volgens die kaart.

Het antwoord geeft `nextStepId` (numeriek) bij video-onderdelen en antwoorden.

**Motivatie**: Verbindingen naar onderdelen die in dezelfde opslag nieuw zijn (FR-007), zonder
tweede verzoek. Omdat elk onderdeel van het concept in het verzoek staat (feature 004 R3), kan
een sleutel nooit naar een ander concept wijzen: een onbekende sleutel is altijd fout (FR-008).
Id's van bestaande onderdelen blijven gelijk (feature 004 R3), dus verbindingen verschuiven niet.

**Alternatieven**: Positie in de lijst als verwijzing: werkt, maar breekt stil bij een
volgordefout en is onleesbaar in tests. Twee verzoeken (eerst onderdelen, dan verbindingen): niet
meer alles of niets (FR-009 van feature 004).

## R2. Regels voor verbindingen op de server

**Besluit**: `courseDraft.js` controleert, naast de regels van feature 004:

| Regel | Melding (veld) |
| --- | --- |
| `key` aanwezig, tekst ≤ 64, uniek | "Dit onderdeel heeft geen geldige sleutel." (`steps.<n>.key`) |
| `nextStepKey` is `null` of een `key` uit het verzoek | "Dit vervolg bestaat niet in deze cursus." (`steps.<n>.nextStepKey` / `steps.<n>.answers.<m>.nextStepKey`) |
| video-onderdeel wijst niet naar zichzelf | "Een video-onderdeel kan niet naar zichzelf wijzen." |
| vraag-onderdeel heeft geen eigen `nextStepKey` | "Een vraag gaat verder via haar antwoorden." |

De volledigheidsregels (bereikbaarheid, einde, losse antwoorden) worden **niet** op de server
gecontroleerd (spec Assumptions; komt met FR-09).

## R3. Een nieuwe cursus met het voorbeeld (FR-028)

**Besluit**: `insertCourse` maakt in dezelfde transactie: een vraag-onderdeel "Wat doe je?"
(`isStart` true, positie (0, 0)) met antwoorden "Ik grijp in" (goed, `sortOrder` 0) en "Ik wacht
af" (`sortOrder` 1), en twee video-onderdelen zonder video op (−130, 260) en (130, 260); elk
antwoord wijst naar één video. Dit vervangt het enkele start-video-onderdeel van feature 004
(FR-001a); `courseCrud.test.js` en quickstart van 004 worden daarop aangepast.

## R4. De controle op volledigheid: één pure functie in de frontend

**Besluit**: `frontend/src/lib/completeness.js` met `checkCourse(course, stepVideos)` →
`{ issues, byNode, complete }`. Een melding is `{ id, code, msg, nodeId?, answerId? }` met een
stabiele `id` (`<code>:<nodeId>:<answerId>`). Volgorde van de controle:

1. geen onderdelen → alleen `empty` "Voeg een onderdeel toe" (FR-016);
2. per onderdeel de regels van feature 004 (FR-015): `noVideo`, `videoUnavailable`,
   `noQuestion`, `emptyAnswer`;
3. per vraag: heeft ≥ 1 antwoord een vervolg, dan `answerOpen` per antwoord zonder vervolg (FR-013);
4. geen start → `noStart` "Kies een startonderdeel" en stoppen met de route-regels (FR-010);
5. bereikbaarheid vanaf de start (breedte-eerst) → `unreachable` per onbereikbaar onderdeel (FR-012);
6. eindes = video zonder `next` of vraag zonder enig antwoord-vervolg; geen bereikbaar einde →
   `noEnd` "De route heeft geen einde" (FR-011);
7. terugwaarts vanaf de eindes (vaste-punt-iteratie zoals het prototype) → `neverEnds` per
   bereikbaar onderdeel dat geen einde kan halen (FR-014).

Alle stappen zijn lineair in onderdelen + verbindingen; met 50 onderdelen ruim onder 1 ms.
`editor/context.js` rekent het als `computed`, dus live (FR-017), ook na ongedaan maken.

**Motivatie**: Het prototype had dezelfde opzet (`lib/validate.js` in commit `1914a00`); nu met de
regel dat een vraag zonder enig vervolg een einde is, en zonder publicatieknop. Pure functie →
volledig unit-testbaar (SC-003).

**Alternatieven**: Controle op de server bij elke wijziging: niet live, en de server hoeft het pas
bij publiceren (clarify Q3).

## R5. Oranje en rood (FR-022a)

**Besluit**: De editor houdt een set `flaggedIssueIds`: de `id`'s van de meldingen op het moment
van de laatste klik op "Opslaan als concept" (ook als het opslaan mislukt). Een melding is rood
als haar `id` in die set zit, anders oranje. Na het opslaan worden de onderdeel-sleutels in de set
vervangen zoals bij de geschiedenis (feature 004 R10), zodat rood rood blijft. Opgeloste
meldingen verdwijnen vanzelf (ze staan niet meer in `issues`). De set hoort niet in de
geschiedenis en niet bij "niet-opgeslagen wijzigingen".

## R6. Editor: verbindingen terug uit het prototype

**Besluit**: Uit commit `1914a00` (en de map `frontend/src/editor/` daarvoor) komen terug, met
aanpassingen:

- `lib/course.js`: `next` (video) en `target` (antwoord) in het model; `outgoing`, `incoming`,
  `connect`, `disconnect`, `positionBelow`, `addLinkedNode`, `isEnd`; `deleteNode` haalt
  verwijzingen naar het verwijderde onderdeel weg (FR-006). Nieuw: `isEnd` geldt ook voor een
  vraag zonder enig antwoord-vervolg; `addLinkedNode` zet bij een nieuwe vraag het **goede**
  antwoord op het oude vervolg (clarify Q2); `connect` weigert een video naar zichzelf.
- `autoLayout` weer met dagre op de route (FR-025); losse onderdelen onderaan.
- `CourseEdge.vue` (pijl met antwoordletter, selecteren, Delete) en `RouteTree.vue` (route-overzicht,
  "Einde", "Verder bij …", "Nog niet verbonden").
- `CanvasEditor.vue`: randen, verbindingshandles, `onConnectStart/End` en het menu. Eén klik op
  een handle (zonder slepen) opent het menu bij die handle (FR-020); slepen naar een lege plek
  opent het op die plek. Het menu krijgt naast "Nieuw video-onderdeel" en "Nieuwe vraag" een
  doorzoekbare lijst "Bestaand onderdeel" (zoekveld zodra er meer dan 8 onderdelen zijn) en, als
  de handle al verbonden is, "Verbinding weghalen".
- `VideoNode.vue` / `QuestionNode.vue`: handles terug; labels "Start", "Einde", "← n" (binnenkomend,
  als n > 1), stip met eerste melding (oranje of rood).
- `NodeEditForm.vue`: "Daarna" (video) en "Gaat naar…" per antwoord, met "Geen volgend
  onderdeel (einde)".
- `EditorView`/`CourseEditor.vue`: knop "n nog te doen" met lijst (klik → `ed.open`), of
  "Cursus is compleet".
- `lib/courseMapping.js`: `nextStepId` ↔ `next`/`target` (`s<id>`), en `key`/`nextStepKey` in de
  payload.

**Motivatie**: Het prototype is getest door de opdrachtgever; terugzetten is minder werk en
minder risico dan opnieuw ontwerpen (spec Assumptions).

## R7. Ongedaan maken en onbeschikbare video's

**Besluit**: Verbindingen zitten in de knooppunten en dus in elke geschiedenisstap; ongedaan maken
na verwijderen zet onderdeel én verbindingen terug (FR-006, SC-007). De `transform` van feature
004 (FR-020d) leegt alleen `videoId` en laat `next` staan.

## R8. Testen

- Backend unit `courseDraft.test.js`: regels uit R2.
- Backend integratie `courseConnections.test.js`: verbindingen naar nieuwe onderdelen in één
  opslag; lussen; antwoord naar eigen vraag; meerdere antwoorden naar één onderdeel; video naar
  zichzelf, onbekende sleutel, dubbele sleutel en vervolg op een vraag → `400` zonder wijziging;
  id's stabiel over drie opslagen; verwijderen van een onderdeel waar naar gewezen werd; herhaald
  verzoek geeft geen dubbelingen; isolatie (sleutels kunnen niet naar een andere cursus wijzen).
  `courseCrud.test.js`: het voorbeeld van FR-028.
- Frontend `completeness.test.js`: per regel een schending en een geldige variant (SC-003), de
  volgorde (geen start → geen bereikbaarheidsmeldingen), en 50 onderdelen < 200 ms (SC-004).
- Frontend `course-connections.test.js`: verbinden, vervangen, weghalen, invoegen (video en
  vraag, goed antwoord), verwijderen + ongedaan maken (SC-007), opslaan met sleutels en terug.
- Frontend `issue-colours.test.js`: oranje → rood na opslaan → nieuwe melding oranje → opgeloste
  melding weg; sleutels na opslaan.
