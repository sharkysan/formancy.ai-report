# 10. Verification

What is checked, how, and what each check proves — and what it does not.
The organising rule is
[0003](../decisions/0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md):
a claim about a report's output is proved on the PDF the engine produced.

## 10.1 Proved on the PDF

```
a fixture: a resolved document, and what its PDF must show, derived from it
   │
   ▼
the real renderer, its creation date fixed           never a mocked engine
   │
   ▼
PDF.js reads the bytes back: each page's size, every text run, its box and
the way it reads, every image and where it is drawn, every font and whether
it is embedded
   │
   ├─▶ the checks: rows once and in order, values on their own rows, the header
   │   on every page, regions where they belong, no empty page, no heading alone
   │   at a foot, no text over text or an image, nothing past a margin, a glyph
   │   for every character, kept blocks whole
   │
   └─▶ for a QR code: PDF.js draws the page, ZXing decodes every code on it — its
       text, bytes, level, version and place
```

Each check was given a real PDF that shows the fault it looks for, and was
watched failing with itself removed (`report-corpus/src/checks.test.ts`).
The renderer runs every fixture of the corpus with none excused
(`report-render-pdf/src/corpus.test.ts`), and every starter and each
sample of both invoices (`starters.test.ts`, `samples.test.ts`,
`report-render-pdf/src/euro-samples.test.ts`); the corpus's own
`starters/euro-samples.test.ts` states each euro sample's rate, account,
parties and words, and recomputes its total in BigInt
([0028](../decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)). The same corpus chose the
engine ([0005](../decisions/0005-pdfmake-renders-reports-behind-one-adapter.md),
[`../renderer-trial.md`](../renderer-trial.md)).

