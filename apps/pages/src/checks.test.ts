import { describe, expect, test } from 'vitest'
import { siteProblems } from './checks/index.js'
import { headingAnchors } from './checks/links.js'
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
    expect(problemsOf(editing('de/index.html', (html) => html.replace('<html lang="de"', '<html lang="en"')))).toContain(
      'de/index.html: <html lang> is en, not de',
    )
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
    const twice = editing('fr/index.html', (html) =>
      html.replace(/<meta name="description" content="[^"]*"/, `<meta name="description" content="${description}"`),
    )
    expect(problemsOf(twice)).toContain(`two pages share the description "${description}"`)
  })

  // A canonical address other than the page's own tells a search engine to
  // index that address instead, and this page not at all.
  test('a canonical address that is not the page’s own', () => {
    const elsewhere = editing('en/healthcare/index.html', (html) =>
      html.replace('<link rel="canonical" href="https://formancy.ai/report/en/healthcare/"', '<link rel="canonical" href="https://formancy.ai/report/en/"'),
    )
    expect(problemsOf(elsewhere)).toContain(
      'en/healthcare/index.html: its canonical is ["https://formancy.ai/report/en/"], not its own address https://formancy.ai/report/en/healthcare/',
    )
  })

  // Alternates a search engine ignores: without x-default, a reader in no
  // listed language gets whichever page it picks; named one way only, a
  // pair of translations is not a pair at all.
  test('alternates without x-default, or not named back', () => {
    const noDefault = editing('it/sanita/index.html', (html) => html.replace(/<link rel="alternate" hrefLang="x-default"[^>]*\/>/, ''))
    expect(problemsOf(noDefault)).toContain('it/sanita/index.html: its alternates are de, fr, it, en, not de, fr, it, en, x-default')
    const oneWay = editing('fr/sante/index.html', (html) => html.replace(/<link rel="alternate" hrefLang="de"[^>]*\/>/, ''))
    expect(problemsOf(oneWay)).toContain('de/gesundheitswesen/index.html: its fr alternate https://formancy.ai/report/fr/sante/ does not name it back as de')
    const wrong = editing('fr/sante/index.html', (html) =>
      html.replace('hrefLang="en" href="https://formancy.ai/report/en/healthcare/"', 'hrefLang="en" href="https://formancy.ai/report/en/"'),
    )
    expect(problemsOf(wrong)).toContain('fr/sante/index.html: its en alternate https://formancy.ai/report/en/ is product in en')
  })

  // Open Graph that disagrees with the page: a shared link shows another
  // page's address or words than the one shared.
  test('Open Graph that is not the page’s', () => {
    const shared = editing('de/index.html', (html) =>
      html.replace('<meta property="og:url" content="https://formancy.ai/report/de/"', '<meta property="og:url" content="https://formancy.ai/report/en/"'),
    )
    expect(problemsOf(shared)).toContain('de/index.html: og:url is https://formancy.ai/report/en/, not its address')
    const titled = editing('fr/sante/index.html', (html) =>
      html.replace(/<meta property="og:title" content="[^"]*"/, '<meta property="og:title" content="Formancy Report"'),
    )
    expect(problemsOf(titled)).toContain('fr/sante/index.html: og:title is not its title')
    const described = editing('it/index.html', (html) =>
      html.replace(
        /<meta property="og:description" content="[^"]*"/,
        '<meta property="og:description" content="Report PDF progettati in Angular e React, con totali esatti e una anteprima che è il PDF."',
      ),
    )
    expect(problemsOf(described)).toContain('it/index.html: og:description is not its description')
  })

  // A shared link's card: twitter:card is the one thing X reads that Open
  // Graph has no word for, and a page without it leaves the card's kind to
  // X; a large picture's card on a page that names no picture asks for a
  // picture there is not.
  test("a shared link's card that is missing, or asks for a picture the page does not name", () => {
    const missing = editing('de/index.html', (html) => html.replace('<meta name="twitter:card" content="summary_large_image"/>', ''))
    expect(problemsOf(missing)).toContain('de/index.html: twitter:card is [], not ["summary_large_image"]')
    const large = editing('en/healthcare/index.html', (html) =>
      html.replace('<meta name="twitter:card" content="summary"/>', '<meta name="twitter:card" content="summary_large_image"/>'),
    )
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
    expect(problemsOf(editing('en/index.html', (html) => html.replace('<h2 id="today">', '<h1>Again</h1><h2 id="today">')))).toContain(
      'en/index.html: 2 h1, not one with words in it',
    )
  })

  // A page whose content a script would draw is an empty page to a reader
  // without JavaScript, and to a crawler that does not run it.
  test('content that is not in the HTML, and a script that is not JSON-LD', () => {
    const empty = editing('de/gesundheitswesen/index.html', (html) =>
      html
        .replace(/<main([^>]*)>[\s\S]*<\/main>/, '<main$1><div id="root"></div></main>')
        .replace('</body>', '<script src="../../site/app.js"></script></body>'),
    )
    const said = problemsOf(empty)
    expect(said).toContain('de/gesundheitswesen/index.html: its <main> does not hold its h1 and its text: a reader without JavaScript would find it empty')
    expect(said).toContain('de/gesundheitswesen/index.html: a <script> that is not JSON-LD')
    const handler = editing('de/index.html', (html) => html.replace('<a class="skip"', '<a onclick="go()" class="skip"'))
    expect(problemsOf(handler)).toContain('de/index.html: <a> has the handler onclick')
  })

  // A picture without words is nothing to a screen reader, and one
  // without its size moves the page as it loads.
  test('a picture without a description or a size', () => {
    const bare = editing('en/index.html', (html) =>
      html.replace(/(<img src="\.\.\/site\/starter-quotation\.png") alt="[^"]*" width="\d+" height="\d+"/, '$1 alt=""'),
    )
    const said = problemsOf(bare)
    expect(said).toContain('en/index.html: a picture with no description: ../site/starter-quotation.png')
    expect(said).toContain('en/index.html: a picture without its size: ../site/starter-quotation.png')
  })

  // A link that says "here" says nothing in a list of links.
  test('a link whose words say nothing', () => {
    expect(problemsOf(editing('it/index.html', (html) => html.replace('>Provarlo nello Studio<', '>qui<')))).toContain(
      'it/index.html: a link whose words say nothing of where it goes: "qui" to ../',
    )
  })

  // The switcher is how a reader reaches their language; one missing, or
  // one going to another page than this one's translation, strands them.
  test('a language switcher without a language, or leading elsewhere', () => {
    const missing = editing('fr/index.html', (html) => html.replace(/<li><a href="\.\.\/it\/" hrefLang="it" lang="it">Italiano<\/a><\/li>/, ''))
    expect(problemsOf(missing)).toContain('fr/index.html: the language switcher has no link to it')
    const elsewhere = editing('en/healthcare/index.html', (html) =>
      html.replace('<a href="../../de/gesundheitswesen/" hrefLang="de"', '<a href="../../de/" hrefLang="de"'),
    )
    expect(problemsOf(elsewhere)).toContain(
      "en/healthcare/index.html: the language switcher's de link goes to https://formancy.ai/report/de/, not https://formancy.ai/report/de/gesundheitswesen/",
    )
  })

  // groups.ts says every topic page is linked from the product page as
  // well as from the bar: the bar is a list of names, and a topic only the
  // bar names is a page a reader of the product page is never told about.
  // Its teaser dropped from the German product page, the QR-bill page is
  // still in the bar, and the check must say what the content lost.
  test('a topic page the product page does not introduce', () => {
    const untold = editing('de/index.html', (html) => html.replace(/<section class="band" aria-labelledby="topic-qr-bill">[\s\S]*?<\/section>/, ''))
    const said = problemsOf(untold)
    expect(said).toContain("de/index.html: its content does not link to qr-bill's page https://formancy.ai/report/de/qr-rechnung/")
    expect(said).not.toContain('healthcare')
  })

  // Every page formancy.ai serves links its legal notice and its privacy
  // notice from its footer. One dropped from a page -- the shell edited, or
  // a page given a footer of its own -- and that page is served without
  // it, every other check green: the link check holds where a link goes,
  // not that it is there.
  test('a footer without the legal notice or the privacy notice', () => {
    const legal = problemsOf(editing('it/sanita/index.html', (html) => html.replace(/<a href="https:\/\/formancy\.ai\/legal\/">[^<]*<\/a>/, '')))
    expect(legal).toContain('it/sanita/index.html: its footer does not link to the legal notice https://formancy.ai/legal/')
    expect(legal).not.toContain('privacy notice')
    const privacy = problemsOf(editing('fr/index.html', (html) => html.replace(/<a href="https:\/\/formancy\.ai\/privacy\/">[^<]*<\/a>/, '')))
    expect(privacy).toContain('fr/index.html: its footer does not link to the privacy notice https://formancy.ai/privacy/')
  })

  // JSON-LD that does not parse is ignored whole; one that describes
  // another page, or offers a price, says what the page does not.
  test('JSON-LD that does not parse, or describes something else', () => {
    const broken = editing('en/index.html', (html) => html.replace('<script type="application/ld+json">{', '<script type="application/ld+json">{,'))
    expect(problemsOf(broken)).toMatch(/en\/index\.html: its JSON-LD does not parse/)
    const licence = editing('de/index.html', (html) =>
      html.replace(
        '"license":"https://github.com/sharkysan/formancy.ai-report/blob/main/LICENSE.md"',
        '"license":"https://www.apache.org/licenses/LICENSE-2.0","offers":{"price":"0"}',
      ),
    )
    const said = problemsOf(licence)
    expect(said).toContain(
      'de/index.html: its SoftwareApplication\'s license is "https://www.apache.org/licenses/LICENSE-2.0", not "https://github.com/sharkysan/formancy.ai-report/blob/main/LICENSE.md"',
    )
    expect(said).toContain('de/index.html: its SoftwareApplication makes an offer: no page states a price')
    const crumbs = editing('it/sanita/index.html', (html) =>
      html.replace(
        '"position":1,"name":"Formancy Report","item":"https://formancy.ai/report/it/"',
        '"position":1,"name":"Formancy Report","item":"https://formancy.ai/report/en/"',
      ),
    )
    expect(problemsOf(crumbs)).toContain(
      'it/sanita/index.html: its breadcrumb is ["https://formancy.ai/report/en/","https://formancy.ai/report/it/sanita/"], not the product page and then this one',
    )
  })
})

