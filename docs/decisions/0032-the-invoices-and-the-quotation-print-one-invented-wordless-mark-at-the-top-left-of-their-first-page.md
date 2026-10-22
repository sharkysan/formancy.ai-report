# 0032 — The quotation, the QR-bill invoice and the euro invoice, their samples and the e-invoice samples print one invented, wordless firm's mark at the top left of their first page: the corpus's SVG mark, approved as any asset is, the first template asset a starter draws; a mark per firm, a PNG made in code, a drawing of its own, the top right and the page header lost

- **Status:** accepted; narrowed by [0039](0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md), under which the QR-bill invoice and its samples have one diagnostic, the warning that their bill pays SIX's example QR-IBAN, where this record holds them to none
- **Date:** 2026-10-18
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The corpus.** report-corpus's `src/starters/logo.test.ts`, with the
    reports that carry the mark and those that do not stated as lists in
    the test, never read from the starters:
    - the mark is the corpus's `SVG_MARK`, which `cleanSvg`, the
      runtime's own, writes of the mark as a drawing program saved it,
      and which cleans to itself with nothing removed and passes
      `checkSvg`;
    - its digest is pinned as a literal, and is the SHA-256 of its bytes;
    - read by saxes, a parser that is not the cleaner, it is an `svg`
      holding a circle and two paths, with no text node, painted in
      `#1f4e79` and `#ffffff` and nothing else;
    - every report of the corpus a person sees printed declares the mark
      or not as the lists say: the quotation, the QR-bill invoice and its
      three samples, the euro invoice and its six, and the three e-invoice
      samples declare exactly the one asset, at its digest; the service
      inspection and the equipment register declare none;
    - each marked report begins its report header with the mark, 15 mm
      square to the hundredth of a point, `contain`, then a 12 pt gap,
      then its sender's line; draws it exactly once; has no diagnostic,
      `unused-asset` among them; and puts no image in its page header;
    - each resolves with the host's lookup and no warning, and is refused
      `missing-asset` at the mark without it;
    - the starters' lookup hands the mark over at its own id and digest
      alone, and nothing for `logo` at another digest, since the runtime
      never holds the bytes it is handed to the digest a report declares.

    `samples.test.ts` and `euro-samples.test.ts` pin the starters' moved
    JSON digests, and `e-invoice.test.ts` reads the firm's line as the
    first paragraph under the mark.
  - **The PDFs** ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md),
    [0030](0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)).
    report-render-pdf's `src/samples.test.ts`, `src/euro-samples.test.ts`,
    `src/e-invoice-samples.test.ts` and `src/starters.test.ts`, through
    `src/testing/letterhead.ts`, which states what the mark should be:
    - on the page of every invoice and sample, the e-invoice samples'
      PDF/A-3b among them, exactly one drawing in the mark's blue, its clip
      at 56.69, 56.69 and 42.52 pt a side, its paths in its two paints and
      no other; no image; and no text beside it or in the 12 pt under it,
      the firm's line the first under it;
    - by the pixels PDF.js draws at four to the point, on the German
      QR-bill invoice and the Austrian euro sample, the disc `#1f4e79`,
      the drop `#ffffff`, and the paper white in a band of 2 pt around the
      box;
    - every page count, slip, code and detail beside it as the tests held
      them before;
    - the quotation's mark on its first page alone, under its running
      head, at the left margin and 15 mm square, on a render of 45 lines
      over two pages;
    - the quotation's first page holding 25 of 30 line items under the
      mark, and 27 with its letterhead taken out, as it printed before;
    - the quotation's page-break windows measured again, each holding a
      quotation whose totals print before its boundary and one whose
      totals print after it;
    - the mark's reach in an e-invoice on A4, by `svgReach`, exactly the
      floor every drawing has, twice `MAX_SVG_COORDINATE`, a thousandth of
      `SVG_INTEGER_BOUND`;
    - the converter's slowness guard, `svg-converter.test.ts`, held to the
      quotation's first page with its letterhead taken out, as 0030
      measured it, so that its yardstick holds no SVG.
  - **The pictures.** report-render-pdf's `src/pictures.test.ts` holds
    each manifest's `lines` with their `places` -- where each starts, its
    left edge and its top to the hundredth of a point -- and its
    `drawings` -- every clip a painted path stands inside, its box to the
    hundredth, its paints and each of its paths, its paint and its box --
    to the PDF the renderer writes now; and the Studio's browser gate holds
    the Download PDF's drawings, from the browser entry in Chromium, to
    `docs/images/pictures.json` at every starter in both builders. Both
    read the drawings with report-corpus's `drawingsOn`, which
    `drawings.test.ts` holds to tell a mark redrawn inside its own box, in
    its own paints, from the mark it was. The Studio's own pictures are
    held by `pictures.mjs --check`.
  - **The Studio.** `apps/studio/src/preview/pipeline.test.ts` prints the
    quotation through the browser entry the page uses, with the starters'
    images as they cross into the page as base64, and finds the mark's
    clip with its blue painted inside it and no image.
  - **From outside.** The install gate's `consume.ts` prints the quotation
    from the packed packages through the README's "Render a report", which
    `scripts/readme-example.test.mjs` holds to it line for line, the Data
    provider's README's example with it, and finds the mark's disc in the
    clip of its box in the page's drawing; the guide's React page previews
    the quotation with its mark through the guide's `printPreview`, which
    hands the runtime the host's lookup; report-render-pdf's
    `src/install-fixture.test.ts` holds the consumer's copy of the mark's
    bytes and digest to the corpus's.
  - **The e-invoice gate.** Its samples are resolved with the host's
    lookup, so the PDF/A-3b veraPDF and Mustang judge of each draws the
    mark, as do the variants drawn from the first sample's page and those
    of the marked starters. Run on 18 October 2026 on Zulu's Java
    25.0.4.1, it judged every file as its corpus expects, and failed only
    where the recorded corpus was not the one it judged: sixteen PDFs, the
    three samples' and every variant and control drawn from the first
    sample's page or a marked starter's. The variants of the service
    inspection, the equipment register and the fonts fixture kept their
    recorded digests, as did the three samples' XML, which Mustang's
    checksum of each shows unchanged; recorded with `--record` the same
    day.

  Watched failing, one change at a time, on 18 October 2026, each put
  back: the Irish euro sample without its letterhead, which failed its
  declaration, its single drawing and its refusal without the host's
  bytes; the French euro sample given a second asset, which failed its
  declaration and its diagnostic; the mark's circle a unit smaller, which
  failed the mark's bytes and its pinned digest; the quotation's
  letterhead put in its page header, which failed on page 2, where the
  mark then stood; the mark's box made 15 by 10 mm, which failed every
  page's drawing and both pixel tests; the band read around a box 2 pt
  smaller each side than the mark, which found 236 pixels of ink; the
  page-break windows as they stood on main, 27 to 35 and 64 to 70, which
  failed the windows' own check on the new layout; the Studio's codec
  dropping an SVG's bytes, which failed the mark's test and every marked
  starter's preview; the install gate's copy of the quotation drawing its
  mark 30 pt square, which failed the consumer with "the quotation printed
  through the README's lines did not draw its mark's disc in the clip of
  its box"; and `pictures.test.ts` and the browser gate over the
  manifests as they were before the mark, which failed every picture,
  where before this record each still passed, since the mark prints no
  text. And after review, the same day: the mark's gable drawn 10 units
  lower, its clip and its paints unchanged, which every picture passed
  while the manifests recorded a drawing by its clip and paints alone, and
  which failed the twelve that show the mark once they recorded its
  paths; the letterhead's gap made 6 pt, which failed the seven euro
  pictures alone, by their code's clip, until the manifests recorded where
  each line starts, and all twelve after; the gap made 30 pt, which failed
  the first page's count, 24 for 25; the starters' lookup matching an id
  alone, which failed its digest's test; and the guide's React page
  opening the quotation with its mark while `printPreview` passed no
  lookup, which failed the install gate with its first preview refused.

