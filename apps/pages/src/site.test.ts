import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { siteProblems } from './checks/index.js'
import { ANGULAR_STATUS } from './content/angular.js'
import { EPC_QR_CODE_STATUS } from './content/epc-qr-code.js'
import { INVOICES_STATUS } from './content/invoices.js'
import { START_STATUS } from './content/product.js'
import { QR_BILL_STATUS } from './content/qr-bill.js'
import { REACT_STATUS } from './content/react.js'
import { WORD_STATUS } from './content/word.js'
import { GROUPS } from './groups.js'
import { DEFAULT_LANGUAGE } from './languages.js'
import { isRoot } from './pages.js'
import { renderSite } from './site.js'
import { atNextRelease, builtOf, inputs, nextRelease, repo, site } from './test-site.js'

/**
 * The site as the build writes it, against every check: what 0021 says of
 * each page -- in every language, with its translations named both ways,
 * its canonical address its own, listed in the sitemap, one h1, readable
 * without a script, its links resolving, and the words the repository
 * allows -- holds for the pages this checkout builds. checks.test.ts
 * breaks each in turn and watches the check say so.
 */
describe('the site the build writes (0021)', () => {
  // The failure this prevents is any of the checks' failures on the pages
  // that are actually served; said as every problem at once, each naming
  // its page, so one run says everything that is wrong.
  test('passes every check', () => {
    expect(siteProblems(builtOf(site), GROUPS)).toEqual([])
  })

  // The URL scheme 0021 sets, as addresses: a slug renamed would move a
  // page every search engine has indexed, and leave the old address a 404.
  // The QR-bill page's slugs are what a reader searches for in each
  // language (0024): QR-Rechnung, facture QR, fattura QR, Swiss QR-bill.
  // The EPC QR code page's are the standard's name in German and English,
  // and in French and Italian the transfer's, which a reader there meets
  // on every payment (0028): two languages share a slug, at two addresses.
  // The invoices, Word files and report designer pages' are each
  // language's words for what a reader searches for (0081).
  test('is the product page, the invoices page, the QR-bill page, the EPC QR code page, the Word files page, the two report designers’ pages and the healthcare page, in German, French, Italian and English, at the addresses 0021, 0024, 0028 and 0081 give them', () => {
    expect(site.pages.map((page) => page.url)).toEqual([
      'https://formancy.ai/report/de/',
      'https://formancy.ai/report/fr/',
      'https://formancy.ai/report/it/',
      'https://formancy.ai/report/en/',
      'https://formancy.ai/report/de/rechnungen/',
      'https://formancy.ai/report/fr/factures/',
      'https://formancy.ai/report/it/fatture/',
      'https://formancy.ai/report/en/invoices/',
      'https://formancy.ai/report/de/qr-rechnung/',
      'https://formancy.ai/report/fr/facture-qr/',
      'https://formancy.ai/report/it/fattura-qr/',
      'https://formancy.ai/report/en/swiss-qr-bill/',
      'https://formancy.ai/report/de/epc-qr-code/',
      'https://formancy.ai/report/fr/qr-code-sepa/',
      'https://formancy.ai/report/it/qr-code-sepa/',
      'https://formancy.ai/report/en/epc-qr-code/',
      'https://formancy.ai/report/de/word-dateien/',
      'https://formancy.ai/report/fr/documents-word/',
      'https://formancy.ai/report/it/documenti-word/',
      'https://formancy.ai/report/en/word-documents/',
      'https://formancy.ai/report/de/angular-reportdesigner/',
      'https://formancy.ai/report/fr/concepteur-rapports-angular/',
      'https://formancy.ai/report/it/designer-report-angular/',
      'https://formancy.ai/report/en/angular-report-designer/',
      'https://formancy.ai/report/de/react-reportdesigner/',
      'https://formancy.ai/report/fr/concepteur-rapports-react/',
      'https://formancy.ai/report/it/designer-report-react/',
      'https://formancy.ai/report/en/react-report-designer/',
      'https://formancy.ai/report/de/gesundheitswesen/',
      'https://formancy.ai/report/fr/sante/',
      'https://formancy.ai/report/it/sanita/',
      'https://formancy.ai/report/en/healthcare/',
    ])
  })

  // A page whose feature no release had when it was written says where it
  // stands, against the release the changelog names (0024), and the start
  // page says what that release holds and what Formancy Report does not do
  // yet. With several such pages, each refusing on its own as the QR-bill
  // page once did, a release commit would rewrite the start page's
  // sentences, build again, and only then meet the QR-bill page's refusal,
  // and then the next page's. The site reads every page's status
  // before it renders any, and says each in one error. Each line is matched
  // whole, to the constant it names: matched only to its start, a page's
  // line could drop a sentence to say again, or name a constant that is
  // not there, and qr-bill.test.ts's patterns, which the EPC QR code page's
  // line matches too, would not see it; nor would a page's line asking
  // another page's question. The later release is derived from the
  // newest the changelog names, and each line from its page's status, so
  // the release commit that writes the statuses again edits no line here.
  test('refuses to render, in one error, every page whose status a later release outdates', () => {
    const later = nextRelease.version
    let said = ''
    try {
      renderSite(atNextRelease)
    } catch (error) {
      said = error instanceof Error ? error.message : String(error)
    }
    expect(said.split('\n')).toEqual([
      `the start page's status was written when ${START_STATUS.release} was the newest release, and CHANGELOG.md now names ${later}: say what that release holds and what Formancy Report does not do yet in each sentence of product-copy.tsx, limits-copy.tsx and totals-copy.tsx that says where it stands -- \`standing\`, which the hero says, and \`status.format\` in product-copy.tsx, \`items\` in limits-copy.tsx and \`limits.items\` in totals-copy.tsx -- then change START_STATUS with them`,
      `the invoices page's status was written when ${INVOICES_STATUS.release} was the newest release, and CHANGELOG.md now names ${later}: say whether that release prints each invoice the page names in each sentence of invoices-copy.tsx that says where it stands -- \`standing\`, which the hero and the product page's teaser say, \`tryIt.text\`, \`limits.items\` and \`status.text\` -- then change INVOICES_STATUS with them`,
      `the QR-bill page's status was written when ${QR_BILL_STATUS.release} was the newest release, and CHANGELOG.md now names ${later}: say whether that release has the QR-bill in each sentence of qr-bill-copy.tsx that says where it stands -- \`standing\`, which the hero and the product page's teaser say, \`tryIt.text\` and \`status.text\` -- then change QR_BILL_STATUS with them`,
      `the EPC QR code page's status was written when ${EPC_QR_CODE_STATUS.release} was the newest release, and CHANGELOG.md now names ${later}: say whether that release has the EPC QR code in each sentence of epc-qr-code-copy.tsx that says where it stands -- \`standing\`, which the hero and the product page's teaser say, \`tryIt.text\` and \`status.text\` -- then change EPC_QR_CODE_STATUS with them`,
      `the Word writer page's status was written when ${WORD_STATUS.release} was the newest release, and CHANGELOG.md now names ${later}: say whether that release has the Word writer in each sentence of word-copy.tsx that says where it stands -- \`standing\`, which the hero and the product page's teaser say, \`tryIt.text\`, \`limits.items\` and \`status.text\` -- then change WORD_STATUS with them`,
      `the Angular builder page's status was written when ${ANGULAR_STATUS.release} was the newest release, and CHANGELOG.md now names ${later}: say whether that release has the Angular builder in each sentence of angular-copy.tsx that says where it stands -- \`standing\`, which the hero and the product page's teaser say, \`tryIt.text\`, \`limits.items\` and \`status.text\` -- then change ANGULAR_STATUS with them`,
      `the React builder page's status was written when ${REACT_STATUS.release} was the newest release, and CHANGELOG.md now names ${later}: say whether that release has the React builder in each sentence of react-copy.tsx that says where it stands -- \`standing\`, which the hero and the product page's teaser say, \`tryIt.text\`, \`limits.items\` and \`status.text\` -- then change REACT_STATUS with them`,
    ])
  })

  // The pages are served by the Studio's Worker, under its route (0018):
  // an address the pages call canonical that the Worker does not serve is
  // a page indexed nowhere. Read from the Worker's config, not from the
  // inputs that were read from it.
  test("are addressed under the path the Studio's Worker is routed at, and keep the Studio's page at its root", () => {
    const wrangler = JSON.parse(readFileSync(join(repo, 'apps', 'studio', 'wrangler.json'), 'utf8')) as { routes: { pattern: string }[] }
    const route = wrangler.routes.find((each) => each.pattern.endsWith('/*'))
    expect(inputs.site).toBe(`https://${String(route?.pattern.slice(0, -1))}`)
    expect(site.files.map((file) => file.path)).not.toContain('index.html')
    expect(site.files.map((file) => file.path)).toContain('sitemap.xml')
  })

  // npm shows each published package's homepage beside its code, and since
  // 0081 every one names the English start page: a slug renamed, the
  // default language changed, or one manifest's homepage edited would send
  // npm's readers to a page this site does not build. Compared with the
  // page the build writes, not with an address typed here.
  test('is what every published package names as its homepage: the English start page', () => {
    const start = site.pages.find((page) => page.group === GROUPS.find(isRoot)?.id && page.language === DEFAULT_LANGUAGE)
    expect(start?.url).toBeDefined()
    expect(inputs.homepage).toBe(start?.url)
  })

  // The Studio stays at /report/, out of the index, as 0018 and 0021 keep
  // it: a playground drawn by a script, in English, is no page to find,
  // and the sitemap leaves it out. Read from its page, which a later edit
  // could make indexable without anybody deciding it.
  test('leave the Studio out of the index, as its page asks', () => {
    const studio = new DOMParser().parseFromString(readFileSync(join(repo, 'apps', 'studio', 'index.html'), 'utf8'), 'text/html')
    expect(studio.querySelector('meta[name="robots"]')?.getAttribute('content')).toBe('noindex')
    const listed = site.files.find((file) => file.path === 'sitemap.xml')
    expect(listed !== undefined && 'text' in listed && listed.text.includes(`<loc>${inputs.site}</loc>`)).toBe(false)
  })

  // The guard on the guards: checks that read nothing pass anything. Each
  // page parsed has the parts the checks look for.
  test('gives the checks something to read on every page', () => {
    for (const page of site.pages) {
      const document = new DOMParser().parseFromString(page.html, 'text/html')
      expect({
        file: page.file,
        links: document.querySelectorAll('a[href]').length > 10,
        alternates: document.querySelectorAll('link[rel="alternate"]').length,
        json: document.querySelectorAll('script[type="application/ld+json"]').length,
      }).toEqual({
        file: page.file,
        links: true,
        alternates: 5,
        json: 1,
      })
    }
  })
})
