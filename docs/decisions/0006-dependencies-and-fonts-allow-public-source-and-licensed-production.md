# 0006 — Dependencies and fonts allow public source and licensed production

- **Status:** accepted; extended by [0016](0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md), which admits Formancy Data's packages for the Data provider, by [0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md), which reads Liberation Sans 2's licence sentence, and by [0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md), which admits an ICC profile by the digest of its bytes and the licence sentence a review read, and by [0043](0043-a-report-maps-its-font-tokens-to-fonts-the-host-approved-pinned-by-digest-and-the-renderer-embeds-them.md), whose host fonts are outside this guard, their licence the customer's
- **Date:** 2026-10-14
- **Deciders:** Daniel Bacher
- **Verified by:** `scripts/dependency-licences.mjs`, run as a step of
  `gates.yml`'s `verify` job on every pull request and before every release,
  and through `scripts/dependency-licences.test.mjs` in `pnpm test:repo`. A
  test fails if the step leaves the job.

  **On fixtures,** the test proves each refusal: GPL-3.0-only,
  AGPL-3.0-or-later, CC-BY-NC-4.0, LGPL, SSPL, BUSL, `UNLICENSED`, a
  `SEE LICENSE IN` pointer and an expression it cannot parse.
  - **Operators.** `MIT OR GPL-2.0` passes and `MIT AND GPL-2.0` does not.
    Nested parentheses are read as written. AND binds tighter than OR. A
    `WITH` exception on the reviewed list is read as the licence it
    qualifies; any other, the Commons Clause or a `LicenseRef` among them,
    is refused.
  - **Legacy and missing licences.** npm's legacy `licenses` array is read as
    AND, a manifest with both it and `license` is read as both, AND again,
    and a package that declares no licence is refused.
  - **Exceptions.** An exception is honoured only at its exact version, its
    licence is held to the policy too, and one that nothing installs is
    refused.
  - **The walk.** It follows pnpm's isolated layout through links to real
    directories and never follows a devDependency. It follows installed
    optional and peer dependencies, and reports a required dependency or a
    required peer that is not installed. It walks through a workspace
    sibling that declares this repository's licence without judging it, and
    judges one that declares anything else.
  - **Fonts.** The licence is read from an OpenType font's name table, a
    CFF-flavoured one included. A truncated font, a collection, a web font,
    an EOT, a Type 1 font, and any font it cannot read are refused unless an
    exception names that file. A font is found by its extension or, in a
    file not named as code, text or an image, by its first bytes. A
    workspace package's own fonts are judged.
  - **Bundling.** Every publishable package's tsdown configuration inlines
    nothing from `node_modules` (`deps.onlyBundle: []`), read from the
    configuration itself, so no devDependency the walk never follows ships
    inside `dist`.

  **Watched failing,** with each rule mutated in turn and restored:
  - **The expression parser:** AND read as OR, OR read as AND, GPL-3.0-only
    added to the list, an unparseable expression allowed, `WITH` allowing
    whatever it qualifies, `WITH` allowing any exception, and the brackets
    dropped.
  - **Exceptions:** honoured by name at any version, taken as a waiver, and
    stale ones not refused.
  - **The walk:** a missing required dependency skipped, a missing required
    peer skipped, dependencies resolved from the link rather than the real
    directory, devDependencies followed, a sibling skipped whole, every
    sibling's licence skipped, private packages walked, the legacy array read
    as OR, and `license` read alone when `licenses` is there too.
  - **Fonts:** not scanned, every readable font taken as OFL, fonts found by
    `.ttf` and `.pfb` alone, fonts not found by their first bytes, any file
    that begins as a font taken for one, and a workspace package's fonts
    skipped. A name string cut short and read anyway failed only once a case
    was added for it. The first truncated font never reached that check.
  - **The command:** not exiting 1, and the step removed from `gates.yml`.
  - **Bundling:** `report-spec`'s `onlyBundle` removed.

  **Formancy Data** (added 2026-10-16). A Data package is admitted when
  three things hold:
  - it is at its exact version;
  - the file its pointer names is the one the review read;
  - it is reached from the provider alone.

  It is refused when any of these differs:
  - at another version, where the unused admission is named too;
  - with another file, or with none;
  - from another package;
  - when it declares another licence, which is then judged.

  An admission nothing installs is refused. On the real tree, the
  provider's closure holds `@formancy/data-client` and
  `@formancy/data-core` 0.1.0, each with the file read, and nothing else
  reaches them. The rules were watched failing one at a time, as 0016
  lists.

  **On the real tree,** the workspace passes and the walk finds
  `@formancy/report-spec`. The command exits 0 here and 1 on a tree with a
  GPL dependency, naming it. pdfmake, as the corpus installs it, has every
  dependency found and one refusal, `png-js` 1.1.0, which declares no licence.
  Its Roboto is read as OFL-1.1 at version 3.014. `pdfjs-dist`'s Liberation
  Sans and Foxit fonts are refused.

  **Not checked:**
  - that a licence's terms are what its identifier says;
  - a font inside a script rather than in a font file, a font in a file
    named as code, text or an image, and a compressed font such as
    `.ttf.br`;
  - code a package vendors under a licence of its own;
  - whether a dependency is used at all.

