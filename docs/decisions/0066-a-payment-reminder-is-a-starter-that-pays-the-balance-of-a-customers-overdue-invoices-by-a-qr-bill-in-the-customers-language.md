# 0066 — A payment reminder is a starter that pays the balance of a customer's overdue invoices by a QR-bill in the customer's language

- **Status:** accepted
- **Date:** 2026-11-17
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **The corpus.** report-corpus's `src/starters/payment-reminder.test.ts`
    holds the reminder's two tables to the kinds each picks by `rowsWhen`;
    its items to four kinds and one fee, an invoice and the fee above zero
    and a payment and a credit below it, arriving out of the order each
    table prints, and each invoice's days overdue to the reminder's date
    less its due date; its bill to asking for `totals.balance`, the
    balance of every item computed there in BigInt, by the reminder's own
    QR reference and with its number as the message, the payload compared
    line by line; its letterhead to page 1's own header and its running
    header to naming the reminder and the customer; the report to the
    German reminder with a translation for French, Italian and English,
    the column's one expression among each, every word written anew in
    each, valid and whole in every language and opening with no
    diagnostic but its bill's example account; written in each language,
    to the reminder written in it alone, its slip in that language; and
    its data to holding no word. `src/starters/starters.test.ts` holds the
    eleven starters by id, in order, each validating, opening with no
    warning but a bill's example and resolving its own data in a final
    render with no warning; `src/starters/logo.test.ts` holds it beside
    the order confirmation as the letters that begin page 1's own header
    with the mark, with no image in their report header or page header;
    `src/report-size.test.ts` holds it to `MAX_REPORT_BYTES` and
    `MAX_WORDS` and their factors.
  - **The PDFs** ([0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md)).
    report-render-pdf's `src/payment-reminder.test.ts`, in each of the
    four languages: both tables line by line, the invoices by their due
    date and what was received by its date, each picked from the data in
    the test and closed by its own total, then the fee and what is due,
    every amount recomputed in BigInt and every amount, date and count
    formatted with Intl for that locale; the two sentences, the head and
    the PDF's title; the slip's headings in that language and no other's,
    stated in the test as SIX writes them; the code, decoded by
    `readCodes` from the page's pixels, the document's payload, asking for
    what is due, by the reminder's reference and with the message in that
    language, that amount printed on the receipt and the payment part;
    no German word that differs from the language's own; the corpus's
    `verify` over the page above the slip, each table row known by its
    first two cells; and the PDF equal by `inflatedDigest` to the reminder
    written in that language alone. Page 1's mark at the margins' corner
    with nothing beside it, and no running header there. And with forty
    invoices more: two pages, the mark on page 1 alone, page 2 opening
    with the running header and the overdue invoices' column header, the
    code on page 2 alone, asking for the balance of every item, the slip's
    headings there alone, and `verify` over both pages.
    `src/pictures.test.ts` holds its picture to its page's lines, places
    and drawings and to the README's caption; `src/pdfa-2b.test.ts` draws
    it as a PDF/A-2b; `src/languages.test.ts` prints it with its own
    locale named as with none.
  - **The builders.** The Studio's `src/parity.test.tsx` walks it in both
    builders in the editor's three languages, adding Romansh, which it
    does not declare, and selecting its QR-bill as it selects every
    starter's; `src/journey.test.tsx` previews it in both builders and
    renders it final in one; `src/preview/pipeline.test.ts` prints it through the browser
    entry with its title; `src/starters/starters.test.ts` and
    `src/studio.test.tsx` hold the picker's labels, "Payment reminder"
    among them. The browser gate walks it in Chromium in both builders at
    every pass and holds its Preview's pictured page to
    `docs/images/pictures.json`. On 17 November 2026, on Windows 11 in
    Chromium as `scripts/browsers.mjs` launches it, a whole run passed:
    5,890 checks over its twelve passes, the journey in eight of them,
    none failing. The README's Studio pictures whose bar lists the
    picker's options were retaken by `node scripts/pictures.mjs`, their
    bytes unchanged and their record naming "Payment reminder", which
    `test:pictures` holds.
  - **The e-invoice gate.** `scripts/e-invoice/pdf-corpus.mjs` draws
    `variant-payment-reminder.pdf` as a PDF/A-3b with the first sample's
    e-invoice, and `variantProblems` holds the variants to every starter;
    the PDF/A-2b plan draws it as `pdfa-2b-payment-reminder.pdf`. The
    judges' tests, `scripts/e-invoice/mustang.test.mjs`,
    `verapdf.test.mjs` and `corpus.test.mjs`, read the recorded run with
    both. Recorded with `--record` on 17 November 2026 on Zulu 25.0.4.1,
    both accepted and every PDF it drew before at the digest it had: 177 s
    in all, Mustang 150.8 s, as the gate printed them, on one Windows 11
    workstation with nothing else running.
  - **Seen failing, on 17 November 2026**, each before the code it holds
    or with it taken out and put back:
    - the corpus's `payment-reminder.test.ts` before the starter existed,
      by its import; `starters.test.ts` with ten ids; `logo.test.ts`, the
      reminder marked and in no report the corpus held;
    - `payment-reminder.test.ts`'s cases, each alone: the second table
      without its condition; a payment handed over above zero; the items
      sorted as the tables print them; one invoice's days overdue a day
      short; the bill asking for the balance less the fee; the slip's
      language left the report's own, which failed the three
      translations' cases; a word left out of every translation, which
      failed the whole-language case and the three translations'; the
      letterhead taken out, the running header standing alone; and the
      French fee, and the Italian words for a credit note and a payment,
      written as the German, which only the case of words written anew
      found;
    - the renderer's `payment-reminder.test.ts`: with the bill asking for
      the balance less the fee, the four languages' cases and the longer
      reminder's; with report-spec's `reportIn` leaving the column
      headers in the report's own language, and again with it leaving the
      slip in the bill's, the three translations' lines, German words and
      `inflatedDigest` cases each time; with the running header taken
      out, the longer reminder's; with the letterhead taken out, the
      letterhead's case, the four languages' and the longer reminder's;
      and the corpus's `verify` naming seventeen of the longer reminder's
      invoices missing when the page above the slip was read as page 1's
      too, which took page 1's last rows out with it;
    - report-render-pdf's `pictures.test.ts`, "show a page of every
      starter", once the corpus was built with it, and its case of the
      new picture until the README showed it under its caption;
    - the e-invoice gate's judges' tests, 23 cases, before the recording.

    Not seen failing: the French fee written as the German in the
    renderer's test, which reads the page against the same table of words
    and passed it; the corpus's case of words written anew is what holds
    that, and was written for it.

