# Site em inglês (i18n) — design

## Objetivo

Criar uma versão em inglês do site emocre.com, extraindo as strings de UI para JSON (uma
chave por idioma) em vez de duplicar HTML manualmente, seguindo o esquema de roteamento por
idioma do repositório `afonsof/afonsof.github.io` (root como redirecionador de idioma +
subpastas por idioma), com a diferença de adicionar duas bandeirinhas de troca de idioma no
topo da página.

## Escopo

Todas as páginas do site: `index.html` (home), `play.html`, `saudalos.html`, `press-kit.md`.

## Estrutura de rotas

- `/` (raiz): página mínima (`layout: null`) com script de detecção de idioma do navegador,
  redirecionando para `/pt/` ou `/en/` — mesma técnica do repositório de referência.
- `/pt/...` e `/en/...`: todo o conteúdo real.
- URLs antigas (`/press-kit`, `/play`, `/saudalos`, hoje na raiz) viram páginas-stub com
  redirect JS/meta-refresh + `<link rel="canonical">` apontando para o equivalente em
  `/pt/...` (idioma histórico do site). Não é um 301 de verdade — o site é hospedado no
  GitHub Pages (estático, sem redirects de servidor) — mas preserva parte do SEO via
  `canonical` e funciona para o usuário.

## Templates: paginação em vez de duplicação

Para não duplicar ~800 linhas de markup por idioma, os templates de página usam a
paginação do Eleventy sobre uma lista de locales, gerando `/pt/...` e `/en/...` a partir de
um único arquivo:

```yaml
pagination:
  data: locales     # _data/locales.json = ["pt", "en"]
  size: 1
  alias: locale
permalink: "/{{ locale }}/index.html"
```

Aplica-se a:
- `index.html` → renomeado (ex: `home.html`) para não colidir com o novo router em `/`;
  permalink `/{{ locale }}/index.html`.
- `play.html` → permalink `/{{ locale }}/play/index.html`.
- `saudalos.html` → permalink `/{{ locale }}/saudalos/index.html`.

`press-kit.md` é conteúdo de artigo (release de imprensa), não strings de UI atomizáveis —
vira **dois arquivos markdown independentes**: `pt/press-kit.md` e `en/press-kit.md`
(conteúdo em inglês a ser escrito/traduzido depois pelo usuário), cada um com seu próprio
front-matter e permalink.

`_includes/default.html` e `_includes/inner.html` recebem `locale` (herdado da cascata de
dados da paginação) e usam para: `<html lang="...">`, montar hrefs com prefixo
`/{{ locale }}/`, e renderizar as bandeirinhas de troca de idioma.

## Extração de strings (i18n JSON)

Um arquivo por idioma, aproveitando o namespacing automático de dados do Eleventy:
`_data/i18n/pt.json` e `_data/i18n/en.json` ficam disponíveis globalmente como
`i18n.pt` / `i18n.en`.

Estrutura por seção de página, espelhando as seções existentes de `index.html`:

```json
{
  "meta": { "title": "...", "description": "..." },
  "nav": { "creatures": "Criaturas", "ranking": "Ranking", "pressKit": "Press Kit", "demo": "Demo" },
  "hero": { "tagline": "...", "desc": "...", "playDemo": "Jogar a Demo", "wishlist": "Wishlist na Steam", "instagram": "Instagram" },
  "mythical": { "eventLabel": "Evento: Criatura Mítica", "exclusive": "Exclusivo", "tag": "CRIATURA MÍTICA", "level": "Nível", "cta": "..." },
  "demo": { "label": "Demo Gratuita", "title": "...", "body": "...", "specs": { "genre": "...", "platforms": "...", "resolution": "...", "status": "..." } },
  "creatures": { "compendium": "Compêndio", "title": "Conheça as Criaturas", "filters": { "all": "Todos", "AL": "Alegria", "RA": "Raiva", "TR": "Tristeza", "CO": "Confiança", "EX": "Expectativa", "NO": "Nojo", "SU": "Surpresa", "ME": "Medo" }, "more": "Serão 104 Emocres — mais em breve..." },
  "modal": { "type": "Tipo", "attributes": "Atributos", "energy": "Energia", "power": "Força", "defense": "Defesa", "speed": "Velocidade", "descriptionFallback": "Descrição em breve...", "close": "Fechar" },
  "pressKit": { "label": "Imprensa", "title": "Press Kit", "body": "...", "quote": "...", "cta": "Ver Press Kit Completo", "facts": { "developer": "Desenvolvedora", "genre": "Gênero", ... } },
  "footer": { "copy": "© 2026 Afonso França de Oliveira. Todos os direitos reservados." },
  "game": { "loading": "Carregando", "close": "Fechar jogo", "wishlistPrompt": { "title": "Curtiu a demo?", "body": "Adicione à sua wishlist na Steam pra não esquecer 😊" } }
}
```

Templates Liquid acessam via `{{ i18n[locale].hero.tagline }}` (colchete + ponto, suportado
pelo LiquidJS usado pelo Eleventy).

Para trechos renderizados via JavaScript (grid de criaturas, modal, overlay do emulador),
o template injeta no `<script>`:

```html
const I18N = {{ i18n[locale] | jsonify }};
const LOCALE = "{{ locale }}";
```

e o JS troca, por exemplo, `c.type1Pt` por `LOCALE === 'en' ? c.type1En : c.type1Pt`, e usa
`I18N.modal.descriptionFallback` em vez do texto fixo `'Descrição em breve...'`.

## Dados de criaturas (`tools/transpile.ts`)

Sem tocar em `vendor/` — apenas edita o transpiler, que já é hand-authored. Adiciona:

- `nameEn`: `c.name_en?.trim() || c.name_pt` — fallback para o nome em português enquanto
  `name_en` não estiver preenchido/limpo no Notion (hoje só ~9 de ~70 criaturas têm valor, e
  são rascunhos de brainstorm, ex: `"Boarash / boar + smash or Furylot"`).
- `descriptionEn`: `c.description_en?.trim() || c.description_pt` — mesmo fallback
  (`description_en` está vazio para 100% das criaturas atualmente).
- `type1En` / `type2En`: nome do tipo em inglês (equivalente inglês do atual `type1Pt`,
  lido de `data/type/types.yml`).

Como o fallback cai para PT automaticamente, o site em inglês pode ir ao ar já e os textos
em inglês aparecem sozinhos conforme forem preenchidos no Notion + `make transpile`.

## Bandeirinhas de troca de idioma

Na `<nav>`, ao lado dos `nav-links`, antes do botão de wishlist: duas bandeiras
(🇧🇷 / 🇺🇸) — a do idioma ativo com opacidade cheia, a outra ~50%. Cada uma linka para a
mesma página no outro idioma, trocando o segmento `/pt/`↔`/en/` da URL atual (computado a
partir de `page.url` no template, sem necessidade de dado extra por página).

## Fora de escopo

- Preencher `description_en`/`name_en` no Notion — trabalho de conteúdo, não deste projeto.
- Nome comercial em inglês diferente para criaturas — os nomes são portmanteau/inventados;
  reaproveita-se o nome em PT quando não houver `name_en` limpo.
- Tradução do conteúdo de `press-kit.md` para inglês — a estrutura de arquivo é criada
  (`en/press-kit.md`), mas o texto em si fica como tarefa separada do usuário.
