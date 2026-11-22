import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, test } from 'vitest'
import { headingAnchors } from './heading-anchors.mjs'
import { BODY_LIMIT, bodyNotes, bodySection, releaseBody, releaseNotes, sectionAnchor } from './release-notes.mjs'

const changelog = ['# Changelog', '', '## Unreleased', '', 'pending', '', '## 0.1.0 — 2026-11-01', '', 'first', '', '## [0.0.1] — 2026-10-08', '', 'zero'].join(
  '\n',
)

/** A release whose section folds its detail under a summary, as 0080 has a long one written. */
const folded = [
  '# Changelog',
  '',
  '## Unreleased',
  '',
  '## 0.2.0 — 2026-11-20',
  '',
  '**In short.**',
  '',
  '- one',
  '',
  '<details>',
  '<summary>Everything, with the reasons</summary>',
  '',
  'the detail',
  '',
  '</details>',
  '',
  ...changelog.split('\n').slice(6),
].join('\n')

const where = { repository: 'https://github.com/owner/repo', ref: 'v0.2.0' }

/** This checkout's CHANGELOG.md, LF, as git holds it. */
const committed = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'CHANGELOG.md'), 'utf8').replaceAll('\r\n', '\n')

/** The newest release CHANGELOG.md has a section for: the next one a tag publishes, or the last one it did. */
const newest = /^## (\d+\.\d+\.\d+) — \d{4}-\d{2}-\d{2}$/m.exec(committed)?.[1]

describe('releaseNotes', () => {
  // The body of a GitHub release is one version's section, and the release
  // step is the last one -- after the packages are on npm. An empty body there
  // is the failure this exists to prevent, so a missing section throws.
  test('throws when the version has no section', () => {
    expect(() => releaseNotes(changelog, '0.2.0')).toThrow(/no section for 0\.2\.0/)
  })

  // Both heading spellings the changelog uses, and the section stops at the
  // next release rather than running to the end of the file.
  test('returns exactly one version, in either heading spelling', () => {
    expect(releaseNotes(changelog, '0.1.0')).toBe('## 0.1.0 — 2026-11-01\n\nfirst')
    expect(releaseNotes(changelog, '0.0.1')).toBe('## [0.0.1] — 2026-10-08\n\nzero')
  })

  // "0.1.0" must not match a heading for "0.1.0-rc.1".
  test('does not match a version that merely starts with the digits', () => {
    const withRc = changelog.replace('## 0.1.0 —', '## 0.1.0-rc.1 —')
    expect(() => releaseNotes(withRc, '0.1.0')).toThrow()
  })
})

