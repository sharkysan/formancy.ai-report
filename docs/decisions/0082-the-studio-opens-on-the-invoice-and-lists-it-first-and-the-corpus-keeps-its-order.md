# 0082 — The Studio opens on the invoice and lists it first, and the corpus keeps its order

- **Status:** accepted; numbered while 0069 was held for a workbook's export and 0070 to 0073 by another branch; extends [0013](0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md), whose Studio opened the corpus's first starter, and changes what [0024](0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md)'s QR-bill page sends a reader to: the Studio's root now opens on the invoice it names; its cost "the bill a scroll down" answered by [0090](0090-a-preview-opens-a-report-that-carries-a-qr-bill-with-its-slip-in-view-and-nothing-moves-the-paper-after.md), under which the Preview opens at the bill wherever its paper scrolls
- **Date:** 2026-11-26
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The picker.** `apps/studio/src/starters/starters.test.ts`: the
    Studio's starters are the invoice, then every other starter of the
    corpus's `STARTERS` in that order, then Blank, by id and by the
    picker's label, "Invoice" first; and a corpus that holds no starter
    of the id `OPENS_ON` names is refused by `studioStarters`, in a
    sentence that names the id, rather than opened on whichever starter
    came first.
  - **The Studio as it opens.** `apps/studio/src/studio.test.tsx`, "opens
    on the invoice, saying what it shows, and prints it": the picker on
    the invoice and described by the bar's line, "Shows " and the
    invoice's own `proves`; the builder holding its report, its title
    "Rechnung mit QR-Zahlteil"; every preview asked for the invoice's,
    printed; and its problems pane holding the one warning report-core's
    `diagnose` gives it, that the bill pays SIX's example account. The
    same suite holds the picker's options in that order, the session
    kept when another starter is opened and the invoice opened again, the
    final render's Download PDF named `invoice.pdf`, and the invoice's
    Preview hidden and kept hidden.
  - **The corpus's order, unchanged.** report-corpus's
    `src/starters/starters.test.ts`, "are twelve, each with its own id",
    as before: `STARTERS` is plan 7's three first, the service inspection
    first among them, and every reader of it -- `samples/`, the README's
    table of the starters, the e-invoice gate's corpus -- keeps its order.
  - **The pictures.** The README's pictures whose bar lists the picker's
    starters were taken again by `node scripts/pictures.mjs`, on 26
    November 2026, and the narrow one shows the invoice as the Studio
    opens: held as every README picture is (0013), by
    `scripts/pictures/readme.test.mjs` in `pnpm test:repo` and the
    Studio's `test:pictures` in CI's `browser` job.
  - **In Chromium.** The browser gate's checks of the Studio as it opens
    (`gate-place.mjs`: where the Preview stands, the first viewport, the
    light passes' measure) read whichever starter the Studio opens on,
    and now measure the invoice; they passed on 26 November 2026, in all
    twelve passes from 320 to 2053 pixels wide, with the whole journey,
    which walks the picker's order, in eight of them.
  - **Seen failing, on 26 November 2026**, on Windows 11 and Node
    24.21.0: the picker's case and the refusal's against `main`'s
    `studioStarters`, the one with the invoice fourth and the other on its
    count, `main` naming no such id; the Studio's four cases against
    `main`'s Studio -- no combobox described by the invoice's line, the
    invoice's title where "Kept" was typed into the starter it opened on,
    `service-inspection.pdf`, and no bar's Preview saying it was off --
    each then passing with the change. Then, each
    planted in the working tree and put back byte for byte: `OPENS_ON`
    set to an id no starter has, which failed three cases of the
    starters' suite, two with the refusal's sentence and the third on
    its count; the refusal replaced by a fall back to the corpus's
    order, which failed the refusal's case, "expected [Function] to
    throw an error"; the Studio opening the second starter listed,
    which failed the Studio's opening case; and the Studio handed the
    invoice without its bill, which failed the same case on its problems
    pane, the warning missing from it.

## Context

The person who decides asked for a better report to open the Studio on.
The Studio opened the first starter of the corpus's `STARTERS`, and
`studioStarters` listed them in that order, then Blank. `STARTERS` is in
plan 7's order, its three starters first, so the Studio opened on the
service inspection: a stress test of long text over pages, two pages of
sixty check points that read nearly alike, a section that prints only
when a defect is found, and a 160 by 120 gradient made in code standing
in for a photo, so that the corpus carries no binary file. It proves
what it was written to prove, and is the weakest page the Studio has to
show a visitor who meets the product there first.

The invoice, the corpus's fourth starter, prints on one A4 page what a
business sends: the firm's mark, its customer, its lines, the subtotal,
VAT and the total, and across the foot of the page the Swiss QR-bill
that pays it, the receipt and the payment part with the Swiss QR Code
([0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)).
It is a `de-CH` report, a "Rechnung mit QR-Zahlteil": every starter but
the service inspection and the equipment register is in German.

The corpus's order is read elsewhere: `samples/` and its index, the
README's table of the starters, the e-invoice gate's recorded corpus and
the records that name a starter by its place, "`STARTERS`' seventh"
([0065](0065-the-xrechnung-is-a-starter-beside-the-e-invoice-and-a-final-render-of-either-offers-its-xml-beside-its-pdf.md)).

## Decision

**The Studio opens on the invoice, and its picker lists it first; the
corpus keeps its order.** `apps/studio/src/starters/starters.ts` names
the starter once, `OPENS_ON`, by its corpus id, `'invoice'`, with the
reason beside it; `studioStarters` lists that starter first, then the
corpus's others in `STARTERS`' order, then Blank, and throws where the
corpus holds no starter of that id. The Studio opens the first starter it
is given, as it did. Nothing in report-corpus changes.

## Consequences

**What it buys.** A visitor's first look is a document a business sends,
on one page, whose foot holds the QR-bill the module draws to SIX's
rules, a scroll down the Preview in most windows (below); and the bar
says so: "Shows a Swiss QR-bill: the receipt and the payment part at
the foot of the last page, paying the invoice's exact total by a QR
reference read from the data." The QR-bill page's hero, which sends a
reader to the Studio's root and says to choose the Invoice starter
(0024), now lands on it. The choice is one constant, in the Studio, and
an id the corpus drops fails the Studio's suites by name.

**What it costs.**

- **A warning in the first look.** The invoice's bill pays SIX's example
  QR-IBAN, which no bank books, by design (0022), and report-core warns of
  every bill that does until it pays another
  ([0039](0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)).
  The Studio used to open with "No problems found." in its problems pane;
  it now opens with "the payment part's account is SIX's example (IG 2.4,
  Annex A), no one's: replace it before the bill is sent". That is the
  editor saying what it is for, and still the first thing in the pane a
  visitor sees.
