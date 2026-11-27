# 7. Deployment view

What ships is packages a host installs; what is served is the Studio and the
product's pages, as static files. The server is a package and an image an
operator builds from the repository and runs; no release publishes the
image yet ([0046](../decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md)), so nothing of Report is deployed as
a service by this repository.

## What is published, and where

| What | Where | Made by |
|---|---|---|
| Every workspace package not marked private | npm, under the `@formancy` scope, each with `LICENSE.md` and `NOTICE` inside, and a provenance attestation | `release.yml`'s `publish` job, on the push of a `v*` tag ([`RELEASING.md`](../../RELEASING.md)) |
| A CycloneDX SBOM, signed with cosign | The GitHub release | `release.yml`'s `check` job, from the tarballs it pinned ([0017](../decisions/0017-the-sbom-describes-what-a-consumer-installs.md)) |
| The release report, Markdown and JSON, signed | The GitHub release; on every pull request, the CI run's artefact and summary | The gates' `report` job ([0014](../decisions/0014-a-release-report-is-derived-from-the-run-that-gated-it.md)) |
| The Studio and the product's pages | https://formancy.ai/report/, from `main` | Cloudflare Workers Builds, on every push to `main` ([0018](../decisions/0018-the-studio-demo-is-served-at-formancy-ai-report.md), [0021](../decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md)) |
| Every starter's PDF and Word file, and each e-invoice's XML, with an index | [`samples/`](../../samples/README.md) in the repository, which GitHub serves from `main` like any file, and every clone carries | `node scripts/samples.mjs --write`, by hand, after `pnpm build`, committed; held to the build by `pnpm test:repo` ([0079](../decisions/0079-every-starters-pdf-and-word-file-are-committed-as-samples-held-to-the-build-and-the-readme-draws-every-package-in-a-sketch.md)) |

One published package carries a program: `@formancy/report-mcp`'s `bin`,
`formancy-report-mcp`, which a coding agent's client launches from the
project that installed it and speaks the Model Context Protocol to over
stdio. It is published as every package is, with no image, no port and
no service of its own; the install gate's `mcp` host launches it from the
packed tarball through the SDK's stdio client
([0088](../decisions/0088-an-agent-gets-reports-checks-over-the-model-context-protocol-from-a-server-of-reports-own.md)).

No container image is published. The container gate builds the server's
image from each checkout and runs it, and what the release report says of
that image is labelled the gate's; publishing it, signed by its digest, is
a later record's, as [`RELEASING.md`](../../RELEASING.md) says.

## The server's image

```
packages/report-server/Dockerfile, built from the repository root
   │
   ├─ build    node:26.12.1-alpine3.24@sha256:40cd011b…, pnpm 12.4.2 by npm;
   │           the lockfile installed for report-server and what it declares,
   │           no install script run; built, LICENSE.md and NOTICE copied in;
   │           `pnpm deploy --prod` into /app
   ▼
   runtime  the same base, by digest; /app root's, read-only to node;
            /var/lib/formancy-report made and given to node, and named to the
            server as FORMANCY_REPORT_STORE_DIR, for its store; USER node;
            PORT 4392; HEALTHCHECK GET /health, at Data's image's
            intervals; node dist/main.mjs
```

An operator runs it with its settings -- the issuer, the audience, the
identity key by reference, `FORMANCY_REPORT_ATTRIBUTES` with the tenant's
claim, the directory of its store (which the image sets, and which must be
a volume for the drafts to outlive the container), the roles that hold each
capacity, and the rate limit, proxies, origins and audit key where the
defaults do not fit -- as the package's
README lists them, and secrets as files or variables a reference names,
never as a setting's value
([0047](../decisions/0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)). Unconfigured, it prints one line for each
setting it needs and exits 1, and a key or secret it cannot open -- a
reference to a variable that is unset -- stops it the same way, with one
sentence; SIGHUP reads a key set file again, and SIGTERM stops it after
the requests in flight, with exit 0. It runs with `docker run --read-only`
too, the store's directory then a volume the operator mounts; the
container gate runs each of these.