**The payment codes, at every layer that reads them.** Each code's rules
are report-spec's alone, held there by suites of their own, and every
reader of them is held where it reads them. What the two codes share, an
IBAN's check digits and the creditor reference, is held once, by
`report-spec/src/payment-reference.test.ts`, and the QR-bill's suite passes
on it unchanged
([0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md),
[0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).

| Where | A Swiss QR-bill | An EPC QR code |
|---|---|---|
| The rules, over text | `report-spec/src/qr-bill.test.ts` | `report-spec/src/epc-payload.test.ts`, the countries' table by `sepa.test.ts`, the print by `epc-print.test.ts` |
| The validator, on literal texts | `validate-payment-part.test.ts` | `validate-epc-qr-code.test.ts` |
| The editing core: its texts and its amount compiled in the report's scope | `report-core/src/diagnostics/parts.test.ts`, `diagnose.test.ts` | The same two |
| The runtime, on data | `report-runtime/src/lower-payment-part.test.ts`, `qr-bill.test.ts` | `report-runtime/src/lower-epc-qr-code.test.ts` |
| The renderer, on the PDF it produced: the code decoded from the pixels, the text read back | `report-render-pdf/src/qr-bill.test.ts`, `qr-bill-pages.test.ts` | `report-render-pdf/src/epc-qr-code.test.ts`, which also reads the caption, the frame and the quiet zone from the PDF's text, its drawing and its pixels |
| A starter, its code decoded by `readCodes` and asking for the total the page prints | The invoice, in `report-render-pdf/src/starters.test.ts` | The euro invoice, in the same file, with the details the code holds read beside it; `report-corpus/src/starters/starters.test.ts` holds its payload to a total recomputed in BigInt; and its six samples, in `report-render-pdf/src/euro-samples.test.ts`, each in its locale |
| The builders | `report-builder-core/src/payment-part.test.ts` | `report-builder-core/src/epc-qr-code.test.ts`, and the scenario "insert an EPC payment code, and type its account", run by the core, React and Angular |
| The browser entry's Liberation Sans | `report-render-pdf/src/browser.test.ts` | The same, which holds the chunk to loading only for a bill or a captioned code |
| The packed packages | The install gate's `consume.ts` | The same |

**An e-invoice, on its XML and not yet on a PDF.** No PDF carries an
e-invoice, so 0003's proof on the PDF waits for the step that draws one,
and the page is held to its XML on the document the runtime resolved
([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)):

| Where | What holds it |
|---|---|
| The rules, over text, and the closed lists | `report-spec/src/en16931.test.ts` |
| The validator, on the block and the report around it | `validate-e-invoice.test.ts` |
| The editing core: the names, and what the page must print | `report-core/src/expressions/e-invoice.test.ts`, `report-core/src/diagnostics/e-invoice.test.ts` |
| The runtime: the totals against a BigInt reading of EN 16931, the lines, the terms, the preview, the XML's bytes and its escaping | `e-invoice-totals.test.ts`, `e-invoice-lines.test.ts`, `e-invoice-terms.test.ts`, `lower-e-invoice.test.ts`, `cii.test.ts`, `xml.test.ts` |
| The renderer, refusing every e-invoice in both entries, pdfmake never called | `report-render-pdf/src/refusals.test.ts` |
| The samples: their XML against a BigInt computation of their data, and each line, total row, head and bank detail the page resolved to against the XML the same render wrote | `report-corpus/src/starters/e-invoice.test.ts` |
| The XML read by a parser that is not the writer, every term at the path CEN's binding gives it | `report-corpus/src/e-invoice-xml.test.ts`, through `testing/cii.ts` |
| The samples' XML judged by the tools a receiver runs | The `e-invoice` gate (§10.2) |
| The packed packages | The install gate's `consume.ts`: an e-invoice validated, resolved to its XML, refused by the renderer, and its preview drawn |

**What it does not see.** A rule or a border through a row, a shape over a
line, a clipped glyph, white text on white: none is text or an image to
PDF.js. A run's box is computed from its baseline and font size, so an
accent reaching into the line below is not seen. Pages are not compared
with approved pictures; decoding a code is not that. That no check reads
an engine's input and no engine is mocked is held by review alone
([0003](../decisions/0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md),
[0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md)).

## 10.2 The gates

`.github/workflows/gates.yml` runs on every pull request and every push to
`main` through `ci.yml`, and before every release through `release.yml`, so
a release passes exactly what CI passes.

| Job | Command | What it proves | What it does not |
|---|---|---|---|
| `verify` | `pnpm build`, `pnpm typecheck`, `pnpm check:pkg`, `node scripts/verify-licenses.mjs`, `node scripts/dependency-licences.mjs`, `pnpm test:repo` | Everything builds; no core package reaches a Node or DOM global; each package's manifest and types are right by publint and attw; every published package declares the licence and ships it; every production dependency and font file is under an admissible licence, by its identifier and the font's name table ([0006](../decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)); the repository's guards (§10.3) | That a package works outside the workspace, where a symlink to its source no longer resolves it; a licence's terms beyond its identifier, a font inside a script, code a package vendors ([§8.7](08-crosscutting-concepts.md#87-licences)) |
| `test` | Each package's and app's `test:coverage`, one job each | Each suite passes on a runner of its own. Coverage is reported to Codecov and gated nowhere | A package's suite runs its source, not the `dist` that ships ([0014](../decisions/0014-a-release-report-is-derived-from-the-run-that-gated-it.md)) |
| `browser` | The Studio's `test:browser`, with the build served under `/report/` as formancy.ai serves it, and `test:pictures`, with it served at the root of an origin nothing resolves; both in Chromium | What jsdom cannot see: no sideways scroll down to 320 pixels, the first Tab on the skip link, axe's contrast and target size at every starter in both builders, every starter's PDF drawn on white with the text it prints, the switch between frameworks, a real pointer's drag, a pane and the Preview hidden and shown again, the two builders' accessible trees compared, and no request or connection hint to any other origin; the README's pictures say what their page says ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md), [0019](../decisions/0019-a-person-hides-the-panes-the-design-view-needs-the-room-of.md), [0023](../decisions/0023-the-studio-and-the-pages-serve-their-own-faces-and-ask-no-other-site-for-anything.md)) | Firefox and WebKit; the product's pages, which no gate opens in a browser; what a picture looks like |
| `install` | `pnpm test:e2e:install` | The packed tarballs install into plain npm projects, one per kind of host; every entry resolves; the types check with `skipLibCheck` off against that host's types alone; the Node packages run end to end; each builder is drawn on a server and bundled for a browser, at the newest and the oldest release its peer range admits; the getting-started guide's code is compiled and run ([0015](../decisions/0015-the-getting-started-guide-is-compiled-and-run-by-the-install-gate.md)) | A builder mounted in a DOM — no focus, key, pointer or re-render there; the registry's copy of a package |
| `e-invoice` | `pnpm build`, then `node scripts/e-invoice.mjs --java "$JAVA_HOME/bin/java"`, on the Java the register names | Mustang and KoSIT's validator, at the releases `docs/release/e-invoice-tools.json` pins and refused unless each SHA-256 is the registered one, accept the XML the runtime writes of each e-invoice sample, KoSIT in its scenario `EN16931 (CII)`, and refuse each control, broken one named way, with exactly the messages expected, Java's HTTP and HTTPS proxies pointed at a dead port (a raw socket is not caught); a warning or a notice fails the run unless `scripts/e-invoice/accepted.json` accepts it with its reason; report-spec's closed lists and rule ids are held to the schematrons the tools run; a run fails where the corpus recorded in `scripts/e-invoice/recorded/` for the judges' tests is not the one it judged ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)) | A customer's template, since only the samples are judged; a PDF, since none carries the XML; CEN's release 1.3.17, which report-spec's rules follow, since the pinned tools run 1.3.16; that a receiver takes the file. On 17 October 2026 it had passed on Windows, on Zulu 25 and Temurin 17, and had not run in CI |
| `report` | `node scripts/release-report/report.mjs` | Every job above left results of this run; no test or test file was skipped or missed by its suite; every planned browser pass was made; every planned install host was checked whole; the e-invoice gate judged every file as its corpus expects, each tool at its register's version and bytes and, in CI, on the register's Java major version; two builds of a package agree; each release gate's evidence and each limitation's `heldBy` test passed ([0014](../decisions/0014-a-release-report-is-derived-from-the-run-that-gated-it.md), 0027) | Whether a limitation's sentence is still true: the register's fence detects a record's change, not its meaning |

