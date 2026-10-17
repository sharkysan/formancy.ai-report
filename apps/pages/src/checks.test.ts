import { describe, expect, test } from 'vitest'
import { siteProblems } from './checks/index.js'
import { GROUPS } from './groups.js'
import { HL7_NOTICE } from './shell.js'
import type { Site } from './site.js'
import { builtOf, editing, inputs, site } from './test-site.js'

/**
 * Each check of the built site, watched failing: the site the build writes,
 * with one thing broken the way a later edit could break it, and the
 * problem the check must then name. A check that never failed has not been
 * shown to check anything (CLAUDE.md), and these keep it shown.
 */
const problemsOf = (broken: Site): string => siteProblems(builtOf(broken), GROUPS).join('\n')

/** The site without the page at `file`, from its pages and its files. */
const without = (file: string): Site => ({ pages: site.pages.filter((page) => page.file !== file), files: site.files.filter((each) => each.path !== file) })

describe('the page set and the head', () => {
  // A language dropped from one group: its translations would name an
  // address that answers 404, and the sitemap a page that is not there.
  test('a group missing in a language', () => {
    const said = problemsOf(without('fr/sante/index.html'))
    expect(said).toContain('healthcare has 0 pages in fr, not one')
    expect(said).toContain('de/gesundheitswesen/index.html: its fr alternate https://formancy.ai/report/fr/sante/ is no page of the site')
  })

  // A page that says it is in another language is indexed for the wrong
  // readers, and read aloud in the wrong voice.
  test('<html lang> that is not the page’s language', () => {
    expect(problemsOf(editing('de/index.html', (html) => html.replace('<html lang="de"', '<html lang="en"')))).toContain('de/index.html: <html lang> is en, not de')
  })

  // A title past 60 characters is cut in the results; a description outside
  // 70 to 160 is cut, or replaced by whatever text the engine picks.
  test('a title or a description of the wrong length', () => {
    const long = editing('it/index.html', (html) => html.replace(/<title>[^<]*<\/title>/, `<title>${'x'.repeat(61)}</title>`))
    expect(problemsOf(long)).toContain('it/index.html: the title is 61 characters, not 1 to 60')
    const short = editing('fr/index.html', (html) => html.replace(/<meta name="description" content="[^"]*"/, '<meta name="description" content="Trop court."'))
    expect(problemsOf(short)).toContain('fr/index.html: the description is 11 characters, not 70 to 160')
  })

  // Two pages with one title compete with each other for the same search.
  test('two pages with one title', () => {
    const title = /<title>([^<]*)<\/title>/.exec(site.pages[0]?.html ?? '')?.[1] ?? ''
    const twice = editing('fr/index.html', (html) => html.replace(/<title>[^<]*<\/title>/, `<title>${title}</title>`))
    expect(problemsOf(twice)).toContain(`two pages share the title "${title}"`)
  })

  // Two pages with one description: the results show the same words under
  // both, and a reader cannot tell which page answers the search.
  test('two pages with one description', () => {
    const description = /<meta name="description" content="([^"]*)"/.exec(site.pages[0]?.html ?? '')?.[1] ?? ''
    const twice = editing('fr/index.html', (html) => html.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${description}"`))
    expect(problemsOf(twice)).toContain(`two pages share the description "${description}"`)
  })

  // A canonical address other than the page's own tells a search engine to
  // index that address instead, and this page not at all.
  test('a canonical address that is not the page’s own', () => {
    const elsewhere = editing('en/healthcare/index.html', (html) => html.replace('<link rel="canonical" href="https://formancy.ai/report/en/healthcare/"', '<link rel="canonical" href="https://formancy.ai/report/en/"'))
    expect(problemsOf(elsewhere)).toContain('en/healthcare/index.html: its canonical is ["https://formancy.ai/report/en/"], not its own address https://formancy.ai/report/en/healthcare/')
  })

  // Alternates a search engine ignores: without x-default, a reader in no
  // listed language gets whichever page it picks; named one way only, a
  // pair of translations is not a pair at all.
  test('alternates without x-default, or not named back', () => {
    const noDefault = editing('it/sanita/index.html', (html) => html.replace(/<link rel="alternate" hrefLang="x-default"[^>]*\/>/, ''))
    expect(problemsOf(noDefault)).toContain('it/sanita/index.html: its alternates are de, fr, it, en, not de, fr, it, en, x-default')
    const oneWay = editing('fr/sante/index.html', (html) => html.replace(/<link rel="alternate" hrefLang="de"[^>]*\/>/, ''))
    expect(problemsOf(oneWay)).toContain('de/gesundheitswesen/index.html: its fr alternate https://formancy.ai/report/fr/sante/ does not name it back as de')
    const wrong = editing('fr/sante/index.html', (html) => html.replace('hrefLang="en" href="https://formancy.ai/report/en/healthcare/"', 'hrefLang="en" href="https://formancy.ai/report/en/"'))
    expect(problemsOf(wrong)).toContain('fr/sante/index.html: its en alternate https://formancy.ai/report/en/ is product in en')
  })

  // Open Graph that disagrees with the page: a shared link shows another
  // page's address or words than the one shared.
  test('Open Graph that is not the page’s', () => {
    const shared = editing('de/index.html', (html) => html.replace('<meta property="og:url" content="https://formancy.ai/report/de/"', '<meta property="og:url" content="https://formancy.ai/report/en/"'))
    expect(problemsOf(shared)).toContain('de/index.html: og:url is https://formancy.ai/report/en/, not its address')
    const titled = editing('fr/sante/index.html', (html) => html.replace(/<meta property="og:title" content="[^"]*"/, '<meta property="og:title" content="Formancy Report"'))
    expect(problemsOf(titled)).toContain('fr/sante/index.html: og:title is not its title')
    const described = editing('it/index.html', (html) => html.replace(/<meta property="og:description" content="[^"]*"/, '<meta property="og:description" content="Report PDF progettati in Angular e React, con totali esatti e una anteprima che è il PDF."'))
    expect(problemsOf(described)).toContain('it/index.html: og:description is not its description')
  })

  // A shared link's card: twitter:card is the one thing X reads that Open
  // Graph has no word for, and a page without it leaves the card's kind to
  // X; a large picture's card on a page that names no picture asks for a
  // picture there is not.
  test("a shared link's card that is missing, or asks for a picture the page does not name", () => {
    const missing = editing('de/index.html', (html) => html.replace('<meta name="twitter:card" content="summary_large_image"/>', ''))
    expect(problemsOf(missing)).toContain('de/index.html: twitter:card is [], not ["summary_large_image"]')
    const large = editing('en/healthcare/index.html', (html) => html.replace('<meta name="twitter:card" content="summary"/>', '<meta name="twitter:card" content="summary_large_image"/>'))
    expect(problemsOf(large)).toContain('en/healthcare/index.html: twitter:card is ["summary_large_image"], not ["summary"]')
  })
})

describe('the sitemap', () => {
  // A page the sitemap leaves out is found only through links; one it
  // lists that is not built is a 404 a search engine is told about.
  test('a page missing from it, or one it lists that is not built', () => {
    const missing = editing('sitemap.xml', (xml) => xml.replace(/ {2}<url>\n {4}<loc>https:\/\/formancy\.ai\/report\/it\/<\/loc>[\s\S]*?<\/url>\n/, ''))
    expect(problemsOf(missing)).toContain('sitemap.xml lists https://formancy.ai/report/it/ 0 times, not once')
    const extra = editing('sitemap.xml', (xml) => xml.replace('</urlset>', '  <url>\n    <loc>https://formancy.ai/report/rm/</loc>\n  </url>\n</urlset>'))
    expect(problemsOf(extra)).toContain('sitemap.xml lists https://formancy.ai/report/rm/, which is no page of the site')
  })

  // Alternates in the sitemap that disagree with a page's head: Google
  // reads both, and two answers to one question are no answer.
  test('alternates that are not the ones the page’s head declares', () => {
    const differ = editing('sitemap.xml', (xml) => xml.replace('<xhtml:link rel="alternate" hreflang="x-default" href="https://formancy.ai/report/en/"/>', ''))
    expect(problemsOf(differ)).toMatch(/sitemap\.xml gives https:\/\/formancy\.ai\/report\/de\/ the alternates .*, and its head .*x-default/)
  })
})

describe('the body', () => {
  // Two h1 split the page's one subject; none leaves it without one.
  test('a second h1', () => {
    expect(problemsOf(editing('en/index.html', (html) => html.replace('<h2 id="today">', '<h1>Again</h1><h2 id="today">')))).toContain('en/index.html: 2 h1, not one with words in it')
  })

  // A page whose content a script would draw is an empty page to a reader
  // without JavaScript, and to a crawler that does not run it.
  test('content that is not in the HTML, and a script that is not JSON-LD', () => {
    const empty = editing('de/gesundheitswesen/index.html', (html) => html.replace(/<main([^>]*)>[\s\S]*<\/main>/, '<main$1><div id="root"></div></main>').replace('</body>', '<script src="../../site/app.js"></script></body>'))
    const said = problemsOf(empty)
    expect(said).toContain('de/gesundheitswesen/index.html: its <main> does not hold its h1 and its text: a reader without JavaScript would find it empty')
    expect(said).toContain('de/gesundheitswesen/index.html: a <script> that is not JSON-LD')
    const handler = editing('de/index.html', (html) => html.replace('<a class="skip"', '<a onclick="go()" class="skip"'))
    expect(problemsOf(handler)).toContain('de/index.html: <a> has the handler onclick')
  })

  // A picture without words is nothing to a screen reader, and one
  // without its size moves the page as it loads.
  test('a picture without a description or a size', () => {
    const bare = editing('en/index.html', (html) => html.replace(/(<img src="\.\.\/site\/starter-quotation\.png") alt="[^"]*" width="\d+" height="\d+"/, '$1 alt=""'))
    const said = problemsOf(bare)
    expect(said).toContain('en/index.html: a picture with no description: ../site/starter-quotation.png')
    expect(said).toContain('en/index.html: a picture without its size: ../site/starter-quotation.png')
  })

  // A link that says "here" says nothing in a list of links.
  test('a link whose words say nothing', () => {
    expect(problemsOf(editing('it/index.html', (html) => html.replace('>Provarlo nello Studio<', '>qui<')))).toContain('it/index.html: a link whose words say nothing of where it goes: "qui" to ../')
  })

  // The switcher is how a reader reaches their language; one missing, or
  // one going to another page than this one's translation, strands them.
  test('a language switcher without a language, or leading elsewhere', () => {
    const missing = editing('fr/index.html', (html) => html.replace(/<li><a href="\.\.\/it\/" hrefLang="it" lang="it">Italiano<\/a><\/li>/, ''))
    expect(problemsOf(missing)).toContain('fr/index.html: the language switcher has no link to it')
    const elsewhere = editing('en/healthcare/index.html', (html) => html.replace('<a href="../../de/gesundheitswesen/" hrefLang="de"', '<a href="../../de/" hrefLang="de"'))
    expect(problemsOf(elsewhere)).toContain("en/healthcare/index.html: the language switcher's de link goes to https://formancy.ai/report/de/, not https://formancy.ai/report/de/gesundheitswesen/")
  })

  // JSON-LD that does not parse is ignored whole; one that describes
  // another page, or offers a price, says what the page does not.
  test('JSON-LD that does not parse, or describes something else', () => {
    const broken = editing('en/index.html', (html) => html.replace('<script type="application/ld+json">{', '<script type="application/ld+json">{,'))
    expect(problemsOf(broken)).toMatch(/en\/index\.html: its JSON-LD does not parse/)
    const licence = editing('de/index.html', (html) => html.replace('"license":"https://github.com/sharkysan/formancy.ai-report/blob/main/LICENSE.md"', '"license":"https://www.apache.org/licenses/LICENSE-2.0","offers":{"price":"0"}'))
    const said = problemsOf(licence)
    expect(said).toContain('de/index.html: its SoftwareApplication\'s license is "https://www.apache.org/licenses/LICENSE-2.0", not "https://github.com/sharkysan/formancy.ai-report/blob/main/LICENSE.md"')
    expect(said).toContain('de/index.html: its SoftwareApplication makes an offer: no page states a price')
    const crumbs = editing('it/sanita/index.html', (html) => html.replace('"position":1,"name":"Formancy Report","item":"https://formancy.ai/report/it/"', '"position":1,"name":"Formancy Report","item":"https://formancy.ai/report/en/"'))
    expect(problemsOf(crumbs)).toContain('it/sanita/index.html: its breadcrumb is ["https://formancy.ai/report/en/","https://formancy.ai/report/it/sanita/"], not the product page and then this one')
  })
})

describe('the links', () => {
  // Each way a link breaks without anybody seeing it: a page or a file of
  // the site that is not built, an id that is not there, a file of this
  // repository that moved, a package this repository does not publish,
  // mail to an address the licence does not name, and a site nobody chose.
  test.each([
    ['a page that is not built', '<a class="quiet" href="gesundheitswesen/">', '<a class="quiet" href="sante/">', 'de/index.html: <a> names sante/: no page or file of the site, and not the Studio'],
    ['a file that is not built', 'href="../site/pages.css"', 'href="../site/page.css"', 'de/index.html: <link> names ../site/page.css: no page or file of the site, and not the Studio'],
    ['an id that is not there', 'href="#main"', 'href="#content"', 'de/index.html: <a> names #content: #content is no id on https://formancy.ai/report/de/'],
    ['a file this repository does not hold', 'blob/main/docs/getting-started.md', 'blob/main/docs/start.md', 'de/index.html: <a> names https://github.com/sharkysan/formancy.ai-report/blob/main/docs/start.md: a file this repository does not hold'],
    ['a package this repository does not publish', 'npmjs.com/package/@formancy/report-render-pdf"', 'npmjs.com/package/@formancy/report-corpus"', 'de/index.html: <a> names https://www.npmjs.com/package/@formancy/report-corpus: a package this repository does not publish'],
    ['mail to another address', `mailto:${inputs.licence.address}`, 'mailto:sales@example.com', 'de/index.html: <a> names mailto:sales@example.com: mail to an address the licence does not name'],
    ['a site nobody chose', 'href="https://github.com/sharkysan/formancy.ai-data"', 'href="http://example.com/"', 'de/index.html: <a> names http://example.com/: not https'],
  ])('%s', (_name, from, to, said) => {
    expect(problemsOf(editing('de/index.html', (html) => html.replace(from, to)))).toContain(said)
  })
})

describe('the words', () => {
  // CLAUDE.md: never call it open source. Said once without a denial, in
  // any language, the page says what the licence says it is not.
  test('"open source" without a denial', () => {
    const said = problemsOf(editing('de/index.html', (html) => html.replace('Source-available, nicht Open Source', 'Formancy Report ist Open Source')))
    expect(said).toContain('de/index.html: calls it open source: "Formancy Report ist Open Source"')
  })

  // A denial counts only where it governs the phrase. A "no" or a "nicht"
  // elsewhere in the sentence denies something else, and the sentence
  // still calls it open source: the check passed every one of these once.
  test.each([
    ['en/index.html', 'Source-available, not open source', 'It is open source, no strings attached.'],
    ['de/index.html', 'Source-available, nicht Open Source', 'Formancy Report ist Open Source, und nicht nur für Entwickler'],
    ['fr/index.html', 'Source-available, pas open source', 'Formancy Report est open source, et pas seulement pour les développeurs'],
    ['it/index.html', 'Source-available, non open source', 'Formancy Report è open source, e non solo per gli sviluppatori'],
  ])('"open source" in %s, beside a denial of something else', (file, from, to) => {
    expect(problemsOf(editing(file, (html) => html.replace(from, to)))).toContain(`${file}: calls it open source: "${to}"`)
  })

  // The denials a page says it with, in each language, the negation
  // directly before the phrase: a check that refused these would leave
  // the licence's heading no way to say what the product is not.
  test.each([
    ['en/index.html', 'Formancy Report is not open source', 'Source-available, not open source'],
    ['en/index.html', 'Formancy Report isn’t open source', 'Source-available, not open source'],
    ['de/index.html', 'Formancy Report ist nicht Open Source', 'Source-available, nicht Open Source'],
    ['de/index.html', 'Formancy Report ist kein Open Source', 'Source-available, nicht Open Source'],
    ['de/index.html', 'Formancy Report ist keine Open-Source-Software', 'Source-available, nicht Open Source'],
    ['fr/index.html', "Formancy Report n'est pas open source", 'Source-available, pas open source'],
    ['fr/index.html', 'Un logiciel source-available, non open source', 'Source-available, pas open source'],
    ['it/index.html', 'Formancy Report non è open source', 'Source-available, non open source'],
    ['it/index.html', 'Un software source-available, non open source', 'Source-available, non open source'],
  ])('"open source" denied in %s: "%s"', (file, sentence, from) => {
    expect(problemsOf(editing(file, (html) => html.replace(from, sentence)))).not.toContain('calls it open source')
  })

  // HL7 International asks every page naming its marks to carry its
  // notice; a page that names FHIR without it uses the marks as HL7 does
  // not allow.
  test("HL7 or FHIR named without HL7's notice, word for word", () => {
    const dropped = editing('fr/sante/index.html', (html) => html.replace(HL7_NOTICE, 'HL7 and FHIR are trademarks.'))
    expect(problemsOf(dropped)).toContain("fr/sante/index.html: names HL7 or FHIR and does not carry HL7's notice word for word in its footer")
  })

  // No page states a price (0021): an amount anywhere but in a starter's
  // own printed words is one.
  test('an amount of money no picture prints', () => {
    const priced = editing('en/index.html', (html) => html.replace('Running it in production needs a paid licence.', 'Running it in production costs CHF 990 a year.'))
    expect(problemsOf(priced)).toMatch(/en\/index\.html: states an amount of money no picture prints: ".*CHF 990/)
  })

  // A price is as often written with the currency's name as with its
  // code, before the number or after it, in the page's own language: the
  // check once passed each of the first six.
  test.each([
    ['de/index.html', '500 Franken', 'braucht es eine kostenpflichtige Lizenz.', 'kostet es 500 Franken im Jahr.'],
    ['fr/index.html', '500 francs', 'nécessite une licence payante.', 'coûte 500 francs par an.'],
    ['fr/index.html', '500 euros', 'nécessite une licence payante.', 'coûte 500 euros par an.'],
    ['it/index.html', '500 euro', 'richiede una licenza a pagamento.', 'costa 500 euro all’anno.'],
    ['it/index.html', '500 franchi', 'richiede una licenza a pagamento.', 'costa 500 franchi all’anno.'],
    ['de/index.html', 'SFr. 500', 'braucht es eine kostenpflichtige Lizenz.', 'kostet es SFr. 500 im Jahr.'],
    ['de/index.html', 'CHF 500.–', 'braucht es eine kostenpflichtige Lizenz.', 'kostet es CHF 500.– im Jahr.'],
    ['fr/index.html', 'Fr. 500', 'nécessite une licence payante.', 'coûte Fr. 500 par an.'],
    ['it/index.html', '€ 500', 'richiede una licenza a pagamento.', 'costa € 500 all’anno.'],
  ])('an amount written in %s as "%s"', (file, amount, from, to) => {
    const said = problemsOf(editing(file, (html) => html.replace(from, to)))
      .split('\n')
      .filter((problem) => problem.startsWith(`${file}: states an amount of money`))
    expect(said).toEqual([expect.stringContaining(amount)])
  })
})