What it does not do, and what the operator therefore owns:
- **One instance.** Nothing here shares a rate limit or a store between
  two instances; one instance behind the host's proxy, its store on a
  local volume, is the deployment. A save is decided by a hard link, which
  is atomic on a local file system and which nothing here has tried over
  NFS, and the server does not probe for one at start: on a volume that
  cannot make one it starts and refuses every save as `internal`.
- **The store's volume, and its backup.** `FORMANCY_REPORT_STORE_DIR` is
  required, an absolute path to a directory that exists and that `node`
  can write, which the server never makes: outside the image, a directory
  that does not exist stops it at start. The image sets
  `/var/lib/formancy-report`, a directory the image itself makes and gives
  `node`, so a container run without a volume there starts, and its drafts
  live in the container's writable layer and go with it. Only under
  `docker run --read-only` does a missing volume stop it, the directory
  then unwritable, which no container check makes. The volume is the
  tenants' data: under its tenants directory, one per tenant named by the
  SHA-256 of its claim, each template's every revision as a numbered file
  with the subject of the token that saved it, and every image kept, by
  digest. Nothing prunes or deletes any of it. What to back up is that
  whole directory, on a schedule the operator keeps, and a restore puts
  its files back as they were: a record whose report was edited, or cut
  short, is never served, a read of it answered `internal` and logged by
  its path inside the tenant's directory, and a crash's temporary file is
  never read as a draft. A restore older than a template's newest save
  takes that save's file away, and a revision is the newest file's number,
  so the next save is given the number again. A page still holding the
  draft that went names its digest as well, so its save is refused
  `draft-changed`, unless the two drafts hold the same report to the byte,
  whose save goes through; refused, its author reads the newest rather
  than saving over a draft they never saw, and nobody needs to reload for
  that. What the restore took away is gone, which is the restore's own
  cost. The digest is compared just before the store's swap, which is by
  revision alone, so a draft's newest file removed by hand while the
  server runs can let a save that races another win over a draft its
  author never saw, and a restore made while it runs removes files under
  it the same way. So restore with the server stopped, and never remove a
  draft's newest file while the server runs. A file is flushed before it
  is linked, but its directory is not after, so an acknowledged save can
  lose its name on power loss, and its number is issued again as after a
  restore, a page that held it refused the same way
  ([0049](../decisions/0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md)).
- **TLS and the address.** It listens on plain HTTP on every interface of
  its container; TLS, the public name and the proxy that forwards to it are
  the operator's, and that proxy is named in `FORMANCY_REPORT_TRUSTED_PROXIES`
  for the rate limit and the log to see a client's address.
- **The log.** The audit trail is in it, one line per answered request; a
  durable trail is a collector the operator runs, or a sink an embedder
  writes.
- **The base layer.** Alpine's packages, BusyBox under GPL-2.0 among them,
  come with the base image and are not read by the dependency licence
  guard; how a published image reads them is the publishing record's
  question (SV-Q13 of the plan).

## How a release reaches npm

```
a v* tag pushed
   │
   ├─ tag          decides once whether this run publishes; refuses a tag the
   │               manifests' version disagrees with
   ├─ npm-token    the token is set and accepted, checked beside the gates
   ├─ gates        verify · test · browser · install · e-invoice · container ──▶ report, which
   │               fails the run on anything it cannot show
   ▼
check              read-only, no secret: the report is this run's, green and whole;
   │               the tarballs are byte for byte the ones the install gate ran;
   │               their sha256 pinned; the SBOM made from them, installed by npm
   │               outside the checkout with no script and no peer; pinned too
   ▼
publish            only on a tag, the one job that can write: refuses anything not
                   pinned; signs the SBOM and the report; publishes the tarballs
                   with provenance, in dependency order; creates the release
```

