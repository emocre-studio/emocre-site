# English Site (i18n) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship an English version of emocre.com at `/en/...`, mirroring `/pt/...`, driven by
extracted i18n JSON instead of duplicated HTML, with a language-router root and a flag
switcher in the nav.

**Architecture:** Eleventy pagination over `_data/locales.json` (`["pt","en"]`) turns each
page template into two build outputs (`/pt/...`, `/en/...`) from one source file. UI copy
lives in `_data/i18n/{pt,en}.json` (Eleventy auto-namespaces these as `i18n.pt` / `i18n.en`).
Root `index.html` becomes a browser-language redirect (`layout: null`); old flat URLs become
redirect stubs pointing at their `/pt/...` equivalent. `tools/transpile.ts` gains
`nameEn`/`descriptionEn`/`type1En`/`type2En` on each creature, falling back to the PT value
when the Notion field is empty/unclean.

**Tech Stack:** Eleventy 3 (Liquid templating, default engine), Dart Sass, no test runner —
verification is `yarn build` succeeding + manual check of `_site/` output + a live dev
server (`yarn start`) at the end.

## Global Constraints

- Never edit `_data/creatures.json` directly — only `tools/transpile.ts` (CLAUDE.md rule 1).
- Never edit `vendor/` (CLAUDE.md rule 2).
- UI copy is pt-BR by default (CLAUDE.md) — the new `i18n.en` values are the only English
  UI copy; everything else stays pt-BR.
- No 301s are possible (GitHub Pages, static hosting) — legacy URL redirects use JS +
  meta-refresh + `<link rel="canonical">`, per the approved spec.
- `name_en`/`description_en` are frequently empty or draft-quality in Notion today —
  `nameEn`/`descriptionEn` in transpile output MUST fall back to the `_pt` value whenever the
  `_en` value is empty or whitespace-only.
- Site currently builds via `yarn build` / `yarn start` (`eleventy --formats=scss,html,md`).

---

### Task 1: `tools/transpile.ts` — add English creature fields

**Files:**
- Modify: `tools/transpile.ts`
- Modify (read-only reference): `vendor/emocre-tools/src/creature/creature.ts` (has
  `name_en`... actually only `description_en` — `name_en` comes from the raw YAML, not the
  typed `Creature` class; confirm via `data/creature/creatures.yml` which already has it)

**Interfaces:**
- Produces: `_data/creatures.json` entries gain `nameEn: string`, `descriptionEn: string`,
  `type1En: string`, `type2En: string | undefined` — consumed by Task 4 (home template JS).

- [ ] **Step 1: Confirm `name_en` is available on the repository's creature objects**

Run: `grep -n "name_en" vendor/emocre-tools/src/creature/creature.ts vendor/emocre-tools/src/creature/creatures-file-repository.ts`