## Context

[0001](0001-a-paid-module-in-its-own-repository.md) names the cost: neither
GPL nor AGPL code can ship inside a product whose source is public and whose
production use is licensed, nor code under a non-commercial licence, and a
commercial component needs written redistribution rights. `CLAUDE.md` held
that by review "until the first third-party runtime dependency arrives with
the renderer, and by a guard from then on". The renderer experiment brought
the first third-party PDF libraries into the workspace: pdfmake, pdfme and
PDF.js, in the private corpus package. The one published package,
`@formancy/report-spec`, still has no dependencies, so this guard exists for
what arrives next.

Fonts are part of the same rule, because an engine embeds them in a
customer's documents. A package's `license` field says nothing about them.
Measured on 2026-10-14 from the installed files:

- **pdfmake 0.3.11** declares MIT and ships Roboto in `fonts/Roboto/`. Each
  face's name table says "Version 3.014; 2025" and "This Font Software is
  licensed under the SIL Open Font License, Version 1.1". The corpus embeds
  Roboto in the PDFs it writes.
- **`pdfjs-dist` 6.4.299** declares Apache-2.0. Its `standard_fonts/` holds
  Liberation Sans 1.07.4, whose name table says "Licensed under the Liberation
  Fonts license". Its `LICENSE_LIBERATION` is GPL-2.0 with a font-embedding
  exception. The same directory holds Foxit's Type 1 fonts, which have no
  name table, under the BSD-style `LICENSE_FOXIT`. A guard that read
  `package.json` alone would pass all of it as Apache-2.0.

Walked on the same day, pdfmake's production closure as installed is all
permissive except `png-js` 1.1.0. That package has no `license` field, and its
`LICENSE` file is the MIT licence.

## Decision

`scripts/dependency-licences.mjs` walks, for every publishable workspace
package (one without `private: true`), its production closure as installed:
`dependencies`, and the `optionalDependencies` and `peerDependencies` that
are installed. Each is resolved as Node resolves it from the package's real
directory. A required peer that is not installed is reported as a missing
dependency is: npm 7 and later installs it for a customer, though this
workspace, with `auto-install-peers` off, does not. A workspace sibling that
declares this repository's licence (`SEE LICENSE IN LICENSE.md`) is walked
through without judging it; one that declares anything else is judged like
anybody's package. Every package reached, and every font file in it, must be
under a licence the policy allows. And every publishable package's build
inlines nothing from `node_modules`, because a devDependency the walk never
follows would otherwise ship inside `dist` as this repository's own code.

- **The policy** is an allow-list: MIT, ISC, BSD-2-Clause, BSD-3-Clause,
  Apache-2.0, 0BSD, BlueOak-1.0.0, Zlib, CC0-1.0, Unlicense and, for fonts,
  OFL-1.1. These are permissive licences that allow both public source and
  licensed production use, and OFL-1.1 allows embedding. An SPDX expression
  passes when every AND term is allowed and every OR has an allowed branch.
  Brackets are read as written. A `WITH` exception is read as the licence it
  qualifies only when it is on the reviewed list -- LLVM-exception,
  Classpath-exception-2.0, GCC-exception-3.1 and Font-exception-2.0, each of
  which only adds permissions -- and is refused otherwise: the Commons Clause
  turns Apache-2.0 into a licence that forbids selling the software.
  Identifiers match without regard to case. npm's legacy `licenses` array is
  read as AND, because it never said which it meant, and so is a manifest
  that has both it and `license`. What cannot be parsed is refused.