A release passes exactly what CI passes, because both call `gates.yml`; it
restores no cache, and nothing published is other than what `check` pinned
([0014](../decisions/0014-a-release-report-is-derived-from-the-run-that-gated-it.md)).
The GitHub release's body is the version's changelog section and the
report's summary; a section that folds its detail into a `<details>`
block, as 0.3.0's does, is carried as its summary and one line linking
the whole section in `CHANGELOG.md` at the tag
([0080](../decisions/0080-a-release-body-carries-its-sections-summary-and-links-the-whole-section-where-the-section-folds-its-detail.md)).
The npm token is a secret of an environment that admits only `v*` tags. That
the environment's policy is set is a repository setting nothing here can
read ([`RELEASING.md`](../../RELEASING.md)).

Before the tag, the same workflow is rehearsed: a `workflow_dispatch` on
any branch runs `tag`, the gates and `check` as a tag would, names the
release `dry-run`, and skips `npm-token` and `publish`, so it holds no
secret and can neither sign nor publish. And a release commit has one step
no gate writes for it: the start page says what the newest release holds
and what Formancy Report does not do yet, the QR-bill page and the EPC
QR code page each say which release holds their code, and the invoices,
Word files and report designer pages each say what the release holds of
what they describe and what it does not do, so `pnpm build` and
the pages' suite fail on the commit that renames *Unreleased* until each
page's status is written again, every such page named in one error, the
start page's first
([0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md),
[0028](../decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md),
[0056](../decisions/0056-the-start-page-leads-with-a-card-for-each-topic-report-is-built-around-every-card-on-the-site-names-the-tests-it-rests-on-and-no-page-compares-report-with-another-product.md),
[0081](../decisions/0081-the-start-page-names-pdf-and-word-pages-for-invoices-word-files-and-each-report-designer-join-it-and-every-package-names-keywords.md)).
Every published package names the English start page as its homepage, so
npm's link from each package leads to the pages (0081).
The start page links *Unreleased* from its hero and its status, so the same
commit opens a new, empty `## Unreleased` above the release's heading, or
the pages' link check refuses the site, as RELEASING.md's second step says.

## What a host sends for an XRechnung

An XRechnung's invoice is its XML, `document.eInvoice.xml` of a final
render, which the host sends where the public buyer asks -- the federal
portals ZRE and OZG-RE, a Land's, email, Peppol -- and nothing published
sends it, reaches a portal or knows a Leitweg-ID's owner. The PDF the
renderer draws of the same document is a copy, labelled so on every page,
and embeds nothing; a host that sends it alone sends no invoice
([0038](../decisions/0038-a-reports-e-invoice-may-be-an-xrechnung-3-0-whose-xml-a-host-takes-and-whose-pdf-is-its-labelled-copy.md)).

## The e-invoice gate's tools

Nothing published carries them, and no host needs them. The `e-invoice`
job fetches Mustang, KoSIT's validator and its XRechnung configuration, and
veraPDF, from the URLs `docs/release/e-invoice-tools.json` registers, each
refused unless its SHA-256 is the one registered there, its size beside
it, into a cache directory that `.gitignore` names; CI keeps that cache under the register's hash, a
release fetches everything again, and a cached file is checked by its hash
where it is used. The tools run on the Java the register names, which the
job installs, with Java's HTTP and HTTPS proxies pointed at a dead port (a
raw socket is not caught), and the release report holds that Java's major
version and each tool to the register's, by the hash the gate measured and
the version the tool reported of itself. On a machine the gate runs on the
Java it is handed, which must be at least as new as each JAR's `java` in
the register, and the report shows that one
([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)).
veraPDF's licence, GPL-3.0-or-later OR MPL-2.0, which a package could not
carry, is admitted for the gate's runs at its pinned release alone, and
the gate refuses a veraPDF older than the register's floor, its own or
the one Mustang bundles
([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)).

## The demo

