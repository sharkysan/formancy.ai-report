# 0023 — The Studio and the product pages serve their own faces, and ask no other site for anything

- **Status:** accepted
- **Date:** 2026-10-17
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The browser gate, `apps/studio/scripts/browser-test.mjs`, in CI's
    `browser` job.** In every pass, with the Studio served under
    `/report/`:
    - every request outside the built Studio is named, its faces' included,
      and so is a `preconnect` or `dns-prefetch` hint to another host, read
      from the page as the pass ends;
    - every stylesheet the page loads can be read, which one from another
      origin cannot;
    - every face the built stylesheets declare has loaded, and in the pass
      that refuses the font files none has.

    Watched failing on 2026-10-17 with Google's three links put back into
    `index.html`. The request check named Google's stylesheet, a
    fonts.gstatic.com file and both hints. The stylesheet check named
    Google's stylesheet. The font check said Archivo Variable did not load:
    the stack's first family, Archivo, was Google's then. With the links
    out, all 8 passes and their 1,470 checks passed.
  - **`apps/studio/src/fonts.test.ts`, in the Studio's suite.** `index.html`
    names no address on another origin; watched failing on Google's three.
    Every stack `room.css` sets names a face `styles/fonts.css` imports, and
    every face it imports is named by a stack; watched failing with Plex
    Mono's two imports taken out.
  - **The pages' suite, `apps/pages`.** `src/checks.test.ts` breaks the
    site and watches the checks name each of these:
    - a `<link>` or a `src` that names another site, formancy.ai's
      included;
    - a `url()` of the site's stylesheet on another site, or naming no file
      of the site;
    - an `@import`;
    - a face's file that no stylesheet names;
    - a copied file whose package `site/THIRD-PARTY-NOTICES.txt` does not
      list.

    Each failed with `src/checks/files.ts` and the rule in `links.ts`
    taken out. `scripts/inputs.test.mjs` holds the faces to the Studio's
    `fonts.css`, copied from the pages' own packages. It holds the bundler
    to rewriting each `url()` to the copy, and to refusing a package the
    pages do not depend on, a file the package does not ship and two files
    of one name. It failed with the rewrite taken out and the package
    looked up beside the importing file. `src/site.test.ts` runs every
    check over the site this checkout builds.
  - **`scripts/third-party-notices.test.mjs`, in `pnpm test:repo`.** A font
    file that a package's stylesheet names, @imported by an app's
    stylesheet, is written beside the chunks and lists its package; watched
    failing with the font under Vite's inline limit. `copiedNotices` lists
    each package once and refuses one with no licence text.
  - **`scripts/web-fonts.test.mjs`, in `pnpm test:repo`.** It holds what
    the gate and the pictures read:
    - the families of `@font-face` rules alone, never a stack's; watched
      failing reading every rule;
    - from every stylesheet a build wrote; watched failing reading the top
      directory alone;
    - a request for a font file, by its extension;
    - each face's version, from its Fontsource package;
    - every Fontsource package either app depends on declares OFL-1.1 and
      ships the OFL's text.
  - **The README pictures' check, `test:pictures`.** It passes, walking
    with the faces refused as it walked with Google's.
  - **By hand, on 17 October 2026**, the measurements under *What it
    costs*.

  What holds nothing: whether the product pages' requests in a browser are
  what their HTML and stylesheet name, since no gate opens them in a
  browser (0021); and whether the font files' own name tables say OFL,
  which review holds.

## Context

The Studio ([0013](0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md))
and the product pages ([0021](0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md))
took their faces from Google Fonts. Every visitor's browser asked
fonts.googleapis.com for a stylesheet and fonts.gstatic.com for the font
files, so it told Google its address before a word was drawn. Both records
said so as a cost. The browser gate allowed exactly those requests, so its
claim that the page fetches nothing but the built Studio had an exception.

The pages are written for readers in Switzerland, Germany and Austria, and
one of them is for healthcare. On 20 January 2022 the Landgericht München
I (3 O 17493/20, GRUR-RS 2022, 612) held this:

- A website that passes a visitor's dynamic IP address to Google through
  Google Fonts without consent infringes the visitor's right to
  informational self-determination.
