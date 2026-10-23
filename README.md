# Content Management systeem

CMS voor de Futurelabs VR Lifeguard-cursussen. Een beheerder maakt organisaties aan; docenten
loggen in namens hun organisatie. Zie `specs/` voor de specificaties per feature.

- `backend/`: Express 5-API (Node.js 22, ES modules), MariaDB via Knex
- `frontend/`: Vue 3-app (Vite). Inloggen, organisaties, huisstijl en de videobibliotheek
  werken via de API; cursussen zijn nog een prototype dat alleen in de browser bewaart (de
  video-kiezer in de cursus-editor gebruikt daarom nog prototypevideo's)
- `nginx/`: configuratie van de webserver (frontend, `/api` naar de API, `/media` uit het
  uploads-volume, video-thumbnails via `X-Accel-Redirect` uit het videos-volume)
- `docker-compose.yml`: alle onderdelen als containers

## Vereisten

- Docker met Docker Compose
- Node.js 22 (alleen nodig om zonder Docker te ontwikkelen of te testen)
- `ffmpeg`/`ffprobe` op het `PATH`, alleen om de backendtests zonder Docker te draaien (de
  API-image heeft ffmpeg al)
- `openssl` voor het lokale certificaat (zit bij Git Bash op Windows)

## Starten

1. Maak `.env` aan op basis van `.env.example` en vul alle waarden in. `.env` wordt nooit
   gecommit. Gebruik lange, willekeurige databasewachtwoorden.
2. Maak een lokaal certificaat aan (de sessiecookie is `Secure`, dus HTTPS is nodig):

   ```bash
   sh nginx/dev-cert.sh
   ```

3. Bouw en start alles:

   ```bash
   docker compose up -d --build
   ```

4. Voer de databasemigraties uit:

   ```bash
   docker compose exec api npx knex migrate:latest
   ```

5. Maak de eerste beheerder aan; het wachtwoord wordt gevraagd (minimaal 10 tekens):

   ```bash
   docker compose exec api node scripts/create-admin.js beheer
   ```

6. Open `https://localhost/admin/login`. De browser waarschuwt voor het zelfondertekende
   certificaat; dat is lokaal verwacht.

Docenten loggen in op `https://localhost/login` met de organisatiecode en het wachtwoord die
de beheerder heeft ingesteld.

## Tests

Backend (integratietests tegen een echte MariaDB in Docker):

```bash
docker compose --profile test run --rm api-test
```

Frontend:

```bash
docker compose run --rm web-build npm test
```

Zonder Docker voor de backend: start alleen de testdatabase
(`docker compose --profile test up -d db-test`, bereikbaar op `localhost:3307`) en voer
daarna `npm test` uit in `backend/`. In `frontend/` werkt `npm test` zonder database.

Linten: `npm run lint` in `backend/` en in `frontend/`.

De testvideo's staan in `backend/tests/fixtures/videos/`. Opnieuw maken (zonder lokale ffmpeg):

```bash
docker run --rm -v "$PWD/backend/tests/fixtures/videos:/work" -w /work alpine:3 sh -c "apk add --no-cache ffmpeg && sh make-fixtures.sh"
```

## Videobibliotheek

Video's (MP4, H.264, twee keer zo breed als hoog, standaard maximaal 5760×2880) worden al in
het uploadvenster gecontroleerd, vóórdat er iets wordt verstuurd: de browser leest met
[mp4box.js](https://github.com/gpac/mp4box.js) alleen de kop van het bestand. Daarna worden ze
hervatbaar geüpload met het tus-protocol en op de server nog een keer gecontroleerd (ffprobe). Ze staan op het eigen Docker-volume
`videos` (`VIDEOS_DIR`, in Docker `/data/videos`), nooit onder `/media`. Instellingen in `.env`
(1 GB = 1024³ bytes):

| Variabele | Standaard | Betekenis |
| --- | --- | --- |
| `VIDEOS_DIR` | – (verplicht) | map voor video's en thumbnails; nooit binnen `UPLOADS_DIR` |
| `VIDEO_MAX_SIZE_GB` | 10 | maximale grootte per video |
| `VIDEO_MIN_FREE_SPACE_GB` | 20 | vrije schijfruimte die na een upload moet overblijven |
| `VIDEO_MAX_PARALLEL_UPLOADS` | 1 | uploads tegelijk per browsertabblad (alleen de browser dwingt dit af) |
| `UPLOAD_EXPIRY_HOURS` | 24 | onvoltooide uploads zonder nieuw deel worden daarna opgeruimd |
| `VIDEO_MAX_WIDTH` | 5760 | maximale breedte in beeldpunten (server en uploadvenster) |
| `VIDEO_MAX_HEIGHT` | 2880 | maximale hoogte in beeldpunten (server en uploadvenster) |
| `VIDEO_DEFAULT_VISIBILITY` | `private` | beschikbaarheid die in het uploadvenster vooraf is gekozen: `public`, `selective` of `private`; een ongeldige waarde geeft `private` en een waarschuwing in de log |

Na een wijziging: `docker compose up -d api`.

De bibliotheek is gedeeld tussen organisaties (specs/003). Per video kiest de uploader
"Algemeen beschikbaar" (alle organisaties), "Selectief beschikbaar" (gekozen organisaties) of
"Alleen eigen organisatie", en optioneel een beschrijving van maximaal 1000 tekens. Alleen de
eigenaar kan naam, beschrijving en beschikbaarheid wijzigen of de video verwijderen; andere
organisaties zien de video met de naam van de eigenaar. Zoeken, sorteren en filteren gebeurt in
de browser op de volledige lijst.

Om een grote bibliotheek te testen (alleen ontwikkeling; zonder `-e NODE_ENV=development`
weigert het script in de productiecontainer):

```bash
docker compose exec -e NODE_ENV=development api node scripts/seed-videos.js <organisatiecode> 200 public
```

Het derde argument is `public` of `private` (standaard `private`).

## Sessies

Een sessie eindigt bij uitloggen, bij het sluiten van de browser en na 60 minuten zonder
activiteit. Voor handmatig testen kan `SESSION_IDLE_TIMEOUT_MINUTES` in `.env` tijdelijk lager
(bijvoorbeeld 2); herstart daarna de API (`docker compose up -d api`) en zet de waarde terug
op 60.

## Productie

- Gebruik een echt TLS-certificaat (bijvoorbeeld Let's Encrypt) in plaats van
  `nginx/dev-cert.sh`; zet `server.crt` en `server.key` in `nginx/certs/`.
- Houd `COOKIE_SECURE=true`.
- Database, uploads en video's staan in de Docker-volumes `db-data`, `uploads` en `videos`;
  maak daar back-ups van. Houd de vrije schijfruimte in de gaten: uploads worden geweigerd als
  er minder dan `VIDEO_MIN_FREE_SPACE_GB` zou overblijven.