```
push to main ──▶ Cloudflare Workers Builds: pnpm build, then node scripts/demo.mjs
                     │  refuses a checkout with uncommitted changes, a page that asks
                     │  for a file by an absolute path, a path both builds hold, a
                     │  _headers or _redirects of a build's own; writes _headers
                     ▼
                 Worker formancy-report-studio: static assets, no code
                 routed at formancy.ai/report and formancy.ai/report/*
                     ├─ _headers             read by Cloudflare, served to nobody
                     ├─ report/              the Studio
                     ├─ report/<lang>/…      the product's pages
                     └─ report/sitemap.xml

formancy.ai's own Worker serves everything else, and never sees a request under /report/
```

The Studio is built with a relative base, so one build is right under
`/report/` and at the root of `pnpm demo`, and the browser gate serves it
under the path read from the Worker's config
([0018](../decisions/0018-the-studio-demo-is-served-at-formancy-ai-report.md)).
What that costs is written there: the demo is `main`'s, ahead of any
release; a push deploys without waiting for that commit's CI; the build
settings live in Cloudflare's dashboard, recorded by hand in
`.github/REPO-METADATA.md`; and nothing in this repository checks that a
deploy happened or what the address serves. So what the Studio offers
reaches the public at a merge and not at a release: its Download Word
gave files of a writer no release held until 0.3.0
([0068](../decisions/0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md)),
those of a report with a code since 0074, opened in Word once, by hand,
on 20 November 2026
([0074](../decisions/0074-a-qr-code-and-an-epc-qr-code-are-written-into-a-word-file-and-what-refuses-a-code-stands-below-both-engines.md)),
and those of a report with a chart since 0076, opened in Word once, by
hand, the same day
([0076](../decisions/0076-a-chart-is-written-into-a-word-file-as-words-own-chart-from-the-runtimes-block-and-no-workbook.md)),
and those of a report paid by a QR-bill since 0075, opened in Word once,
by hand, the same day
([0075](../decisions/0075-a-qr-bills-slip-is-written-into-a-word-file-on-a-page-of-its-own-and-every-line-of-it-is-shown-to-fit.md)),
and those of a report that carries an e-invoice since 0077, each written
of its copy, opened in Word once, by hand, the same day
([0077](../decisions/0077-a-report-that-carries-an-e-invoice-is-written-into-a-word-file-as-the-copy-the-runtime-labels-on-every-page.md)).
Every starter's Word file was opened in Word again, by hand, on
22 November 2026, for 0.3.0 (`RELEASING.md`, step 3).

Every file the Worker serves carries the headers `scripts/demo-headers.mjs`
states for the demo's address, written by the deploy as one `_headers` rule:
a content security policy that admits scripts, styles, faces and PDF.js's
worker from the Studio's assets directory and the pages' own, its `ASSETS`
and `SITE`, alone, refuses
every connection, and requires Trusted Types, its one policy the default one
the Studio makes for PDF.js's worker; and no referrer, no sniffing, no
device and no transformation by Cloudflare. `pnpm demo` and the browser gate
serve the Studio under the same function of their own address
([0051](../decisions/0051-the-demo-is-served-under-a-content-security-policy-that-admits-its-own-files-alone.md)).

## What a host needs