## Context

- **The person asked whether a report can carry a logo.** It could: a PNG
  or a JPEG as an approved asset
  ([0007](0007-a-report-definition-is-its-own-versioned-document.md),
  [0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)),
  and an SVG since 0030. But nothing a person sees showed it. No starter
  declared an asset, so the Studio's Insert palette offered Image disabled
  on every starter but the inspection, whose photo is a field's; and a
  template's asset was printed from the definition through the host's
  lookup to the PDF only by reports built for a test, 0030's in the
  renderer and the install gate, never by one a person opens.
- **The firms are one firm.** Every invoice and quotation of the corpus
  is from an invented "Formancy" of a trade, and its samples differ in
  nothing but their words and whom they bill
  ([0024](0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md),
  [0028](0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)).
  The e-invoice samples are the German firm's invoices to German
  businesses
  ([0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)),
  drawn as PDF/A-3b
  ([0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)),
  and 0030 holds an SVG in an e-invoice to what a PDF/A-3 can hold, so
  the reason to leave them without a logo -- that an e-invoice was not
  yet a PDF/A-3 -- had gone.
- **The corpus already had a mark.** 0030's fixtures draw an invented
  one, `SVG_MARK`, held to be the bytes `cleanSvg` writes and the cleaned
  form of the same mark as a drawing program saved it, `SVG_AS_SAVED`; the
  e-invoice gate's `variant-svg.pdf` draws it, and veraPDF and Mustang
  accepted that PDF/A-3b on 18 October 2026.
