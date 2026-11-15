import { describe, expect, test } from 'vitest'
import { studioWordProblems } from './checks/studio-words.js'
import { GROUPS } from './groups.js'
import { builtOf, editing, site } from './test-site.js'

/**
 * The Studio's words a page names, held to the Studio's recorded pictures
 * and to the page (checks/studio-words.ts). 0024 and 0028 list the Studio's
 * words as held by nothing: a starter renamed in the Studio leaves a page
 * telling a reader to choose one that is not there, and `test:pictures`
 * holds captured.json to the Studio.
 */
describe('the Studio words the pages name', () => {
  // A page whose words drift from the Studio's, or a word a group names
  // that no recording holds, would pass unseen.
  test('finds nothing wrong on the site the build writes', () => {
    expect(studioWordProblems(builtOf(site), GROUPS)).toEqual([])
  })

  // A page that tells a reader to choose a starter the Studio does not
  // have sends them looking for what is not there.
  test('names a word the Studio does not say', () => {
    expect(
      studioWordProblems(
        builtOf(site),
        GROUPS.map((group) => (group.id === 'epc-qr-code' ? { ...group, studioWords: ['Euro bill'] } : group)),
      ),
    ).toEqual([expect.stringMatching(/"Euro bill", which no scene/), ...['de', 'fr', 'it', 'en'].map(() => expect.stringMatching(/does not say "Euro bill"/))])
  })

  // A page edited away from the word its group names would keep a claim
  // about the Studio it no longer makes.
  test('names a page that does not say its word', () => {
    const file = site.pages.find((page) => page.group === 'epc-qr-code' && page.language === 'en')?.file
    if (file === undefined) throw new Error('the EPC page has no English file')
    expect(studioWordProblems(builtOf(editing(file, (html) => html.replaceAll('Euro invoice', 'Euro bill'))), GROUPS)).toEqual([
      expect.stringMatching(/does not say "Euro invoice"/),
    ])
  })

  // A word that is only part of a name the Studio says ("Euro" in "Euro
  // invoice") is not the Studio's: matched without its quotes, a page could
  // name a starter that is no starter and pass.
  test('names a word that is only part of a quoted name', () => {
    expect(
      studioWordProblems(
        builtOf(site),
        GROUPS.map((group) => (group.id === 'epc-qr-code' ? { ...group, studioWords: ['Euro'] } : group)),
      ),
    ).toEqual([expect.stringMatching(/"Euro", which no scene/)])
  })
})