- **A licence to run it in production**, and a Formancy Data production
  licence as well when it runs the provider
  ([0001](../decisions/0001-a-paid-module-in-its-own-repository.md),
  [0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).
- **Node 22.13 or later, or a browser.** The floor is stated in the
  workspace and declared by no published package
  ([0004](../decisions/0004-three-version-lines-each-refused-when-unknown.md)).
  The packages are ES modules only.
- **For a builder:** React or Angular within the builder's peer range, which
  the README's [generated table](../../README.md#what-it-is-tested-with)
  states; `@formancy/themes`, which no builder declares, so the host
  installs it itself, at the release the getting-started guide's install
  line names; and `@formancy/themes/workbench.css` imported first, then
  report-builder-core's `report-builder.css`, and, for formancy's own dark
  room, `@formancy/themes/room.css` after the workbench, as the Studio
  imports it
  ([0034](../decisions/0034-the-studio-and-the-pages-wear-formancys-room-by-importing-the-released-one.md)).
  `report-builder.css` imports its rules from the package's `styles/` by
  relative path: a bundler inlines them, and a host that serves or copies
  the entry as it stands serves or copies `styles/` beside it
  ([0039](../decisions/0039-a-person-selects-a-reports-qr-bill-and-edits-it-field-by-field-in-either-builder.md)).
  The React builder fills a
  container the host gives a height
  ([`packages/report-builder-react/README.md`](../../packages/report-builder-react/README.md),
  [`packages/report-builder-angular/README.md`](../../packages/report-builder-angular/README.md)).
  The release report names the React and Angular releases the install gate
  ran, at each end of the peer ranges.
- **For the renderer in Node:** the package's `fonts` directory beside its
  `dist`, which a QR-bill's slip and an EPC QR code's caption print from; a
  host that bundles the Node entry copies it beside the directory that
  holds the bundle, which is where the bundle looks
  ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md),
  [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).
  And for a PDF/A, an e-invoice's or the PDF/A-2b a host asks for,
  PDFKit's ICC profile, `sRGB_IEC61966_2_1.icc` in
  its `data` directory, which PDFKit reads with `fs` from beside its own
  code, at `${__dirname}/data/`, past
  pdfmake's access policy: a host that bundles the Node entry puts it where
  the bundled PDFKit's `__dirname` points, or every PDF/A render
  fails; nobody here has bundled one ([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md), [0057](../decisions/0057-a-report-that-is-no-e-invoice-is-drawn-as-a-pdf-a-2b-where-the-host-asks-for-one.md)).
  PDFKit is pinned at 0.19.1 by report-render-pdf, which imports nothing
  of it, so that npm places that release where pdfmake finds it; a host
  on another package manager, or with a PDFKit of its own, may resolve
  pdfmake's `^0.19.1` otherwise
  ([0036](../decisions/0036-the-renderer-pins-pdfkit-at-the-release-0035-was-read-against-until-pdfkit-writes-images-in-the-order-it-embeds-them.md)).
  The order the renderer writes a document's
  images in wraps three of its details that are not its API: a release
  that moved one would print the same pages in bytes that may vary, or,
  moving how one decode calls `finalize`, leave a render with such images
  never ending. The install gate checks the order, and that the render
  ends, on what a clean install resolves, and says which release that was
  ([0035](../decisions/0035-the-renderer-writes-the-images-pdfkit-decodes-in-the-order-pdfmake-opened-them.md)).
- **For the renderer in a browser:** a bundler that splits a dynamic import,
  or the font chunk that a slip and a captioned EPC QR code print from
  lands in every page
  ([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md),
  0025), and so does the chunk a chart is laid out by, which holds ECharts
  and zrender and is imported the first time a document holds a chart
  with something to draw.
- **For a chart:** nothing to configure, and nothing to install beside the
  renderer, which depends on ECharts and zrender at exactly 6.1.0. A
  host's bundle gives ECharts the renderer's own zrender, or every chart
  with something to draw is refused, naming it: the renderer measures a
  chart's words by replacing zrender's platform, and through another copy
  ECharts would measure them in widths nobody chose. A host that also
  draws charts of its own with ECharts shares that platform with the
  renderer, which replaces it for one synchronous layout and puts it back.
  A document whose charts together weigh more than `MAX_CHART_DRAWING` is
  refused, for the host to split across renders. A host that bundles the
  renderer's browser entry carries ECharts' `NOTICE` and d3's licence, for
  the code ECharts took from d3, among its notices, as the Studio's build
  does
  [0058](../decisions/0058-the-renderer-lays-a-chart-out-with-apache-echarts-and-prints-its-marks-and-its-words-where-echarts-placed-them.md).