- **Where the page has room.** Read off the committed pictures and then
  measured: every invoice and sample is one page with room above its slip
  or its code, and the quotation's first page held at most 27 line items.

## Decision

- **One mark, `logo`.** The corpus's `SVG_MARK`, as its starters' `LOGO`
  (`starters/logo.ts`): a deep-blue disc, `#1f4e79`, with a white gable
  stroked over a white drop, for a building's services and its water. No
  word, no cross, no square, and none of the room's violet or teal; one
  deep colour on white, which prints dark in greyscale. It imitates no
  firm's mark, and its module says so.
- **Approved as a customer's logo is.** The bytes are those `cleanSvg`
  writes, declared by the SHA-256 of exactly them, and handed over by the
  host's lookup when the runtime asks for `logo` at that digest
  (`STARTER_IMAGES`, `starterImages`).
- **Its place.** First in the report header, with no container: the
  image, 42.52 pt square, `contain`, then a 12 pt spacer, then the sender's
  line (`LETTERHEAD`). It prints once, on the first page, at the margins'
  corner, as a letterhead does: on the quotation, under its running head.
- **Which reports.** The quotation, the QR-bill invoice and its samples,
  the euro invoice and its samples, and the e-invoice samples. Not the
  service inspection or the equipment register, which are no firm's
  letters.
- **The pictures record where their lines stand and what they draw.**
  The manifests of the README's pictures of the PDFs gain where each line
  of the pictured page starts and the page's drawings, path by path, held
  to the PDF written now and, the drawings, in Chromium, to the Studio's
  Download PDF, so that a change that moves a line of the page, or adds,
  removes, moves, resizes or repaints a drawing or a path of one, fails
  the picture it would leave stale, though it prints no new word.
- **The guide's preview hands over the host's assets.** The getting-started
  guide's `printPreview` takes the host's lookup of approved assets, and
  its page reads the report's approved assets from the host's server
  beside the sample, so that a report with a logo, the quotation starter
  among them, previews there rather than being refused.

## Consequences

**What it buys.**
- **A logo seen.** The Studio's Preview, the README's pictures and the
  product pages' figures show a report printing one, and the builders show
  it as "Image: logo" in their outline and as its box in their design
  view.
- **The template-asset path proved on the reports a person opens.** From
  the definition, through the host's lookup and the runtime, to the PDF;
  in Node, in the Studio's browser entry under Node and in Chromium, and
  from the packed packages through the README's own lines and the guide's
  preview; and in the samples' PDF/A-3b that veraPDF and Mustang judge.
- **Image in the palette.** The Studio's Insert palette offers Image on
  the starters that carry the mark, its source the mark, before an upload
  exists.
- **A picture fails when its page moves or draws otherwise.** The mark
  prints no text, so before this record a picture taken without it still
  passed; a picture now fails when a line of its page starts elsewhere,
  or a drawing or a path of one, a QR code's included, is added, removed,
  moved, resized or repainted. Not seen still: a path redrawn with every
  point inside its old box -- a QR code's modules are one path -- a rule,
  a border or an image, which no manifest records, and the colour of text.
- **The quotation's page-break test holds itself.** Its windows had
  already drifted: on main the totals first carried a line to the next
  page at 25 and at 56 line items, and the windows began at 27 and at 64.
  Each window now fails when it no longer straddles its boundary.

