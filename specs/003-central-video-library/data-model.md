# Data Model: Centrale videobibliotheek, beschikbaarheid en beschrijvingen

**Feature**: [spec.md](spec.md) | **Research**: [research.md](research.md)

Namen volgen het ERD (`docs/Diagrams.simp`) letterlijk. `Video` bestaat al (feature 002) en
komt overeen met het ERD; deze feature voegt alleen `VideoAccess` toe. Het ERD hoeft niet te
worden aangepast.

## Video (bestaat, ongewijzigd)

Alleen de velden die in deze feature betekenis krijgen; de rest staat in
[data-model van 002](../002-video-library/data-model.md).

| Veld | Type | Null | Regels in deze feature |
| --- | --- | --- | --- |
| `name` | VARCHAR(255) | nee | getrimd, 1–255 tekens; nu ook te wijzigen door de eigenaar (FR-015) |
| `description` | TEXT | ja | **nu in gebruik**; getrimd; `NULL` als leeg of alleen witruimte; maximaal 1000 tekens (Unicode-codepunten); regeleinden bewaard als `\n` (FR-020) |
| `visibility` | ENUM(`public`, `selective`, `private`) | nee | **nu te kiezen**: `public` = Algemeen beschikbaar, `selective` = Selectief beschikbaar, `private` = Alleen eigen organisatie (FR-001). Bestaande video's: `private` (FR-005) |
| `ownerOrganisationId` | INT, FK → `Organisation.id` | nee | ongewijzigd; bepaalt wie mag wijzigen en verwijderen (FR-014) |
| `deletedAt` | DATETIME | ja | ongewijzigd: zacht verwijderen (FR-018) |

## VideoAccess (nieuw)

| Veld | Type | Null | Regels |
| --- | --- | --- | --- |
| `videoId` | INT UNSIGNED, FK → `Video.id` | nee | deel van de primaire sleutel |
| `organisationId` | INT UNSIGNED, FK → `Organisation.id` | nee | deel van de primaire sleutel; index (opzoeken "met mij gedeeld") |

- Primaire sleutel (`videoId`, `organisationId`): een organisatie staat hooguit één keer bij een
  video.
- Alleen regels voor video's met `visibility = 'selective'`. Bij een wijziging naar een andere
  beschikbaarheid worden alle regels van de video verwijderd, in dezelfde transactie (FR-007).
- Bij `selective` minstens één regel voor een actieve organisatie, nooit de eigenaar zelf
  (FR-004). De database dwingt dat niet af; de service wel (`videoChoices.js`).
- Regels van een verwijderde organisatie blijven staan en worden genegeerd (research R11).
- Regels van een zacht verwijderde video blijven staan (constitution V: de video en zijn
  gegevens blijven bewaard).

## Zichtbaarheid

Een video is zichtbaar voor organisatie X als al deze voorwaarden gelden (research R1):

```text
Video.deletedAt IS NULL
AND eigenaar.deletedAt IS NULL
AND (
      Video.ownerOrganisationId = X
   OR Video.visibility = 'public'
   OR (Video.visibility = 'selective' AND VideoAccess(videoId, X) bestaat)
)
```

| Beschikbaarheid | Eigenaar | Gekozen organisatie | Andere organisatie |
| --- | --- | --- | --- |
| `public` | ziet en wijzigt | ziet | ziet |
| `selective` | ziet en wijzigt | ziet | ziet niet |
| `private` | ziet en wijzigt | — | ziet niet |

"Ziet" = in de bibliotheek, in het videovenster en de thumbnail. Wijzigen en verwijderen kan
alleen de eigenaar.

## Overgangen van beschikbaarheid

```text
private ──▶ public      ruimer: geen bevestiging
private ──▶ selective   ruimer: geen bevestiging; VideoAccess-regels toegevoegd
public  ──▶ selective   beperkter: bevestiging met aantal dat toegang verliest
public  ──▶ private     beperkter: bevestiging
selective ─▶ public     ruimer: VideoAccess-regels verwijderd
selective ─▶ private    beperkter: bevestiging; VideoAccess-regels verwijderd
selective ─▶ selective  andere organisaties: bevestiging alleen als er organisaties afvallen
```

Het aantal dat toegang verliest = (huidige groep) − (nieuwe groep), waarbij de groep van
`public` alle actieve organisaties behalve de eigenaar is (research R6).

## Standaardbeschikbaarheid (geen tabel)

`VIDEO_DEFAULT_VISIBILITY` in `.env`: `public`, `selective` of `private`; ontbreekt of ongeldig
→ `private` (research R3). Alleen de voorselectie in het uploadvenster; bestaande video's
veranderen niet.

## Relaties

```text
Organisation 1 ──< Video (eigenaar)
Video        1 ──< VideoAccess >── 1 Organisation (gekozen)
```
