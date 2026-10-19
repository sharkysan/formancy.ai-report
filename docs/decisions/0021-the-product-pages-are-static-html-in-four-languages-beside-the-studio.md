# 0021 — The product's pages are static HTML in four languages, built here and served beside the Studio at formancy.ai/report/

- **Status:** accepted; its faces are the pages' own copies since [0023](0023-the-studio-and-the-pages-serve-their-own-faces-and-ask-no-other-site-for-anything.md),
  not Google's, and no page asks another site for anything; extended by
  [0024](0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md),
  the QR-bill page and the invoice samples' pictures, and checks of a
  link's heading and of a picture's description against its figure; and
  by [0028](0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md),
  the EPC QR code page, a word check refusing the name 0025 keeps off
  everything here, and every page's status read by the site before it
  renders any; its room by import of the Studio's copy superseded by
  [0034](0034-the-studio-and-the-pages-wear-formancys-room-by-importing-the-released-one.md): the pages import
  formancy's released `@formancy/themes/room.css` first, then the Studio's
  stylesheets
- **Date:** 2026-10-17
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The pages' suite, `apps/pages`, in CI's `test` job.** Every check
    reads the built HTML back with the DOM, as a crawler reads it, without
    running a script. `src/site.test.ts` runs them all over the pages this
    checkout builds and holds the URL scheme. `src/checks.test.ts` breaks
    each check's subject once and watches the check name it:
    - a group missing in a language;
    - `<html lang>` that is not the page's language;
    - a title over 60 characters, a description outside 70 to 160, and
      two pages sharing a title or a description;
    - a canonical that is not the page's own address;
    - alternates without x-default, or not named back;
    - Open Graph whose address, title or description is not the page's,
      and X's card missing, or asking for a large picture on a page that
      names none;
    - a sitemap that misses a page, lists one that is not built, or
      gives other alternates than the page's head;
    - a second h1, content that is not in the HTML, a script that is not
      JSON-LD, a handler attribute;
    - a picture without a description or a size, a link whose words say
      nothing, a language switcher missing a language;
    - JSON-LD that does not parse, names another licence, makes an offer
      or has another breadcrumb;
    - a link to a page, a file or an id that is not built, to a file this
      repository does not hold, to a package it does not publish, to
      another mail address, or over http;
    - "open source" with no negation directly before it, in each
      language, and each denial the pages may say it with; HL7 or FHIR
      named without HL7's notice word for word; and an amount of money,
      with its currency's code, sign or name, before the number or after.

    The open-source check passed a page that called the product open
    source when it was first written: a heading and the next paragraph
    were read as one sentence, and the paragraph's denial counted for the
    heading. It reads each block on its own now. Review then found it
    passing a sentence with a denial anywhere in it, "It is open source,
    no strings attached.", and the price check passing an amount by its
    currency's name, "500 Franken", or as "SFr. 500". Each case failed
    before its fix. The checks of two pages sharing a description and of
    Open Graph's title and description were watched failing with each
    taken out.
  - **`apps/pages/scripts/write-site.test.mjs`.** The build's writer, run
    into a temporary directory, writes every page of the site the suite
    checks with the same HTML, the sitemap, the stylesheet and the
    pictures, byte for byte, and nothing else, and leaves nothing of an
    earlier build. Watched failing with the text written as Latin-1 and
    the directory not emptied first.
  - **`apps/pages/src/stylesheet.test.ts`.** pages.css imports the
    Studio's `room.css` first, imports nothing but the Studio's
    stylesheets, and declares no colour and no custom property of its own.
    Watched failing with a colour typed into the primary action and
    `--muted` set again. It first passed a palette copied into apps/pages
    and imported in double quotes, which the build inlines as it inlines
    single: it read single quotes alone. It reads every `@import` now.
  - **`apps/pages/src/figures.test.ts`.** Every quote in a picture's
    description, in every language, is a line `docs/images/pictures.json`
    records for that page. The pictures served are the ones copied from
    `docs/images`. A licence row the product page has no words for stops
    the render.
  - **`apps/pages/scripts/inputs.test.mjs`.** The release, the licence's
    terms, the fonts and the pictures' sizes are read from their files, and
    each reader refuses what it cannot read. Turbo, asked with a dry run,
    hashes every file the build reads and every script of the repository
    it imports. Watched failing with `CHANGELOG.md` and `scripts/*.mjs`
    taken out of `apps/pages/turbo.json`.
  - **`scripts/demo.test.mjs`, in `pnpm test:repo`.** The deploy stages the
    Studio's build and the pages' build under the demo's path, the
    Studio's page at its root. It refuses a path both builds hold and a
    page of either build that asks for a file by an absolute path, and
    stages nothing then. Watched failing before `stageDemo` existed.
  - **`scripts/ci-test-jobs.test.mjs` and `scripts/codecov-config.test.mjs`.**
    The pages' suite runs in the `test` job's matrix, and codecov.yml has
    its component.
  - **By hand, on 17 October 2026.**
    - The built pages, served under `/report/`, in the Chromium of
      Playwright 1.64.1, measured by the Studio's browser gate's own
      `measureWidth` and `audit` (`apps/studio/scripts/gate-page.mjs`).
      All eight pages at 320, 360, 641, 1280 and 1920 pixels: no sideways
      scroll and nothing past either edge; axe's default rules and target
      size found nothing; colour contrast and target size were measured,
      and no text's contrast was left undecided. The first measurement
      found the German healthcare page 17px too wide at 320 pixels: its
      heading's word "Gesundheitswesen" widened the page's grid. The grid's
      column may now be narrower than a word, and narrow screens hyphenate
      headings.
    - `node scripts/demo.mjs --dry-run`, with Wrangler 4.146.0, read 33
      entries from the staging directory, the 22 files of both builds and
      the 11 directories that hold them, matched both routes and uploaded
      nothing.

  What holds nothing: what a sentence claims, and whether a translation
  says what the English says, which review holds; the browser
  measurements above, which no gate repeats; and whether a search engine
  indexes the pages.

