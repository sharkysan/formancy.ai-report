# 0089 — The MCP's render check reads the PDF back with PDF.js at the corpus's pin, the first published package that carries it

- **Status:** accepted when its pull request merges; its two licence admissions, pdfjs-dist's Liberation Sans 1 as never loaded and `@napi-rs/canvas`'s builds by their SBOMs, each for report-mcp alone, are the owner's, made on 28 November 2026; numbered while 0083 to 0087 were held for the branches that bring a model's turn; extends [0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md), whose rule it applies to what an agent is told, [0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md), whose guard now walks PDF.js and reads a native build's SBOM, and [0088](0088-an-agent-gets-reports-checks-over-the-model-context-protocol-from-a-server-of-reports-own.md), whose render check it builds; [0013](0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)'s viewer stays the Studio's alone
- **Date:** 2026-11-27, its licence admissions decided and its review's findings answered on 2026-11-28
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **What it answers.** `packages/report-mcp/src/render.test.ts`: the
    quotation's one page, its lines in the order a reader meets them --
    the address and the quotation's own lines, two columns, read across
    the page -- its total after its subtotal and its page count last; a
    final render of data that lacks a field answers the runtime's
    `missing-field` at its path and no page; data without the envelope's
    `completeness` and `consistency` is the runtime's refusal of each; a
    preview of the same data prints, `PREVIEW_LABEL` its first line, with
    the runtime's warning; a locale the report does not declare and a
    zone Intl does not know are the runtime's `undeclared-locale` and
    `unsupported-time-zone`; a report of `MAX_CHECK_PAGES` pages prints
    every page, one of a page more is the renderer's `too-many-pages`; the
    validator's errors for a document that is no report; an aborted
    signal is the renderer's `cancelled`; an asset whose bytes are not the
    digest it came with is refused `asset-not-its-digest` before anything
    resolves, though the report never draws it and though the data would
    be refused; 10 MiB of base64 is answered by its codes,
    `asset-not-its-digest`, and `asset-not-base64` a character off and for
    padding alone; an image the call does not carry is the runtime's
    `missing-asset`; a face the report maps, passed as bytes with its
    digest, prints, and is the runtime's `missing-asset` where the call
    does not carry it; assets that are not four strings, bytes that are
    not base64 and a mode that is neither are refused; no byte of the PDF,
    raw or in base64, in any answer; nothing fetched; what the renderer
    throws that is no refusal is thrown on; and a load of the renderer
    that failed is asked for again by the next check.
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
    `src/server.test.ts`: the tool's description names the SDK's stdio
    bound, `STDIO_DEFAULT_MAX_BUFFER_SIZE`, by its value, which the whole
    call must stay under.
  - **One reading of a page's lines.** `src/pdf-text.test.ts`: for every
    starter of the corpus, every Euro invoice sample, Austria's caption
    turned up the side of its code among them, and the corpus's runs set
    below or above the line, the final render's lines, page by page,
    equal the corpus's `pageLines` of the same PDF, which the corpus's
    index now exports; every starter and every Euro sample prints, and
    only a run set off the line that the corpus expects refused may not;
    each fraction the rule is written with -- `DESCENT`, `SAME_LINE`,
    `WORD_GAP`, `SHIFT_TOLERANCE`, `JOIN_GAP` -- is the corpus's; and a
    guard on the guard holds that the documents compared hold a run set
    off its line and a run turned off the horizontal. The corpus is
    report-mcp's devDependency, as since 0088, and never its dependency:
    the install host holds only what report-mcp declares.
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
    and `./tools.js`, the renderer and `./pdf-text.js` only through
    `import()` or for a type; `pdf-text.ts` report-runtime, pdfjs-dist's
    `legacy/build/pdf.mjs` and, for a type, its `api.js`, so no module
    imports pdfjs-dist's sandbox, which runs a PDF's scripts; and
    `pdf-text.ts` calls `getDocument` by that name alone, with an object
    literal of `data`, `disableFontFace`, `useSystemFonts` and `verbosity`
    and nothing else -- no address of a font, a CMap, a profile or a
    decoder, no URL, no worker fetch, no factory -- its verbosity
    `VerbosityLevel.ERRORS`, since at a louder one PDF.js writes an
    `Info:` line to standard output, the protocol's.
  - **Through the protocol.** `src/server.test.ts`: `render_check` listed
    with its description and read-only, closed-world annotations; its
    seven arguments surviving the round trip, the zone and the mode read
    back from the manifest; a refusal arriving as `isError` with the
    runtime's errors structured; the modes a client is told the runtime's
    `DATA_MODES`.
  - **The licences.** `scripts/dependency-licences.mjs` and its tests:
    pdfjs-dist's Foxit faces by exceptions, file by file, under PDFium's
    BSD 3-Clause; its CMYK profile by its digest, CC0; its Liberation Sans
    1 by `NEVER_LOADED`, at the digests the review read, for report-mcp
    alone, refused without it and refused where the case it names,
    `file#test name`, is not in that file (`heldByProblems`); every
    package that ships a native addon refused unless `BUILDS_READ` names
    its build by its SBOM's digest, the components beyond the policy the
    SBOM lists the review's, reached through report-mcp and depended on by
    no package but what the review saw -- every dependent, not the first
    route -- and every build and version of `@napi-rs/canvas` that
    `pnpm-lock.yaml` names, on any platform, one the review read, its
    tarball by the integrity the lockfile records (`lockfileProblems`).
  - **From outside.** The `mcp` install host render-checks the quotation
    through the packed bin, its firm's mark passed as bytes, and reads
    its title back from page 1, no `%PDF` in the answer.
  - **Seen failing before merge**: the lines read from the resolved
    document instead of the PDF; a second pdfjs-dist release; a line
    reader joining runs otherwise than the corpus's -- a word gap of 1 em,
    or of none, the runs set off the line left lines of their own, a
    turned caption read among the lines, the same-line fraction made 1.2;
    a word gap of 0.25 em, which the PDFs read alike, by the fractions'
    case; the standard fonts read from pdfjs-dist's own directory; the
    digest check dropped, and made after the data; each bound loosened;
    the signal dropped; a fault answered as a refusal; fonts dropped from
    the assets; `render_check` registered under another name, its data
    under another, its zone dropped; and, after review, the pattern of
    base64 quanta, which overflowed the stack on 10 MiB; a failed load
    kept; a Euro sample refused and skipped; a static import of the
    renderer, `getDocument` given a font's address, a spread or another
    name, each past the guard before its rule; and the guard's rules for
    native builds, the lockfile and `heldBy` each switched off; and, at
    the re-review, a second dependent of the family behind a first route
    through report-mcp, a tarball of other bytes, and `getDocument` at
    `VerbosityLevel.INFOS`, each past the guards before their rules.

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
it requires `@napi-rs/canvas`, its optional dependency, at `^1.0.10`,
when it is installed, at import, to polyfill `DOMMatrix` and `Path2D`,
and runs its worker in the same thread, importing `pdf.worker.mjs` from
its own package. It ships ten of Foxit's Type 1 faces and four of
Liberation Sans 1.07.4 in `standard_fonts/`, a CMYK profile in `iccs/`,
and decoders and a QuickJS sandbox in `wasm/`, each read only from an
address a caller gives; 0006 found the fonts on 14 October and said a
package that ships `pdfjs-dist` would stop on them.

