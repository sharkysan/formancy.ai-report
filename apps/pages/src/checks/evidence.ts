/**
 * The claims the pages make, held to what holds them: every card a page
 * shows is one its group declares, in its order, and each card names the
 * tests it rests on -- files of this checkout, each a test or the entry of
 * a gate CI runs -- one list for the card in every language (0028's
 * `CARD_EVIDENCE`, for every card of the site). That a file is there, and
 * is a test, is this check's; whether it still tests what its card says is
 * review's.
 */
import { LANGUAGES } from '../languages.js'
import type { PageGroup } from '../pages.js'
import type { Built } from './read.js'
import { read, textOf } from './read.js'

/** A path's segment, a file's or a directory's, never `.` or `..`: no path climbs out of where it says it is. */
const SEGMENT = String.raw`[\w-][\w.-]*`

/** A test file of a package, an app or the repository's scripts, which the release report fails a run for not running in its suite. */
const TEST = String.raw`(?:packages/${SEGMENT}/|apps/${SEGMENT}/|scripts/)(?:${SEGMENT}/)*${SEGMENT}\.test\.(?:ts|tsx|mjs)`

/** The entry of a gate CI runs and the release report reads: the install gate, the e-invoice gate, the dependency licences', and an app's browser gate and the parts it runs. */
const GATE = String.raw`scripts/(?:install-test|e-invoice|dependency-licences)\.mjs|apps/${SEGMENT}/scripts/(?:browser-test|gate-${SEGMENT})\.mjs`

/**
 * What a card may rest on: a test, or a gate's entry. Not a directory, a
 * source file or a README, each of which exists and proves nothing.
 */
export const EVIDENCE_KIND = new RegExp(`^(?:${TEST}|${GATE})$`)

/** `text` with its whitespace collapsed, as textOf reads a heading: a French no-break space a space. */
const collapsed = (text: string): string => text.replaceAll(/\s+/g, ' ').trim()

export function evidenceProblems({ site, exists }: Built, groups: readonly PageGroup[]): string[] {
  const problems: string[] = []
  for (const { id, cards, teaser } of groups) {
    // Each list is read once, on the English card, which every other
    // language's card shares.
    cards.en.forEach((card, index) => {
      for (const path of card.evidence) {
        const rests = `${id}: card ${String(index + 1)} ("${card.title}") rests on ${path}`
        if (!exists(path)) problems.push(`${rests}, no file of the checkout`)
        else if (!EVIDENCE_KIND.test(path)) problems.push(`${rests}, not a test or a gate CI runs`)
      }
    })
    // By reference: a list each copy writes once, so a translation that
    // copied it, even word for word, is one edit away from another claim.
    const most = Math.max(...LANGUAGES.map((language) => cards[language].length))
    for (let index = 0; index < most; index++) {
      for (const language of LANGUAGES) {
        if (language !== 'en' && cards[language][index]?.evidence !== cards.en[index]?.evidence)
          problems.push(`${id}: card ${String(index + 1)} rests on other files in ${language} than in en`)
      }
    }
    if (teaser !== undefined && LANGUAGES.some((language) => cards[language].length === 0))
      problems.push(`${id}: its teaser introduces a page that shows no card`)
  }
  // A topic card, `li.card.topic`, introduces a page and claims nothing
  // that page's own cards do not: it is none of the page's claims.
  for (const page of site.pages.map(read)) {
    const declared = (groups.find((group) => group.id === page.group)?.cards[page.language] ?? []).map((card) => collapsed(card.title))
    const shown = [...page.document.querySelectorAll('main li.card:not(.topic) h3')].map(textOf)
    if (JSON.stringify(shown) !== JSON.stringify(declared))
      problems.push(`${page.file}: shows the cards ${JSON.stringify(shown)}, and its group declares ${JSON.stringify(declared)}`)
  }
  return problems
}
