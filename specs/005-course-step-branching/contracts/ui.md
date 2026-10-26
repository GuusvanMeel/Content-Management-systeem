# UI-contract: verbindingen en controle in de editor

Wijzigingen op [feature 004 contracts/ui.md](../../004-course-steps-draft/contracts/ui.md). Basis
voor verbindingen is het prototype in git (`1914a00`). Alle teksten Nederlands.

## Canvas

- **Pijlen**: van een video-onderdeel naar zijn vervolg; van elk antwoord naar zijn vervolg, met
  de antwoordletter op de pijl. Een pijl terug naar een eerder onderdeel loopt er zichtbaar
  omheen. Klik op een pijl selecteert hem; Delete of Backspace haalt hem weg.
- **Verbindingspunten**: één onder een video-onderdeel ("+"), één per antwoord onder een vraag
  (de letter). Slepen naar een blok verbindt (FR-019); een video kan niet op zichzelf worden
  losgelaten.
- **Eén klik op een verbindingspunt** opent het menu bij dat punt; slepen naar een lege plek opent
  het menu daar (FR-020):
  - "Nieuw video-onderdeel", "Nieuwe vraag": maakt het onderdeel verbonden aan, onder de bron
    (per antwoord naast elkaar) of op de losgelaten plek, en opent het. Was het punt al verbonden,
    dan komt het nieuwe onderdeel ertussen; bij een nieuwe vraag gaat het goede antwoord (A) naar
    het oude vervolg.
  - "Bestaand onderdeel": lijst met de onderdelen (labels zoals in feature 004), met een zoekveld
    zodra er meer dan 8 zijn.
  - "Verbinding weghalen": alleen als het punt al verbonden is.
  - Escape of klik buiten het menu sluit het zonder wijziging.
- **Blok** (FR-022): "Start", "Einde" (afgeleid), "← n" als er meer dan één verbinding binnenkomt,
  en bij een melding een stip met de eerste melding: oranje ("nog te doen"), rood na een klik op
  "Opslaan als concept" (FR-022a). Geen stip = compleet.
- **Canvas ordenen**: volgens de route, van boven naar beneden, vertakkingen naast elkaar; losse
  onderdelen eronder.

## Bewerkformulier

- Video-onderdeel: "Daarna" — keuze uit de onderdelen (niet zichzelf) en "Geen volgend onderdeel
  (einde)".
- Vraag: per antwoord "Gaat naar…" — keuze uit de onderdelen (ook de eigen vraag) en "Geen
  volgend onderdeel".
- Meldingen van dat onderdeel staan bovenaan het formulier, in dezelfde kleur als op het blok.

## Balk

- "n nog te doen" (oranje; rood zodra er een rode melding is) opent een lijst met alle meldingen;
  klik → het onderdeel opent en komt in beeld (bij "Kies een startonderdeel" en "Voeg een
  onderdeel toe": het canvas). Zonder meldingen: "Cursus is compleet" (groen vinkje).
- "Opslaan als concept" werkt altijd, ook met meldingen.

## Lijst

- Route vanaf de start: per vraag vertakkingen A, B, …; "Einde" waar de route stopt; "Verder bij
  “…”" bij een lus; "Nog niet verbonden" bij een antwoord zonder vervolg in een vraag die wél
  vervolgen heeft; daarna "Niet bereikbaar" met de losse onderdelen. Klik op een onderdeel opent
  het op het canvas.
- Zonder start: "Nog geen startonderdeel" en alle onderdelen onder "Niet bereikbaar".
