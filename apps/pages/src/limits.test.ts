import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { REQUEST_KINDS } from '@formancy/report-ai'
import { PROMPTS } from '@formancy/report-mcp'
import { COMPONENT_KINDS, PRINTED_BLOCKS, REPORT_SPEC_VERSION, refusedCharacter } from '@formancy/report-spec'
import { describe, expect, test } from 'vitest'
import { collapsed } from './checks/read.js'
import { LIMITS_COPY } from './content/limits-copy.js'
import { LIMIT_ORDER } from './content/product.js'
import { PRODUCT_COPY } from './content/product-copy.js'
import { LANGUAGES } from './languages.js'
import { inputs, repo, site } from './test-site.js'

/**
 * What the start page says Formancy Report does not do yet (limits-copy.tsx,
 * in the order `LIMIT_ORDER` gives), held to the code where a predicate can
 * read it: each sentence is true while the code it rests on is as it was
 * when the sentence was read, and a change to that code fails here until
 * somebody reads the sentence again and says what is true then. One list
 * of detail rows, grouped by one field at most, has no predicate here:
 * review holds it, and the start page's status sends a release back to it
 * (START_STATUS). The status section's sentence that the report format is
 * still a draft is held here too.
 */
const productPages = site.pages
  .filter((page) => page.group === 'product')
  .map((page) => ({ ...page, document: new DOMParser().parseFromString(page.html, 'text/html') }))

/** A code point as the character it is, beside what report-spec says of it. */
const judged = (point: number): readonly [string, string | undefined] => [String.fromCodePoint(point), refusedCharacter(point)]

interface Manifest {
  readonly name: string
  readonly dependencies?: Readonly<Record<string, string>>
  readonly peerDependencies?: Readonly<Record<string, string>>
}

/** Every manifest under packages/, by its name, as this checkout holds it. */
const manifests: ReadonlyMap<string, Manifest> = new Map(
  readdirSync(join(repo, 'packages'))
    .filter((directory) => existsSync(join(repo, 'packages', directory, 'package.json')))
    .map((directory) => JSON.parse(readFileSync(join(repo, 'packages', directory, 'package.json'), 'utf8')) as Manifest)
    .map((manifest) => [manifest.name, manifest]),
)

/** The manifest of the package of packages/ named `name`, refused when there is none: a predicate reading a package renamed away would hold nothing. */
function manifestOf(name: string): Manifest {
  const manifest = manifests.get(name)
  if (manifest === undefined) throw new Error(`no package under packages/ is named ${name}`)
  return manifest
}

/** What `name` declares a consumer installs, its dependencies and its peers, each by its name and range. */
const declared = (name: string): Readonly<Record<string, string>> => {
  const manifest = manifestOf(name)
  return { ...manifest.dependencies, ...manifest.peerDependencies }
}

/** What installing `name` installs: what its manifest declares, and what each package of packages/ among them declares in turn. */
function installs(name: string): ReadonlySet<string> {
  const found = new Set<string>()
  const visit = (each: string): void => {
    for (const dependency of Object.keys(declared(each)))
      if (!found.has(dependency)) {
        found.add(dependency)
        if (manifests.has(dependency)) visit(dependency)
      }
  }
  visit(name)
  return found
}