- **The bill a scroll down.** The Preview opens at the top of the
  invoice's page, so in most windows the QR-bill, the reason for the
  choice, is below its first view, while the problems pane shows the
  warning above from the start. Looked at in
  the built Studio, served by `vite preview` and opened in Playwright's
  Chromium on Windows 11 on 26 November 2026, by where the slip's
  "Empfangsschein" stood in the Preview's scroller: at 1280 by 720, 1440
  by 900 and 1920 by 1080 it was below the view, and at 2560 by 1440 the
  whole page was in it. The README's narrow picture leaves the bill out
  too. Nothing holds the bill in the first view, and opening the Preview
  where it shows the bill would be a decision of its own.
- **A German first look.** The invoice is in German for German-speaking
  Switzerland, whatever the visitor's language; the service inspection
  was in English. The Studio's and the builders' own words stay English,
  and no starter is picked by the browser's language.
- **Two orders of one list.** The picker lists the invoice first and the
  corpus fourth: a reader who compares the Studio with `samples/`, the
  README's table of the starters or the e-invoice gate's corpus finds
  the same starters in another order. The browser gate and the jsdom
  journey walk the picker's order, so the builder each starter is first
  seen in by `journey.test.tsx` changed with it.
- **The pictures.** Every README picture whose bar lists the picker's
  starters -- the quotation in React, the XRechnung, and the quotation in
  Angular -- was taken again; the first two are the same bytes, and the
  third's bytes changed by a few dozen, with nothing seen to differ on
  looking. The narrow picture shows the invoice as the Studio opens:
  "Page 1 of 1", the page down to its total, and its QR-bill below the
  pane, out of the picture.
- **One more place a starter's id is typed.** The Studio reads the id the
  corpus gives the invoice; renaming it there fails the Studio's suites,
  not the corpus's.

**What it forecloses.** Nothing the Studio did before: every starter is
still in the picker, and the service inspection is one choice away.
The Studio still has no address for a starter, so a link opens the
invoice and a page that wants another says which to choose (0024,
[0028](0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)).

## Alternatives considered

**Keep the corpus's first, the service inspection.** Nothing to change,
and the list in one order everywhere. Rejected: the Studio is where a
visitor meets the product, and a stress test written to prove pagination
of long text shows them what Formancy Report does least of what a
business prints.

**Reorder the corpus, the invoice first in `STARTERS`.** The Studio would
then open on it with no code of its own. Rejected: the order is plan
7's and the corpus's test holds it, and it is read by `samples/` and its
index, the README's table, the e-invoice gate's recorded corpus and the
records that name a starter by its place; a choice about the Studio's
first look would rewrite each of them.

**The sales report, with its bar chart and its pie**
([0067](0067-a-monthly-sales-report-is-a-starter-whose-bar-chart-and-pie-print-the-totals-its-table-prints.md)).
The most striking first page. Rejected: the builders draw a chart as a
box and edit none of its own properties yet (0052), so the first thing a
visitor selects on it is a component they cannot change; it runs over
two pages; and its value axis prints its ticks to the centime.

**The visitor's language**: a starter picked by the browser's language,
the invoice in French, Italian or English where the browser asks. Rejected:
those invoices are samples, not starters (0024), the Studio's words are
English, the first look would differ from one visitor to the next with
nothing to hold each, and the README's pictures and the browser gate would
have to take every one.

**One invoice in English for every visitor**: the corpus's `INVOICE_EN`,
the same invoice written for `en-CH` (0024), which would answer the
German first look without a choice per browser. Rejected: it is a
sample, not a starter (0024), and the Studio's starters are the corpus's
`STARTERS`, which its plugin hands the page. Opening on it would make it
a thirteenth starter beside the German one it is made from, and every
starter is a file in `samples/`, a row in the README's table, a document
the e-invoice gate records and a walk of the browser gate in both
builders; offered by the Studio alone, it would be a list of starters no
other reader holds, where this record keeps one list in two orders.

**The quotation**, which the README's first picture shows: one page under
the firm's mark too, in German too, and it opens on "No problems found.".
Rejected, weighing what each prints: the invoice prints lines, VAT and an
exact total as the quotation does, and the QR-bill besides; it loses from
the first look the quotation's cash rounding, its "Rundung" line, and its
running head and page footer, of which the invoice has neither, and
trades the quotation's empty problems pane for the example account's
warning.
