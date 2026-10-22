# Research: 360°-videobibliotheek (eigen organisatie)

**Feature**: [spec.md](spec.md) | **Plan**: [plan.md](plan.md) | **Datum**: 2026-10-22

Stack en conventies zijn gelijk aan feature 001 (zie
[001 research](../001-organisation-accounts-login/research.md)): Express 5 met ES modules,
Knex-migraties en -queries met `mysql2` (geen ORM), Vue 3, MariaDB 11.8, Docker Compose met
nginx. Alles hieronder is gratis en open source; er worden geen betaalde diensten gebruikt.

## R1. Hervatbaar uploaden tot 10 GB (FR-007 – FR-010)

- **Decision**: het open **tus-protocol** (tus.io, versie 1.0) met:
  - server: `@tus/server` + `@tus/file-store` (MIT), in de bestaande Express-API onder
    `/api/organisation/video-uploads`;
  - browser: `tus-js-client` (MIT), zonder UI-bibliotheek; de UI is eigen Vue-code.
  - Het bestand wordt in **delen van 32 MB** verstuurd (`chunkSize`). Elk deel is één
    `PATCH`-verzoek met `Upload-Offset`; de server schrijft direct naar schijf.
  - Hervatten: de client vraagt met `HEAD` op welke byte de server staat en gaat daar verder.
    `tus-js-client` onthoudt per bestand (vingerafdruk: naam, grootte, type, laatst gewijzigd,
    endpoint) de upload-URL in `localStorage`; kiest de docent hetzelfde bestand opnieuw, dan
    wordt die URL gevonden en hervat. Dat verklaart waarom hervatten alleen in dezelfde browser
    werkt (spec, Edge Cases). Bij een korte storing probeert de client het automatisch opnieuw
    (`retryDelays: [0, 3000, 10000, 30000, 60000]`, FR-008).
  - Herkennen van "hetzelfde bestand" (FR-009): de enige controle is de vingerafdruk van
    `tus-js-client` (naam, grootte, type, laatst gewijzigd) plus `Upload-Length`; de server
    weigert een `PATCH` met een afwijkend offset (`409`). De spec vraagt geen inhoudscontrole van
    het al ontvangen deel (die zou opnieuw versturen vereisen); de controle na de upload (R4)
    vangt een onbruikbaar samengevoegd bestand af. FR-010 gaat over annuleren (tus
    `termination`, `DELETE`).
- **Rationale**: tus is een gestandaardiseerd, veelgebruikt protocol precies voor dit probleem;
  client en server zijn volwassen en gratis. Doordat elk deel een los verzoek van 32 MB is:
  - hoeft geen enkel HTTP-verzoek 10 GB te zijn, dus nginx en Node hoeven geen enorme
    bodies of tijdslimieten van uren toe te staan (R7);
  - telt elk deel als activiteit voor de sessie, zodat een upload van uren de sessie niet laat
    verlopen (FR-012, via de bestaande sessie-middleware);
  - gaat bij een storing hooguit één deel verloren (SC-002).
- **Alternatives considered**:
  - eigen chunk-protocol met `Content-Range` (zelfde idee, maar alle randgevallen zelf
    bouwen en testen);
  - Uppy (gebruikt zelf tus, maar voegt een grote UI-bibliotheek toe die niet bij de eigen
    UI past);
  - Resumable.js / Flow.js (niet meer actief onderhouden);
  - één groot `multipart`-verzoek (niet hervatbaar, 10 GB-body door nginx en Node);
  - S3-multipart (expliciet buiten scope: geen S3 in deze feature).
- **Versies**: `@tus/server` en `@tus/file-store` 2.x, `tus-js-client` 4.x, vastgepind in
  `package-lock.json`. De plan-opzet gebruikt bewust zo min mogelijk tus-hooks (alleen
  `onUploadFinish`), omdat de hook-signaturen tussen hoofdversies verschillen; autorisatie zit in
  gewone Express-middleware (R3).

## R2. Opslag van video's en thumbnails (constitution II, III)

