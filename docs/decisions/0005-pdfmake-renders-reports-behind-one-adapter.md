# 0005 — pdfmake renders reports, behind one adapter

- **Status:** accepted; amended by
  [0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md),
  under which a render of an e-invoice reads one file besides its fonts,
  the ICC profile PDFKit embeds in a PDF/A, outside pdfmake's access
  policy
- **Date:** 2026-10-15
- **Deciders:** Daniel Bacher
- **Verified by:** the engine's corpus tests in `packages/report-corpus`,
  whose suite runs in its own job of `gates.yml`'s `test` matrix on every
  pull request and before every release.
  - **`src/trial/pdfmake.test.ts`** renders every fixture in the corpus
    through the pdfmake adapter. It judges each PDF with the corpus's checks
    ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)), or
    holds a refusal to the one the fixture allows. Its list of fixtures
    pdfmake cannot satisfy is empty. A fixture added to that list names the
    exact problems the checks report, and its case asserts them, so the
    suite fails the day the fixture passes and the day it fails another way.
  - **The same file pins each pdfmake default the adapter works around**
    (below). A document one page over its limit is refused, not cut short. A
    three-line page header prints whole on every page. A keep-together block
    taller than a page is refused. pdfmake reads no file but its four fonts,
    and no address at all, and a render sets the adapter's fonts and
    policies again over whatever else in the process configured pdfmake.
  - **`src/trial/pdfmake-assets.test.ts`** holds the image checks.
  - **`src/trial/pdfme.test.ts`** asserts the one problem pdfme's PDF of
    `group-boundary` has, so the reason it lost is what is checked, not
    merely that it fails.

  The comparison is [`docs/renderer-trial.md`](../renderer-trial.md),
  written by `src/trial/run.ts` from what that run measured. Its times are
  dated evidence, not a gate: nothing fails when they change.

  **Added 2026-10-15: the renderer exists.** `@formancy/report-render-pdf`
  grew from the pdfmake adapter, and its `src/corpus.test.ts` renders every
  fixture of the corpus with the same empty list of excused fixtures, in
  the package's own `test` job; `src/pdfmake.test.ts`, `flow.test.ts`,
  `refusals.test.ts` and `assets.test.ts` pin the pdfmake behaviours this
  record lists. The trial's adapters stay in the corpus as the record of
  the trial. What the renderer adds to this record's rules is
  [0011](0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md).

  **Not mechanically enforced:**
  - **That the renderer is pdfmake** -- until 2026-10-15, when
    `@formancy/report-render-pdf` arrived depending on pdfmake alone; its
    corpus tests now hold it.
  - **That pdfme stays out of published packages.** It is a devDependency of
    the private corpus. Its own licence is MIT, but
    [0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)'s
    guard would stop a published package that depended on it: walked on
    2026-10-15, `@pdfme/schemas` brings in `bwip-js` 4.11.4, whose
    Inconsolata, OCR-A and OCR-B fonts name no licence. Recording exceptions
    for them would let pdfme through, and nothing else would stop it.

## Context

Plan section 6 asks for one production renderer for version 1. It is to be
chosen by an experiment that runs pdfmake and the strongest alternative on
the same fixtures, with a third candidate only if both fail a required case.
Plan section 23.4 adds that `@formancy/report-render-pdf` runs in Node and in
the browser.

pdfme was the alternative. Like pdfmake it is MIT-licensed JavaScript with no
service to deploy, and its template designer is the nearest thing among the
candidates to a report builder.

The experiment built four things:
- **One input.** `ResolvedDocument`, in the corpus's `src/document.ts`: a
  report after its data is read, grouped, totalled and formatted. Every
  length is in points, every value is the string that prints, and it names
  no engine.
- **The corpus.** Plan section 20's cases as fixtures, each with the checks
  that would see it go wrong, judged on the PDF (0003).