Beside them: `cla.yml` holds every commit author of a pull request to a
signature on the CLA as it stands (`scripts/check-cla.mjs`), and
`security.yml` runs CodeQL and, on a pull request, GitHub's dependency
review. None of these is required to merge: `main`'s ruleset requires no
status check ([`GOVERNANCE.md`](../../GOVERNANCE.md)).

## 10.3 The repository's guards

`pnpm test:repo` runs every `scripts/**/*.test.mjs`. They hold the files
that describe the repository rather than a package. Among them:

| Guard | Fails when |
|---|---|
| `upstream-deps.test.mjs` | An `@formancy/*` dependency from outside the workspace is a range, a link or a path ([0002](../decisions/0002-depend-on-upstream-never-copy-it.md)) |
| `dependency-licences.test.mjs` | The licence policy's rules, each on a fixture, then the real tree ([0006](../decisions/0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md)) |
| `licence-status.test.mjs` | A document's licence sentence says another version, date or address than `LICENSE.md` ([0001](../decisions/0001-a-paid-module-in-its-own-repository.md)) |
| `workflows.test.mjs` | A workflow loses its shape: an unpinned third-party action, a `${{ }}` in a script, a cache in a release, a job without its collect step ([0014](../decisions/0014-a-release-report-is-derived-from-the-run-that-gated-it.md)) |
| `ci-test-jobs.test.mjs`, `codecov-config.test.mjs` | The `test` matrix or `codecov.yml` and the workspace disagree |
| `getting-started.test.mjs` | A block of the guide escapes the install gate, or a link or anchor in it no longer resolves ([0015](../decisions/0015-the-getting-started-guide-is-compiled-and-run-by-the-install-gate.md)) |
| `palette.test.mjs` | A copy of admin.css's variables says other than admin.css at the pinned commit ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)) |
| `pictures/readme.test.mjs` | A README picture's caption quotes what the parts its capture recorded in `docs/images/readme/captured.json` do not say, or a picture's bytes are not the ones captured ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)) |
| `release-report/limitations.test.mjs` | A record has no register entry, or changed since it was read ([0014](../decisions/0014-a-release-report-is-derived-from-the-run-that-gated-it.md)) |
| `e-invoice/*.test.mjs` | A module of the e-invoice gate stops doing its part: the judges, over the run recorded in `scripts/e-invoice/recorded/`; the registers and the accepted warnings; the cache's hash check; the corpus and its controls; the reader of the tools' XML; the unzip; the recording, which holds no path of the machine it ran on (0027) |
| `source-size.test.mjs` | A source file passes 600 lines |
| `architecture.test.mjs` | A section of these documents is missing; a workspace package or app has no row in [the building blocks](05-building-blocks.md), or its row names other dependencies than its manifest; a decision record is cited by no section; a relative link here does not reach a file or a heading GitHub would give it; or a path written here as code names nothing the checkout holds ([0026](../decisions/0026-the-architecture-is-documented-in-arc42s-sections-held-to-the-repository-by-a-guard.md)) |
| `heading-anchors.test.mjs` | The one reading of GitHub's heading anchors, which this guard, the guide's and the product pages' link check share, gives one of its fixture headings another anchor than the one written beside it |

