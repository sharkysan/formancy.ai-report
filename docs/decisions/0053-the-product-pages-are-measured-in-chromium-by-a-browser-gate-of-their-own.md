# 0053 — The product pages are measured in Chromium by a browser gate of their own: every page of the built sitemap, at the widths the built stylesheet asks for, served under the demo's path and headers, with the Studio's gate's page reads; by hand in each pull request, more passes in the Studio's gate, the demo staged whole and the Studio's `fromTheTop` lost

- **Status:** accepted; extends [0021](0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md),
  whose pages it measures in a browser, as 0021,
  [0024](0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md)
  and [0028](0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)
  measured them by hand, and [0051](0051-the-demo-is-served-under-a-content-security-policy-that-admits-its-own-files-alone.md),
  whose headers it serves them under
- **Date:** 2026-11-11
- **Deciders:** Daniel Bacher
- **Verified by:** the pages' suite and `pnpm test:repo`, which CI runs on
  every pull request, and the pages' gate in CI's `browser` job. Each case
  below was watched failing, its fault planted once and the file put back
  byte for byte, on a Mac: the gate's on 6 and 7 November 2026, the
  documents' guards on 11 November 2026. None has run in CI yet: this
  record's pull request is their first run there.
  - **`apps/pages/scripts/gate-site.test.mjs`, in the pages' suite.** The
    passes are read from the built stylesheet: the reflow width of 320
    pixels, again with the web fonts refused, a phone at 360, one pixel
    past each `max-width` breakpoint, a laptop at 1280 and a screen at
    1920. The pages are read from the built sitemap, at the address the
    gate serves them at. It failed before `gate-site.mjs` existed, and with
    each of its three refusals taken out alone: a stylesheet with no
    breakpoint, a sitemap that lists no page, and a page outside the site.
  - **`apps/pages/scripts/gate-imports.test.mjs`, in the pages' suite.**
    The gate, and the Studio's `gate-measure.mjs` it takes its reads from,
    import no `@formancy/` package and import or resolve no package of the
    workspace, followed through every relative import. It failed on each
    of these:
    - an import of report-corpus added to `gate-measure.mjs`;
    - a dynamic import of report-spec one relative hop away;
    - a workspace package handed to `require.resolve`, to
      `import.meta.resolve` and to a function `createRequire` made;
    - its reader of resolutions broken to read nothing.
  - **The pages' gate, `apps/pages/scripts/browser-test.mjs`, in CI's
    `browser` job.** The release report reads its file,
    `apps/pages/test-results/browser-chromium.json`, as it reads the
    Studio's: every app with a `test:browser` script has one
    ([0014](0014-a-release-report-is-derived-from-the-run-that-gated-it.md)).
    Each fault below made the gate exit 1 naming its check:
    - `flex-wrap: wrap` taken off the shared list rule the bar's links wrap
      by: `no sideways scroll` at 320 pixels, 359 pixels over, and
      `nothing past either edge`, in every pass up to 641 pixels and in
      none from 1280;
    - `.lead` given `#777`: axe's `color-contrast`, on every page of every
      pass;
    - a `preconnect` to fonts.googleapis.com in the document's head: the
      check of what was fetched or hinted outside the built pages, once a
      pass;
    - an inline style on the product page's `<h1>`: the policy's check,
      naming `style-src-attr`, once a pass;
    - the pages' preview served from `dist/de` as the site's root:
      `answered as itself`, 404, on every page, with no other check made
      under that page's name, and each of the four checks of a pass saying
      it was read on no page;
    - one page's canonical pointed at another page: `answered as itself` on
      that page alone;
    - a picture from the origin outside the built pages, with `img-src`
      widened to the whole origin to let it through: the outside check,
      naming it, where the policy's check passed;
    - a positive `tabindex` on the wordmark: the first Tab, and axe's
      `tabindex`;
    - the skip link moved off screen while it has the focus: the link on
      screen, and the shown link's contrast measured;
    - the id of the skip link's target removed: Enter on `<main>`, and
      axe's `skip-link` and `region`;
    - the skip link's class renamed: the first Tab, the page holding no
      `a.skip`.
  - **`scripts/workflows.test.mjs`, in `pnpm test:repo`.** The browser job
    runs the pages' gate before it collects, also when a step before it
    failed, and uploads the pages' `test-results/` with the Studio's. It
    failed with the pages' step not in `gates.yml`.
  - **`scripts/architecture.test.mjs` and
    `scripts/release-report/limitations.test.mjs`, in `pnpm test:repo`.**
    A section of the architecture links this record. Its costs are in
    `docs/release/limitations.json`, and every record it changed was read
    again and stamped. Both failed with the record written and nothing
    else: no section linked it, it had no entry, and the records whose
    Status lines it changed had changed since they were read.

  What holds nothing: what a page looks like, since the gate asserts
  numbers and computed results and never takes a screenshot; Firefox and
  WebKit; a link from a page to the Studio, which is not served beside
  the pages; and the minutes the gate adds to CI's browser job, until its
  first run there.

