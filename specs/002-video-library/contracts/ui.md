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

## Melding over onderbroken uploads (`ResumeNotice.vue`, bovenaan `/videos`, FR-009a)

Per onderbroken upload van deze browser (research R14) één regel:

"Je bent eerder begonnen met uploaden van <naam>, 42% klaar. Kies het bestand opnieuw om verder
te gaan, of verwijder het." met de knop **"Verwijderen"** (annuleert de upload op de server).

- Alleen in de browser die de upload begon; uploads die in dit tabblad lopen staan er niet bij.
- Kiest de docent hetzelfde bestand, dan wordt de upload hervat en verdwijnt de regel.
- Bestaat de upload op de server niet meer, dan wordt hij stil vergeten.

## Uploadvenster (`UploadDialog.vue`, FR-005, FR-013)

Opent na het kiezen van één of meer bestanden. Per bestand een regel met:

- een voorbeeldbeeld (door de browser gemaakt; lukt dat niet, dan een grijs vlak),
- het veld **Naam** (voorgevuld met de bestandsnaam zonder extensie, max. 255 tekens),
- bestandsnaam en grootte,
- de uitkomst van de controle: tijdens het lezen "Bestand wordt gecontroleerd…"; bij een fout de
  melding **in rood** naast het bestand en een knop "Uit de lijst halen".

De knop **"Uploaden"** is uitgeschakeld zolang een bestand nog wordt gecontroleerd of ongeldig
is. Kan de browser een bestand niet lezen, dan staat er niets in rood en mag het door
(FR-013b). "Annuleren" sluit het venster zonder iets te versturen.

Meldingen in het venster (getallen uit `upload-settings`):

| Situatie | Melding |
| --- | --- |
| Extensie is niet `.mp4`, of het bestand is een MOV | Dit bestandstype kan niet worden gebruikt. Kies een MP4-video (de bestandsnaam eindigt op .mp4). |
| Groter dan `maxFileSizeBytes` | Deze video is groter dan 10 GB. Maak de video korter of sla hem op in een lagere kwaliteit. |
| Geen H.264 (bijv. H.265) | Deze video is op een manier opgeslagen die de VR-bril niet kan afspelen. Sla de video in je bewerkingsprogramma opnieuw op als MP4 met de instelling ‘H.264’. |
| Niet twee keer zo breed als hoog | Dit is geen 360°-video. Kies een video die met een 360°-camera is gemaakt; zo'n beeld is twee keer zo breed als hoog. |
| Breder dan `maxWidth` of hoger dan `maxHeight` | De beeldkwaliteit van deze video is te hoog voor de VR-bril. Sla de video opnieuw op met een lagere resolutie: maximaal 5760 × 2880 beeldpunten. |
| Bestand bevat geen beeld | Dit bestand kan niet als video worden geopend. Controleer of de video op je computer goed afspeelt en probeer het opnieuw. |

## Weigering door de server (`UploadRejectedDialog.vue`, FR-014)

Weigert de server een bestand na de upload, dan verschijnt midden in het scherm (op elke pagina)
een venster "Video niet toegevoegd" met de naam van het bestand, de `message` uit de API en de
knop "OK". De regel in de uploadindicator blijft daarnaast bestaan tot "Sluiten".

## Uploadindicator (`UploadIndicator.vue`, FR-006a)

- Rechtsonder een klein rond knopje met het uploadpictogram en de totale voortgang als ring.
  Op `/videos` altijd zichtbaar, ook zonder uploads; op andere pagina's alleen zolang er uploads
  in de lijst staan.
- Het begint ingeklapt en blijft ingeklapt als een upload start en terwijl hij vordert; de ring
  toont de voortgang.
- Alleen op `/videos` klapt het vanzelf uit, en alleen bij: klaar ("Toegevoegd aan de
  bibliotheek"), geweigerd of mislukt, sessie verlopen, of verbinding weg. Na 4 seconden klapt
  het vanzelf weer in. Starten, hervatten en voortgang klappen het niet uit.
- Klikken: staan er uploads in de lijst, dan klapt het uit tot de lijst hieronder (nogmaals
  klikken klapt het in; een door klikken geopende lijst klapt niet vanzelf in). Is de lijst leeg,
  dan opent klikken de bestandskiezer en daarna het uploadvenster, net als "Video toevoegen".
- Start een upload, dan valt er een bestandspictogram in het knopje (± 0,8 s). Bij
  `prefers-reduced-motion: reduce` geen animatie.

Per bestand één regel:

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