- **Refused**, by not being listed:
  - **GPL in every version.** Distributed with it, Report would have to be
    offered on the GPL's terms, which allow no further restriction such as a
    paid production licence.
  - **AGPL.** The same, and its conditions extend to users who reach the
    software over a network, which is how a report server is used.
  - **LGPL.** Its conditions on a combined work have no settled reading for
    bundled JavaScript, so it is refused rather than argued case by case.
  - **SSPL.** It asks for the source of the whole service that offers the
    software.
  - **BUSL and other source-available licences.** They withhold production
    use, and Report's production licence cannot grant production rights to
    somebody else's code.
  - **CC-BY-NC and every non-commercial licence.** They forbid the commercial
    use Report's licence sells.
  - **A missing licence, `UNLICENSED` and a `SEE LICENSE IN` pointer.** These
    grant nothing that can be read.
- **A font** passes when its OpenType name table's licence description begins
  with the sentence the OFL asks a font to carry, or with "Licensed under the
  Apache License, Version 2.0". A font is untrusted input. Anything else is
  refused, including a font this cannot parse and every format other than a
  plain OpenType or TrueType file (Type 1, collections, web fonts, EOT). A
  font is found by its extension or, in a file not named as code, text or an
  image, by its first bytes, so a font renamed is still read.
- **An exception** is reviewed and written in the script's `EXCEPTIONS`. It is
  keyed `name@version`, or `name@version/path` for one font file, and maps to
  `{ licence, evidence }`: the licence the evidence shows, and where that
  evidence is. It corrects the metadata, never the policy, so its licence is
  held to the list like any other. It is honoured at that exact version only,
  and one that nothing installs is refused. The list was empty until
  2026-10-15, when the renderer arrived (below).

## Consequences

**What it buys.**
- **No unseen arrival.** A GPL package cannot reach a published package
  through a transitive update without CI naming it and the route it came in
  by.
- **Fonts are read from the font.** Liberation Sans is caught although its
  package says Apache-2.0.
- **Exceptions stay minimal.** Each one names the evidence a person read, and
  none outlives the release it was read for.

**What it costs.**
- **The identifier is trusted.** A package that declares MIT and ships GPL
  code passes. The inventory review plan section 22.1 owes before the first
  paid release is still owed.
- **Only font files are seen.** pdfmake's `build/vfs_fonts.js` carries
  Roboto as base64 inside a script, and a font in a stylesheet's `data:` URL
  would be just as invisible. So is a font compressed in its package, and
  one in a file named as code, text or an image: those files are not opened.
  Opening every file to read its first bytes made the first walk of
  pdfmake's closure take 18.7 s instead of 0.67 s, and a repeated one about
  0.35 s instead of 0.09 s (one Windows machine, 2026-10-15).
- **Vendored code is not seen.** Code a package keeps under a licence of its
  own, such as pdfmake's `src/3rd-party/svg-to-pdfkit` with its own `LICENSE`,
  is judged by the package's field alone.
- **It reads what is installed, not what a customer installs.** A customer's
  install resolves ranges afresh. Only the running platform's optional
  packages are on disk, so CI judges Linux's binaries and a Windows machine
  its own. The walk resolves as Node does, all the way up, so it can also
  find and judge a peer that pnpm hoisted for another package. That is
  stricter, not looser.
- **Upgrades need review.** An exception is keyed to an exact version, so
  every upgrade of an excepted package is reviewed again. Every new licence
  outside the list stops the gates until somebody reads it. The renderer
  package will stop on `png-js` 1.1.0, and a viewer that ships `pdfjs-dist`
  will stop on its standard fonts.

**What it forecloses.**
- **A commercial component**, which 0001 admits with written redistribution
  rights. It has no identifier on the list, and no exception can admit it as
  written. That takes a change to this record, which is what it should take.
- **Formancy Data's packages.** They declare `SEE LICENSE IN LICENSE.md` on
  the same terms as this repository, and as written the guard refuses them.
  `report-data-provider`'s pull request extends this record or supersedes it.

**Added 2026-10-15: the first exception.** `@formancy/report-render-pdf`
stopped the guard on `png-js` 1.1.0, as predicted above: it reaches the
renderer through pdfmake and PDFKit, and its package.json has no `license`
field. The `LICENSE` it ships is the MIT License, Copyright (c) 2017 Devon
Govett, read that day, and `EXCEPTIONS` records it at that exact version.
The renderer embeds the four Roboto files the guard reads; the browser
entry's copy of them in `vfs_fonts.js` is held to the same bytes by the
renderer's own tests.

**Added 2026-10-16: Formancy Data's packages, admitted for the provider.**
`@formancy/report-data-provider` stopped the guard on
`@formancy/data-client` 0.1.0 and `@formancy/data-core` 0.1.0, as predicted
above, because both declare `SEE LICENSE IN LICENSE.md`.

