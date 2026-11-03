# @formancy/report-documents

Formancy Report's one PDF reader. The runtime, the renderer, the server and
the builders read a PDF through this package and no other code. No framework,
no Node, no DOM and no network: ES2023's library and no `@types/node`.

So far it knows one thing, whether bytes are a PDF.

```ts
import { PDF_MEDIA_TYPE, isPdf } from '@formancy/report-documents'

isPdf(new TextEncoder().encode('%PDF-1.7\n')) // true: PDF_MEDIA_TYPE, 'application/pdf'
```

`isPdf` takes `%PDF-1.` or `%PDF-2.` and a digit at the first byte, and
nothing before it: a file whose header sits past other bytes is one a viewer
may open and the strict reader refuses, so it is never called a PDF.

It depends on `@pdfme/pdf-lib` at exactly 6.2.4 and `pako` at exactly 3.0.2,
which later reading arrives with. The package declares the source-available
licence, in `LICENSE.md`.
