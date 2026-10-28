# Getting started: a PDF from your data, and the editor in your page

This guide takes an application developer from an empty npm project to a
quotation printed as a PDF, in Node and in a browser, to an XRechnung's XML
and its copy, and to the report editor in a React page that saves what the
author changed and previews it as they work, and in an Angular page that
saves. It is written for the 0.2.0 developer preview, but for the
XRechnung, which needs the release after it (section 2): the packages are
the ones
[README.md](../README.md#packages) lists, the report format is version 0, a
draft, and where a page needs a server -- to store a report, or to hand it
data -- the server is yours, or the one section 6 keeps a draft on.

Formancy Report is source-available, not open source: evaluating and
developing with it, as this guide does, is free, and running it in
production takes a paid licence. The
[licence table](../README.md#licence-in-one-table) says what is free, what is
not, and where a production licence is requested.

**How this guide is kept true.** Every TypeScript block below is compiled
by the install gate, `pnpm test:e2e:install`, against the packages as
`pnpm pack` packs them, installed into plain npm projects with
`skipLibCheck` off, and run there or, where it needs a browser, bundled for
one; CI runs the gate on every pull request and before every release
([0015](./decisions/0015-the-getting-started-guide-is-compiled-and-run-by-the-install-gate.md)):

- the Node blocks of sections 2 and 7 are one program, checked against
  Node's types and run: it must write a PDF and print exactly the lines this
  guide shows it printing;
- the blocks of sections 3, 4 and 6 are one React page, checked against the
  DOM's types and not Node's, at the newest and the oldest React the React
  builder's peer range admits: its component is drawn by React's server
  renderer, its preview is run under Node against the browser entry of the
  renderer, and every one of its files is bundled for a browser;
- the blocks of section 5, with section 4's `editor.ts`, are one Angular
  page, compiled ahead of time with strict templates at both ends of the
  Angular builder's peer range, its component drawn by Angular's
  platform-server and every file bundled for a browser.

`scripts/getting-started.test.mjs`, in `pnpm test:repo`, fails when a block
of code is not handed to the gate, or imports a package section 1 does not
tell you to install. What neither checks: these pages in a real browser --
nothing here mounts them in a DOM, presses Save or shows the PDF -- the
`angular.json` lines in section 5, and the server routes the pages call,
which are yours.

## 1. Install

The packages are ES modules with an `exports` map; import their entry
points, never a file under `dist/`. Which you install depends on what your
application does.

To render a PDF, in Node or in a browser:

```sh guide=node,react
npm install @formancy/report-runtime @formancy/report-render-pdf
```

To validate and diagnose a report your application stores (section 7):

```sh guide=node
npm install @formancy/report-spec @formancy/report-core
```

To embed the editor in a React page, in a React application:

```sh guide=react
npm install @formancy/report-core @formancy/report-builder-core @formancy/report-builder-react @formancy/themes@0.7.0
```

To keep the draft on Report's server from that page (section 6), beside the
install line above:

```sh guide=react
npm install @formancy/report-client
```

To embed it in an Angular page, in an Angular application:

```sh guide=angular
npm install @formancy/report-spec @formancy/report-core @formancy/report-builder-core @formancy/report-builder-angular @formancy/themes@0.7.0
```

`@formancy/themes` is formancy's, under Apache-2.0, at the release the
builders are dressed with. Its `workbench.css` lays out the editor's panes,
and `report-builder-core`'s `report-builder.css` dresses what is particular
to reports; a page imports both, the workbench's first. The builder takes
its colours from the workbench's `--wb-*` variables, so a page recolours it
by setting those and never by overriding a rule
([report-builder-core's README](../packages/report-builder-core/README.md#the-stylesheet)).
A page that wants formancy's own dark room imports `@formancy/themes/room.css`
after the workbench, which sets them to the admin's palette, as the Studio
does ([0034](./decisions/0034-the-studio-and-the-pages-wear-formancys-room-by-importing-the-released-one.md)).

What the packages are tested with -- Node, TypeScript, React, Angular and
the upstream `@formancy/*` releases -- is the table under
[*What it is tested with*](../README.md#what-it-is-tested-with) in the
README, generated from the run that gated the release, with each builder's
peer range in its *Declared as* column; the install gate checks each
builder, and this guide's pages, at the newest and the oldest release its
range admits. The release report every CI run produces says what that run
actually ran.

## 2. Render a PDF in Node

The program in this section is TypeScript, run by Node through `tsx`. In a
new npm project (`npm init -y`), make the project one of ES modules -- the
packages are ES modules, and the program awaits at its top level -- and add
the tools it is built with, at the releases the install gate builds it
with:

```sh guide=node
npm pkg set type=module
npm install --save-dev typescript@~6.0.3 tsx@^4.20.3 @types/node@^22.10.0
```

and a `tsconfig.json` with the settings the gate type-checks it under --
strict, the library declaration files checked too, and Node's types:

```json
{
  "compilerOptions": {
    "strict": true,
    "exactOptionalPropertyTypes": true,
    "noUncheckedIndexedAccess": true,
    "skipLibCheck": false,
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "nodenext",
    "lib": ["ES2023"],
    "types": ["node"],
    "noEmit": true
  },
  "include": ["*.ts"]
}
```

Write the program in `quotation.ts`, check it with `npx tsc`, and run it
with `npx tsx quotation.ts`.

A report is a JSON document: what it prints, from which data, laid out how.
It names the data it reads -- one header record and one list of detail rows
-- as contracts with typed fields, and never says where the data comes
from. This one is a short quotation: a heading, a table of lines, a total
the runtime computes, and a footer with the page count. In `quotation.ts`:

```ts guide=node
import type { ReportData, ReportDefinition } from '@formancy/report-runtime'

/** Swiss francs to the centime, as every amount here prints. */
const chf = { kind: 'currency', currency: { kind: 'code', code: 'CHF' }, scale: 2 } as const

const quotation: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'quotation',
  title: 'Quotation',
  locale: 'en-CH',
  page: { size: 'A4', orientation: 'portrait', margins: { top: 56.69, right: 56.69, bottom: 56.69, left: 56.69 } },
  styles: [
    { id: 'title', size: 16, bold: true },
    { id: 'total', bold: true },
    { id: 'footer', size: 8, align: 'center' },
  ],
  datasets: {
    header: {
      id: 'quotation',
      fields: [
        { id: 'number', type: 'string', label: 'Number', nullable: false },
        { id: 'customer', type: 'string', label: 'Customer', nullable: false },
      ],
    },
    detail: {
      id: 'quotation-lines',
      fields: [
        { id: 'description', type: 'string', label: 'Description', nullable: false },
        { id: 'quantity', type: 'decimal', label: 'Quantity', nullable: false, scale: 2 },
        { id: 'amount', type: 'decimal', label: 'Amount', nullable: false, scale: 2 },
      ],
    },
  },
  parameters: [],
  assets: [],
  aggregates: [{ id: 'total', fn: 'sum', of: { kind: 'field', field: { dataset: 'detail', field: 'amount' } } }],
  regions: {
    reportHeader: [
      { id: 'heading', kind: 'text', style: 'title', content: [{ kind: 'text', text: 'Quotation ' }, { kind: 'field', field: { dataset: 'header', field: 'number' } }] },
      { id: 'for', kind: 'text', content: [{ kind: 'text', text: 'For ' }, { kind: 'field', field: { dataset: 'header', field: 'customer' } }] },
      { id: 'gap', kind: 'spacer', height: 12 },
    ],
    pageHeader: [],
    body: [
      {
        id: 'lines',
        kind: 'table',
        dataset: 'detail',
        columns: [
          { id: 'description', header: 'Description', width: 'fill', align: 'left', value: { kind: 'field', field: { dataset: 'detail', field: 'description' } } },
          { id: 'quantity', header: 'Quantity', width: 60, align: 'right', value: { kind: 'field', field: { dataset: 'detail', field: 'quantity' }, format: { kind: 'number', scale: 2, grouping: true } } },
          { id: 'amount', header: 'Amount', width: 90, align: 'right', value: { kind: 'field', field: { dataset: 'detail', field: 'amount' }, format: chf } },
        ],
        totals: [
          {
            cells: [
              { column: 'description', value: { kind: 'text', text: 'Total' } },
              { column: 'amount', value: { kind: 'aggregate', aggregate: 'total', over: 'report', format: chf } },
            ],
            style: 'total',
          },
        ],
        emptyText: 'No lines.',
        repeatHeader: true,
      },
    ],
    summary: [],
    pageFooter: [
      { id: 'page', kind: 'text', style: 'footer', content: [{ kind: 'text', text: 'Page ' }, { kind: 'pageNumber' }, { kind: 'text', text: ' of ' }, { kind: 'pageCount' }] },
    ],
  },
}

/** What your application hands over: the record and the rows, and what its query says of them. */
const data: ReportData = {
  header: { number: 'Q-2026-0042', customer: 'Muster AG' },
  detail: [
    { description: 'Maintenance, flat rate', quantity: '1.00', amount: '480.00' },
    { description: 'Filter F7', quantity: '6.00', amount: '231.00' },
    { description: 'Technician', quantity: '3.75', amount: '480.00' },
  ],
  completeness: { complete: true, captured: 3 },
  consistency: 'host-captured',
}
```

Exact numbers travel as strings, `'3.75'`, never as JavaScript numbers,
which have already lost digits by the time the runtime would see them; the
runtime computes the total exactly and rounds it once, as declared.
`completeness` says whether your query handed over every row, and
`consistency` how it read them -- here, captured by the host itself. A field
the report does not declare is refused: a report never carries what it
does not print
([report-runtime's README](../packages/report-runtime/README.md#the-data)).

Then, still in `quotation.ts`, resolve the report against the data, and
draw what the runtime resolved:

```ts guide=node
import { writeFile } from 'node:fs/promises'
import { resolveReport } from '@formancy/report-runtime'
import { renderPdf } from '@formancy/report-render-pdf'

const creationDate = new Date().toISOString()
const resolution = resolveReport(quotation, data, { mode: 'final', creationDate })
if (!resolution.ok) throw new Error(resolution.errors.map((error) => `${error.code} at ${error.path}`).join('; '))
const pdf = await renderPdf(resolution.document, { maxPages: 50 })
await writeFile('quotation.pdf', pdf)
```

`resolveReport` holds every value to its field's contract, evaluates the
report's expressions, computes the totals and formats each value for the
report's locale, once; nothing in it fetches anything. `renderPdf` draws the
result with pdfmake in Roboto. The creation date is yours to fix: the same
report, data and date print the same bytes, its images written in the
order pdfmake opened them however long each takes to decode
([0035](./decisions/0035-the-renderer-writes-the-images-pdfkit-decodes-in-the-order-pdfmake-opened-them.md)).
`maxPages` is required, and a
report that needs more is refused rather than cut short.

What it costs: pdfmake lays out a whole document in one synchronous pass on
the thread that calls it. The render yields between its passes, so an
`AbortSignal` passed as `signal` arrives, but a pass under way runs to its
end; a server that must stay responsive renders in a worker it can
terminate
([report-render-pdf's README](../packages/report-render-pdf/README.md#what-it-does-not-do)).

### When it will not print

Neither call ever returns part of a document. `resolveReport` gives every
reason at once, up to a bound, each with the `stage` that found it, a stable
`code`, a JSON Pointer `path` into what it read and a `message` for a
person, which never holds a value from your data. `renderPdf` rejects with a `RenderRefusal`
whose `code` is one of `REFUSAL_CODES`, each in
[the renderer's table](../packages/report-render-pdf/README.md#what-it-refuses),
and anything else it rejects with is a fault, not the report.

A **final** render is the report as it is kept and sent: it refuses data
your provider calls incomplete, and a field the data lacks. A **preview** is
what an author works against: it prints what it has, warns once for each
field it lacks in the resolution's `warnings`, says in its manifest that it
is a preview, and when the data is incomplete or lacks a field, heads every
page with a label that it is not the report. In `quotation.ts`:

```ts guide=node
import { PREVIEW_LABEL } from '@formancy/report-runtime'
import { RenderRefusal } from '@formancy/report-render-pdf'

// The same quotation, with the query stopped after two of its three lines.
const cut: ReportData = { ...data, detail: (data.detail ?? []).slice(0, 2), completeness: { complete: false, captured: 2 } }

const inFinal = resolveReport(quotation, cut, { mode: 'final', creationDate })
if (!inFinal.ok) for (const error of inFinal.errors) console.log(`final: refused, ${error.stage} ${error.code} at ${error.path}: ${error.message}`)

const inPreview = resolveReport(quotation, cut, { mode: 'preview', creationDate })
if (inPreview.ok) console.log(`preview: ${String(inPreview.manifest.completeness.captured)} lines, every page headed "${PREVIEW_LABEL}"`)

// A customer's name in a script Roboto, the one font a report's text prints in, has no glyphs for.
const named = resolveReport(quotation, { ...data, header: { ...data.header, customer: '山田商事' } }, { mode: 'final', creationDate })
if (named.ok) {
  await renderPdf(named.document, { maxPages: 50 }).catch((error: unknown) => {
    if (!(error instanceof RenderRefusal)) throw error
    console.log(`not drawn: ${error.code}, ${error.message}`)
  })
}
```

This prints:

```text guide=node
final: refused, data incomplete at /completeness/complete: the provider says the data is incomplete; a final render prints every row or none, and never a silently truncated report
preview: 2 lines, every page headed "Preview of incomplete data: not a final report"
not drawn: unsupported, body[1] prints U+5C71, which is in no script the renderer prints: it prints Latin, Greek and Cyrillic, with the punctuation, symbols and marks written with them, and lays out no right-to-left text, no shaped script and no CJK
```

The renderer names where it stopped as a place in the resolved document,
where the report's header comes first: `body[1]` is the line that names the
customer. A character of any script but Latin, Greek and Cyrillic is
refused by code point, since the renderer reorders and shapes nothing, even
in a font a host supplies; a character of those scripts a font simply
lacks is refused for that instead, naming the font ([0043](decisions/0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md)).

### An XRechnung: take the XML

**This needs the release after 0.2.0.** 0.2.0 refuses a report whose
e-invoice is of the kind `xrechnung`, as `unknown-kind`, and has no
`XRECHNUNG_COPY_LABEL`, so with the packages npm installs today this block
does not compile. The install gate compiles and runs it against the
packages this repository builds.

A report may carry an e-invoice, which the runtime writes as EN 16931's CII
XML from the very values its page prints. Of the kind `xrechnung` it is an
XRechnung 3.0, the invoice a German public buyer asks for: its XML is the
invoice, which your application takes from the resolved document and sends
-- to the federal portal, by email or over Peppol, as the buyer asks; the
packages send nothing. The PDF drawn from the same document is a copy, and
says so at the top of every page
([0038](./decisions/0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)).
An XRechnung needs what EN 16931 lets an invoice leave out: the business
process, the buyer's reference -- a public buyer's Leitweg-ID -- the payment
instructions, the seller's contact and both parties' electronic addresses.
Each total the XML holds is printed by the name the runtime binds it to,
`invoice`, `vatBasis` and `vatAmount`, or the report is refused. Still in
`quotation.ts`:

```ts guide=node
import { XRECHNUNG_COPY_LABEL } from '@formancy/report-runtime'

/** Euro to the cent, as every amount of an e-invoice prints. */
const eur = { kind: 'currency', currency: { kind: 'code', code: 'EUR' }, scale: 2 } as const
const said = (text: string) => [{ kind: 'text', text }] as const
const leitwegId = [{ kind: 'field', field: { dataset: 'header', field: 'leitwegId' } }] as const
const line = (field: string) => ({ kind: 'field', field: { dataset: 'detail', field } }) as const
const total = (id: string, label: string, cel: string) => ({ id, kind: 'text', content: [{ kind: 'text', text: label }, { kind: 'expression', expression: { cel }, format: eur }] }) as const

const rechnung: ReportDefinition = {
  reportSpecVersion: '0',
  id: 'rechnung',
  title: 'Rechnung',
  locale: 'de-DE',
  page: quotation.page,
  styles: [],
  datasets: {
    header: {
      id: 'rechnung',
      fields: [
        { id: 'number', type: 'string', label: 'Rechnungsnummer', nullable: false },
        { id: 'issuedOn', type: 'date', label: 'Rechnungsdatum', nullable: false },
        { id: 'servedOn', type: 'date', label: 'Leistungsdatum', nullable: false },
        { id: 'leitwegId', type: 'string', label: 'Leitweg-ID', nullable: false },
      ],
    },
    detail: {
      id: 'rechnung-lines',
      fields: [
        { id: 'position', type: 'integer', label: 'Position', nullable: false },
        { id: 'description', type: 'string', label: 'Leistung', nullable: false },
        { id: 'quantity', type: 'decimal', label: 'Menge', nullable: false, scale: 2 },
        { id: 'unit', type: 'string', label: 'Einheit (UN/ECE)', nullable: false },
        { id: 'price', type: 'decimal', label: 'Einzelpreis', nullable: false, scale: 2 },
        { id: 'amount', type: 'decimal', label: 'Betrag', nullable: false, scale: 2 },
      ],
    },
  },
  parameters: [],
  assets: [],
  aggregates: [],
  regions: {
    reportHeader: [{ id: 'heading', kind: 'text', content: [{ kind: 'text', text: 'Rechnung, Leitweg-ID ' }, ...leitwegId] }],
    pageHeader: [],
    body: [
      {
        id: 'lines',
        kind: 'table',
        dataset: 'detail',
        columns: [
          { id: 'description', header: 'Leistung', width: 'fill', align: 'left', value: line('description') },
          { id: 'quantity', header: 'Menge', width: 60, align: 'right', value: line('quantity') },
          { id: 'price', header: 'Einzelpreis', width: 80, align: 'right', value: { ...line('price'), format: eur } },
          { id: 'amount', header: 'Betrag', width: 80, align: 'right', value: { ...line('amount'), format: eur } },
        ],
        emptyText: 'Keine Positionen.',
        repeatHeader: true,
      },
    ],
    summary: [
      total('net', 'Nettobetrag ', 'invoice.taxBasisTotal'),
      total('basis', 'Umsatzsteuer 19 % auf ', 'vatBasis.standard'),
      total('vat', 'Umsatzsteuer 19 % ', 'vatAmount.standard'),
      total('tax', 'Umsatzsteuer gesamt ', 'invoice.taxTotal'),
      total('grand', 'Rechnungsbetrag ', 'invoice.grandTotal'),
    ],
    pageFooter: [],
  },
  eInvoice: {
    kind: 'xrechnung',
    version: '3.0',
    type: '380',
    currency: 'EUR',
    number: [{ kind: 'field', field: { dataset: 'header', field: 'number' } }],
    issued: { cel: 'header.issuedOn' },
    delivered: { cel: 'header.servedOn' },
    businessProcess: said('urn:fdc:peppol.eu:2017:poacc:billing:01:1.0'),
    buyerReference: leitwegId,
    seller: {
      name: said('Muster Haustechnik GmbH'),
      vatId: said('DE123456789'),
      electronicAddress: { id: said('rechnung@haustechnik.example'), scheme: 'EM' },
      contact: { name: said('Erika Mustermann'), telephone: said('+49 221 4710 820'), email: said('e.mustermann@haustechnik.example') },
      address: { line1: said('Industriestraße 7'), postalCode: said('50735'), city: said('Köln'), country: said('DE') },
    },
    buyer: {
      name: said('Bundesamt für Beispielwesen'),
      electronicAddress: { id: leitwegId, scheme: '0204' },
      address: { line1: said('Beispielweg 12'), postalCode: said('53113'), city: said('Bonn'), country: said('DE') },
    },
    vat: [{ id: 'standard', code: 'S', rate: '19' }],
    lines: { table: 'lines', name: 'description', quantity: 'quantity', netPrice: 'price', netAmount: 'amount', id: line('position'), unit: line('unit'), vat: { kind: 'expression', expression: { cel: '"standard"' } } },
    payment: { means: '58', iban: said('DE83 0123 4567 0012 3456 78') },
  },
}

const invoiceData: ReportData = {
  header: { number: 'RE-2026-0101', issuedOn: '2026-10-20', servedOn: '2026-10-14', leitwegId: '991-33333TEST-33' },
  detail: [
    { position: '1', description: 'Wartung Gas-Brennwertkessel', quantity: '1.00', unit: 'LS', price: '245.00', amount: '245.00' },
    { position: '2', description: 'Arbeitszeit Techniker', quantity: '2.50', unit: 'HUR', price: '76.00', amount: '190.00' },
  ],
  completeness: { complete: true, captured: 2 },
  consistency: 'host-captured',
}

const invoiced = resolveReport(rechnung, invoiceData, { mode: 'final', creationDate })
if (!invoiced.ok) throw new Error(invoiced.errors.map((error) => `${error.code} at ${error.path}: ${error.message}`).join('; '))
const { eInvoice } = invoiced.document
if (eInvoice?.kind !== 'xrechnung') throw new Error('a final render of an XRechnung carries its XML')
// The invoice: send these bytes, as UTF-8, to the buyer.
await writeFile('rechnung.xml', eInvoice.xml)
console.log(`XRechnung ${eInvoice.version} in ${eInvoice.syntax.toUpperCase()}, ${eInvoice.guideline}: rechnung.xml is the invoice`)
// Its copy, for your records or a person's eyes.
await writeFile('rechnung.pdf', await renderPdf(invoiced.document, { maxPages: 50 }))
console.log(`rechnung.pdf is its copy, every page headed "${XRECHNUNG_COPY_LABEL}"`)
```

This prints:

```text guide=node
XRechnung 3.0 in CII, urn:cen.eu:en16931:2017#compliant#urn:xeinkauf.de:kosit:xrechnung_3.0: rechnung.xml is the invoice
rechnung.pdf is its copy, every page headed "Copy of an XRechnung: the invoice is its XML, and this PDF is not the invoice"
```

`991-33333TEST-33` is a Leitweg-ID of KoSIT's own test suite: under the
scheme `0204` an electronic address is one, and its check digits are held
to ISO/IEC 7064 MOD 97-10, which neither validator the repository's
e-invoice gate runs checks. A preview writes no XML, as for every
e-invoice. What the e-invoice holds and refuses -- a `#`-led line in an
XRechnung's payment terms among it, since XRechnung reads one as its own
Skonto syntax -- is in
[report-spec's README](../packages/report-spec/README.md#an-xrechnung).

## 3. Render in the browser

The browser has the same renderer under another entry point,
`@formancy/report-render-pdf/browser`: the same `renderPdf`, the same
refusals and the same pages. What differs is pdfmake's build and where the
fonts come from: pdfmake's browser build, with Roboto from pdfmake's
`vfs_fonts.js`, the four font files as base64 inside a script, so the page's
bundle carries them. A report with a Swiss QR-bill prints its slip in
Liberation Sans, and one with an EPC QR code in Austria's frame its
caption, which the entry imports from a chunk of its own the first time a
document has either, so a bundler that splits dynamic imports keeps it out
of a page that prints neither. Nothing in it touches a file system or
follows an address.

In `print.ts`, a preview prints the report against sample data, with the
approved assets -- a logo -- that the page hands over. The runtime asks
`images` for each asset the report names, by its id and the digest it was
approved by, and refuses the report as `missing-asset` when the answer is
nothing; it never fetches one:

```ts guide=react file=print.ts
import { resolveReport } from '@formancy/report-runtime'
import type { ImageResolver, ReportData, ReportDefinition } from '@formancy/report-runtime'
import { renderPdf } from '@formancy/report-render-pdf/browser'

/**
 * `report` printed in the page against `sample`, as a preview, with the
 * approved assets `images` hands over: what the sample lacks is labelled on
 * every page rather than refused. Rejects with the runtime's reasons, or
 * with the renderer's RenderRefusal.
 */
export async function printPreview(report: ReportDefinition, sample: ReportData, images: ImageResolver, signal: AbortSignal): Promise<Uint8Array> {
  const resolution = resolveReport(report, sample, { mode: 'preview', images, creationDate: new Date().toISOString() })
  if (!resolution.ok) throw new Error(resolution.errors.map((error) => error.message).join('; '))
  return renderPdf(resolution.document, { maxPages: 40, signal })
}
```

What it costs: the render runs on the page's own thread, so a long report
holds the tab for each of pdfmake's passes. The page bound is yours to
choose: a report that needs more pages is refused as `too-many-pages`, and
one whose least height already needs more is refused before pdfmake lays
out anything. The bytes are the other cost. In the Studio's production
build of 17 October 2026, the chunk holding the runtime and the renderer's
browser entry, pdfmake and its fonts and uqr, the QR code encoder, among
them, was 1,922 kB and 849 kB gzipped, as Vite reported it; the Studio
loads that chunk with the first preview, through `import()`, rather than
with the page. Liberation Sans's chunk was 1,100 kB and 519 kB gzipped,
loaded with the first preview of a report with a bill and never
otherwise.

**Showing the PDF is the page's choice.** Section 4 hands the bytes to the
browser's own viewer in an `<iframe>`; a download link takes the same bytes.
The Studio draws each page with PDF.js instead, and that viewer is not
published: `pdfjs-dist` ships a font under GPL-2.0 with a font exception,
which the dependency rule refuses in a published package
([0006](./decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)),
so it stays inside the private Studio until there is a reviewed exception
for that font or a viewer that leaves `pdfjs-dist` to the host
([0013](./decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)).
A page that wants PDF.js brings its own.

## 4. Embed the editor in React

The editor works on a **session**: `report-core`'s, which holds the document
and its undo history and commits only what the validator accepts. Over it
sits an **editor**, one person's view of the session -- the selection, the
zoom, the language of the editor's own words -- which the builder draws.
The same two, in `editor.ts`, open a report for the Angular page in section
5:

```ts guide=react,angular file=editor.ts
import { openReportSession } from '@formancy/report-core'
import type { ReportSession } from '@formancy/report-core'
import { createReportEditor } from '@formancy/report-builder-core'
import type { ImageStore, ReportEditor } from '@formancy/report-builder-core'

export interface OpenedEditor {
  readonly session: ReportSession
  readonly editor: ReportEditor
}

/** A session over a stored report and an editor over the session, in English; a report the validator refuses is not opened. Given an image store, the builder offers Add image…. */
export function openEditor(stored: unknown, images?: ImageStore): OpenedEditor {
  const opening = openReportSession(stored)
  if (!opening.ok) throw new Error(opening.errors.map((error) => `${error.code} at ${error.path}`).join('; '))
  return { session: opening.session, editor: createReportEditor(opening.session, { locale: 'en', ...(images === undefined ? {} : { images }) }) }
}
```

The preview follows the session. It prints at once, and again once the
author pauses; a print the next edit overtakes is aborted through its
signal, which `renderPdf` reads between its passes, and its PDF is never
shown, so the preview never shows an older document after a newer one.
`preview.ts` has no framework in it:

```ts guide=react file=preview.ts
import type { ReportSession } from '@formancy/report-core'
import type { ReportDefinition } from '@formancy/report-runtime'

/** What prints a report for the preview: printPreview bound to sample data and the approved assets, or a request to your server that passes the signal to fetch. */
export type Print = (report: ReportDefinition, signal: AbortSignal) => Promise<Uint8Array>

/** The latest preview: the PDF, or why it was not printed. */
export type Preview = { readonly pdf: Uint8Array } | { readonly refused: string }

/** Prints the session's document now, and again once edits pause for `delay` milliseconds. Returns the function that stops it. */
export function keepPreviewing(session: ReportSession, print: Print, show: (preview: Preview) => void, delay = 400): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined
  let running: AbortController | undefined
  const start = (): void => {
    const controller = new AbortController()
    running = controller
    print(session.document(), controller.signal).then(
      (pdf) => {
        if (!controller.signal.aborted) show({ pdf })
      },
      (error: unknown) => {
        if (!controller.signal.aborted) show({ refused: error instanceof Error ? error.message : String(error) })
      },
    )
  }
  const unsubscribe = session.subscribe(() => {
    clearTimeout(timer)
    running?.abort()
    timer = setTimeout(start, delay)
  })
  start()
  return () => {
    unsubscribe()
    clearTimeout(timer)
    running?.abort()
  }
}
```

The page draws the builder, a Save button and the preview.
`<ReportBuilder editor={editor} />` needs no prop but the editor and fills
its container, so the page gives `.report-page` a height. The session's `hash()` names the
document and stays the same until an edit, and the same again once that
edit is undone, so Save is offered only when there is something to save,
and not while a save is in flight, so a second press cannot go out from the
revision the first is about to replace; the page marks the document saved
only when `save` answers `true`, so a save that was refused leaves Save
offered;
`exportDocument()` is a deep copy of the document, safe to hand to anything.
Undo and redo are the builder's -- its toolbar, and Ctrl+Z and Ctrl+Y -- and
act on the session's history, which outlives the builder; a control of the
page's own sends `editor.dispatch({ type: 'undo' })`. The page, in
`report-page.tsx`:

```tsx guide=react
import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import type { ReactElement } from 'react'
import { ReportBuilder } from '@formancy/report-builder-react'
import type { ReportDefinition } from '@formancy/report-runtime'
import type { OpenedEditor } from './editor.js'
import { keepPreviewing } from './preview.js'
import type { Preview, Print } from './preview.js'

export interface ReportPageProps {
  readonly opened: OpenedEditor
  /** The same function on every render: a new one starts the preview again. */
  readonly print: Print
  /** Answers whether the report was saved; the page marks it saved only on `true`. An answer of `false` is the host's to show. */
  readonly save: (report: ReportDefinition) => boolean | Promise<boolean>
}

export function ReportPage({ opened: { session, editor }, print, save }: ReportPageProps): ReactElement {
  const hash = useSyncExternalStore(session.subscribe, session.hash, session.hash)
  const [saved, setSaved] = useState(hash)
  const [saving, setSaving] = useState(false)
  const [preview, setPreview] = useState<Preview>()
  useEffect(() => keepPreviewing(session, print, setPreview), [session, print])

  const onSave = (): void => {
    const sent = hash
    setSaving(true)
    void Promise.resolve(save(session.exportDocument())).then(
      (answer) => {
        setSaving(false)
        if (answer) setSaved(sent)
      },
      () => setSaving(false),
    )
  }
  return (
    <div className="report-page">
      <ReportBuilder editor={editor} />
      <button type="button" disabled={hash === saved || saving} onClick={onSave}>
        Save
      </button>
      {preview === undefined ? null : 'pdf' in preview ? <PdfFrame pdf={preview.pdf} /> : <p role="alert">{preview.refused}</p>}
    </div>
  )
}

/** The browser's own viewer, over a copy of the PDF's bytes, let go of when the next one replaces it. */
function PdfFrame({ pdf }: { readonly pdf: Uint8Array }): ReactElement {
  const url = useMemo(() => URL.createObjectURL(new Blob([pdf.slice().buffer], { type: 'application/pdf' })), [pdf])
  useEffect(() => () => URL.revokeObjectURL(url), [url])
  return <iframe title="Preview" src={url} />
}
```

The page's entry imports the two stylesheets, opens the stored report and
mounts the page. The routes it fetches are your server's: where the report
is stored, the sample it previews against, and the assets approved for the
report, each with the digest it was approved by and its bytes as base64.
The lookup hands an asset over only at the digest the report declares, so
a report that names one the server did not send is refused in the preview
as `missing-asset`, naming it. In `main.tsx`:

```tsx guide=react file=main.tsx
import '@formancy/themes/workbench.css'
import '@formancy/report-builder-core/report-builder.css'
import { createRoot } from 'react-dom/client'
import type { ImageBytes, ImageResolver, ReportData, ReportDefinition } from '@formancy/report-runtime'
import { openEditor } from './editor.js'
import { ReportPage } from './report-page.js'
import type { Print } from './preview.js'
import { printPreview } from './print.js'

/** An asset approved for the report, as your server sends it: its id, the digest it was approved by, its media type and its bytes as base64. */
interface ApprovedAsset {
  readonly asset: string
  readonly digest: string
  readonly mediaType: ImageBytes['mediaType']
  readonly base64: string
}

const stored: unknown = await (await fetch('/reports/quotation')).json()
const sample = (await (await fetch('/reports/quotation/sample')).json()) as ReportData
const sent = (await (await fetch('/reports/quotation/assets')).json()) as readonly ApprovedAsset[]
const approved = sent.map((each) => ({ ...each, bytes: Uint8Array.from(atob(each.base64), (char) => char.charCodeAt(0)) }))

const opened = openEditor(stored)
const images: ImageResolver = (ref) => approved.find((each) => each.asset === ref.asset && each.digest === ref.digest)
const print: Print = (report, signal) => printPreview(report, sample, images, signal)
const save = (report: ReportDefinition): boolean => {
  void fetch('/reports/quotation', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report) })
  return true
}

const root = document.getElementById('report')
if (root === null) throw new Error('the page has no element with the id report')
createRoot(root).render(<ReportPage opened={opened} print={print} save={save} />)
```

TypeScript 6 checks that an import made for its effect resolves, and a
stylesheet is no module it resolves: without a declaration, the two imports
above are error TS2882. A bundler's client types declare `*.css` -- Vite's
`vite/client` does -- and a project without them declares
`declare module '*.css'` itself, as the install gate's React project does.

The page made the editor, so the page disposes of it, with
`editor.dispose()`, once no builder shows it; the builder only listens. A
report the page saves is untrusted when it comes back to your server:
section 7 reads one before anything prints it.

What it costs: every committed edit diagnoses the whole report again, and
the preview prints the whole report after every pause; neither is measured
yet. The builder's design view is a sketch for selecting and placing, not
the PDF, and says so by its name
([report-builder-core's README](../packages/report-builder-core/README.md#what-it-does-not-do)).

## 5. Embed the editor in Angular

The Angular builder is a standalone component, `<report-builder
[editor]="editor" />`, with signals and `OnPush`. It provides nothing of its
own and needs no zone.js: the page provides change detection without it,
which is all the builder needs. Its editor is opened by section 4's
`openEditor`: the session and the editor are the same packages' as the
React builder draws, and one session can carry both builders -- the Studio
switches between them over it
([0012](./decisions/0012-the-builders-are-native-and-share-one-session.md)).
The page, in `report-page.ts`:

```ts guide=angular
import { Component, input, output, provideZonelessChangeDetection } from '@angular/core'
import type { ApplicationConfig } from '@angular/core'
import { ReportBuilder } from '@formancy/report-builder-angular'
import type { ReportDefinition } from '@formancy/report-spec'
import type { OpenedEditor } from './editor.js'

export const appConfig: ApplicationConfig = { providers: [provideZonelessChangeDetection()] }

@Component({
  selector: 'app-report-page',
  imports: [ReportBuilder],
  template: `
    <report-builder [editor]="opened().editor" />
    <button type="button" (click)="save()">Save</button>
  `,
})
export class ReportPage {
  readonly opened = input.required<OpenedEditor>()
  readonly saved = output<ReportDefinition>()

  protected save(): void {
    this.saved.emit(this.opened().session.exportDocument())
  }
}
```

The application, in `main.ts`, loads the stored report and hands the page
its editor; a signal set from the response is what tells change detection
to run:

```ts guide=angular file=main.ts
import { Component, signal } from '@angular/core'
import { bootstrapApplication } from '@angular/platform-browser'
import type { ReportDefinition } from '@formancy/report-spec'
import { openEditor } from './editor.js'
import type { OpenedEditor } from './editor.js'
import { appConfig, ReportPage } from './report-page.js'

@Component({
  selector: 'app-root',
  imports: [ReportPage],
  template: `
    @if (opened(); as editing) {
      <app-report-page [opened]="editing" (saved)="save($event)" />
    }
  `,
})
class App {
  protected readonly opened = signal<OpenedEditor | undefined>(undefined)

  constructor() {
    void fetch('/reports/quotation')
      .then((response) => response.json())
      .then((stored: unknown) => this.opened.set(openEditor(stored)))
  }

  protected save(report: ReportDefinition): void {
    void fetch('/reports/quotation', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(report) })
  }
}

bootstrapApplication(App, appConfig).catch((error: unknown) => console.error(error))
```

The stylesheets go in the build's `styles`, the workbench's first. The
install gate builds no `angular.json`, so nothing checks these lines:

```json
"styles": [
  "node_modules/@formancy/themes/workbench.css",
  "node_modules/@formancy/report-builder-core/report-builder.css"
]
```

The preview of section 4 is not Angular's yet in this guide:
`keepPreviewing` has no framework in it, and an Angular page would start it
in an `effect` and stop it in the effect's cleanup, but no block here does,
so nothing has run it in Angular.

## 6. Keep the draft on Report's server

Section 4's page saves to routes that are yours. `@formancy/report-server`
keeps a template's draft and the images it declares for you, and
`@formancy/report-client` is what a page calls it with
([its README](../packages/report-client/README.md#save-and-reopen-a-draft)).
The code below is a React host's browser code, written for a server whose
address and token your page is given; the install gate type-checks it
against the DOM's types and bundles it, and starts no server, so what
follows is checked to compile and not run.

A draft is saved **from a revision**: the one the page opened, or the one
its last save answered. A save from a revision that is no longer the
newest is refused `draft-changed`, with the revision that stands, and
writes nothing, so two authors never overwrite each other unseen. The
client answers a refusal and never throws it; what it throws is what no
request could carry as it means it, such as a token no bearer header
carries.

**The images.** The runtime's `AssetResolver` is synchronous, so it cannot
ask the server for a PNG while a preview prints. The page keeps a cache the
resolver reads from, in `images.ts`, and fills it from both ends: opening a
draft reads every image it declares, and an image a person adds is kept on
the server, then put in the cache, before `keep` resolves, which is when
the builder declares the asset and the preview renders (0033). It does not
read the fonts a report may declare, which the client's `readImage` does
not answer for; a report that prints in a font of its own is refused in the
preview as `missing-asset` until your page resolves it as section 4's
lookup does.

```ts guide=react file=images.ts
import type { ReportClient } from '@formancy/report-client'
import type { ImageStore } from '@formancy/report-builder-core'
import type { AssetResolver, ImageBytes, ReportDefinition } from '@formancy/report-runtime'

export interface ImageCache {
  /** What the preview resolves from, answering for an image only at the digest the report declares. */
  readonly resolve: AssetResolver
  /** What the editor keeps an added image through. */
  readonly store: ImageStore
  /** Reads every image `report` declares that the cache does not hold; throws when the server will not give one. */
  load(report: ReportDefinition): Promise<void>
}

export function createImageCache(reports: ReportClient): ImageCache {
  const held = new Map<string, ImageBytes>()
  return {
    resolve: (ref) => held.get(ref.digest),
    store: {
      async keep(image) {
        const kept = await reports.keepImage(image.bytes, image.digest, image.mediaType)
        if (!kept.ok) return { ok: false, message: kept.refusal.message }
        held.set(image.digest, { mediaType: image.mediaType, bytes: image.bytes })
        return { ok: true }
      },
    },
    async load(report) {
      for (const asset of report.assets) {
        if (!asset.mediaType.startsWith('image/') || held.has(asset.digest)) continue
        const read = await reports.readImage(asset.digest)
        if (!read.ok) throw new Error(`the image ${asset.id} was not read: ${read.refusal.code}`)
        held.set(asset.digest, read.value)
      }
    },
  }
}
```

**The draft.** `openDraft`, in `drafts.ts`, reads the newest draft, fills the
cache, and opens it with section 4's `openEditor`, given the cache's store
so that the builder offers Add image…. The `KeptDraft` it answers holds the
revision as a closure, so a save that succeeds moves it and the next save
is from there; a save the server refused leaves it where it was.

```ts guide=react file=drafts.ts
import type { ReportClient } from '@formancy/report-client'
import { openEditor } from './editor.js'
import type { OpenedEditor } from './editor.js'
import type { ImageCache } from './images.js'

/** What a save came to: the revision it wrote, someone else's save in between, or a refusal the author is told of. */
export type SaveOutcome =
  | { readonly kind: 'saved'; readonly revision: number }
  | { readonly kind: 'changed'; readonly message: string }
  | { readonly kind: 'refused'; readonly message: string }

export interface KeptDraft {
  readonly opened: OpenedEditor
  /** Saves the session's document from the revision this draft was opened at, or last saved at. */
  save(): Promise<SaveOutcome>
}

/** The template's newest draft, its images read, opened in a new session. Call it again to reload; it never touches a session that is open. */
export async function openDraft(reports: ReportClient, images: ImageCache, template: string): Promise<KeptDraft> {
  const read = await reports.readDraft(template)
  if (!read.ok) throw new Error(`the draft was not read: ${read.refusal.code}`)
  await images.load(read.value.report)
  const opened = openEditor(read.value.report, images.store)
  let revision = read.value.revision
  return {
    opened,
    async save() {
      const answer = await reports.saveDraft(template, opened.session.exportDocument(), revision)
      if (answer.ok) {
        revision = answer.value.revision
        return { kind: 'saved', revision }
      }
      if (answer.refusal.code === 'draft-changed') return { kind: 'changed', message: 'Someone saved this template since you opened it. Reload to read their draft; yours is not saved.' }
      return { kind: 'refused', message: answer.refusal.message }
    },
  }
}
```

**A conflict, and a reload.** On `changed`, show the message and offer a
reload, which is `openDraft` again and the new `KeptDraft`'s `opened` in
the page's place: dispose of the old editor with `editor.dispose()` once no
builder shows it, as section 4 says. A reload opens a **new session**; it
never replaces the document of the old one, because the old session's undo
history would still be there, and an undo would bring back the text the
reload had just replaced, as an edit the author made. A new session has
no history, so there is nothing to undo past what the server holds. What
the reload costs is the author's unsaved edits, which the message says; the
page can keep `exportDocument()` of the old session aside first if it
means to offer them back.

**The page that composes them.** `draft-host.tsx` makes the client from the
server's address and the token function your page is given, opens the
draft, and renders section 4's `ReportPage` with the draft's `save` and the
cache's `resolve`, which the preview prints with. Save answers `true` only
when the server wrote the revision. For `changed` and `refused` it answers
`false`, which leaves Save offered, and the host shows the outcome's
message in an alert; it always offers Reload, which is `openDraft`
again, the new `KeptDraft` taking the old one's place and the old editor
disposed of. Nothing uses the old `KeptDraft` after that. A save that
throws, such as a token no bearer header carries, is not an answer: the
page leaves Save offered and shows nothing, so a host whose `token` can
fail catches it in its own `save`.

```tsx guide=react file=draft-host.tsx
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { createReportClient } from '@formancy/report-client'
import type { ReportData, ReportDefinition } from '@formancy/report-runtime'
import { openDraft } from './drafts.js'
import type { KeptDraft } from './drafts.js'
import { createImageCache } from './images.js'
import type { Print } from './preview.js'
import { printPreview } from './print.js'
import { ReportPage } from './report-page.js'

export interface DraftHostProps {
  /** The report server's base URL. */
  readonly server: string
  /** The host's current token, asked before every request. A new function on every render is fine: the latest one is asked, and nothing is opened again for it. */
  readonly token: () => string | Promise<string>
  readonly template: string
  /** The data the preview prints against, as in section 3. */
  readonly sample: ReportData
}

export function DraftHost({ server, token, template, sample }: DraftHostProps): ReactElement {
  const asking = useRef(token)
  asking.current = token
  // Once per server: a client made again would open the draft again, and dispose the editor that holds the author's unsaved edits.
  const { reports, images } = useMemo(() => {
    const client = createReportClient({ server, token: () => asking.current() })
    return { reports: client, images: createImageCache(client) }
  }, [server])
  const opens = useRef(0)
  const [kept, setKept] = useState<{ readonly draft: KeptDraft; readonly open: number }>()
  const [notice, setNotice] = useState<string>()
  const [reloads, setReloads] = useState(0)
  const print = useMemo<Print>(() => (report, signal) => printPreview(report, sample, images.resolve, signal), [images, sample])

  // Opens the draft, and again when Reload bumps `reloads`; each open is a new session.
  useEffect(() => {
    let current = true
    openDraft(reports, images, template).then(
      (next) => {
        if (!current) return next.opened.editor.dispose()
        opens.current += 1
        setKept({ draft: next, open: opens.current })
        setNotice(undefined)
      },
      (error: unknown) => {
        if (current) setNotice(error instanceof Error ? error.message : String(error))
      },
    )
    return () => {
      current = false
    }
  }, [reports, images, template, reloads])
  // The editor the page made is the page's to dispose of, once no builder shows it.
  useEffect(() => (kept === undefined ? undefined : () => kept.draft.opened.editor.dispose()), [kept])

  if (kept === undefined) return notice === undefined ? <p>Opening the draft</p> : <p role="alert">{notice}</p>
  const save = async (_report: ReportDefinition): Promise<boolean> => {
    const outcome = await kept.draft.save()
    if (outcome.kind === 'saved') {
      setNotice(undefined)
      return true
    }
    setNotice(outcome.message)
    return false
  }
  return (
    <>
      {/* Keyed to the open: the page seeds what it has saved from the session it is given, once. */}
      <ReportPage key={kept.open} opened={kept.draft.opened} print={print} save={save} />
      {notice === undefined ? null : <p role="alert">{notice}</p>}
      <button type="button" onClick={() => setReloads(reloads + 1)}>
        Reload
      </button>
    </>
  )
}
```

`ReportPage` is keyed to each open, because it seeds what it has saved from
the session it is first given: without the key, a reload would leave Save
offered over a document the server already holds. The client and the cache
are made once per `server`, and the token is read through a ref, so a
`token` written inline in a parent's render is the latest one asked and
never reopens the draft, which would dispose the editor that holds
unsaved edits.

The `save` of the page is given the report it exports and ignores it, since
the `KeptDraft` exports the session's document itself, at the moment it
sends. Reload is always offered here, and it costs the author's unsaved
edits, as above.

## 7. Validate and diagnose a stored report

A report that comes back from storage, or from the editor's Save, is
untrusted until it is read. `validateReport` takes anything and never
throws: it gives the report, read once and sharing nothing with its input,
or the reasons it is not one, up to a bound it says it reached. `diagnose`
then says what the editor's problems pane says, errors first: an **error**
is a report the runtime will refuse to print, and a **warning** something an
author probably did not mean, which prints as written. They are the same
checks, so the editor and the runtime cannot disagree about a report. At
the end of `quotation.ts`:

```ts guide=node
import { validateReport } from '@formancy/report-spec'
import { diagnose } from '@formancy/report-core'

/** Why a stored report would not print as written: the validator's reasons, or the diagnostics, errors first; none when it prints. */
function problemsOf(stored: string): string[] {
  const validation = validateReport(JSON.parse(stored))
  if (!validation.valid) return validation.errors.map((error) => `refused, ${error.code} at ${error.path}: ${error.message}`)
  return diagnose(validation.report).map((problem) => `${problem.severity}, ${problem.code} at ${problem.path}: ${problem.message}`)
}

const clock = { id: 'printed', kind: 'text', content: [{ kind: 'expression', expression: { cel: 'string(now())' } }] }
const stored = {
  'as written': JSON.stringify(quotation),
  'of a later version': JSON.stringify({ ...quotation, reportSpecVersion: '1' }),
  'printing the clock': JSON.stringify({ ...quotation, regions: { ...quotation.regions, summary: [clock] } }),
}
for (const [name, text] of Object.entries(stored)) {
  const problems = problemsOf(text)
  console.log(`${name}: ${problems.length === 0 ? 'prints' : problems.join('; ')}`)
}
```

This prints:

```text guide=node
as written: prints
of a later version: refused, unsupported-version at /reportSpecVersion: reportSpecVersion "1" is not one this package reads; it reads "0"
printing the clock: error, expression-not-reproducible at /regions/summary/0/content/0/expression/cel: now() differs from one render to the next, and a report prints the same from the same data; a date the report needs is a parameter
```

**The version line.** Every report says which version of the format it is
written in, `reportSpecVersion`, independent of every package's version. It
is `'0'`, the draft: nothing written under it is promised to be read by a
later release. A report of a version the packages do not read is refused,
never partly read, because a field this version does not know could be the
one that hides a row or changes a total
([0004](./decisions/0004-three-version-lines-each-refused-when-unknown.md)).
The first release that freezes the format makes it `'1'`.

## Where to go next

- **The Studio**, in a checkout of this repository: `pnpm build`, then
  `pnpm --filter @formancy/report-studio dev`. It opens the starter
  reports, and a blank one, in either builder over one session, beside the
  PDF the session prints ([README](../README.md#the-studio)).
- **Your data from Formancy Data**: `@formancy/report-data-provider` reads
  a report's header and lines from a Formancy Data 0.1.0 server, as the
  person whose token your page holds, labelled best-effort. Running it in
  production needs a Data licence too
  ([its README](../packages/report-data-provider/README.md#read-a-reports-data)).
- **Your data from a formancy form**: `@formancy/report-forms` reads a
  report's header and rows from a submission of a formancy form, against
  the exact version that collected it, which your application keeps and
  hands over, and nothing it reads is fetched
  ([its README](../packages/report-forms/README.md#read-a-submission)); and
  it starts a report from a form version, a first draft bound to that
  version's submissions, with notes of what it left out and assumed
  ([Start a report from a form](../packages/report-forms/README.md#start-a-report-from-a-form)).
- **A server that knows who is asking**: `@formancy/report-server`
  verifies your application's token, takes the person's tenant from a
  claim every token carries, and says what their roles allow; it stores
  nothing yet, and running it in production needs a Formancy Data licence
  too ([its README](../packages/report-server/README.md#settings)).
- **The package READMEs**, for everything this guide leaves out: the
  commands that edit a report as data, the expressions, groups and formats,
  the builders' keyboard and what each one renders.
- **The decision records**, [`docs/decisions/`](./decisions/README.md),
  for why each thing is the way it is and what holds it.
- **The known limitations**, in the release report every CI run produces
  and every release attaches: those the run shows, and those the decision
  records state ([`docs/release/`](./release/README.md),
  [`limitations.json`](./release/limitations.json)).
