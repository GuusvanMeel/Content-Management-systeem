# UI-contract: centrale videobibliotheek

Teksten op het scherm in het Nederlands; routes, componenten en code in het Engels
(constitution VI). Bouwt voort op [ui.md van 002](../../002-video-library/contracts/ui.md). Er
komen geen nieuwe routes: alles gebeurt op `/videos`. De beheeromgeving verandert niet.

## Videobibliotheek (`/videos`)

Boven de lijst een werkbalk:

- **Zoekveld** met placeholder "Zoeken op naam, beschrijving of organisatie". Filtert tijdens
  het typen (FR-023).
- **Filter** (drie knoppen naast elkaar): "Alle video's" (standaard) · "Eigen video's" · "Van
  andere organisaties" (FR-025).
- **Sorteren** (keuzelijst): "Nieuwste eerst" (standaard), "Oudste eerst", "Naam (A–Z)", "Naam
  (Z–A)", "Langste eerst", "Kortste eerst", "Grootste eerst", "Kleinste eerst" (FR-024).
- **Organisatiefilter** (alleen als het actief is): naast het zoekveld het label
  "Organisatie: <naam> ✕". Klikken erop (of op het kruisje, `aria-label` "Filter op <naam>
  wissen") wist alleen dit filter (FR-025b). Het werkt samen met zoeken, sorteren en het filter
  eigen/andere.

Per video in het raster (aanvulling op 002):

- **Eigenaar** (FR-009):
  - video van een andere organisatie: een **pil** met de naam van de eigenaar, in een vaste kleur
    die alleen hiervoor wordt gebruikt (paars, los van de huisstijl), met `title` "Toon alleen
    video's van <naam>". Klikken op de pil zet het organisatiefilter op die organisatie
    (FR-025b); het opent het videovenster niet;
  - eigen video: een onopvallende, neutrale pil "Eigen" (grijs, niet klikbaar).
- **Beschrijving**: hooguit twee regels, daarna "…"; zonder beschrijving niets (FR-022).
- Bij eigen video's een klein label met de beschikbaarheid: "Algemeen", "Selectief" of "Alleen
  eigen organisatie".
- Klikken op de video opent het **videovenster**. De knop "Verwijderen" staat alleen bij eigen
  video's.

Lege toestanden:

- Geen enkele zichtbare video: de melding van 002 ("Er staan nog geen video's in de
  bibliotheek…").
- Wel video's, maar zoeken of filteren levert niets op: "Geen video's gevonden" met de knop
  "Zoekterm en filter wissen", die zoekterm, filter eigen/andere en organisatiefilter wist
  (FR-026).

De lijst wordt geladen bij het openen van de pagina, na een geslaagde upload en na opslaan in
het videovenster; zoeken, sorteren en filteren laden niets opnieuw (FR-025a). Geen polling.

## Videovenster (`VideoDetailsDialog.vue`)

Opent boven de bibliotheek (FR-012). Sluiten (knop "Sluiten", Escape of klik naast het
venster) laat de bibliotheek ongewijzigd: zoekterm, filter, sortering en scrollpositie blijven.

**Bekijken** (iedereen die de video ziet):

- grote thumbnail, naam, volledige beschrijving (regels bewaard, `white-space: pre-line`, nooit
  als HTML), duur `uu:mm:ss`, grootte, uploaddatum, eigenaar als dezelfde pil als in de lijst.
  Klikken op de pil van een andere organisatie sluit het venster en zet het organisatiefilter
  (FR-025b).
- Video van een andere organisatie: geen knoppen behalve "Sluiten" (FR-014).

**Eigen video**: daarnaast de beschikbaarheid ("Algemeen beschikbaar", "Selectief beschikbaar:
<namen>", "Alleen eigen organisatie") en de knoppen **"Wijzigen"** en **"Verwijderen"**.
Bij "Selectief beschikbaar" zonder actieve gekozen organisaties: "Selectief beschikbaar: geen
organisaties meer gekozen. Alleen jouw organisatie ziet deze video."

**Wijzigen** (in hetzelfde venster, FR-012a): velden Naam, Beschrijving (`DescriptionField`, zie
hieronder) en Beschikbaarheid (`AvailabilityPicker`), knoppen "Opslaan" en "Annuleren".

- Verliezen organisaties toegang (research R6), dan eerst een bevestiging: titel "Beschikbaarheid
  beperken?", tekst "3 organisaties kunnen deze video daarna niet meer zien." (bij één: "1
  organisatie kan deze video daarna niet meer zien."), knoppen "Wijzigen" en "Annuleren"
  (FR-017a). Annuleren laat het formulier open met de ingevulde waarden.
- Na opslaan: melding "Wijzigingen opgeslagen", het venster toont weer de gegevens, de
  bibliotheek wordt opnieuw geladen.
- Veldfouten van de API onder het juiste veld.
- Krijgt het venster `404` (video intussen niet meer beschikbaar of verwijderd), dan: "Deze
  video is niet meer beschikbaar." en de bibliotheek wordt opnieuw geladen.

## Beschrijving invullen (`DescriptionField.vue`)

Gebruikt in het uploadvenster en in het videovenster (FR-020, FR-021).

- Tekstvak met meerdere regels, label "Beschrijving (optioneel)".
- Teller onder het veld: "<aantal> tekens over" (bij één: "1 teken over"), geteld zoals de server
  telt (Unicode-codepunten). Bij "0 tekens over" is de teller rood.
- Typen voorbij het maximum kan niet. Plakt de docent meer dan erin past, dan wordt de tekst
  afgekapt op het maximum en staat er in rood onder het veld: "De beschrijving mag maximaal 1000
  tekens zijn; de rest is niet overgenomen." Die melding verdwijnt zodra de tekst weer korter
  wordt.

## Beschikbaarheid kiezen (`AvailabilityPicker.vue`)

Gebruikt in het uploadvenster en in het videovenster.

- Drie keuzerondjes met korte uitleg:
  - "Algemeen beschikbaar": "Alle organisaties kunnen deze video zien."
  - "Selectief beschikbaar": "Alleen de organisaties die je kiest."
  - "Alleen eigen organisatie": "Alleen jouw organisatie ziet deze video."
- Bij "Selectief beschikbaar" een lijst met vinkjes met de namen uit
  `GET /api/organisation/organisations` (alfabetisch), met een zoekveldje boven de lijst als er
  meer dan 10 organisaties zijn. Zonder vinkje de melding "Kies minstens één organisatie, of kies
  ‘Alleen eigen organisatie’." en opslaan/uploaden staat uit.
- Zijn er geen andere organisaties, dan is "Selectief beschikbaar" uitgeschakeld met de tekst
  "Er zijn nog geen andere organisaties."

## Uploadvenster (`UploadDialog.vue`, aanvulling op 002)

Per bestand, onder het veld Naam:

- **Beschrijving** (`DescriptionField`, zie hierboven), standaard met "1000 tekens over" (FR-021).
- **Beschikbaarheid** (`AvailabilityPicker`), voorgeselecteerd met `defaultVisibility` uit
  `upload-settings` (FR-002).
- "Uploaden" staat uit zolang een bestand ongeldig is (002) of een "Selectief beschikbaar"
  zonder gekozen organisatie heeft.

De keuzes gaan mee in de tus-metadata (contracts/api.md). Een hervatte upload houdt de keuzes
van het begin; het venster voor het opnieuw kiezen van het bestand toont ze niet opnieuw.