- **An adapter per engine,** `src/trial/pdfmake.ts` and `src/trial/pdfme.ts`.
  Both set Roboto 3.014 from pdfmake's package (OFL-1.1, 0006), so the
  engines were compared in one font.
- **The run.** `src/trial/run.ts` renders every fixture through both
  adapters and judges each PDF with the checks. It times the long table, the
  group fixture, a hundred-page table and refusing the oversized job, and
  writes `docs/renderer-trial.md`.

What it measured on 2026-10-15, on the machine that document names (an
Intel i9-10900K with 20 logical CPUs, Windows 11, Node 24.21.0), which nothing
reserved for the run. Times are medians of five renders after one more that
was judged.

| | pdfmake 0.3.11 | pdfme 6.2.4 |
|---|---|---|
| The corpus | every fixture passes, or is refused as it expects | `group-boundary` fails: page 2 ends on the group header 'Region R19' |
| `tall-row`, which allows either | the row continued across pages | refused as `content-too-large` |
| `summary-fits`, ten summaries 2 pt apart | kept on its page up to the 674.89 pt filler, moved from 676.89 pt | kept up to 668.89 pt, moved from 670.89 pt |
| The long table, 7 pages | 178 ms | 286 ms |
| The hundred-page table | 1829 ms | 5257 ms |
| Refusing 6000 rows against 20 pages | 802 ms | 1633 ms |

Where each engine's summaries moved was read from its PDF of `summary-fits`
on the same day; the trial document shows only that both passed. Three runs
of the same script earlier that night, against the corpus before its checks
were tightened, put pdfmake's hundred-page median between 1819 and 2073 ms
and pdfme's between 5478 and 5573 ms. Across the four runs pdfmake's median
moved by 14% and pdfme's by 6%, and which engine was faster never changed.

## Decision

pdfmake renders version 1's reports. `@formancy/report-render-pdf` holds one
adapter to it, grown from the trial's. It takes a resolved document and
approved asset bytes, and returns a PDF or a refusal. It is a package
boundary, not an engine interface: the trial's `EngineAdapter` stays in the
corpus, and there is no second engine to plug in.

The adapter keeps what the trial found it needs, because pdfmake's defaults
lose content without saying so:
- **Its own page limit,** thrown out of the layout as the page past the limit
  begins. pdfmake's `maxPagesNumber` is never used.
- **Page regions measured** first, and the body's margins set from them.
- **Keep-together blocks and table rows measured** before the PDF is laid
  out, refusing what no page can hold.
- **Image bytes checked** before pdfmake sees them, and refused as
  `invalid-asset` naming the asset.
- **Fonts from four named files** and no other file, and no address at all.
- **The creation date from the document,** so that one document renders to
  the same bytes every time.

## Consequences

**What it buys.**
- **The corpus, whole.** No fixture is excused. Rows appear once and in
  order, each with its own cells on its own lines. The column header
  repeats on every page a table reaches, the page header stands above the
  body and the footer below it, counting the pages. Group headers stay with
  their first row, and a summary stays whole and moves only once it no
  longer fits. Exact decimals print verbatim on their own rows, every
  character is drawn in an embedded font, and a refusal about an asset
  names it.
- **The faster of the two.** pdfmake was faster on every timed document,
  with each adapter's own passes inside its times. Plan section 20's targets
  are for a documented four-vCPU worker, and a run on this machine does not
  judge them.
- **A library, not a service.** It renders in the process that asks.
  pdfmake also ships a browser build (`build/pdfmake.js`), which plan
  section 23.4 needs.
- **Licences that fit.** pdfmake is MIT and its Roboto is OFL-1.1 (0006).