## 10.4 The release gates

[`gates.json`](../release/gates.json) names each of the delivery plan's
release gates by id, with the evidence a run must pass or the reason it is
open, and the release report states each. G1, G2 and G3 rest on evidence
every run must pass: the install gate and the dependency guards; the
corpus, the starters and the checks; the builders' scenarios, the switch
across frameworks and the two accessible trees compared. G4 to G7 belong to
later releases and say why, and the legal gate waits for a lawyer
([`../release/README.md`](../release/README.md)).

## 10.5 The honest limits

- **One browser.** The browser gate and the pictures run in Chromium alone
  (`scripts/browsers.mjs`), where Formancy Data's run Firefox and WebKit too.
- **The product's pages are read, not opened.** Their checks read the HTML
  and stylesheets the build writes; their reflow and contrast were measured
  by hand in Chromium when each page arrived, all of them again with the
  EPC QR code page ([0021](../decisions/0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md),
  [0024](../decisions/0024-the-invoice-comes-in-four-languages-as-samples-and-a-qr-bill-page-shows-them.md),
  [0028](../decisions/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them.md)).
- **No real Formancy Data server.** The provider's tests and the install gate
  run against a stand-in that answers 0.1.0's routes in Data's shapes, with
  no database and no policy ([0016](../decisions/0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md)).
- **No phone, no bank, no paper.** ZXing decodes every code a test prints;
  nothing here scanned one with a phone, paid a bill, initiated a transfer
  from an EPC QR code in a banking app, or printed a slip or a code
  ([0020](../decisions/0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md),
  [0022](../decisions/0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md),
  [0025](../decisions/0025-a-report-prints-an-epc-qr-code-held-to-the-epc-rules-beside-the-qr-bill.md)).
- **No e-invoice drawn, and none received.** The XML is judged by two
  validators and read back by a parser; no PDF carries it, nothing here has
  handed the file to a receiver, an ERP or a platform, and a customer's
  template goes through neither tool, only through the rules and the check
  that each total is printed
  ([0027](../decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md)).
- **Copied by hand.** The palette and the builder's geometry are copied
  from formancy.ai's admin.css, and nothing fails when upstream moves
  ([0013](../decisions/0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md)).
- **The demo is not checked.** Nothing here reads what formancy.ai/report/
  serves, or whether a deploy happened
  ([0018](../decisions/0018-the-studio-demo-is-served-at-formancy-ai-report.md)).
- **Automated accessibility is a floor.** axe finds what a machine can, and
  no manual audit is recorded.
- **These documents.** `architecture.test.mjs` holds their shape, their
  links, the paths they name and the building blocks' dependencies; whether
  a sentence here is still true of its record, which layer a package stands
  in, and which package a bare file name is in are held by review, as the
  register's wording is.
