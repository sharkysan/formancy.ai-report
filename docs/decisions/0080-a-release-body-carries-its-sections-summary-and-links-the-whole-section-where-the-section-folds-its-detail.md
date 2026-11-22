# 0080 — A release body carries its section's summary, and links the whole section, where the section folds its detail

- **Status:** accepted; numbered while 0069 was held for a workbook's
  export and 0070 to 0073 by another branch; extends
  [0014](0014-a-release-report-is-derived-from-the-run-that-gated-it.md),
  whose release body carried the version's whole section
- **Date:** 2026-11-22
- **Deciders:** Daniel Bacher
- **Verified by:**
  - **`scripts/release-notes.test.mjs`**, in `pnpm test:repo`:
    - a section that folds its detail gives its summary and one line
      linking the whole section in CHANGELOG.md at its tag;
    - a section that folds nothing gives the whole section and no link,
      0.1.0's and 0.2.0's sections as this checkout holds them among them,
      and so does one that folds part of an entry inside a list item;
    - a folded section whose summary alone is over 125,000 characters
      still throws;
    - a section that folds its detail with no repository or tag to link
      it at is refused;
    - the anchor the link names is one GitHub gives the heading, held to
      `scripts/heading-anchors.mjs`, the rule every link check here
      shares, for the changelog's newest release and its Unreleased;
    - and the newest release's body fits, with room for a report's
      summary ten times 0.2.0's.

    Each was watched failing first: the first, second, fourth and fifth
    before `bodyNotes` and `sectionAnchor` existed; the first and fourth
    again with the fold read as absent; the third and the limit's own
    case with the limit's check removed; the first and fifth with each
    run of spaces in the anchor made one hyphen; the second with a fold
    read at any indentation; and the last with Unreleased renamed
    `0.3.0 — 2026-11-22` before its detail was folded, when the body was
    196,198 characters.
  - **`scripts/release-report/report.test.mjs`**, "links a folded section
    at its tag, and Unreleased at the commit": a tag and a rehearsal link
    the version's tag, and CI on a commit whose version has no section
    links Unreleased at the run's commit. Watched failing before
    `releaseOf` handed the body a repository and a ref.
  - **`scripts/release-report/render.test.mjs`**: the report's summary
    says the notes above are *from* the section. Watched failing before
    the word was added.
  - **The `report` job** in `.github/workflows/gates.yml`, on a tag and a
    rehearsal, fails the run on a body past the limit, as 0014 decided;
    `verify-publish.mjs`'s `notesProblems` refuses one missing or too long
    in `check`, and asks nothing else of its shape, so it holds the new
    body as it held the old.

  **Not mechanically enforced, and said:** that a summary says what its
  detail holds, which review alone reads; that a link from a rehearsal
  lands anywhere before the tag is pushed; and how GitHub renders the
  fold, which nothing here opens.

## Context

0014 made the release body the version's changelog section and the
report's summary, measured in the report job and refused there past the
125,000 characters GitHub accepts, so that a body too long fails before
anything is published. That held while a section fit: 0.2.0's was 94,920
characters.

0.3.0's did not. On 22 November 2026, `## Unreleased` on main at
`7894b8c6` was 2,488 lines and 170,841 characters. Three things followed:

- **CI stayed green.** In CI the report builds the body only to measure
  it, and nothing about it fails the run, so every pull request that
  lengthened the section passed.
- **The release would have failed after every gate passed.** On a
  rehearsal and on the tag, `releaseOf` turns the throw into a problem,
  and the report job fails the run; nothing is published, and the tag
  names a commit no release holds.
- **A fold saves nothing.** A `<details>` block folds text in a rendered
  file and in a release body alike, and GitHub counts its characters all
  the same.

The person asked for release notes that are short and understandable,
with the full detail kept.

## Decision

**A section may open with a summary and fold its detail into a
`<details>` block, and its release body carries the summary alone and
one line linking the whole section.**