**What it costs.**
- **The adapter is where the rules live.** pdfmake's defaults are not this
  repository's. Each of these was observed in the trial, on a deliberately
  naive adapter or a probe:
  - `maxPagesNumber` cuts silently: the oversized job came back as 20 pages.
  - A page-header line that does not fit the top margin is dropped.
  - An unbreakable block taller than a page is not drawn, and a PDF is still
    returned.
  - Invalid image bytes fail with a plain `Error` that names no asset.
  - An empty text node lays out one empty line, so every spacer was a line
    too tall.
  - Inside an unbreakable block, a node moved to the next page still reports
    the old one unless it has an id. This orphaned a group header until the
    adapter gave such nodes ids, and every one of them is a named destination
    in the PDF.

  So the adapter lays a document out three times, and most of its code
  exists to stop pdfmake doing what it does by default. Any pdfmake upgrade
  can move one of these. Each is pinned by a test that fails if it does, and
  the corpus pins pdfmake at an exact version, as the renderer will, so that
  an upgrade is a diff somebody runs those tests on.
- **The page limit bounds layout, not measuring.** pdfmake measures every
  node before it lays out a page, so even a refusal pays one pass over the
  whole input. Refusing the oversized job's 6000 rows took 802 ms on
  2026-10-15. Bounding the CPU a render can take needs a bound on its input,
  and the runtime has none yet.
- **Cancellation between passes only.** pdfmake lays out and writes a PDF in
  one synchronous step, during which no abort can be delivered. Plan section
  14 asks that cancelling stops the work, not just the status. That needs a
  worker thread or process that can be killed, and none is built.
- **Rows split per table.** `dontBreakRows` is one setting for a whole
  table, so one row that cannot be kept whole lets every multi-line row in
  that table split. `tall-row` would equally have accepted a refusal;
  continuing the row was a choice.
- **Not refused, and never tried with an over-tall case:**
  - a single line taller than a page's body, which pdfmake draws past it;
  - a spacer that does not fit what is left of a page, which becomes a page
    break and loses its space;
  - a page-region line that wraps only for some page numbers, since regions
    are measured once, with every page field printed as the page limit;
  - a run of keep-with-next headings followed by a page break or the end of
    the document, which is not kept together.
- **JPEG is checked to its structure only.** The adapter reads its segments
  up to the scan, the frame size and the end marker. Scan data is never
  decoded, and no fixture in the corpus holds a JPEG.
- **One configuration per process.** pdfmake's fonts and access policies are
  global. The adapter sets them again in the same synchronous step as each
  render, so anything else in a host's process that configures pdfmake is
  overridden, and a test holds that. The cost runs the other way too: a
  host that uses pdfmake for something of its own finds the adapter's
  configuration in place after every report.
- **A dependency the guard will stop on.** pdfmake's production closure
  holds `png-js` 1.1.0, which declares no licence. 0006's guard stops
  `report-render-pdf` on it until an exception records its MIT `LICENSE`.
- **What was not tried.** One font: fallback fonts and complex scripts are
  untested (plan section 19). The trial ran in Node only, and the browser
  build is untested.

**What it forecloses.**
- **A second engine in version 1,** and the engine interface it would need.
  Changing engine is a new record and a new adapter, judged on the same
  corpus.
- **pdfme's designer as the builder.** The builder edits the report's
  flowing model (plan section 9), not templates of boxes at fixed positions.

**Amended 2026-10-15, with 0011.** Three of the costs above are smaller in
the renderer that shipped. The page limit now bounds measuring too, for a
body whose least height already needs more pages than the limit: it is
refused before pdfmake is handed it, 100,000 rows against five pages in
236 ms. An abort is read after the event loop has turned between passes,
so one from a timer arrives; a pass under way still cannot be stopped. And
a single line, a rule or a frame taller than the body is refused, where
the trial drew it past the foot of the page. The rest stand as written.

