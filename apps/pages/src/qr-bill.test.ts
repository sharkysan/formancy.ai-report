import { describe, expect, test } from 'vitest'
import { QR_BILL_STATUS } from './content/qr-bill.js'
import { QR_BILL_COPY } from './content/qr-bill-copy.js'
import { LANGUAGES } from './languages.js'
import { renderSite } from './site.js'
import { inputs, site } from './test-site.js'

/**
 * The QR-bill page (0024), where it says what nothing else on the site
 * holds: its status, written against one release and said where a reader
 * starts, and the samples it shows, one per language. The checks every
 * page passes are site.test.ts's.
 */
const pagesOf = (group: string) =>
  site.pages.filter((page) => page.group === group).map((page) => ({ ...page, document: new DOMParser().parseFromString(page.html, 'text/html') }))

/** Text with its whitespace collapsed, a no-break space a space, as the French pages set theirs. */
const collapsed = (text: string | null | undefined): string => (text ?? '').replaceAll(/\s+/g, ' ').trim()

describe('the QR-bill page (0024)', () => {
  // The page says the newest release has the bill, which is true while
  // CHANGELOG.md's newest release is 0.2.0, the first to have it; until
  // 0.2.0 it said no release had it. The release commit that adds a newer
  // heading would leave the sentences standing, true or not; the site
  // refuses to render until somebody reads what the release holds and says
  // so, in every sentence that says it: one left behind would tell a reader
  // to wait for a release that has come, or promise one that dropped it.
  test('refuses to render once the changelog names a release its status was not written against, naming each sentence that says it', () => {
    expect(inputs.release.version).toBe(QR_BILL_STATUS.release)
    const released = { ...inputs, release: { ...inputs.release, version: '0.3.0', anchor: '030--2026-11-02' } }
    expect(() => renderSite(released)).toThrow(/the QR-bill page's status was written when 0\.2\.0 was the newest release, and CHANGELOG\.md now names 0\.3\.0/)
    expect(() => renderSite(released)).toThrow(/`standing`, which the hero and the product page's teaser say, `tryIt\.text` and `status\.text`/)
  })

  // The hero and the product page's teaser are where a reader decides to
  // try it, and the getting-started guide installs the newest release,
  // which before 0.2.0 refused a report with a payment part whole. Said
  // only at the foot of the page, the status came after the reader had
  // left for the guide and met the refusal there.
  test('says where it stands where a reader starts, and names the release the guide installs', () => {
    // Nothing to say would be contained in every text.
    for (const language of LANGUAGES) expect([language, collapsed(QR_BILL_COPY[language].standing).split(' ').length >= 4]).toEqual([language, true])
    for (const page of pagesOf('qr-bill')) {
      const { standing } = QR_BILL_COPY[page.language]
      expect([page.language, collapsed(page.document.querySelector('section.hero')?.textContent)]).toEqual([
        page.language,
        expect.stringContaining(collapsed(standing)),
      ])
      expect([page.language, collapsed(page.document.querySelector('section[aria-labelledby="try"] p')?.textContent)]).toEqual([
        page.language,
        expect.stringContaining(inputs.release.version),
      ])
    }
    for (const page of pagesOf('product')) {
      const { standing } = QR_BILL_COPY[page.language]
      expect([page.language, collapsed(page.document.querySelector('section[aria-labelledby="topic-qr-bill"]')?.textContent)]).toEqual([
        page.language,
        expect.stringContaining(collapsed(standing)),
      ])
    }
  })

  // A reader who searched in French came for the French invoice: each page
  // leads with the sample in its own language, then shows the other three,
  // so no language's sample is missing from any page.
  test("shows the four samples, its own language's first", () => {
    const first = { de: 'starter-invoice.png', fr: 'invoice-fr.png', it: 'invoice-it.png', en: 'invoice-en.png' }
    for (const page of pagesOf('qr-bill')) {
      const shown = [...page.document.querySelectorAll('section[aria-labelledby="samples"] img')].map((image) => image.getAttribute('src')?.split('/').pop())
      expect({ language: page.language, first: shown[0], all: [...shown].sort() }).toEqual({
        language: page.language,
        first: first[page.language],
        all: Object.values(first).sort(),
      })
    }
    expect(pagesOf('qr-bill').map((page) => page.language)).toEqual([...LANGUAGES])
  })

  // A shared link to the page shows the invoice it is about, with its
  // slip, in the page's own language: shared from the French page, the
  // German sample's picture would show a Romand reader's contacts a
  // Rechnung, and the product page's quotation no slip at all.
  test("is shared with its own language's sample's picture", () => {
    const own = { de: 'starter-invoice.png', fr: 'invoice-fr.png', it: 'invoice-it.png', en: 'invoice-en.png' }
    for (const page of pagesOf('qr-bill')) {
      expect([page.language, page.document.querySelector('meta[property="og:image"]')?.getAttribute('content')]).toEqual([
        page.language,
        `${inputs.site}site/${own[page.language]}`,
      ])
    }
  })
})
