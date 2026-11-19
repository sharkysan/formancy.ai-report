# Security Policy

## Reporting a vulnerability

Please report security vulnerabilities through GitHub Security Advisories
("Report a vulnerability" on the Security tab) rather than a public issue.

We aim to acknowledge a report within 3 working days and to provide a
remediation timeline within 10 working days.

Please do not include a working exploit in the initial report; a description of
the vulnerability class and the affected component is enough to begin triage.

## Scope

Formancy Report turns templates and a customer's data into PDF documents and
Word files, and serves those documents to people. A Word file is written by
`@formancy/report-render-docx` from the same resolved document as the PDF, and
a person opens it in Word, which acts on what the file holds: a field it
updates, a relationship to an address it fetches, markup it reads as the
document's own
([0068](docs/decisions/0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md)).
Templates, expressions, datasets, fonts and images are untrusted input even
when an administrator wrote them, and so are a formancy form's versions and
their submissions, which a host hands the form bridge from its own store. The
report server takes a person's identity and tenant from the host's token
alone, verified offline with Formancy Data's verifier, and what a person may
do is one table of actions, which every route that takes an action asks, and
whoami lists what the table gives
([0046](docs/decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md),
[0047](docs/decisions/0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)).
The server keeps a tenant's template drafts and the images they declare in
files on one volume, and each revision of a draft keeps `savedBy`, the subject
of the token that saved it: a claim's value, at rest in the store and in its
backups, and never in a log line, an audit event or a refusal
([0049](docs/decisions/0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md)).
The areas we consider highest risk, and are most interested in reports about,
follow from that:

- **Cross-tenant exposure**: a dataset, a rendered PDF or Word file, a cached
  artefact or a preview reaching a person the host's authorisation did not
  admit, including through a cache key that leaves out the tenant, the
  principal or the policy version. On the server: a draft or an image of one
  tenant read, listed or saved over under another's token, or a template id, a
  digest or a tenant claim that makes the store touch a path outside that
  tenant's directory.
- **Authorisation bypass** on preview, render or download: a decision taken
  from something the browser supplied -- a tenant, a role, a hidden field --
  rather than from the host's verified identity, or a published report used to
  read data its author could not. On the server: a token it accepts that the
  host did not sign, one without the tenant claim, an action it allows that
  the actions table does not give the person's roles, or a route that
  answers outside that table.
- **Disclosure in the server's log or answers**: a token, a secret, a
  claim's value or what a request carried reaching a log line, the audit
  trail, an error or a refusal's sentence -- a template's content, an
  image's bytes, `savedBy`, or an absolute path in the store, whose
  tenant's directory is the unkeyed hash of the tenant's claim, among them.
- **A save lost unseen**: two saves from one revision of a draft both
  written, a save written over a draft its author never read, or a
  stored draft or image served that is not what was saved -- an integrity
  failure, and in scope.
- **Derived disclosure**: a value the person may not read revealed through a
  total, a group label, a sort order, a row count, a validation message or the
  metadata given to an AI model.
- **Remote-resource fetch**: anything that makes the renderer, the server or a
  worker request a URL a template, a dataset or an outsider named, or a Word
  file the writer wrote make Word request one when it is opened. Assets are
  referenced by approved identifier, never by address.
- **What a Word file makes Word do**: a string from a template or its data
  written into a Word file as markup rather than as its text, or a file the
  writer wrote that holds a field other than a page's number and count, a
  relationship to an address, a macro, an embedded object or anything else
  Word runs or fetches when it opens the file: a chart's part among it,
  which holds its data itself and has no workbook, no formula and no
  relationship (0076). The writer escapes every
  string through one module whose markup is a type of its own, and the tests
  read the files it writes back with a reader that refuses an element it
  does not know, a relationship to an address, a chart's part that leads
  to any other part, and a field other than `PAGE` and `NUMPAGES`; a way
  past either is in scope.
- **Expression and template abuse**: an expression that escapes its typed,
  bounded evaluation, runs code, reads the clock or randomness where a report
  must be reproducible, or exhausts its budget unnoticed.
- **Resource exhaustion**: rows, pages, image pixels, fonts, nesting, time or
  output size -- a PDF's or a Word file's, whose paragraphs, runs, characters,
  pictures and codes the writer bounds -- that a limit should have refused,
  and a cancelled job that keeps consuming a worker.
- **Parser input**: font, image and SVG files that reach a parser without
  their type, size and dimensions checked.
- **Sensitive data in diagnostics**: a row, a parameter holding personal data,
  a connection detail or a credential in a log line, an error message, a debug
  artefact or an API response.
- **Silent wrong output**: a production PDF or Word file that drops rows,
  truncates content or rounds a total without saying so, a Word file
  written without a QR-bill's slip its report holds, a Word file of a
  report that carries an e-invoice which does not say at the top of
  every page, a slip's page among them, that it is a copy and not the
  invoice, or which embeds the invoice's XML or anything else that is
  not the report's own text and pictures (0077), a Word file whose QR code or EPC QR code
  scans to anything but what its report's PDF scans to (0074), and one
  whose chart states another number or another word than its report's,
  or leaves one out (0076) -- an integrity failure, and in scope. Where
  Word breaks a line or a page otherwise than the PDF does is Word's
  layout, which 0068 states, and not a finding; nor is where Word puts a
  chart's words, what it writes on a chart's value axis from the numbers
  the file states, or that it draws a bar from the double nearest a
  number of many digits, which 0076 states. Nor is a copy of an
  e-invoice whose label or whose figures a person changed in Word: a
  Word file is one a person changes, the copy says so on every page as
  it leaves the writer, and the invoice is the PDF or the XML a host
  kept, which 0077 states.

Nothing in the packages is meant to fetch a URL but the two clients, each
through what the host gives it: the Data provider, through the Data client
the host made, and `@formancy/report-client`, through the host's `fetch`,
to the report server the host names, following no redirect. A report that
found a way to make Report reach the network on an outsider's instruction
is in scope and serious.