- **Decision**: één klein module `backend/src/lib/videoStorage.js` is de enige plek die
  video- en thumbnailbestanden aanraakt. Interface:
  - `save(key, sourcePath)`: verplaatst een bestand naar de opslag (`rename`, zelfde volume);
  - `getPath(key)`: absoluut pad (voor ffprobe/ffmpeg en ontwikkelmodus);
  - `getInternalUrl(key)`: pad voor `X-Accel-Redirect` (`/internal/videos/<key>`);
  - `remove(key)`: verwijdert een bestand (alleen voor ongeldige uploads en opruimen);
  - `freeBytes()`: vrije ruimte op het volume via `fs.statfs`.
  Keys zijn relatief en bevatten geen gebruikersinvoer:
  `videos/<organisationId>/<uuid>.mp4` en `thumbnails/<organisationId>/<uuid>.jpg`.
  De database bewaart alleen de key (ERD-velden `storageKey`, `thumbnailStorageKey`).
- Alle videodata staat op een **nieuw Docker-volume `videos`**, in de API gekoppeld op
  `/data/videos` (lezen/schrijven) en in nginx op `/data/videos` (alleen lezen):
  - `/data/videos/incoming/`: tijdelijke tus-bestanden (onvoltooide uploads);
  - `/data/videos/videos/` en `/data/videos/thumbnails/`: opgeslagen bestanden.
  `incoming` en de opslag staan op hetzelfde volume, zodat `save` een snelle `rename` is in
  plaats van 10 GB kopiëren.
- **Rationale**: het bestaande volume `uploads` wordt door nginx publiek geserveerd op
  `/media/`; video's mogen daar niet staan (ze moeten achter een toegangscontrole). Een apart
  volume maakt dat onmogelijk om per ongeluk te doen. De keys en het ene module maken een latere
  overstap naar andere opslag mogelijk zonder de rest van de code te raken; S3 wordt nu niet
  gebouwd.
- **Alternatives considered**: video's onder `uploads/videos/` (dan zichtbaar via `/media/`
  tenzij nginx dat extra blokkeert; foutgevoelig); bestanden in de database (strijdig met
  principe III).

## R3. Autorisatie en afscherming van uploads (FR-022)

- **Decision**: de tus-handler hangt onder de bestaande keten `csrf → session →
  requireOrganisation`. Daarvoor zit een eigen middleware `videoUploadGuard`:
  - **`POST` (aanmaken)**: controleert `Upload-Length` ≤ maximum (R5), de bestandsnaam in de
    metadata eindigt op `.mp4` (anders `415`), en de vrije ruimte (R6). Daarna herschrijft de
    middleware de header `Upload-Metadata`: een eventueel meegestuurde `organisationId` wordt
    verwijderd en de `organisationId` uit de sessie wordt toegevoegd. De client kan de eigenaar
    dus niet kiezen.
  - **`HEAD` / `PATCH` / `DELETE` op `/:uploadId`**: leest de upload-info uit de file-store en
    vergelijkt `metadata.organisationId` met `getOrganisationId(req)`; bij verschil of
    onbekende upload `404` (zelfde antwoord, zodat niet te zien is of de upload bestaat).
    Bij `PATCH` ook de vrije-ruimtecontrole voor het resterende deel (R6).
  - De CSRF-header `X-Requested-With: cms` wordt door `tus-js-client` meegestuurd (optie
    `headers`), dus de bestaande CSRF-middleware hoeft niet te veranderen.
- **Rationale**: de afscherming zit in gewone, testbare Express-code die dezelfde
  `getOrganisationId` gebruikt als de rest (research R8 van 001), los van tus-versies.
- **Alternatives considered**: autorisatie in tus-hooks (`onIncomingRequest`; afhankelijk van
  de hook-API van de tus-versie en minder goed te testen).

## R4. Controle na de upload en thumbnail (FR-002, FR-003, FR-003a, FR-013a – FR-015)

Na de handmatige test is dit het **laatste vangnet**: de meeste fouten vangt het uploadvenster
al vóór de upload (R13). De server blijft precies dezelfde regels controleren, omdat een
browser een bestand soms niet kan lezen en omdat de browsercontrole te omzeilen is.