- The site has no legitimate interest under Article 6(1)(f) GDPR, because
  the fonts can be used without connecting to Google at all.

It awarded 100 euros in damages. That is one regional court's judgment.
This record does not say what Swiss or Austrian law requires: serving the
faces from formancy.ai takes the question away.

formancy.ai's own pages and its admin stopped asking Google for their
faces in [formancy.ai 0154](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0154-the-website-makes-no-request-to-any-other-site.md).
admin.css, whose faces 0013 takes, now imports them from Fontsource.
Formancy Data's apps still link Google Fonts, at formancy.ai-data's
69a2dcb.

This record changes two parts of earlier ones: 0013's *The faces are
admin.css's, delivered as Data delivers them*, with its cost *Google
Fonts*, and 0021's faces read from the Studio's page, with its cost
*Google Fonts, as the Studio*. It applies formancy.ai 0154 here.

## Decision

**The Studio's faces come from its own build.** `apps/studio/src/styles/fonts.css`
imports the six Fontsource stylesheets admin.css imports, at the same
weights:

- Archivo's variable face with its width axis,
  `@fontsource-variable/archivo/wdth.css`. It carries wdth 62 to 125 and
  wght 100 to 900, which covers the 75 to 125 and 500 to 800 Google was
  asked for. Its `index.css` and `wght.css` carry the weight axis alone.
- IBM Plex Sans in 400, 500 and 600.
- IBM Plex Mono in 400 and 500.

`main.tsx` imports it, and Vite writes each subset's file beside the
chunks. Each subset keeps Fontsource's `unicode-range`, so a browser
fetches only the subsets the page's text uses. `index.html` names nothing
on another origin. Fontsource names the variable face `Archivo Variable`,
which room.css's `--display`, admin.css's stack, names after `Archivo`.

**The pages serve their own copies.** pages.css imports the Studio's
`fonts.css` as it imports `room.css`. The pages' build,
`scripts/inputs.mjs`, inlines the Fontsource stylesheets from the pages'
own node_modules, never the Studio's: the pages depend on the same three
packages at the same exact versions. It rewrites each `url()` to
`site/fonts/<file>` and copies the file there. The Studio's built files
are not referenced: their names carry content hashes, which a pages build
could not know without building the Studio first and reading its output.

**Notices travel with the fonts.** The OFL asks that each copy of a font
carry its copyright notice and the licence. The Studio's notices plugin
(formancy.ai-data 0046) lists each Fontsource package by the font files
Vite writes from it, as it lists any file a build writes from a package.
The pages write `site/THIRD-PARTY-NOTICES.txt` with
`scripts/third-party-notices.mjs`'s `copiedNotices`, in the plugin's
format, each package's LICENSE whole.

**The gate allows no other origin.** Every request outside the built
Studio fails a pass, and so does a connection hint to another host. Every
stylesheet must be readable. The pass that measures the fallback stack
refuses the font files by their extension. The families the gate waits
for are read from the built stylesheets' `@font-face` rules
(`scripts/web-fonts.mjs`), where they were read from Google's link.

**The pictures wait for the same faces.** A picture's record names each
font's version as its Fontsource package records it: metadata.json's
`version`, the Google Fonts release the files were made from. The versions
are v25, v20 and v23, the ones the record took from fonts.gstatic.com
addresses, so the record's look is unchanged. `--check` refuses the font
files, as it refused Google's: what it compares and measures does not
wait on a font's arrival.

**The pages' checks read the site's own files.** Anything a browser
fetches by itself as a page loads must be a file of the site: a `<link>`,
a `src`, a `url()` of the stylesheet. Only a link a reader follows may
lead elsewhere. A face no stylesheet names, and a copied file whose
package the notices do not list, are refused.

## Consequences

**What it buys.**
- **Opening the Studio tells no site but formancy.ai who opened it**, in
  the states the gate drives it to. **Opening a product page asks no other
  site for anything** its HTML or its stylesheet names.
- **A gate without an exception.** The Studio's claim, nothing fetched but
  the built Studio, is now checked whole.
