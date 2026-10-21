# UI-contract: schermen en routes

Frontend-routes (Vue Router). Routenamen en code in het Engels, teksten op het scherm in het
Nederlands. "Guard" beschrijft wat er gebeurt als de juiste sessie ontbreekt.

| Route | Scherm | Guard | Huisstijl |
| --- | --- | --- | --- |
| `/login` | Inloggen als organisatie: organisatiecode, wachtwoord; tekst "Wachtwoord vergeten? Neem contact op met de beheerder." (FR-020) | ingelogde organisatie → `/` | standaard |
| `/admin/login` | Inloggen als beheerder: gebruikersnaam, wachtwoord | ingelogde beheerder → `/admin` | standaard |
| `/` | Startscherm organisatie (naam van de organisatie; plek voor latere cursusfuncties) | geen organisatiesessie → `/login` | organisatie |
| `/settings/style` | Huisstijl: twee kleurkiezers, logo-upload met voorbeeld, knoppen "Terug naar standaard" | idem | organisatie |
| `/admin` | Overzicht organisaties: naam, code, knoppen wijzigen/wachtwoord/verwijderen, knop "Nieuwe organisatie" | geen beheerderssessie → `/admin/login` | standaard |
| `/admin/organisations/new` | Formulier: naam; code (vooraf ingevuld met voorstel, aanpasbaar, FR-004a); wachtwoord | idem | standaard |
| `/admin/organisations/:id` | Wijzigen naam/code; aparte sectie "Wachtwoord opnieuw instellen" | idem | standaard |
| `/admin/log` | Logboek, nieuwste eerst, gepagineerd | idem | standaard |

Gedrag:

- Een organisatie die `/admin...` opent, krijgt de beheer-inlogpagina te zien, nooit
  beheergegevens (FR-002). De echte afscherming zit in de API; de guard is alleen gemak.
- Verwijderen vraagt eerst een bevestiging met de naam van de organisatie (FR-011).
- Na een `401` van de API (bijv. omdat de beheerder de code wijzigde of de organisatie
  verwijderde, FR-010) gaat de frontend naar de juiste inlogpagina met de melding "Je bent uitgelogd. Log opnieuw in."
- Er is geen registratie- en geen "wachtwoord wijzigen"-scherm voor organisaties (FR-003,
  FR-009).
- Het codeveld bij aanmaken vraagt een nieuw voorstel op zodra de naam wijzigt, zolang de
  beheerder de code nog niet zelf heeft aangepast.