describe('releaseBody', () => {
  // The body is the version's notes, then what the release was tested on:
  // the release report's summary, under a heading of its own (0014).
  test('appends the report summary to the section', () => {
    expect(releaseBody(changelog, '0.1.0', '12 of 12 tests passed.\n')).toBe(
      '## 0.1.0 — 2026-11-01\n\nfirst\n\n## What this release was tested on\n\n12 of 12 tests passed.\n',
    )
  })

  // GitHub refuses a body over 125,000 characters with a 422 -- after npm
  // already holds the version, if nothing refused it first.
  test('throws over the 125,000 characters GitHub accepts, and not at them', () => {
    const fits = '## Unreleased\n\n' + 'x'.repeat(BODY_LIMIT - 64)
    const body = releaseBody(fits, 'Unreleased', 's')
    expect(body.length).toBeLessThanOrEqual(BODY_LIMIT)
    const padded = fits + 'x'.repeat(BODY_LIMIT - body.length)
    expect(releaseBody(padded, 'Unreleased', 's').length).toBe(BODY_LIMIT)
    expect(() => releaseBody(`${padded}x`, 'Unreleased', 's')).toThrow(/is 125001 characters, over the 125000/)
  })

  // 0.3.0's section was 170,841 characters, past what GitHub accepts, so
  // its tag would have failed the report job after every gate was green
  // (0080). A section that folds its detail under a summary is released as
  // the summary and one line to the whole section in CHANGELOG.md at the
  // tag, where every reason is still read.
  test('carries a folded section’s summary and a link to the whole section at its tag', () => {
    expect(releaseBody(folded, '0.2.0', 's', where)).toBe(
      [
        '## 0.2.0 — 2026-11-20',
        '',
        '**In short.**',
        '',
        '- one',
        '',
        'Every change, with its reason, is in [the whole section](https://github.com/owner/repo/blob/v0.2.0/CHANGELOG.md#020--2026-11-20) of CHANGELOG.md at `v0.2.0`.',
        '',
        '## What this release was tested on',
        '',
        's',
        '',
      ].join('\n'),
    )
  })

  // 0.1.0's and 0.2.0's bodies were released whole, and a section that
  // folds nothing is still read whole: the cut is the section's own, never
  // a length the body happened to reach.
  test('carries a section that folds nothing whole, with no link', () => {
    expect(bodyNotes(changelog, '0.1.0', where)).toBe(releaseNotes(changelog, '0.1.0'))
    expect(releaseBody(changelog, '0.1.0', 's', where)).toBe('## 0.1.0 — 2026-11-01\n\nfirst\n\n## What this release was tested on\n\ns\n')
    // A fold inside a list item folds part of an entry, not the section.
    const inEntry = changelog.replace('first', '- first\n\n  <details>\n\n  more\n\n  </details>')
    expect(bodyNotes(inEntry, '0.1.0', where)).toBe(releaseNotes(inEntry, '0.1.0'))
    for (const released of ['0.1.0', '0.2.0']) expect(bodyNotes(committed, released, where)).toBe(releaseNotes(committed, released))
  })

  // The summary alone can still be too long, and a body that is must fail
  // the report job, as a whole section did.
  test('throws when a folded section’s summary is over the limit', () => {
    const long = folded.replace('- one', `- ${'x'.repeat(BODY_LIMIT)}`)
    expect(() => releaseBody(long, '0.2.0', 's', where)).toThrow(/over the 125000 GitHub accepts/)
  })

  // A link to the whole section with no repository or tag would send a
  // reader nowhere, from a release that has dropped the detail.
  test('refuses to fold a section it cannot link', () => {
    expect(() => releaseBody(folded, '0.2.0', 's', { repository: '', ref: 'v0.2.0' })).toThrow(/cannot link the whole section/)
    expect(() => releaseBody(folded, '0.2.0', 's', { repository: where.repository })).toThrow(/cannot link the whole section/)
  })

  // A link whose anchor GitHub does not give the heading lands at the top
  // of a 300,000-character file. The anchor is the heading's by the one
  // rule the repository's link checks share (heading-anchors.mjs), which
  // release-notes.mjs cannot import: the release's check job runs Node
  // alone, with no marked installed.
  test('links an anchor GitHub gives the section’s heading', () => {
    expect(newest).toBeDefined()
    expect(headingAnchors(committed)).toContain(sectionAnchor(committed, newest))
    expect(headingAnchors(committed)).toContain(sectionAnchor(committed, 'Unreleased'))
  })

  // The tag of the newest release builds its body from this checkout's
  // section, and a body past the limit fails the release after every gate
  // passed, while CI, which only measures it, stays green. The summary the
  // report adds was 2,531 characters for 0.2.0, as its GitHub release holds
  // it, read on 22 November 2026; this leaves ten times that.
  test('fits the newest release’s body, with room for the report’s summary', () => {
    const body = releaseBody(committed, newest, 'x'.repeat(25_310), { repository: where.repository, ref: `v${String(newest)}` })
    expect(body.length).toBeLessThan(BODY_LIMIT)
  })
})

describe('bodySection', () => {
  // A rehearsal on the release commit must render the body that will be
  // released, so it uses the version's section once the changelog has one.
  test('rehearses with the version’s section when there is one, and Unreleased otherwise', () => {
    expect(bodySection(changelog, { release: 'dry-run', version: '0.1.0' })).toBe('0.1.0')
    expect(bodySection(changelog, { release: 'dry-run', version: '0.2.0' })).toBe('Unreleased')
    expect(bodySection(changelog, { release: '', version: '0.2.0' })).toBe('Unreleased')
  })

  // A tag's notes are the tag's version's, whatever else the changelog holds.
  test('releases a tag with its version’s section', () => {
    expect(bodySection(changelog, { release: 'v0.0.1', version: '0.1.0' })).toBe('0.0.1')
  })
})