Expected: if `name_en` is NOT assigned onto the `Creature` class in the constructor
(`Object.assign(this, props)` covers it since it's `Partial<Creature> & Partial<CreatureRaw>`,
but `Creature` doesn't declare `name_en` as a typed field), it will still be present at
runtime (via `Object.assign`) but not typed. Use `(c as any).name_en` in `transpile.ts` to
read it without touching `vendor/`.

- [ ] **Step 2: Add an English type-name lookup helper**

`emotionEnToPt` already exists in `@emocre/tools/src/schema/emotion` and reads
`data/type/types.yml`, returning `name_pt` for a given English type code. There is no
existing `emotionEnToEn` (it would be an identity function since the input actually already
is the English key) — instead read `name_en` directly from the types file with a small
inline helper in `transpile.ts` (avoids adding new exports to the gitignored `vendor/`
package). Add near the top of `tools/transpile.ts`:

```ts
import yaml from 'js-yaml'

type TypeRow = {name_en: string; name_pt: string}

async function loadTypeRows(): Promise<TypeRow[]> {
  const raw = await fs.promises.readFile(dataPath('type/types.yml'), 'utf8')
  return yaml.load(raw) as TypeRow[]
}

function typeNameEn(rows: TypeRow[], code: string): string {
  const row = rows.find(r => (r as any).name_en?.toUpperCase().startsWith(code) || (r as any).acronym === code)
  return row?.name_en ?? code
}
```

Before writing this, run `head -5 data/type/types.yml` to confirm the actual field names
(the codebase may key rows by `acronym` rather than a prefix match on `name_en`) and adjust
`typeNameEn` to match reality — do not guess blindly, inspect the file first.

- [ ] **Step 3: Wire the new fields into the `out` mapping**

In `tools/transpile.ts`, inside the `creatures.map(async (c) => {...})` block, add:

```ts
const typeRows = await loadTypeRows()
// ... inside the per-creature map:
nameEn: ((c as any).name_en?.trim()) || c.name_pt,
descriptionEn: (c.description_en?.trim()) || c.description_pt,
type1En: typeNameEn(typeRows, c.type_1 as any),
type2En: c.type_2 ? typeNameEn(typeRows, c.type_2 as any) : undefined,
```

Hoist `const typeRows = await loadTypeRows()` above the `Promise.all(creatures.map(...))`
call so it's only read once, not once per creature.

- [ ] **Step 4: Run the transpiler and inspect the output**

Run: `make transpile`
Expected: no errors; then run
`node -e "const d=require('./_data/creatures.json'); console.log(JSON.stringify(d[0], null, 2))"`
and confirm `nameEn`, `descriptionEn`, `type1En` are present and non-empty (falling back to
the PT value) for the first creature.

- [ ] **Step 5: Commit**

```bash
git add tools/transpile.ts _data/creatures.json
git commit -m "feat: add English name/description/type fields to creature transpile output"
```

---

### Task 2: Locale data + i18n string files

**Files:**
- Create: `_data/locales.json`
- Create: `_data/i18n/pt.json`
- Create: `_data/i18n/en.json`

**Interfaces:**
- Produces: global data `locales` (array `["pt","en"]`), `i18n.pt`, `i18n.en` — consumed by
  every paginated template (Tasks 4–6) and by `_includes/default.html` / `inner.html`
  (Task 7).

- [ ] **Step 1: Create `_data/locales.json`**

```json
["pt", "en"]
```

- [ ] **Step 2: Create `_data/i18n/pt.json`**

This mirrors every hardcoded PT string currently in `index.html`, `play.html`,
`saudalos.html`. Extract verbatim (do not reword) from the current files:

```json
{
  "meta": {
    "homeTitle": "Emocre — Emotion Creatures",
    "homeDescription": "Emocre é um jogo de plataforma e batalhas por turnos onde você integra criaturas emocionais. Conheça os Emocres e embarque nesta aventura única!",
    "playTitle": "Jogar Emocre — Demo",
    "playDescription": "Jogue a demo de Emocre direto no navegador.",
    "saudalosTitle": "Saudalos — Criatura Mítica | Emocre × Retrocon",
    "saudalosDescription": "Saudalos, a Criatura Mítica exclusiva da Retrocon. Jogue em nosso estande para obter esse Emocre."
  },
  "nav": {
    "demo": "Demo",
    "creatures": "Criaturas",
    "ranking": "Ranking",
    "pressKit": "Press Kit",
    "wishlist": "Wishlist na Steam"
  },
  "hero": {
    "tagline": "Dentro da sua mente, as emoções tomaram forma.",
    "desc": "Um jogo de plataforma e batalhas por turnos para Mega Drive e PC. Enfrente criaturas feitas de sentimentos e integre-as.",
    "playDemo": "Jogar a Demo",
    "wishlist": "Wishlist na Steam",
    "instagram": "Instagram"
  },
  "mythical": {
    "eventLabel": "Evento: Criatura Mítica",
    "exclusive": "Exclusivo",
    "tag": "CRIATURA MÍTICA",
    "name": "Saudalos",
    "emotion": "SAUDADE",
    "level": "Nível 5",
    "desc": "Vagaroso pelas profundezas, seus olhos projetam uma luz trêmula que ilumina coisas que não existem mais.",
    "cta": "Jogue em nosso estande para obter esse Emocre"
  },
  "demo": {
    "label": "Demo Gratuita",
    "title": "Jogue agora no navegador",
    "body": "Sem download, sem instalação. Experimente as batalhas por equilíbrio e conheça os primeiros Emocres.",
    "specs": {
      "genreLabel": "Gênero",
      "genreValue": "Monster Tamer / Metroidvania",
      "platformsLabel": "Plataformas",
      "platformsValue": "Mega Drive · PC (Steam)",
      "resolutionLabel": "Resolução",
      "resolutionValue": "320 × 224 (nativa 16-bit)",
      "statusLabel": "Status",
      "statusValue": "Em desenvolvimento (~15%)"
    },
    "playDemo": "Jogar a Demo"
  },
  "creatures": {
    "compendium": "Compêndio",
    "title": "Conheça as Criaturas",
    "filters": {
      "all": "Todos",
      "AL": "Alegria",
      "RA": "Raiva",
      "TR": "Tristeza",
      "CO": "Confiança",
      "EX": "Expectativa",
      "NO": "Nojo",
      "SU": "Surpresa",
      "ME": "Medo"
    },
    "more": "Serão 104 Emocres — mais em breve..."
  },
  "modal": {
    "close": "Fechar",
    "type": "Tipo",
    "attributes": "Atributos",
    "energy": "Energia",
    "power": "Força",
    "defense": "Defesa",
    "speed": "Velocidade",
    "descriptionFallback": "Descrição em breve..."
  },
  "pressKit": {
    "label": "Imprensa",
    "title": "Press Kit",
    "body": "Emocre é um Monster Tamer / Metroidvania 16-bit que une nostalgia com inteligência emocional. Desenvolvido de forma solo por Afonso França de Oliveira, São Paulo, Brasil.",
    "quote": "\"O Emocre nasceu de uma experiência pessoal — eu sempre tive dificuldade para identificar o que eu estava sentindo. Quero que o jogador sinta que integrar uma emoção exige reconhecê-la primeiro.\"",
    "quoteAuthor": "— Afonso França de Oliveira, desenvolvedor",
    "cta": "Ver Press Kit Completo",
    "facts": {
      "developerLabel": "Desenvolvedora",
      "developerValue": "Afonso França de Oliveira (solo dev)",
      "genreLabel": "Gênero",
      "genreValue": "Monster Tamer · Metroidvania · Plataforma",
      "platformsLabel": "Plataformas",
      "platformsValue": "Mega Drive / Genesis · Steam (PC)",
      "resolutionLabel": "Resolução",
      "resolutionValue": "320 × 224 pixels (nativa 16-bit)",
      "languagesLabel": "Idiomas",
      "languagesValue": "Português (BR) · Inglês",
      "statusLabel": "Status",
      "statusValue": "Em desenvolvimento ~15%",
      "creaturesLabel": "Criaturas",
      "creaturesValue": "104 Emocres planejados",
      "inspirationsLabel": "Inspirações",
      "inspirationsValue": "Pokémon · Celeste · Divertidamente · Super Metroid",
      "contactLabel": "Contato"
    }
  },
  "footer": {
    "copy": "© 2026 Afonso França de Oliveira. Todos os direitos reservados."
  },
  "game": {
    "loading": "Carregando",
    "loadingButton": "Carregando...",
    "close": "Fechar jogo",
    "wishlistPromptTitle": "Curtiu a demo?",
    "wishlistPromptBody": "Adicione à sua wishlist na Steam pra não esquecer 😊"
  }
}
```

- [ ] **Step 3: Create `_data/i18n/en.json`**

English translation of every key above, same shape:

```json
{
  "meta": {
    "homeTitle": "Emocre — Emotion Creatures",
    "homeDescription": "Emocre is a platformer and turn-based battle game where you integrate emotional creatures. Meet the Emocres and embark on this unique adventure!",
    "playTitle": "Play Emocre — Demo",
    "playDescription": "Play the Emocre demo right in your browser.",
    "saudalosTitle": "Saudalos — Mythical Creature | Emocre × Retrocon",
    "saudalosDescription": "Saudalos, Retrocon's exclusive Mythical Creature. Play at our booth to get this Emocre."
  },
  "nav": {
    "demo": "Demo",
    "creatures": "Creatures",
    "ranking": "Leaderboard",
    "pressKit": "Press Kit",
    "wishlist": "Wishlist on Steam"
  },
  "hero": {
    "tagline": "Inside your mind, emotions have taken shape.",
    "desc": "A platformer and turn-based battle game for Mega Drive and PC. Face creatures made of feelings and integrate them.",
    "playDemo": "Play the Demo",
    "wishlist": "Wishlist on Steam",
    "instagram": "Instagram"
  },
  "mythical": {
    "eventLabel": "Event: Mythical Creature",
    "exclusive": "Exclusive",
    "tag": "MYTHICAL CREATURE",
    "name": "Saudalos",
    "emotion": "LONGING",
    "level": "Level 5",
    "desc": "Slow through the depths, its eyes cast a flickering light that illuminates things that no longer exist.",
    "cta": "Play at our booth to get this Emocre"
  },
  "demo": {
    "label": "Free Demo",
    "title": "Play now in your browser",
    "body": "No download, no install. Try the equilibrium battles and meet the first Emocres.",
    "specs": {
      "genreLabel": "Genre",
      "genreValue": "Monster Tamer / Metroidvania",
      "platformsLabel": "Platforms",
      "platformsValue": "Mega Drive · PC (Steam)",
      "resolutionLabel": "Resolution",
      "resolutionValue": "320 × 224 (native 16-bit)",
      "statusLabel": "Status",
      "statusValue": "In development (~15%)"
    },
    "playDemo": "Play the Demo"
  },
  "creatures": {
    "compendium": "Compendium",
    "title": "Meet the Creatures",
    "filters": {
      "all": "All",
      "AL": "Joy",
      "RA": "Anger",
      "TR": "Sadness",
      "CO": "Trust",
      "EX": "Anticipation",
      "NO": "Disgust",
      "SU": "Surprise",
      "ME": "Fear"
    },
    "more": "104 Emocres are coming — more soon..."
  },
  "modal": {
    "close": "Close",
    "type": "Type",
    "attributes": "Stats",
    "energy": "Energy",
    "power": "Power",
    "defense": "Defense",
    "speed": "Speed",
    "descriptionFallback": "Description coming soon..."
  },
  "pressKit": {
    "label": "Press",
    "title": "Press Kit",
    "body": "Emocre is a 16-bit Monster Tamer / Metroidvania that blends nostalgia with emotional intelligence. Solo-developed by Afonso França de Oliveira, São Paulo, Brazil.",
    "quote": "\"Emocre was born from a personal experience — I always had trouble identifying what I was feeling. I want players to feel that integrating an emotion means recognizing it first.\"",
    "quoteAuthor": "— Afonso França de Oliveira, developer",
    "cta": "See Full Press Kit",
    "facts": {
      "developerLabel": "Developer",
      "developerValue": "Afonso França de Oliveira (solo dev)",
      "genreLabel": "Genre",
      "genreValue": "Monster Tamer · Metroidvania · Platformer",
      "platformsLabel": "Platforms",
      "platformsValue": "Mega Drive / Genesis · Steam (PC)",
      "resolutionLabel": "Resolution",
      "resolutionValue": "320 × 224 pixels (native 16-bit)",
      "languagesLabel": "Languages",
      "languagesValue": "English · Portuguese (BR)",
      "statusLabel": "Status",
      "statusValue": "In development ~15%",
      "creaturesLabel": "Creatures",
      "creaturesValue": "104 planned Emocres",
      "inspirationsLabel": "Inspirations",
      "inspirationsValue": "Pokémon · Celeste · Inside Out · Super Metroid",
      "contactLabel": "Contact"
    }
  },
  "footer": {
    "copy": "© 2026 Afonso França de Oliveira. All rights reserved."
  },
  "game": {
    "loading": "Loading",
    "loadingButton": "Loading...",
    "close": "Close game",
    "wishlistPromptTitle": "Enjoyed the demo?",
    "wishlistPromptBody": "Add it to your Steam wishlist so you don't forget 😊"
  }
}
```

- [ ] **Step 4: Verify Eleventy exposes the namespaced data**

Run: `yarn build 2>&1 | tail -20`
Expected: build still succeeds (nothing references `i18n` yet, so this just proves the JSON
is valid and doesn't break the data cascade).

- [ ] **Step 5: Commit**

```bash
git add _data/locales.json _data/i18n
git commit -m "feat: add locales list and pt/en i18n string data"
```

---

### Task 3: Root language router + legacy URL redirect stubs

**Files:**
- Modify: `index.html` (becomes the root router; existing homepage content moves to Task 4)
- Create: `legacy-press-kit.html` (permalink `/press-kit/index.html`)
- Create: `legacy-play.html` (permalink `/play/index.html`)
- Create: `legacy-saudalos.html` (permalink `/saudalos/index.html`)

**Interfaces:**
- Consumes: none (static redirect pages).
- Produces: `/`, `/press-kit/`, `/play/`, `/saudalos/` all resolve to a working redirect.

- [ ] **Step 1: Replace `index.html` with the language router**

`index.html` currently holds the homepage (804 lines). Task 4 moves that content to
`home.html`. Before doing that, replace `index.html` entirely with:

```html
---
layout: null
permalink: /index.html
---
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Emocre</title>
  <script>
    if (navigator.language.startsWith('pt')) {
      window.location.replace('/pt/');
    } else {
      window.location.replace('/en/');
    }
  </script>
</head>
<body></body>
</html>
```

- [ ] **Step 2: Create `legacy-press-kit.html`**

```html
---
permalink: /press-kit/index.html
layout: null
---
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="canonical" href="https://emocre.com/pt/press-kit/">
  <meta http-equiv="refresh" content="0; url=/pt/press-kit/">
  <script>window.location.replace('/pt/press-kit/');</script>
</head>
<body></body>
</html>
```

- [ ] **Step 3: Create `legacy-play.html`**

```html
---
permalink: /play/index.html
layout: null
---
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="canonical" href="https://emocre.com/pt/play/">
  <meta http-equiv="refresh" content="0; url=/pt/play/">
  <script>window.location.replace('/pt/play/');</script>
</head>
<body></body>
</html>
```

- [ ] **Step 4: Create `legacy-saudalos.html`**

```html
---
permalink: /saudalos/index.html
layout: null
---
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <link rel="canonical" href="https://emocre.com/pt/saudalos/">
  <meta http-equiv="refresh" content="0; url=/pt/saudalos/">
  <script>window.location.replace('/pt/saudalos/');</script>
</head>
<body></body>
</html>
```

- [ ] **Step 5: Commit**

```bash
git add index.html legacy-press-kit.html legacy-play.html legacy-saudalos.html
git commit -m "feat: root language router + legacy URL redirect stubs"
```

(This will momentarily break the build since `home.html`/`play.html`/`saudalos.html` under
`/pt/` and `/en/` don't exist yet, and the old `play.html`/`saudalos.html` permalinks now
collide with the new legacy stubs — Task 4–6 resolve this in the same work session before
the next `yarn build`. Do not run `yarn build` again until Task 6 is done.)

---

### Task 4: Home page — paginate + wire i18n (`home.html`, was `index.html`)

**Files:**
- Create: `home.html` (moved content from the old `index.html`, adapted)
- Modify: none else in this task

**Interfaces:**
- Consumes: `locales` (Task 2), `i18n.pt` / `i18n.en` (Task 2), `creatures` global data with
  `nameEn`/`descriptionEn`/`type1En`/`type2En` (Task 1), `locale` (pagination alias).
- Produces: `/pt/index.html` and `/en/index.html`.

- [ ] **Step 1: Create `home.html` with pagination front matter**

Take the full body of the old `index.html` (everything after the front matter) and use it
as a base. Front matter:

```yaml
---
layout: default
pagination:
  data: locales
  size: 1
  alias: locale
permalink: "/{{ locale }}/index.html"
eleventyComputed:
  title: "{{ i18n[locale].meta.homeTitle }}"
  description: "{{ i18n[locale].meta.homeDescription }}"
---
```

`eleventyComputed` lets front-matter values reference other data (including the pagination
alias and global `i18n`), which plain YAML front matter can't do — this is the correct
Eleventy mechanism instead of hardcoding title/description per language.

- [ ] **Step 2: Replace hardcoded strings with `i18n[locale].*` lookups**

Apply these replacements inside the body (exact old string → new Liquid expression):

| Old | New |
|---|---|
| `Jogar a Demo` (hero button) | `{{ i18n[locale].hero.playDemo }}` |
| `Dentro da sua mente, as emoções tomaram forma.` | `{{ i18n[locale].hero.tagline }}` |
| `Um jogo de plataforma e batalhas por turnos para Mega Drive e PC. Enfrente criaturas feitas de sentimentos e integre-as.` | `{{ i18n[locale].hero.desc }}` |
| `Wishlist na Steam` (all 4 occurrences: hero, footer, game overlay, wishlist prompt) | `{{ i18n[locale].hero.wishlist }}` (hero/footer/overlay/prompt all share the same key — they're the same copy) |
| `Instagram` | `{{ i18n[locale].hero.instagram }}` |
| `Evento: Criatura Mítica` | `{{ i18n[locale].mythical.eventLabel }}` |
| `Exclusivo` | `{{ i18n[locale].mythical.exclusive }}` |
| `CRIATURA MÍTICA` | `{{ i18n[locale].mythical.tag }}` |
| `Saudalos` (mythical name) | `{{ i18n[locale].mythical.name }}` |
| `SAUDADE` | `{{ i18n[locale].mythical.emotion }}` |
| `Nível 5` | `{{ i18n[locale].mythical.level }}` |
| `Vagaroso pelas profundezas...` | `{{ i18n[locale].mythical.desc }}` |
| `Jogue em nosso estande para obter esse Emocre` | `{{ i18n[locale].mythical.cta }}` |
| `<span class="type-badge type-AL">Alegria</span>` etc (mythical types row) | replace `Alegria`/`Tristeza` with `{{ i18n[locale].creatures.filters.AL }}` / `{{ i18n[locale].creatures.filters.TR }}` |
| `Demo Gratuita` | `{{ i18n[locale].demo.label }}` |
| `Jogue agora no navegador` | `{{ i18n[locale].demo.title }}` |
| `Sem download, sem instalação...` | `{{ i18n[locale].demo.body }}` |
| `Gênero` / `Monster Tamer / Metroidvania` | `{{ i18n[locale].demo.specs.genreLabel }}` / `{{ i18n[locale].demo.specs.genreValue }}` |
| `Plataformas` / `Mega Drive · PC (Steam)` | `{{ i18n[locale].demo.specs.platformsLabel }}` / `{{ i18n[locale].demo.specs.platformsValue }}` |
| `Resolução` / `320 × 224 (nativa 16-bit)` | `{{ i18n[locale].demo.specs.resolutionLabel }}` / `{{ i18n[locale].demo.specs.resolutionValue }}` |
| `Status` / `Em desenvolvimento (~15%)` | `{{ i18n[locale].demo.specs.statusLabel }}` / `{{ i18n[locale].demo.specs.statusValue }}` |
| `Compêndio` | `{{ i18n[locale].creatures.compendium }}` |
| `Conheça as Criaturas` | `{{ i18n[locale].creatures.title }}` |
| filter buttons `Todos`/`Alegria`/`Raiva`/`Tristeza`/`Confiança`/`Expectativa`/`Nojo`/`Surpresa`/`Medo` | `{{ i18n[locale].creatures.filters.all }}` / `.AL` / `.RA` / `.TR` / `.CO` / `.EX` / `.NO` / `.SU` / `.ME` respectively (keep `data-filter="AL"` etc unchanged — those are JS hooks, not copy) |
| `Serão 104 Emocres — mais em breve...` | `{{ i18n[locale].creatures.more }}` |
| `Fechar` (modal close aria-label) | `{{ i18n[locale].modal.close }}` |
| `Tipo` (modal meta label) | `{{ i18n[locale].modal.type }}` |
| `Atributos` | `{{ i18n[locale].modal.attributes }}` |
| `Energia` / `Força` / `Defesa` / `Velocidade` (stat rows) | `{{ i18n[locale].modal.energy }}` / `.power` / `.defense` / `.speed` |
| `Imprensa` | `{{ i18n[locale].pressKit.label }}` |
| `Press Kit` (h2) | `{{ i18n[locale].pressKit.title }}` |
| `Emocre é um Monster Tamer...` (press kit body) | `{{ i18n[locale].pressKit.body }}` |
| press kit quote + author | `{{ i18n[locale].pressKit.quote }}` / `{{ i18n[locale].pressKit.quoteAuthor }}` |
| `Ver Press Kit Completo` | `{{ i18n[locale].pressKit.cta }}` (and change the link's `href` from `/press-kit` to `/{{ locale }}/press-kit/`) |
| press kit fact rows (`Desenvolvedora`, `Gênero`, `Plataformas`, `Resolução`, `Idiomas`, `Status`, `Criaturas`, `Inspirações`, `Contato` + their values) | `{{ i18n[locale].pressKit.facts.developerLabel }}` / `.developerValue`, and so on for every row, matching the `en.json` key names from Task 2 Step 3 |
| footer copyright line | `{{ i18n[locale].footer.copy }}` |
| `Carregando` (game loading text) | `{{ i18n[locale].game.loading }}` |
| `Fechar jogo` (aria-label) / `Fechar` (button text) | `{{ i18n[locale].game.close }}` / `{{ i18n[locale].modal.close }}` |
| `Curtiu a demo?` | `{{ i18n[locale].game.wishlistPromptTitle }}` |
| `Adicione à sua wishlist na Steam pra não esquecer 😊` | `{{ i18n[locale].game.wishlistPromptBody }}` |
| `Carregando...` (JS string in `openGame()`) | see Step 3 below (JS strings use `I18N`, not Liquid, since they run client-side) |

- [ ] **Step 3: Wire locale into the inline `<script>` block**

At the top of the existing `<script>` block (right after `const CREATURES = {{ creatures | jsonify }};`), add:

```html
const LOCALE = "{{ locale }}";
const I18N = {{ i18n[locale] | jsonify }};
```

Then update the JS that currently hardcodes PT:

```js
function buildCard(c) {
  const card = document.createElement('div');
  card.className = 'creature-card';
  card.dataset.types = [c.type1, c.type2].filter(Boolean).join(',');
  const numStr = '#' + String(c.number).padStart(3,'0') + (c.complexTypeName ? ' ' + c.complexTypeName : '');
  const name = LOCALE === 'en' ? c.nameEn : c.name;
  const type1Name = LOCALE === 'en' ? c.type1En : c.type1Pt;
  const type2Name = LOCALE === 'en' ? c.type2En : c.type2Pt;
  card.innerHTML = `
    <span class="creature-number">${numStr}</span>
    <div class="creature-img-wrap">
      <img src="/assets/creatures/${c.emotion}-${c.stage}-art-front.png" alt="${name}" loading="lazy" />
    </div>
    <span class="creature-name">${name}</span>
    <div class="creature-types">
      <span class="type-badge type-${c.type1}">${type1Name}</span>
      ${c.type2 ? `<span class="type-badge type-${c.type2}">${type2Name}</span>` : ''}
    </div>`;
  card.addEventListener('click', () => openModal(c));
  return card;
}
```

```js
function openModal(c) {
  const maxStat = 220;
  const name = LOCALE === 'en' ? c.nameEn : c.name;
  const description = LOCALE === 'en' ? c.descriptionEn : c.description;
  const type1Name = LOCALE === 'en' ? c.type1En : c.type1Pt;
  const type2Name = LOCALE === 'en' ? c.type2En : c.type2Pt;
  const numLabel = '#' + String(c.number).padStart(3,'0') + (c.complexTypeName ? ' ' + c.complexTypeName : '');
  document.getElementById('modalNum').textContent = numLabel;
  document.getElementById('modalName').textContent = name;
  document.getElementById('modalDesc').textContent = description || I18N.modal.descriptionFallback;
  document.getElementById('modalImg').src = `/assets/creatures/${c.emotion}-${c.stage}-art-front.png`;
  document.getElementById('modalImg').alt = name;

  const bar = document.getElementById('modalHeaderBar');
  bar.style.background = TYPE_COLORS[c.type1] || '#77ae77';

  const types = document.getElementById('modalTypes');
  types.innerHTML = `<span class="type-badge type-${c.type1}">${type1Name}</span>${c.type2 ? `<span class="type-badge type-${c.type2}">${type2Name}</span>` : ''}`;
  // ... rest unchanged
```

And in `openGame()`, replace the two hardcoded `'Carregando...'` / `'Jogar a Demo'` strings:

```js
async function openGame() {
  const btn = document.getElementById('heroPlayBtn');
  if (btn) { btn.disabled = true; btn.textContent = I18N.game.loadingButton; }
  document.body.style.overflow = 'hidden';
  document.querySelector('nav').style.display = 'none';
  try {
    await launchEmulator();
  } catch (err) {
    document.querySelector('nav').style.display = '';
    document.body.style.overflow = '';
    throw err;
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><path d="M8 5v14l11-7z"/></svg> ${I18N.hero.playDemo}`; }
  }
}
```

- [ ] **Step 4: Update internal links to be locale-prefixed**

- `href="/press-kit"` → `href="/{{ locale }}/press-kit/"`
- The `if (new URLSearchParams(...).has('play')) window.location.replace('/play')` legacy
  shim at the bottom of the script becomes
  `window.location.replace('/' + LOCALE + '/play/')`.

- [ ] **Step 5: Delete the old `index.html`'s homepage content**

It was already fully replaced by the router in Task 3 Step 1 — confirm `index.html` is now
only the ~15-line router and the homepage body lives solely in `home.html`.

Run: `wc -l index.html home.html`
Expected: `index.html` ~15 lines, `home.html` ~800+ lines.

- [ ] **Step 6: Commit**

```bash
git add home.html index.html
git commit -m "feat: paginate homepage into /pt/ and /en/, wire i18n strings"
```

---

### Task 5: `play.html` — paginate + wire i18n

**Files:**
- Modify: `play.html`

**Interfaces:**
- Consumes: `locales`, `i18n.pt` / `i18n.en`, `locale` (pagination alias).
- Produces: `/pt/play/index.html`, `/en/play/index.html`.

- [ ] **Step 1: Update front matter**

Replace:
```yaml
---
permalink: /play/index.html
---
```
with:
```yaml
---
pagination:
  data: locales
  size: 1
  alias: locale
permalink: "/{{ locale }}/play/index.html"
eleventyComputed:
  pageTitle: "{{ i18n[locale].meta.playTitle }}"
  pageDescription: "{{ i18n[locale].meta.playDescription }}"
---
```

(`play.html` doesn't use the `default`/`inner` layout — it's a standalone full HTML
document — so use plain variable names `pageTitle`/`pageDescription` instead of colliding
with any layout-level `title`/`description`.)

- [ ] **Step 2: Replace the hardcoded `<title>`/`<meta description>`/`<html lang>`**

```html
<html lang="{{ locale }}">
...
<title>{{ pageTitle }}</title>
<meta name="description" content="{{ pageDescription }}">
```

(For `pt`, keep `lang="pt-BR"` — use an `{% if %}`:)

```liquid
<html lang="{% if locale == 'en' %}en{% else %}pt-BR{% endif %}">
```

- [ ] **Step 3: Replace remaining hardcoded strings**

| Old | New |
|---|---|
| `aria-label="Adicionar à wishlist na Steam"` | keep as-is for `pt`, or better: `aria-label="{{ i18n[locale].hero.wishlist }}"` |
| `Wishlist na Steam` (link text, x2) | `{{ i18n[locale].hero.wishlist }}` |
| `Carregando` (loading text) | `{{ i18n[locale].game.loading }}` |
| `aria-label="Fechar jogo"` | `aria-label="{{ i18n[locale].game.close }}"` |
| `Fechar` (button text) | `{{ i18n[locale].modal.close }}` |
| `Curtiu a demo?` | `{{ i18n[locale].game.wishlistPromptTitle }}` |
| `Adicione à sua wishlist na Steam pra não esquecer 😊` | `{{ i18n[locale].game.wishlistPromptBody }}` |

- [ ] **Step 4: Fix the "back to home" redirect in the inline script**

`finalizeClose()` currently does `window.location.href = '/';` — change to
`window.location.href = '/{{ locale }}/';` so closing the game returns to the right locale's
homepage instead of the language router.

- [ ] **Step 5: Commit**

```bash
git add play.html
git commit -m "feat: paginate play page into /pt/ and /en/, wire i18n strings"
```

---

### Task 6: `saudalos.html` — paginate + wire i18n

**Files:**
- Modify: `saudalos.html`

**Interfaces:**
- Consumes: `locales`, `i18n.pt` / `i18n.en`, `locale` (pagination alias).
- Produces: `/pt/saudalos/index.html`, `/en/saudalos/index.html`.

- [ ] **Step 1: Read the full current file first**

Run: `cat saudalos.html` (384 lines — this task wasn't fully read during design; read it
now before editing so no embedded copy is missed. Any hardcoded PT copy discovered beyond
what's already in `i18n.pt.mythical`/`meta.saudalosTitle`/`meta.saudalosDescription` must be
added as new keys to both `_data/i18n/pt.json` and `_data/i18n/en.json` — go back and amend
Task 2's files rather than leaving new strings untranslated.)

- [ ] **Step 2: Update front matter**

Replace:
```yaml
---
permalink: /saudalos/index.html
---
```
with:
```yaml
---
pagination:
  data: locales
  size: 1
  alias: locale
permalink: "/{{ locale }}/saudalos/index.html"
eleventyComputed:
  pageTitle: "{{ i18n[locale].meta.saudalosTitle }}"
  pageDescription: "{{ i18n[locale].meta.saudalosDescription }}"
---
```

- [ ] **Step 3: Replace `<html lang>`, `<title>`, `<meta description>`**

Same pattern as Task 5 Step 2.

- [ ] **Step 4: Replace all hardcoded copy found in Step 1 with `{{ i18n[locale].* }}`**

Reuse `mythical.*` keys already defined in Task 2 for anything matching the homepage's
mythical-creature card (name, emotion, level, description, CTA, event badge). Add any
saudalos-specific copy (e.g. kiosk-only instructions) as new `i18n.*.saudalos.*` keys in
both JSON files if present.

- [ ] **Step 5: Commit**

```bash
git add saudalos.html _data/i18n/pt.json _data/i18n/en.json
git commit -m "feat: paginate saudalos kiosk page into /pt/ and /en/, wire i18n strings"
```

---

### Task 7: `press-kit.md` — split into `pt/press-kit.md` and `en/press-kit.md`

**Files:**
- Delete: `press-kit.md`
- Create: `pt/press-kit.md`
- Create: `en/press-kit.md`

**Interfaces:**
- Produces: `/pt/press-kit/index.html`, `/en/press-kit/index.html`.

- [ ] **Step 1: Read the full current `press-kit.md`**

Run: `cat press-kit.md` (100 lines) to get the exact current PT content.

- [ ] **Step 2: Create `pt/press-kit.md`**

Front matter:
```yaml
---
layout: inner
title: Press Kit
permalink: /pt/press-kit/index.html
eleventyComputed:
  locale: "pt"
---
```
Body: the exact current content of `press-kit.md`, unchanged.

- [ ] **Step 3: Create `en/press-kit.md`**

Front matter:
```yaml
---
layout: inner
title: Press Kit
permalink: /en/press-kit/index.html
eleventyComputed:
  locale: "en"
---
```
Body: full English translation of the PT press kit (headline, dateline, "About the Game",
"Specs and Availability" sections, quote, facts) — translate faithfully, keep all bolded
terms (**Emocre**, **Emocres**, mechanic names) bolded, keep the Plutchik wheel emotion list
translated to English (Joy, Anger, Sadness, Disgust, Fear, Trust, Surprise, Anticipation),
and translate "Divertidamente" (the Pixar film's Brazilian title) to its English title
"Inside Out".

- [ ] **Step 4: Delete the old `press-kit.md`**

```bash
git rm press-kit.md
```

- [ ] **Step 5: Commit**

```bash
git add pt/press-kit.md en/press-kit.md
git commit -m "feat: split press-kit.md into pt/en translated versions"
```

---

### Task 8: `_includes/default.html` / `_includes/inner.html` — locale awareness + flag switcher

**Files:**
- Modify: `_includes/default.html`
- Modify: `_includes/inner.html`

**Interfaces:**
- Consumes: `locale` (from the page's pagination alias or `eleventyComputed.locale`),
  `i18n.pt` / `i18n.en`, `page.url`.
- Produces: locale-correct `<html lang>`, locale-prefixed nav hrefs, and a working flag
  switcher on every page.

- [ ] **Step 1: Add a locale-alternate-URL computation**

Both includes need to link to "this same page in the other language." Since every page's
URL is `/{{ locale }}/rest/of/path`, compute the alternate by swapping the first path
segment. Add this Liquid snippet near the top of both `default.html` and `inner.html`
(right after the front matter, before `<!DOCTYPE html>`):

```liquid
{% assign otherLocale = 'en' %}
{% if locale == 'en' %}{% assign otherLocale = 'pt' %}{% endif %}
{% assign otherUrl = page.url | replace: '/pt/', '/' | replace: '/en/', '/' %}
{% assign otherUrl = '/' | append: otherLocale | append: otherUrl %}
```

This strips whichever locale prefix is present and rebuilds the URL with the other locale's
prefix — works because every paginated page's URL always starts with `/pt/` or `/en/`.

- [ ] **Step 2: Update `_includes/default.html`**

```html
<!DOCTYPE html>
<html lang="{% if locale == 'en' %}en{% else %}pt-BR{% endif %}">

<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-6N4HC3X6MT"></script>
  <script>
    window.dataLayer = window.dataLayer || []
    function gtag() { dataLayer.push(arguments) }
    gtag('js', new Date())
    gtag('config', 'G-6N4HC3X6MT')
    function trackEvent(name, params) { if (typeof gtag === 'function') gtag('event', name, params || {}) }
  </script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title }}</title>
  <meta name="description" content="{{ description }}">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32x32.png">
  <link rel="stylesheet" href="/assets/css/main.css">
  <meta property="og:title" content="{{ title | default: site.title }}">
  <meta property="og:description" content="{{ description | default: site.description }}">
  <meta property="og:url" content="{{ site.url }}{{ page.url }}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="{{ site.url }}/assets/og-image.png">
  <meta property="og:image:width" content="460">
  <meta property="og:image:height" content="215">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="{{ site.url }}/assets/og-image.png">