What `@napi-rs/canvas` 1.0.11 is, read from the registry's tarballs on 28
November 2026: an MIT wrapper, and eleven platform builds the lockfile
names, each MIT by its manifest, a `skia.<platform>.node` addon -- Skia,
built with the libraries it links -- and a CycloneDX 1.6
`sbom.cdx.json`, which the guard did not read. Each SBOM lists 107
components, `linux-riscv64-gnu`'s 105, and beyond the policy the same
twelve in every one: four Rust crates under MPL-2.0 -- cssparser 0.38.0,
cssparser-color 0.6.0, cssparser-macros 0.7.0, dtoa-short 0.3.5 --
FreeType under the FTL; ICU under the ICU licence, whose data the Windows
builds ship as `icudtl.dat`, 10.9 MB; libjpeg-turbo under BSD-3-Clause,
IJG and Zlib; libpng under libpng-2.0; unicode-ident under (MIT OR
Apache-2.0) AND Unicode-3.0; fnv and siphasher, whose "Apache-2.0 / MIT"
and "MIT/Apache-2.0" are no SPDX expressions; and the canvas crate, which
states none. No Skia component is listed, though the binary is Skia's.
Unlike the Liberation faces, this addon is loaded: in report-mcp's
process, from its first render check, wherever npm installed it.

## Decision

**`render_check` renders a report with what an agent passes in, reads the
PDF it rendered back with PDF.js at the corpus's pin, and answers its
lines, page by page; the MCP is the first published package that carries
PDF.js, its Liberation Sans 1, which nothing here loads, is admitted for
it alone as never loaded, and `@napi-rs/canvas`'s builds, which PDF.js
loads, for it alone by the SBOMs a review read -- both on the owner's
decision of 28 November 2026.**

- **The pipeline.** report-spec's validator; the runtime's `resolveReport`
  with the data, the parameters, the locale, the zone and the mode passed
  in, a final render unless a preview is asked for, at a creation date
  fixed for every check, 1 January 2000, which only the PDF's metadata
  holds; `renderPdf` with the call's signal; the PDF read back. The first
  refusal is the answer, by whichever package gave it, with its codes:
  the validator's errors, the runtime's errors with their stages and
  paths, or the renderer's code, sentence and subject.
