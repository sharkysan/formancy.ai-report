# 3. Context and scope

## Business context

```
                          ┌─────────────────────────────────┐
   report author ────────▶│                                 │
   (a builder, in the     │         Formancy Report         │
    host's own page)      │                                 │
                          │  format · editing core          │──▶ a PDF ──▶ its reader
   integrator ───────────▶│  runtime · renderer             │              (and a bank,
   (npm packages)         │  editor model · two builders    │               for a payment
                          │  Data provider                  │               code)
                          └───────┬─────────────────┬───────┘
                                  ▲                 │ optional
                                  │                 ▼
                    the host's data and      Formancy Data 0.1.0
                    approved asset bytes     records, read as the person
                                             whose token the host holds
```

| Party | Exchanges |
|---|---|
| **Report author** | Edits a report in a builder the host mounts. Receives a refused edit's reason and every diagnostic where the thing it is about stands ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md), [0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)) |
| **Integrator** | Opens the session and the editor, and disposes what it made. Hands the runtime the data, the parameters and an image lookup it has already authorised. Receives a document, its manifest and a preview's warnings, then a PDF; or every reason there is none ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md), [0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)) |
| **Formancy Data** | Answers 0.1.0's runtime routes through `@formancy/data-client`, its policy deciding every answer for the person whose token the client carries ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)) |
| **formancy.ai's packages** | `@formancy/spec`'s hash and `@formancy/expressions`' language and exact decimals, dependencies at exact versions ([0002](../decisions/0002-depend-on-upstream-never-copy-it.md)). `@formancy/themes`' workbench stylesheet dresses a builder, and no published package declares it: a host installs it beside the builder, at the release the getting-started guide's install line names, and the Studio pins its own ([0017](../decisions/0017-the-sbom-describes-what-a-consumer-installs.md)) |
| **The reader of a PDF** | Receives bytes the host chose to give them. Nothing here touches them after the renderer returns |
| **A bank or a banking app** | Reads a payment code from the page: a QR-bill's Swiss QR Code, which a bank pays, or an EPC QR code, which a banking app fills a SEPA credit transfer in from. No test hands a code to either; ZXing, decoding the page PDF.js draws, is the only reader the tests have ([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md), [0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| **Whoever writes a payment code's rules** | SIX, for the QR-bill; the European Payments Council, for the EPC QR code (EPC069-12) and for the countries and territories a SEPA credit transfer reaches (EPC409-09); Austria's PSA, for that code's frame and caption; SWIFT's IBAN Registry, read through python-stdnum's copy, for each country's IBAN length. Each was read on a date its record gives and written into report-spec's rules, and nothing asks any of them anything when a report renders (0022, 0025) |
| **Whoever writes an e-invoice's rules, and judges one** | CEN/TC 434, for EN 16931 and its CII artefacts; FeRD and FNFE-MPE, for ZUGFeRD 2.5.2 and Factur-X 1.09.2, whose specification was not read; the BMF and the UStG, for what counts as an invoice in Germany. Mustang and KoSIT's validator judge the corpus's samples' XML, and veraPDF and Mustang the PDF/A-3b that embeds it, in a gate of their own, and are asked nothing when a report renders. No receiver, ERP or platform has been handed one ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md), [0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)) |
| **A visitor of formancy.ai/report/** | Opens the Studio or the product's pages, served as static files ([0018](../decisions/0018-the-studio-demo-is-served-at-formancy-ai-report.md), [0021](../decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md)) |

## Technical context

| Interface | Shape | Notes |
|---|---|---|
| Packages → host | ES modules with their types | Installed and resolved in plain npm projects, one per kind of host, by the install gate ([0015](../decisions/0015-the-getting-started-guide-is-compiled-and-run-by-the-install-gate.md)) |
| Host → builders | `openReportSession`, `createReportEditor`, then React's `ReportBuilder` or Angular's `report-builder` over that editor | One session, any number of editors; a builder never disposes what it did not create ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) |
| Host → runtime | `resolveReport(report, data, options)`: one header record and one detail list, exact numbers as strings, a mode of `final` or `preview` | Every value held to its field's type before anything reads it; a field the report does not declare is refused ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| Runtime → host's image lookup | An approved asset's id and digest in, its bytes out | Never an address; once per render, bounded by `MAX_ASSET_BYTES` ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| Runtime → renderer | A `ResolvedDocument`: every value the string it prints, every length a point, every style resolved | It names no engine ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| Renderer → host | `renderPdf(document, { maxPages, signal })` resolves to the PDF's bytes or rejects with a `RenderRefusal` and its `code` | Never a partial PDF ([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)); for a document with an e-invoice, a PDF/A-3b that embeds its XML ([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)) |
| Provider → Formancy Data | HTTP through a client the host made, with the host's token: the header's record, the detail rows a page at a time, each lookup's labels | Labelled `best-effort` ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)) |

## What is deliberately outside the boundary

- **Identity and authorisation.** The host's, verified. A tenant, a role or
  a permission supplied by a browser is never a decision's input
  ([`CLAUDE.md`](../../CLAUDE.md)). The provider is exactly as authorised as
  the token it is given, and no more
  ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).
- **Fetching.** No package reaches the network but the provider, and it
  only through the Data client the host made, to the server and with the
  token the host chose. A report names its datasets and assets, and the
  host resolves the names; an asset is referenced by approved id and
  digest, never by address
  ([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md),
  [formancy.ai 0077](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0077-options-may-come-from-a-named-source.md)).
- **Storage, jobs and publication.** There is no report server
  ([`gates.json`](../release/gates.json), G5). A draft's optimistic
  concurrency is groundwork in the session, a hash an edit may carry
  ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)),
  and nothing stores a draft.
- **Viewing a PDF.** The PDF.js viewer lives in the Studio and in no
  published package; a host shows the PDF with a viewer of its own
  ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)).
- **Configuration.** Nothing in a package reads it; the host's composition
  root does, once ([`CLAUDE.md`](../../CLAUDE.md)).
- **The paper.** A QR-bill sent on paper needs SIX's paper, and nothing here
  sees what a PDF is printed on
  ([0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md)).
- **Where an EPC QR code stands, and what prints beside it.** The PSA asks
  for the code at the lower edge of the page, and the EPC for the details
  it holds printed beside it in plain text. The format pins neither, and
  nothing checks that a template does either: the author places the code
  and its details, as the euro invoice does
  ([0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).
- **An AI.** None is a dependency. Commands as data are the groundwork for
  reviewed proposals, not the workflow
  ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md);
  [`gates.json`](../release/gates.json), G6).