</head>

<body>
<nav>
  <a class="nav-logo" href="/{{ locale }}/">
    <img src="/assets/logo.png" alt="Emocre" />
  </a>
  <ul class="nav-links">
    <li class="nav-demo-only"><a href="#demo" onclick="event.preventDefault(); window.scrollTo({top: document.getElementById('demo').offsetTop - 60, behavior: 'smooth'})">{{ i18n[locale].nav.demo }}</a></li>
    <li><a href="#creatures" onclick="event.preventDefault(); window.scrollTo({top: document.getElementById('creatures').offsetTop - 60, behavior: 'smooth'})">{{ i18n[locale].nav.creatures }}</a></li>
    <li><a href="https://app.emocre.com/leaderboard">{{ i18n[locale].nav.ranking }}</a></li>
    <li><a href="/{{ locale }}/press-kit/">{{ i18n[locale].nav.pressKit }}</a></li>
  </ul>
  <div class="nav-langs">
    <a href="/pt/{{ page.url | replace: '/pt/', '' | replace: '/en/', '' }}" class="lang-flag{% if locale == 'pt' %} active{% endif %}" aria-label="Português" title="Português">🇧🇷</a>
    <a href="/en/{{ page.url | replace: '/pt/', '' | replace: '/en/', '' }}" class="lang-flag{% if locale == 'en' %} active{% endif %}" aria-label="English" title="English">🇺🇸</a>
  </div>
  <div class="nav-cta">
    <a href="https://store.steampowered.com/app/3848350/Emocre" target="_blank" class="btn btn-steam" onclick="trackEvent('wishlist_click', { location: 'header' })">
      <svg viewBox="0 0 64 64" fill="currentColor"><path d="M0.028 29.874C1.125 13.193 15.017 0 31.993 0c17.693 0 32.035 14.327 32.035 32C64.028 49.673 49.686 64 31.993 64c-14.437 0-26.646-9.549-30.647-22.665L13.472 46.333c.601 2.728 2.483 5.12 5.248 6.27 4.53 1.88 9.728-.26 11.616-4.782.483-1.157.716-2.403.684-3.656L42.225 36.16l.276.005C49.213 36.165 54.669 30.699 54.669 23.985c0-6.714-5.446-12.16-12.168-12.174C35.792 11.811 30.333 17.271 30.333 23.985l.01.0.003.158L22.507 35.518c-1.269-.058-2.543.165-3.752.662-.526.214-1.029.482-1.499.8L.042 29.893c0 0 0 .001 0 .004C.037 29.889.033 29.882.028 29.874zm28.433 17.161c-1.456 3.5-5.472 5.147-8.963 3.694-1.549-.65-2.805-1.847-3.528-3.362l3.961 1.64c2.574 1.07 5.528-.147 6.599-2.719 1.072-2.573-.145-5.527-2.718-6.601l-4.105-1.695c1.58-.6 3.376-.62 5.056.077 1.702.703 3.003 2.027 3.7 3.72.696 1.693.692 3.56-.01 5.246h.008zM42.512 32.1c-4.478-.012-8.103-3.64-8.107-8.113.005-4.472 3.63-8.099 8.107-8.111 4.478.011 8.104 3.638 8.109 8.111-.004 4.474-3.63 8.102-8.109 8.113zm-6.076-8.126c-.002 3.361 2.723 6.088 6.088 6.093 3.365-.003 6.092-2.731 6.09-6.093 0-3.365-2.732-6.095-6.09-6.095-3.365.006-6.09 2.734-6.087 6.095h-.001z"/></svg>
      {{ i18n[locale].hero.wishlist }}
    </a>
  </div>
