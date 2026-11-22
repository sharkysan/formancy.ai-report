# 0065 — The XRechnung is a starter beside the e-invoice, and a final render of either offers its XML beside its PDF

- **Status:** accepted; amends [0038](0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md), whose sample was no starter; extended by [0077](0077-a-report-that-carries-an-e-invoice-is-written-into-a-word-file-as-the-copy-the-runtime-labels-on-every-page.md), under which Download Word of a final render of an e-invoice gives the Word file of its copy, beside the PDF and the XML that are the invoice
- **Date:** 2026-11-17
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The corpus.** report-corpus's `src/starters/xrechnung.test.ts`
    holds the XRechnung sample to being the starter after the e-invoice,
    and to no Factur-X sample; `src/starters/starters.test.ts` holds the
    ten starters by id, in order, each validating, opening with no
    diagnostic and resolving its own data in a final render with no
    warning; `src/starters/logo.test.ts` holds it among the letters that
    begin their report header with the firm's mark.
  - **The PDF.** report-render-pdf's `src/pictures.test.ts` holds a
    picture of every starter, the XRechnung's page among them, to its
    lines, places and drawings, its caption quoting the copy's label, the
    Leitweg-ID and the totals; `src/pdfa-2b.test.ts` holds the starters
    drawn as no PDF/A-2b to the two e-invoices.
  - **The Studio.** `src/starters/starters.test.ts` holds the picker's
    labels, an e-invoice's its kind's in the builder's words, and no two
    alike; `src/studio.test.tsx` the picker's options.
    `src/preview/pipeline.test.ts` holds each e-invoice starter's final
    render to handing on the runtime's XML, the Factur-X's the very bytes
    its PDF embeds as `factur-x.xml` and the XRechnung's beside a PDF that
    embeds none, read by namespace with the corpus's `readCii`, its
    guideline (BT-24) its kind's and its total with VAT (BT-112) the
    Rechnungsbetrag its page prints; every starter's preview to handing on
    none; and, as each opens, its XML to being byte for byte the file the
    e-invoice gate recorded and judged,
    `scripts/e-invoice/recorded/corpus/e-invoice.xml` and
    `e-invoice-xrechnung.xml`. `src/preview/pdf-view.test.tsx` holds
    Download XML to following Download PDF, the keyboard's next stop, under
    the starter's id with `.xml`, as `application/xml` in UTF-8, to the XML
    of the render on the paper until PDF.js has drawn a newer one, and to
    none where the render wrote none. `src/journey.test.tsx` holds, at
    every preview and final render it walks, Download XML to the XML of
    the render shown, offered on a final render of an e-invoice and on no
    other; it walks each starter's final render in one builder, the two
    taking turns from starter to starter. `src/parity.test.tsx` walks the
    XRechnung's e-invoice in both builders in three languages, as it
    walks every starter's.
  - **The browser gate.** `apps/studio/scripts/gate-e-invoice.mjs`'s
    `downloadXmlChecks`, at each e-invoice starter's final render in the
    journey, in each builder, at every pass that walks the journey, eight
    of its twelve: Download XML downloaded as a person downloads it and
    saved as the starter's `.xml`, Tab from Download PDF onto it, the
    Factur-X's the very bytes its Download PDF embeds, found by pdf-lib,
    the XRechnung's beside a copy that embeds nothing, read by namespace,
    its guideline its kind's and its total the page's, read by PDF.js.
    `gate-download.mjs` reads a link by its own name and says what the
    browser saved it as, which `gate-download.test.mjs` holds. The journey
    holds the XRechnung's final render to its picture, as every pictured
    starter's, and `browser-test.mjs` measures that state, Download XML on
    screen, as it measures every other: no sideways scroll, nothing past
    either edge, no control of the Preview cut off, and axe's rules,
    contrast and target size among them. On 17 November 2026, on Windows
    11 in Chromium as `scripts/browsers.mjs` launches it, the gate ran
    twice, and the system stopped it both times for want of memory:
    before the final render was measured, six of its twelve passes whole
    and part of the seventh, 4,424 checks; then, with it, five passes whole
    and part of the sixth, 3,922 checks, among them 21 final renders of the
    two e-invoices measured with Download XML on screen and the
    XRechnung's parity walk in both builders. No check failed in either
    run; no whole run of the gate has passed on this change yet.
  - **The e-invoice gate.** `scripts/e-invoice/pdf-corpus.mjs`'s
    `variantProblems` asks a PDF/A-3b variant of every starter whose kind
    of e-invoice the gate draws as one, read from `KINDS` in
    `scripts/e-invoice/corpus.mjs` -- none, or a Factur-X invoice -- and
    refuses one of a starter of a kind drawn as none, the XRechnung, and a
    kind it does not know, which `scripts/e-invoice/pdf-corpus.test.mjs`
    holds; `scripts/e-invoice.mjs` hands it each starter's kind. Recorded
    with `--record` on 17 November 2026 on Zulu 25.0.4.1, every PDF it
    drew before at the digest it had, as `main`'s recording holds them:
    206.7 s in all, Mustang 174.8 s, as its `test-results/e-invoice.json`
    gave them, on one Windows 11 workstation with nothing else running.
  - **Seen failing, on 17 November 2026**, each before the code it holds:
    - the corpus's `starters.test.ts` with nine ids and `xrechnung.test.ts`
      with the sample no starter, before `STARTERS` held it; then
      `logo.test.ts`, the XRechnung marked and named nowhere;
    - report-render-pdf's `pictures.test.ts`, "show a page of every
      starter", and `pdfa-2b.test.ts`, the XRechnung among the starters
      not drawn, once the corpus was built with it;
    - the Studio's labels, "E-invoice" and "E-invoice xrechnung";
      `pipeline.test.ts`'s four cases of the XML before the pipeline handed
      it on; `pdf-view.test.tsx`'s two before Download XML;
      `gate-download.test.mjs`'s before `offeredXml`; and the journey,
      Download XML renamed in the viewer, at the e-invoice's final render:
      "expected undefined to be 'e-invoice.xml'";
    - the e-invoice gate's judges' tests, 21 cases, before the
      recording;
    - `pdf-corpus.test.mjs`'s two cases of the variants, before
      `variantProblems` read the starters' kinds: the starters as `{ id,
      kind }` read as ids, every one without a variant;
    - the browser gate's measurement of the final render, with Download
      XML's text the colour of its ground, in a run stopped once it had
      measured the first: "the contrast of every text in view decided"
      failed at the Factur-X's final render in React at 320 pixels, the
      link undecided (`equalRatio`). The link forced 1,200 pixels wide
      passed there, in a Preview pane that scrolls to its tools, which
      the gate counts as within reach.

## Context

0038 made the XRechnung a second kind of e-invoice and gave it a sample,
"Rechnung (XRechnung)", the e-invoice starter's template made an
XRechnung 3.0 and apart from it in nothing else, which the e-invoice gate
judges in KoSIT's XRechnung scenario and with Mustang. It kept the sample
out of the starters, "neither builder edits an e-invoice yet (0027)"; 0044
then had both builders edit either kind, and made the Factur-X sample a
starter, and the XRechnung stayed a sample.

So a person trying the Studio met one kind. They could see that its final
render is a PDF/A-3b, but not the invoice it carries: the XML is a file
embedded in the PDF, which the Studio did not offer, and which a person
reads only with a PDF tool that lists attachments. The XRechnung, the kind
whose XML is the invoice and whose PDF is a copy, was not in the Studio at
all. What makes an e-invoice worth having -- an invoice's terms, written
once, giving the XML a buyer's system reads and the page a person reads,
the XML judged by the tools a receiver runs -- was nowhere a person could
look at it.

The forces:
- **Every existing starter stays as it is.** Their JSON is pinned, their
  pictures recorded, and the e-invoice gate's corpus holds their XML and
  their PDFs.
- **One writer.** The runtime writes the XML, by `cii.ts`, from the values
  the page prints (0027), and the resolved document holds it; a host takes
  it from there (0038). A second writer, or a second reader that pulls the
  XML out of the PDF, would be a second place for the XML to come from.
- **A preview is no e-invoice** (0027): it writes no XML, and says so on
  every page.
- **The Studio's room**, and its claims: a number or a word on a page is
  derived; a claim is backed by something that fails; no page compares
  Report with another product (0056).

## Decision

**The XRechnung sample is a starter, the one after the e-invoice; the
picker names an e-invoice starter by its kind; and the Preview offers a
final render's XML beside its PDF, Download XML.**

- **The pair.** `XRECHNUNG_SAMPLE` joins `STARTERS`, unchanged, after
  `E_INVOICE`: one template's terms in both kinds, side by side. It bills
  another buyer, an invented federal office by KoSIT's test Leitweg-ID,
  for other work, as 0038 made it: one template's terms, not one
  invoice's data, its page printing another buyer and another total, and
  the Leitweg-ID at the foot of its head.
- **Named by kind.** The picker calls a starter whose report carries an
  e-invoice what the builder calls the part, and the kind its heading
  names ("Factur-X: E-invoice", 0044): "E-invoice (Factur-X)" and
  "E-invoice (XRechnung)", from report-builder-core's English words. Any
  other starter is named from its id, as before; the rule that kept a
  lone letter's hyphen, there for "E-invoice", went with the one id it
  served.
- **Download XML.** A printed preview outcome hands on the XML the
  runtime wrote, `document.eInvoice.xml`, which only a final render of an
  e-invoice writes. The viewer keeps it with the PDF it was written
  beside, as it keeps the PDF's bytes with the pages they were drawn
  from, and offers it after Download PDF, the keyboard's next stop, as
  the starter's id with `.xml`, `application/xml`, in UTF-8, the encoding
  its declaration names and a Factur-X PDF embeds it in. So the Factur-X's
  Download XML is byte for byte the `factur-x.xml` its Download PDF
  embeds, and the XRechnung's is the invoice, beside a PDF that is its
  labelled copy. A preview offers none: its warning already says a final
  render alone writes the XML. The link is the room's `tool`, as Download
  PDF is, with no rule of its own.
- **What the Studio claims, and what the README does.** The Studio says
  nothing of validators: what a person downloads after an edit is a file
  nobody has judged. The README says that, as each starter opens, its XML
  is byte for byte the file the e-invoice gate records and has Mustang
  and KoSIT's validator judge -- which `pipeline.test.ts` holds against
  the recording, and the gate's run against what it judged -- and that
  once edited, nothing has judged it.
- **The walks.** Every walk over the starters walks the XRechnung: the
  corpus's, the README's pictures, the Studio's suites, and the browser
  gate in both builders at every pass that walks the journey, which reads
  every e-invoice's Download XML and measures its final render. The
  e-invoice gate draws no PDF/A-3b variant of it: which starters a
  variant draws is read from each one's kind of e-invoice, as the gate
  reads what it draws of a sample (`KINDS`), and an XRechnung's PDF is a
  copy that is no PDF/A (0038). Its XML is judged as the sample's, as
  before.

## Consequences

**What it buys.**
- **Both kinds, in front of a person.** The picker shows that one
  template gives both, by name; Final shows the PDF/A-3b of the one and
  the labelled copy of the other; Download XML hands over the invoice
  each is, the very XML a host would take.
- **The XML a person can open**, without a tool that lists a PDF's
  attachments, held in Node and in Chromium to being the bytes the PDF
  embeds, and, as each starter opens, the file the gate judged.

**What it costs.**
- **A tenth starter in every walk.** The parity walk in three languages,
  the journey, the preview pipeline and the browser gate's passes in both
  builders each walk one starter more, and the browser gate measures two
  final renders more at every pass that walks the journey. Not measured
  apart from the rest of the run.
- **The XRechnung's page is judged by no PDF/A validator.** Its PDF is a
  copy, no PDF/A, and the gate draws no variant of it: the Leitweg-ID line
  in its head is a line no veraPDF run reads, where every other starter's
  page is, as a variant.
- **"E-invoice" is now "E-invoice (Factur-X)".** A person or a page that
  called the starter by its old name -- the README's Studio pictures,
  whose bar holds the picker's options, among them -- reads another; the
  pictures were taken again by their script.
- **Download XML is behind Final.** A person on a preview sees no Download
  XML; the preview's warning, that a final render alone writes the XML,
  is all that points to it. Whether a person finds it, nothing measures.
- **An edited XML judged by nobody.** Once a person edits a starter, its
  XML is the runtime's of that edit, which no validator has seen; the
  README says so, and the Studio says nothing either way.
- **A download behind an edit.** While a render is pending after an edit,
  both downloads still give the render on the paper, the one from before
  the edit, as Download PDF always has; for an XRechnung that older XML is
  the invoice itself, and the paper's busy state is all that says a newer
  one is on its way.
- **One template, two invoices.** The pair bills two buyers for two jobs,
  so the XMLs differ in more than their kind: a person comparing them
  sees the buyer, the lines and the totals differ too, and the XRechnung's
  Leitweg-ID, buyer's reference and electronic addresses besides.
- **A copy that only says so.** Downloaded alone, the XRechnung's PDF is
  no invoice, and its label is all that tells the person (0038's cost,
  now one a person meets in the Studio).
- **The download's name is the starter's.** The Factur-X's XML downloads
  as `e-invoice.xml`, not as `factur-x.xml`, the name its PDF embeds it
  under, so that the two files of one render are named alike.
- **The bar's English names the kinds.** "Factur-X" and "XRechnung" are
  the builder's English words, as the bar is English whatever language
  the builder speaks.

**What it forecloses.** Nothing that cannot be undone: the XRechnung can
leave `STARTERS`, its picture with it, and Download XML is one link.

## Alternatives considered

**An XRechnung of the e-invoice's own data**, the restaurant's invoice in
both kinds. The owner chose two buyers: one template shown in both kinds,
each billing its own buyer, which the sample already is, the e-invoice's
template made an XRechnung and apart in nothing else, as
`xrechnung.test.ts` holds. One invoice in both kinds would be a second
XRechnung sample beside it, one file more for the gate to keep judged in
KoSIT's XRechnung scenario and with Mustang, and one report more for the
corpus to keep within `limits.ts`' bounds.

**The XML read out of the PDF in the page**, with PDF.js's attachments. A
second reader in the browser, of a file the page already holds as text,
and nothing for the XRechnung, whose copy embeds none.

**The XML shown in the page**, a pane or a dialog of it. A viewer of its
own, its words and its colours to hold to the room and its keyboard path
to axe, for a file a host sends rather than reads; a download is what a
host does with it.

**The XML in a preview too.** The runtime writes none in a preview
(0027); the Studio would need a final render the person did not ask for,
or a writer of its own.

**`factur-x.xml` as the Factur-X's download name.** The two files of one
render would be named apart, and the XRechnung has no such name to take.

**Labels from the ids, spelt right.** "E-invoice" and "E-invoice
XRechnung" leave the Factur-X saying no kind, and the pair reading as one
starter and its variant.

**A sentence in the Studio that the gate judged the XML.** It is true of
a starter as it opens and false after its first edit, and the Studio
cannot tell a person which they hold.

**A variant of the XRechnung's page**, as every other starter's: its page
drawn as a PDF/A-3b with the first sample's Factur-X invoice. It would be
a PDF that says on every page it is the copy of an XRechnung and is a
Factur-X invoice, which no host draws: a page judged by a file that
contradicts itself. Reading which
starters a variant draws from `KINDS`, which already says an XRechnung is
drawn as no PDF/A-3b, keeps the rule one the gate states once, and no
exception by id.