## Context

The starters are what a person meets the format through: the Studio opens
them, the README pictures them, both builders are compared over them, and
the e-invoice gate draws each as a PDF/A-3b variant and as a PDF/A-2b
([0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md),
[0057](0057-a-report-that-is-no-e-invoice-is-drawn-as-a-pdf-a-2b-where-the-host-asks-for-one.md)).
Ten of them stood, each showing its features apart: the invoice pays its
own total by a QR-bill
([0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)),
the order confirmation prints several tables and a letterhead
([0064](0064-an-order-confirmation-and-a-product-data-sheet-are-starters-that-print-what-0059-to-0063-added.md)),
and the product data sheet prints in four languages, but no starter
printed a QR-bill under a first page's own header
([0060](0060-a-reports-first-page-may-print-a-header-of-its-own-or-none-in-place-of-the-page-header.md)),
paid a balance computed from several tables
([0062](0062-a-report-holds-several-tables-over-its-detail-rows-each-printing-and-totalling-the-rows-its-condition-selects.md)),
or printed a slip whose headings follow the language a render names
([0063](0063-a-reports-own-words-are-written-in-each-language-it-declares-and-a-render-names-the-one-it-prints-in.md));
the invoice in four languages that 0063 proves is the corpus's, and no
starter.

A payment reminder, "Mahnung", is all three at once: it lists the
invoices a customer has not paid and what the firm received against them,
charges a fee, and asks for the balance by the slip the customer pays
with, in the customer's language.

The forces:
- **Every existing starter stays as it is.** Their JSON is pinned, their
  pictures recorded, and the e-invoice gate's corpus holds their PDFs.
- **One firm** under one mark
  ([0032](0032-the-invoices-and-the-quotation-print-one-invented-wordless-mark-at-the-top-left-of-their-first-page.md)),
  and invented, generic content: the firm is the invoices', and the
  customer, its invoices and what it paid are invented.
- **A total is computed once, in the runtime**, exactly: what the page
  prints as due and what the slip asks for must be one value, as the
  invoice's total and its bill's amount are one aggregate.
- **What the corpus's checks read.** They know a table row by its first
  cell, at the start of a line, and each key once on the page.
