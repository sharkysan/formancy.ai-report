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
                          │  Data provider · form bridge    │               code)
   the host's backend ───▶│  server: whoami, drafts, images │
   or a page, a token     └───────┬─────────────────┬───────┘
                                  ▲                 │ optional
                                  │                 ▼
                    the host's data and      Formancy Data 0.1.0
                    approved asset bytes     records, read as the person
                                             whose token the host holds
```

| Party | Exchanges |
|---|---|
| **Report author** | Edits a report in a builder the host mounts. Receives a refused edit's reason and every diagnostic where the thing it is about stands ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md), [0009](../decisions/0009-an-expression-is-checked-and-bound-member-by-member.md)). Adds an image file in either builder, where the host keeps images: its bytes go to the host's store before the report declares it, and why one is refused is said in the live region ([0033](../decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)). Where the host keeps drafts on the report server, saves from the version the page opened, and is told when another author saved since, nothing written, by the host's page and never by a builder ([0049](../decisions/0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md)) |
| **Integrator** | Opens the session and the editor, and disposes what it made; gives the editor a store where a person may add images, keyed by digest, which may be the report server's through `@formancy/report-client`, and draws a Save and a reload of its own (0049). Hands the runtime the data, the parameters and an image lookup it has already authorised, and, where it knows it, where the data came from, as identifiers ([0041](../decisions/0041-a-renders-manifest-names-where-its-data-came-from-by-identifiers-alone.md)). Receives a document, its manifest and a preview's warnings, then a PDF; or every reason there is none ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md), [0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)) |
| **Formancy Data** | Answers 0.1.0's runtime routes through `@formancy/data-client`, its policy deciding every answer for the person whose token the client carries ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)). Its identity verifier, `@formancy/data-identity` 0.3.0, is the code the server verifies a host's token with, under Data's rules; nothing asks Data's server anything ([0047](../decisions/0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)) |
| **The host's identity provider and backend** | Signs a short-lived JWT for a person, naming the person's tenant in the claim the operator maps; the server verifies it offline, under a pinned algorithm, against a key the operator gives it, and fetches no key ([0046](../decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md)) |
| **The operator of the server** | Builds the image from the repository and runs it with its settings, the identity key named by reference and the store's directory a volume; reads its log, where the audit trail is, and SIGHUPs it to read a key set again (0046); keeps and backs up that volume, which holds every tenant's drafts, every revision of each with the subject that saved it, and their images (0049) |
| **formancy's forms** | A host's form versions and their submissions, as formancy's server stored them, which the host hands the form bridge as documents; nothing here asks formancy's server anything ([0042](../decisions/0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md)) |
| **formancy.ai's packages** | `@formancy/spec`'s hash, validator and labels, and the data paths a test holds the form bridge's scopes to, and `@formancy/expressions`' language and exact decimals, dependencies at exact versions ([0002](../decisions/0002-depend-on-upstream-never-copy-it.md)). `@formancy/themes`' workbench stylesheet dresses a builder, and no published package declares it: a host installs it beside the builder, at the release the getting-started guide's install line names, and the Studio pins its own ([0017](../decisions/0017-the-sbom-describes-what-a-consumer-installs.md)) |
| **The reader of a PDF** | Receives bytes the host chose to give them. Nothing here touches them after the renderer returns |
| **A bank or a banking app** | Reads a payment code from the page: a QR-bill's Swiss QR Code, which a bank pays, or an EPC QR code, which a banking app fills a SEPA credit transfer in from. No test hands a code to either; ZXing, decoding the page PDF.js draws, is the only reader the tests have ([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md), [0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)) |
| **Whoever writes a payment code's rules** | SIX, for the QR-bill; the European Payments Council, for the EPC QR code (EPC069-12) and for the countries and territories a SEPA credit transfer reaches (EPC409-09); Austria's PSA, for that code's frame and caption; SWIFT's IBAN Registry, read through python-stdnum's copy, for each country's IBAN length. Each was read on a date its record gives and written into report-spec's rules, and nothing asks any of them anything when a report renders (0022, 0025) |
| **Whoever writes an e-invoice's rules, and judges one** | CEN/TC 434, for EN 16931 and its CII artefacts; FeRD and FNFE-MPE, for ZUGFeRD 2.5.2 and Factur-X 1.09.2, whose specification was not read; the BMF and the UStG, for what counts as an invoice in Germany. Mustang and KoSIT's validator judge the corpus's samples' XML, and veraPDF and Mustang the PDF/A-3b that embeds it, in a gate of their own, and are asked nothing when a report renders. No receiver, ERP or platform has been handed one ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md), [0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)) |
| **A German public buyer, and its portal** | Receives an XRechnung's XML, which the host sends it -- through the federal portals ZRE and OZG-RE, a Land's, email or Peppol -- addressed by a Leitweg-ID. KoSIT writes XRechnung's rules and its validator's configuration, which the e-invoice gate runs over the corpus's XRechnung sample; no portal has been handed one, and nothing here knows a Leitweg-ID's owner ([0038](../decisions/0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)) |
| **A visitor of formancy.ai/report/** | Opens the Studio or the product's pages, served as static files ([0018](../decisions/0018-the-studio-demo-is-served-at-formancy-ai-report.md), [0021](../decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md)) |

## Technical context

| Interface | Shape | Notes |
|---|---|---|
| Packages → host | ES modules with their types | Installed and resolved in plain npm projects, one per kind of host, by the install gate ([0015](../decisions/0015-the-getting-started-guide-is-compiled-and-run-by-the-install-gate.md)) |
| Host → builders | `openReportSession`, `createReportEditor`, then React's `ReportBuilder` or Angular's `report-builder` over that editor | One session, any number of editors; a builder never disposes what it did not create ([0012](../decisions/0012-the-builders-are-native-and-share-one-session.md)) |
| Host → runtime | `resolveReport(report, data, options)`: one header record and one detail list, exact numbers as strings, a mode of `final` or `preview` | Every value held to its field's type before anything reads it; a field the report does not declare is refused ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| Runtime → host's image lookup | An approved asset's id and digest in, its bytes out | Never an address; once per render, bounded by `MAX_ASSET_BYTES` ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)). The runtime checks no bytes against their digest |
| Editor → host's image store | `keep(image)`: the asset id the add means to declare, the media type, the digest, the bytes -- an SVG's as `cleanSvg` wrote them -- the file's name and the size it is drawn at; resolves `{ ok: true }`, or `{ ok: false, message }`, shown to the person | Called before the report declares the asset, once per add, and again for bytes the report declares already, never for an undo or a redo; it must settle, and the editor takes no other image meanwhile. The id is provisional until declared, so a store keys by digest, never by id alone ([0033](../decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)) |
| Runtime → renderer | A `ResolvedDocument`: every value the string it prints, every length a point, every style resolved | It names no engine ([0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)) |
| Renderer → host | `renderPdf(document, { maxPages, signal })` resolves to the PDF's bytes or rejects with a `RenderRefusal` and its `code` | Never a partial PDF ([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)); for a document with an e-invoice, a PDF/A-3b that embeds its XML ([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)) |
| Provider → Formancy Data | HTTP through a client the host made, with the host's token: the header's record, the detail rows a page at a time, each lookup's labels | Labelled `best-effort` ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)) |
| Host → form bridge | `readSubmission(report, { form, formHash?, submission: { id, data } })` or `readSubmissions(report, { forms, submissions, complete })`: the version documents and the submissions as formancy stored them; and, for a choice whose options a deployment resolves, `labels` | The data the runtime takes, labelled `host-captured`, naming each submission and its version's hash; nothing fetched ([0042](../decisions/0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md)) |
| Host → report generator | `generateReport(form, { id, locale, detail? })`: a form version the person starts a report from, the report's id and locale, and the repeater its table reads or one row per submission | A first draft bound to that version's submissions and naming it, with notes of what it left out and assumed; nothing fetched, and nothing kept beside the report ([0045](../decisions/0045-a-report-generated-from-a-formancy-form-is-a-deterministic-first-draft-and-what-it-left-out-is-listed.md)) |
| Host → server | HTTP: `GET /health`; and with `Authorization: Bearer <token>`, `GET /v1/whoami`, `GET /v1/templates`, `GET` and `PUT /v1/templates/{template}/draft`, and `PUT` and `GET /v1/assets/{digest}`; from the host's backend or, across an origin the operator lists, its page, by `@formancy/report-client` or by hand | `WhoAmI` -- subject, tenant, roles, capacities, actions -- or a refusal, a code and a sentence that quotes nothing; every bad token the one 401; nothing else answered ([0046](../decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md)). A save names the draft it replaces in `If-Match` by its version, its revision and its digest, as the `ETag` a read or a save answered, or `If-None-Match: *` for the first, and one from a draft no longer the newest is 412 `draft-changed`, nothing written; an image is kept and read by the SHA-256 of its bytes ([0049](../decisions/0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md)) |

## What is deliberately outside the boundary

- **Identity and authorisation.** The host's, verified. A tenant, a role or
  a permission supplied by a browser is never a decision's input
  ([`CLAUDE.md`](../../CLAUDE.md)). The provider is exactly as authorised as
  the token it is given, and no more
  ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).
  The server verifies the host's token and reads the tenant from it, and
  manages no identity of its own: no session, password or key (0046).
- **Fetching.** No package reaches the network but the provider, and it
  only through the Data client the host made, to the server and with the
  token the host chose; and report-client, only through the fetch the host
  gives it, to the report server the host names, following no redirect
  ([0049](../decisions/0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md)). The report server answers requests and sends
  none: it fetches no key set and no key a token names
  ([0047](../decisions/0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)). A report names its datasets and assets, and the
  host resolves the names; an asset is referenced by approved id and
  digest, never by address
  ([0007](../decisions/0007-a-report-definition-is-its-own-versioned-document.md),
  [formancy.ai 0077](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0077-options-may-come-from-a-named-source.md)).
- **Storage, jobs and publication.** The server keeps a template's draft
  and the images it declares, in files on one volume, and nothing else:
  no publication, render job or artifact
  (0049; [`gates.json`](../release/gates.json), G5). A draft on the server
  is saved from the version it was read at, its revision and its digest,
  a save from a stale one refused; the session's own concurrency is a
  hash an edit may carry
  ([0008](../decisions/0008-edits-are-commands-and-a-refused-edit-changes-nothing.md)),
  which the server does not read. An image a person adds is kept by the
  host's store, never by a builder or the runtime, whether the host keeps
  it itself or through report-client on the server: the editor hands it over and keeps no
  reference to its bytes, and the Studio's store holds them in the tab
  alone ([0033](../decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)).
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
