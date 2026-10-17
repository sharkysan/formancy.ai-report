# @formancy/report-runtime

Formancy Report's runtime: it resolves a report definition against the data
a host hands it, and returns the renderer-neutral document a PDF engine
draws, or every reason it will not. It holds the data to the report's
dataset contracts, evaluates the report's expressions, groups, sorts and
totals with exact decimals, and formats each value for the report's locale,
once. No framework, no PDF engine, no Node. What it decides, and why, is
decision
[0010](../../docs/decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md).

## Resolve

```ts
import { resolveReport } from '@formancy/report-runtime'
import type { ImageResolver, ReportData } from '@formancy/report-runtime'

const data: ReportData = {
  header: { customer: 'Bäckerei Müller AG', quotedOn: '2026-10-15' },
  detail: [{ article: 'A-1001', quantity: '1.00', amount: '480.00' }],
  completeness: { complete: true, captured: 1 },
  consistency: 'host-captured',
}
// The host's approved assets, by id and digest: the runtime never follows an address.
const images: ImageResolver = ({ asset, digest }) => approvedAssets.get(`${asset}@${digest}`)

const resolution = resolveReport(report, data, { mode: 'final', parameters: { copies: '2' }, images, creationDate: '2026-10-15T08:00:00Z', timeZone: 'Europe/Zurich' })
if (resolution.ok) {
  resolution.document // what @formancy/report-render-pdf draws
  resolution.manifest // the report's hash, locale, zone, mode, consistency, completeness, parameters
} else {
  resolution.errors // each with the stage that found it, a stable code, a JSON Pointer, never a value
}
```

`resolveReport` refuses, with every reason at once up to a bound:

- a report `validateReport` refuses, or one `diagnose` gives an error for
  (stage `report` or `expressions`): the editor and the runtime refuse the
  same reports;
- parameters and data that break their contracts (`parameters`, `data`);
- an expression that fails for a row (`evaluation`), naming the component,
  the column or the aggregate and the row;
- a value a format cannot show, a locale or time zone the engine lacks
  (`format`);
- an image the host has no bytes for, or bytes past 20 MB, and a total that
  cannot be computed (`resolve`);
- a QR-bill that breaks one of SIX's rules once its data has resolved it
  (`resolve`, `invalid-qr-bill`): an account, a reference, an address part,
  a message or an amount, named by the field and the rule, never by the
  value.

It never returns part of a document.

## The data

One header record and one detail list, with what the provider says about
them. Every value is held to its field's type before anything reads it:

| Type | Accepted as |
|---|---|
| `integer` | a string of its digits, or a JavaScript number that is a safe integer |
| `decimal` | a canonical string within the field's scale; never a number, which has already lost digits |
| `date` | `YYYY-MM-DD`, a day on the calendar from 0001 to 9999 |
| `datetime` | `YYYY-MM-DDTHH:mm:ss`, with up to nine digits of a second, no zone |
| `instant` | an ISO 8601 date-time with its zone, held in UTC |
| `image` | `{ asset, digest }`, an approved asset, never an address |

A field the report does not declare is refused: a report never carries what
it does not print. Null prints as nothing; a field the data lacks is an
error in a final render, never an empty cell. A code is the exception: a
final render refuses a value that is null in a QR code's content or in a
QR-bill's text (`no-qr-value`), and a QR code whose content prints nothing
(`empty-qr-code`), since a scanner cannot see the gap a reader would. A
final render refuses data the provider calls incomplete. A **preview**
prints what it has, encodes a QR code as its content resolves, warns once
for each field it lacks, labels every page as a preview of incomplete
data, and says so in its manifest. A QR-bill is held to SIX's rules in a
preview too: one that a missing value leaves without a text SIX requires
is refused, and the error says the preview lacked a value for it, since
its code would scan as a bill no bank pays. The host's objects are read
once, as data: a getter is never run, and a proxy that throws is refused.

## A QR-bill

A report's payment part resolves to the document's `paymentPart`
([0022](../../docs/decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)): the
Swiss QR Code's payload, in the order of SIX's Table 8, and every text its
slip prints -- the headings in its language, the account, the reference
and the amount grouped as SIX prints them, the addresses line by line. The
rules a text is held to are report-spec's, the same functions its
validator applies to a literal. An amount is a decimal, or null for the
payer to fill in, and is never rounded: one with a third decimal is
refused. The bill has no "do not use for payment" variant and no
alternative procedure, and its ultimate creditor is empty, as SIX keeps it
for later use.

## What else is exported

Each stage is exported for a host or a tool that needs one alone:
`checkReport`, `checkData`, `checkParameters`, `readValue`,
`prepareExpressions`, `createFormatter`, `orderTable` and the decimal
arithmetic. The document's types, `RenderRefusal` and `REFUSAL_CODES` are
the renderer's contract, declared here so that no engine defines them.
What report-spec decides of a QR-bill that an engine needs to draw its
slip is handed on as report-spec's own objects: `QR_BILL_SIZE` and
`QR_BILL_TOP`, the slip's size and place; `qrBillPageBreak` and its type
`QrBillPageBreak`, the page it is printed on; `QR_BILL_CURRENCIES`;
`checkQrBillAmount`, the amounts a bill pays; and
`MAX_QR_BILL_ADDITIONAL_INFORMATION`, the longest value SIX allows. An
engine depends on the runtime alone, and draws and refuses by the one
decision the editor refuses by.

## What it does not do

- **Fetch anything.** The data and the asset bytes are the host's to hand
  over; the runtime reads no database and follows no address.
- **Check an image's digest.** It has no hash function without Node or the
  DOM; the host's lookup is trusted to return the bytes the digest pins.
- **Format with one engine's results everywhere.** Grouping marks, month
  names and currency symbols are the engine's ICU's, so the same report can
  print differently on two engines.
- **Encode a QR code.** It hands the engine the text a QR code's content
  prints, formatted as a paragraph with the same content prints it, and a
  QR-bill's payload; the engine encodes and draws them, and lays the slip
  out.
- **Compile once per render.** Each expression is compiled twice: once by
  `diagnose`, once to evaluate.

Source-available, not open source: see [`LICENSE.md`](../../LICENSE.md).
