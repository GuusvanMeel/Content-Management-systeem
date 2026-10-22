# UI-contract: videobibliotheek en uploads

Teksten op het scherm in het Nederlands; routes, componenten en code in het Engels
(constitution VI). Alle schermen vallen onder `OrganisationLayout` (organisatiesessie verplicht,
zie feature 001).

## Route

| Route | Scherm | Guard |
| --- | --- | --- |
| `/videos` | Videobibliotheek (vervangt het prototype `VideosView.vue`) | organisatiesessie, anders `/login` |

## Videobibliotheek (`/videos`)

- Kop "Video's" met knop **"Video toevoegen"** (opent de bestandskiezer, `accept=".mp4,video/mp4"`,
  meerdere bestanden toegestaan).
- Raster met per video (FR-017): thumbnail (via `thumbnailUrl`), naam, duur `uu:mm:ss`, grootte
  in MB of GB met één decimaal (1 GB = 1024³ bytes) en uploaddatum (`dd-mm-jjjj`), nieuwste eerst.
- Per video een knop **"Verwijderen"**: bevestiging "Video verwijderen?" met de tekst
  "“<naam>” verdwijnt uit de videobibliotheek." en knoppen "Verwijderen" / "Annuleren"
  (FR-019). Na verwijderen de melding "Video verwijderd".
- Lege bibliotheek: "Er staan nog geen video's in de bibliotheek. Voeg een 360°-video toe
  (MP4, H.264, maximaal 10 GB)." met de knop "Video toevoegen".
- Geen afspeelknop, geen naam wijzigen, geen "Gebruikt in" (buiten scope).
- De bibliotheek wordt opnieuw geladen bij openen van de pagina en zodra een upload in de
  bibliotheek is gezet; er is geen polling (contracts/ui.md van 001).

## Naam opgeven

- Na het kiezen van één bestand: een kort venster "Video toevoegen" met het veld **Naam**
  (voorgevuld met de bestandsnaam zonder extensie, max. 255 tekens) en de knop "Uploaden".
- Bij meerdere bestanden tegelijk: geen venster; elke video krijgt de bestandsnaam zonder
  extensie als naam.

## Controles vóór de upload (in de browser)

Bij het kiezen, per bestand, zonder iets te versturen:

| Situatie | Melding in de uploadindicator |
| --- | --- |
| Extensie is niet `.mp4` | "Alleen MP4-video's (H.264) worden ondersteund." |
| Groter dan `maxFileSizeBytes` | "Een video mag maximaal 10 GB zijn." |

## Uploadindicator (`UploadIndicator.vue`, op elke CMS-pagina)

Zichtbaar zolang er uploads lopen, wachten, of een resultaat hebben dat nog niet is gesloten
(FR-006a). Per bestand één regel:

| Toestand | Tekst | Acties |
| --- | --- | --- |
| Wacht in de wachtrij | "<naam> – Wacht…" | "Verwijderen uit wachtrij" |
| Bezig | "<naam> – 42% (1,3 GB van 3,0 GB)" met voortgangsbalk | "Annuleren" |
| Bezig na hervatten | idem, met de aanduiding "Hervat" | "Annuleren" |
| Verbinding weg | "<naam> – Verbinding verbroken, opnieuw proberen…" | "Annuleren" |
| Laatste deel verstuurd | "<naam> – Video wordt gecontroleerd…" | – |
| In de bibliotheek | "<naam> – Toegevoegd aan de bibliotheek" | "Sluiten" |
| Geweigerd | "<naam> – " + `message` uit de API | "Sluiten" |
| Te weinig ruimte | "Er is op dit moment niet genoeg opslagruimte. Neem contact op met de beheerder." | "Sluiten" |
| Sessie verlopen | "<naam> – Upload onderbroken. Log opnieuw in en kies hetzelfde bestand om verder te gaan." | "Sluiten" |

- Maximaal `maxParallelUploads` tegelijk (standaard 1); de rest wacht en start automatisch
  (FR-006b). Een geweigerd of geannuleerd bestand laat de volgende starten.
- Hervatten: kiest de docent een bestand waarvoor in deze browser een onvoltooide upload
  bestaat, dan gaat die verder vanaf het bereikte punt en toont de regel "Hervat" (FR-009).
- "Annuleren" vraagt geen bevestiging en ruimt de ontvangen delen op (FR-010).
- De indicator is inklapbaar tot één regel "Uploaden: 1 bezig, 2 wachtend".

## Weggaan tijdens een upload (FR-006c)

- Tabblad sluiten, herladen of naar een andere site: de standaardwaarschuwing van de browser
  (`beforeunload`) zolang er een upload loopt of wacht.
- Navigeren binnen het CMS: geen waarschuwing; uploads lopen door.
- "Uitloggen" terwijl er een upload loopt of wacht: bevestiging "Er loopt nog een upload. Als je
  uitlogt, wordt de upload onderbroken. Je kunt hem later hervatten door hetzelfde bestand
  opnieuw te kiezen." met "Uitloggen" / "Annuleren".

## Cursus-editor

- De video-kiezer in de cursus-editor (`editor/VideoPicker.vue`) blijft in deze feature op de
  prototypedata werken (research R11).