- **A worker it can terminate**, if a render must stop at once: an abort is
  read only between pdfmake's passes
  ([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
- **For a Word file:** `@formancy/report-render-docx` and nothing beside
  it: it depends on fflate at exactly 0.8.3 and pako at exactly 3.0.2,
  ships no font and reads no file. `renderDocx(document)` on the
  document `resolveReport` returned, in Node or in a browser,
  synchronously and with no signal, so a host that must stop one runs it
  in a worker, and one that must bound its memory in a process of its
  own: a file at the writer's bounds was written in up to 3.3 seconds
  and up to 1,019 MB, and in up to 1,272 MB in a process that held a
  string beside each row of the document, as a host holds its data's
  rows, where 0068 measures it and says why V8 takes one amount or
  another for one file. A report of more than
  70,000 paragraphs, a table's cell being one, is refused for its size.
  A labelled preview has no Word file, and neither has the document
  that is an invoice in law: each is refused, to be printed as a PDF. A
  host whose report carries an e-invoice resolves it once more as its
  copy for the Word file, which is labelled on every page, in one of six
  languages or refused, and embeds no XML; what a person then changes in
  it is tied to the invoice by nothing
  ([0077](../decisions/0077-a-report-that-carries-an-e-invoice-is-written-into-a-word-file-as-the-copy-the-runtime-labels-on-every-page.md)). A report paid by a QR-bill has its
  slip on a page of its own at the end of the file, where the PDF prints
  it at the foot of the last page, so the file is a page longer and its
  page count says so; the slip is named in Arial, with Liberation Sans as
  its other name, and a reader with neither sets it in a face of other
  widths, in which a line may break and move what is under it; a bill
  whose lines do not fit their places is refused
  ([0075](../decisions/0075-a-qr-bills-slip-is-written-into-a-word-file-on-a-page-of-its-own-and-every-line-of-it-is-shown-to-fit.md)). A QR code and an EPC QR code are in
  the file, as pictures of the symbol the PDF draws, at most 64 of them
  and sixteen of the largest symbol, which a document of codes alone
  was written with in up to 1.6 seconds
  ([0074](../decisions/0074-a-qr-code-and-an-epc-qr-code-are-written-into-a-word-file-and-what-refuses-a-code-stands-below-both-engines.md)). A chart is in the file as Word's own chart, with no
  workbook, so a person who opens it cannot edit its data; its value
  axis is labelled by Word, at the places and with the grouping the
  report's ticks print, in the reader's own separators and without the
  report's currency; a file holds at most 64 charts and 25,600
  points between them, which a document of charts alone was written with
  in up to 0.53 seconds; and a report of very many charts may print as a
  PDF and not be written as a Word file, or the other way round, each
  engine bounding them by its own cost
  ([0076](../decisions/0076-a-chart-is-written-into-a-word-file-as-words-own-chart-from-the-runtimes-block-and-no-workbook.md)). The writer measures nothing, so a host
  offers the file beside a PDF that was drawn, as the Studio does, or
  hands on what the renderer would have refused. The file names the
  report's fonts and embeds none, so a reader without the family sees the
  face Word chooses. The starters' files were opened in Word once, by
  hand, those with a code, a chart, a slip or a copy's label too, on 20
  November 2026, the euro invoice from Austria after its frame was
  written again, and no test opens one
  ([0068](../decisions/0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md)).
- **What it has authorised, and what it fixes:** the data, the parameters
  and an image lookup by id and digest; a time zone for instants; and the
  creation date the PDF carries, which `resolveReport` requires, so the
  same inputs print the same bytes
  ([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md),
  [0010](../decisions/0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md)).
- **A PDF viewer of its own**, if it shows the PDF in a page
  ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)).
- **For an SVG asset:** report-spec's `cleanSvg`, which the runtime
  hands on too, run where the host approves the asset, and the bytes it
  returns kept as the asset, declared by their digest; the file as it came
  is never the asset, and the renderer refuses it. An approver is shown the
  cleaned drawing, or the PDF, never the file as uploaded, which a browser
  draws with what cleaning removed. A host that bundles the renderer
  carries the whole SVG reader, and one that bundles report-spec's
  validator alone a few kilobytes of its tables, which 0030 measures
  ([0030](../decisions/0030-an-image-asset-may-be-an-svg-of-drawing-elements-alone-cleaned-once-and-refused-at-print-in-any-other-form.md)).
