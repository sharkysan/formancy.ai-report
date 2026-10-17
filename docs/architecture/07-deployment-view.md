# 7. Deployment view

Formancy Report has no server, so nothing here is deployed as a service.
What ships is packages a host installs; what is served is the Studio and the
product's pages, as static files.

## What is published, and where

| What | Where | Made by |
|---|---|---|
| Every workspace package not marked private | npm, under the `@formancy` scope, each with `LICENSE.md` and `NOTICE` inside, and a provenance attestation | `release.yml`'s `publish` job, on the push of a `v*` tag ([`RELEASING.md`](../../RELEASING.md)) |
| A CycloneDX SBOM, signed with cosign | The GitHub release | `release.yml`'s `check` job, from the tarballs it pinned ([0017](../decisions/0017-the-sbom-describes-what-a-consumer-installs.md)) |
| The release report, Markdown and JSON, signed | The GitHub release; on every pull request, the CI run's artefact and summary | The gates' `report` job ([0014](../decisions/0014-a-release-report-is-derived-from-the-run-that-gated-it.md)) |
| The Studio and the product's pages | https://formancy.ai/report/, from `main` | Cloudflare Workers Builds, on every push to `main` ([0018](../decisions/0018-the-studio-demo-is-served-at-formancy-ai-report.md), [0021](../decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md)) |

There is no container image, because there is no server;
[`RELEASING.md`](../../RELEASING.md) says one arrives with the server it
describes.

## How a release reaches npm

```
a v* tag pushed
   │
   ├─ tag          decides once whether this run publishes; refuses a tag the
   │               manifests' version disagrees with
   ├─ npm-token    the token is set and accepted, checked beside the gates
   ├─ gates        verify · test · browser · install · e-invoice ──▶ report, which
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

## The e-invoice gate's tools

Nothing published carries them, and no host needs them. The `e-invoice`
job fetches Mustang, KoSIT's validator and its XRechnung configuration from
the URLs `docs/release/e-invoice-tools.json` registers, each refused unless
its SHA-256 is the one registered there, into a cache directory that
`.gitignore` names; CI keeps that cache under the register's hash, a
release fetches everything again, and a cached file is checked by its hash
where it is used. The tools run on the Java the register names, which the
job installs, with Java's HTTP and HTTPS proxies pointed at a dead port (a
raw socket is not caught), and the release report holds that Java's major
version and each tool to the register's, by the hash the gate measured and
the version the tool reported of itself. On a machine the gate runs on the
Java it is handed, which must be at least as new as each JAR's `java` in
the register, and the report shows that one
([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)).

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
  report-builder-core's `report-builder.css`. The React builder fills a
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
- **For an e-invoice:** no release prints one, and 0.1.0 refuses a report
  that holds one. On `main` a final render writes the CII XML into the
  resolved document, `document.eInvoice.xml`, and the renderer refuses that
  document, so nothing embeds the XML in a PDF and a host gets no PDF of
  an e-invoice; a preview prints, labelled on every page as no e-invoice.
  A host that bundles report-spec, report-core and report-runtime carries
  the e-invoice's rules and writer whether its reports have one or not,
  which 0027 measures
  ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)).
- **For the provider:** a Formancy Data 0.1.0 server and a data client
  carrying the person's token
  ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).

The getting-started guide is these steps as code the install gate compiles
and runs ([`../getting-started.md`](../getting-started.md),
[0015](../decisions/0015-the-getting-started-guide-is-compiled-and-run-by-the-install-gate.md)).
