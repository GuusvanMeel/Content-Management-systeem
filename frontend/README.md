# VR Cursus Studio – frontend

Vue 3-app van het CMS waarin docenten cursussen voor de Quest 3 maken: 360°-video's en
vragen, verbonden tot een route.

- **Via de API** (`/api`): inloggen als beheerder of organisatie, organisaties beheren, het
  logboek en de huisstijl van een organisatie.
- **Nog prototype** (bewaard in `localStorage` van de browser): cursussen, de editor en
  video's. Die komen in latere features op de backend.

## Starten voor ontwikkeling

Vereist Node.js 22. De dev-server stuurt `/api` en `/media` door naar de API op
`http://localhost:3000`, dus start de backend ook (zie de README in de root).

```bash
npm install
npm run dev
```

Zonder HTTPS werkt de sessiecookie alleen als de API draait met `COOKIE_SECURE=false`.

Tests en linten:

```bash
npm test
npm run lint
```

## Weergaven in de editor

Bovenin de editor wissel je tussen drie weergaven:

- **Canvas**: alleen het canvas. Klik op een blok om het in een venster te bewerken.
- **Canvas + paneel**: klik op een blok en rechts verschijnt een paneel om het te bewerken.
- **Lijst**: een leesbaar overzicht van de route. Klik op een onderdeel om het op het canvas te openen.

Verbinden: sleep vanaf de onderrand van een video-blok, of vanaf een letter onder een vraag, naar een ander blok
(het hele blok is dan een doel; de bovenrand licht op). Laat je los op een lege plek, dan kies je een nieuw onderdeel.

## Datamodel van het prototype (`src/lib/course.js`)

- **Cursus**: naam, beschrijving, organisatie, startpunt, onderdelen, publicatiestatus.
- **Video-onderdeel**: één 360°-video, optionele titel, en het volgende onderdeel. Zonder vervolg is het een einde.
- **Vraag**: vraagtekst, 2 tot 4 antwoorden, precies één goed, en per antwoord een vervolgstap.

Publiceren kan pas als alles compleet is (`src/lib/validate.js`).

## Overig

- De huisstijl (kleuren en logo) stelt een organisatie in onder Huisstijl.
- Ongedaan maken en opnieuw in de editor: Ctrl+Z en Ctrl+Y.
