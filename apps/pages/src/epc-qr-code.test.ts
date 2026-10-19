import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { CARD_EVIDENCE, EPC_QR_CODE_STATUS, EURO_SAMPLES_READ } from './content/epc-qr-code.js'
import { EPC_QR_CODE_COPY } from './content/epc-qr-code-copy.js'
import { formatDay, LANGUAGES } from './languages.js'
import { renderSite } from './site.js'
import { inputs, repo, site } from './test-site.js'

/**
 * The EPC QR code page (0028), where it says what nothing else on the site
 * holds: its status, written against one release and said where a reader
 * starts; the euro invoice's samples it shows, its own language's first;
 * the way into the Studio and across to the QR-bill page; and the tests
 * each of its cards rests on. The checks every page passes are
 * site.test.ts's.
 */
const pagesOf = (group: string) => site.pages.filter((page) => page.group === group).map((page) => ({ ...page, document: new DOMParser().parseFromString(page.html, 'text/html') }))

/** Text with its whitespace collapsed, a no-break space a space, as the French pages set theirs. */
const collapsed = (text: string | null | undefined): string => (text ?? '').replaceAll(/\s+/g, ' ').trim()

/** The euro invoice's pictures, in the order the page shows them after its own language's: the German starter, then the samples from Austria, France, Italy, Spain, the Netherlands and Ireland. */
const SAMPLES = ['starter-euro-invoice.png', 'euro-invoice-at.png', 'euro-invoice-fr.png', 'euro-invoice-it.png', 'euro-invoice-es.png', 'euro-invoice-nl.png', 'euro-invoice-ie.png']

/** The sample each language's page leads with and is shared with: German's is the starter, English's the Irish sample, the one in English. */
const OWN = { de: 'starter-euro-invoice.png', fr: 'euro-invoice-fr.png', it: 'euro-invoice-it.png', en: 'euro-invoice-ie.png' } as const