- **Assets** come in the call as `{ asset, digest, mediaType, base64 }`,
  base64 read by its length in whole quanta and one character class with
  its padding after it, which backtracks nothing -- a pattern of quanta
  overflowed V8's stack from 4,473,916 characters, an asset of 3.35 MB,
  bisected in a bare Node 24.21 on 28 November 2026 -- each held to the
  digest it is given with by report-spec's `assetDigest` before anything
  resolves, whether or not the report draws it; the runtime asks for an
  asset by its id and digest, so bytes reach it only under the digest
  they are. Never by URL, path or file.
- **The bounds** on what one call costs:
  - the call, through stdio, by the SDK's bound, 10 MiB a message, the
    report, the data and every asset's base64 together: past it the
    transport closes and the server ends without an answer (0088). It
    applies before the runtime's rows bound: measured on 28 November 2026,
    the quotation with its firm's mark carries at most 78,013 of its lines
    in one call, 134 bytes a line, and 100,000 of them are 13.4 MB. The
    tool's description says so, and asks for a sample of rows;
  - the report, `MAX_REPORT_BYTES` as a save holds it, measured as
    report-spec states it, before anything resolves;
  - the data, by the runtime's own bounds -- `MAX_DETAIL_ROWS`, 100,000
    rows, and `MAX_STRING_LENGTH`, 16,384 characters a string -- which a
    caller of the library meets, and the transport's first through stdio;
  - the PDF, `MAX_CHECK_PAGES`, 40, the renderer's `maxPages`, past which
    it refuses the document, before pdfmake lays it out where its least
    height already needs more. Chosen, the Studio's preview's number, and
    measured on 27 November 2026 on an Intel i9-10900K under Node 24.21 on
    Windows: the quotation printed to 40 pages, 1,250 lines, took 1.4 s
    and answered 89,905 bytes; past 40 it was refused in 0.4 to 0.6 s; at
    `MAX_DETAIL_ROWS` the runtime took 3.3 s before the renderer refused;
    every starter took 0.1 to 0.65 s, the sales report 2.2 s for its first
    chart, which loads ECharts, and answered 1.0 to 10.2 KB;
  - the answer's data, `MAX_ANSWER_BYTES`, which is `MAX_REPORT_BYTES`, so
    a check's data is no larger than the largest report an agent may
    send; a client may show it twice, as the text and as the structure,
    as it does an edit's report (0088). Past it, refused with the page
    count and the size, no line cut.
- **The reading.** `pdf-text.ts` loads the PDF from its bytes with no
  address for a standard font, a CMap, a profile or a decoder, no font
  face made, no system font: so nothing is fetched or read from a file,
  and pdfjs-dist's fonts, profile and decoders are never loaded. PDF.js 6
  has no `isEvalSupported`: it compiles no PDF function to JavaScript, so
  there is no evaluation to switch off; `getTextContent` decodes no image,
  and no module imports the sandbox that would run a PDF's script. Each
  page's runs are given the corpus's box, computed to the last operation
  as `read-pdf.ts` computes it, and joined by `pageLines`' rule: one
  baseline a line, read left to right, a gap wider than `WORD_GAP`,
  0.15 em, a space, a run set below or above the line read into its line,
  a run turned off the horizontal a line of its own, after the others.
  `pdf-text.test.ts` holds the two readings equal, and each fraction the
  rule is written with to the corpus's.
- **The answer** is `{ rendered, pages: [{ page, lines }], warnings,
  manifest }`, the runtime's warnings and manifest as they are, never the
  PDF's bytes. A refusal is `isError`, 0088's envelope.
- **Loaded with the first check.** The renderer and PDF.js are imported
  when an agent first calls `render_check`, through `import()`, which the
  composition guard holds: measured on the same machine and day, the
  renderer's import took 0.20 s and PDF.js's 0.26 s, the native canvas
  among it, against 0.45 s for the server's own, so a session that never
  renders starts in half the time and never maps the canvas. A load that
  fails is forgotten, and the next check asks for it again; what that
  recovers is Node's to say. A module Node could not find or read is
  looked up again and loads once it is there; one that threw as Node
  evaluated it stays errored in Node's loader, and the next import answers
  the same error without evaluating it again, so the server answers every
  check with it until it restarts. Both were seen on Node 24.21 on 28
  November 2026.
