# 0024 — The invoice comes in four languages as samples beside the starters, with a manifest of their own, and a QR-bill page in each language shows them

- **Status:** accepted; extended by [0028](0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md),
  whose euro invoice samples share `samples.json`, and whose site checks
  every page's status before it renders any, the QR-bill page's in this
  record's words; and by
  [0032](0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md),
  under which every sample prints the firm's mark at the head of its
  page, so that the starter's digest pinned here is the one before the
  mark, and the samples differ still in nothing but their words and whom
  they bill
- **Date:** 2026-10-17
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The samples, in the corpus.** report-corpus's
    `src/starters/samples.test.ts`:
    - the German sample is the invoice starter, the very object, and its
      report is byte for byte what it was before the samples: the SHA-256
      of `JSON.stringify(INVOICE)` is pinned;
    - each sample validates with no diagnostic and resolves its own data
      with no warning;
    - each code's text, line by line, has its amount computed in BigInt
      from the sample's own lines, and its own creditor, debtor, reference
      and message;
    - the French, Italian and English print no German but a listed few
      words both languages share, and all four bill the same lines and
      the same total;
    - each sample's report has an id of its own, the sample's.

    Watched failing with the starter's VAT label changed and two of its
    styles reordered, "Zwischensumme" left in the French, the Italian's
    slip set to German, the French reference in the English, one French
    quantity drifted, and the four reports all `invoice`, as they first
    were.
  - **Their PDFs** ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)).
    report-render-pdf's `src/samples.test.ts` renders each sample on one
    page and reads it back with PDF.js: every line in order with its
    amount in the locale's format; the subtotal, the VAT, the total and
    the due date against a BigInt reference formatted by Intl for a
    locale the test states itself; the code decoded by ZXing from the
    page's pixels to the payload and the total, the printed total equal to
    the decoded amount, the slip's amount twice, and the slip's headings
    in the sample's language and in no other sample's. It first passed
    with the Italian's locale set to `de-CH`, because it read the locale
    from the sample; it states each one now, and failed so.
  - **Their pictures.** report-render-pdf's `src/pictures.test.ts` holds
    `docs/images/pictures.json` to the starters alone and
    `docs/images/samples.json` to the samples alone, every sample a
    picture in one of them, and each picture to the text of the page it
    was drawn from. Watched failing with the Italian picture drawn from
    the French sample.
  - **The pages' suite, `apps/pages`.**
    - `scripts/inputs.test.mjs`: a sample's picture has the lines
      `samples.json` records, and the build is told it read that file.
      Watched failing with the lines read from `pictures.json` alone.
    - `src/figures.test.ts`: every figure's quotes, the samples' among
      them, in every language's description and on a line its picture's
      page prints; and the figures are every picture a page shows, read
      from the HTML. Watched failing with the Italian figure showing the
      French file, and with a translation's description dropping a quote.
    - `src/qr-bill.test.ts`: the page refuses to render once the
      changelog names a release newer than the one its status was written
      against, and names the three sentences that say where it stands; it
      says it is in no release in its hero and in the product page's
      teaser, and its try-it text names the release the guide installs;
      each page shows the four samples, its own language's first; and its
      shared link's picture is its own language's sample's. Each failed
      with its rule taken out, or before it was written. The hero's and
      the teaser's case first passed with no sentence to find, every text
      containing an empty one, and now holds that sentence to four words
      at least.
    - `src/site.test.ts`: the QR-bill page at `qr-rechnung`, `facture-qr`,
      `fattura-qr` and `swiss-qr-bill`, and every check of 0021 passing
      for it. The wording check named sixteen descriptions as stating an
      amount of money until it read the samples' quotes as the documents'
      own words.
    - `src/checks.test.ts`: a product page that does not link to a topic
      page from its content, with the QR-bill page's teaser taken out of
      the German one. With the group's teaser taken out, the site's
      checks named all four product pages. A link to a heading its file
      does not have, the report-spec README's on the QR-bill page and the
      changelog's release on the product page; and a picture described
      otherwise than its figure, and a figure's amount written in a
      paragraph. The checks said nothing of any of them before they read
      a file's headings and a picture's figure. And GitHub's anchors as
      the check reads them, a fenced block's lines no heading and a
      heading said twice taking -1, which failed with either rule taken
      out.
  - **By hand, on 17 October 2026.** The built pages, served under
    `/report/` by a script outside the repository on a port of its own,
    in the Chromium of Playwright 1.64.1, measured by the Studio's browser
    gate's own `measureWidth` and `audit` (`apps/studio/scripts/gate-page.mjs`):
    all twelve pages at 320, 360, 641, 1280 and 1920 pixels had no
    sideways scroll and nothing past either edge, axe 4.14.0 found no
    violation, colour contrast and target size were measured and no
    text's contrast was left undecided, and no page asked for anything
    outside the site.

  What holds nothing: what a sentence claims and whether a translation
  says what the English says, which review holds, as 0021's; the
  measurements above, which no gate repeats; that the samples' invented
  firms and addresses are nobody's; the Studio's words the page names,
  its starter "Invoice" under "Starter"; and whether a search engine
  shows the page for the words its addresses and titles use.