**What it costs.**
- **A lookup for every render of these.** A host, or a test, that prints
  one of these starters or samples hands over the mark's bytes by its id
  and digest, or the render is refused `missing-asset`. Every resolution
  of them had to learn it: the corpus's and the renderer's tests, the
  Studio's pipeline test, the e-invoice gate, the install gate, and both
  READMEs' examples, which now pass `images`.
- **The guide's preview takes a lookup.** The getting-started guide's
  `printPreview` takes the host's lookup of approved assets as a
  parameter, and its page fetches the report's approved assets, with the
  digest each was approved by and its bytes as base64, from a route of the
  host's server; a page that copied the guide's `printPreview` before this
  record passes no lookup, and a report that draws an asset is refused
  there as `missing-asset` until it passes one.
- **0.1.0 refuses them.** The marked starters declare an SVG asset, which
  0.1.0's validator refuses as `not-one-of`, so the quotation and invoice
  starters as 0.2.0 has them open only in a release that reads SVG (0030).
- **Moved pins, and every picture retaken.** The invoice's and the euro
  invoice's pinned JSON digests moved; every picture of a PDF was drawn
  again, twelve of them showing the mark, and the Studio's pictures were
  retaken by their script.
- **Room taken.** 54.52 pt of each first page. The quotation's first page
  holds at most 25 line items where it held 27, and its totals carry the
  last line to the next page from 23 lines and from 54, where they did from
  25 and from 56, measured on 18 October 2026 by rendering it at every
  count from 20 to 75 with the mark and without it and counting the
  articles PDF.js reads on each page; `starters.test.ts` holds the 25 and
  the 27 at 30 line items.
- **Bytes, and no time a median shows.** The mark adds 430 bytes to the
  quotation's PDF, 342 to the invoice's, 367 to the euro invoice's and 330
  to the e-invoice sample's; drawn nine times with it and nine without,
  alternated, in two runs from the built packages on an Intel i9-10900K
  under Node 24.21.0 on 18 October 2026, the medians with it were 4 ms
  shorter to 5 ms longer, within either run's spread. The figures that
  `09-quality-requirements.md` gives for the invoices were measured before
  the mark, and it says so.
- **The fixture is the starters' mark.** A change to `SVG_MARK` for a
  fixture's sake moves every marked starter, its pins and its pictures;
  the mark's pinned digest fails first, and its test says what moves with
  it.
- **The PNG path is not seen.** The mark is a vector, so the PNG path for
  a template asset is still proved only by the corpus's fixtures, not by
  anything a person sees.
- **The install gate's consumer at the size budget.** `consume.ts` stands
  at 598 of 600 lines, and the next addition splits it.

**What it forecloses.**
- A mark per firm or per country, short of a new record.
- A mark that holds a firm's name: the cleaner refuses text, and
  lettering outlined as paths would read as some firm's name, which no
  check of a page's text could see.

## Alternatives considered

- **A mark per firm.** The samples would differ in more than their words,
  against 0024's and 0028's rule; eleven firms, eleven drawings to review
  and eleven digests, for no proof one mark lacks.
- **A PNG made in code with `encodePng`.** Its digest would belong to the
  zlib of the Node that ran it, and CI's Node floats on its major version,
  so every marked starter's JSON and pin would move with it; it would be a
  binary a reviewer reads only as pixels; and it would prove nothing about
  SVG, which is what logos are drawn as.
- **A drawing of its own for the starters.** The design proposed a disc
  reaching its viewBox's edge. It would be a second invented mark nearly
  the first, to review again, and one veraPDF had never judged.
- **Top right, in a `columns` row.** An image has no alignment of its own.
  In the design view a component at the top of a narrow column at a
  container's right end has its label over the container's, where the
  browser gate's axe could not tell the colour behind the labels when the
  EPC code first stood so (debt in
  [11](../architecture/11-risks-and-debt.md)); it would be the first
  `columns` row of the euro samples' body; and no test could show it was
  better.
- **In the page header.** A letterhead prints once. A mark on every page
  of a long quotation is an author's choice, and a drawing in a page
  region is drawn again on every page and counted so (0030).
- **The e-invoice samples without it.** Two invoices of one firm would
  look unlike, for a reason that no longer held.
