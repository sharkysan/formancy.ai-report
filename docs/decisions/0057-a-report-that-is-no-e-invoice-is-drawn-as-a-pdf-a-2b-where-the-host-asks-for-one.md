# 0057 — A report that is no e-invoice is drawn as a PDF/A-2b where the host asks for one, `pdfa: '2b'` on a final render: an e-invoice's PDF/A-3b refusals held for it, a Factur-X, an XRechnung's copy and a labelled preview refused as one, and veraPDF's PDF/A-2b profile judging every starter in the e-invoice gate; PDF/A for every report, PDF/A-1b, PDF/A-3b and a mode in the resolved document lost

- **Status:** accepted; numbered 0057 while 0053, 0054, 0055 and 0056
  were held by branches not yet merged; extends
  [0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md),
  under which an e-invoice alone was a PDF/A, its refusals of a title and
  a CMYK JPEG now held for any PDF/A, and
  [0030](0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md),
  whose bounds on an SVG in an e-invoice alone it holds a PDF/A-2b to, and
  [0011](0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md);
  amends [0005](0005-pdfmake-renders-reports-behind-one-adapter.md) as
  0031 did, a PDF/A-2b's render reading PDFKit's ICC profile beside the
  fonts too; and extends
  [0038](0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md),
  whose copy is refused as a PDF/A-2b, and
  [0014](0014-a-release-report-is-derived-from-the-run-that-gated-it.md),
  whose release report judges a third format