- **The licences.** `scripts/dependency-licences.mjs` walks pdfjs-dist as
  any package: its Foxit faces are recorded as exceptions, file by file,
  under `standard_fonts/LICENSE_FOXIT`, PDFium's BSD 3-Clause; its profile,
  `iccs/CGATS001Compat-v2-micro.icc`, an ICC v2.1 CMYK profile whose `cprt`
  says "CC0", by its digest, with CC0 1.0's waiver as its sentence. And two
  tables of their own, each the first of its kind, each the owner's
  decision of 28 November 2026, each for report-mcp alone:
  - `NEVER_LOADED`, for the four faces of Liberation Sans 1.07.4 under Red
    Hat's GPL-2.0 with a font-embedding exception, which the policy
    refuses: a font a package ships that the one published package
    admitted for never loads, at one version, by the SHA-256 of each file,
    its package depended on by that published package and no other, held
    by a case named `file#test name` that the guard finds in that file.
    The case for it: report-mcp never reads them -- the case shows a page
    in Helvetica, the one face PDF.js would read one for, read with no
    file read, and the composition guard holds `getDocument` to options
    that name no address -- so no customer's document embeds them and
    nothing draws with them, and what an agent installs is pdfjs-dist's
    tarball, which npm fetches from the registry with the licence beside
    the files; Report's own tarball holds none of them.
  - `BUILDS_READ`, for `@napi-rs/canvas` 1.0.11: a package that ships a
    native addon, a `.node` file, is refused unless the table names its
    family, its version and its build by the SHA-256 of the SBOM it
    ships, the components beyond the policy that SBOM lists are the
    twelve the review recorded, it is reached through report-mcp, and
    every package that depends on it is one the review saw -- the
    family pdfjs-dist alone, a build its family alone; and every build
    and version of the family the lockfile names, on every platform, is
    one the review read, each tarball by the integrity the lockfile
    records and pnpm installs by, since no machine installs them all.
    Each tarball the SBOMs were read from is the one the lockfile
    records, compared on 28 November 2026, so a build's binary is held
    with its SBOM. The case for it: the components beyond the policy are
    linked into a binary nobody modifies; MPL-2.0 is file-level, asking
    nothing of a use that does not modify those files; and what an agent
    installs is the build's tarball, from the registry, with its SBOM.

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
binary at 34.8 MB unpacked. **Files under licences the policy refuses
are in every agent's install**: Liberation Sans 1, GPL-2.0 with a font
exception, never read; and in the canvas binary, which is loaded, code
under MPL-2.0, the FTL, ICU, IJG, libpng-2.0 and Unicode-3.0, each by
the owner's admission. **A canvas nobody read may be installed**:
pdfjs-dist asks for `^1.0.10`, so an integrator's own install may resolve
a later 1.x whose builds and SBOMs nobody here read; the guard holds this
repository's lockfile, not an integrator's. The SBOM names no Skia
component, and the guard reads what the SBOM says, not what the binary
holds. **A message past 10 MiB ends the server**, and with a few
megabytes of logo or some tens of thousands of rows a call reaches it:
78,013 of the quotation's lines at most. **A second line reader**, in a
published package beside the corpus's: one rule written twice, held equal
by a test on the corpus's PDFs and by each of its fractions, and not on
every report; a report that lines up otherwise than any of them can read
differently in the two. The text is PDF.js's, with its limits (0003):
text drawn over text, clipping and colour are not seen, a chart's words
are read as runs, an image and a code as nothing; a line is its text, and
where it stands on the page is not answered. **The PDF's bytes are not
returned**, so an agent that wants to look at a page cannot, in this
version. **An agent writes the runtime's envelope**: `completeness` and
`consistency` beside `header` and `detail`, which the runtime refuses
data without, as it does a host's; the tool's description says so.
**Bounded, not cheap**: a call within every bound can take seconds --
3.3 s at `MAX_DETAIL_ROWS` through the library -- and the render runs on
the server's one thread, the signal heard between passes; a client's
cancel reaching the renderer through the protocol is not tested, only
`renderCheck`'s signal. **`@napi-rs/canvas`** is loaded with the first
check where it is installed, a native addon text extraction does not
draw with; that a check reads without it is not tested. PDF.js moves with
the corpus, so a PDF.js bump is one for an agent's install too, and a
bump of a pdfjs-dist whose fonts change, or of a canvas whose builds do,
is refused until they are read again.

**What it forecloses.** A second version of PDF.js in the workspace, and
PDF.js or the canvas reached from any published package but report-mcp
while they are admitted for report-mcp alone.

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

**Installing without the canvas, `--omit=optional`.** No canvas code in an
agent's process, and the integrator's to remember on every install, with
no case here showing a check reads without it; the owner admitted the
builds by their SBOMs instead.

**The canvas judged by its manifest alone, MIT, as before review.** The
guard would pass code under MPL-2.0 and five other licences the policy
refuses, which only the build's SBOM says.

**Answering the pages that fit the answer's bound.** An agent told half a
report's pages as though they were all of them would act on what it
never saw; refused whole, it knows to check with fewer rows.

**A bound of pages alone.** A table of four-point print answered 17 KB
of lines a page, measured on the case that refuses one, so forty of its
pages would be more than twice the largest report an agent may send.
