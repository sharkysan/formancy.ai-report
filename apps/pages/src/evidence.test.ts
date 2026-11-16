import { describe, expect, test } from 'vitest'
import { EVIDENCE_KIND, evidenceProblems } from './checks/evidence.js'
import { GROUPS } from './groups.js'
import { LANGUAGES } from './languages.js'
import type { Language } from './languages.js'
import type { Card, Evidence, PageGroup } from './pages.js'
import { builtOf, editing, site } from './test-site.js'

/**
 * Every card on the site names the tests its claim rests on, and the check
 * holds each to the checkout and the page to its group (checks/evidence.ts):
 * the site the build writes, and the site with one card's evidence or one
 * page's cards changed the way a later edit could change them.
 */

/**
 * `groups` with the evidence of group `id`'s card at `index` replaced: in
 * `language` alone, or in every language as one list, as a copy writes it.
 * A change that matched no card would test the unbroken site and pass for
 * the wrong reason, so it is refused.
 */
function withEvidence(groups: readonly PageGroup[], id: string, index: number, evidence: Evidence, language?: Language): PageGroup[] {
  let changed = false
  const changedCards = (cards: readonly Card[], each: Language): Card[] =>
    cards.map((card, at) => {
      if (at !== index || (language !== undefined && each !== language)) return card
      changed = true
      return { ...card, evidence }
    })
  const next = groups.map((group) =>
    group.id === id
      ? { ...group, cards: Object.fromEntries(LANGUAGES.map((each) => [each, changedCards(group.cards[each], each)])) as Record<Language, Card[]> }
      : group,
  )
  if (!changed) throw new Error(`${id} has no card ${String(index + 1)}${language === undefined ? '' : ` in ${language}`}`)
  return next
}

/** `groups` with group `id`'s cards taken away in every language, and the rest as they are. */
const withoutCards = (groups: readonly PageGroup[], id: string): PageGroup[] =>
  groups.map((group) => (group.id === id ? { ...group, cards: { de: [], fr: [], it: [], en: [] } } : group))

describe('the evidence every card names', () => {
  // The claims the pages make, each resting on files of this checkout: a
  // card added without its tests, or a test renamed or removed, leaves a
  // claim nobody checks (as 0028 held the EPC QR code page's cards, now
  // for every card).
  test('finds nothing wrong on the site the build writes', () => {
    expect(evidenceProblems(builtOf(site), GROUPS)).toEqual([])
  })

  // existsSync is true of a directory, and a source file or a README
  // exists and proves nothing.
  test('names evidence the checkout lacks, a directory, and a file that is no test or gate', () => {
    for (const [path, why] of [
      ['packages/report-spec/src/qr-bill.gone.test.ts', /no file of the checkout/],
      ['packages/report-spec/src', /not a test or a gate/],
      ['packages/report-spec/src/qr-bill.ts', /not a test or a gate/],
      ['packages/report-spec/README.md', /not a test or a gate/],
    ] as const)
      expect(evidenceProblems(builtOf(site), withEvidence(GROUPS, 'qr-bill', 0, [path]))).toEqual([expect.stringMatching(why)])
  })

  // A translation that rests a card on other tests says another claim than
  // the English.
  test('names a card whose evidence differs in one language', () => {
    expect(evidenceProblems(builtOf(site), withEvidence(GROUPS, 'qr-bill', 1, ['packages/report-spec/src/qr-bill.test.ts'], 'fr'))).toEqual([
      expect.stringMatching(/qr-bill: card 2 rests on other files in fr than in en/),
    ])
  })

  // A list copied into a translation, word for word, agrees with the
  // English until the next edit of one of them: the lists are compared as
  // the one list each copy declares once, not by what they hold today.
  test('names a card whose evidence is a copy in one language, even one that holds the same files', () => {
    const english = GROUPS.find((group) => group.id === 'qr-bill')?.cards.en[1]?.evidence
    if (english === undefined) throw new Error('the QR-bill page has no second card')
    expect(evidenceProblems(builtOf(site), withEvidence(GROUPS, 'qr-bill', 1, [...english], 'it'))).toEqual([
      expect.stringMatching(/qr-bill: card 2 rests on other files in it than in en/),
    ])
  })

  // The kinds a card may rest on, each said once: a test wherever the
  // workspace keeps one, and a gate's entry by its name. Nothing beside
  // them passes -- a script that is no gate, a gate's data, a file of
  // another kind, a path that climbs out of where it says it is -- so a
  // card cannot rest on what proves nothing because it sits near a test.
  test('admits a test and the entry of a gate CI runs, and nothing beside them', () => {
    const admitted = [
      'packages/report-spec/src/qr-bill.test.ts',
      'apps/studio/src/preview/pdf-view.test.tsx',
      'apps/pages/scripts/inputs.test.mjs',
      'scripts/install-hosts.test.mjs',
      'scripts/release-report/collect.test.mjs',
      'scripts/install-test.mjs',
      'scripts/e-invoice.mjs',
      'scripts/dependency-licences.mjs',
      'apps/studio/scripts/browser-test.mjs',
      'apps/studio/scripts/gate-images.mjs',
    ]
    const refused = [
      'scripts/install-hosts.mjs',
      'scripts/e-invoice/accepted.json',
      'apps/studio/scripts/pictures.mjs',
      'packages/report-spec/scripts/browser-test.mjs',
      'apps/studio/src/gate-images.mjs',
      'packages/report-spec/src/qr-bill.test.js',
      'packages/report-spec/src/../../../scripts/codecov-config.test.mjs',
      'docs/release/gates.test.mjs',
      '/packages/report-spec/src/qr-bill.test.ts',
    ]
    expect(admitted.filter((path) => !EVIDENCE_KIND.test(path))).toEqual([])
    expect(refused.filter((path) => EVIDENCE_KIND.test(path))).toEqual([])
  })

  // A card drawn from somewhere other than the group's cards would carry no
  // evidence and pass.
  test('names a page that shows another card than its group declares', () => {
    expect(evidenceProblems(builtOf(editing('de/qr-rechnung/index.html', (html) => html.replace(/<li class="card">[\s\S]*?<\/li>/, ''))), GROUPS)).toEqual([
      expect.stringMatching(/^de\/qr-rechnung\/index\.html: shows the cards/),
    ])
  })

  // A topic page the start page introduces, declaring no card, makes its
  // claims with nothing under them: the files and the languages above are
  // checked over a list that is empty, and a page drawn without cards would
  // show what it declares.
  test('names a topic page that declares no card', () => {
    expect(evidenceProblems(builtOf(site), withoutCards(GROUPS, 'healthcare'))).toEqual([
      'healthcare: its teaser introduces a page that shows no card',
      ...['de/gesundheitswesen', 'fr/sante', 'it/sanita', 'en/healthcare'].map((page) =>
        expect.stringMatching(new RegExp(`^${page}/index\\.html: shows the cards \\[.+\\], and its group declares \\[\\]$`)),
      ),
    ])
  })
})
