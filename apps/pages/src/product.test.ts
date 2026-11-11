import { describe, expect, test } from 'vitest'
import { PRODUCT_COPY } from './content/product-copy.js'
import { GROUPS } from './groups.js'
import { LANGUAGES } from './languages.js'
import { isRoot } from './pages.js'
import { site } from './test-site.js'

/** The product page's topic cards: what it says of each other page, and where. */
const productPages = site.pages
  .filter((page) => page.group === 'product')
  .map((page) => ({ ...page, document: new DOMParser().parseFromString(page.html, 'text/html') }))

/** Text with its whitespace collapsed, a no-break space a space, as the French pages set theirs. */
const collapsed = (text: string | null | undefined): string => (text ?? '').replaceAll(/\s+/g, ' ').trim()

describe('the product page introduces its topics', () => {
  // A topic listed only at the foot is met by a reader who has already
  // left: the cards come right after the hero, one per topic page, in the
  // order groups.ts gives.
  test('introduces every topic page with a card, in the order groups.ts gives, right after the hero', () => {
    expect(productPages).toHaveLength(LANGUAGES.length)
    for (const page of productPages) {
      const section = page.document.querySelectorAll('main > section')[1]
      expect([page.language, section?.getAttribute('aria-labelledby')]).toEqual([page.language, 'topics'])
      const base = `https://example.test/report/${page.language}/`
      const hrefs = [...page.document.querySelectorAll('section[aria-labelledby="topics"] li.topic a')].map(
        (link) => new URL(link.getAttribute('href') ?? '', base).href,
      )
      const expected = GROUPS.filter((group) => !isRoot(group)).map((group) => new URL(`${group.slug[page.language]}/`, base).href)
      expect([page.language, hrefs]).toEqual([page.language, expected])
    }
  })

  // A card that names a page and not where it stands sends a reader to a
  // page that may not have what they came for: the status is on the card.
  test("says on a topic's card where its page stands, for every page with a status", () => {
    const stated = GROUPS.filter((group) => group.status !== undefined)
    expect(stated.length).toBeGreaterThan(0)
    for (const page of productPages) {
      for (const group of stated) {
        const standing = group.teaser?.[page.language].standing
        expect([page.language, group.id, (standing?.split(/\s+/).length ?? 0) >= 4]).toEqual([page.language, group.id, true])
        const card = page.document.querySelector(`[aria-labelledby="topic-${group.id}"]`)
        expect([page.language, group.id, collapsed(card?.textContent)]).toEqual([page.language, group.id, expect.stringContaining(collapsed(standing))])
      }
    }
  })

  // The teasers once stood as bands at the foot, after the licence: said
  // twice they would drift, and the foot is where a reader no longer reads.
  test('keeps no teaser band at the foot', () => {
    for (const page of productPages) {
      expect([page.language, page.document.querySelectorAll('main > section[aria-labelledby^="topic-"]').length]).toEqual([page.language, 0])
    }
  })
})

describe('the product page shows its exact totals', () => {
  // Exact totals were one card among the start page's claims, its tests
  // under one heading: a section of its own holds each claim on its own
  // tests, and stands where a reader who has met the topics reads on,
  // before how the product behaves.
  test('shows exact totals between the topics and how it behaves, in every language', () => {
    expect(productPages).toHaveLength(LANGUAGES.length)
    for (const page of productPages) {
      const order = [...page.document.querySelectorAll('main > section')].map((section) => section.getAttribute('aria-labelledby'))
      expect([page.language, order.slice(0, 4)]).toEqual([page.language, ['top', 'topics', 'totals', 'behaves']])
      expect([page.language, new Set(order).size]).toEqual([page.language, order.length])
      expect([page.language, collapsed(page.document.getElementById('behaves')?.textContent)]).toEqual([
        page.language,
        collapsed(PRODUCT_COPY[page.language].behaves.heading),
      ])
    }
  })

  // A total said to be exact and not shown is a claim the reader has to
  // take on trust: the section points to the starters, whose pictures print
  // the totals. The link check holds the id it points to.
  test('points from the totals to the starters that print them', () => {
    for (const page of productPages) {
      const links = page.document.querySelectorAll('section[aria-labelledby="totals"] a[href="#examples"]')
      expect([page.language, links.length]).toEqual([page.language, 1])
    }
  })

  // The wording checks do not read <pre>, and nothing compiles code on a
  // page: an expression shown here would say what no check reads and no
  // build runs. The guide is the compiled one.
  test('shows no code', () => {
    for (const page of productPages) {
      const section = page.document.querySelector('section[aria-labelledby="totals"]')
      expect([page.language, section === null]).toEqual([page.language, false])
      expect([page.language, section?.querySelectorAll('pre, code').length]).toEqual([page.language, 0])
    }
  })
})
