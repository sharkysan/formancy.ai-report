# 0013 — The Studio is formancy.ai's room with a report builder in it, its PDF.js viewer stays inside it, and its README pictures are taken by a script

- **Status:** accepted
- **Date:** 2026-10-16
- **Deciders:** Daniel Bacher
- **Verified by:**
  - `scripts/palette.test.mjs` (`pnpm test:repo`): every stylesheet under
    `apps/` whose `:root` carries the comment naming admin.css says what
    formancy.ai's `apps/admin/src/admin.css` says at e3c5967, the commit
    v0.5.0 was tagged from, pinned in the test; the copies say the same as
    each other; and a copy sets every colour variable the installed
    `workbench.css` declares and no `--wb-*` it lacks. Watched failing with
    `--muted` and with `--wb-panel` moved in the Studio's `room.css`.
  - `apps/studio/src/styles.test.tsx` (the Studio's `test:coverage` job): no
    rule of the Studio's that names the workbench or a builder hook declares
    a colour (watched failing with admin.css's header wash added to
    `builder.css`); matched against the React builder as it renders, no
    Studio rule reaches inside it but `builder.css`'s and the room's box
    model, selection colour and focus ring (watched failing, before the fix,
    on `controls.css`'s rules for every `select` and every `button`); and
    nothing but the paper's own rules reaches the paper.
  - `apps/studio/scripts/browser-test.mjs` (`pnpm --filter
    @formancy/report-studio test:browser`, the `browser` job): in Chromium,
    from 320 pixels to the side-by-side layout, no sideways scroll and
    nothing past either edge, the design view's note never cut by its pane,
    the skip link, axe with contrast and target size measured, every
    starter's PDF drawn by PDF.js on white with its text layer holding what
    the corpus says it prints, the paper settling only once the newest PDF
    is drawn with Download PDF giving those bytes, the framework switch with
    its history, a pointer's drag, the place chooser, Final, the Preview's
    zoom, focus after a refusal's button, and no rule of the page's
    stylesheets on the paper but the paper's own.
  - `apps/studio/scripts/pictures.mjs --check` (`test:pictures`, the
    `browser` job) and `scripts/pictures/readme.test.mjs` with its
    neighbours (`pnpm test:repo`): formancy.ai-data 0038's checks, which its
    `Verified by` lists, over the Studio's scenes.
  - `apps/studio/src/notices.test.ts` and `scripts/third-party-notices.test.mjs`
    (formancy.ai-data 0046): the built Studio's `THIRD-PARTY-NOTICES.txt`
    names every package its bundle holds, PDF.js among them, and Roboto's
    OFL under pdfmake's entry.
  - `scripts/dependency-licences.mjs` (the `verify` job) reads the
    production closure of every package that is not private; the Studio is
    private, so `pdfjs-dist` and its Liberation Sans are in no published
    closure (0006).

  What holds nothing: whether a picture still looks like the page, which is
  review's; and whether a caption's quote is painted in the picture rather
  than scrolled out of it -- a caption is held to the text its part holds.

## Context

Plan 23.4's seventh step brings the Studio: a private playground that edits
the three starters in both builders over one session and previews the real
PDF. The user asked, on 15 October 2026, for two things with it. It wears
the same design as formancy.ai and Formancy Data: a dark bench with glass
panels, violet for what the person acts on and teal for what the system
did, IBM Plex Sans and Mono with Archivo for display, and one shell. And its
README pictures are taken by a script in a real browser and held to the text
they show, as formancy.ai-data 0038 holds Data's.

formancy.ai's admin is the source of that look: `admin.css` sets the
palette and recolours `workbench.css`'s panes through `--wb-*` without
overriding one of its rules for colour, and gives the workbench the room's
geometry -- pill buttons, pane names in tracked mono capitals. Formancy
Data's Studio wears the same palette, copied under a marking comment and
held to one value by a guard. Neither is a package this repository can
depend on (0002 depends on released packages), and Data's Studio has no
builder in it (formancy.ai-data 0024), so its stylesheet had never had to
leave one alone.

0006 refuses `pdfjs-dist` in a published package's closure, because it
ships Liberation Sans under GPL-2.0 with a font exception. 0012 dresses
both builders with one stylesheet, `report-builder.css`, on the workbench's
variables.

## Decision

- **The palette is admin.css's, copied and pinned.** The Studio's
  `styles/room.css` carries admin.css's `:root` at e3c5967 under the
  comment `/* formancy.ai apps/admin/src/admin.css */`, unchanged, with the
  two font stacks Data's apps add. The palette guard holds every marked
  copy to values pinned in the test from that commit, so a colour moved
  here fails, and a move upstream is a commit that changes the pin and the
  copy together.
- **The builder is the workbench, recoloured by variables only, in the
  room's geometry.** `workbench.css` and `report-builder.css` dress the
  panes; the Studio sets their colours through the `--wb-*` its room sets,
  and declares no colour on a rule that names them. Its `styles/builder.css`
  carries admin.css's own geometry for the workbench -- pane names in
  tracked mono capitals, pill buttons -- with every colour declaration of
  those rules left out, and no other Studio rule reaches inside the
  builder. The report's title is a hook both builders render
  (`data-report-part="title"`), so `report-builder.css` can set it as the
  admin's title bar sets a form's name.
- **The Preview is the paper.** PDF.js draws each page of the PDF the
  renderer printed, white, with its text layer over it; no rule of the
  room's reaches the paper; Download PDF gives the bytes the pages were
  drawn from, and the paper says it is busy until the newest is drawn.
- **The PDF.js viewer stays inside the private app.** No
  `@formancy/report-viewer` is published for 0.1.0; a host that wants a
  viewer brings its own PDF.js. Publishing one waits for either a reviewed
  exception for that exact font or a viewer that leaves `pdfjs-dist` to the
  host (plan 23.4).
- **The README pictures are formancy.ai-data 0038's.** `scenes.json` says
  each scene, its caption and what it quotes; the Studio's
  `scripts/pictures.mjs` walks the built page through its controls,
  served from `dist/` on an origin nothing resolves, and pictures whole
  parts of the states it reaches; `captured.json` records each part's
  accessibility text; `--check` walks them again with the web fonts
  refused and fails when a part says something else or a caption quotes
  what its parts do not say. A scene may name its own width at or below the
  narrowest breakpoint, for the narrow layout.
- **The faces are admin.css's, delivered as Data delivers them.** Archivo
  and IBM Plex at admin.css's weights, from Google Fonts, as Formancy
  Data's apps load them, not self-hosted through @fontsource as the admin
  has since its 0154: no dependency here carries them yet.

## Consequences

**What it buys.**
- **One tool in three places.** The builder in the Studio is the admin's
  workbench in the admin's room, and a host that sets the same `--wb-*`
  gets the same colours, because nothing else of the Studio's colours it.
- **A palette that cannot drift here unnoticed,** and a builder the room
  cannot repaint by accident: a rule written for the Studio's own select
  that also dressed the builder's property selects was found by the test
  that now holds it.
- **A preview that is the printed document.** What the paper shows is the
  PDF, drawn by PDF.js from the bytes the person downloads.
- **Pictures that cannot claim what the page no longer says,** retaken by a
  command rather than by hand.

**What it costs.**
- **The palette is copied, and the pin with it.** When admin.css moves
  upstream nothing here fails; the pin is what review compares with
  upstream, by hand. Data's guard has the same gap.
- **The geometry is copied too.** `builder.css` carries admin.css's rules
  for the workbench, and nothing compares them with admin.css: a rule the
  admin changes reaches the Studio by review.
- **Two ways to dress the builder.** A host that wants the admin's look
  copies `builder.css`'s rules as well as the variables; the variables
  alone give the workbench's own shapes in the room's colours.
- **Google Fonts.** Every person who opens the Studio asks Google for the
  faces, which the admin stopped doing (its 0154). The browser gate allows
  exactly those requests, and measures one width with them refused.
- **No viewer to install.** A host shows the PDF with a viewer of its own.
- **Pictures hold text, not pixels.** A change of colour or layout alone is
  seen only by looking, and a quote is held to its part's text, not to
  whether the picture shows that text or a pane has scrolled it away.
  They were taken on Windows; a retake on another platform starts again
  with `--all`, because one look is recorded for all of them.
- **Chromium only.** formancy.ai-data's gates run Firefox and WebKit too
  (its 0058); this gate has measured one browser.
- **A slow job.** The gate builds the Studio and walks every width its
  breakpoints call for; its length on CI is not measured yet.

**What it forecloses.** A palette of the Studio's own, a colour set on the
builder by any rule but a `--wb-*` variable, and a hand-taken README
picture.

## Alternatives considered

**Data's stylesheet as it is.** Its controls rule dresses every `select` and
every `button`, which in Data's Studio are all its own. Rejected: here the
builder's are inside the same page, and taking that rule made the builder's
property selects taller than the inputs beside them and drew a second focus
ring over the builder's own.

**No geometry from the room: the workbench's own shapes in the room's
colours.** What 0012's stylesheet promises a host on its own. Rejected for
the Studio: its own controls are the room's pills and mono labels, and one
screen showed two button shapes and three label styles beside each other,
which is not the admin's look.

**Override the workbench's colour rules for the room**, as admin.css's pane
and canvas backgrounds do. Rejected: CLAUDE.md's rule is that not one rule
is overridden for colour, so a host's page and the Studio draw the builder
alike; admin.css's transparent panes and dotted canvas stay the admin's.

**A guard that reads admin.css from formancy.ai's repository.** It would
see upstream move. Rejected for now: CI has no network for it and no
checkout of that repository beside this one; the pin is the next best and
says which commit it is.

**Publish `@formancy/report-viewer` with PDF.js.** Rejected for 0.1.0 by
0006's guard and plan 23.4, as above.

**Pictures taken by hand.** Rejected by the user's instruction: a picture
that nothing checks shows a Studio that may no longer exist.
