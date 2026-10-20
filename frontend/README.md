# VR Cursus Studio – prototype

Prototype van het beheersysteem waarin docenten cursussen voor de Quest 3 maken:
360°-video’s en vragen, verbonden tot een route. Er is geen backend; alles wordt in de browser bewaard.

## Starten

Vereist Node.js 18 of nieuwer.

```bash
npm install
npm run dev
```

Open daarna de link die in de terminal verschijnt (meestal http://localhost:5173).

## Weergaven in de editor

Bovenin de editor wissel je tussen drie weergaven:

- **Canvas**: alleen het canvas. Klik op een blok om het in een venster te bewerken.
- **Canvas + paneel**: klik op een blok en rechts verschijnt een paneel om het te bewerken.
- **Lijst**: een leesbaar overzicht van de route. Klik op een onderdeel om het op het canvas te openen.

Verbinden: sleep vanaf de onderrand van een video-blok, of vanaf een letter onder een vraag, naar een ander blok
(het hele blok is dan een doel; de bovenrand licht op). Laat je los op een lege plek, dan kies je een nieuw onderdeel.

## Datamodel (`src/lib/course.js`)

- **Cursus**: naam, beschrijving, organisatie, startpunt, onderdelen, publicatiestatus.
- **Video-onderdeel**: één 360°-video, optionele titel, en het volgende onderdeel. Zonder vervolg is het een einde.
- **Vraag**: vraagtekst, 2 tot 4 antwoorden, precies één goed, en per antwoord een vervolgstap.

Publiceren kan pas als alles compleet is (`src/lib/validate.js`).

## Overig

- Organisaties wisselen kan via de naam linksboven (alleen voor het prototype).
- Huisstijl (kleuren en logo) stel je in onder Organisatie. Daar kun je ook de voorbeeldgegevens herstellen.
- Ongedaan maken en opnieuw: Ctrl+Z en Ctrl+Y.
