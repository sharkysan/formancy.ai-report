# 0034 — The Studio and the product pages wear formancy's room by importing the released `@formancy/themes/room.css`, never a copy, and Report takes formancy 0.6.0 whole: the Studio after the workbench, the pages first, no stylesheet here setting one of its variables; the copy with a moved pin, an `@import` in the Studio's room, the Studio's packages for the pages and the packages left on 0.5.0 lost

- **Status:** accepted; numbered 0034 while 0033 was held by a branch not
  yet merged; supersedes the copied palette of
  [0013](0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)
  and the room by import of that copy in
  [0021](0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md)
- **Date:** 2026-10-18
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **`scripts/palette.test.mjs`, in `pnpm test:repo`.** The names and
    the hues are read from the `@formancy/themes/room.css` the Studio
    installs, never listed. No stylesheet of the repository -- every kind
    the Studio's Vite bundles as CSS, by Vite's own `isCSSRequest` -- and
    no `<style>` of a page sets one of its variables, or types one of its
    opaque colours at any alpha, and none writes a colour in a function
    the guard cannot compare, `hsl()` or `oklch()`. Every app under
    `apps/` names where its page takes its stylesheets, and each takes the
    room once, and after `workbench.css`'s last taking where it takes the
    workbench too: the Studio's order read from `main.tsx`'s imports, as
    TypeScript's own pre-processor finds them, comments left out, and
    each stylesheet's `@import`s, the pages' from `pages.css`; and no file
    of an app but its entry names a stylesheet of `@formancy/themes`. Each
    app resolves the room, from its own manifest, to the same bytes. The
    Studio's `theme-color` is the room's `--ground`, and its `--sans` and
    `--mono` are the installed workbench's `--wb-sans` and `--wb-mono`.
    The installed room sets every colour the installed `workbench.css`
    declares and no `--wb-*` it lacks. Watched failing on main's
    stylesheets: the copy the Studio carried, all 23 of its variables
    named, the Studio taking no room, and, once it took one, the pages
    taking none; and after the change, with `--muted` set again in the
    Studio's `room.css`, with `main.tsx`'s two imports swapped, with the
    `theme-color` moved to `#0b0f18`, on the five tints of the room's
    violet and teal the Studio's rules typed, with a `tint.pcss` setting
    `--muted` imported from `main.tsx`, with the workbench taken again
    after the room through a stylesheet, with the room's import inside a
    comment, with a `theme.js` importing the room above the workbench,
    and with `--mono` moved.
  - **`apps/studio/scripts/browser-test.mjs`, in the `browser` job.** At
    every pass, the built page computes every variable the installed
    `room.css` sets on `:root` as `room.css` gives it, a colour compared
    as a colour within one step of 255 in its alpha, since the build's
    minifier writes the room's colours as hex, and its colour scheme
    (`paletteProblem`, `gate-page.mjs`). What the palette guard reads in
    the sources it measures where the build put it. Watched failing on a
    stylesheet that set `--wb-panel` and `--glass` on the built page, and
    on a build whose `main.tsx` took the workbench again after the room,
    where it named all eleven `--wb-*` at the workbench's light values.
  - **`apps/pages/src/stylesheet.test.ts`, in the pages' suite.**
    `pages.css` imports `@formancy/themes/room.css` first, the Studio's
    `room.css` second and nothing but the Studio's stylesheets besides, and
    the one stylesheet a page links carries every declaration of the
    released room's `:root` as the release writes it. Watched failing
    before `pages.css` imported the room: the pages' build refused, "the
    room's :root sets no --ground".
  - **`apps/pages/scripts/inputs.test.mjs`.** Every package the pages'
    build inlines a stylesheet from is said, one that names no font among
    them, and the pages' `THIRD-PARTY-NOTICES.txt` names
    `@formancy/themes` at the pages' pin. Watched failing while the
    notices were written for the faces' packages alone.
  - **`apps/studio/src/fonts.test.ts`, in the Studio's suite.** The
    room's stacks are read from the released room and then the Studio's
    `room.css`, and each names a face the Studio serves. Watched failing
    with the Studio's copy gone and the test reading its `room.css`
    alone: `--display` was nowhere.
  - **No colour moved by more than one step of 255**, measured on 19
    October 2026 on a Windows 11 workstation, in the Chromium 156 the
    gates pin. The released room's `:root`, read declaration by
    declaration by a script against main's `styles/room.css` at eb86a4a,
    holds the copy's 23 variables at the copy's values and its
    `color-scheme: dark`, and the Studio's `--sans` and `--mono` are the
    copy's; `workbench.css` did not change between formancy v0.5.0 and
    v0.6.0 (GitHub's comparison of the tags, 214 files). The built
    Studio's stylesheet sets the workbench's `:root`, then the room's,
    then the Studio's. With the room imported and the five tints still
    typed, `node scripts/pictures.mjs --all` took all five README pictures
    byte for byte as main's. Writing the tints as `color-mix()` of the
    variable moved pixels by one step: the Studio as it opens, at 2100 by
    900 pixels and twice the density, screenshot as PNG from a build with
    the tints typed and one with them mixed, differs in 21,382 of its
    7,560,000 pixels in the React builder and 21,402 in the Angular one,
    each by 1 of 255, all in its top 280 CSS pixels, where the glow lies
    under the bar's blurred glass -- a mixed alpha is the percentage
    exactly, a typed one the nearest of 255. The pictures, lossy WebP,
    were retaken by their script and carry that as up to 15 of 255 in up
    to a tenth of their pixels. The browser gate
    then holds the built page's room to the release at every pass, and
    the Studio's suite, `styles.test.tsx` among it, passed. The gate's
    contrast checks show contrast held, not that a colour did.
  - **The two pictures of the whole Studio are not repeatable.** Two
    takes of one build differ, in the React picture or the Angular one,
    in up to 5,696 of its 7,560,000 pixels, by at most 11 of 255, all on
    the PDF's paper in the Preview, which no rule of the room reaches; the
    other three came out byte for byte in every take. What moves the paper
    between captures is not traced.
  - **The report hash on `@formancy/spec` 0.6.0.** report-spec's
    `src/hash.test.ts` pins a digest, unchanged; report-spec reads
    `schemaHash` alone, whose code the release did not touch.

## Context

formancy.ai 0178 published the admin's palette on 18 October 2026, in
formancy 0.6.0, as `@formancy/themes/room.css`: the admin's custom
properties on `:root` at their values, every colour of `workbench.css` set
to them, `color-scheme: dark`, and nothing else
([formancy.ai 0178](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0178-the-rooms-palette-is-published.md)).
Its header asks to be loaded after `workbench.css`: both say `:root`, so
the later wins.

Until then the Studio wore a copy. 0013 put admin.css's `:root` at
e3c5967 into `styles/room.css` under a marking comment, and the palette
guard held the copy to values pinned in the test; 0021's pages imported the
Studio's `room.css`, and said that when `@formancy/themes` shipped the
room, the Studio and the pages would import that. The copy agreed with
formancy as of the day somebody last looked. The user's word on it, on 18
October 2026: both repositories copy the admin's colour stylesheet by hand
from formancy, and are not to. Then, the same day, that Report and Formancy
Health take formancy 0.6.0 and import `@formancy/themes/room.css`.

The browser gate's reader of the Studio's stylesheet
(`apps/studio/scripts/gate-page.mjs`) and the pictures' camera
(`scripts/pictures/camera.mjs`) inline `studio.css`'s relative imports, one
level, and refuse any other `@import`: that is why `styles/fonts.css`, which
imports Fontsource's packages, is imported from `main.tsx` and not from
`studio.css` (0023). The pages' build inlines a package's stylesheet only
from the pages' own `node_modules`, so what they serve is what their
manifest names (0023).

## Decision

- **The palette is formancy's, released.** The Studio's `main.tsx`
  imports `@formancy/themes/room.css` on the line after
  `@formancy/themes/workbench.css`. The pages' `pages.css` imports it
  first, before the Studio's stylesheets, from `@formancy/themes` at the
  same exact version in the pages' own manifest. No stylesheet in this
  repository declares one of its variables.
- **What stays the Studio's** is `styles/room.css`, which room.css does
  not carry: `--sans` and `--mono`, the text's two stacks, at the values
  the admin reads from the workbench's `--wb-sans` and `--wb-mono` --
  the pages load no workbench, and formancy.ai 0178 leaves those two to
  the repositories that declared them -- and the page's rules: the box
  model, the body, the light behind the bench, the selection, the focus
  ring, `code`, the skip link, the eyebrow and the problem box.
  `builder.css`, admin.css's geometry for the workbench, stays the
  Studio's too: room.css has no rule to replace it with.
- **No colour of the room is typed in a stylesheet.** A tint of one is
  `color-mix(in srgb, var(--client) 15%, transparent)`, the colour
  `rgb(139 123 255 / 15%)` typed it as, which moves with the room; a
  gradient whose stops mix says `in srgb`, the space a gradient of typed
  colours is drawn in, since a mixed stop alone moves it to Oklab, which
  drew the glow's gradients, alone on a page in Chromium 156, up to 22 of
  255 apart from the typed ones. One colour of the
  room stays typed: the Studio's `theme-color`, since a `meta` cannot read
  a variable; the guard holds it to the room's `--ground`.
- **The colours admin.css's rules type that the room does not carry stay
  typed as they type them**: the dark ink on the skip link and on the
  chosen builder, the problem's pink, the shade under the starter picker
  and the Preview's pages, the panels' shadow, white's tints and the
  paper's white. The Studio's rules are admin.css's, as `builder.css` is,
  and room.css publishes no rule and no variable for them.
- **The pages' notices name the room's package**, as they name the faces',
  since the pages serve its text.
- **Report takes formancy 0.6.0 whole**: `@formancy/spec` for report-spec,
  `@formancy/expressions` for report-core and report-runtime, and
  `@formancy/themes` for the Studio, the pages and the getting-started
  guide's install lines, which the install gate installs at the Studio's
  pin. The spec version stays 4. Of `@formancy/spec`, report-spec reads
  `schemaHash` alone, and the release's change to the built code is the
  remote answer's functions beside it and the schema's `specVersion`
  default, which nothing here reads; `@formancy/expressions` 0.6.0's built
  files are 0.5.0's, byte for byte, but for its version.

## Consequences

**What it buys.**
- **One room, formancy's.** A colour the room moves reaches the Studio
  and the pages with the release that moves it, its tints with it, and a
  colour of the room's set or typed here fails the guard in the sources
  and the browser gate on the built page.
- **The order said once, where the page loads it.** Two adjacent lines of
  `main.tsx`, which the guard reads.

**What it costs.**
- **The room is a release's, not main's.** Between bumps the Studio and
  the pages wear 0.6.0's room; a colour formancy moves after it arrives
  with the next bump, which somebody makes and reviews.
- **Two pins of one package.** The Studio and the pages each declare
  `@formancy/themes`, because the pages' build reads only its own
  packages; the guard fails when the two resolve to different bytes.
- **A second `@formancy/spec` under the Data provider.**
  `@formancy/report-data-provider` reaches `@formancy/spec` 0.6.0 through
  report-spec, and 0.5.0 through `@formancy/data-client` and
  `@formancy/data-core` 0.1.0, which pin it exactly; a consumer installs
  both until Formancy Data releases against 0.6.0, and the README's
  generated table lists the second as transitive. No object of one
  crosses into the other: the provider reads a published form's fields
  with Data's types and maps them into report-spec's dataset contract.
  The second copy is 1,157,810 bytes as pnpm installed it, measured with
  `du -sb` on 19 October 2026 on Windows 11; `ajv` and `@noble/hashes`,
  which both copies depend on at the same versions, are not doubled.
- **The order is the importer's.** room.css loaded before the workbench
  leaves the builder's light panes in the dark room. The guard reads the
  order from the source, as each app's build takes it, and the browser
  gate the room it leaves on the Studio's built page; nothing opens the
  pages' built page in a browser.
- **admin.css's rules are still copied.** `builder.css` carries its
  rules for the workbench at e3c5967, and the Studio's other stylesheets
  its rules for the page, the controls, the bar and the canvas, with the
  colours they type that the room does not carry; nothing compares either
  with upstream's, and a colour admin.css's rules move reaches neither
  the Studio nor the pages. 0013's cost stands for them.
- **One step of 255 in the glow, and the pictures retaken.** A mixed
  tint's alpha is exact where a typed one's was the nearest of 255, and
  the README's pictures, lossy, carry the difference as more.
- **What the guard cannot see**: a colour of the room typed into a script
  or an inline `style`, or by its name; one of the room's translucent
  colours typed at its strength -- the room's edges and rules are white
  at an alpha, which admin.css's rules type for tints of their own, the
  paper's ring at `--wb-rule`'s 12 % among them; a stylesheet a page
  links by an element rather than imports; and a `--wb-*` read that the
  room does not set. The browser gate reads the room's variables on the
  built page, whatever path a stylesheet took into it, and no more.

**What it forecloses.** A palette of this repository's own, and a copy of
room.css's variables in any stylesheet here.

## Alternatives considered

**Keep the copy, with the pin moved to 0.6.0's room.css.** The guard would
still hold the copy to values read once, and see nothing upstream move.
Rejected: it is what the user said not to do, and what 0178 was published
to end.

**`@import` the released room in the Studio's `styles/room.css`,** so the
pages would take it through the Studio's file and declare no pin.
Rejected: the gate's and the camera's readers inline `studio.css`'s
relative imports and refuse any other, so both would need a resolver of
packages written twice, for an order `main.tsx` says in two lines; and a
stylesheet the script imports is a module the notices plugin lists by its
package (formancy.ai-data 0046), as `workbench.css` is.

**Resolve the room for the pages from the Studio's `node_modules`,** so the
pages need no pin of their own. Rejected: the pages' build inlines a
package only from the pages' own dependencies, so what they serve is what
their manifest names and turbo hashes it through their lockfile entry
(0023); a second pin, held to the first by bytes, is the smaller cost.

**Keep the packages on formancy 0.5.0 until Formancy Data takes 0.6.0,** so
the provider's tree holds one `@formancy/spec`. Rejected: the release
report and 0004's tuple name one upstream release, the report hash does
not move, and the second copy costs bytes, not behaviour.

**Keep the Studio's tints of the room typed, as admin.css's rules type
them.** Pixel for pixel what the pictures were. Rejected: a typed tint is
the room's colour copied, which stays when the room moves -- the copy this
record ends, under another name -- and `color-mix()` of the variable is
the same colour to one step of 255.

**Read the workbench's `--wb-sans` and `--wb-mono` in place of `--sans` and
`--mono`,** as the admin does. Rejected: the pages wear the Studio's room
and load no workbench, so their text would fall back to the browser's face.