- **Pictures that reproduced, in one trial.** On main's build, retaking
  every README picture reproduced three of the five byte for byte, and not
  the React and the Angular builder's. On this build a second retake
  reproduced all five. One trial each, on 17 October 2026, which shows no
  more than that: nothing holds a retake to reproduce.

**What it costs.**
- **Bytes in every deploy.** All on 17 October 2026, with the packages at
  5.3.0:
  - the faces are 887,348 bytes in 59 files in each build, 567,064 of them
    in 31 WOFF2 files;
  - the Studio's build grew from 4,471,063 bytes in 8 files to 5,383,978 in
    67;
  - the pages' build grew from 962,090 bytes in 14 files to 1,874,459 in
    74.
- **What a reader fetches.** Measured in Playwright 1.64.1's Chromium, with
  the built files served from disk at 1440 by 900:
  - the Studio, up to its starter picker: 190,724 bytes in six WOFF2 files;
  - a product page, in German or French: 151,832 bytes in four WOFF2 files.

  Before, a reader fetched Google's files of the same faces from Google
  instead, whose sizes were not measured.
- **WOFF files for browsers without WOFF2.** Fontsource's stylesheets
  name a WOFF after each static face's WOFF2, and both builds copy them:
  320,284 bytes in 28 files each. Every browser the Studio's build targets
  reads WOFF2. Kept rather than rewriting Fontsource's stylesheets.
- **Two copies of the faces.** The Studio's hashed files and the pages'
  own are different addresses, so a reader who goes from a page to the
  Studio fetches the faces again.
- **A local Archivo wins.** `--display` names `Archivo` before `Archivo
  Variable`, as admin.css does. With Google's stylesheet, `Archivo` was
  Google's face. Now no `@font-face` defines it, so a reader with a font
  of that name installed sees the headings in it, perhaps without its
  width axis. The red run above showed the stack stopping at the first
  family it finds. The gate's machines have no such font.
- **The pictures were retaken.** The faces changed their pixels by
  antialiasing alone, the text unchanged. Decoding both WebPs, in the
  picture that changed most, 344 of 6,694,800 pixels differ by more than
  24 of 255, such as the w of "Move down" in Plex Sans. All five were
  retaken with `node scripts/pictures.mjs --all`.
- **A version taken on trust.** The look's font versions are what each
  Fontsource package's metadata.json says, not read from the files that
  loaded.
- **Licences held by the packages, not the fonts.**
  `scripts/dependency-licences.mjs` reads the fonts of the published
  packages from their name tables (0006). The apps are private, and their
  files are WOFF2, whose tables are compressed. `web-fonts.test.mjs` holds
  each Fontsource package of the apps to OFL-1.1 by its manifest and the
  licence it ships. The files' own name tables are review's.
- **The pages' requests are read, not watched.** No gate opens the pages
  in a browser (0021). That they ask no other site for anything rests on
  the suite's reading of their HTML and stylesheet.
- **Two ways across the repositories.** Formancy Data's apps still take
  the same faces from Google.

**What it forecloses.** A font service, or any other origin, for anything
the Studio or the pages load, unless a record takes this back. The gate
and the pages' checks fail on one.

## Alternatives considered

**Keep Google Fonts behind a consent banner.** A question put to every
reader before a typeface, to buy a request the faces do not need.
Rejected.

**Point the pages at the Studio's built font files.** One copy in the
deploy. But the files' names carry content hashes. The pages would have to
build after the Studio and read its output, and a change to either build
alone could leave the other naming files that are gone.

**Write the `@font-face` rules by hand, under the plain family names**, so
`Archivo` is the build's face and a local font never stands in for it.
Rejected for formancy.ai 0154's reason: it copies Fontsource's unicode
ranges into this repository, where nothing checks them against the files
they describe.

**Rewrite Fontsource's stylesheets to drop the WOFF fallbacks.** 320,284
bytes less per build, which no reader fetches. Not taken: a plugin and a
rewrite to keep true, for deploy size alone.

**Abort every request to another origin in the gate**, as formancy.ai
0154's gate does, rather than record it. Not taken now. While nothing is
foreign, recording names the first foreign request as well as aborting
does. The cost is a regression's: the gate's own browser would reach that
host once, from the CI runner, before the check failed.