## Context

The product's pages arrived in three rounds, each measured in a browser
by hand. 0021 measured its eight pages, 0024 its twelve and 0028 all
sixteen, each on 17 October 2026, served under `/report/` in Playwright's
Chromium. The Studio's gate's own `measureWidth` and `audit` measured each
at 320, 360, 641, 1280 and 1920 pixels: no sideways scroll, nothing past
either edge, nothing axe found, and every text's contrast decided. The
first of those rounds found the German healthcare page 17 pixels too wide
at 320 pixels. 0051 opened every page under its policy once, by hand, on 5
November 2026. Each record said so, 0028 in these words: no gate measures
the pages, so a later change to them, or to the Studio's stylesheets they
import, is measured by nobody.

Four more pages are planned, each in its own pull request. Each adds a
topic to the bar every page carries, so each changes every page, and each
would measure every page again by hand: four rounds, up to 32 pages at the
end.

The pages' suite reads the built HTML back with jsdom. jsdom applies no
CSS, resolves no media query, lays nothing out, loads no face and enforces
no content security policy. Reflow, contrast, the keyboard path, the faces
and the requests a page makes are what it cannot see. The Studio's browser
gate sees them, for the Studio.

## Decision

**The pages have a browser gate of their own**,
`apps/pages/scripts/browser-test.mjs`, run as
`pnpm --filter @formancy/report-pages test:browser` and in CI's `browser`
job after the Studio's gate and its pictures. It runs when they failed too,
so a red Studio does not hide the pages' answer.

**What it measures is derived.** The passes come from the stylesheet the
build wrote (`sitePasses` in `gate-site.mjs`):
- 320 pixels, the reflow width;
- 320 pixels again with every font file refused, since the fallback stack's
  widths differ;
- a phone at 360;
- one pixel past each `max-width` breakpoint, where the wider layout is at
  its narrowest;
- a laptop at 1280, and a screen at 1920 by 1080.

The pages come from the sitemap the build wrote (`sitemapPages`). A
breakpoint or a page added is measured without anybody editing the gate.
On 7 November 2026 that was seven passes, from 320 to 2053 pixels, over the
sixteen pages of the sitemap, and 1,148 checks.

**Served as the demo serves them.** `vite preview` serves the pages' `dist/`
on the port `vite.config.ts` fixes, 4395, which fails rather than wanders
when the port is taken. It serves them under the path the demo serves them
at (0018, 0021), as separate pages, so an address the build does not hold
is answered 404 and never with a page that stands in for it. Every
response carries the headers the deploy writes, from `headersFor` in
`scripts/demo-headers.mjs`, for the gate's own address (0051). The Studio
is not served beside them.

**On every page, in this order:**
1. It answered as itself: 200, with the production address the sitemap
   gives it as its one canonical. A page that did not is measured no
   further, so a fallback is never measured under that page's name.
2. Its faces are waited for.
3. The keyboard, from the top of the page as it loads, before anything
   moves the focus:
   - the first Tab reaches the skip link;
   - the skip link is on screen while it has the focus;
   - shown, axe finds nothing on it and measured its contrast;
   - Enter on it puts the keyboard on `<main>`.
4. The room is read.
5. Nothing scrolls sideways, and nothing is past either edge.
6. axe's default rules and its target-size rule find nothing. Contrast and
   target size were measured, over something, and the contrast of every
   text in view was decided.
7. Its connection hints and the policy's refusals are read.

**Once a pass, over every page:**
- each page wears the released room, every variable and the colour scheme
  of the installed `@formancy/themes/room.css` (0034);
- every face the built stylesheet declares loaded, and in the pass that
  refuses them, none did;
- nothing was fetched and no connection hinted outside the built pages but
  a `data:` address (0023);
- the demo's policy refused no page anything (0051).

Each of the four fails in a pass where no page answered as itself, rather
than saying ok of nothing.

**The reads are the Studio's gate's.** `measureWidth`, `audit`,
`describeFocus`, `fontProblem` and `paletteProblem` come from
`apps/studio/scripts/gate-measure.mjs`. They were moved out of
`gate-page.mjs` unchanged, and the module imports no workspace package. The
record is the Studio's recorder, `gate-results.mjs`. The two gates measure
with the same code, and this gate needs nothing built but the pages.

**The top of the page is the load, not `fromTheTop`.** The Studio's gate
clicks at (1, 1) and collapses the selection, so that the next Tab starts
at the document's start. On the pages, wherever `.site` reaches the
window's corner, as it did at 320 pixels, that click lands in `.site`'s
padding. Chromium then starts sequential navigation at the node the click
landed on, and the next Tab passes the skip link, which
comes before `.site`. In the first run, on 6 November 2026, the first Tab
after it reached the wordmark in every pass up to 641 pixels, where a
fresh load's reached the skip link in all of them. So the pages' gate
measures the keyboard path straight after the load, with only the faces
waited for before it. In the Studio the skip link is the first thing inside
the element that click lands on, which is why it holds there.

