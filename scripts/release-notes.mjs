// The body of a GitHub release: one version's section of CHANGELOG.md, and
// what the release report says the release was tested on (0014;
// formancy.ai-data 0035).
//
// GitHub refuses a release body over 125,000 characters, and the changelog
// grows by a long paragraph a change. So the body is one section and the
// report's summary, never the whole file, and it is built and measured in
// the gates workflow's report job, before anything is published: a body too
// long, or a version with no section, fails that job rather than the last
// step of a release, after npm already holds the version.
//
// A section can outgrow the limit on its own: 0.3.0's was 170,841
// characters before its summary was written. Such a section opens with a
// summary and folds its detail into a `<details>` block, and the body
// carries the section down to that block and one line linking the whole
// section in CHANGELOG.md at the release's tag (0080). A section that
// folds nothing is carried whole, as 0.1.0's and 0.2.0's were.
//
// Used by scripts/release-report/report.mjs, which writes the body a release
// attaches, and held by scripts/release-notes.test.mjs. Node's built-ins
// only: the release's check job imports BODY_LIMIT with nothing installed.

/** The most characters GitHub accepts in a release body. */
export const BODY_LIMIT = 125_000

/** The line a section's detail begins at, where it folds it: the first that is `<details>` alone, unindented, as a fold of the whole section is written. */
const DETAIL = '<details>'

/** Does this `## ` heading announce `version`? Both spellings the changelog uses. */
function announces(line, version) {
  if (!line.startsWith('## ')) return false
  const rest = line.slice(3).trim()
  // `## [0.1.0] — 2026-09-20` and `## 0.2.0 — 2026-09-28`, and nothing else: a
  // heading that merely starts with the digits ("0.2.0-rc1") is a different release.
  const named = rest.startsWith('[') ? rest.slice(1) : rest
  const after = named.slice(version.length)
  return named.startsWith(version) && (after === '' || after.startsWith(']') || after.startsWith(' '))
}

/** Whether CHANGELOG.md has a section for `version` (or `Unreleased`). */
export function hasSection(changelog, version) {
  return changelog.split('\n').some((line) => announces(line, version))
}

/**
 * The section for `version`, from its heading to the next top-level heading.
 *
 * **Throws** when the version has no section rather than returning an empty body: a
 * release whose notes are blank is the failure this exists to prevent, arriving
 * quietly instead of loudly.
 */
export function releaseNotes(changelog, version) {
  const lines = changelog.split('\n')
  const from = lines.findIndex((line) => announces(line, version))
  if (from === -1) {
    throw new Error(`CHANGELOG.md has no section for ${version}`)
  }

  const after = lines.slice(from + 1).findIndex((line) => line.startsWith('## '))
  const to = after === -1 ? lines.length : from + 1 + after

  return lines.slice(from, to).join('\n').trimEnd()
}

/**
 * The anchor GitHub gives `section`'s heading in CHANGELOG.md: its text
 * lowercased, everything but letters, digits, marks, spaces, hyphens and
 * underscores dropped, each space a hyphen -- `## 0.3.0 — 2026-11-22` is
 * `030--2026-11-22`. Not the rule for any heading, which reads Markdown
 * (heading-anchors.mjs) and would bring marked into a job that installs
 * nothing; a release heading is plain text, and the test holds what this
 * gives the changelog's to that rule.
 */
export function sectionAnchor(changelog, section) {
  const heading = changelog.split('\n').find((line) => announces(line, section))
  if (heading === undefined) throw new Error(`CHANGELOG.md has no section for ${section}`)
  return heading
    .slice(3)
    .trim()
    .toLowerCase()
    .replaceAll(/[^\p{L}\p{N}\p{M}\s_-]/gu, '')
    .replaceAll(/\s/g, '-')
}

/**
 * What a release body carries of `section`: the section whole when it folds
 * nothing, and otherwise the section down to its first `<details>` line,
 * then one line linking the whole section in CHANGELOG.md at `ref`, the
 * release's tag, in `repository`. **Throws** when the section folds its
 * detail and there is no repository or ref to link it at: a body that
 * dropped the detail must say where it is.
 */
export function bodyNotes(changelog, section, { repository, ref } = {}) {
  const notes = releaseNotes(changelog, section)
  const lines = notes.split('\n')
  const fold = lines.findIndex((line) => line.trimEnd() === DETAIL)
  if (fold === -1) return notes
  if (!repository || !ref) throw new Error(`the ${section} section folds its detail, and the release body cannot link the whole section: no repository or ref`)
  const url = `${repository}/blob/${ref}/CHANGELOG.md#${sectionAnchor(changelog, section)}`
  const summary = lines.slice(0, fold).join('\n').trimEnd()
  return `${summary}\n\nEvery change, with its reason, is in [the whole section](${url}) of CHANGELOG.md at \`${ref}\`.`
}

/**
 * The section a release's body opens with. On a tag, `vX.Y.Z`, the
 * version's. On a rehearsal (`dry-run`, and CI's `''`), the section of
 * `version` -- the root manifest's -- when the changelog has one, so a
 * rehearsal on the release commit renders the body that will be released,
 * and `Unreleased` otherwise.
 */
export function bodySection(changelog, { release, version }) {
  if (release !== '' && release !== 'dry-run') return release.replace(/^v/, '')
  return hasSection(changelog, version) ? version : 'Unreleased'
}

/**
 * The release body: what it carries of `section` of the changelog
 * (bodyNotes, linked at `where`), then what the release was tested on, as
 * the report summarises it. Throws when the section is missing, folds its
 * detail with nowhere to link it, or the body is over BODY_LIMIT.
 */
export function releaseBody(changelog, section, summary, where = {}) {
  const body = `${bodyNotes(changelog, section, where)}\n\n## What this release was tested on\n\n${summary.trim()}\n`
  if (body.length > BODY_LIMIT) {
    throw new Error(`the release body is ${String(body.length)} characters, over the ${String(BODY_LIMIT)} GitHub accepts`)
  }
  return body
}
