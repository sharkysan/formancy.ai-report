# @formancy/report-documents

Formancy Report's one PDF reader
([0054](../../docs/decisions/0054-a-pdf-is-read-by-one-reader-of-its-own-which-refuses-what-it-cannot-bound.md)).
The runtime, the renderer, the server and the builders are to read a PDF
through this package and no other code; nothing calls it yet. No framework,
no Node, no DOM and no network: ES2023's library and no `@types/node`.

```ts
import { readDocument } from '@formancy/report-documents'

const read = readDocument(bytes) // a Uint8Array of this realm
if (read.ok) {
  read.document.pages // each page in the order it prints: its box, rotation, content, resources, appearances
  read.document.objects // every object the pages draw with, by number
  read.document.notices // what does not survive printing, a count of each kind: [{ code: 'links', count: 2 }]
} else {
  read.code // one of DOCUMENT_REFUSAL_CODES, such as 'encrypted' or 'optional-content'
  read.message // what was found, then what to do, in English; never a byte of the file
}
```

`readDocument` reads a PDF's bytes whole, or refuses them:

- **Synchronous, and never a throw.** Anything thrown while it reads is a
  refusal in its own words.
- **A refusal names a place, never content.** Its message is one of the
  reader's fixed findings, then the code's advice; `page` and `annotation`
  are the reader's own counts, from 1. No name, string, offset or object
  number the file wrote is in it.
- **Bounded before the work.** Every bound is a `MAX_DOCUMENT_*` constant,
  checked before what it bounds, and written in `src/limits.ts` with how it
  was measured, at it and one past it.
- **What prints is what a viewer shows.** A shadowed revision, optional
  content, XFA, NeedAppearances, an annotation that would print otherwise
  and an inline image PDF.js would end elsewhere are refused.
- **The bytes are the host's own.** A Uint8Array of the host's realm,
  copied before a byte is read; an ArrayBuffer, a Proxy, or an iframe's or
  a vm's array is refused as `not-pdf`, and a host copies another realm's
  bytes into its own first. What it returns is frozen where JavaScript
  freezes, and every byte array in it is a view of the read's own copy: a
  host never writes to one or reads past it.
- **No parser type leaves it.** The objects are the package's own model
  (`PdfValue`, `PdfDict`, `PdfStream`, ...).

`isPdf` says whether bytes are a PDF by their header alone: `%PDF-1.` or
`%PDF-2.` and a digit at the first byte, and nothing before it, since a file
whose header sits past other bytes is one a viewer may open and the reader
refuses.

It depends on `@pdfme/pdf-lib` at exactly 6.2.4, whose object grammar it
drives with every token read by its own code, and `pako` at exactly 3.0.2,
which inflates its streams. The package declares the source-available
licence, in `LICENSE.md`.