## Context

The rightsholder asked for promotion of the invoices on the site, and for
template samples in European languages. 0021 left the invoice pages to
the changes that build their features. The Swiss QR-bill is built
([0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)):
the invoice starter prints one in German, and the runtime writes the
slip's headings in German, French, Italian, Romansh and English.

The forces:
- **The Studio's picker is the starters.** Its browser gate walks every
  starter in both builders, and holds every picture
  `docs/images/pictures.json` lists to a starter the picker offers
  (`apps/studio/scripts/browser-test.mjs`).
- **The pages quote what a picture prints.** A description's quotes are
  held to the lines the picture's manifest records (0021), and the
  wording check reads a quote as the document's own words, never as a
  price.
- **A status goes stale.** The page says the QR-bill is in no release yet.
  The release commit that adds a newer heading to the changelog changes
  nothing on the page.
- **A reader leaves from the top.** The hero's action and the product
  page's teaser are where a reader goes to try it, and the guide installs
  the newest release, which refuses a report with a payment part (0022).
- **A PDF is SIX's bill for e-banking.** SIX's guidelines take a QR-bill
  as a PDF for paying by e-banking or mobile banking, its lines marked
  with the scissors or the instruction to separate (IG 3.7, version
  2.4), and a bill on paper for white, perforated paper (IG 3.1, 3.3).
  0022 prints the PDF's marks and says nothing of paper.

## Decision

**One invoice, four editions, in the corpus.** `INVOICE_SAMPLES` holds the
invoice in German, French, Italian and English, made by one function from
each language's words (`invoice-words.ts`). The German is the starter
itself, unchanged. The French, the Italian and the English bill the same
work from an invented firm of their region, in fr-CH, it-CH and en-CH,
with their own references and SIX's example QR-IBAN.

**They are samples, not starters.** The Studio's picker keeps its starters
and Blank, and its pictures do not move.

**Their pictures have a manifest of their own,** `docs/images/samples.json`,
in `pictures.json`'s format with `sample` for `starter`, written by the same
script. The German sample's picture is the starter's, once. The pages read
the lines of both manifests.

**The QR-bill page is a group of 0021's site,** between the product page
and the healthcare page:
- its slugs the words a reader searches for: `qr-rechnung`, `facture-qr`,
  `fattura-qr`, `swiss-qr-bill`;
- its body what 0022 decides and its tests hold, and what it does not do
  from 0022's costs and SIX's guidelines, paper among them, in four
  languages;
- the four samples, the page's own language first;
- its shared picture its own language's sample's, so `PageGroup.image`
  may name one picture for each language;
- its teaser on the product page, which a new check holds for every
  topic page.

**Its status names the release it was written against, and is said where
a reader starts.** `QR_BILL_STATUS` holds the day and the newest release
then, 0.1.0. One sentence says the bill is in no release, in the hero and
after the teaser; the try-it text names the release the guide installs;
the status at the foot is dated. When the changelog names another release,
the site refuses to render, naming the three, until somebody says whether
that release has the bill.

