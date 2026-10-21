# Content Management systeem

CMS voor de Futurelabs VR Lifeguard-cursussen. Een beheerder maakt organisaties aan; docenten
loggen in namens hun organisatie. Zie `specs/` voor de specificaties per feature.

- `backend/`: Express 5-API (Node.js 22, ES modules), MariaDB via Knex
- `frontend/`: Vue 3-app (Vite). Cursussen en video's zijn nog een prototype dat alleen in de
  browser bewaart; inloggen, organisaties en huisstijl werken via de API
- `nginx/`: configuratie van de webserver (frontend, `/api` naar de API, `/media` uit het
  uploads-volume)
- `docker-compose.yml`: alle onderdelen als containers

## Vereisten

- Docker met Docker Compose
- Node.js 22 (alleen nodig om zonder Docker te ontwikkelen of te testen)
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

## Sessies

Een sessie eindigt bij uitloggen, bij het sluiten van de browser en na 60 minuten zonder
activiteit. Voor handmatig testen kan `SESSION_IDLE_TIMEOUT_MINUTES` in `.env` tijdelijk lager
(bijvoorbeeld 2); herstart daarna de API (`docker compose up -d api`) en zet de waarde terug
op 60.

## Productie

- Gebruik een echt TLS-certificaat (bijvoorbeeld Let's Encrypt) in plaats van
  `nginx/dev-cert.sh`; zet `server.crt` en `server.key` in `nginx/certs/`.
- Houd `COOKIE_SECURE=true`.
- Database en uploads staan in de Docker-volumes `db-data` en `uploads`; maak daar back-ups
  van.
