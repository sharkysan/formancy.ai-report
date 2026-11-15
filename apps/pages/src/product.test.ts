import { describe, expect, test } from 'vitest'
import { linkProblems } from './checks/links.js'
import { collapsed } from './checks/read.js'
import { START_STATUS } from './content/product.js'
import { PRODUCT_COPY } from './content/product-copy.js'
import { GROUPS } from './groups.js'
import { formatDay, LANGUAGES } from './languages.js'
import { isRoot } from './pages.js'
import { renderSite } from './site.js'
import { atNextRelease, builtOf, inputs, nextRelease, site } from './test-site.js'

/** The product page's topic cards: what it says of each other page, and where. */
const productPages = site.pages
  .filter((page) => page.group === 'product')
  .map((page) => ({ ...page, document: new DOMParser().parseFromString(page.html, 'text/html') }))

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
  test("says on a topic's card where its page stands, for every other page with a status", () => {
    const stated = GROUPS.filter((group) => !isRoot(group) && group.status !== undefined)
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
  // Folded back into one card, the totals would rest on one list of tests
  // under one heading; placed after the examples, they would stand where a
  // reader no longer reads.
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

describe('the start page says where it stands', () => {
  // The start page says what the newest release holds and what Formancy
  // Report does not do yet, true while CHANGELOG.md's newest release is
  // the one it was written against. The release commit that adds a newer
  // heading would leave those sentences standing, true or not: the hero
  // would credit the new release with what the old one held, and the
  // absences would go on denying what the release may have brought, the
  // format said to be a draft among them. The site refuses to render until
  // somebody reads them again, in all three files that hold them. The
  // later release is the next after the changelog's newest, derived, so
  // the release commit that writes the status again edits no test.
  test('refuses to render once the changelog names a release its status was not written against, naming each sentence', () => {
    expect(inputs.release.version).toBe(START_STATUS.release)
    expect(() => renderSite(atNextRelease)).toThrow(
      `the start page's status was written when ${START_STATUS.release} was the newest release, and CHANGELOG.md now names ${nextRelease.version}: say what that release holds and what Formancy Report does not do yet in each sentence of product-copy.tsx, limits-copy.tsx and totals-copy.tsx that says where it stands -- `,
    )
    expect(() => renderSite(atNextRelease)).toThrow(
      '`standing`, which the hero says, and `status.format` in product-copy.tsx, `items` in limits-copy.tsx and `limits.items` in totals-copy.tsx -- then change START_STATUS with them',
    )
  })

  // The page describes what the source on GitHub holds, and a reader who
  // installs from npm gets the newest release: said nowhere, the reader
  // would take every claim for the release's. The hero names the release,
  // in the sentence that links what the source holds since, and the status
  // section links it again beside the release's own entry.
  test('says in its hero what the newest release holds, and links what main holds since', () => {
    expect(productPages).toHaveLength(LANGUAGES.length)
    for (const page of productPages) {
      const hero = page.document.querySelector('section.hero')
      const link = hero?.querySelector('a[href$="/CHANGELOG.md#unreleased"]')
      expect([page.language, collapsed(link?.closest('p')?.textContent)]).toEqual([page.language, expect.stringContaining(inputs.release.version)])
      expect([page.language, collapsed(link?.textContent) === '']).toEqual([page.language, false])
      const status = page.document.querySelectorAll('section[aria-labelledby="status"] a[href$="/CHANGELOG.md#unreleased"]')
      expect([page.language, status.length]).toEqual([page.language, 1])
    }
  })

  // An absence said without a day reads as true whenever it is read: the
  // list is dated by the day its status was written, which changes with
  // the sentences when a release is read again.
  test('dates what it says it does not do yet', () => {
    for (const page of productPages) {
      const section = page.document.querySelector('section[aria-labelledby="limits"]')
      expect([page.language, collapsed(section?.textContent)]).toEqual([
        page.language,
        expect.stringContaining(collapsed(formatDay(START_STATUS.asOf, page.language))),
      ])
    }
  })

  // The release commit renames "## Unreleased" to the release's heading:
  // the start page's links to it would then land on no heading, and a
  // reader on the top of the changelog, guessing what the link meant. The
  // link check refuses the site until CHANGELOG.md has the heading again.
  test('refuses the link to Unreleased once the changelog has no such heading', () => {
    const built = builtOf(site)
    const released = (path: string): string => {
      const text = built.text(path)
      if (path !== 'CHANGELOG.md') return text
      const renamed = text.replace('## Unreleased', `## ${nextRelease.version} — ${nextRelease.date}`)
      // An edit that matched nothing would test the unbroken changelog.
      expect(renamed).not.toBe(text)
      return renamed
    }
    const refused = linkProblems({ ...built, text: released }).filter((problem) => /#unreleased is no heading of CHANGELOG\.md/.test(problem))
    expect([...new Set(refused.map((problem) => problem.slice(0, problem.indexOf(':'))))]).toEqual(productPages.map((page) => page.file))
  })
})