- **Date:** 2026-11-11
- **Deciders:** Daniel Bacher
- **Verified by:** each case below was watched failing before the code
  that passes it, or with the rule it holds reverted on its own and the
  file put back, on 11 November 2026, as each says:
  - **What a document is drawn as, decided before pdfmake sees it.**
    report-render-pdf's `src/pdfa-check.test.ts`: `pdfa` of any value but
    `'2b'` -- `'3b'`, `'2a'`, `'2u'`, `'PDF/A-2b'`, `'1b'`, `2`, `null` --
    a `RangeError` naming the value, pdfmake never asked; a final render
    asked for as `'2b'` handing pdfmake version 1.7 and subset
    `PDF/A-2b`, and one without `pdfa` neither; a Factur-X refused as
    `unsupported`, naming `eInvoice`, and drawn as its PDF/A-3b without
    `pdfa`; an XRechnung's copy refused alike and drawn as its plain copy
    without it; an e-invoice of a kind the renderer does not know, and
    one that says it is a Factur-X under a file name it does not know,
    refused for what they are with `pdfa` and without; a preview of
    incomplete data and a preview of an e-invoice, each labelled by the
    runtime, refused naming `pageHeader`, and drawn without `pdfa`; and
    "Müller & Söhne", `<`, `>`, a bell and half a surrogate pair in a
    title refused naming `info.title`, and drawn without `pdfa`. Each
    message is a literal in the test. 17 of its 18 cases failed before
    the code, the unknown kind being refused already; and five rules were
    reverted one at a time, each failing its cases: the PDF/A-2b's refusal
    of any e-invoice put before `checkEInvoice`, which failed the unknown
    kind's and the XRechnung's cases, the e-invoice's preview label
    not read, `pdfaOptions` answering PDF/A-3b always, the title checked
    in a 3b alone, and the refusal reading the file's kind before
    `checkEInvoice` does, which passed the one unknown kind and fails
    since the test holds a second.
  - **The images a PDF/A-2b cannot hold.** `src/assets.test.ts`: a CMYK
    JPEG in the body and in the page header refused in a PDF/A-2b,
    naming the image, pdfmake never called, and drawn in the same report
    without `pdfa`; every other kind report-corpus's `IMAGE_KINDS` holds
    drawn in a PDF/A-2b. `src/svg-pdfa.test.ts`: each of its SVG cases
    drawn or refused in a PDF/A-2b as in an e-invoice, every number the
    drawn PDFs write read back with report-corpus's `readPdfNumbers`; the
    refusals naming the PDF/A-2b with their range and nesting; and
    report-corpus's `SVG_BOUND` drawn at `SVG_BOUND_SIDE` with no integer
    past the range, and refused a hundredth smaller. 15 cases failed
    before the code. The PDF/A-3b's messages are pinned byte for byte
    there and in `src/refusals.test.ts`, unchanged.
  - **On the PDF it produced**
    ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)).
    `src/pdfa-2b.test.ts` resolves every starter that is no e-invoice in
    a final render, draws it through the Node entry with `pdfa: '2b'` and
    without, and reads it back with readers that are not PDFKit: a PDF
    1.7 whose well-formed XMP says part `'2'` and conformance `'B'`; one
    output intent, `GTS_PDFA1`, its profile PDFKit's own file byte for
    byte; nothing on `/AF` and nothing in the name tree but `Dests`; no
    `OpenAction`, `AA` or `AcroForm` among the catalog's keys, no
    `JavaScript` in its name tree, and no annotation; and the plain
    render's pages, every run, face, image, path and clip, read with
    PDF.js. A preview of the quotation that lacks nothing is its final
    render's document and draws to the same PDF/A-2b, and every starter
    draws to the same bytes twice. A guard fails when the starters drawn
    are not every one but the e-invoice, watched failing with a second
    starter filtered out and with none drawn. 12 of its cases failed
    against the corpus before its reader had the keys; and with the test's
    renders made without `pdfa`, the 3b's hook run on a 2b, a 2b's top
    margin one point lower -- which failed again with the comparison of
    definitions taken out, on the PDF alone -- and a random creation
    date, each failed the cases it aims at. report-corpus's
    `src/objects.test.ts` holds `catalogKeys` and `nameTreeKeys` on PDFs
    PDFKit writes plain and as a PDF/A-3b, and on a pdf-lib PDF that
    holds an `/OpenAction` and a `JavaScript` name tree, so that "no
    action" is not read from a reader that finds none; both cases failed
    before the fields.
  - **The profile.** `src/pdfmake.test.ts`: a render reads PDFKit's ICC
    profile beside the fonts for a PDF/A alone, an e-invoice's or a
    PDF/A-2b, and no other file; and a PDF/A-2b whose profile PDFKit
    cannot read rejects with Node's own `ENOENT`, no `RenderRefusal` and
    no PDF, a case that failed with the test's redirect aimed at another
    file, the render succeeding. `src/browser.test.ts`: the
    browser entry hands pdfmake the definitions the Node entry does for a
    PDF/A-2b, carries the reviewed profile from the build's base64 copy,
    embeds nothing and draws every object the Node entry draws, each
    stream inflated, and draws the same bytes twice; failed with `pdfa`
    left out of its render.
  - **The packed renderer.** The install gate's Node consumer,
    `scripts/install-fixture/consume.ts`, runs
    `scripts/install-fixture/pdfa.ts`: the quotation drawn from the
    tarballs with `pdfa: '2b'` and read with Node alone, a PDF 1.7 that
    associates and names no file, says part 2 and conformance B in its
    XMP and carries the reviewed sRGB2014 as its output intent, at the
    PDFKit a clean npm install resolves; and
    `scripts/install-fixture/e-invoice.ts` has a Factur-X refused as one,
    `unsupported`, naming `eInvoice`. With `pdfa` taken out of `pdfa.ts`
    the gate failed: "it lacks PDF 1.7; PDF/A-2b in the XMP; the reviewed
    sRGB2014 output intent".
  - **The gate, on PDFs** (`scripts/e-invoice.mjs`, the `e-invoice` job).
    The corpus's format `pdfa-2b` (`scripts/e-invoice/pdfa-2b.mjs`),
    judged by veraPDF alone (`JUDGES`, `judgedBy` in `registers.mjs`), in
    a second run with `--flavour 2b`, each result held to the profile
    `PDF/A-2b validation profile` (`verapdf.mjs`'s `PROFILES`), a run with
    no flavour refused before it starts, and a problem of the run as a
    whole named as the PDF/A-2b run's; samples derived from report-corpus's
    `STARTERS`; five variants and two controls (Decision);
    `identificationProblems` holding each sample's and variant's XMP to
    part 2 and B, once each, before any Java runs; and pdf-corpus.mjs's
    `embeddingProblems` holding that a 2b embeds nothing. Held by
    `scripts/e-invoice/pdfa-2b.test.mjs`, `verapdf.test.mjs`,
    `registers.test.mjs`, `corpus.test.mjs`, `pdf-corpus.test.mjs` and
    `record.test.mjs`, and by the release report's `report.test.mjs` and
    `render.test.mjs`, which judge the format by its tool and fail a run
    with no 2b sample or no 2b control veraPDF refuses: 71 cases failed
    before the code, and the two added in answer to its review before
    theirs. With `pdfa` dropped from the gate's 2b draws, the live
    gate's corpus check stopped the run naming all six samples, "has no
    XMP to say which PDF/A it is", and the plain control, "is the sample
    it is made from, unbroken"; with that stop lifted for one run,
    veraPDF's 2b judge named all six, not compliant for 6.2.4.3-2 and
    6.6.2.1-1.
  - **What veraPDF said, locally.** On 11 November 2026, veraPDF 1.30.3,
    fetched by the register's SHA-256, ran on Zulu 22.0.1 on an Apple M2
    under macOS, not the register's Temurin 17: evidence, not the gate.
    It reported `PDF/A-2b validation profile` for every job of the 2b
    run; the six starters' 2b and the five variants complied, 144 rules
    each; `pdfa-2b-control-plain.pdf` failed 6.2.4.3-2 and 6.6.2.1-1, and
    `pdfa-2b-control-3b.pdf` 6.6.4-2 and 6.8-5. Run without `--flavour`,
    or with `--flavour 0`, the same veraPDF validated the 3b control
    against its PDF/A-3b profile and found it compliant. CI's run on
    Temurin 17 is the gate, and had not run on this branch when this was
    written.
  - **Each rule reverted alone, once all of it was in.** On 11 November
    2026, with this record's code whole, each rule below was reverted on
    its own, the test named run and seen to fail, and the file written
    back from its committed blob, its SHA-256 checked against it. No
    reversion passed. One failed the gate for a reason that was not its
    own, and gained a test first, as its entry says:
    - `checkPdfA` reading no `pdfa`: `pdfa-check.test.ts`, 10 of its 19
      cases, the definition "expected … to match object { version: '1.7',
      subset: 'PDF/A-2b' }", and the Factur-X, the copy, both previews and
      the five titles each drawn, "expected Uint8Array … to be an
      instance of RenderRefusal".
    - The Factur-X's refusal taken out: its case alone, the Factur-X drawn
      as its PDF/A-3b where a refusal was asked for.
    - The XRechnung copy's refusal taken out: its case alone, the copy
      drawn.
    - The preview's label not read: both preview cases, each drawn.
    - The title checked in a PDF/A-3b alone: the five title cases, each
      drawn.
    - The CMYK JPEG refused in a PDF/A-3b alone (`check.ts`):
      `assets.test.ts`'s two PDF/A-2b cases, body and page header,
      "promise resolved … instead of rejecting".
    - An SVG checked in a PDF/A-3b alone (`check.ts`): 13 of
      `svg-pdfa.test.ts`'s PDF/A-2b cases, every one refused for its range
      or its nesting, the messages' case and `SVG_BOUND`'s, "expected
      undefined to be an instance of RenderRefusal".
    - `PDF_A_2B` without its version: `pdfa-2b.test.ts`, every starter's
      PDF "expected '1.3' to be '1.7'" and every starter's pages case,
      its definitions "[ undefined, 'PDF/A-2b' ]", and
      `pdfa-check.test.ts`'s definition case.
    - The PDF/A-3b's hook run on a PDF/A-2b with a stand-in Factur-X file
      (`render.ts`): `pdfa-2b.test.ts`'s six "embeds no file" cases,
      "expected [ Array(2) ] to deeply equal [ [], [] ]".
    - The `RangeError` taken out (`render.ts`): the seven values' cases,
      each drawn as a plain PDF, "expected Uint8Array … to be an instance
      of RangeError".
    - report-corpus's `catalogKeys` answering `[]`: `objects.test.ts`'s
      two catalog cases, PDFKit's and pdf-lib's with an `/OpenAction`.
      `pdfa-2b.test.ts`, which reads that no `OpenAction` is there, could
      not see it, which is why the reader is held on a PDF that has one.
    - The gate's PDF/A-2b run made with `--flavour 3b` (`e-invoice.mjs`):
      the live gate on Zulu 22.0.1, every 2b file "validated against
      PDF/A-3b validation profile, not the PDF/A-2b validation profile",
      each sample and variant refused for 6.6.4-2, and the 3b control
      accepted, "nothing is watching that".
    - The gate's PDF/A-2b run made with no flavour: at the call, the live
      gate stopped, "veraPDF is run with the flavour undefined, where the
      gate holds a profile for 3b and 2b"; in `veraPdfArguments`, with
      `--flavour` left off for a 2b alone, `verapdf.test.mjs`'s flavour
      case, "expected [ [ '--flavour', '3b' ], [] ]", and the live gate,
      veraPDF left to detect: the samples and variants passed as the 2b
      they say they are, the plain control was judged "against PDF/A-1b
      validation profile", and the 3b control "against PDF/A-3b validation
      profile" and accepted, "nothing is watching that".
    - `identificationProblems` answering `[]`: `pdfa-2b.test.mjs`'s XMP
      case, "expected [] to deeply equal [ …(8) ]". The live gate would
      not see it on a corpus drawn right, and needs not: the test is the
      rule's.
    - Mustang given the PDF/A-2b: in `JUDGES`, `registers.test.mjs`'s two
      judges cases, and the live gate stopped before any Java ran, "the
      corpus has no pdfa-2b control mustang must refuse". Handed it at the
      call, past `judgedBy`, the live gate stopped on a `TypeError` in
      Mustang's judge, which read an expectation the 2b has none of: a
      failure, but not the rule's. So `mustang.test.mjs` gained a case
      first, a PDF/A-2b handed to `judgeMustang` with Mustang's recorded
      report on the plain control, which failed on that `TypeError`; then
      the judge names such a file and reads nothing it said, and the
      reversion, made again, had the live gate name each 2b file,
      "Mustang was handed pdfa-2b-quotation.pdf, a file of the format
      pdfa-2b, which JUDGES gives it none of".
    - `JUDGES['pdfa-2b']` taken out: `registers.test.mjs`'s two judges
      cases, `pdfa-2b.test.mjs` at its import, and the release report's
      `report.test.mjs` and `render.test.mjs`, its green run then failing
      "the e-invoice gate recorded pdfa-2b-quotation.pdf as pdfa-2b, a
      format none of its tools judges", and the control's alike.
    - The install consumer's `pdfa` left out of `pdfa.ts`: the install
      gate, "the quotation was not drawn as a PDF/A-2b; it lacks PDF 1.7;
      PDF/A-2b in the XMP; the reviewed sRGB2014 output intent".
  - **Red until the record is retaken.** `scripts/e-invoice/recorded/` is
    retaken by the gate's `--record` on a passing run, never by hand, and
    the record is the rightsholder's to make, on the machine and the Java
    he chooses: until it is, `verapdf.test.mjs`'s "passes the recorded
    PDF/A-2b run" fails in `pnpm test:repo`, and CI's `e-invoice` job
    fails on the PDF/A-2b files the record does not name.
  - **Not held by anything here.**
    - The limits of ISO 32000-1 that PDF/A-2 makes rules of, a string's or
      a name's length among them. The renderer does not check them;
      report-spec bounds a report's title to `MAX_LABEL_LENGTH`, and a
      document a host builds otherwise is judged by nothing but the
      corpus the gate draws.
    - An unlabelled preview drawn as a PDF/A-2b being its final render's
      document: shown for the quotation alone.
    - A customer's template: the gate judges the starters, three variant
      pages on the quotation's and two of the corpus's fixtures.
    - The browser entry's PDF/A-2b in a browser: `browser.test.ts` runs
      pdfmake's browser build in Node.
    - ISO 19005-2's own text, which was not read: veraPDF's PDF/A-2b
      profile is what the gate holds a PDF to.