- **For the images a person adds:** an `ImageStore` given to
  `createReportEditor`, whose `keep` puts the bytes where the host's image
  lookup will answer for them by id and digest before it resolves -- keyed
  by digest, and never let go while a report or a redo may name them --
  and says which of PNG, JPEG and SVG the host keeps. Without one, the
  builders offer no Add image…. The editor reads the file on the page's
  main thread, and the host is handed the drawing `cleanSvg` wrote of an
  SVG, never the file as chosen, and the file's name for its own records
  ([0033](../decisions/0033-a-person-adds-an-image-in-either-builder-and-the-host-keeps-its-bytes.md)).
- **For an e-invoice:** 0.1.0 refuses a report that holds one. From 0.2.0
  a final render of a Factur-X invoice writes the CII XML into the
  resolved document, `document.eInvoice.xml`, and the renderer draws that
  document as a PDF/A-3b that embeds it as `factur-x.xml`, the German
  hybrid invoice, in either entry; a preview writes no XML and prints as a
  plain PDF, labelled on every page as no e-invoice. In a Factur-X
  invoice, an image is no CMYK JPEG. An XRechnung's is below. A host that bundles report-spec, report-core and
  report-runtime carries the e-invoice's rules and writer whether its
  reports have one or not, which 0027 measures
  ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md), [0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)).
- **For a PDF/A-2b:** `renderPdf(document, { maxPages, pdfa: '2b' })` on
  a final render of a report that is no e-invoice, in either entry, and
  the profile above in Node. A Factur-X, an XRechnung's copy and a preview
  the runtime labels so are refused as one, so a host renders them
  without `pdfa`; a CMYK JPEG, an SVG past a PDF/A's integers or its
  graphics states, and a title holding `&`, `<` or `>` are refused by
  that render alone, which no builder warns of. The Studio offers none
  (0057).
- **For the provider:** a Formancy Data 0.1.0 server and a data client
  carrying the person's token
  ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).
- **For the server:** the image built from the repository, or the
  package embedded through `createReportServer` under Node 22.13 or later,
  as the install gate's `server` host makes it; `node dist/main.mjs` is the
  image's command and has run only on the image's Node 26; a host identity
  provider whose
  tokens carry a tenant claim; and, to run it in production, a production
  licence for Formancy Data as well, whose verifier it depends on
  ([0046](../decisions/0046-report-has-a-server-of-its-own-over-the-hosts-verified-identity.md), [0047](../decisions/0047-report-server-verifies-the-hosts-token-with-formancy-datas-data-identity-0-3-0.md)).
- **For an agent's MCP server:** `@formancy/report-mcp` installed in a
  project under Node 22.13 or later, and a client that speaks the Model
  Context Protocol configured to launch its bin there, by the command npm
  links; nothing to configure, since its tools need no server, and nothing
  it reaches but its own pipes. The SDK it depends on, at exactly 1.32.2,
  brings its HTTP transports and their closure, 92 packages with it on 27
  November 2026, into that project for a server that speaks stdio alone,
  at the ranges the SDK's manifest gives. A host that type-checks the
  package's declarations with `skipLibCheck` off and Node's types alone
  declares the DOM's `HeadersInit`, which the SDK's declarations name, as
  the install gate's host does in `scripts/install-fixture/mcp-globals.d.ts`. The bin
  has been launched by the SDK's stdio client, and by no agent's client
  (0088).
- **For the form bridge:** the document of every form version whose
  submissions it prints, kept beside them or fetched by its number from
  formancy's server, which serves each version's document from 0.8.0
  ([formancy.ai 0207](https://github.com/sharkysan/formancy.ai/blob/main/docs/decisions/0207-a-versions-document-can-be-read.md)),
  where 0.7.0's served the current one's alone; and, for a choice whose
  options a deployment resolves, a lookup of their labels in the report's
  locale ([0042](../decisions/0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md)).

The getting-started guide is these steps as code the install gate compiles
and runs ([`../getting-started.md`](../getting-started.md),
[0015](../decisions/0015-the-getting-started-guide-is-compiled-and-run-by-the-install-gate.md)).
