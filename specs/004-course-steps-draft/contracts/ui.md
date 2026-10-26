# UI-contract: cursuslijst en editor

Uitgangspunt is het prototype (`CoursesView.vue`, `EditorView.vue`, `frontend/src/editor/`).
Wat hier niet staat, blijft zoals in het prototype. Alle teksten Nederlands.

## Cursussen (`/courses`)

- Lijst uit `GET /courses`: naam; "<n> video('s) · <n> vraag/vragen · bewerkt <tijd geleden>";
  label "Concept". Geen "te doen" en geen andere statussen.
- Laden: korte laadtoestand; fout: "De cursussen konden niet worden geladen." met "Opnieuw".
- Leeg: "Er zijn nog geen cursussen." met "Maak de eerste cursus".
- "Nieuwe cursus": venster met Naam en Beschrijving (met tekenteller "<n> tekens over" zoals de
  videobeschrijving, max. 255 / 1000). Leeg → velden rood + "Vul een naam en een beschrijving
  in."; "Aanmaken" maakt de cursus direct aan en opent de editor, met één videoblok "Kies een
  video" dat als "Start" is gemarkeerd (FR-001a).
- Verwijderen (prullenbak per rij): "Cursus verwijderen?" — "“<naam>” wordt verwijderd." —
  "Verwijderen" / "Annuleren"; daarna melding "Cursus verwijderd".

## Editor (`/courses/:id`)

- Laden uit `GET /courses/:id`; niet gevonden → "Cursus niet gevonden" met "Terug naar
  cursussen".
- Balk: terug, label "Concept", naam (opent het venster Naam en beschrijving), weergave
  (Canvas / Canvas + paneel / Lijst, onthouden per browser), ongedaan maken en opnieuw
  (knoppen en Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z), knop **"Opslaan als concept"**.
  - Zonder wijzigingen is de knop uitgeschakeld en staat er "Opgeslagen".
  - Tijdens opslaan: "Opslaan…".
  - Mislukt: melding "De cursus is niet opgeslagen. Probeer het opnieuw."; bij een
    `validation_failed` worden de genoemde velden rood en opent het onderdeel met de eerste fout.
  - Lege naam of beschrijving: opslaan gaat niet; het venster Naam en beschrijving opent met de
    lege velden rood en "Vul een naam en een beschrijving in."
- Weg: "te doen", "Publiceren", "Intrekken", "Gepubliceerd".
- Onderdeel toevoegen: twee aparte knoppen "Video" en "Vraag". Het eerste onderdeel in een lege
  cursus wordt startonderdeel.
- Videoblok: thumbnail, naam en duur van de video; zonder video "Kies een video". Een video die
  niet meer beschikbaar is, ziet er net zo uit (naam, thumbnail, duur). Startlabel "Start".
- Vraagblok: vraagtekst ("Nieuwe vraag" als hij leeg is) en antwoorden A–D, het goede antwoord
  gemarkeerd. Startlabel "Start".
- Geen randen, verbindingspunten of slepen om te koppelen; geen eindmarkering.
- Bewerkformulier video: video-kiezer (de video's uit de bibliotheek: eigen en beschikbaar, met
  eigenaarslabel zoals in de bibliotheek; leeg: "Nog geen video's. Upload ze bij Video's."),
  "Wijzig" (andere video kiezen), "Video weghalen" (onderdeel blijft, zonder video),
  "Startonderdeel" (aan/uit), "Verwijderen". Geen Titel, geen Daarna. Een onbeschikbare video
  staat niet in de kiezer.
- Bewerkformulier vraag: Vraag (max. 1000), Antwoorden (2–4, radioknop voor het goede antwoord,
  toevoegen tot 4, verwijderen tot 2), Feedback (optioneel, max. 1000, "Wat de cursist na het
  antwoorden ziet"), "Startonderdeel", "Verwijderen". Geen koppeling per antwoord.
- Verwijderen van een onderdeel: zonder vraag; melding "Onderdeel verwijderd" met "Ongedaan maken".
- Waarschuwing bij een onbeschikbare video (`available: false`), vóór: het onderdeel verwijderen,
  "Video weghalen", of een andere video kiezen in de kiezer:
  "Video niet meer beschikbaar" — "Deze video is niet meer beschikbaar voor jouw organisatie
  (privé gemaakt of verwijderd). Haal je hem uit de cursus, dan kun je hem daarna niet opnieuw
  toevoegen." — "Doorgaan" (gevaarknop) / "Annuleren". Annuleren: niets verandert (kiezer
  sluit, onderdeel blijft). Doorgaan: de actie gaat door zoals normaal, met "Ongedaan maken" in
  de melding. Bij een beschikbare video verschijnt deze vraag nooit.
- Ongedaan maken na een opgeslagen weghaling of vervanging van een onbeschikbare video (FR-020d):
  het onderdeel komt terug met een leeg videoblok ("Kies een video") en de melding
  "Deze video is niet meer beschikbaar en kan niet worden teruggezet." in het blok en in het bewerkformulier. Opslaan lukt gewoon. Kiest
  de docent een video, dan verdwijnt de melding.
- Lijst-weergave: alle onderdelen als platte lijst, startonderdeel eerst, dan van boven naar
  beneden op het canvas.
- "Canvas ordenen": zet de blokken in de lijstvolgorde onder elkaar.
- Verlaten met niet-opgeslagen wijzigingen: "Wijzigingen niet opgeslagen" — "Je wijzigingen gaan
  verloren als je deze pagina verlaat." — "Verlaten" / "Annuleren". Sluiten of verversen van de
  pagina: de vraag van de browser.
- Sessie verlopen: naar het inlogscherm zonder vertrekvraag.