- **Decision**: `ffprobe` en `ffmpeg` (het `ffmpeg`-pakket van Alpine, gratis) in de API-image.
  In de tus-hook `onUploadFinish` (draait direct na het laatste deel, nog binnen dat
  `PATCH`-verzoek) voert `videoVerification.js` uit:
  1. `ffprobe -v error -print_format json -show_format -show_streams <bestand>` met een
     time-out van 20 s; mislukt of time-out → `video_unreadable`.
  2. **Container**: `format.format_name` bevat `mp4` én `format.tags.major_brand` is niet
     `qt` (MOV meldt zich in ffprobe ook als `mov,mp4,…`; het merk onderscheidt ze) →
     anders `video_unsupported_format`.
  3. **Codec**: de eerste videostream heeft `codec_name = h264` → anders
     `video_unsupported_codec`. Geen videostream → `video_unreadable`.
  4. **360°**: `width === 2 * height` en de pixelverhouding (`sample_aspect_ratio`) is
     afwezig, `0:1` of `1:1` → anders `video_not_360`.
  5. **Resolutie**: `width ≤ VIDEO_MAX_WIDTH` en `height ≤ VIDEO_MAX_HEIGHT` (standaard 5760 en
     2880, uit `.env`) → anders `video_resolution_too_high`.
  6. Het geluid wordt niet bekeken (FR-002a).
  7. **Duur**: `format.duration`, afgerond op hele seconden.
  8. **Thumbnail**: `ffmpeg -ss <10% van de duur, minstens 1 s> -i <bestand> -frames:v 1
     -vf scale=1024:512 -q:v 4 <tmp>.jpg` (time-out 20 s; samen met de 20 s van ffprobe blijft
     er binnen de 60 s van FR-015 ruimte voor verplaatsen en de `INSERT`).
  Bij succes: video en thumbnail via `videoStorage.save` op hun plek, één `INSERT` in `Video`,
  tus-info verwijderd; het antwoord op de laatste `PATCH` bevat de nieuwe video (JSON). Bij een
  fout: bestand en tus-info verwijderd, niets in de database, en de hook geeft een
  `422` met het foutformaat van de API en een Nederlandse melding terug (FR-014). De meldingen
  staan in gewone taal, zonder technische termen (R15). Pas na de
  `INSERT` staat de video in de bibliotheek (FR-013, FR-016).
- **Rationale**: ffprobe leest alleen de kop van het bestand (de `moov`-box); ook bij 10 GB is
  dat binnen seconden. Een thumbnail met `-ss` vóór `-i` zoekt direct naar het juiste punt.
  Samen ruim binnen 60 s (FR-015). Omdat de controle in hetzelfde verzoek gebeurt, ziet de docent
  het resultaat meteen; sluit de docent de pagina, dan loopt het verzoek op de server door en
  komt een geldige video gewoon in de bibliotheek (spec, Edge Cases).
- **Alternatives considered**:
  - alleen een controle in de browser (te omzeilen en niet elk bestand is in de browser
    leesbaar; daarom blijft deze servercontrole, zie R13);
  - een aparte "afronden"-aanroep van de client na de upload (dan blijft een volledig
    geüpload bestand liggen als de browser precies daartussen sluit);
  - een wachtrij met achtergrondverwerking (vraagt een status in de database, die de spec
    uitsluit).

## R5. Groottelimiet en eenheden (FR-004)

- **Decision**: 1 GB = 1024³ bytes, zowel voor de limiet als voor de weergave (zoals Windows
  Verkenner). Maximum `VIDEO_MAX_SIZE_GB` (standaard 10, dus 10 737 418 240 bytes). De
  browser weigert vooraf op `file.size`; de server weigert bij `POST` op `Upload-Length` (`413`)
  en tus zelf weigert meer bytes dan `Upload-Length`.
- **Rationale**: één definitie voorkomt dat een bestand van "10,2 GB" in de browser wel en op de
  server niet past.

## R6. Vrije schijfruimte (FR-004a)

- **Decision**: `videoStorage.freeBytes()` (`fs.statfs` op `/data/videos`:
  `bavail × bsize`). Regel: `vrij − nog te ontvangen bytes ≥ VIDEO_MIN_FREE_SPACE_GB` (standaard
  20). Gecontroleerd bij `POST` (nog te ontvangen = `Upload-Length`) en bij elke `PATCH`
  (nog te ontvangen = `Upload-Length − Upload-Offset`). Bij weigeren: `507
  insufficient_storage` met de melding uit de spec; bij een `PATCH` wordt de onvoltooide upload
  daarbij verwijderd (spec, Edge Cases).
