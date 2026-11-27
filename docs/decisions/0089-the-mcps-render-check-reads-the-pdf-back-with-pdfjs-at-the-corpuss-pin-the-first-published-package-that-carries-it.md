# 0089 — The MCP's render check reads the PDF back with PDF.js at the corpus's pin, the first published package that carries it

- **Status:** accepted when its pull request merges, but for its admission of pdfjs-dist's Liberation Sans 1 as never loaded, which is proposed and the owner's to grant or refuse before it does; numbered while 0083 to 0087 were held for the branches that bring a model's turn; extends [0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md), whose rule it applies to what an agent is told, [0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md), whose guard now walks PDF.js, and [0088](0088-an-agent-gets-reports-checks-over-the-model-context-protocol-from-a-server-of-reports-own.md), whose render check it builds; [0013](0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)'s viewer stays the Studio's alone
- **Date:** 2026-11-27
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **What it answers.** `packages/report-mcp/src/render.test.ts`: the
    quotation's one page, its lines in the order a reader meets them --
    the address and the quotation's own lines, two columns, read across
    the page -- its total after its subtotal and its page count last; a
    final render of data that lacks a field answers the runtime's
    `missing-field` at its path and no page; a preview of the same data
    prints, `PREVIEW_LABEL` its first line, with the runtime's warning; a
    locale the report does not declare and a zone Intl does not know are
    the runtime's `undeclared-locale` and `unsupported-time-zone`; a report
    of `MAX_CHECK_PAGES` pages prints every page, one of a page more is the
    renderer's `too-many-pages`; the validator's errors for a document that
    is no report; an aborted signal is the renderer's `cancelled`; an
    asset whose bytes are not the digest it came with is refused
    `asset-not-its-digest` before anything resolves, though the report
    never draws it and though the data would be refused; an image the
    call does not carry is the runtime's `missing-asset`; assets that are
    not four strings, bytes that are not base64 and a mode that is
    neither are refused; no byte of the PDF, raw or in base64, in any
    answer; nothing fetched; what the renderer throws that is no refusal
    is thrown on.
  - **Its bounds, each at the bound and one past it.** The same file: a
    report of `MAX_REPORT_BYTES` reaches the renderer, one a byte past it
    is `report-too-large` before anything resolves; `MAX_DETAIL_ROWS` rows
    reach the renderer, which refuses them as `too-many-pages` before
    laying them out, and one more is the runtime's `too-many-rows`; a
    string of `MAX_STRING_LENGTH` characters prints across the pages it
    needs, one more is the runtime's `string-too-long`; an answer of
    `MAX_ANSWER_BYTES` is answered and one a byte past it refused
    `answer-too-large` with its page count, no line cut; and a real render
    of small print, within the page bound, is refused for its answer.
  - **One reading of a page's lines.** `src/pdf-text.test.ts`: for every
    starter of the corpus, every Euro invoice sample, Austria's caption
    turned up the side of its code among them, and the corpus's runs set
    below or above the line, the final render's lines, page by page,
    equal the corpus's `pageLines` of the same PDF, which the corpus's
    index now exports; a guard on the guard holds that the documents
    compared hold a run set off its line and a run turned off the
    horizontal. The corpus is report-mcp's devDependency, as since 0088,
    and never its dependency: the install host holds only what report-mcp
    declares.
  - **No network, no file.** The same file: reading the invoice's PDF, and
    a page written by hand in Helvetica, never embedded, for which PDF.js
    would read pdfjs-dist's Liberation Sans 1 if it were told where it is,
    calls `fetch` never and asks `process.getBuiltinModule` for no file
    system, network, process or worker module.
  - **One PDF.js.** `scripts/mirrored-pdfjs.test.mjs` fails where
    report-mcp's `pdfjs-dist` is not the corpus's 6.4.299, and where it is
    a devDependency and not a dependency.
  - **What each module reaches.** `src/composition.test.ts`: `render.ts`
    imports report-runtime, report-spec, report-render-pdf, `./pdf-text.js`
    and `./tools.js`; `pdf-text.ts` report-runtime, pdfjs-dist's
    `legacy/build/pdf.mjs` and, for a type, its `api.js`; so no module
    imports pdfjs-dist's sandbox, which runs a PDF's scripts.
  - **Through the protocol.** `src/server.test.ts`: `render_check` listed
    with its description and read-only, closed-world annotations; its
    seven arguments surviving the round trip, the zone and the mode read
    back from the manifest; a refusal arriving as `isError` with the
    runtime's errors structured; the mode a closed list a client is told.
  - **The licences.** `scripts/dependency-licences.mjs` and its tests:
    pdfjs-dist's Foxit faces by exceptions, file by file, under PDFium's
    BSD 3-Clause; its CMYK profile by its digest, CC0; and its Liberation
    Sans 1 by `NEVER_LOADED`, at the digests the review read, for
    report-mcp alone, refused without it; `@napi-rs/canvas` and its
    platform binary judged as any package, MIT.
  - **From outside.** The `mcp` install host render-checks the quotation
    through the packed bin, its firm's mark passed as bytes, and reads
    its title back from page 1, no `%PDF` in the answer.
  - **Seen failing before merge**: the lines read from the resolved
    document instead of the PDF; a second pdfjs-dist release; a line
    reader joining runs otherwise than the corpus's -- a word gap of 1 em,
    or of none, the runs set off the line left lines of their own, a
    turned caption read among the lines, the same-line fraction made 1.2;
    the standard fonts read from pdfjs-dist's own directory; the digest
    check dropped, and made after the data; each bound loosened; the
    signal dropped; a fault answered as a refusal; `render_check`
    registered under another name, its data under another, its zone
    dropped. One did not fail, and is a cost below: a word gap of 0.25 em
    reads every PDF compared as 0.15 em does.

