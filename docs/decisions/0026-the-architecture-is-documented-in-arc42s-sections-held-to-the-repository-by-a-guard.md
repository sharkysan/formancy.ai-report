# 0026 — The architecture is documented in arc42's twelve sections, held to the workspace, the records and the files they name by a guard

- **Status:** accepted
- **Date:** 2026-10-17
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **`scripts/architecture.test.mjs`**, in `pnpm test:repo`. On fixtures,
    it proves its reading:
    - every address GitHub follows, in a table cell, a list or a quote;
    - each link refused: to nothing, to a directory, from the root, to a
      heading that is not there;
    - which code spans are paths, and each path found or refused: by its
      ending, as a directory, as a glob, from the document, out of the
      checkout;
    - each row of the building blocks held to a manifest: a package with
      no row, a row that names none, a dependency in the wrong column;
    - the workspace's globs, and a shape it does not read.

    On the real tree it fails when:
    - a section or `docs/README.md` is missing, or `docs/architecture/`
      holds another file;
    - the entry does not link every section;
    - a workspace package or app has no row in `05-building-blocks.md`,
      or its row's dependencies, peers or packages from elsewhere are not
      its manifest's;
    - a decision record is linked from no section;
    - a relative link in the entry or a section reaches no file, or a
      fragment no heading;
    - a path written there as code names nothing the checkout holds.
  - **`scripts/heading-anchors.test.mjs`**, in `pnpm test:repo`: the one
    reading of GitHub's heading anchors, on the headings its former copies
    read differently. The product pages' own case of it,
    `apps/pages/src/checks.test.ts`, runs against the same module.

  **Watched failing** on 17 October 2026, each defect planted in the real
  files and put back byte for byte, `sha256` over `docs/` and `scripts/`
  compared before and after. The section, entry, record and link rules
  were watched failing when the guard was written; the plants below are
  this record's:
  - a dependency taken out of a row, one added that the manifest does not
    declare, a peer moved into "From elsewhere", and a row taken out while
    the package's heading still named it;
  - a test file the quality scenarios name, renamed in the text;
  - `dist/` written as code;
  - the shared reading broken three ways: marks dropped, a heading's
    source read instead of its words, and entities left as written. The
    second failed the product pages' case too.

  A manifest's dependency was not changed to watch a row fail: an edit to
  a manifest rewrites `pnpm-lock.yaml`. The fixture with a dependency in
  the wrong column is that case.

  **Not checked:**
  - whether a sentence is true of the record it links;
  - which layer a package stands in: a dependency that points upward
    passes once its row names it;
  - which package a bare file name is in, since a path is found wherever
    it ends;
  - that the anchors are GitHub's: the rule is the one the three copies
    described, and no page GitHub rendered was compared.

## Context

Until this record the architecture was the decision records, the packages'
READMEs and `CLAUDE.md`. Nothing said in one place what each package may
import, how a report goes from data to a PDF, what a host needs, or what
each gate proves and does not. The rightsholder asked for every change to
be documented, and whether the repository had arc42 and ADRs: it had the
records alone.

formancy.ai documents its architecture in arc42's twelve sections under
`docs/architecture/`, and its `CLAUDE.md` asks a change to update the
section it touches. That rule alone would not hold here. This repository's
`CLAUDE.md` asks that a claim in prose be backed by something that fails,
and the first draft of these sections showed why: review found it saying
"every package is placed" where the guard accepted a package named as code
anywhere in the building blocks, a sentence included, and versions typed
into the table that the next upgrade would make wrong without a failure.

Three checks here followed a link into a Markdown file, each with its own
copy of GitHub's heading anchors: the guide's guard, the product pages'
link check and the architecture's. On `## A [link](x.md) — and &amp; more`
they gave `a-linkxmd--and-amp-more`, `a-link--and-amp-more` and
`a-link--and--more` (measured on 17 October 2026 against the copies on
`main`).

## Decision

The architecture is documented in arc42's twelve sections, under the file
names formancy.ai gives them, in `docs/architecture/`, which holds nothing
else, entered from `docs/README.md`. A statement of design links the record
that argues it, and every record is linked from a section. The building
blocks' table has one row for each workspace package and app, whose
columns of dependencies name, as code, what its manifest declares, with no
version: the README's generated table gives those. A path written as code
names something the checkout holds. `scripts/architecture.test.mjs` holds
all of it in `pnpm test:repo`, and `CLAUDE.md` asks a change for the section
it touches.

GitHub's heading anchors are read once, by `scripts/heading-anchors.mjs`,
which the three checks import.

## Consequences

**What it buys.**
- **One place.** What may import what, the flows, what a host needs and
  what each gate proves are written down, each with its record.
- **A change that leaves them behind fails.** A package, a dependency, a
  record, or a file the sections name, added or renamed without the
  sections, fails `pnpm test:repo` until they say so.
- **One anchor rule.** A link one check passes, the others pass.

**What it costs.**
- **Every change pays a little.** A new record needs a link from a section,
  a dependency changed needs its row changed, and a renamed file the
  sections name needs the name changed, each in the same pull request.
- **Only the twelve files.** A picture of the architecture cannot live
  beside them: a diagram is text in a code block, or a file elsewhere.
- **Files of other repositories and packages are not written as code**
  unless as a specifier, `@formancy/themes/workbench.css`, which the guard
  does not read as a path; pdfmake's vfs_fonts.js is plain text there.
- **The guard needs git.** It lists the checkout with `git ls-files`, so it
  fails outside a git checkout.
- **Versions are one link away.** The building blocks name dependencies,
  and a reader follows the link to the README's table for their versions.
- **A second reading remains.** `apps/pages/scripts/inputs.mjs` derives the
  anchor of the changelog's release heading without a Markdown parser, for
  the pages' build; the pages' link check holds what it derives to the
  shared rule.
- **The pages' suite reads Markdown with `marked`,** the root's
  devDependency, through the shared module, where it read lines before. A
  heading underlined rather than marked is now a heading to it, as it is
  to GitHub.

**What it forecloses.** Images and other files in `docs/architecture/`,
and section files named otherwise than formancy.ai's.

## Alternatives considered

**The records and the READMEs alone, as before.** Rejected: nothing said
in one place what each package may import, and the rightsholder asked for
the architecture to be documented.

**arc42 held by review alone,** as formancy.ai's `CLAUDE.md` asks for its
sections. Rejected, on this repository's rule that a claim in prose is
backed by something that fails; review alone let the first draft say more
than its guard checked.

**The building blocks generated from the manifests,** as `codecov.yml` is.
Rejected: the table's last column is prose about why, which no manifest
holds, and a generated table beside a written one is two tables. The
versions are already derived, in the README.

**Versions typed in the table, and checked.** Rejected: a number typed is a
number to keep in step, which the README's generated table already does.

**A package named anywhere in the building blocks.** What the guard first
checked. Rejected when review planted a package named only in a sentence,
and a row taken out while a heading still named the package, and both
passed.

**A modelling tool,** C4 in Structurizr or the like. Rejected: another tool
and format, with a dependency of its own, for diagrams that are text here.
