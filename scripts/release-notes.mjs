// The body of a GitHub release: one version's section of CHANGELOG.md.
// formancy.ai-data adds what its release report says the release was tested
// on (its 0035); that summary arrives here with the report.
//
// GitHub refuses a release body over 125,000 characters, and the changelog
// grows by a long paragraph a change. So the body is one section, never the
// whole file, and it is built and measured in release.yml's `check` job,
// before anything is published: a body too long, or a version with no
// section, fails that job rather than the last step of a release, after npm
// already holds the version.
//
//   node scripts/release-notes.mjs --release <tag|dry-run> --version <x.y.z> <output file>
//
// Held by scripts/release-notes.test.mjs.

import { readFileSync, writeFileSync } from 'node:fs'

/** The most characters GitHub accepts in a release body. */
export const BODY_LIMIT = 125_000

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
 * The release body: `section` of the changelog and nothing else. Throws when
 * the section is missing or the body is over BODY_LIMIT.
 */
export function releaseBody(changelog, section) {
  const body = `${releaseNotes(changelog, section)}\n`
  if (body.length > BODY_LIMIT) {
    throw new Error(`the release body is ${String(body.length)} characters, over the ${String(BODY_LIMIT)} GitHub accepts`)
  }
  return body
}

if (process.argv[1]?.replaceAll('\\', '/').endsWith('scripts/release-notes.mjs')) {
  const argv = process.argv.slice(2)
  const option = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : undefined)
  const release = option('--release')
  const version = option('--version')
  const out = argv.at(-1)
  if (release === undefined || version === undefined || out === undefined || out.startsWith('--') || out === version || out === release) {
    throw new Error('usage: release-notes.mjs --release <tag|dry-run> --version <x.y.z> <output file>')
  }
  const changelog = readFileSync('CHANGELOG.md', 'utf8')
  const section = bodySection(changelog, { release, version })
  const notes = releaseBody(changelog, section)
  writeFileSync(out, notes, 'utf8')
  console.log(`release notes: ${String(notes.length)} characters for ${section} -> ${out}`)
}