They are admitted by `FORMANCY_DATA` in the script, not as exceptions.
Data's terms are source-available, which the policy refuses from anybody
else, and an exception may not record a licence the list refuses. The
exception is narrow because the rightsholder and the terms are this
repository's own.

An admission has these rules:
- it is keyed to an exact version;
- it holds only when the digest of the file the pointer names is the one
  the review read, the Formancy Data Source-Available Licence Version 1.1;
- it holds only when the package that depends on Data is the provider;
- one that nothing installs is refused.

To make that comparable, the walk now records the digest of the file
behind every `SEE LICENSE IN` pointer it meets. Why the provider may
depend on Data, and what that costs a customer, is
[0016](0016-the-data-provider-reads-formancy-data-0-1-0-best-effort.md).

**Added 2026-10-17: Liberation Sans 2's sentence.**
`@formancy/report-render-pdf` now ships Liberation Sans 2.1.5, the face a
Swiss QR-bill's slip prints in ([0022](0022-a-report-carries-one-swiss-qr-bill-at-the-foot-of-its-last-page.md)). Its name tables say "Licensed
under the SIL Open Font License, Version 1.1", shorter than the sentence
the OFL's FAQ suggests, so the guard refused the renderer's own fonts.
It now reads that sentence too as OFL-1.1, at version 1.1 exactly: a
1.0, which the policy does not allow, or a 1.10 is read as nothing.
Liberation Sans 1, whose sentence is "Licensed under the Liberation Fonts
license", is still refused, and so is `pdfjs-dist`'s copy of it.
`dependency-licences.test.mjs` holds the sentence, the versions it is not,
and the renderer's two files read as OFL-1.1 at Version 2.1.5. The
browser entry's copy of them, base64 in a chunk of its build, is a font
inside a script, which the guard does not see; the renderer's
`browser.test.ts` holds it to the files' bytes.

**Added 2026-10-18: ICC profiles.** An e-invoice is drawn as a PDF/A-3b
whose output intent is the ICC profile PDFKit ships, so every e-invoice a
customer sends embeds it
([0031](0031-an-e-invoice-is-drawn-as-a-pdf-a-3b-that-embeds-its-xml.md)).
A profile names its copyright holder in its header and its `cprt` tag, not
its terms, so the guard reads no licence from one. It finds every `.icc`
and `.icm` file, and every file whose header has `acsp` at byte 36,
whatever it is called, outside the names it never opens, and refuses one
whose SHA-256 is not in `ICC_PROFILES`, a list of reviewed profiles, each
with what it is, the licence sentence the review read and where. A review
nothing installs is refused, and so is one without its sentence. The list
holds one: the International Color Consortium's sRGB2014, which PDFKit
0.19.1 ships as `js/data/sRGB_IEC61966_2_1.icc`, compared byte for byte
with the ICC's own file on 17 October 2026, under the ICC's licence for
its profiles, "may be copied, distributed, embedded, made, used, and sold
without restriction". It is keyed by digest and not by package: the
licence is the profile's whoever ships it, and one a byte off is a profile
nobody has read. `dependency-licences.test.mjs` holds each rule, and the
real tree's one profile. pdfmake's browser build carries the same profile
as base64 inside a script, which the guard does not see, beside the fonts
it carries so; the renderer's `browser.test.ts` holds that copy to the
reviewed digest. A profile inside a script or an image is one more thing
this record's costs list as unseen.

## Alternatives considered

**pnpm's own `pnpm licenses list`.** Rejected. On 2026-10-14, pnpm 12.4.2's
`pnpm licenses list --prod` for the corpus listed `pdfjs-dist` alone,
without the `@napi-rs/canvas` installed beside it as its optional
dependency. It reported `png-js` 1.1.0 as MIT from its `LICENSE` file, which
is right this time and a guess from wording every time. It reads no fonts,
and its output is pnpm's to change.

**A third-party licence checker.** Rejected: a dependency of the guard
itself, with its own supply chain, to replace a few hundred lines of Node
built-ins, and still no fonts.

**A deny-list of copyleft families.** Rejected. It refuses only what
somebody thought of, where an allow-list refuses whatever nobody has read.

**Inferring a licence from `LICENSE` text when the field is missing.**
Rejected. Matching wording passes for the wrong reason the day the wording
appears elsewhere. An exception records a person's reading, with its
evidence.

**Review alone, as before.** Rejected, on `CLAUDE.md`'s terms: a guard from
the first third-party runtime dependency. A guard that is not a gate is a
comment.