- **The expression language reads a date as its ISO string**
  (report-core's `members.ts`): it has no arithmetic over dates.
- **The bounds `limits.ts` states**, which name the largest report the
  corpus holds and the one with the most words.

## Decision

**A payment reminder follows the product data sheet in `STARTERS`, a
letter of the firm's under its letterhead, in Swiss German with its words
in French, Italian and English: one list of a customer's open items
printed as two tables picked by their kind, and the balance of every item,
its fee among them, printed as what is due and paid by a Swiss QR-bill in
the language a render names** (`starters/payment-reminder.ts`, its words
in `starters/payment-reminder-words.ts`).

- **The items, as the ledger books them.** The detail rows are the
  customer's open items: four invoices past their due date, two payments
  and a credit note received against three of them, and the reminder's
  fee, each with its kind, the invoice it belongs to, its date, an
  invoice's due date and days overdue, and its amount. An invoice and the
  fee are above zero; a payment and a credit below it, as the ledger books
  what was received. They arrive in the order they were booked, so only
  the tables' conditions and sorts put them where they print.
- **Two tables over one list** (0062). The overdue invoices, `row.kind ==
  "invoice"`, each with its number, date, due date, days overdue and
  amount, by due date; and the payments and credit notes, `row.kind ==
  "payment" || row.kind == "credit"`, each with what it is, its date, the
  invoice it was booked against and its amount, by date. Each closes with
  its own total, `over: 'table'`.
- **One balance, once.** One aggregate, `balance`, sums every item's
  amount: over a table it is that table's total, and over the report it
  is what is due, the invoices less what was received, with the fee. The
  summary prints the fee, by an aggregate of its own over `row.kind ==
  "fee"`, and what is due, `balance` over the report; the bill's amount is
  `totals.balance`, so what the page says is due and what the code asks
  for are one value. Nothing on the page is typed in: the fee is an item
  of the data, and every total is the runtime's.
- **Days overdue are the host's.** The expression language has no
  arithmetic over dates, so each invoice's count is the data's, counted
  from its due date to the reminder's date, which the corpus's test holds
  for the starter's own items.
- **The slip.** SIX's example QR-IBAN, as the invoice pays, by a QR
  reference made from the reminder's number with IG Annex B's check
  digit, and "Mahnung" and the number as the message, a word written in
  each language; its debtor the customer, from the data. It stands at the
  foot of the last page.
- **One page, and a running header for more.** Page 1 prints the
  letterhead in its own header (0060), and every later page a slim
  running header that names the reminder and the customer. The starter's
  own items fit page 1 with the slip at its foot, as a reminder of one
  sheet does, where the customer tears the slip off the letter it
  explains; a reminder of more invoices runs on to page 2, the overdue
  invoices' column header repeated under the running header and the slip
  at the foot of the last page, which the renderer's test shows with
  forty invoices more. The overdue invoices' heading is not kept with its
  table, which a reminder of more invoices runs past its page: kept, the
  renderer would move both to the next page (0064's defect); it stands at
  the top of page 1's body, where no page ends under it.
- **Four languages, one report** (0063). The German is the reminder's
  own; the French, Italian and English are translations keyed by the
  German, each word written anew. What a payment and a credit note are
  called is an expression over the item's kind, translated whole in each
  language: the first starter whose translations hold an expression, so
  that the data holds no word. A render that names fr-CH, it-CH or en-CH
  prints the page in that language and the slip's headings in SIX's words
  for it. `paymentReminderAlone` writes the reminder in one language
  alone, which a render in that language is held to.
- **The walks.** The picker offers it, "Payment reminder"; the parity
  walk adds Romansh to it, which it does not declare; the e-invoice gate
  draws it as a variant and as a PDF/A-2b; the README pictures its page.

**Left out, both optional in the request that asked for it:**
- **A reminder level chosen by a parameter**, "1. Mahnung" or "2.
  Mahnung", with `visibleWhen`. An ordinal is written otherwise in each
  language -- "1er rappel" and "2e rappel", "First" and "Second" -- so the
  heading would be an expression written four times; the fee a level
  usually decides is the data's, which a parameter could contradict; and
  the Studio has no parameter form, so a person would see one level
  there. It did not stay simple. The reminder refers to the earlier one by
  its date, and a first reminder is the same report with its sentence
  changed.
- **Default interest.** When it starts -- the due date where one was
  agreed, the reminder otherwise -- its rate and how its days are counted
  are a firm's terms and a lawyer's question, not the template's, and the
  runtime cannot count the days; an amount printed on assumptions the page
  does not state would be a number nobody checked.

## Consequences

**What it buys.**
- **A document a Swiss firm sends, whole, in the Studio.** A letterhead,
  two tables over one list, an exact balance and a slip that asks for it,
  in four languages, the slip's headings following the language: the
  first starter that prints a QR-bill under page 1's own header and whose
  slip follows a translated render, and the first whose translations hold
  an expression.
- **The balance held to the code on the PDF**, in each language: what the
  page says is due, recomputed in BigInt, is what ZXing reads from the
  pixels, and the slip's amount is that value.
- **A QR-bill under page 1's own header judged by veraPDF and Mustang**,
  as a PDF/A-3b variant, and by veraPDF as a PDF/A-2b.

**What it costs.**
- **An eleventh starter in every walk.** The parity walk in three
  languages, the journey, the preview pipeline and the browser gate's
  passes each open one starter more, and the e-invoice gate draws two
  PDFs more. Not measured apart from the rest of their runs.
- **Days overdue the host's.** Nothing holds a host's count to its dates
  but the host; the corpus's test holds the starter's.
- **Signs the host's.** The data contract says an amount is a decimal,
  not its sign: a host that hands what was received above zero prints a
  balance that adds it, and nothing refuses that. The starter's data is
  held to its signs.
- **Kinds named in three places.** The two tables' conditions, the fee's
  aggregate and the column's expression each name kinds; an item of a
  fifth kind, or a fee named otherwise, counts in what is due and prints
  in no table, as an order confirmation's line of a fourth kind would.
- **A fee only as an item.** A host whose fee is not an item of its
  ledger hands one over as an item, or the reminder prints CHF 0.00 for
  it; a fee written in the template would be a second place for it.
- **One page in every picture.** The starter's own data fits page 1, so
  the README, the Studio and the browser gate show the running header
  never; the renderer's test alone prints a page 2, with forty invoices
  more.
- **Rows known by two cells.** An invoice's number stands in both tables
  and a kind's word begins every row of the second, so the renderer's
  test keys each row by its first two cells for the corpus's checks,
  where every other starter's is keyed by its first, and reads the page
  above the slip, which is drawn past the margins.
- **Words in an expression.** A person changes what a payment and a
  credit note are called in an expression's field, written in each
  language, not in a word's.
- **Invented and unreviewed.** The firm, the customer, its invoices and
  what it paid are invented; the account is SIX's example, which the
  editor warns of, as it does of the invoice's (0039), and the reference
  is made from the reminder's number. No native speaker has reviewed the
  French, the Italian or the English.
- **Inside the bounds, measured.** The report is 14,905 bytes, its
  translations included, with 23 words and 1 expression at word places,
  under the XRechnung sample's 16,254 bytes and 49, and the e-invoice
  sample's 16,027 bytes after it, so `limits.ts`' comments hold as
  written (measured on 17 November 2026 under Node 24.21.0 on Windows 11,
  as `report-size.test.ts` measures them).

**What it forecloses.** Nothing that cannot be undone: the starter can be
taken out of `STARTERS`, its lists and its picture with it.

## Alternatives considered

**The fee in the header, added by an expression.** `totals.balance +
header.fee` printed as what is due and asked for by the bill: two
expressions that must agree, and the invoice's own rule, one aggregate the
page prints and the bill pays, broken. As an item of the list the fee is
in the one aggregate.

**What was received above zero**, a sum that subtracts it by its kind.
The page would print no minus, and the aggregate would name the kinds a
fourth time; a ledger books what was received below zero, and the balance
is then a plain sum.

**One table, each invoice grouped with what was received against it**, a
group footer its open amount (0059's groups). It shows no condition, and a
payment on account, against no invoice, would stand in no group.

**The invoices' open amounts alone**, payments netted by the host. A
customer could not see what the firm booked against each invoice, and
there would be one table, not two over one list.

**Running on to page 2 with its own data**, so that the README pictures
the running header. A reminder is a letter of one sheet whose slip is
torn off; a second sheet for four invoices would show the slip where a
customer looks for it last. The renderer's test prints the long one.

**Four samples, one for each language**, as the invoice's are (0024).
0063 makes one report print in each language; a starter of four reports
would show none of it, and the Studio's language switch would have
nothing to switch.

**Days overdue computed in the runtime.** There is no arithmetic over
dates in the expression language, which is upstream's; adding it is a
change of its own, not a starter's.

**A key of the corpus's own for the reminder's rows**, the item's
document number as each row's first cell. Every received item would need
a number of its own the reader does not need, and an invoice's number
would still stand in both tables; keying by two cells reads the page as
it is.