describe('the links', () => {
  // Each way a link breaks without anybody seeing it: a page or a file of
  // the site that is not built, an id that is not there, a file of this
  // repository that moved, a package this repository does not publish,
  // mail to an address the licence does not name, a site nobody chose, and
  // an address beside one links.ts names, on the same site.
  test.each([
    [
      'a page that is not built',
      '<a class="quiet" href="gesundheitswesen/">',
      '<a class="quiet" href="sante/">',
      'de/index.html: <a> names sante/: no page or file of the site, and not the Studio',
    ],
    [
      'a file that is not built',
      'href="../site/pages.css"',
      'href="../site/page.css"',
      'de/index.html: <link> names ../site/page.css: no page or file of the site, and not the Studio',
    ],
    ['an id that is not there', 'href="#main"', 'href="#content"', 'de/index.html: <a> names #content: #content is no id on https://formancy.ai/report/de/'],
    [
      'a file this repository does not hold',
      'blob/main/docs/getting-started.md',
      'blob/main/docs/start.md',
      'de/index.html: <a> names https://github.com/sharkysan/formancy.ai-report/blob/main/docs/start.md: a file this repository does not hold',
    ],
    [
      'a package this repository does not publish',
      'npmjs.com/package/@formancy/report-render-pdf"',
      'npmjs.com/package/@formancy/report-corpus"',
      'de/index.html: <a> names https://www.npmjs.com/package/@formancy/report-corpus: a package this repository does not publish',
    ],
    [
      'mail to another address',
      `mailto:${inputs.licence.address}`,
      'mailto:sales@example.com',
      'de/index.html: <a> names mailto:sales@example.com: mail to an address the licence does not name',
    ],
    [
      'a site nobody chose',
      'href="https://github.com/sharkysan/formancy.ai-data"',
      'href="http://example.com/"',
      'de/index.html: <a> names http://example.com/: not https',
    ],
    [
      'an address links.ts does not name',
      'href="https://formancy.ai/legal/"',
      'href="https://formancy.ai/imprint/"',
      'de/index.html: <a> names https://formancy.ai/imprint/: an address outside the site that links.ts does not name',
    ],
  ])('%s', (_name, from, to, said) => {
    expect(problemsOf(editing('de/index.html', (html) => html.replace(from, to)))).toContain(said)
  })

  // A link to a heading of a repository file is checked for the file
  // above, and for the heading nowhere: a heading renamed would leave the
  // link landing at the top of a long README, every check green. The
  // QR-bill page links two headings by hand, and the product page the
  // changelog's release heading, whose anchor inputs.mjs derives.
  test('a heading the file it names does not have', () => {
    const renamed = editing('en/swiss-qr-bill/index.html', (html) => html.replace('report-spec/README.md#a-qr-bill', 'report-spec/README.md#no-such-heading'))
    expect(problemsOf(renamed)).toContain(
      'en/swiss-qr-bill/index.html: <a> names https://github.com/sharkysan/formancy.ai-report/blob/main/packages/report-spec/README.md#no-such-heading: #no-such-heading is no heading of packages/report-spec/README.md',
    )
    const release = editing('de/index.html', (html) => html.replace(`CHANGELOG.md#${inputs.release.anchor}`, 'CHANGELOG.md#010-2026-10-16'))
    expect(problemsOf(release)).toContain(
      'de/index.html: <a> names https://github.com/sharkysan/formancy.ai-report/blob/main/CHANGELOG.md#010-2026-10-16: #010-2026-10-16 is no heading of CHANGELOG.md',
    )
  })

  // The anchors as GitHub gives them, which the check above reads: a line
  // of a fenced block is code, a shell comment in a README's example among
  // them, and a heading said twice takes -1 the second time. Read
  // otherwise, a link to a comment would pass, and one to the second of two
  // headings fail.
  test("a heading's anchor, as GitHub gives it", () => {
    const markdown = [
      '# The QR-bill',
      '',
      '```bash',
      '# not a heading',
      '~~~',
      '## still code',
      '```',
      '',
      '## A QR-bill',
      '## A QR-bill #',
      '### `paymentPart`, its [fields](#fields) and Grösse',
    ].join('\n')
    expect([...headingAnchors(markdown)]).toEqual(['the-qr-bill', 'a-qr-bill', 'a-qr-bill-1', 'paymentpart-its-fields-and-grösse'])
  })
})