## Context

Switzerland's electronic patient record stores a PDF only as PDF/A-1 or
PDF/A-2. EPDV-EDI Anhang 2, *Technische und organisatorische
Zertifizierungsvoraussetzungen*, Ausgabe 8 of 30 April 2025, in force
since 1 June 2025, requires in Ziffer 2.4 lit. d that a document
repository store "Dateien im Dateiformat «Portable Document Format» (PDF)
nur in der Ausprägung PDF/A-1 oder PDF/A-2", and in lit. e that such a
file contain or load no executable code
([fedlex](https://www.fedlex.admin.ch/filestore/fedlex.data.admin.ch/eli/oce/2025/56/de/pdf-a/fedlex-data-admin-ch-eli-oce-2025-56-de-pdf-a.pdf),
read on 4 November 2026). It names no conformance level, a, b or u, and
admits neither PDF/A-3 nor PDF/A-4; eHealth Suisse's guide to converting
PDFs for the record (V1, 30 January 2019) cites the same rule. No 2026
edition of Anhang 2 was found that day: eHealth Suisse's test platform
listed provisional 1 June 2026 texts for other annexes and none for it.

Formancy Health refuses every PDF/A level until a gate proves a producer
of one, and so builds no document for the patient record
([formancy.ai-health 0008](https://github.com/sharkysan/formancy.ai-health/blob/main/docs/decisions/0008-a-document-is-a-bundle-of-what-it-refers-to-and-a-pdf-its-own-bytes-never-an-unproved-pdf-a.md)).
That document waits for a Report release that draws a PDF/A the record
admits.

[0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)
draws a Factur-X invoice as a PDF/A-3b and no other report as a PDF/A. It
weighed PDF/A for every report and rejected it for what it costs a report
that gains nothing: a CMYK logo and a title holding `&`, `<` or `>`
refused, every render reading PDFKit's profile from disk, and the profile
in every PDF. And part 3 is a part the record does not store.

What the engines give, read in PDFKit 0.19.1's `js/pdfkit.js`:
- **PDF/A-2b is one option away.** `initSubset` takes `PDF/A-1`,
  `-1a`, `-1b`, `-2`, `-2a`, `-2b`, `-3`, `-3a` and `-3b`, and no level u
  (5318-5331); `initPDFA` writes, for part 2 as for part 3, the pdfaid
  identification, the sRGB output intent with the ICC profile it reads
  with `fs` (5265), and the XMP. Without version 1.7 it writes a PDF 1.3
  with no XMP, and says nothing (`pdfmake.test.ts` pins it). For part 1
  alone it writes a CIDSet of each font's glyphs (2691).
- **Part 1 may not be in reach.** It is said to forbid transparency, and
  the renderer draws an RGBA PNG logo with a soft mask; ISO 19005-1 was
  not read, so that is a question, not a fact. veraPDF's PDF/A-3b
  profile already accepts that transparency beside the output intent, in
  the e-invoice gate's variants.
- **Level a needs a structure tree**, which pdfmake does not build.

What decides a preview: the renderer has no mode. A `ResolvedDocument`
carries none; the runtime's manifest says `preview`, and the manifest is
the host's. What the document does carry is the runtime's own label,
`PREVIEW_LABEL` or `E_INVOICE_PREVIEW_LABEL`, heading every page of a
preview that lacks data or is of an e-invoice, as `XRECHNUNG_COPY_LABEL`
heads an XRechnung's copy, which 0038's `checkCopyLabel` reads.

What judges such a PDF: veraPDF judges by the flavour it is given, and
without one by what the file's metadata says it is
([docs.verapdf.org](https://docs.verapdf.org/cli/validation/)), so a gate
that let it detect the flavour would accept a PDF/A-3b as a PDF/A-3b. The
e-invoice gate pins veraPDF 1.30.3 by its SHA-256, with a floor and a
licence admitted for its runs (0031).

## Decision

**A host asks for a PDF/A-2b; the renderer decides once what a document
is drawn as.** `RenderOptions` (`report-render-pdf/src/options.ts`) gains
`pdfa?: '2b'`, its one value, and nothing else public. Any other value is
the caller's error, as a wrong `maxPages` is: `renderPdf` throws
`RangeError("pdfa must be '2b' or left out; it is <value>")` before it
reads anything. `checkPdfA` (`pdfa-check.ts`) decides, and `Checked.pdfa`
carries the answer to the three that read it: the definition, through
`pdfaOptions`; the final pass's hook, which only a PDF/A-3b has; and the
image checks.

| The document | Without `pdfa` | With `pdfa: '2b'` |
|---|---|---|
| A Factur-X e-invoice | a PDF/A-3b that embeds its XML (0031) | refused, `unsupported`, naming `eInvoice` |
| An XRechnung's copy | its plain copy, its label checked (0038) | refused, `unsupported`, naming `eInvoice` |
| An e-invoice of a kind the renderer does not know | refused | refused alike: `checkEInvoice` runs first |
| A page header that opens with a paragraph of one run, the runtime's `PREVIEW_LABEL` or `E_INVOICE_PREVIEW_LABEL` | a plain PDF | refused, `unsupported`, naming `pageHeader` |
| Anything else | a plain PDF | a PDF/A-2b: version 1.7, subset `PDF/A-2b`, no hook, nothing embedded |

Each refusal says to render the document without `pdfa`. A Factur-X is
the one PDF that may embed its XML, and a PDF/A-2b may embed no such file;
an XRechnung's PDF is the copy of the invoice a host sends, and never an
archival PDF; and a preview says on every page it is not the report, so a
PDF/A-2b of it would be kept as the report.

**What a PDF/A-3b refuses, a PDF/A-2b refuses** -- 0031's two and 0030's
bound, held for any PDF/A, each naming what it refuses and the PDF/A-2b,
never quoting a value; the PDF/A-3b's messages stay byte for byte:
- **a title PDFKit cannot write into the XMP**, holding `&`, `<`, `>` or
  a character XML 1.0 cannot write, naming `info.title`
  (`checkPdfATitle`, moved from `e-invoice.ts`);
- **a CMYK JPEG**, naming the image (`refuseCmyk`): its output intent is
  sRGB, beside which no image may be CMYK;
- **an SVG whose numbers could pass 2,147,483,647, or whose drawing
  nests deeper than 28 graphics states**, naming the image and saying
  what to do (`checkSvgInPdfA`, `svg-pdfa.ts`): 0030's bound, 6.1.13 as
  veraPDF holds it, the same for part 2 as for part 3.

**What holds by construction, and is shown on the PDF.** pdfmake embeds a
subset of every face it draws -- Roboto, Liberation Sans, a host's -- and
the renderer refuses a character a face lacks and a host's face whose
fsType forbids a subset (0040). The transparency an RGBA PNG's soft mask
or an SVG's group makes stands beside the output intent PDFKit writes, one,
its profile the reviewed sRGB2014, which veraPDF's PDF/A-2b profile
accepted in the gate's variants. The XMP says part 2 and
level B, from the subset at version 1.7. Nothing is embedded: a PDF/A-2b
has no hook, and a Factur-X is refused. No password reaches pdfmake, so
nothing is encrypted. Neither pdfmake nor the renderer writes JavaScript,
an action, a form or an annotation; an SVG's `<a>`, which the converter
would write as a link, never reaches it (0030). A QR-bill's slip and an
EPC QR code's caption are vectors and an embedded Liberation Sans. The
limits of ISO 32000-1 that part 2 makes rules of, a string's or a name's
length, are not held by the renderer (**Verified by**).

**A preview is read by its label.** The renderer reads the runtime's
words, as it reads the copy's: a page header whose first block is a
paragraph of one run whose text is `PREVIEW_LABEL` or
`E_INVOICE_PREVIEW_LABEL`, in any style, is a preview, and refused as a
PDF/A-2b. A preview of a report that is no e-invoice and lacks nothing
carries no label; it is the same document as its final render, and is
drawn as one. The runtime does not change, and the Studio offers no
PDF/A-2b.

**The e-invoice gate judges every starter as a PDF/A-2b** (0031's gate,
extended). It keeps its PDF/A-3b corpus, and gains a format, `pdfa-2b`,
which veraPDF alone judges, in a second run of its own with
`--flavour 2b`, each result held to the 2b profile: Mustang validates an
e-invoice, and a PDF/A-2b embeds none. The corpus is derived, not listed:
- **the samples**, one of each starter whose report holds no e-invoice,
  `pdfa-2b-<id>.pdf`, drawn by the renderer as built;
- **five variants**: `pdfa-2b-blocks.pdf`, `pdfa-2b-svg.pdf` and
  `pdfa-2b-svg-bound.pdf`, drawn on the quotation's page as the 3b's are
  on the e-invoice sample's -- every kind of image PDFKit embeds but
  CMYK, with an RGBA PNG in each page header; an SVG in every way the
  converter paints one, transparency among them; `SVG_BOUND` at its
  bound -- and `pdfa-2b-fonts.pdf` and `pdfa-2b-host-fonts.pdf`, the
  corpus's fonts fixtures;
- **two controls**: `pdfa-2b-control-plain.pdf`, the quotation drawn
  without `pdfa`, and `pdfa-2b-control-3b.pdf`, the 3b corpus's
  `e-invoice.pdf` unchanged, which shows that the flavour is named and
  never detected.

The gate reads each sample's and variant's XMP itself, by its part and
level, a second reader beside veraPDF's 6.6.4-2, before any Java runs, so
that a PDF drawn without `pdfa` stops the run named file by file; and it
reads what each embeds, a PDF/A-2b nothing.

## Consequences

**What it buys.**
- **A PDF of a part the patient record stores, from any report that is
  no e-invoice.** A host that asks for `pdfa: '2b'` gets a PDF/A-2b of its
  final render, which veraPDF's PDF/A-2b profile accepted for every
  starter so drawn, and which Formancy Health's document can carry, as
  Health decides (formancy.ai-health 0008). No such PDF has been put to a
  repository of the record.
- **The archive is the PDF the person saw.** Each starter's PDF/A-2b has
  its plain render's pages, run for run, and draws to the same bytes
  every time.
- **Judged, not assumed.** veraPDF's PDF/A-2b profile judges every
  starter so drawn, with a page of every image kind, an SVG at its bound
  and a host's faces, and refuses both controls.
- **Nothing changes for a host that does not ask.** A report drawn
  without `pdfa` is drawn as before: no PDF/A, no profile read, its CMYK
  logo and its title drawn.
- **PDF/A is decided in one place.** The definition, the hook and the
  images read `checkPdfA`'s answer, so a Factur-X cannot reach the 2b's
  options and a 2b cannot reach the 3b's hook.

**What it costs.**
- **Level b, and no other.** A PDF/A-2b has no structure tree, so it is no
  tagged, accessible PDF; a receiver who asks for PDF/A-2a or 2u gets
  level b.
- **Found at the render, not where it is written.** Whether a render is a
  PDF/A-2b is the host's choice at that render, and no report says it.
  So a CMYK JPEG, an SVG whose box carries its numbers past a PDF/A's
  integers or that nests past its graphics states, or a title holding
  `&`, `<` or `>` is found by a render asked for as one, and the builders
  and the validator say nothing beforehand; report-builder-core's README
  says so. A print shop's CMYK logo, a logo shrunk into a small header
  box and a firm called "Müller & Söhne" are each refused as a PDF/A-2b
  and drawn without it.
- **A host that sets `pdfa` on every render meets three refusals.** A
  Factur-X, an XRechnung's copy and a labelled preview are refused as a
  PDF/A-2b, each saying to render it without `pdfa`, so such a host drops
  the option for them.
- **An unlabelled preview is drawn as a PDF/A-2b.** The renderer cannot
  tell it from its final render, and the test shows them the same for the
  quotation alone.
- **The profile on disk, for every PDF/A.** In Node PDFKit reads
  `data/sRGB_IEC61966_2_1.icc` with `fs` from beside its own code, so a
  host that bundles the Node entry ships that file where the bundled
  PDFKit's `__dirname` points, or every PDF/A-2b render fails as every
  e-invoice's does, with the file system's error. Nobody here has bundled
  one. The browser build carries the same bytes.
- **Larger, and slower by nothing a median could tell.** Drawn as a
  PDF/A-2b, the six starters that are no e-invoice were 4,243 to 4,262
  bytes larger than drawn plain: 25,037 to 77,558 bytes against 20,791 to
  73,297, the profile and the XMP. The medians of nine renders, plain
  and PDF/A-2b alternated after one of each, were 39 ms and 39 ms for the
  quotation and 45 ms and 45 ms for grouped-equipment, the longest of the
  starters to render; a second run gave 42 and 40, and 45 and 45. Measured
  on 11 November 2026 from the built packages under Node 22.23.3, on an
  Apple M2 with 8 cores and 16 GB under macOS 26.5.2, on mains power, the
  load average about 6 from other work on the machine.
- **veraPDF judges the corpus, not a customer's template.** The starters,
  three variant pages on the quotation's, the corpus's two fonts fixtures
  and two controls are what it has judged: that shows the renderer draws
  those as PDF/A-2b, not that every template is one. The limits of ISO
  32000-1 that PDF/A-2 makes rules of, a string's length among them, the
  renderer does not check, and only the corpus is judged against them.
- **The e-invoice gate judges PDFs that are no e-invoice**, and its name
  no longer says all it does. Its second veraPDF run took 1.4 to 1.8 s of
  whole runs of 66 to 78 s, three of them, on the same Mac on Zulu 22.0.1
  on 11 November 2026, while other work ran on it, its load not recorded.
- **A starter changed is a record retaken, the PDF/A-2b's as the 3b's.**
  Every PDF/A-2b is recorded by the digest of its objects inflated, so a
  change to what a starter, a fixture or an image kind draws fails the
  e-invoice job until somebody with a Java runs the gate with `--record`.
  This record's own corpus is in that state: its PDFs are not in the
  record yet, so CI's `e-invoice` job and the judges' test of the
  recorded 2b run fail until the rightsholder retakes it on a passing run.
- **Seen on one Java, locally.** The 2b profile's verdicts were read on
  Zulu 22.0.1, not on the register's Temurin 17, which CI runs; the
  PDF/A-3b corpus was seen on Zulu 25 and Temurin 17 before (0031).
- **veraPDF's licence, admitted for the gate as before.** The PDF/A-2b
  run is the same release, 1.30.3, in the same gate, under 0031's
  admission; a new release is a licence to read again.

**What it forecloses.** A PDF/A-2b of an e-invoice, and PDF/A decided a
second time, in a builder, the runtime or a second writer of the PDF.

## Alternatives considered

**PDF/A for every report.** 0031's reasons stand: a 0.1.0 template with a
CMYK logo or a title holding `&` would stop rendering, every render would
read the profile from disk, and every PDF would carry it, where most
reports gain nothing from an archival PDF. An option keeps those costs on
the renders that ask.

**PDF/A-1b.** The record admits it, but whether part 1 forbids the soft
masks an RGBA PNG logo is drawn with is unconfirmed, and PDFKit writes a
CIDSet for part 1 alone, a path nothing here has drawn.

**PDF/A-2a or 2u.** Level a needs a structure tree pdfmake does not build;
PDFKit has no level u.

**PDF/A-3b for any report**, the part the renderer already draws. The
record admits PDF/A-1 and PDF/A-2 alone.

**A mode on `ResolvedDocument`.** It would be a second place a preview is
said, beside the manifest, and a change to the runtime this decision
leaves alone. The labels are the runtime's own words for it, as 0038's
copy label is.

**`subset: 'PDF/A-2b'` as the option.** pdfmake's word, from a type the
renderer's published types do not import, and one more value to refuse.

**Dropping a Factur-X's XML when a PDF/A-2b is asked for.** That would be
a picture of an invoice archived as the invoice, the PDF 0027 refuses.

**A gate of its own.** The e-invoice gate already pins veraPDF, its floor
and its licence, draws the corpus from the built packages, and records a
PDF by its inflated digest.

**Mustang judging the PDF/A-2b too.** It validates an e-invoice, and
would refuse a PDF that carries no XML.