## Context

0088 left `render_check` to a record of its own: what an agent most needs
to know is what only the PDF knows -- on which page a line landed, whether
a table broke where it should, what stands on the last page. The
runtime's resolved document has every word and no page.

Every claim here about a report's output is proved on the PDF the engine
produced, read back with PDF.js, never on the engine's input (0003). The
corpus reads PDFs that way, with `pdfjs-dist` at exactly 6.4.299, and its
`pageLines` joins runs into lines by their baselines; the corpus is test
support and never published. The Studio draws PDFs with PDF.js too, and
its viewer stays in no published package (0013). report-documents reads a
PDF's objects and pages but extracts no text (0054).

What `pdfjs-dist` is, read from the installed package on 27 November
2026: Apache-2.0, 34.9 MB unpacked by npm's own count, 554 files; in Node
it requires `@napi-rs/canvas`, its optional dependency, when it is
installed, at import, to polyfill `DOMMatrix` and `Path2D`, and runs its
worker in the same thread, importing `pdf.worker.mjs` from its own
package. It ships ten of Foxit's Type 1 faces and four of Liberation Sans
1.07.4 in `standard_fonts/`, a CMYK profile in `iccs/`, and decoders and a
QuickJS sandbox in `wasm/`, each read only from an address a caller
gives; 0006 found the fonts on 14 October and said a package that ships
`pdfjs-dist` would stop on them.

## Decision

**`render_check` renders a report with what an agent passes in, reads the
PDF it rendered back with PDF.js at the corpus's pin, and answers its
lines, page by page; the MCP is the first published package that carries
PDF.js, and its Liberation Sans 1, which nothing here loads, is admitted
for it alone as never loaded -- that admission the owner's to make.**

- **The pipeline.** report-spec's validator; the runtime's `resolveReport`
  with the data, the parameters, the locale, the zone and the mode passed
  in, a final render unless a preview is asked for, at a creation date
  fixed for every check, 1 January 2000, which only the PDF's metadata
  holds; `renderPdf` with the call's signal; the PDF read back. The first
  refusal is the answer, by whichever package gave it, with its codes:
  the validator's errors, the runtime's errors with their stages and
  paths, or the renderer's code, sentence and subject.
- **Assets** come in the call as `{ asset, digest, mediaType, base64 }`,
  strict base64, each held to the digest it is given with by report-spec's
  `assetDigest` before anything resolves, whether or not the report draws
  it; the runtime asks for an asset by its id and digest, so bytes reach
  it only under the digest they are. Never by URL, path or file.