describe('what the start page says Formancy Report does not do yet', () => {
  // "No Excel, CSV or HTML" is true while the renderers published from
  // packages/ are the PDF's and the Word writer (0068), the two the
  // sentence names: a third report-render-* -- a workbook's, a web
  // page's -- fails here until the sentence is read again. A writer named
  // otherwise is review's.
  test("says no Excel, CSV or HTML while the renderers published are the PDF's and the Word writer", () => {
    expect(inputs.packages.filter((name) => name.startsWith('@formancy/report-render-'))).toEqual([
      '@formancy/report-render-docx',
      '@formancy/report-render-pdf',
    ])
  })

  // "No codes but QR codes" was read against these kinds, the chart among
  // them (0052), which is no code: a kind added later, a barcode among
  // them, fails here until the sentence is read again.
  test("says QR codes are the only codes while report-spec's component kinds are those it was read against", () => {
    expect(COMPONENT_KINDS).toEqual([
      'text',
      'image',
      'qrCode',
      'epcQrCode',
      'line',
      'rectangle',
      'spacer',
      'columns',
      'section',
      'table',
      'chart',
      'pageBreak',
      'keepTogether',
    ])
  })

  // "Latin, Greek and Cyrillic only, with their punctuation and symbols"
  // was read against these blocks, the whole of what report-spec prints: a
  // block added later, of any script, fails here until the sentence is
  // read again. A letter of each script the sentence names is judged as it
  // says, printed or refused.
  test('says only Latin, Greek and Cyrillic print while report-spec refuses the other scripts it is asked about', () => {
    expect(PRINTED_BLOCKS.map(({ block, from, to }) => [block, from, to])).toEqual([
      ['Basic Latin', 0x0000, 0x007f],
      ['Latin-1 Supplement', 0x0080, 0x00ff],
      ['Latin Extended-A', 0x0100, 0x017f],
      ['Latin Extended-B', 0x0180, 0x024f],
      ['IPA Extensions', 0x0250, 0x02af],
      ['Spacing Modifier Letters (before the Bopomofo tone marks)', 0x02b0, 0x02e9],
      ['Spacing Modifier Letters (after the Bopomofo tone marks)', 0x02ec, 0x02ff],
      ['Combining Diacritical Marks', 0x0300, 0x036f],
      ['Greek and Coptic (before the Coptic letters)', 0x0370, 0x03e1],
      ['Greek and Coptic (after the Coptic letters)', 0x03f0, 0x03ff],
      ['Cyrillic', 0x0400, 0x04ff],
      ['Cyrillic Supplement', 0x0500, 0x052f],
      ['Combining Diacritical Marks Extended', 0x1ab0, 0x1aff],
      ['Cyrillic Extended-C', 0x1c80, 0x1c8f],
      ['Phonetic Extensions', 0x1d00, 0x1d7f],
      ['Phonetic Extensions Supplement', 0x1d80, 0x1dbf],
      ['Combining Diacritical Marks Supplement', 0x1dc0, 0x1dff],
      ['Latin Extended Additional', 0x1e00, 0x1eff],
      ['Greek Extended', 0x1f00, 0x1fff],
      ['General Punctuation', 0x2000, 0x206f],
      ['Superscripts and Subscripts', 0x2070, 0x209f],
      ['Currency Symbols', 0x20a0, 0x20cf],
      ['Combining Diacritical Marks for Symbols', 0x20d0, 0x20ff],
      ['Letterlike Symbols', 0x2100, 0x214f],
      ['Number Forms', 0x2150, 0x218f],
      ['Arrows', 0x2190, 0x21ff],
      ['Mathematical Operators', 0x2200, 0x22ff],
      ['Miscellaneous Technical', 0x2300, 0x23ff],
      ['Control Pictures', 0x2400, 0x243f],
      ['Optical Character Recognition', 0x2440, 0x245f],
      ['Enclosed Alphanumerics', 0x2460, 0x24ff],
      ['Box Drawing', 0x2500, 0x257f],
      ['Block Elements', 0x2580, 0x259f],
      ['Geometric Shapes', 0x25a0, 0x25ff],
      ['Miscellaneous Symbols', 0x2600, 0x26ff],
      ['Dingbats', 0x2700, 0x27bf],
      ['Miscellaneous Mathematical Symbols-A', 0x27c0, 0x27ef],
      ['Supplemental Arrows-A', 0x27f0, 0x27ff],
      ['Supplemental Arrows-B', 0x2900, 0x297f],
      ['Miscellaneous Mathematical Symbols-B', 0x2980, 0x29ff],
      ['Supplemental Mathematical Operators', 0x2a00, 0x2aff],
      ['Miscellaneous Symbols and Arrows', 0x2b00, 0x2bff],
      ['Latin Extended-C', 0x2c60, 0x2c7f],
      ['Cyrillic Extended-A', 0x2de0, 0x2dff],
      ['Supplemental Punctuation', 0x2e00, 0x2e7f],
      ['Cyrillic Extended-B', 0xa640, 0xa69f],
      ['Modifier Tone Letters', 0xa700, 0xa71f],
      ['Latin Extended-D', 0xa720, 0xa7ff],
      ['Latin Extended-E', 0xab30, 0xab6f],
      ['Private Use Area', 0xe000, 0xf8ff],
      ['Alphabetic Presentation Forms (the Latin ligatures)', 0xfb00, 0xfb06],
      ['Combining Half Marks', 0xfe20, 0xfe2f],
      ['Arabic Presentation Forms-B (the byte-order mark)', 0xfeff, 0xfeff],
      ['Specials (the object replacement and replacement characters)', 0xfffc, 0xfffd],
    ])
    // é, λ and ж.
    const prints = [0x00e9, 0x03bb, 0x0436]
    // Hebrew's alef, Arabic's beh, Devanagari's ka, Thai's ko kai, the Han
    // character 中 and katakana's a.
    const refuses = [0x05d0, 0x0628, 0x0915, 0x0e01, 0x4e2d, 0x30a2]
    expect(prints.map(judged)).toEqual(prints.map((point) => [String.fromCodePoint(point), undefined]))
    expect(refuses.map(judged)).toEqual(refuses.map((point) => [String.fromCodePoint(point), 'script']))
  })

  // "No published PDF viewer" is true while no package published from
  // packages/ is one: a package published with viewer in its name fails
  // here, naming it, until the sentence is read again. A viewer named
  // otherwise is review's.
  test('says no viewer is published while no published package is one', () => {
    expect(inputs.packages.filter((name) => /viewer/.test(name))).toEqual([])
  })

  // "No changes described in words in the builders" is true while neither
  // builder asks a model anything -- no published package but report-ai
  // takes report-ai, the builders among them, but report-server, which
  // takes it for the briefings it asks its embedder's model under, by
  // REQUEST_KINDS' kinds alone (0084) -- and report-ai asks a model
  // for a language's missing words and nothing else: its REQUEST_KINDS,
  // read from its built dist, is the translation alone (0085), and holds
  // no request for a change a person describes -- an `edit`, or any kind
  // added after it -- so a kind added fails here until the sentence is read
  // again (0083 held the list empty). The sentence's last clause says what
  // is outside the builders: report-mcp's prompts, which an agent's own
  // model reads (0088), to write a template from a description and to
  // translate one. They are read from its built dist too, so a prompt
  // added fails here until the sentence is read again. A package that
  // asked a model through code of its own is review's.
  test('says no change is described in words in the builders while report-ai asks for missing words alone, no package but the server takes it, and report-mcp offers the prompts the sentence names', () => {
    expect(inputs.packages).toEqual(expect.arrayContaining(['@formancy/report-ai', '@formancy/report-mcp']))
    expect(REQUEST_KINDS).toEqual(['translation'])
    expect(Object.keys(PROMPTS).sort()).toEqual(['translate_a_report', 'write_a_report'])
    expect(inputs.packages.filter((name) => name !== '@formancy/report-ai' && Object.hasOwn(declared(name), '@formancy/report-ai'))).toEqual([
      '@formancy/report-server',
    ])
  })

  // "No consistent read from Formancy Data" is true while the one package
  // published from packages/ that reads Formancy Data reads it through
  // @formancy/data-client at exactly 0.5.0, which has no snapshot export,
  // reads a report's header, rows and labels request by request, and asks
  // each page after the last row of the one before, so that a row that
  // moves in the order can be left out, and when it is the last row of a
  // page, so can every row between its old place and its new, while a row
  // read twice refuses the read (0016): a later client, or another package
  // reading Data through one, fails here until the sentence is read again.
  test("says a read from Formancy Data is best-effort while the data provider alone reads it, through Data's 0.5.0 client", () => {
    const readers = inputs.packages.flatMap((name) => {
      const range = declared(name)['@formancy/data-client']
      return range === undefined ? [] : [[name, range]]
    })
    expect(readers).toEqual([['@formancy/report-data-provider', '0.5.0']])
  })

  // "No render jobs: Formancy Report prints no PDF on a server of its own"
  // is true while the server it publishes installs neither the runtime nor
  // the renderer, nor anything the renderer takes from npm to draw with: a
  // server that takes one of them, itself or through report-server-core,
  // fails here, naming it, until the sentence is read again. A server
  // published under another name is review's, and so is one that prints
  // with a library the renderer does not take -- pdf-lib, a headless
  // browser -- which passes here.
  test('says no PDF is printed on a server of its own while the server installs neither the runtime nor the renderer', () => {
    const drawsWith = Object.keys(declared('@formancy/report-render-pdf')).filter((name) => !manifests.has(name))
    const printing = ['@formancy/report-runtime', '@formancy/report-render-pdf', ...drawsWith]
    expect(inputs.packages).toContain('@formancy/report-server')
    expect([...installs('@formancy/report-server')].filter((name) => printing.includes(name))).toEqual([])
  })

  // "The report format is still a draft: a report written now is not
  // promised to be read by a later release", the status section's, is
  // true while report-spec reads version 0, the draft (0004): the release
  // that freezes the format makes it 1, and fails here until the sentence
  // is read again. The page is held to saying it, in every language, so
  // the predicate holds a sentence that is there.
  test('says the report format is still a draft while report-spec reads version 0', () => {
    expect(REPORT_SPEC_VERSION).toBe('0')
    for (const page of productPages) {
      const format = collapsed(PRODUCT_COPY[page.language].status.format)
      const status = page.document.querySelector('section[aria-labelledby="status"]')
      // An empty sentence would be contained in every text.
      expect([page.language, format === '']).toEqual([page.language, false])
      expect([page.language, collapsed(status?.textContent)]).toEqual([page.language, expect.stringContaining(format)])
    }
  })

  // A predicate whose sentence the page no longer says would pass while
  // holding nothing.
  test('says each sentence a predicate here holds', () => {
    expect(LIMIT_ORDER).toEqual(expect.arrayContaining(['data', 'formats', 'codes', 'scripts', 'viewer', 'jobs', 'ai']))
  })

  // A limit the copy words and LIMIT_ORDER leaves out would never print,
  // and one it lists twice would print twice.
  test('orders every limit the copy words, each once', () => {
    for (const language of LANGUAGES) expect([language, [...LIMIT_ORDER].sort()]).toEqual([language, Object.keys(LIMITS_COPY[language].items).sort()])
  })

  // A limit said in one language and not in another tells two readers two
  // things, and a limit or a heading with no words prints an empty line; and
  // the absences, said without the roadmap, leave a reader to guess whether
  // one of them is meant to come.
  test('lists every limit in LIMIT_ORDER, in every language, and links the roadmap', () => {
    expect(productPages).toHaveLength(LANGUAGES.length)
    for (const page of productPages) {
      const section = page.document.querySelector('section[aria-labelledby="limits"]')
      const items = [...(section?.querySelectorAll('li') ?? [])].map((item) => collapsed(item.textContent))
      expect([page.language, items]).toEqual([page.language, LIMIT_ORDER.map((key) => collapsed(LIMITS_COPY[page.language].items[key]))])
      expect([page.language, items.filter((text) => text === '')]).toEqual([page.language, []])
      expect([page.language, collapsed(section?.querySelector('h2#limits')?.textContent) === '']).toEqual([page.language, false])
      const roadmap = section?.querySelectorAll(`a[href="${inputs.repository}/blob/main/docs/roadmap.md"]`)
      expect([page.language, roadmap?.length]).toEqual([page.language, 1])
    }
  })
})