**Where focus missed the skip link, it is given to it.** Enter is then
pressed on the skip link alone, never on whatever had the focus. A link
there would take the page away from every check after it.

## Consequences

**What it buys.** Every pull request measures every page in a browser, in
the four languages, at every width the stylesheet asks for, as the demo
serves them. A change to the pages, or to the Studio's bar, room or
stylesheets they import, that breaks one fails the pull request that made
it, naming the page and the check. The keyboard path and the requests are
measured too, where by hand they were not.

**What it costs.**
- **CI minutes, not yet measured.** The browser job took 12 minutes 56
  seconds on main's run of 8 November 2026, at bf37f4d, without this gate.
  What the gate adds is read from its first run in CI, which is this
  record's pull request: from the `browser` job's timing, and from the
  wall time the release report's table of browser gates gives
  `apps/pages`.
  - Five green runs on a Mac with other work running took between 26.9
    and 35.2 seconds each, from 6 to 8 November 2026. They are
    observations, not a bound.
  - On 6 November 2026, the same Mac took 1,016 seconds for the Studio's
    gate.
- **Chromium alone**, the browser `scripts/browsers.mjs` gives every gate
  here. A page's reflow, contrast, keyboard path and requests in Firefox
  or WebKit are measured by nobody.
- **The Studio's reads, shared.** The gate imports the Studio's
  `gate-measure.mjs` and `gate-results.mjs`. A change there is a change to
  this gate, measured by both gates in the same job. `fontProblem`'s
  message for a build with no face names the built Studio, also when the
  pages' build is the one that has none.
- **The Studio's install, not its build.** `gate-measure.mjs` resolves
  `axe-core` and `@formancy/themes/room.css` from `apps/studio`, so the
  pages' gate needs the Studio's packages installed. The axe it evaluates
  is the Studio's install's, not the pages' own devDependency. Both take
  the workspace catalog's range, and the lockfile resolved one release,
  4.14.0, on 11 November 2026. The room it compares against is the
  Studio's `@formancy/themes`, which `scripts/palette.test.mjs` holds to
  the pages' release.
- **Every face on every page.** Every family the built stylesheet declares
  must load on every page. On 7 November 2026 each page had text in all
  three faces, the mono in an eyebrow or a piece of code. A page with no
  text in one of them would fail the font check, which would be a true
  reading of what that page loads.
- **The request check is the second line.** Under the demo's policy, the
  browser refuses a request to anything outside the built pages, and the
  policy's check names that refusal. So the request check alone catches
  only what a widened policy would let through. It was watched catching a
  picture only once `img-src` was widened to the whole origin. A
  connection hint opens a connection with no request to hear, so hints are
  read from each page's head.
- **The Studio's gate is not green on every machine.** On the Mac this
  gate was built on, the Studio's own gate fails one text-layer check in
  every pass: its text layer of the invoice's first page holds one line
  without the firm's name, where `docs/images/pictures.json` records the
  line with it. CI's browser job on main
  is green: the text the pictures record is held on CI's fonts. The pages'
  gate reads no PDF and passed whole on that Mac. Locally,
  `pnpm --filter @formancy/report-pages test:browser` runs this gate
  alone, where the root's `pnpm test:browser` runs both through turbo.

**What it does not do.** It says nothing of what a page looks like:
everything is asserted as numbers and computed results, never
screenshots. The Studio is not served beside the pages, so a link from a
page to it is not followed. The demo as the deploy stages it is held by
`scripts/demo.test.mjs`, and is not opened in a browser. It reads what the
local build serves under the deploy's headers, not what formancy.ai serves
(0018, 0051). The hand measurements of 0021, 0024 and 0028 stay what they
were, dated, and are not repeated.

## Alternatives considered

**By hand in each pull request**, as 0021, 0024 and 0028 measured. Lost:
four rounds of up to 32 pages cost more than one gate, and a measurement
by hand holds nothing once it is written down. It is the cost those
records stated.

**Inside the Studio's gate**, as more passes of
`apps/studio/scripts/browser-test.mjs`. Lost: the Studio's gate would wait
on the pages' build, and the pages' measurements on the Studio's whole
build, its corpus and PDF.js among it. A red Studio would hide the pages'
answer, where now each gate gives its own.

**The demo staged whole**, the Studio's build and the pages' under one
root, as `scripts/demo.mjs` stages them for the deploy. It would follow a
link from a page to the Studio. Lost: a gate of the pages alone would need
the Studio's build, and what the stage holds is `scripts/demo.test.mjs`'s
already.

**The Studio's `fromTheTop`**, as the Studio's gate takes the top of its
page. Lost: its click lands in `.site`'s padding wherever `.site` reaches
the window's corner, and the next Tab passed the skip link in every pass
up to 641 pixels. The load is the top a person arriving at
the page starts from.