</nav>
<main class="site-content">
  {{ content }}
</main>
</body>

</html>
```

- [ ] **Step 3: Add flag switcher CSS**

Add to `assets/css/main.css` (find the `.nav-cta` or `.nav-links` rule and add nearby):

```css
.nav-langs {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin: 0 0.75rem;
}

.lang-flag {
  font-size: 1.1rem;
  line-height: 1;
  opacity: 0.45;
  text-decoration: none;
  transition: opacity 0.2s ease;
}

.lang-flag:hover {
  opacity: 0.8;
}

.lang-flag.active {
  opacity: 1;
}
```

Run: `grep -n "\.nav-cta\b" assets/css/main.css assets/css/*.scss 2>/dev/null` first to find
the right file/location to add this next to (the site's SCSS entry point may not be
`main.css` directly — check `assets/css/` for `.scss` sources compiled by the Eleventy scss
extension).

- [ ] **Step 4: Update `_includes/inner.html`**

Apply the same `<html lang>`, nav-links, and flag-switcher changes as Step 2, matching
`inner.html`'s existing simpler nav (no demo/creatures anchor links, no CTA button):

```html
<!DOCTYPE html>
<html lang="{% if locale == 'en' %}en{% else %}pt-BR{% endif %}">

<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-6N4HC3X6MT"></script>
  <script>
    window.dataLayer = window.dataLayer || []
    function gtag() { dataLayer.push(arguments) }
    gtag('js', new Date())
    gtag('config', 'G-6N4HC3X6MT')
    function trackEvent(name, params) { if (typeof gtag === 'function') gtag('event', name, params || {}) }
  </script>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ title }}</title>
  <meta name="description" content="{{ description }}">
  <link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32x32.png">
  <link rel="stylesheet" href="/assets/css/main.css">
  <meta property="og:title" content="{{ title }}">
  <meta property="og:description" content="{{ description }}">
  <meta property="og:url" content="{{ site.url }}{{ page.url }}">
  <meta property="og:type" content="website">
  <meta property="og:image" content="{{ site.url }}/assets/og-image.png">
  <meta property="og:image:width" content="460">
  <meta property="og:image:height" content="215">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:image" content="{{ site.url }}/assets/og-image.png">
</head>

<body>
<nav>
  <a class="nav-logo" href="/{{ locale }}/">
    <img src="/assets/logo.png" alt="Emocre" />
  </a>
  <ul class="nav-links">
    <li class="nav-demo-only"><a href="/{{ locale }}/#demo">{{ i18n[locale].nav.demo }}</a></li>
    <li><a href="/{{ locale }}/#creatures">{{ i18n[locale].nav.creatures }}</a></li>
    <li><a href="https://app.emocre.com/leaderboard">{{ i18n[locale].nav.ranking }}</a></li>
    <li><a href="/{{ locale }}/press-kit/">{{ i18n[locale].nav.pressKit }}</a></li>
  </ul>
  <div class="nav-langs">
    <a href="/pt/{{ page.url | replace: '/pt/', '' | replace: '/en/', '' }}" class="lang-flag{% if locale == 'pt' %} active{% endif %}" aria-label="Português" title="Português">🇧🇷</a>
    <a href="/en/{{ page.url | replace: '/pt/', '' | replace: '/en/', '' }}" class="lang-flag{% if locale == 'en' %} active{% endif %}" aria-label="English" title="English">🇺🇸</a>
  </div>
  <div class="nav-cta"></div>
</nav>
<main class="site-content">
  <div class="inner-page">
    <div class="inner-content">
      {{ content }}
    </div>
  </div>
</main>
</body>

</html>
```

Note: `press-kit.md` (Task 7) sets `locale` via `eleventyComputed`, not pagination, so
`locale` is available in `inner.html` either way — Eleventy's data cascade exposes both
front-matter and pagination-alias data identically to layouts.

- [ ] **Step 5: Commit**

```bash
git add _includes/default.html _includes/inner.html assets/css/main.css
git commit -m "feat: locale-aware nav + language flag switcher in default/inner layouts"
```

---

### Task 9: Full build verification + local dev server

**Files:** none (verification only)

- [ ] **Step 1: Full clean build**

Run: `rm -rf _site && yarn build`
Expected: build completes with no errors. If Liquid errors reference `i18n[locale]` being
undefined, check that every page generating output has `locale` set (either via
`pagination.alias` or `eleventyComputed.locale`).

- [ ] **Step 2: Verify the expected output tree**

Run: `find _site -maxdepth 2 -type d | sort`
Expected to include: `_site/pt`, `_site/en`, `_site/pt/play`, `_site/en/play`,
`_site/pt/press-kit`, `_site/en/press-kit`, `_site/pt/saudalos`, `_site/en/saudalos`, plus
`_site/press-kit`, `_site/play`, `_site/saudalos` (the legacy redirect stubs) and
`_site/index.html` (the router).

- [ ] **Step 3: Spot-check English content actually rendered**

Run: `grep -o "Meet the Creatures" _site/en/index.html`
Expected: one match.
Run: `grep -o "Conheça as Criaturas" _site/pt/index.html`
Expected: one match.
Run: `grep -o "Meet the Creatures" _site/pt/index.html`
Expected: no output (PT page must not contain English strings).

- [ ] **Step 4: Verify the legacy redirect + root router**

Run: `grep -o "window.location.replace('/pt/press-kit/')" _site/press-kit/index.html`
Expected: one match.
Run: `grep -o "navigator.language" _site/index.html`
Expected: one match.

- [ ] **Step 5: Start the local dev server for manual review**

Run: `yarn start` (this runs `eleventy --formats=scss,html,md --serve`, which watches and
serves — leave it running in the foreground/background so the user can open it in a
browser). Report the local URL Eleventy prints (typically `http://localhost:8080`) back to
the user.

No commit for this task — it's verification-only, and Task 9 Step 5 is a long-running
process, not a file change.
