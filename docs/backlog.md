# Backlog

Uitgestelde wensen voor het CMS, met wat al is uitgezocht. Een item hier is nog geen afspraak; het
gaat via de Spec Kit-flow (specify → clarify → plan → tasks → implement) zodra het wordt opgepakt.

## Lijnen verplaatsen en lijnstijl

**Herkomst**: verbeterronde op feature 005 (volgorde en vertakkingen), punt 2 en 3, na de
handmatige test op 2026-10-26.

**Status**: uitgesteld. Het is gebouwd en daarna weer verwijderd, omdat de bediening in de browser
nog niet naar wens werkte. Er staat niets van in de code; de migratie is teruggedraaid.

**Wens**

- **Tussenpunt per pijl**: elke pijl (van een video-onderdeel of van een antwoord) heeft hoogstens
  één tussenpunt dat de docent kan slepen om de lijn te buigen of te verleggen. Een blok slepen blijft
  werken en de lijn volgt. Dubbelklik op het tussenpunt (en bij voorkeur ook één klik in een
  werkbalk) zet de lijn terug naar automatisch.
- **Lijnstijl**: "Vloeiend" (zoals nu) of "Hoekig". Een schakelaar in de bovenbalk kiest de stijl
  voor het hele canvas; een pijl kan daarnaast een eigen stijl hebben, die voorrang heeft. Een pijl
  zonder eigen stijl volgt het canvas.
- **Regels**: een verbinding weghalen of naar een ander onderdeel verleggen wist het tussenpunt en
  de eigen stijl van die pijl; "Canvas ordenen" wist alle tussenpunten (eigen stijlen blijven);
  ongedaan maken herstelt alles.

**Voorgesteld schema** (zeven kolommen, net als `positionX`/`positionY` bij het blok opgeslagen bij
de verbinding zelf):

| Tabel | Kolom | Type | Null | Betekenis |
| --- | --- | --- | --- | --- |
| `CourseStep` | `nextBendX`, `nextBendY` | INT | ja | tussenpunt van de pijl van een video-onderdeel; NULL = automatisch |
| `CourseStep` | `nextLineStyle` | ENUM('smooth','angular') | ja | eigen stijl van die pijl; NULL = volgt het canvas |
| `Answer` | `bendX`, `bendY` | INT | ja | tussenpunt van de pijl van een antwoord |
| `Answer` | `lineStyle` | ENUM('smooth','angular') | ja | eigen stijl van die pijl |
| `CourseVersion` | `lineStyle` | ENUM('smooth','angular') | nee, default `'smooth'` | stijl van het hele canvas |

Let op bij `docs/Diagrams`: daar staan deze velden al, maar `CourseStep.nextLineStyle` staat als NOT
NULL zonder default (moet NULL zijn, anders kan een video-pijl het canvas niet volgen), en de
typenotatie is op een paar plekken onvolledig ("INT (INT)", "ENUM" zonder waarden, een extra
haakje bij `nextLineStyle`).

**Versies**: zodra publiceren en terugzetten (FR-09, FR-11) bestaan, moet het kopiëren van een
versie deze kolommen ook meenemen, anders verdwijnt de lijnindeling bij een nieuwe versie.

**Wat al uitgezocht is** (bruikbaar bij de volgende poging):

- Validatie op de server: stijl alleen `smooth`/`angular`; een tussenpunt is twee gehele getallen
  (binnen ±1 000 000) of beide leeg; een vraag-onderdeel zelf heeft geen pijl; layout van een pijl
  zonder vervolg wordt leeg opgeslagen.
- Lijnpad met tussenpunt: vloeiend als kwadratische boog door het punt (controlepunt = 2·punt −
  (begin + eind)/2); hoekig in rechte hoeken waarvan de hoeken het punt volgen.
- Het slepen zelf (aanwijzen, slepen, dubbelklikken, de werkbalk op een pijl) moet in de browser
  worden ontworpen en getest; dat was het zwakke punt.