- **Where the detail begins.** At the section's first line that is
  `<details>` alone, unindented. The body carries the section from its heading down to
  that line, then: "Every change, with its reason, is in [the whole
  section](…) of CHANGELOG.md at `<ref>`."
- **Where the link goes.** `<repository>/blob/<ref>/CHANGELOG.md#<anchor>`.
  The ref is the version's tag, `vX.Y.Z`: the one a release names, and
  the one a rehearsal's will, so that a rehearsal on the release commit
  renders the body that will be released, as 0014 asks. For Unreleased,
  which no tag names, it is the run's commit. A section that folds its
  detail with no repository or ref to link is refused.
- **The anchor.** GitHub's rule for a heading of plain text, computed in
  `release-notes.mjs` itself: `## 0.3.0 — 2026-11-23` is
  `030--2026-11-23`. `heading-anchors.mjs`, the one rule the link checks
  share, reads Markdown with marked, and the release's `check` job, which
  imports `BODY_LIMIT` from the same module, runs Node with nothing
  installed. The test holds this reading to that rule.
- **A section that folds nothing is carried whole.** 0.1.0's and 0.2.0's
  hold no `<details>`, so their bodies are as they were released.
- **The report's summary** says the notes above are *from* the section,
  true of either shape.
- **The limit is unchanged.** A body over 125,000 characters still fails
  the report job on a tag and a rehearsal, its summary alone included.

0.3.0's section opens with *In short*, a list of what an integrator can
do with the release in plain words, then folds every entry under
"Everything that changed in 0.3.0, with the reasons". Its body's notes are
7,161 characters, before the report's summary; the whole section is
178,727.

## Consequences

**What it buys.**

- **0.3.0 can be released**, with its section's every reason kept in
  CHANGELOG.md, and a release page a reader can take in.
- **The detail stays in one place.** The changelog is still the history,
  section by section; the release links it at the tag, where it says what
  the tag holds.
- **Nothing changes for a section that folds nothing.**
- **The newest release is held in `pnpm test:repo`.** A release commit
  whose section is too long fails every CI run, before a rehearsal is
  dispatched.

**What it costs.**

- **The release page no longer carries the reasons.** A reader of the
  release, its feed or the API meets the summary alone, and every reason
  is one link away.
- **A rehearsal links a tag not yet pushed.** The link lands nowhere until
  the tag exists; the body is built again on the tag's run.
- **The fold is a convention.** A `<details>` line written too early cuts
  the release body there, and nothing judges whether a summary is a fair
  account of its detail. `<details open>`, and a fold indented in a list
  item, which folds part of an entry, are not read as the boundary.
- **A second reading of GitHub's anchors.** `release-notes.mjs` reads a
  plain heading's anchor as `apps/pages/scripts/inputs.mjs` does, and
  the test holds it to the shared rule for the newest release and
  Unreleased only.
- **Before the release commit, nothing fails.** CI still only measures a
  body of Unreleased, so a long Unreleased with no fold passes every pull
  request until the release commit names it a version. The fit test reads
  the newest release's section, not Unreleased.

## Alternatives considered

- **Move the detail into a file of its own**, `docs/changes/0.3.0.md`,
  and keep a summary and a link in the changelog. Lost: the history would
  stand in two places from 0.3.0 on, and the changelog's sections would
  have two shapes with no rule saying which is which.
- **Shorten the entries** below about 120,000 characters. Lost: it drops
  the reasons the changelog's own header promises to keep.
- **Cut the body at the limit.** Lost: it ends in the middle of an entry,
  and drops what follows with nothing saying so.
- **A marker of its own**, `<!-- the release body ends here -->`. Lost: a
  reader of CHANGELOG.md does not see it, and the fold is needed anyway
  for the file to be readable, so the two could disagree.
- **Fail CI on a body too long for Unreleased too.** Lost: every pull
  request would fail while the section grows, before anyone writes its
  summary, which is the release commit's work.
- **Attach the whole section to the release as a file.** Lost: an asset
  is a download, not rendered, and the changelog at the tag is both.