## Context

On 16 October 2026 the rightsholder asked, in German, for pages on the
website that people search for and find. They should have examples, for
invoices and for healthcare, and advertise the product. Report had a
README, the Studio and the packages on npm. The Studio is a page with
`noindex`, drawn by a script, in English
([0018](0018-the-studio-demo-is-served-at-formancy-ai-report.md)). A search
engine finds nothing there to index.

The rightsholder decided two things. The pages live in this repository,
and the Worker that serves the Studio serves them under
formancy.ai/report/. The Studio stays at `/report/` and keeps its
`noindex`.

The product is sold in Switzerland first. Its readers search in German,
French and Italian. The healthcare module, Formancy Health, is in
development in a repository of its own, and has released nothing. The
invoice features, the Swiss QR-bill and SEPA's EPC code, are not built
yet.

## Decision

**Static HTML, prerendered at build time.** `apps/pages`, private and
never published, renders every page once with React's
`renderToStaticMarkup`. `vite build --ssr` compiles the renderer for Node,
`scripts/prerender.mjs` runs it, and `scripts/write-site.mjs` writes what
it makes into `dist/`, emptied first. A page holds its whole content. Its
one script is its JSON-LD, which no browser runs.

**The addresses.** Each language's product page is `/report/<lang>/`. A
topic page is `/report/<lang>/<slug>/`, its slug a word of that language:
the healthcare page is `gesundheitswesen`, `sante`, `sanita` and
`healthcare`. Links between pages are relative, so the site is right
wherever it is served. The canonical address, the alternates and the
sitemap are absolute, under the address the Worker's route gives
(`scripts/demo.mjs`'s reading).

**Four languages, every page in each.** German, French, Italian and
English. Every page names its four translations as alternates, and
English as x-default. Its canonical address is its own. A language
switcher links the four. `/report/sitemap.xml` lists every page with its
alternates. The German is written as Switzerland writes it, with ss for ß.
The alternates name languages, not regions.

**A shared link.** A page's Open Graph gives its title, description,
address and locale, and X's card the card's kind. The product page's
picture is the quotation starter's, and its card is the large picture's.
The healthcare page names no picture, and its card is the summary. The
pictures here are the Studio and the three starters: a building-services
firm's quotation, a service inspection and an equipment register. None of
them is a healthcare document.

**The page set is data.** `src/groups.ts` lists the page groups: the
product page, then the healthcare page. A group added there is built in
every language, linked from every page's bar and listed in the sitemap.
The invoice pages arrive with the changes that build those features.

**Facts are read, not typed.** Read from the repository by
`scripts/inputs.mjs`:
- the release and its date, from the changelog's newest version heading;
- the licence's version, date and address, through
  `scripts/licence-status.mjs`'s reading of LICENSE.md, and its table of
  terms row by row. Each row is translated by its English words, and a
  row LICENSE.md changes has no translation, which stops the build;
- the faces, from the Studio's page;
- the pictures' sizes, from the files. The pictures are copied from
  `docs/images`, where scripts made them.

A date on a page is formatted by Intl for its language.

**The room, by import.** pages.css imports the Studio's `room.css`,
`controls.css`, `shell.css` and `narrow.css`, and has no colour of its
own. The bar is the Studio's `.studio-bar`. When `@formancy/themes` ships
the room, the Studio and the pages will import that.

**Served by the Studio's Worker.** `pnpm build` builds the pages with
everything else. `scripts/demo.mjs` stages them beside the Studio under
`report/`. It refuses a path both builds hold and a page of either that
asks for a file by an absolute path. The Worker, its routes and Workers
Builds' commands are 0018's, unchanged.

**robots.txt is formancy.ai's.** It lives at the site's root, which
formancy.ai's repository owns. Nothing here writes one. The rightsholder
submits `https://formancy.ai/report/sitemap.xml` in Google Search Console,
or names it in formancy.ai's robots.txt
(`.github/REPO-METADATA.md`, "Search engines").

**The words.**
- Written to sell, and no further than a document here goes.
- Source-available, and "open source" only where a negation directly
  before it denies it.
- No price.
- HL7's notice word for word on any page that names HL7 or FHIR.
- Formancy Health in development, with nothing released, and dated.

## Consequences

**What it buys.**
- **Pages a search engine can read.** Every page, in four languages,
  with its translations linked both ways and listed in a sitemap.
- **Facts that cannot drift.** The release, the licence's terms and
  version, the address and the faces are read from the files that state
  them. A licence row that changes stops the build until the pages are
  translated again.
- **One room, one deploy.** The pages wear the Studio's stylesheets, and
  ride the Studio's Worker and its deploy.

**What it costs.**
- **Another app to keep true.** It has its own suite, its own CI job and
  its own build in every `pnpm build` and every Workers Build. A pages
  build that fails stops the Studio's deploy too.
- **Copy that can go stale.** Beyond the facts it reads, what a page says
  about the product is held by review. A change to the product changes
  its pages in the same pull request, as it changes the README. The
  Italian product page says the editor does not speak Italian yet. The
  Health status is dated, so it can be seen to go stale.
- **Translations nobody else has read.** The French, Italian and German
  are the author's, with no review by a native speaker recorded.
- **A release named before it is published.** The pages name the
  changelog's newest version heading. That heading is written in the
  release commit, which reaches main, and so the demo, before the tag
  publishes the packages.
- **The pages lean on the Studio's stylesheets.** A change to the Studio's
  bar or room changes the pages. The Studio's own tests do not look at
  them, and no gate measures the pages in a browser: their reflow and
  contrast were measured by hand, once.
- **The rightsholder's step.** The sitemap is submitted by hand. Nothing
  here checks that a search engine indexes the pages, or that
  formancy.ai's robots.txt lets them be crawled.
- **Google Fonts, as the Studio.** A reader's browser asks Google for the
  faces.
- **Large pictures.** The Studio's picture is the README's WebP, 4200
  pixels wide and 264 KB on 17 October 2026, for every screen. Nothing
  here makes smaller copies, because no image tool is a dependency.
- **A healthcare link shared without a picture.** Until a picture of a
  healthcare document exists here, its card is the summary, with no
  picture.

**What it forecloses.** Nothing that cannot be undone. Without the group
list and the staging, `/report/<lang>/` answers 404 again.

## Alternatives considered

**The pages in formancy.ai's website repository.** It is Apache-2.0, and
it is where the site's other pages are. Not chosen by the rightsholder.
The product pages of a paid module, its licence table among them, belong
with it ([0001](0001-a-paid-module-in-its-own-repository.md)). And the
facts read from this repository's files could not be read there.

**Client-rendered pages, a React app like the Studio.** A crawler that
runs no script finds an empty page. Google renders scripts later and less
often than it reads HTML, and other engines may not render them at all.

**One language, English.** Fewer pages to keep true. But the product is
sold in Switzerland first, and its readers search in German, French and
Italian.

**A static-site generator: Astro, Eleventy.** A new toolchain and a new
dependency for eight pages. React and Vite were installed already.

**Language-and-region codes, `de-CH`.** They would tell search engines
the pages are for Switzerland alone. The German page serves readers in
Germany and Austria as well.

**A Worker of the pages' own.** Two Workers cannot share the route
`formancy.ai/report/*`, and a second route per language would put a
second deploy beside the first for one site.
