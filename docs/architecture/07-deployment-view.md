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
  can write; the image sets `/var/lib/formancy-report`, and the server
  never makes it, so a volume that is not mounted stops it at start. The
  volume is the tenants' data: under its tenants directory, one per tenant
  named by the SHA-256 of its claim, each template's every revision as a
  numbered file with the subject of the token that saved it, and every
  image kept, by digest. Nothing prunes or deletes any of it. What to back
  up is that whole directory, on a schedule the operator keeps, and a
  restore puts its files back as they were: a record whose report was
  edited, or cut short, is never served, a read of it answered `internal`
  and logged by its path inside the tenant's directory, and a crash's
  temporary file is never read as a draft. A file is flushed before it is linked, but its
  directory is not after, so an acknowledged save can lose its name on
  power loss ([0049](../decisions/0049-a-templates-draft-is-kept-by-the-report-server-one-per-tenant-saved-by-compare-and-swap.md)).
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
The npm token is a secret of an environment that admits only `v*` tags. That
the environment's policy is set is a repository setting nothing here can
read ([`RELEASING.md`](../../RELEASING.md)).

Before the tag, the same workflow is rehearsed: a `workflow_dispatch` on
any branch runs `tag`, the gates and `check` as a tag would, names the
release `dry-run`, and skips `npm-token` and `publish`, so it holds no
secret and can neither sign nor publish. And a release commit has one step
no gate writes for it: the QR-bill page and the EPC QR code page each say
which release holds their code, so `pnpm build` and the pages' suite fail
on the commit that renames *Unreleased* until each page's status is written
again, every such page named in one error, as RELEASING.md's second step
says
([0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md),
[0028](../decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)).

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
                     │  for a file by an absolute path, a path both builds hold
                     ▼
                 Worker formancy-report-studio: static assets, no code
                 routed at formancy.ai/report and formancy.ai/report/*
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
deploy happened or what the address serves.

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
  And for an e-invoice, PDFKit's ICC profile, `sRGB_IEC61966_2_1.icc` in
  its `data` directory, which PDFKit reads with `fs` from beside its own
  code, at `${__dirname}/data/`, past
  pdfmake's access policy: a host that bundles the Node entry puts it where
  the bundled PDFKit's `__dirname` points, or every e-invoice render
  fails; nobody here has bundled one ([0031](../decisions/0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)).
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
  0025).
- **A worker it can terminate**, if a render must stop at once: an abort is
  read only between pdfmake's passes
  ([0011](../decisions/0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md)).
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
- **For the form bridge:** the document of every form version whose
  submissions it prints, kept beside them, since formancy 0.7.0's server
  serves its current version's schema alone; and, for a choice whose
  options a deployment resolves, a lookup of their labels in the report's
  locale ([0042](../decisions/0042-a-report-reads-a-formancy-forms-submissions-against-the-exact-version-that-collected-them-as-the-host-hands-them-over.md)).

The getting-started guide is these steps as code the install gate compiles
and runs ([`../getting-started.md`](../getting-started.md),
[0015](../decisions/0015-the-getting-started-guide-is-compiled-and-run-by-the-install-gate.md)).