**Amended 2026-10-18, by 0031: one file besides the fonts.** "Fonts from
four named files and no other file" no longer holds of every render. An
e-invoice is drawn as a PDF/A-3b
([0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)),
whose output intent PDFKit reads, as it ends the document, from its own
`data/sRGB_IEC61966_2_1.icc` with `fs`, past pdfmake's local access
policy, which governs only what pdfmake opens. The renderer sets its
policies as before and reads no address; a render of a report that is no
e-invoice still reads the font files and nothing else, and one of an
e-invoice reads that profile besides. `src/pdfmake.test.ts` in
report-render-pdf holds both, reading every file a render reads through
`fs.readFileSync`, which is how pdfmake reads a font and PDFKit its
profile; a read through another call of `fs` it would not see. The
profile is a reviewed file under
[0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md),
as 0031 extends it.

## Alternatives considered

**pdfme 6.2.4.** Rejected on the corpus: through the trial's adapter,
`group-boundary` fails with "page 2: the last table row is the group header
'Region R19'". pdfme can break a table after any row and has nothing that
keeps one row with the next; its only look-ahead keeps the column header off
the foot of a page. The failure is the adapter's as much as pdfme's. Split by
hand before 'Region R19', the one group header pdfme's own pagination left
last on a page, the same table came back as four pages that pass every
check (probed on 2026-10-15). An adapter could do that for every group
header, laying the table out again after each split. That is building
pagination on top of pdfme's, where pdfmake's `pageBreakBefore` hook gives
the same rule inside its own. The trial found more:
- **Nothing keeps a heading with what follows it.** No box moves because of
  the box after it, so the adapter ignores `keepWithNext`. No check in the
  corpus looks for a heading alone at the foot of a page, so this cost pdfme
  nothing above. That is a gap in the corpus as well as in pdfme.
- **Content cut off silently.** pdfme places a row, block or image taller
  than a page whole, and it runs off the page. With the adapter's own
  overflow check removed, `tall-row` came back as two pages, with every
  word from `journal0408` on missing. The adapter refuses such content only
  because it runs pdfme's pagination itself before drawing.
- **Pagination that `generate()` skips.** pdfme lays a template out across
  pages only when a box in it is a table or growing text (read in
  `@pdfme/generator` 6.2.4's source); the adapter runs
  that pagination itself to refuse what does not fit, and then hands
  `generate()` a template it does not paginate when no such box is there.
  Probed after the trial, a body of an image and a kept summary that did not
  fit under it came back as one page, the summary drawn into the footer. No
  fixture has a body without a table or a paragraph, so the corpus does not
  show it, and the trial's adapter was not corrected.
- **Keep-together for paragraphs only,** of one size, alignment and slant,
  drawn as one text box. Anything else in a keep-together block is refused.
- **A hang in its PNG decoder.** `@pdfme/pdf-lib` decodes PNGs with UPNG
  1.0.1, which never returns on truncated pixel data. It blocks the thread,
  so no timer or signal can stop it. The adapter checks every PNG with
  Node's zlib first.
- **Braces are expressions.** Template text reads anything in braces as an
  expression, so `{1+1}` prints as `2`, and there is no escape. pdfme draws
  page numbers with template text, so a page-numbered header or footer with
  a brace in it is refused.
- **Slower,** on every timed document. Refusing the oversized job costs it a
  full layout, because it has no page limit of its own.

**HTML and CSS with Chromium, optionally through Gotenberg.** Not trialled.
It is a separately deployed service, an operational dependency where
pdfmake is a library. A self-hoster would run a browser beside the server,
and the renderer could not run in the editor's page (plan section 23.4).
Print rules, font loading and header and footer behaviour would need the
same testing. Plan section 6 justifies a third candidate only when both
trialled engines fail a required case, and pdfmake failed none.

**Prince.** Not trialled. It is commercial: shipping it inside a product
whose production use is licensed needs written redistribution rights
([0001](0001-a-paid-module-in-its-own-repository.md)), and 0006 admits no
commercial component without a change to that record. It also brings the
cost of deploying it.

**Paged.js.** Not trialled, for the same reason as Chromium. It is a layer
over an HTML engine and still needs one to write the PDF.
