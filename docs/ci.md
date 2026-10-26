# CI: wat er bij elke push gebeurt

De workflow staat in `.github/workflows/ci.yml`. Hij draait bij **elke push op elke branch**; er is
geen aparte trigger voor pull requests, zodat niets dubbel draait. Een nieuwe push op dezelfde
branch annuleert de run die nog loopt. De workflow mag alleen de code lezen (`contents: read`).
CodeQL hoort er niet in: dat staat apart aan via de standaardinstelling van GitHub.

## De jobs

De jobs draaien na elkaar. Een job start alleen als de vorige is geslaagd; faalt er een, dan
worden de volgende overgeslagen.

| # | Job | Wat hij doet | Faalt als |
| --- | --- | --- | --- |
| 1 | **Lint (ESLint)** | `npm ci` en `npm run lint` in `backend/` en in `frontend/`, met Node 22 (zelfde versie als de Docker-images). npm-pakketten worden tussen runs gecachet. | ESLint een fout vindt |
| 2 | **Build (Docker images)** | Bouwt de productie-images zoals ze op de VPS draaien: `docker compose build api web`. `web` bouwt daarbij ook de frontend (`npm run build`) en zet hem in nginx. | een image niet bouwt, bijvoorbeeld een buildfout in de frontend |
| 3 | **Tests** | Precies de commando's die je lokaal gebruikt: `docker compose --profile test run --rm --build api-test` (backendtests tegen een tijdelijke MariaDB) en `docker compose run --rm web-build npm test` (frontendtests met Vitest). De frontendtests draaien ook als de backendtests falen, zodat je alle fouten in één run ziet. Daarna worden de testcontainers opgeruimd. | een test faalt |
| — | *Playwright* | Komt later; in `ci.yml` staat een commentaarregel op de plek van de job. | — |
| 4 | **Audit** | `npm audit --audit-level=high` in `backend/` en `frontend/`. Leest alleen de `package-lock.json`. | er een kwetsbaarheid met ernst hoog of kritiek in de afhankelijkheden zit |

### Omgevingsvariabelen en bestanden

- `docker-compose.yml` leest `.env` (via `env_file` van de API-services). `.env` staat niet in git,
  dus de workflow maakt hem op de runner aan:
  - in **Build** als kopie van `.env.example` (lege waarden; er wordt nergens verbonden);
  - in **Tests** met vaste testwaarden voor de tijdelijke testdatabase (`cms_test`). Dat zijn geen
    geheimen: de database bestaat alleen tijdens die job, in het geheugen van de runner.
- Er staan **geen echte geheimen** in de workflow en er zijn geen GitHub-secrets nodig.
- `nginx/certs` (niet in git) is niet nodig: de certificaten worden alleen gemount als de
  `web`-container draait, niet bij het bouwen of testen.

## Een mislukte run bekijken

1. Open de repository op GitHub en ga naar het tabblad **Actions**.
2. Klik op de run (de commitboodschap van je push). Je ziet de vier jobs met een groen vinkje,
   een rood kruis of "skipped" (overgeslagen omdat een eerdere job faalde).
3. Klik op de rode job en open de rode stap. De laatste regels laten meestal de oorzaak zien:
   - **Lint**: bestand, regel en ESLint-regel.
   - **Build**: de Docker-buildstap die faalde, met de foutmelding van `npm run build` of `npm ci`.
   - **Tests**: Vitest toont per falende test de verwachting en de werkelijke waarde. Bij een
     mislukte testjob draait daarna automatisch de stap **"Show container status and logs"**:
     `docker compose ps -a` en `docker compose logs` van de testcontainers (bijvoorbeeld als de
     testdatabase niet opkwam).
   - **Audit**: de tabel van `npm audit` met pakket, ernst en of er een oplossing is.
4. Lokaal hetzelfde draaien:

   ```bash
   docker compose --profile test run --rm --build api-test
   ```

   ```bash
   docker compose run --rm web-build npm test
   ```

   ```bash
   npm audit --audit-level=high
   ```

   (de laatste in `backend/` en in `frontend/`).

5. Een run opnieuw starten (bijvoorbeeld bij een tijdelijke netwerkfout): knop **Re-run jobs**
   rechtsboven in de run.

## Bekend bij invoering (2026-10-26)

De **Audit**-job zal bij de eerste run falen, omdat er nu al meldingen openstaan:

- backend: `multer` en `body-parser` (via Express), ernst hoog; op te lossen zonder major-update;
- frontend: `vitest`/`tinypool` (kritiek, oplossing vraagt een major-update van Vitest),
  `vite` en `vue`/`@vue/server-renderer` (hoog, op te lossen met een gewone update).

Dat is bedoeld gedrag van de job: hij moet falen tot de afhankelijkheden zijn bijgewerkt. De
eerdere jobs (lint, build, tests) worden daar niet door geraakt.
