# 0031 — An e-invoice is drawn as a PDF/A-3b that embeds its XML as `factur-x.xml` and states it in its XMP, through PDFKit's own calls on the final pass and for an e-invoice alone: the ICC profile PDFKit embeds admitted by its digest, the PDF read back by readers that are not PDFKit, and veraPDF and Mustang judging it in the e-invoice gate; PDF/A for every report, pdfmake's `files`, a library that attaches the XML afterwards and a patched PDFKit lost

- **Status:** accepted; numbered 0031 while 0029 and 0030 were held by
  branches not yet merged; extended by
  [0032](0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md),
  under which every e-invoice sample it draws carries the firm's mark, an
  SVG in each PDF/A-3b; and by
  [0033](0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md),
  under which a builder refuses a CMYK JPEG a person adds to a report with
  an e-invoice, the image the final render here refuses; and by
  [0038](0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md),
  under which an e-invoice of the kind `xrechnung` is drawn as no PDF/A
  but as a plain copy labelled so on every page, its XML the invoice a
  host sends: the plain PDF this record forecloses, narrowed for that kind
  alone, a Factur-X invoice drawn as here
- **Date:** 2026-10-18
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The renderer, on the PDF it produced.** report-render-pdf's
    `src/e-invoice.test.ts` resolves each of the corpus's three e-invoice
    samples with the real runtime in a final render, draws it through the
    Node entry, and reads it back with readers that are not the PDFKit
    that wrote it -- PDF.js for the pages and the name tree, pdf-lib for
    the objects, saxes for the XMP
    ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)):
    - one file, `factur-x.xml`, its bytes the runtime's XML as UTF-8 byte
      for byte and the same from both readers, `text/xml`, related as
      `Alternative`, on the catalog's `/AF` and in the `/EmbeddedFiles`
      name tree, dated with the document's creation date;
    - a well-formed XMP stating PDF/A-3b, the four fx properties with
      their namespace and prefix, and one extension schema declaring them,
      compared with literals written in the test from the transcription
      [S] as this record's Context gives them, and says so: never with
      report-spec's `FACTUR_X`, so that a constant changed there fails
      here;
    - the title in the information dictionary and in `dc:title`; one sRGB
      output intent whose profile is the reviewed sRGB2014, byte for byte;
      a PDF 1.7 with no `/Encrypt`; and the same pages as the document
      drawn plain;
    - and a preview, a plain PDF that embeds nothing and is labelled on
      every page.
  - **What the renderer refuses, and what it pins of PDFKit.**
    `src/refusals.test.ts`: an e-invoice the renderer knows drawn in both
    entries; one it does not know refused as before
    ([0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md));
    XML holding a lone surrogate refused; and a title holding `&`, `<`,
    `>` or a character XML 1.0 cannot write refused in an e-invoice,
    naming `info.title`, and drawn in a report that is none.
    `src/assets.test.ts`: a CMYK JPEG refused in an e-invoice, naming the
    image, in the body and in a page region -- an asset's and a field's
    image are one image block to the renderer -- and drawn in a report
    that is none; an image of each of report-corpus's `IMAGE_KINDS`, every
    other way PDFKit embeds one, drawn in an e-invoice; and, in every
    report, a JPEG PDFKit would read otherwise than the check refused as
    `invalid-asset` -- a JPG or a DAC segment before its frame header, two
    frame headers in either order of three and four components, a frame
    of two components -- and a DAC segment after the frame header drawn.
    `src/pdfmake.test.ts` pins what PDFKit 0.19.1 does that this record
    builds on or leaves as it is: no XMP without version 1.7; the
    `/AFRelationship` it is given, which its types leave out, and
    `Unspecified` without one; the title written into the XMP unescaped;
    `/CheckSum` in 32 hexadecimal digits; one `/ID` for two PDFs of one
    title and creation date; and a render that reads, for an e-invoice
    alone, PDFKit's ICC profile beside the fonts and no other file.
    `src/browser.test.ts`: the browser entry hands pdfmake the definitions
    the Node entry does for an e-invoice, embeds the same XML beside the
    same reviewed profile, which pdfmake's browser build carries as
    base64, and draws every object the Node entry draws, each stream
    inflated (report-corpus's `inflatedDigest`), though not the same bytes:
    the build deflates with a zlib of its own, 37,307 bytes of the first
    sample where Node's were 37,578 on 18 October 2026. It draws an
    e-invoice to the same bytes twice, as `src/corpus.test.ts` holds the
    Node entry to.
  - **The page against its XML, on the PDF.**
    `src/e-invoice-samples.test.ts`, for each sample: the XML read out of
    the PDF is the runtime's, byte for byte, and its line, breakdown and
    total amounts are what BigInt computes from the sample's data; every
    run PDF.js reads, by where it stands -- the firm's line, the buyer,
    the number and the dates, every line of the table cell by cell, every
    row under it, the terms and the bank details -- is the XML's value as
    Intl formats it for de-DE, no run is left over but the template's own
    two phrases, and the EPC QR code ZXing decodes asks for what the XML
    says is due. Two controls built in the test are each found at exactly
    the place it differs: a template that prints a total of its own,
    rounded half to even at each rate, which prints 871,62 € where the XML
    holds 871.63 (7 % of 107.50 is 7.525), and one whose e-invoice names
    the article column as the item's name, at each of seven lines.
  - **The readers.** report-corpus's `src/objects.test.ts` holds
    `readPdfObjects`, with pdf-lib, on PDFs PDFKit writes in the test with
    a file and without: the file's keys, its bytes the same as PDF.js reads
    them, a file on `/AF` that the name tree does not name, the profile
    byte for byte PDFKit's own file, the information dictionary and `/ID`
    against PDF.js's fingerprints, and a key of the wrong type, an
    encrypted PDF, a name tree with `/Kids`, an XMP packet that is not
    UTF-8 and an object pdf-lib cannot parse refused; and `inflatedDigest`
    the same for a stream deflated otherwise, another for another stream,
    dictionary or version, a JPEG's stream read as it is. `src/xmp.test.ts`
    holds `readXmp`: a property found by its namespace whatever its
    prefix, an unbound prefix and a title holding `&` and `<` refused.
    `src/read-pdf.test.ts` holds the attachments PDF.js reads, and
    `src/image-kinds.test.ts` each of `IMAGE_KINDS` to the way PDFKit
    embeds it, read from the objects PDFKit wrote, each unlike the others.
  - **The profile's licence.** `scripts/dependency-licences.mjs`'s
    `ICC_PROFILES`, through `scripts/dependency-licences.test.mjs` in
    `pnpm test:repo` and as a step of `verify`: a profile nobody reviewed
    refused, naming it and its digest, and so is one a byte off; a profile
    found by `.icc` or `.icm` and by the `acsp` of its header whatever it
    is called; a review nothing installs, or one without its licence
    sentence, refused; a workspace package's profiles judged; PDFKit's
    read as the reviewed sRGB2014, and refused without the review. On the
    real tree, with the digest changed, the command exited 1 naming
    `pdfkit@0.19.1/js/data/sRGB_IEC61966_2_1.icc`.
  - **The gate, on PDFs** (`scripts/e-invoice.mjs`, the `e-invoice` job).
    It fetches veraPDF 1.30.3 from Maven Central beside Mustang and KoSIT,
    refused unless its SHA-256 is the one
    `docs/release/e-invoice-tools.json` registers, and refuses to run a
    veraPDF older than 1.30.2, its own or the one inside Mustang. It draws
    each sample's PDF from the very document whose XML the XML corpus
    holds; variants that carry the first sample's e-invoice on other pages
    (below); and controls (below). veraPDF judges every PDF in
    one run, against its PDF/A-3B profile with its embedded-file feature
    report, and Mustang judges each PDF in its PDF part and its XML part,
    never by its exit status alone; pdf-lib counts each PDF's embedded
    files and compares their bytes with the XML the corpus says it embeds,
    and the gate holds what each sample's and variant's XMP states, its
    `fx:DocumentFileName` and its `fx:ConformanceLevel`, to the file and to
    the level report-spec's `FACTUR_X_PROFILES` gives the guideline of the
    XML it embeds. A run fails on any file a tool judges otherwise than the
    corpus expects. `scripts/e-invoice/verapdf.test.mjs` and
    `pdf-corpus.test.mjs`, and the register's, Mustang's, the corpus's and
    the record's tests, hold each module, the judges over the run recorded
    in `scripts/e-invoice/recorded/`; the release report judges each format
    by the tools that judge it (`JUDGES`), shows a veraPDF column, and
    fails a run without a sample and a control of each format, or with a
    veraPDF below the floor, its own or Mustang's
    (`scripts/release-report/report.test.mjs`, `render.test.mjs`). With
    its variants and seven controls it passed on 18 October 2026, on
    Windows, on Zulu 25.0.4.1 under Node 24.21.0, which recorded it, and
    on Temurin 17.0.20.1 under Node 22.23.3, whose PDFs had the recorded
    digests; it has not run in CI.
  - **The install gate** (`pnpm test:e2e:install`). Its Node consumer,
    `scripts/install-fixture/consume.ts`, draws an e-invoice of its own
    from the packed tarballs and reads the PDF's bytes with
    `scripts/install-fixture/embedding.ts`, which needs nothing but Node:
    a PDF 1.7; one associated file, related as the document says, named
    `FACTUR_X.fileName` as `/F` and `/UF` and in the name tree, which names
    nothing else; its bytes the runtime's XML, as `FACTUR_X.mediaType`; an
    XMP of part 3 and conformance B with the fx namespace, file name and
    conformance level `FACTUR_X` gives; and the reviewed sRGB2014 as its
    output profile, at the PDFKit a clean npm install resolves. Its
    preview embeds nothing.
  - **Each rule reverted on its own, on 18 October 2026**, each failing a
    test or the gate it names, and every file restored and checked by
    SHA-256 afterwards:
    - the readers', 21, two of which survived the first pass -- every
      named file happened to stand first on `/AF`, and a test matched the
      words of another refusal -- and fail since their tests were made
      tighter;
    - the renderer's and the licence guard's, 40, two of them controls
      that must pass. One survives: the encoder's buffer embedded whole
      rather than copied to its exact length, which no test can tell
      apart, since V8's `TextEncoder` returns a buffer of exactly its
      bytes, so that guard holds by construction alone. A second extension
      schema survived until the test held the XMP to exactly one;
    - the page against its XML, 14, each failing, the runtime's mutated in
      its source and its `dist` built again;
    - the gate's, 30: 24 over its modules, each failing a named test, and
      6 on the live gate, each making it exit 1 -- veraPDF of another hash
      refused at its download; Mustang's PDF part ignored, which the
      #1293 control then passes; no embedding, and no PDF/A, each leaving
      a control nothing to change; `/AFRelationship /Data`, which veraPDF's
      feature report alone refuses; and the embedded bytes altered, which
      pdf-lib refuses;
    - the install gate's: the hook removed from the built renderer, which
      failed the real gate after 87 s, and 14 more in a Node host built
      from the kept tarballs, each failing the check it aims at;
    - and once every part had landed, on the branch as a whole, 20 more,
      each failing its tests: the renderer's hook not handed on, the
      PDF/A-3b options left out, a CMYK JPEG, a title and a lone surrogate
      each let through, the file related as `Data`, and the fx properties
      written in another namespace; the readers' streams read without
      inflating them, and the XMP parsed without its namespaces; an
      unreviewed profile let through by the licence guard; veraPDF's
      embedded file left uncompared, Mustang's PDF part left unread,
      veraPDF's licence admitted at any version and its floor not held,
      and PDFs judged by no tool in the release report; the hook removed
      from the packed renderer, failing the install gate's consumer in a
      Node host built from the tarballs; and in the documents, this
      record without its register entry, changed since it was read,
      linked from no section of the architecture, and a line of its
      register held by a test that is not there. Every file the round
      touched, the documents among them, was byte-identical afterwards,
      by SHA-256;
    - and in answer to the branch's review, 33 more, each failing its
      test, and six new cases watched failing before their code: the
      renderer's JPEG frame read where PDFKit reads it, its five rules
      each reverted, the five refusals failing before them, and the lone
      low surrogate let through; the readers' strict UTF-8, their refusal
      of an object pdf-lib cannot parse, and the version left out of the
      digest, which threw on a JPEG before it read one as it is; the
      licence guard finding a profile by its name alone; the gate's 17 --
      the XMP left unread or read on a control too, the file name, the
      level, `/F`, `/UF` and the place on `/AF` each unchecked, two
      levels taken for one, a PDF with no XMP or one that cannot be read
      let through, a guideline no profile names let through, a variant
      drawn as the sample, a
      starter no variant draws, the logo and the page break left out of
      `variant-blocks.pdf`, and the size control patching the trailer's
      `/Size` or wrapping its digit wrong; veraPDF's run passed with an
      encrypted job or one out of memory, and a run of controls broken in
      their embedded file alone expected to exit 1; the release report
      holding no floor and showing a variant as a sample; and the
      limitation's size one byte off. Each file was byte-identical
      afterwards, by SHA-256.
  - **Not held by anything here.**
    - The values marked [S]: the fx namespace, its prefix, the four
      properties and the extension schema's name. No tool in the gate
      reads the namespace -- Mustang reads the four properties by their
      local names, and veraPDF holds the schema to its form -- and the
      test compares them with the transcription's values, not with the
      official ZUGFeRD package's XMP example, which waits for the
      rightsholder's registration with FeRD. The transcription gives the
      namespace two ways (Context), and nothing here can say which the
      specification means.
    - That a customer's e-invoice states the conformance level of its
      XML: Mustang compares it with a fixed list, and veraPDF reads no fx
      value; the gate's own reading holds it for every PDF the gate draws,
      and `e-invoice.test.ts` holds the XMP's level to EN 16931, the
      samples' profile.
    - The browser entry's PDF/A in a browser: `browser.test.ts` runs
      pdfmake's browser build in Node.
    - The same bytes from another zlib, and anything on Linux: Node 22 and
      24 on Windows drew the same PDFs, and the gate records each PDF by a
      digest of its objects inflated, so that another zlib cannot fail it.
    - A customer's template, France, and a receiver, an ERP or a platform
      taking the file.

## Context

[0027](0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)
split the e-invoice into two steps, each failing closed. Its own wrote the CII XML into
the resolved document, `document.eInvoice`, and had the renderer refuse
every e-invoice: in a German hybrid invoice the structured part is the
leading one (UStAE 14.4 Abs. 3), so a PDF without it would be a picture of
an invoice handed over as the invoice. This is the second. A Factur-X /
ZUGFeRD PDF is a PDF/A-3 that embeds the CII as `factur-x.xml`, related to
the PDF as its conformance level asks, and says both in its XMP; that part
of the specification was read in a transcription of it, marked [S]
wherever it is used, since the specification sits behind a registration
nobody here has made (0027).

What the engines give, read in their code and measured on 17 October 2026
on pdfmake 0.3.11 and PDFKit 0.19.1, and again on 18 October:
- **PDF/A-3b is in reach, through two options.** pdfmake hands
  `version` and `subset` to PDFKit, which then writes the pdfaid
  identification, an sRGB output intent with its ICC profile, and the XMP.
  Without version 1.7 it writes a PDF 1.3 with no XMP, and says nothing.
  Level a needs a structure tree, which pdfmake does not build, and PDFKit
  has no level u.
- **The XMP has no key in pdfmake, and the file a poor one.** Its `files`
  hands each entry to PDFKit's `file()` whole, the relationship among it --
  `/AFRelationship /Alternative` came through, and a PDF so made passed
  veraPDF 1.28.2 on 17 October 2026 -- though @types/pdfmake 0.3.3
  declares no relationship; but its
  source must be a string, so the XML would go in as a data URL, and an
  entry without one drops every entry after it without a word (pdfmake's
  `js/Printer.js` 230). PDFKit's own document, which pdfmake's
  `getStream()` hands over laid out and not yet ended, takes `file()`, with
  a relationship its types leave out, and `appendXML()`, which the XMP
  needs whatever carries the file.
- **What PDFKit does as it is.** It writes the title into the XMP
  unescaped, so "Müller & Söhne <AG>" fails veraPDF's 6.6.2.1-4, 6.6.2.1-5
  and 6.6.4-1; it draws a four-component JPEG in DeviceCMYK, which fails
  6.2.4.3-3 beside an sRGB output intent, and takes for a JPEG's frame
  header the first segment of fifteen markers that include JPG's and DAC's
  (pdfkit.js 3807, 3822-3843); it writes `/CheckSum` as 32 hexadecimal
  digits where ISO 32000-1 asks for 16 bytes, which veraPDF does not flag;
  it derives the trailer `/ID` from the information dictionary, so two
  documents of one title and one creation date share it, as the corpus's
  three samples do; and its PNG reader, png-js 1.1.0, reads a colour key's
  bytes as its samples (png.js 159-167), a grey key by its high byte and an
  RGB key as twelve numbers where a PDF reader wants six, in every report
  since 0.1.0, measured on 18 October 2026.
- **PDFKit reads a file of its own.** It reads its ICC profile from
  `data/sRGB_IEC61966_2_1.icc` with `fs`, as
  `${__dirname}/data/sRGB_IEC61966_2_1.icc` (pdfkit.js 5265), past
  pdfmake's local access policy, which 0005 made the fonts' alone.
  pdfmake's browser build carries the same 3,024 bytes as base64 inside a
  script.
  The profile is the International Color Consortium's sRGB2014, which "may
  be copied, distributed, embedded, made, used, and sold without
  restriction", and 0006's guard read fonts and no profile.

What judges such a PDF, read and measured on 17 and 18 October 2026:
- **veraPDF**, the PDF Association's validator, at 1.30.3, under
  GPL-3.0-or-later OR MPL-2.0, which the dependency policy refuses for a
  package; its 1.30.1 and earlier carry two XML external entity flaws,
  CVE-2026-54078 and CVE-2026-54079.
- **Mustang 2.26.0**, which judges a PDF with the veraPDF 1.30.2 it
  bundles and the XML inside it, and exits 0 on a PDF whose XML is valid
  whatever its PDF/A says (its issue #1293); it compares neither a file's
  declared `/CheckSum` and `/Size` with its bytes nor its
  `/AFRelationship`, and checks the XMP's `ConformanceLevel` against a
  fixed list, not against the XML's profile.

What the fx namespace is, read in the transcription [S]: its section
6.3.1 gives `urn:factur-x:pdfa:CrossIndustryDocument:invoice:1p0#`, and the
text of its rule BR-HYBRID-04 `urn:factur-x:pdfa:CrossIndustryDocument:1p0#`,
without `:invoice`. The transcription calls that an inconsistency and
treats section 6.3.1 as authoritative; akretion's generator and the PDFlib
sample it ships write section 6.3.1's form, and Order-X uses the other.

## Decision

**An e-invoice is drawn as a PDF/A-3b that embeds its XML, and no other
report is a PDF/A.** A document whose `eInvoice` the renderer knows is
drawn with `version: '1.7'` and `subset: 'PDF/A-3b'` (`pdfa.ts`'s
`PDF_A_3B`), and every other report is drawn as it was.

**One hook, on the final pass.** `Engine.run(definition, finish?)`: both
entries call `finish` with PDFKit's document between `getStream()` and
reading its stream, and `render.ts` passes it on the final pass alone, the
measuring passes throwing before they end. The file and the XMP move no
line: the pages are the pages the document draws plain.

**The file is the runtime's XML, changed in nothing** (`embedEInvoice`).
PDFKit's `file()` is handed the XML's UTF-8 bytes as an ArrayBuffer of
exactly their length -- a typed array that is not a Node `Buffer` falls
through to `fs.readFileSync(src)`, and an encoder's view may sit in a
larger buffer -- under report-spec's name, `factur-x.xml`, as `text/xml`,
related as the document says, `Alternative` for EN 16931 [S], with a
description in the renderer's own words, and with the document's creation
date as both of its dates, so that one document draws to the same bytes
every time.

**The XMP says what the file is.** The renderer appends an fx description
-- `DocumentFileName`, `DocumentType`, `Version` and `ConformanceLevel`, in
report-spec's namespace and prefix [S] -- and one extension schema that
declares the four as external Text, as PDF/A asks of a property outside
its own schemas. The schema's name is the transcription's; the four
properties' descriptions are the renderer's own words, and no
specification's.

**What it refuses besides 0027's**, as `unsupported`, before pdfmake sees
the document, never quoting a value:
- **XML holding a lone surrogate**, which an encoder would write as
  U+FFFD without a word, so the PDF would embed other bytes than the
  runtime wrote;
- **a title PDFKit cannot write into the XMP**, holding `&`, `<`, `>` or
  a character XML 1.0 cannot write, naming `info.title`: report-spec
  refuses such a title in an e-invoice report already (0027), so only a
  document made otherwise reaches this;
- **a CMYK JPEG**, naming the image, in an e-invoice alone; and, since
  the CMYK check is only as good as the frame header it reads, the check
  reads the one PDFKit reads and refuses, as `invalid-asset` and in every
  report, a JPEG PDFKit would read otherwise: a JPG or DAC segment before
  the frame header, a second frame header, or a frame of other than 1, 3
  or 4 components, to which PDFKit gives no colour space. Before, a DAC
  segment shaped as a frame of four components had an RGB JPEG pass the
  refusal and be drawn in DeviceCMYK, which veraPDF 1.30.3 failed on
  6.2.4.3-3 (measured on 18 October 2026).

**What PDFKit writes is left as it writes it.** The 32-digit `/CheckSum`
and the shared `/ID` are pinned in `pdfmake.test.ts`, not patched: a
patch would be a copy of upstream
([0002](0002-depend-on-upstream-never-copy-it.md)'s spirit), and filing
them upstream is the rightsholder's call.

**A render of an e-invoice reads one file besides its fonts**, PDFKit's
ICC profile ([0005](0005-pdfmake-renders-reports-behind-one-adapter.md)'s
fonts from four named files and no other, amended), and **that profile is
a reviewed file**
([0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md),
extended). The guard learns ICC profiles: `ICC_PROFILES` holds each
reviewed one by the SHA-256 of its bytes, with what it is, the licence
sentence a review read and where; a profile is found by `.icc` or `.icm`,
or by `acsp` at byte 36 of its header whatever it is called; and one
nobody reviewed, a review nothing installs, and a review without its
sentence are refused. In the production tree it finds PDFKit's alone. The
browser build's copy is inside a script, which the guard does not open,
and `browser.test.ts` holds it to the reviewed digest.

**The PDF is read back by readers that are not PDFKit.** The corpus reads
a PDF's own objects with `@pdfme/pdf-lib` 6.2.4 (`objects.ts`; MIT, its
`LICENSE.md` read), its XMP strictly with saxes (`xmp.ts`), each property
by its namespace with its prefix beside it, and the files its name tree
names with PDF.js (`read-pdf.ts`), so that an embedded file's bytes come
from two readers. pdf-lib moved from the corpus's devDependencies into its
`dependencies`, beside `pdfjs-dist`, since its source imports it and the
e-invoice gate runs that source, built, to read each PDF; the corpus is
private and never published, so 0006's guard does not walk it.
`XMP_NAMESPACES` says where each namespace it reads is from, as `pdfa.ts`
says of the three it writes: `x` and `rdf` the packet's own, `xml` the one
Namespaces in XML binds, `pdfaExtension` as veraPDF's rule 6.6.2.3.3-1
names it, `pdfaSchema` and `pdfaProperty` as akretion's factur-x and
PDFlib's sample extension schema write them [S], and `pdfaid`, `dc`, `xmp`
and `pdf` as PDFKit writes them; veraPDF 1.30.3 passed all of them. The
corpus's `inflatedDigest` hashes a PDF's objects with every stream
inflated, so that two PDFs one document's zlibs deflated otherwise hash
alike, and `IMAGE_KINDS` makes in code an image of each kind PDFKit
embeds in a way of its own.

**The e-invoice gate judges the PDF** (0027's gate, extended). veraPDF
1.30.3 is pinned in `docs/release/e-invoice-tools.json` by its Maven
Central address, its SHA-256 and its size, with a floor of 1.30.2 for its
own pin and for the copy inside Mustang, which the gate reads from
Mustang's JAR. Its licence is admitted for the gate's runs in CI at
1.30.3 alone (`scripts/e-invoice/registers.mjs`'s `ADMITTED_LICENCES`),
as [formancy.ai-health 0009](https://github.com/sharkysan/formancy.ai-health/blob/main/docs/decisions/0009-a-ch-orf-document-is-the-hosts-referral-in-ch-core-and-ch-orf-the-questionnaire-by-canonical-and-swiss-identifiers-checked-here.md)
admits a licence for the one package its validator gate needs: the gate
downloads it and runs it as a program of its own, and no package carries
it. veraPDF and Mustang judge each sample's PDF/A-3b, which both must
accept; variants, which both must accept as they accept a sample,
each the first sample's e-invoice drawn on another page --
`variant-blocks.pdf`, the sample's page, a page break and an image of each
of `IMAGE_KINDS`, a QR code, a rectangle and a rule, with an RGBA PNG in
the page header of each page as a logo stands; `variant-fonts.pdf`, the
corpus's fonts fixture; and one of each starter, resolved as a host
resolves it, with its photo, its page regions, its groups over two pages,
its Swiss QR-bill or its EPC QR code -- so that what a validator judges is
not one template's one page; a starter without a variant stops the gate
(`variantProblems`); and controls, each broken one named way and made by
the gate, never through an option of a published package:

| Control | Made by | veraPDF | Mustang 2.26.0 |
|---|---|---|---|
| `control-plain.pdf` | the sample drawn without its e-invoice | refuses it, 6.2.4.3-2 and 6.6.2.1-1 | refuses it, finding no XMP and no XML; it falls back to PDF/A-1b and fails seven of its rules |
| `control-pdfa.pdf` | `/OutputIntents` renamed | refuses it, 6.2.4.3-2 | reports 6.2.4.3-2 and exits 0: the #1293 trap, which the gate reads from its PDF part |
| `control-xmp.pdf` | `fx:ConformanceLevel` written `EN-16931` | accepts it: it reads no fx value | refuses it, error 12 |
| `control-checksum.pdf` | `/CheckSum` one digit off | reports the checksum as declared, which the gate holds to the XML | accepts it |
| `control-size.pdf` | the file's `/Size` one byte off | reports the size as declared, which the gate holds to the XML | accepts it |
| `control-relationship.pdf` | `/AFRelationship` written `/Unspecified` | reports the relationship, which the gate holds to the profile's | accepts it |
| `control-xml.pdf` | the BR-CO-14 control's XML embedded | accepts it | refuses it, BR-CO-14 |

veraPDF's feature report copies an embedded file's `/CheckSum` and `/Size`
as the PDF declares them, and keeps only the last of several files, so
pdf-lib counts the files and compares their bytes. Neither tool holds the
XMP's conformance level to the XML's, so the gate does, for each sample's
and variant's PDF; a control's XMP is broken on purpose, and is not held.
A recorded PDF is held by a digest of its objects with every stream
inflated, not by its bytes, which depend on the zlib that deflated them.
The release report judges each format, XML and PDF, by the tools that
judge it, and holds the veraPDF floor itself, its own release and every
one Mustang bundles as the gate recorded them.

**The install gate draws one too.** Its Node consumer draws its own
e-invoice from the tarballs and reads the PDF's bytes with Node alone,
since the corpus is never packed: the one place a PDFKit a host's install
resolves within pdfmake's range is seen embedding the file and its
profile.

## Consequences

**What it buys.**
- **An e-invoice is printed.** A final render of a report with an
  e-invoice is the German hybrid invoice: the page, and the XML the page
  was printed from, in one file.
- **The page is held to the XML it embeds.** The samples' every printed
  line and total is compared with the XML read out of their own PDF
  ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)),
  and the XML with a BigInt computation of their data.
- **Two opinions of the PDF, one of them independent.** veraPDF judges
  the PDF/A, and Mustang the hybrid and the XML inside it; Mustang's own
  PDF/A part is the veraPDF 1.30.2 it bundles, so the PDF/A verdict is one
  engine at two releases, and only the hybrid's and the XML's checks are
  a second opinion. The controls show that each sees what it must, and
  the gate reads what Mustang's exit status hides.
- **What a customer's e-invoice may draw is judged, not only the
  samples' page.** Every starter, a page of every image kind PDFKit
  embeds, a QR code, a rectangle, a rule, a page region and a second page
  pass veraPDF and Mustang as an e-invoice.
- **No other report changes.** A report without an e-invoice is drawn as
  before, with no PDF/A, no hook and no profile, and keeps its CMYK logo
  and its title.

**What it costs.**
- **PDF/A-3b, and no other level.** The PDF has no structure tree, so it
  is no tagged, accessible PDF; Factur-X allows any level of part 3 [S],
  and a receiver who asks for level a or u gets level b.
- **Germany only, still.** France is not claimed, as 0027 says:
  `Alternative` is one of the three relationships France allows [S], and
  nothing else of XP Z12-012 was read.
- **The XMP's fx values rest on a transcription.** The namespace, the
  prefix, the four properties and the extension schema's name are the
  transcription's and agree with what Mustang reads; no tool in the gate
  reads the namespace, and the transcription gives it two ways, section
  6.3.1's with `:invoice`, which the renderer writes, and BR-HYBRID-04's
  without; if the specification means the other, every e-invoice carries
  the wrong one and nothing here would see it. The official package's XMP
  example needs a registration with FeRD only the rightsholder can make;
  until it is recorded, the test compares the values with the
  transcription's, and says so.
- **No validator holds the conformance level to the XML.** Mustang 2.26.0
  checks `ConformanceLevel` against a fixed list, so `BASIC WL` over an EN
  16931 XML passes it, and veraPDF reads no fx value. The gate's own
  reading holds it for every PDF the gate draws, and a renderer writes the
  level the document hands it, which `checkEInvoice` holds to
  report-spec's; a receiver who runs either tool alone does not see it.
- **Mustang checks less of a PDF than its verdict suggests.** It compares
  neither the declared `/CheckSum` and `/Size` with the bytes nor the
  `/AFRelationship`, which `control-checksum.pdf`, `control-size.pdf` and
  `control-relationship.pdf` show, and exits 0 on a PDF/A failure where the
  XML is valid; a receiver who runs Mustang alone sees less than this gate
  does.
- **No CMYK JPEG in an e-invoice.** A logo in CMYK, as a print shop may
  deliver one, is refused in an e-invoice's final render, naming the
  image; its preview, which is no PDF/A, draws it, so an author finds out
  only at the final render.
- **A JPEG PDFKit would misread is refused in every report.** One whose
  JPG or DAC segment stands before its frame header -- arithmetic coding
  may write its DAC segment there -- one of two frame headers, and one of
  two components are refused as `invalid-asset`, where 0.1.0 drew them
  wrong: a template with such an image stops rendering.
- **PDFKit's `/CheckSum` and `/ID`, as PDFKit writes them.** A checksum
  of 32 hexadecimal digits where ISO 32000-1 asks for 16 bytes, which
  veraPDF does not flag and a strict reader may; and two e-invoices of
  one title and one creation date share one trailer `/ID`, whatever they
  print, as the corpus's three samples do. A batch that hands many
  invoices one creation date gives them one `/ID`. Keeping them apart
  would mean an information-dictionary key of the renderer's own, the
  XML's digest say, which changes every e-invoice's information
  dictionary; that is the rightsholder's call, and not made here.
- **A PNG's colour key, as PDFKit's PNG reader reads it.** A grey key is
  read by its high byte, so another grey may be drawn transparent, and an
  RGB key is written as twelve numbers where a PDF reader wants six, which
  a reader may ignore, so the colour it keys is drawn; in every report
  since 0.1.0, and veraPDF passes the e-invoice that draws both.
  report-corpus's `image-kinds.test.ts` pins it, and filing it with
  png-js or PDFKit is the rightsholder's call.
- **A file outside pdfmake's policy.** PDFKit reads its profile with `fs`
  from beside its own `js/pdfkit.js`, at `${__dirname}/data/`: a host that
  bundles the Node entry puts `sRGB_IEC61966_2_1.icc` where its bundle's
  `__dirname` points, or every e-invoice render fails. Nobody here bundled
  one. The fonts are no longer the only files a render reads.
- **A profile is known by its digest, not read.** A profile states its
  copyright holder, not its terms, so a review records the licence
  sentence and the digest holds the bytes it read: a PDFKit that ships
  another profile stops the guard until somebody reads it, and a profile
  inside a script, pdfmake's browser copy among them, is not seen.
- **Larger, not measurably slower.** The samples drawn as PDF/A-3b were
  37,578, 36,712 and 37,801 bytes against 29,033, 28,215 and 29,237 drawn
  plain, 8,497 to 8,564 bytes more, of which the XML is 9,157 to 12,668
  bytes before compression; the medians of nine renders of each,
  alternated after one each, were 83 to 91 ms against 81 to 94 ms plain,
  within the noise of a machine that ran other work. Measured on 18
  October 2026 from the built packages, Node 24.21.0, Windows 11, an Intel
  i9-10900K.
- **A larger, slower gate.** Its downloads are 86,368,974 bytes, veraPDF's
  16,057,132 among them. From its cache, with the samples and the controls
  alone, it took 59 and 61 s on Zulu 25, 82 s once beside other work on
  the machine, and 89 s on Temurin 17; with the variants and two more
  controls, 103 s on Zulu 25 and 130 s on Temurin 17, each beside other
  work on the machine, on 18 October 2026 on the same workstation, against
  28 to 40 s for the XML alone the day before. Mustang's twenty-six runs
  are most of it. Its twenty-minute timeout is still a guess until CI's
  first runs are timed.
- **A starter changed is a gate recorded again.** Each variant's PDF is
  recorded by its digest, so a change to what a starter, the fonts
  fixture or an image kind draws fails the e-invoice job until somebody
  with a Java runs the gate with `--record`, as a change to a sample
  already did.
- **veraPDF's licence, admitted for the gate.** GPL-3.0-or-later OR
  MPL-2.0, which the policy refuses for a package, is admitted for the
  gate's runs at 1.30.3 alone; a new release of it is a licence to read
  again. The libraries its JAR is built with were not reviewed one by one,
  as 0027 says of the other tools.
- **Only the samples and their variants, and only on Windows.** A
  customer's template is held by the rules and by the check that each
  total is printed, not by a validator: the variants carry the samples'
  XML on the starters' pages and on a page of every image kind, which
  shows that what the renderer draws there is a PDF/A-3b, not that a
  customer's page is. The PDFs' digests on Linux, and the `ERROR` lines Mustang may
  log there, have not been seen; a first CI run that draws other objects
  fails until it is recorded again.
- **A newer PDFKit is seen in one place.** pdfmake asks for `^0.19.1`, so
  a host may install a later PDFKit; the install gate draws with the one
  a clean install resolves, and fails if its profile is not the reviewed
  one, but the release report lists only the packed packages' direct
  dependencies and never names the PDFKit a host got.
- **The profile's digest is written four times**: in `ICC_PROFILES`,
  `e-invoice.test.ts`, `browser.test.ts` and the install gate's consumer.
  If they disagree a test or a gate fails, so the drift is found.
- **The exact buffer holds by construction.** Embedding an encoder's
  buffer whole would embed more than the XML where the buffer is larger
  than its view; V8's encoder hands over an exact one, so no test can show
  the copy matters.
- **What is not checked.** The browser entry's PDF/A in a browser rather
  than in Node; a JPEG's scan, which the check does not decode; and the
  corpus's table check, which misreads a word pdfmake breaks at its
  hyphen, so the samples' test reads the table itself.

**What it forecloses.** A plain PDF of a final e-invoice, and PDF/A
decided a second time, by a library or a second writer of the PDF.

## Alternatives considered

**PDF/A for every report.** It would refuse a CMYK JPEG and a title
holding `&`, `<` or `>` in every report, so a 0.1.0 template with a CMYK
logo or such a title would stop rendering; it would make every render
read PDFKit's profile from disk, which breaks every render of a host that
bundles the Node entry without it; and it would add the profile to every
PDF, 2,566 bytes deflated as the engine's reading measured it on 17
October 2026. A report that is no e-invoice gains nothing from it here.

**pdfmake's `files`.** It hands the relationship through, which its
types do not say, but its source must be a string, so the XML would go in
as a data URL, and an entry without a source drops every entry after it
without a word; and the XMP needs PDFKit's document anyway, so one hook
does both.

**A library that attaches the XML to the PDF afterwards** -- 0027 names
`node-zugferd`, `factur-x-kit`, `@stafyniaksacha/facturx`,
`@fin.cx/einvoice` and `@lucaapp/zugferd-ts` -- or pdf-lib as a second
writer. Each would rewrite the renderer's PDF and decide PDF/A a second
time, where PDFKit already writes the XMP, the output intent and the
identification.

**PDF/A-3a or 3u.** Level a needs a structure tree, which pdfmake does not
build; PDFKit has no level u. **PDF/A-4f** is allowed [S], but Mustang says
"Not a PDF/A-3".

**A patched PDFKit**, for a 16-byte `/CheckSum` and an `/ID` of its own.
A copy of upstream, to keep in step by hand (0002).

**The title out of the information dictionary and an escaped `dc:title`**,
which 0027 weighed: measured to pass veraPDF 1.30.3 only as a language
alternative, at the cost of every e-invoice's `/Title`. A title without
three characters still costs less.

**veraPDF through Mustang alone.** Mustang bundles veraPDF 1.30.2 and exits
0 on a PDF/A failure; a pin of its own judges the PDF part apart from the
hybrid, at a release past the floor.

**KoSIT over the XML Mustang extracts from each PDF.** The XML corpus
already judges the very bytes each PDF embeds; pdf-lib's comparison and
veraPDF's checksum and size tie the two.

**The fx values held to report-spec's `FACTUR_X`.** The renderer writes
them from that constant, so the test would compare the constant with
itself and pass for the wrong reason.

**A control whose XMP says `BASIC WL`.** veraPDF and Mustang accept it, and
a control no tool refuses is one the corpus refuses: the gate's own
reading holds the level of every sample's and variant's XMP to its XML,
and `pdf-corpus.test.mjs` holds that reading on `BASIC WL`.

**Every fixture as a variant.** The fonts fixture prints what no starter
does, text outside ASCII in both faces; the others draw tables, long text
and groups the starters draw, and each would be one more digest to record
again.

**A profile's licence keyed by its package.** The licence is the
profile's, whoever ships it, and a profile one byte off is another profile
nobody has read: the digest says both.