**The pages' checks read two things more.** A link to a heading of a
repository file names one the file has, by the anchors GitHub gives its
headings: the QR-bill page links two by hand. And a picture is described
as its figure describes it in the page's language; only in that
description are the document's amounts its own words, where every
figure's quotes were excused on every page.

## Consequences

**What it buys.**
- **Samples a reader can see in their language,** each proved on the PDF
  it printed and drawn from it by a script, as the starters are.
- **A page under the words people search for,** QR-Rechnung, facture QR,
  fattura QR and Swiss QR-bill, with the samples' pictures and their words
  quoted as each prints them.
- **A status that cannot outlive its release.** The next release stops
  the pages' build until its sentences are read again, and a reader meets
  the status before the guide.
- **Links to a heading that hold.** A heading renamed in a README or the
  changelog fails the pages' suite, not a reader.
- **A Studio that does not move.** Its picker, its pictures and its gate
  are what they were.

**What it costs.**
- **Only the German sample is in the Studio.** The French, the Italian and
  the English are seen as pictures, and in the corpus.
- **Two manifests for one kind of picture.** The script writes both, the
  pictures' test holds them apart, and the pages read both. A third list
  of pictures is a third manifest, or a change to the gate.
- **The samples' numbers are the engine's locale data.** Under Node 24.21,
  with ICU 78.3, fr-CH prints the total as "1'416.52 CHF" and the quantities
  as "1,00", and it-CH does not group four digits, "CHF 1416.52". An ICU
  that prints them otherwise fails the pictures' test and then the pages'
  quotes, until the pictures are taken again.
- **The French slip's instruction lacks its accent.** The runtime prints
  "A détacher avant le versement", as version 2.4's English edition tables
  it; version 2.3's French edition writes "À détacher". The French
  sample's picture shows it, and the page quotes neither.
- **The next release touches the page.** A release commit fails
  `pnpm build` and the pages' suite until the QR-bill page's status is
  written again, in its three sentences, as RELEASING.md's second step
  says.
- **Paper is the biller's.** The page says a bill sent on paper needs
  SIX's white, perforated paper; nothing here sees what a PDF is printed
  on, and no slip has been printed (0022).
- **The Studio's words, typed.** The page names the starter "Invoice"
  under "Starter": the picker's label for it, which the Studio makes from
  the starter's id (`starterLabel`), and the picker's own. Nothing here
  reads them, so a renamed starter leaves the page naming a choice the
  picker no longer offers. The hero's action opens the Studio at its
  first starter, which is not the invoice, and says which to choose.
- **GitHub's anchors, as this check reads them.** A heading underlined
  rather than marked with `#`, and an anchor written as HTML, are not
  read, and a link to one is refused.
- **Invented firms at real-looking addresses.** Nobody checked that no
  business is at those numbers.
- **Copy held by review alone,** as 0021's: what a sentence claims, and
  the translations, which no native speaker's review is recorded for.

**What it forecloses.** Nothing that cannot be undone. The samples could
become starters, the picker and the gate's walk growing by three.

## Alternatives considered

**The samples as starters.** The reader could open each in the Studio. The
picker would offer four invoices that differ only in their words, and the
browser gate would walk three more starters in both builders.

**The samples in `pictures.json`.** One manifest. The browser gate fails
on an entry its picker does not offer, and changing the gate for pictures
it never shows would hold the gate to less.

**One page for all invoices, the QR-bill and SEPA's EPC code.** Fewer pages.
The EPC code is not built, and a page about it now would claim what no
test shows; its page comes with it, as 0021 says.

**A status without a release.** A date alone says how old the sentence
is, and says nothing when a release makes it false.

**The status at the foot alone.** One sentence to keep true. A reader who
follows the hero to the guide installs a release that refuses the bill,
and learns why only at the foot of the page left behind.

**The German sample's picture for every language's link**, as the design
had it. One picture for four pages, and a French page shared shows a
Rechnung.

**Links to the files without their headings.** Nothing to check. A reader
lands at the top of a long README and looks for the section.