- **The bounds** on what one call costs:
  - the report, `MAX_REPORT_BYTES` as a save holds it, measured as
    report-spec states it, before anything resolves;
  - the data, by the runtime's own bounds -- `MAX_DETAIL_ROWS`, 100,000
    rows, and `MAX_STRING_LENGTH`, 16,384 characters a string -- and the
    call by the SDK's stdio bound, 10 MiB a message (0088);
  - the PDF, `MAX_CHECK_PAGES`, 40, the renderer's `maxPages`, past which
    it refuses the document, before pdfmake lays it out where its least
    height already needs more. Chosen, the Studio's preview's number, and
    measured on 27 November 2026 on an Intel i9-10900K under Node 24.21 on
    Windows: the quotation printed to 40 pages, 1,250 lines, took 1.4 s
    and answered 89,905 bytes; past 40 it was refused in 0.4 to 0.6 s; at
    `MAX_DETAIL_ROWS` the runtime took 3.3 s before the renderer refused;
    every starter took 0.1 to 0.65 s, the sales report 2.2 s for its first
    chart, which loads ECharts, and answered 1.0 to 10.2 KB;
  - the answer, `MAX_ANSWER_BYTES`, which is `MAX_REPORT_BYTES`: a check
    costs a model's context no more than the largest report it may send.
    Past it, refused with the page count and the size, no line cut.
- **The reading.** `pdf-text.ts` loads the PDF from its bytes with no
  address for a standard font, a CMap, a profile or a decoder, no font
  face made, no system font: so nothing is fetched or read from a file,
  and pdfjs-dist's fonts, profile and decoders are never loaded. PDF.js 6
  has no `isEvalSupported`: it compiles no PDF function to JavaScript, so
  there is no evaluation to switch off; `getTextContent` decodes no image,
  and no module imports the sandbox that would run a PDF's script. Each
  page's runs are given the corpus's box, computed to the last operation
  as `read-pdf.ts` computes it, and joined by `pageLines`' rule: one
  baseline a line, read left to right, a gap wider than 0.15 em a space, a
  run set below or above the line read into its line, a run turned off the
  horizontal a line of its own, after the others. `pdf-text.test.ts`
  holds the two readings equal.
- **The answer** is `{ rendered, pages: [{ page, lines }], warnings,
  manifest }`, the runtime's warnings and manifest as they are, never the
  PDF's bytes. A refusal is `isError`, 0088's envelope.
- **Loaded with the first check.** The renderer and PDF.js are imported
  when an agent first calls `render_check`: measured on the same machine
  and day, the renderer's import took 0.20 s and PDF.js's 0.26 s, the
  native canvas among it, against 0.45 s for the server's own, so a
  session that never renders starts in half the time and never maps the
  canvas.
- **The licences.** `scripts/dependency-licences.mjs` walks pdfjs-dist as
  any package: its Foxit faces are recorded as exceptions, file by file,
  under `standard_fonts/LICENSE_FOXIT`, PDFium's BSD 3-Clause; its profile,
  `iccs/CGATS001Compat-v2-micro.icc`, an ICC v2.1 CMYK profile whose `cprt`
  says "CC0", by its digest, with CC0 1.0's waiver as its sentence; and its
  four faces of Liberation Sans 1.07.4, under Red Hat's GPL-2.0 with a
  font-embedding exception, which the policy refuses, by a table of their
  own, `NEVER_LOADED`: a font a package ships that the one published
  package admitted for never loads, at one version, by the SHA-256 of each
  file, its package depended on by that published package and no other,
  with the test that shows it is never read. **That table is proposed
  here and is the owner's decision**: it is the first admission of files
  under a licence the policy refuses. The case for it: report-mcp never
  reads them -- a test shows a page in Helvetica, the one face PDF.js
  would read one for, read with no file read -- so no customer's document
  embeds them and nothing draws with them, and what an agent installs is
  pdfjs-dist's tarball, which npm fetches from the registry with the
  licence beside the files; Report's own tarball holds none of them.
  `@napi-rs/canvas` and its platform package are MIT, judged as any
  package; the canvas binary's own `sbom.cdx.json` lists what it
  vendors, which is review's to read and has not been read.