describe('the EPC QR code page (0028)', () => {
  // The page says the newest release has the code, which is true while
  // CHANGELOG.md's newest release is 0.2.0, the first to have it, as the
  // QR-bill page says of its bill (0024). The release commit would leave
  // the sentences standing, true or not; the site refuses to render until
  // somebody reads what the release holds and says so in each sentence
  // that says it.
  test('refuses to render once the changelog names a release its status was not written against, naming each sentence that says it', () => {
    expect(inputs.release.version).toBe(EPC_QR_CODE_STATUS.release)
    const released = { ...inputs, release: { ...inputs.release, version: '0.3.0', anchor: '030--2026-11-02' } }
    expect(() => renderSite(released)).toThrow(/the EPC QR code page's status was written when 0\.2\.0 was the newest release, and CHANGELOG\.md now names 0\.3\.0/)
    expect(() => renderSite(released)).toThrow(/epc-qr-code-copy\.tsx that says where it stands -- `unreleased`, which the hero and the product page's teaser say, `tryIt\.text` and `status\.text` -- then change EPC_QR_CODE_STATUS with them/)
  })

  // The hero and the product page's teaser are where a reader decides to
  // try it, and the guide installs the newest release, which before 0.2.0
  // refused a report with an EPC QR code whole (0025). Said only at the
  // foot, the status would come after the reader had left for the guide.
  test('says where it stands where a reader starts, and names the release the guide installs', () => {
    // Nothing to say would be contained in every text.
    for (const language of LANGUAGES) expect([language, collapsed(EPC_QR_CODE_COPY[language].unreleased).split(' ').length >= 4]).toEqual([language, true])
    for (const page of pagesOf('epc-qr-code')) {
      const { unreleased } = EPC_QR_CODE_COPY[page.language]
      expect([page.language, collapsed(page.document.querySelector('section.hero')?.textContent)]).toEqual([page.language, expect.stringContaining(collapsed(unreleased))])
      expect([page.language, collapsed(page.document.querySelector('section[aria-labelledby="try"] p')?.textContent)]).toEqual([page.language, expect.stringContaining(inputs.release.version)])
    }
    for (const page of pagesOf('product')) {
      const { unreleased } = EPC_QR_CODE_COPY[page.language]
      expect([page.language, collapsed(page.document.querySelector('section[aria-labelledby="topic-epc-qr-code"]')?.textContent)]).toEqual([page.language, expect.stringContaining(collapsed(unreleased))])
    }
  })

  // A reader who searched in French came for a French invoice: each page
  // leads with the sample of its own language, then shows the rest in one
  // order, so no sample is missing from any page and none twice.
  test("shows the German starter and the six samples, its own language's first and the rest in their order", () => {
    for (const page of pagesOf('epc-qr-code')) {
      const shown = [...page.document.querySelectorAll('section[aria-labelledby="samples"] img')].map((image) => image.getAttribute('src')?.split('/').pop())
      const own = OWN[page.language]
      expect({ language: page.language, shown }).toEqual({ language: page.language, shown: [own, ...SAMPLES.filter((picture) => picture !== own)] })
    }
    expect(pagesOf('epc-qr-code').map((page) => page.language)).toEqual([...LANGUAGES])
  })

  // The page's figures are typed here, in figures.tsx, and the samples are
  // the corpus's, pictured in samples.json by report-render-pdf's script:
  // a sample added there, or one taken away, would leave the page showing
  // the countries it did, and nothing above would see it, since both lists
  // above are this file's. Read from the manifest the script writes.
  test("shows every euro invoice sample the corpus's pictures record, and no other", () => {
    const manifest = JSON.parse(readFileSync(join(repo, 'docs/images/samples.json'), 'utf8')) as readonly { readonly file: string; readonly sample: string }[]
    expect(SAMPLES.slice(1)).toEqual(manifest.filter((entry) => entry.sample.startsWith('euro-invoice')).map((entry) => entry.file))
  })

  // A shared link shows the invoice the page is about in the page's own
  // language: shared from the Italian page, the German starter's picture
  // would show an Italian reader's contacts a Rechnung.
  test("is shared with its own language's sample's picture", () => {
    for (const page of pagesOf('epc-qr-code')) {
      expect([page.language, page.document.querySelector('meta[property="og:image"]')?.getAttribute('content')]).toEqual([page.language, `${inputs.site}site/${OWN[page.language]}`])
    }
  })

  // The Studio has no address for a starter: its root opens the first
  // one, which is not the euro invoice. The hero's action goes there and
  // says which starter to choose, and the try-it text names the code as
  // the Studio's English palette does; a reader told only "Studio" meets
  // a service inspection and no code.
  test('opens the Studio at its root, naming the starter to choose there and the code in its palette', () => {
    for (const page of pagesOf('epc-qr-code')) {
      const action = page.document.querySelector('section.hero a.action')
      expect([page.language, new URL(action?.getAttribute('href') ?? '', page.url).href, collapsed(action?.textContent).includes('Euro invoice')]).toEqual([page.language, inputs.site, true])
      const tried = collapsed(page.document.querySelector('section[aria-labelledby="try"] p')?.textContent)
      expect([page.language, tried.includes('Euro invoice'), tried.includes('EPC payment code')]).toEqual([page.language, true, true])
    }
  })

  // The EPC code pays euro, the QR-bill francs or euro to an account in
  // Switzerland or Liechtenstein: a reader on the wrong one of the two
  // pages is sent to the other from where each says what it does not do,
  // in the page's own language, and from nowhere else there.
  test('sends a reader from its limits to the QR-bill page, and the QR-bill page sends one back', () => {
    const urlOf = (group: string, language: string): string | undefined => site.pages.find((page) => page.group === group && page.language === language)?.url
    for (const [from, to] of [
      ['epc-qr-code', 'qr-bill'],
      ['qr-bill', 'epc-qr-code'],
    ] as const) {
      for (const page of pagesOf(from)) {
        const linked = [...page.document.querySelectorAll('section[aria-labelledby="limits"] a[href]')].map((link) => new URL(link.getAttribute('href') ?? '', page.url).href)
        expect({ from, language: page.language, linked }).toEqual({ from, language: page.language, linked: [urlOf(to, page.language)] })
      }
    }
  })

  // Every card says what the code does, and each claim is one a test of
  // 0025 or 0028 holds. The list says which, card by card: a card added
  // without its tests, or a test file renamed or removed, leaves a claim
  // nobody checks, and fails here.
  test('rests each card it shows on tests the checkout holds', () => {
    for (const language of LANGUAGES) expect([language, EPC_QR_CODE_COPY[language].does.cards.length]).toEqual([language, CARD_EVIDENCE.length])
    for (const files of CARD_EVIDENCE) {
      expect(files.length).toBeGreaterThan(0)
      for (const file of files) expect({ file, there: existsSync(join(repo, file)) }).toEqual({ file, there: true })
    }
  })

  // The samples' VAT rates and the registers that say no bank keeps their
  // accounts' bank codes were read on one day; either may change after
  // it. Said without the day, a rate reads as today's.
  test('dates the rates and the registers its samples rest on', () => {
    for (const page of pagesOf('epc-qr-code')) {
      const said = [...page.document.querySelectorAll('section[aria-labelledby="samples"] p')].map((paragraph) => collapsed(paragraph.textContent))
      const day = formatDay(EURO_SAMPLES_READ, page.language)
      expect({ language: page.language, dated: said.map((paragraph) => paragraph.includes(day)) }).toEqual({ language: page.language, dated: [true, true] })
    }
  })

  // The page dates the rates and the registers, and the record cites each
  // with its address: without a way to it, a reader who doubts a rate or an
  // account has the page's word for it and nothing to read.
  test('links, from its samples, the record that cites where their rates and registers were read', () => {
    for (const page of pagesOf('epc-qr-code')) {
      const linked = [...page.document.querySelectorAll('section[aria-labelledby="samples"] a[href]')].map((link) => link.getAttribute('href'))
      expect({ language: page.language, linked }).toEqual({ language: page.language, linked: [expect.stringMatching(/\/docs\/decisions\/0028-the-euro-invoice-comes-as-samples-from-six-euro-countries-and-an-epc-qr-code-page-shows-them\.md$/)] })
    }
  })
})