- **Schijf toch vol tijdens schrijven**: raakt de schijf ondanks de marge vol (bijv. door andere
  processen), dan gooit de FileStore een fout met `code: 'ENOSPC'`. Die wordt afgevangen
  (tus-hook `onResponseError` of het equivalent in de geïnstalleerde versie) en omgezet naar
  hetzelfde `507 insufficient_storage`; de onvoltooide upload wordt meteen verwijderd in plaats
  van te wachten op de opruimtaak.
- **Rationale**: de controle per `PATCH` dekt hervatten en meerdere uploads tegelijk zonder
  extra administratie; `statfs` is een goedkope systeemaanroep.

## R7. nginx- en API-instellingen voor grote uploads

Doordat tus in delen van 32 MB werkt, is geen enkel verzoek groter dan ±32 MB. Er hoeft dus
geen `client_max_body_size 10g` of urenlange time-out te komen. Wat verandert:

| Plek | Instelling | Was | Wordt | Waarom |
| --- | --- | --- | --- | --- |
| nginx, nieuwe `location ^~ /api/organisation/video-uploads` (geen slash aan het eind, zodat ook `POST /api/organisation/video-uploads` matcht; `^~` gaat vóór andere locaties) | `client_max_body_size` | 3m (server-breed) | `40m` | één deel van 32 MB plus marge |
| idem | `proxy_request_buffering` | `on` (standaard) | `off` | deel direct doorsturen naar de API, niet eerst op de nginx-schijf bufferen |
| idem | `proxy_http_version` | 1.0 | `1.1` | nodig voor streaming zonder buffering |
| idem | `client_body_timeout` | 60s | `120s` | ruimte voor trage verbindingen tussen twee leesacties |
| idem | `proxy_send_timeout` / `proxy_read_timeout` | 60s | `300s` | laatste deel wacht op controle + thumbnail (≤ 60 s, FR-015), met marge |
| nginx, nieuwe `location /internal/videos/` | `internal; alias /data/videos/;` | – | nieuw | alleen bereikbaar via `X-Accel-Redirect` (R8) |
| nginx, overige locaties | `client_max_body_size 3m` | 3m | ongewijzigd | logo's en JSON blijven klein |
| Node (`server.js`) | `server.requestTimeout` | 300 000 ms (standaard) | `900 000` ms | een deel van 32 MB op 1 Mbit/s duurt ±4,5 min; plus controle |
| Express | `express.json` | 100kb | ongewijzigd | tus-`PATCH` heeft `Content-Type: application/offset+octet-stream` en wordt niet door de JSON-parser gelezen |
| tus-server | `maxSize` | – | `VIDEO_MAX_SIZE_GB` | R5 |
| tus-client | `chunkSize` | – | 32 MB | via `GET /api/organisation/videos/upload-settings` |
| Docker Compose | volume `videos` | – | nieuw, op `api` (rw) en `web` (ro) | R2 |

## R8. Thumbnails leveren via X-Accel-Redirect (constitution III)

- **Decision**: `GET /api/organisation/videos/:id/thumbnail` controleert dat de video van de
  eigen organisatie is en niet verwijderd, en antwoordt dan zonder body met
  `X-Accel-Redirect: /internal/videos/thumbnails/<org>/<uuid>.jpg`, `Content-Type: image/jpeg`
  en `Cache-Control: private, max-age=3600`. nginx levert het bestand uit de interne locatie.
  Andere organisaties krijgen `404`. In ontwikkeling en tests (geen nginx,
  `NODE_ENV !== 'production'`) stuurt de API het bestand zelf met `res.sendFile`, net als
  `/media` in feature 001. De videobestanden zelf krijgen in deze feature geen route
  (afspelen valt buiten scope); later gaat dat op dezelfde manier.
- **Rationale**: principe III: de API controleert alleen, nginx levert de bytes. Dezelfde
  aanpak werkt straks voor video's (met range requests door nginx).
