import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, test } from 'vitest'
import { siteProblems } from './checks/index.js'
import { GROUPS } from './groups.js'
import { renderSite } from './site.js'
import { builtOf, inputs, repo, site } from './test-site.js'

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
  test('is the product page, the QR-bill page, the EPC QR code page and the healthcare page, in German, French, Italian and English, at the addresses 0021, 0024 and 0028 give them', () => {
    expect(site.pages.map((page) => page.url)).toEqual([
      'https://formancy.ai/report/de/',
      'https://formancy.ai/report/fr/',
      'https://formancy.ai/report/it/',
      'https://formancy.ai/report/en/',
      'https://formancy.ai/report/de/qr-rechnung/',
      'https://formancy.ai/report/fr/facture-qr/',
      'https://formancy.ai/report/it/fattura-qr/',
      'https://formancy.ai/report/en/swiss-qr-bill/',
      'https://formancy.ai/report/de/epc-qr-code/',
      'https://formancy.ai/report/fr/qr-code-sepa/',
      'https://formancy.ai/report/it/qr-code-sepa/',
      'https://formancy.ai/report/en/epc-qr-code/',
      'https://formancy.ai/report/de/gesundheitswesen/',
      'https://formancy.ai/report/fr/sante/',
      'https://formancy.ai/report/it/sanita/',
      'https://formancy.ai/report/en/healthcare/',
    ])
  })

  // A page whose feature is in no release says so, against the release
  // the changelog named when it was written (0024). With two such pages,
  // each refusing on its own as the QR-bill page once did, a release
  // commit would rewrite the QR-bill page's sentences, build again, and
  // only then meet the EPC QR code page's refusal. The site reads every
  // page's status before it renders any, and says each in one error. Each
  // line is matched whole, to the constant it names: matched only to its
  // start, a page's line could drop a sentence to say again, or name a
  // constant that is not there, and qr-bill.test.ts's patterns, which the
  // EPC QR code page's line matches too, would not see it.
  test('refuses to render, in one error, every page whose status a later release outdates', () => {
    const released = { ...inputs, release: { ...inputs.release, version: '0.2.0', anchor: '020--2026-11-02' } }
    let said = ''
    try {
      renderSite(released)
    } catch (error) {
      said = error instanceof Error ? error.message : String(error)
    }
    expect(said.split('\n')).toEqual([
      "the QR-bill page's status was written when 0.1.0 was the newest release, and CHANGELOG.md now names 0.2.0: say whether that release has the QR-bill in each sentence of qr-bill-copy.tsx that says where it stands -- `unreleased`, which the hero and the product page's teaser say, `tryIt.text` and `status.text` -- then change QR_BILL_STATUS with them",
      "the EPC QR code page's status was written when 0.1.0 was the newest release, and CHANGELOG.md now names 0.2.0: say whether that release has the EPC QR code in each sentence of epc-qr-code-copy.tsx that says where it stands -- `unreleased`, which the hero and the product page's teaser say, `tryIt.text` and `status.text` -- then change EPC_QR_CODE_STATUS with them",
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
      expect({ file: page.file, links: document.querySelectorAll('a[href]').length > 10, alternates: document.querySelectorAll('link[rel="alternate"]').length, json: document.querySelectorAll('script[type="application/ld+json"]').length }).toEqual({
        file: page.file,
        links: true,
        alternates: 5,
        json: 1,
      })
    }
  })
})