## Consequences

**What it buys.** An agent sees what a person would see on each page --
the line that moved to page 2, the total under the table, the slip alone
on the last page -- and is told it from the PDF, as every claim here is,
with the runtime's and the renderer's refusals by their codes, before
anyone deploys Report's server.

**What it costs.** **Every agent's install carries the renderer and
PDF.js.** report-mcp's third-party closure, measured by the guard's own
walk on 27 November 2026, went from 92 packages to 127 -- MIT 106, ISC 7,
Apache-2.0 5, BSD-3-Clause 3, 0BSD 2, BSD-2-Clause 1, BlueOak-1.0.0 1,
MIT AND Zlib 1, and png-js by its exception -- 87 of which no other
published package reaches, and to 194 MB on this Windows machine's disk:
ECharts 60 MB, the canvas's Windows binary 38 MB, pdfjs-dist 35 MB,
pdfmake 15 MB, PDFKit 8 MB among it; npm counts the canvas's Linux x64
binary at 34.8 MB unpacked. **If the owner refuses the admission**, the
guard refuses the PDF.js report-mcp carries, and this decision with it.
**A second line reader**, in a published package beside the corpus's:
one rule written twice, held equal by a test on the corpus's PDFs and
not on every report, and not at every fraction either -- a word gap of
0.25 em read every PDF compared as 0.15 em did, so the test would miss a
gap moved between them; a report that lines up otherwise than any of
them can read differently in the two. The text is PDF.js's, with its
limits (0003): text drawn over text, clipping and colour are not seen, a
chart's words are read as runs, an image and a code as nothing; a line
is its text, and where it stands on the page is not answered. **The
PDF's bytes are not returned**, so an agent that wants to look at a page
cannot, in this version. **An agent writes the runtime's envelope**:
`completeness` and `consistency` beside `header` and `detail`, which the
runtime refuses data without, as it does a host's; the tool's
description says so. **Bounded, not cheap**: a call within every bound
can take seconds -- 3.3 s at `MAX_DETAIL_ROWS` -- and the render runs on
the server's one thread, the signal heard between passes; a client's
cancel reaching the renderer through the protocol is not tested, only
`renderCheck`'s signal. **`@napi-rs/canvas`** is loaded with the first
check where it is installed, a native addon text extraction does not
draw with; that a check reads without it is not tested. PDF.js moves with
the corpus, so a PDF.js bump is one for an agent's install too, and a
bump of a pdfjs-dist whose fonts change is refused until they are read
again.

**What it forecloses.** A second version of PDF.js in the workspace, and
PDF.js reached from any published package but report-mcp while its
Liberation Sans 1 is admitted for report-mcp alone.

## Alternatives considered

**The resolved document's words.** No PDF.js and no second reader, and
no page: the one thing an agent cannot work out for itself is where a
page broke.

**report-documents extended to extract text.** Report's own reader would
have to decode fonts' encodings and content streams for text, which it
does not do and was not built to bound (0054).

**The corpus published.** It is test support, holding fixtures, PDF.js,
ZXing, saxes and pdf-lib, none of which an agent needs.

**The PDF's bytes in the answer.** An agent cannot read a PDF without a
reader; a client that can is the person's PDF viewer, and the bytes would
multiply every answer's size. Left for a later version that writes
nowhere but returns them as a resource on request.

**pdfjs-dist as an optional peer the integrator installs.** No GPL font
in the closure Report publishes, and a render check that works only once
somebody installs PDF.js beside it -- the licence question handed to the
integrator, and the guard, which walks an installed optional peer, would
still read its fonts here.

**Another build of PDF.js without its fonts**, as a serverless bundle
carries one. Another PDF.js than the corpus reads with, which is what
"one PDF.js" forecloses, and a bundle of someone else's making.

**Answering the pages that fit the answer's bound.** An agent told half a
report's pages as though they were all of them would act on what it
never saw; refused whole, it knows to check with fewer rows.

**A bound of pages alone.** A table of four-point print answered 17 KB
of lines a page, measured on the case that refuses one, so forty of its
pages would be more than twice the largest report an agent may send.