- **Alternatives considered**: thumbnails publiek onder `/media/` met een willekeurige naam
  (zoals logo's): eenvoudiger, maar de opdracht en FR-022 vragen echte afscherming per
  organisatie.

## R9. Opruimen van onvoltooide uploads (FR-011, SC-008)

- **Decision**: `backend/src/jobs/uploadCleanup.js`, opgezet zoals de sessie-opruimtaak: bij
  het starten van de API en daarna elke 15 minuten. Per upload in `/data/videos/incoming/` wordt
  de wijzigingstijd (`mtime`) van het databestand bekeken (die verandert bij elk ontvangen deel);
  is die ouder dan `UPLOAD_EXPIRY_HOURS` (standaard 24), dan worden databestand en `.json`-info
  verwijderd. Ook losse `.json`- of databestanden zonder partner worden na die tijd verwijderd.
  Fouten worden gelogd en stoppen de API niet.
- **Rationale**: "24 uur zonder nieuw deel" (FR-011) is precies de `mtime`. Door elke 15 minuten
  te draaien is een onvoltooide upload uiterlijk 24 uur en 15 minuten na het laatste deel weg,
  precies wat SC-008 vraagt. De tests roepen de taak direct aan.
- **Alternatives considered**: de ingebouwde verloopfunctie van `@tus/file-store`
  (`expirationPeriodInMilliseconds` rekent vanaf het aanmaken, niet vanaf het laatste deel).

## R10. Uploadwachtrij en instellingen in de browser (FR-006 – FR-006c)

- **Decision**:
  - Een Pinia-store `frontend/src/stores/uploads.js` beheert alle uploads van het tabblad: een
    wachtrij, maximaal `maxParallelUploads` tegelijk (standaard 1), voortgang, annuleren en
    het resultaat. De store leeft zolang de app open is, dus uploads lopen door bij navigeren
    binnen het CMS (FR-006a).
  - `UploadIndicator.vue` in `OrganisationLayout.vue` toont de store op elke pagina.
  - Een `beforeunload`-handler is actief zolang er een upload loopt of wacht (FR-006c);
    uitloggen vraagt eerst bevestiging en breekt lopende uploads af (`abort` zonder
    `DELETE`, dus later hervatbaar).
  - De instellingen komen van de API: `GET /api/organisation/videos/upload-settings` geeft
    `maxFileSizeBytes`, `maxWidth`, `maxHeight`, `maxParallelUploads`, `chunkSizeBytes` en
    `acceptedExtensions`. De waarden komen uit `.env` (`VIDEO_MAX_SIZE_GB`, `VIDEO_MAX_WIDTH`,
    `VIDEO_MAX_HEIGHT`, `VIDEO_MAX_PARALLEL_UPLOADS`). Zo zijn ze instelbaar zonder nieuwe
    frontend-build, en bestaan de grenzen maar op één plek: server en browser lezen dezelfde
    waarden. De server dwingt `maxParallelUploads` niet af (spec).
  - **Uploadindicator** (na de handmatige tests, FR-006a, FR-006d): een klein rond knopje met
    het uploadpictogram rechtsonder en de totale voortgang als ring; op `/videos` altijd
    zichtbaar, elders alleen met uploads. Het blijft ingeklapt bij starten en voortgang. Op de
    videopagina klapt het vanzelf uit bij klaar, een fout of weigering, een verlopen sessie of een
    verbroken verbinding (de store telt die met `noticeCount`) en na 4 s weer in. Klikken opent
    de lijst, of, zonder uploads, de bestandskiezer van de videopagina (die registreert zich bij de
    store). Bij de start van een upload (`startedCount`) valt een bestandspictogram in het knopje;
    bij `prefers-reduced-motion: reduce` niet. Weigeringen door de server verschijnen daarnaast als melding midden
    in het scherm (`UploadRejectedDialog.vue`, in `OrganisationLayout.vue`, dus op elke pagina).
- **Rationale**: één bron voor de limieten; wijzigen is een `.env`-aanpassing plus herstart van
  de API.
- **Alternatives considered**: Vite-buildvariabele (`VITE_…`): vraagt een nieuwe frontend-build
  bij elke wijziging en dupliceert de 10 GB-grens.

## R11. Bestaand prototype in de frontend

- **Bevinding**: `frontend/src/views/VideosView.vue` is een prototype dat video's in
  `localStorage` bewaart (`stores/app.js`, `data/seed.js`), uploads nabootst en ook WebM en
  vierkante video's accepteert. De cursus-editor (`editor/VideoPicker.vue`) leest dezelfde
  prototypedata.
- **Decision**: `VideosView.vue` wordt herschreven op de echte API. De naam-wijzigen-functie
  en "Gebruikt in" uit het prototype vervallen (buiten scope). De cursus-editor blijft
  voorlopig op de prototypedata draaien; de feature voor cursussen koppelt hem aan de
  videobibliotheek.
- **Rationale**: deze feature levert de echte bibliotheek; de editor valt onder een latere
  feature.

## R12. Testvideo's (SC-004)

- **Decision**: kleine testbestanden (elk < 200 KB, 1–2 s) in
  `backend/tests/fixtures/videos/`, gemaakt met het script
  `backend/tests/fixtures/videos/make-fixtures.sh` (ffmpeg, bron `testsrc`) dat in de repo
  staat zodat ze reproduceerbaar zijn:

  | Bestand | Inhoud | Verwacht |
  | --- | --- | --- |
  | `valid-512x256.mp4` | H.264, 2:1, met AAC-geluid | geaccepteerd |
  | `valid-silent-1024x512.mp4` | H.264, 2:1, zonder geluid | geaccepteerd |
  | `valid-opus-audio-512x256.mp4` | H.264, 2:1, Opus-geluid | geaccepteerd (FR-002a) |
  | `valid-max-5760x2880.mp4` | H.264, precies de maximale resolutie | geaccepteerd |
  | `not-360-640x360.mp4` | H.264, 16:9 | `video_not_360` |
  | `square-1024x1024.mp4` | H.264, 1:1 (3D boven-onder) | `video_not_360` |
  | `too-large-6144x3072.mp4` | H.264, 2:1, boven 5760×2880 | `video_resolution_too_high` |
  | `h265-512x256.mp4` | H.265 in MP4 | `video_unsupported_codec` |
  | `quicktime-512x256.mp4` | H.264 in MOV-container met `.mp4`-naam | `video_unsupported_format` |
  | `audio-only.mp4` | alleen geluid | `video_unreadable` |
  | `corrupt.mp4` | willekeurige bytes | `video_unreadable` |
  | `clip.mov` | H.264, 2:1, `.mov`-extensie | `415` bij aanmaken (extensie) |

- **Rationale**: echte bestanden testen de echte ffprobe-uitvoer; klein genoeg voor git en een
  snelle testrun. Grote bestanden (10 GB, 20 GB vrij) worden niet echt gemaakt: de tests
  sturen een `Upload-Length` boven de grens en vervangen `videoStorage.freeBytes` met een
  `vi.spyOn`.
- De backendtests draaien zoals in 001 tegen `db-test` (`docker compose --profile test run
  --rm api-test`); de test-image krijgt ook `ffmpeg`. Lokaal buiten Docker moet `ffmpeg` op het
  `PATH` staan.
- De frontend-tests van de browsercontrole (R13) gebruiken dezelfde testvideo's: Vitest leest ze
  van schijf en geeft ze als `File` aan de controle, zodat browser en server op precies dezelfde
  bestanden worden getest.

## R13. Controle in de browser vóór de upload (FR-013, FR-013b)

- **Decision**: **mp4box.js** (`mp4box` op npm, BSD-3-Clause, gratis) leest in het uploadvenster
  de gegevens van een MP4, zonder iets te versturen. `frontend/src/lib/videoCheck.js`:
  1. Extensie `.mp4` en grootte ≤ `maxFileSizeBytes` (direct, zonder te lezen).
  2. De bovenste "boxen" van het bestand worden doorlopen met `File.slice` (8 of 16 bytes per
     kop); alleen `ftyp` (merk) en `moov` (beschrijving van de sporen, meestal een paar MB, ook
     als hij aan het eind van een bestand van 10 GB staat) worden echt ingelezen en aan
     mp4box.js gegeven. De videodata (`mdat`) wordt overgeslagen, dus ook een bestand van 10 GB
     is binnen een seconde gecontroleerd.
  3. Regels, gelijk aan de server (R4): merk niet `qt` → anders `video_unsupported_format`; er is
     een videospoor → anders `video_unreadable`; codec `avc1`/`avc3` (H.264) → anders
     `video_unsupported_codec`; breedte = 2 × hoogte → anders `video_not_360`; breedte ≤
     `maxWidth` en hoogte ≤ `maxHeight` → anders `video_resolution_too_high`.
  4. **Niet te lezen** (geen `ftyp`/`moov` gevonden, mp4box.js geeft een fout, of het lezen
     duurt langer dan 10 s): de controle geeft `unknown` en het venster laat de upload toe
     (FR-013b); de servercontrole beslist.
  - Het voorbeeldbeeld in het venster maakt de browser zelf met een `<video>`-element en een
    canvas (beste poging; lukt het niet, dan een grijs vlak). Dat is alleen voor de docent, niet
    voor de controle.
- **Rationale**: mp4box.js is gemaakt om MP4-structuur in de browser te lezen, geeft precies de
  codecnaam, breedte en hoogte die nodig zijn, en is klein. Door alleen `ftyp` en `moov` te lezen
  blijft het snel voor bestanden van 10 GB. Dezelfde regels in browser en server betekenen dat
  het venster en de server hetzelfde zeggen.
- **Alternatives considered**:
  - `<video>`-element met `videoWidth`/`videoHeight` (geeft geen codecnaam; Chrome speelt soms
    H.265 af, dus H.265 zou erdoor komen; het prototype deed dit);
  - mediainfo.js (BSD-2-Clause, leest alles, maar een WebAssembly-module van enkele MB en
    trager op te starten);
  - ffmpeg.wasm (tientallen MB, veel te zwaar om alleen gegevens te lezen);
  - een eigen MP4-parser (meer code en randgevallen dan mp4box.js).

## R14. Melding over onderbroken uploads (FR-009a)

- **Decision**: `tus-js-client` bewaart per gestarte upload in `localStorage` de upload-URL,
  de grootte en de metadata (`filename`, `name`). Bij het openen van de videobibliotheek leest
  de upload-store die lijst via `tus.defaultOptions.urlStorage.findAllUploads()`, slaat uploads
  over die in dit tabblad lopen, en vraagt per upload met één `HEAD` de stand op de server op
  (`Upload-Offset` / `Upload-Length` → percentage). Geeft de server `404` (opgeruimd,
  afgekeurd, of van een eerdere sessie verdwenen), dan wordt de opgeslagen info stil verwijderd.
  "Verwijderen" stuurt een tus-`DELETE` (`tus.Upload.terminate`) en verwijdert de opgeslagen info.
  Kiest de docent hetzelfde bestand, dan hervat de bestaande logica (R1) en verdwijnt de melding.
- **Rationale**: geen database-wijziging nodig (spec), en alleen de browser die de upload begon
  kent hem. De `HEAD`-aanroepen gebeuren alleen bij het openen van de pagina (een actie van de
  docent), dus er is geen polling.
- **Alternatives considered**: onvoltooide uploads per organisatie uit de server opvragen (dan
  ziet elke browser ze en is een lijst op de server nodig; de spec vraagt alleen de eigen
  browser).

## R15. Meldingen in gewone taal (alle weigeringen)

- **Decision**: elke weigering zegt wat er mis is en wat de docent kan doen, zonder termen als
  "2:1", "codec" of "pixels". Getallen komen uit de instellingen. Teksten (API `message` én
  frontend):

  | `code` | Melding |
  | --- | --- |
  | `video_unsupported_format` | Dit bestandstype kan niet worden gebruikt. Kies een MP4-video (de bestandsnaam eindigt op .mp4). |
  | `video_unsupported_codec` | Deze video is op een manier opgeslagen die de VR-bril niet kan afspelen. Sla de video in je bewerkingsprogramma opnieuw op als MP4 met de instelling ‘H.264’. |
  | `video_not_360` | Dit is geen 360°-video. Kies een video die met een 360°-camera is gemaakt; zo'n beeld is twee keer zo breed als hoog. |
  | `video_resolution_too_high` | De beeldkwaliteit van deze video is te hoog voor de VR-bril. Sla de video opnieuw op met een lagere resolutie: maximaal <breedte> × <hoogte> beeldpunten. |
  | `video_unreadable` | Dit bestand kan niet als video worden geopend. Controleer of de video op je computer goed afspeelt en probeer het opnieuw. |
  | `video_too_large` | Deze video is groter dan <max> GB. Maak de video korter of sla hem op in een lagere kwaliteit. |
  | `insufficient_storage` | Er is op dit moment niet genoeg opslagruimte. Neem contact op met de beheerder. |

  Backend: `backend/src/lib/videoMessages.js`; frontend: `frontend/src/lib/videoMessages.js`.
  Beide hebben dezelfde teksten; een test aan elke kant vergelijkt ze met deze tabel.
- **Rationale**: docenten zonder technische kennis moeten zelf weten wat ze moeten doen (NFR-03).
