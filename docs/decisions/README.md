# Architecture decision records

Every decision here was actually made, in the order the numbers suggest, while
building Formancy Report. Where a decision was reversed or narrowed later, the
record says so and points at the one that superseded it. Where a decision rests
on one made in formancy.ai or in Formancy Data, the record cites it as
`formancy.ai NNNN` or `formancy.ai-data NNNN` with a link, and does not restate
it.

## Why these exist

Two audiences:

1. **Contributors**, who need to know why the obvious simpler thing was not
   done, so they do not helpfully undo it.
2. **Customers and evaluators**, deciding whether to build on this module, who
   want the reasoning and not just the result — especially about the licence
   and about what the module refuses to do with their data and their documents.

## Format

The format is formancy.ai-data's:
[MADR](https://adr.github.io/madr/)-shaped, trimmed to what is load-bearing.

```markdown
# NNNN — Title in the imperative

- **Status:** accepted | superseded by NNNN | reversed
- **Date:** YYYY-MM-DD
- **Deciders:** who
- **Verified by:** the tests, gates or files that hold this decision in place

## Context

The forces. What was true when the decision was made.

## Decision

What was decided, in one or two sentences.

## Consequences

What this buys, what it costs, and what it forecloses. The cost paragraph is
not optional: a record with no downside is marketing, not a decision.

## Alternatives considered

Each with the reason it lost.
```

**Verified by** is the field that distinguishes a decision record from an
opinion. If a decision is load-bearing, something in the repository fails when
it is violated — a test, a CI gate, a script the workflow runs. A record whose
only enforcement is "we remember" says so plainly.

## Index

| # | Decision | Status |
|---|---|---|
| [0001](0001-a-paid-module-in-its-own-repository.md) | A paid module lives in its own repository, under Formancy Data's terms, in force before a lawyer has read them | accepted |
| [0002](0002-depend-on-upstream-never-copy-it.md) | Depend on released upstream packages at exact versions; never copy them | accepted |
| [0003](0003-a-rendered-report-is-proved-on-the-pdf-it-produced.md) | A rendered report is proved on the PDF it produced, read back with PDF.js; never on the engine's input, never through a mocked engine | accepted; extended by 0020 |
| [0004](0004-three-version-lines-each-refused-when-unknown.md) | Three version lines -- formancy's form spec, Report's format, Formancy Data's contract -- each refused when unknown; package versions alone establish nothing | accepted; extended by 0014 |
| [0005](0005-pdfmake-renders-reports-behind-one-adapter.md) | pdfmake renders version 1's reports, behind one adapter that refuses rather than truncates; pdfme lost on the corpus, and HTML engines and Prince were not trialled | accepted |
| [0006](0006-dependencies-and-fonts-allow-public-source-and-licensed-production.md) | Every production dependency and every font a published package ships is under a permissive licence; GPL, AGPL, non-commercial and unlicensed are refused | accepted; extended by 0016 and 0022 |
| [0007](0007-a-report-definition-is-its-own-versioned-document.md) | A report definition is its own versioned document, with a flowing body, one detail table, declared aggregates and print styles as tokens | accepted; extended by 0020 and 0022 |
| [0008](0008-edits-are-commands-and-a-refused-edit-changes-nothing.md) | Edits are commands, and a refused edit changes nothing | accepted |
| [0009](0009-an-expression-is-checked-and-bound-member-by-member.md) | An expression is checked and bound member by member, by one compilation the editor and the runtime share | accepted |
| [0010](0010-the-runtime-resolves-a-report-into-a-renderer-neutral-document.md) | The runtime resolves a report into a renderer-neutral document, exactly, or refuses it: data held to its contract, totals exact and rounded once, values formatted once | accepted; extended by 0022 |
| [0011](0011-report-render-pdf-draws-the-document-and-refuses-what-it-cannot.md) | `report-render-pdf` draws the whole resolved document with pdfmake, and refuses what it cannot draw whole | accepted; extended by 0020 and 0022 |
| [0012](0012-the-builders-are-native-and-share-one-session.md) | The builders are native, share one session through one editor model, and are held to each other by shared scenarios | accepted; its untested parts held by 0013's Studio |
| [0013](0013-the-studio-is-the-same-room-and-its-pictures-are-taken-by-a-script.md) | The Studio is formancy.ai's room with a report builder in it, its PDF.js viewer stays inside it, and its README pictures are taken by a script | accepted; its faces the build's own since 0023 |
| [0014](0014-a-release-report-is-derived-from-the-run-that-gated-it.md) | A release report is derived from the run that gated the release, and says what it did not test | accepted; its SBOM made by 0017 |
| [0015](0015-the-getting-started-guide-is-compiled-and-run-by-the-install-gate.md) | The getting-started guide's code is compiled and run by the install gate, against the packed packages: the Node program, a React page of its own, and the Angular page in the builder's hosts | accepted |
| [0016](0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md) | The Data provider reads Formancy Data 0.1.0 best-effort, as the person whose token it carries, and checks what it can before it reads a record; Data's packages are admitted by 0006's guard for it alone | accepted |
| [0017](0017-the-sbom-describes-what-a-consumer-installs.md) | The SBOM describes what a consumer installs: the published tarballs, installed by npm with no script and no peer, and held to the packages a consumer's install brings | accepted |
| [0018](0018-the-studio-demo-is-served-at-formancy-ai-report.md) | The Studio's demo is served at formancy.ai/report/ by a Worker of its own, from a build with a relative base that the browser gate serves under that path, and Cloudflare deploys it from main on every push | accepted; extended by 0021, and its gate's font exception gone since 0023 |
| [0019](0019-a-person-hides-the-panes-the-design-view-needs-the-room-of.md) | A person hides the builder's side panes and the Studio's Preview for the design view's room, and the Studio puts the Preview beside the builder only where the design view holds a page | accepted |
| [0020](0020-a-qr-code-is-drawn-from-its-own-matrix-and-refused-where-it-may-not-scan.md) | A QR code is encoded by uqr and drawn from its own matrix, exactly its size with its quiet zone inside it, and refused where its text fits no version or its modules would be finer than 0.4 mm; pdfmake's own `qr` node and bwip-js lost | accepted; extended by 0022 |
| [0021](0021-the-product-pages-are-static-html-in-four-languages-beside-the-studio.md) | The product's pages are static HTML, prerendered in German, French, Italian and English, built in this repository and served beside the Studio at formancy.ai/report/ by its Worker | accepted; its faces its own copies since 0023 |
| [0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md) | A report carries at most one Swiss QR-bill, a payment part at the foot of its last page: SIX's rules are one set of checks in report-spec that the validator applies to literals and the runtime to data, and the slip is drawn to SIX's layout in Liberation Sans 2.1.5, which the renderer ships under the OFL; a component in a region, schoero's swissqrbill and an unembedded Helvetica lost | accepted |
| [0023](0023-the-studio-and-the-pages-serve-their-own-faces-and-ask-no-other-site-for-anything.md) | The Studio and the product pages serve their own faces, from Fontsource's packages through their own builds, and ask no other site for anything: the browser gate fails on any request or connection hint to another origin, and the pages' checks on any file a page fetches from one | accepted |