describe('what a page fetches, and the files it fetches (0023)', () => {
  // A stylesheet, a font, a hint or a picture on another site hands that
  // site the reader's address before a word is read: Google's, for as long
  // as the faces came from Google Fonts. What the browser fetches by itself
  // as a page loads is the site's own; only a link a reader follows may
  // lead elsewhere, to the sites links.ts names. formancy.ai is one of
  // those, and a stylesheet from it is refused all the same.
  const FETCHED = 'fetched from another site as the page loads, which tells that site who opened the page'
  test.each([
    [
      "Google Fonts' stylesheet",
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo"/>',
      `de/index.html: <link> names https://fonts.googleapis.com/css2?family=Archivo: ${FETCHED}`,
    ],
    [
      'a preconnect to the fonts’ host',
      '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin=""/>',
      `de/index.html: <link> names https://fonts.gstatic.com: ${FETCHED}`,
    ],
    [
      'a stylesheet from a site the links may name',
      '<link rel="stylesheet" href="https://formancy.ai/"/>',
      `de/index.html: <link> names https://formancy.ai/: ${FETCHED}`,
    ],
    [
      'a picture from another site',
      '<img src="https://github.com/sharkysan/formancy.ai-report" alt="x" width="1" height="1"/>',
      `de/index.html: <img> names https://github.com/sharkysan/formancy.ai-report: ${FETCHED}`,
    ],
  ])('%s', (_name, added, said) => {
    expect(
      problemsOf(
        editing('de/index.html', (html) =>
          html.replace('<link rel="stylesheet" href="../site/pages.css"/>', `${added}<link rel="stylesheet" href="../site/pages.css"/>`),
        ),
      ),
    ).toContain(said)
  })

  // A face whose file is on another site is the same address handed over,
  // one url() later; one whose file the site does not hold is text drawn in
  // the fallback, which no reader is told; an @import is a stylesheet the
  // browser fetches from wherever it names.
  test.each([
    [
      'a font on another site',
      (css: string) => css.replace(/url\(fonts\/([^)]+)\.woff2\)/, 'url(https://fonts.gstatic.com/s/archivo/v25/$1.woff2)'),
      /site\/pages\.css: url\(https:\/\/fonts\.gstatic\.com\/s\/archivo\/v25\/[\w-]+\.woff2\) is a file of another site, which a reader's browser would ask for/,
    ],
    [
      'a font the site does not hold',
      (css: string) => css.replace(/url\(fonts\/([^)]+)\.woff2\)/, 'url(fonts/missing.woff2)'),
      /site\/pages\.css: url\(fonts\/missing\.woff2\) names no file of the site/,
    ],
    [
      'an @import',
      (css: string) => `@import url('https://fonts.googleapis.com/css2?family=Archivo');\n${css}`,
      /site\/pages\.css: @import url\('https:\/\/fonts\.googleapis\.com\/css2\?family=Archivo'\) is a stylesheet a reader's browser would fetch, from wherever it names/,
    ],
  ])('%s', (_name, edit, said) => {
    expect(problemsOf(editing('site/pages.css', edit))).toMatch(said)
  })

  // A data: address in a stylesheet is bytes the stylesheet carries and
  // asks no site for anything: a check that called it another site's file
  // would refuse a rule for the wrong reason.
  test('a data: address in the stylesheet, which is no file of another site', () => {
    const inlined = editing('site/pages.css', (css) => `${css}.mark { background: url(data:image/gif;base64,R0lGODlhAQABAAAAACw=); }\n`)
    expect(problemsOf(inlined)).not.toMatch(/data:image/)
  })

  // A font file the site serves and no stylesheet names is bytes every
  // deploy carries for nothing; and a file copied from a package whose
  // notice is not beside it is a font shipped without the copyright and
  // licence the OFL asks each copy to carry.
  test('a font file no stylesheet names, and a package missing from the notices', () => {
    const font = site.files.find((file) => file.path.startsWith('site/fonts/') && 'from' in file)
    if (font === undefined || !('from' in font)) throw new Error('the site serves no font file')
    const unnamed = { ...site, files: [...site.files, { path: 'site/fonts/unnamed.woff2', from: font.from }] }
    expect(problemsOf(unnamed)).toContain('site/fonts/unnamed.woff2 is served, and no stylesheet of the site names it')
    const pkg = /node_modules\/(@[\w-]+\/[\w-]+)\//.exec(font.from)?.[1] ?? ''
    const unlisted = editing('site/THIRD-PARTY-NOTICES.txt', (text) => text.replaceAll(new RegExp(`^${pkg.replace('/', '\\/')} `, 'gm'), 'someone-else '))
    expect(problemsOf(unlisted)).toContain(`${font.path} is copied from ${pkg}, which site/THIRD-PARTY-NOTICES.txt does not list`)
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
    const priced = editing('en/index.html', (html) =>
      html.replace('Running it in production needs a paid licence.', 'Running it in production costs CHF 990 a year.'),
    )
    expect(problemsOf(priced)).toMatch(/en\/index\.html: states an amount of money no picture prints: ".*CHF 990/)
  })

  // A picture's description is its figure's, whose quotes figures.test.ts
  // holds to what the picture prints, and only there are the document's
  // amounts its own words. Read as such on every page, as they were, the
  // German sample's description rewritten on the English page to price a
  // licence at CHF 1 416.52 passed every check, and so did that amount in
  // a paragraph of the page.
  test("a picture described otherwise than its figure, and a figure's amount outside its description", () => {
    const described = editing('en/swiss-qr-bill/index.html', (html) =>
      html.replace(
        /(<img src="\.\.\/\.\.\/site\/starter-invoice\.png") alt="[^"]*"/,
        `$1 alt="An invoice for Total CHF 1'416.52 and a licence at CHF 1 416.52"`,
      ),
    )
    const said = problemsOf(described)
    expect(said).toContain('en/swiss-qr-bill/index.html: describes ../../site/starter-invoice.png otherwise than its figure does')
    expect(said).toMatch(/en\/swiss-qr-bill\/index\.html: states an amount of money no picture prints: ".*CHF 1'416\.52/)
    const written = editing('en/swiss-qr-bill/index.html', (html) =>
      html.replace('<h2 id="samples">', '<p>Each licence is CHF 1 416.52 a year.</p><h2 id="samples">'),
    )
    expect(problemsOf(written)).toMatch(/en\/swiss-qr-bill\/index\.html: states an amount of money no picture prints: ".*CHF 1 416\.52/)
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

  // 0025 keeps the name some German banks give the EPC QR code off
  // everything here: who owns it, and what rules come with it, nothing here
  // found. A page is where it would come back -- it is the word a German
  // reader searches for -- and on a page it is in every crawl: in a
  // sentence, in a slug, in a picture's description. Each spelling below
  // passed every check before this one: the entity because the HTML writes
  // the C as one, which a crawler reads as the letter, and the hyphens and
  // the invisible characters because a page shows the two words joined by
  // them, which a pattern of a plain hyphen or a space never matched.
  //
  // The name is put together here from its two words, so that this file,
  // and the test names the release report collects from it, never spell
  // it: 0025 keeps it off everything here, its tests' names included.
  const [giro, code] = ['Giro', 'Code']
  test.each([
    ['in a sentence', 'de/index.html', 'Source-available, nicht Open Source', `Rechnungen mit ${giro}${code}`, `${giro}${code}`],
    [
      'in a slug',
      'de/index.html',
      '<a class="quiet" href="gesundheitswesen/">',
      `<a class="quiet" href="${giro.toLowerCase()}${code.toLowerCase()}/">`,
      `${giro.toLowerCase()}${code.toLowerCase()}`,
    ],
    [
      'in lower case, with a hyphen',
      'fr/facture-qr/index.html',
      'ce que Formancy Report ne peut pas vérifier.',
      `comme un ${giro}-${code.toLowerCase()}.`,
      `${giro}-${code.toLowerCase()}`,
    ],
    [
      "in a picture's description",
      'en/index.html',
      'alt="The quotation starter',
      `alt="A ${giro.toUpperCase()}${code.toUpperCase()} beside the quotation starter`,
      `${giro.toUpperCase()}${code.toUpperCase()}`,
    ],
    ['with a letter written as an entity', 'it/index.html', 'Source-available, non open source', `Fatture con ${giro}&#67;${code.slice(1)}`, `${giro}${code}`],
    ['with a non-breaking hyphen', 'de/index.html', 'Source-available, nicht Open Source', `Rechnungen mit ${giro}‑${code}`, `${giro}‑${code}`],
    ['with a soft hyphen', 'en/index.html', 'alt="The quotation starter', `alt="A ${giro}­${code} beside the quotation starter`, `${giro}­${code}`],
    ['with a zero-width space', 'fr/facture-qr/index.html', 'ce que Formancy Report ne peut pas vérifier.', `comme un ${giro}​${code}.`, `${giro}​${code}`],
    ['with an en dash', 'it/index.html', 'Source-available, non open source', `Fatture con ${giro} – ${code}`, `${giro} – ${code}`],
  ])("the bank's name for the code, %s", (_name, file, from, to, found) => {
    expect(problemsOf(editing(file, (html) => html.replace(from, to)))).toContain(
      `${file}: names "${found}", the name 0025 keeps off every page: who owns it, and what rules come with it, nothing here found`,
    )
  })
})
