import { createHash } from 'node:crypto'
import { diagnose } from '@formancy/report-core'
import { checkReport, EPC_MAX_VERSION, epcCaptionBreak, epcModule, resolveReport } from '@formancy/report-runtime'
import type { Block, ReportDefinition, ResolvedDocument } from '@formancy/report-runtime'
import { describe, expect, test, vi } from 'vitest'
import { epcCodes } from '../fixture.js'
import { EURO_INVOICE, EURO_INVOICE_SAMPLES, starterImages, STARTERS } from './index.js'
import type { Starter } from './index.js'

/**
 * The euro invoice's samples: the starter itself, a German heating firm's
 * maintenance of a private home's boiler, and six samples that sell the
 * same boiler's parts to a private customer from an invented firm of
 * Austria, France, Italy, Spain, the Netherlands and Ireland, each at its
 * country's standard rate, in its words and locale. What each prints and
 * pays -- its locale, its rate, its account, its BIC, its reference, its
 * customer's address -- is stated here, never read from the sample, and
 * each total is recomputed here in BigInt from the sample's own lines. The
 * PDFs they print are proved in report-render-pdf's `euro-samples.test.ts`.
 *
 * The EPC QR code's page rests on these: its "amount, exact to the cent"
 * card on the totals compared in BigInt here, and its samples section on
 * the rates, the accounts and the addresses stated here (0028).
 */

const CREATED = '2026-10-15T08:00:00Z'
const NBSP = ' '

/**
 * What each sample is stated to be: its locale, the rate it taxes at in
 * whole percent, what its code pays, the label of its tax line, its
 * customer's three lines, the line at its head that says whom it is from,
 * and the notice its law asks for under its terms, if any.
 */
const STATED = {
  'euro-invoice': {
    locale: 'de-DE',
    rate: 19n,
    pays: ['FMNCDEF0XXX', 'Formancy Haustechnik GmbH', 'DE83 0123 4567 0012 3456 78', 'RF72 2026 0815', 'Rechnung RE-2026-0815'],
    vat: 'Umsatzsteuer 19 %',
    address: ['Erika Mustermann', 'Heidestraße 17', '51147 Köln'],
    from: 'Formancy Haustechnik GmbH · Industriestraße 7 · 50735 Köln · USt-IdNr. DE123456789',
    notice: 'Sie sind gesetzlich verpflichtet, diese Rechnung, einen Zahlungsbeleg oder eine andere beweiskräftige Unterlage zwei Jahre lang aufzubewahren (§ 14b Abs. 1 Satz 5 UStG).',
  },
  'euro-invoice-at': {
    locale: 'de-AT',
    rate: 20n,
    pays: ['FMNCATW0XXX', 'Formancy Haustechnik GmbH', 'AT93 8012 3000 1234 5678', 'RF94 2026 0904', 'Rechnung RE-2026-0904'],
    vat: 'USt 20 %',
    address: ['Max Mustermann', 'Hauptstraße 12', '4600 Wels'],
    from: 'Formancy Haustechnik GmbH · Gewerbestraße 7 · 4020 Linz · UID-Nr. ATU12345678',
    notice: undefined,
  },
  'euro-invoice-fr': {
    locale: 'fr-FR',
    rate: 20n,
    pays: ['FMNCFRP0XXX', 'Formancy Chauffage SAS', 'FR76 0123 4000 1200 0123 4567 880', 'RF67 2026 0517', 'Facture FA-2026-0517'],
    vat: `TVA 20${NBSP}%`,
    address: ['Jean Dupont', '12 rue de la République', '69002 Lyon'],
    // The legal form, the share capital and the SIREN, which the French
    // administration asks of a company's invoice (service-public.fr, F31808).
    from: `Formancy Chauffage SAS · 7 rue de l’Industrie · 31200 Toulouse · TVA FR32123456789 · SAS au capital de 500${NBSP}€ · SIREN 123 456 789`,
    notice: undefined,
  },
  'euro-invoice-it': {
    locale: 'it-IT',
    rate: 22n,
    pays: ['FMNCITM0XXX', 'Formancy Termotecnica S.r.l.', 'IT53 N000 0000 0120 0001 2345 678', 'RF18 2026 0623', 'Fattura FT-2026-0623'],
    vat: 'IVA 22%',
    address: ['Mario Rossi', 'Via Roma, 15', '10121 Torino'],
    from: 'Formancy Termotecnica S.r.l. · Via dell’Industria, 7 · 20141 Milano · P.IVA 12345678901',
    notice: 'Copia di cortesia: l’originale della fattura elettronica, trasmessa tramite il Sistema di Interscambio, è a vostra disposizione nell’area riservata del sito dell’Agenzia delle Entrate.',
  },
  'euro-invoice-es': {
    locale: 'es-ES',
    rate: 21n,
    pays: ['FMNCESM0XXX', 'Formancy Calefacción S.L.', 'ES25 0000 0012 7000 1234 5678', 'RF08 2026 0318', 'Factura F2026-0318'],
    vat: `IVA 21${NBSP}%`,
    address: ['Carmen Española Española', 'Calle Mayor, 12', '46001 Valencia'],
    from: 'Formancy Calefacción S.L. · Calle de la Industria, 7 · 28045 Madrid · NIF B12345678',
    notice: undefined,
  },
  'euro-invoice-nl': {
    locale: 'nl-NL',
    rate: 21n,
    pays: ['FMNCNL20XXX', 'Formancy Installatietechniek B.V.', 'NL17 FMNC 0123 4567 89', 'RF66 2026 0729', 'Factuur F-2026-0729'],
    vat: 'Btw 21%',
    address: ['Jan Jansen', 'Kerkstraat 12', '3511 LX Utrecht'],
    from: 'Formancy Installatietechniek B.V. · Industrieweg 7 · 3044 AS Rotterdam · btw-id NL123456789B01',
    notice: undefined,
  },
  'euro-invoice-ie': {
    locale: 'en-IE',
    rate: 23n,
    pays: ['FMNCIE20XXX', 'Formancy Heating Supplies Ltd', 'IE30 FMNC 0000 0012 3456 78', 'RF55 2026 0442', 'Invoice INV-2026-0442'],
    vat: 'VAT 23%',
    address: ['Joe Bloggs', '14 Main Street', 'Ennis, Co. Clare'],
    from: 'Formancy Heating Supplies Ltd · 7 Industry Road · Cork · VAT No. IE1234567X',
    notice: undefined,
  },
} as const

type Id = keyof typeof STATED

/** `numerator / denominator`, both positive, rounded half away from zero to a whole number. */
const halfAway = (numerator: bigint, denominator: bigint): bigint => (2n * numerator + denominator) / (2n * denominator)
const cents = (amount: string): bigint => BigInt(amount.replace('.', ''))
/** An amount as the code writes it: EUR, then the euros and as many cents as are not zero (PSA v3.0 5's "as short as possible"). */
const epcAmount = (amount: bigint): string => {
  const rest = amount % 100n
  return rest === 0n ? `EUR${amount / 100n}` : `EUR${amount / 100n}.${String(rest).padStart(2, '0').replace(/0$/, '')}`
}
const compact = (text: string): string => text.replaceAll(' ', '')

/** Spain's DC digit of ten digits: their weights' sum, eleven less its remainder by eleven, 11 written 0 and 10 written 1. */
const spanishDigit = (digits: string): string => {
  const sum = [...digits].reduce((total, digit, index) => total + Number(digit) * ([1, 2, 4, 8, 5, 10, 9, 7, 3, 6][index] as number), 0)
  const digit = 11 - (sum % 11)
  return String(digit === 11 ? 0 : digit === 10 ? 1 : digit)
}

/** What a digit counts at an odd place of the 22 after Italy's CIN; at an even place it counts itself. */
const ODD = [1, 0, 5, 7, 9, 13, 15, 17, 19, 21]

/**
 * Each country's own check of the account an IBAN carries after its
 * country and check digits, by the rule that country gives, over the
 * digits as text and never a JavaScript number past a single digit's.
 */
const NATIONAL = {
  // The RIB key: 97 less the remainder by 97 of 89 times the bank, 15 times the branch and 3 times the account.
  FR: (bban: string) => String(97n - ((89n * BigInt(bban.slice(0, 5)) + 15n * BigInt(bban.slice(5, 10)) + 3n * BigInt(bban.slice(10, 21))) % 97n)).padStart(2, '0') === bban.slice(21),
  // The CIN: the 22 digits after it, each counted by its place, the sum's remainder by 26 as a letter from A.
  IT: (bban: string) => String.fromCharCode(65 + ([...bban.slice(1)].reduce((sum, digit, index) => sum + (index % 2 === 0 ? (ODD[Number(digit)] as number) : Number(digit)), 0) % 26)) === bban.charAt(0),
  // The DC: one digit of the entity and the office, led by two zeros, and one of the account.
  ES: (bban: string) => `${spanishDigit(`00${bban.slice(0, 8)}`)}${spanishDigit(bban.slice(10))}` === bban.slice(8, 10),
  // The eleven test: the ten digits weighted 10 down to 1, their sum a multiple of eleven.
  NL: (bban: string) => [...bban.slice(4)].reduce((sum, digit, index) => sum + Number(digit) * (10 - index), 0) % 11 === 0,
} as const

/** The sample's total as the reference computes it: its lines' sum, and the tax on it at the stated rate, to the cent. */
function totalOf(sample: Starter): bigint {
  const net = (sample.data.detail as Record<string, string>[]).reduce((sum, line) => sum + cents(line['amount'] as string), 0n)
  return net + halfAway(net * STATED[sample.id as Id].rate, 100n)
}

function resolved(sample: Starter): ResolvedDocument {
  const outcome = resolveReport(sample.report, sample.data, { mode: 'final', parameters: sample.parameters, images: starterImages, creationDate: CREATED })
  if (!outcome.ok) throw new Error(outcome.errors.map((error) => `${error.code} ${error.path}`).join('; '))
  expect(outcome.warnings).toEqual([])
  return outcome.document
}

/** The first paragraphs of the body's first columns block, each as one text: the customer's address, as the runtime resolved it. */
function addressOf(document: ResolvedDocument): string[] {
  const columns = document.body.find((block): block is Extract<Block, { kind: 'columns' }> => block.kind === 'columns')
  return (columns?.columns[0]?.blocks ?? []).flatMap((block) => (block.kind === 'paragraph' ? [block.runs.map((run) => ('text' in run ? run.text : '')).join('')] : []))
}

/**
 * Every text the sample prints: the definition's runs, column headers,
 * field labels, empty text and title, and its lines' descriptions and
 * units.
 */
function printed(report: ReportDefinition, data: Starter['data']): Set<string> {
  const found = new Set<string>()
  const walk = (value: unknown, key?: string): void => {
    if (typeof value === 'string') {
      if (key !== undefined && ['text', 'header', 'label', 'emptyText', 'title'].includes(key) && /\p{L}/u.test(value)) found.add(value)
    } else if (Array.isArray(value)) {
      for (const each of value) walk(each)
    } else if (typeof value === 'object' && value !== null) {
      for (const [name, each] of Object.entries(value)) walk(each, name)
    }
  }
  walk(report)
  for (const line of data.detail as Record<string, string>[]) for (const name of ['description', 'unit']) if (/\p{L}/u.test(line[name] as string)) found.add(line[name] as string)
  return found
}

/** The report with every occurrence of `from` in its texts written `to`. */
const rewritten = (report: ReportDefinition, from: string, to: string): unknown => JSON.parse(JSON.stringify(report).replaceAll(from, to))

const samples = EURO_INVOICE_SAMPLES.map((sample) => [sample.id, sample] as const)
const others = samples.slice(1)

describe('the euro invoice samples', () => {
  // The starter and one sample of each country chosen, the German the
  // Studio's starter itself, and only the Austrian in Austria's frame: a
  // sample in the picker would be one the Studio's gate walks and the
  // picker offers, two of one country would show the pages one invoice
  // twice, a German sample apart from the starter could drift from it
  // unseen, and the PSA's caption on another country's code would print
  // Austria's words on a French invoice.
  test('are the euro invoice from Germany, Austria, France, Italy, Spain, the Netherlands and Ireland, the German the starter itself, the Austrian alone in its frame', () => {
    expect(EURO_INVOICE_SAMPLES.map((sample) => [sample.id, sample.report.locale, ...epcCodes(resolved(sample).body).map((code) => code.caption)])).toEqual([
      ['euro-invoice', 'de-DE', undefined],
      ['euro-invoice-at', 'de-AT', 'zahlenMitCode'],
      ['euro-invoice-fr', 'fr-FR', undefined],
      ['euro-invoice-it', 'it-IT', undefined],
      ['euro-invoice-es', 'es-ES', undefined],
      ['euro-invoice-nl', 'nl-NL', undefined],
      ['euro-invoice-ie', 'en-IE', undefined],
    ])
    expect(EURO_INVOICE_SAMPLES[0]).toBe(EURO_INVOICE)
    expect(STARTERS.filter((starter) => EURO_INVOICE_SAMPLES.includes(starter)).map((starter) => starter.id)).toEqual(['euro-invoice'])
  })

  // Seven documents, each with its own id: samples sharing the starter's
  // would be one report to a host or a cache that keys reports by id.
  test('each have a report id of their own, the sample id', () => {
    expect(EURO_INVOICE_SAMPLES.map((sample) => sample.report.id)).toEqual(EURO_INVOICE_SAMPLES.map((sample) => sample.id))
    expect(new Set(EURO_INVOICE_SAMPLES.map((sample) => sample.id)).size).toBe(7)
  })

  // The starter, as the Studio encodes it into its page with
  // JSON.stringify, is what it was before the samples were made from it: a
  // generalisation that moved one word or one key would move its README
  // picture, the Studio's pictures and what the browser gate reads, with
  // nobody having retaken them. The digest is of the starter with the
  // firm's mark at the head of its first page (0032, 18 October 2026), whose
  // pictures were retaken with it; 27583910, at c212358, was the starter
  // before it. A change to the starter retakes those pictures and states
  // the new digest here.
  test('leave the starter as it was, byte for byte', () => {
    expect(createHash('sha256').update(JSON.stringify(EURO_INVOICE)).digest('hex')).toBe('46574c6ec8909f12936ec5a0a88a7b1b55f6753b0f9bf4367e6e3103c8a41111')
  })

  // A sample the validator refuses, or whose expressions the editor marks,
  // is a broken invoice shown as an example.
  test.each(samples)('%s validates, with no diagnostic at all', (_id, sample) => {
    const outcome = checkReport(sample.report)
    expect(outcome.ok ? [] : outcome.errors.map((error) => `${error.stage} ${error.code} ${error.path} ${error.message}`)).toEqual([])
    expect(diagnose(sample.report).map((diagnostic) => `${diagnostic.severity} ${diagnostic.code} ${diagnostic.path}: ${diagnostic.message}`)).toEqual([])
  })

  // Its own data in a final render, with nothing a preview would warn of.
  test.each(samples)('%s resolves its own data in a final render', (_id, sample) => {
    expect(resolved(sample).body.length).toBeGreaterThan(0)
  })

  // The code's amount is the sample's own total, computed here in BigInt
  // at the rate this test states; its beneficiary, account, BIC and
  // reference are the sample's own, its text in the sample's language. A
  // sample that paid another sample's account, or asked for an amount its
  // table does not print, would be paid wrongly; the payload is compared
  // whole, element by element in the EPC's order (EPC069-12 v3.1 2.2).
  test.each(samples)('%s is paid by one EPC code for its exact total, to its own firm, by its own reference', (id, sample) => {
    const [bic, firm, iban, reference, information] = STATED[id as Id].pays
    expect(epcCodes(resolved(sample).body).map((code) => code.payload.split('\n'))).toEqual([['BCD', '001', '1', 'SCT', bic, firm, compact(iban), epcAmount(totalOf(sample)), '', compact(reference), '', information]])
  })

  // Each country's standard rate, as the EU's Your Europe table gave it on
  // 17 October 2026 ("Last checked: 13/07/2026"), stated here and not read
  // from the sample: the tax line, the total's aggregate and the label
  // must all name it, so that a label saying 20 % over a sum at 21 %, or a
  // rate copied from a neighbour, fails.
  test.each(samples)('%s taxes at its country’s standard rate, and says so', (id, sample) => {
    const { rate, vat } = STATED[id as Id]
    const total = sample.report.aggregates.find((aggregate) => aggregate.id === 'total')
    const table = sample.report.regions.body.find((component) => component.kind === 'table')
    const tax = table?.kind === 'table' ? table.totals?.[1]?.cells : undefined
    expect([total?.of, tax]).toEqual([
      { kind: 'expression', expression: { cel: `row.amount * dec("1.${rate}")` } },
      [
        { column: 'article', value: { kind: 'text', text: vat } },
        { column: 'amount', value: { kind: 'expression', expression: { cel: `round(totals.subtotal * dec("0.${rate}"), 2)` }, format: { kind: 'currency', currency: { kind: 'code', code: 'EUR' }, scale: 2 } } },
      ],
    ])
  })

  // Report-spec's own rules for an account, `checkEpcIban` and
  // `epcPairing`, are what the validator applies to a literal IBAN and BIC:
  // each sample passes them, its IBAN with two digits swapped is refused
  // on the IBAN, and a BIC of another country than the account's on the
  // BIC. The account is of the sample's country, its bank code the one its
  // countries file says was read against that country's register, or
  // chosen where none could be read, and its BIC a test BIC, a 0 its
  // location's second character. A sample anyone may print and scan that
  // paid a real account would invite a payment to somebody.
  test.each([
    ['euro-invoice', 'DE', '01234567', 'FMNCATW0XXX'],
    ['euro-invoice-at', 'AT', '80123', 'FMNCDEF0XXX'],
    ['euro-invoice-fr', 'FR', '01234', 'FMNCDEF0XXX'],
    ['euro-invoice-it', 'IT', 'N00000', 'FMNCDEF0XXX'],
    ['euro-invoice-es', 'ES', '0000', 'FMNCDEF0XXX'],
    ['euro-invoice-nl', 'NL', 'FMNC', 'FMNCDEF0XXX'],
    ['euro-invoice-ie', 'IE', 'FMNC000000', 'FMNCDEF0XXX'],
  ] as const)('%s pays an account of its country by the bank code chosen, through a test BIC, both held to report-spec’s rules', (id, country, bank, foreign) => {
    const [bic, , iban] = STATED[id].pays
    const account = compact(iban)
    expect([account.slice(0, 2), account.slice(4, 4 + bank.length), bic.slice(4, 6), bic.charAt(7)]).toEqual([country, bank, country, '0'])
    const sample = EURO_INVOICE_SAMPLES.find((each) => each.id === id) as Starter
    const refused = (report: unknown) => {
      const outcome = checkReport(report)
      return outcome.ok ? [] : outcome.errors.map((error) => [error.code, error.path.split('/').at(-1)])
    }
    expect(refused(sample.report)).toEqual([])
    expect(refused(rewritten(sample.report, iban, `${iban.slice(0, -2)}${iban.at(-1)}${iban.at(-2)}`))).toEqual([['invalid-epc-qr-code', 'iban']])
    expect(refused(rewritten(sample.report, bic, foreign))).toEqual([['invalid-epc-qr-code', 'bic']])
  })

  // A translation that left a word of the German behind prints it on a
  // French, Italian, Spanish, Dutch or English invoice. Each prints no
  // German text but what its language writes alike: the litre's symbol,
  // and in Dutch the word for an article.
  test.each([
    ['euro-invoice-fr', ['l']],
    ['euro-invoice-it', ['l']],
    ['euro-invoice-es', ['l']],
    ['euro-invoice-nl', ['Artikel', 'l']],
    ['euro-invoice-ie', ['l']],
  ] as const)('%s prints no German but what its language writes alike', (id, alike) => {
    const sample = EURO_INVOICE_SAMPLES.find((each) => each.id === id) as Starter
    const german = printed(EURO_INVOICE.report, EURO_INVOICE.data)
    expect([...printed(sample.report, sample.data)].filter((text) => german.has(text)).sort()).toEqual([...alike].sort())
  })

  // The samples sell one order: the same parts at the same quantities and
  // prices, so that their pictures side by side differ only by country --
  // words, rate, account, locale. A sample whose lines drifted would make
  // the pages compare unlike invoices.
  test('sell the same parts at the same quantities and prices', () => {
    const work = (sample: Starter) =>
      [...(sample.data.detail as Record<string, string>[])].sort((a, b) => ((a['article'] as string) < (b['article'] as string) ? -1 : 1)).map(({ quantity, unitPrice, amount }) => [quantity, unitPrice, amount])
    const parts = [
      ['1.00', '312.00', '312.00'],
      ['1.00', '148.00', '148.00'],
      ['1.00', '31.50', '31.50'],
      ['12.50', '1.85', '23.13'],
      ['1.00', '9.90', '9.90'],
    ]
    expect(others.map(([, sample]) => work(sample))).toEqual(others.map(() => parts))
  })

  // An address in another country's order -- "rue de la République 12",
  // "Main Street 14" -- is the first thing a reader of that country would
  // see as foreign. Each customer's lines are stated here as that country
  // writes them, and read from what the runtime resolved.
  test.each(samples)('%s prints its customer’s address as its country writes it', (id, sample) => {
    expect(addressOf(resolved(sample))).toEqual(STATED[id as Id].address)
  })

  // The line at the head of the invoice says whom it is from, in the
  // order and with the details its country writes: the street before the
  // number but in France and Ireland, a comma between them in Spain and
  // Italy, Italy's partita IVA without the IT a VAT number abroad carries,
  // and the legal form, share capital and SIREN the French administration
  // asks of a company's invoice (service-public.fr, F31808, "Vérifié le 11
  // août 2026", read on 17 October 2026). A French invoice without them is
  // the first thing a French reader would see as wrong.
  test.each(samples)('%s says whom it is from, as its country writes a firm’s details', (id, sample) => {
    const sender = sample.report.regions.reportHeader.find((component) => component.id === 'sender')
    expect(sender?.kind === 'text' ? sender.content : undefined).toEqual([{ kind: 'text', text: STATED[id as Id].from }])
  })

  // The notice the invoice's law asks for under its terms, and no other:
  // the German starter's duty to keep it (UStG section 14b), and the
  // Italian sample's word that it is a courtesy copy of the electronic
  // invoice, whose original the customer finds in the Agenzia delle
  // Entrate's reserved area. A notice of one country's law on another
  // country's invoice would state a duty its reader does not have.
  test.each(samples)('%s prints the notice its law asks for under its terms, and no other', (id, sample) => {
    const { summary } = sample.report.regions
    const between = summary.slice(summary.findIndex((component) => component.id === 'terms') + 1, summary.findIndex((component) => component.id === 'payment-gap'))
    const notice = STATED[id as Id].notice
    expect(between.flatMap((component) => (component.kind === 'text' ? [component.content] : []))).toEqual(notice === undefined ? [] : [[{ kind: 'text', text: notice }]])
  })

  // French sets a space before a colon, a semicolon, a question or an
  // exclamation mark, a percent sign and a currency sign, and Spanish one
  // before the percent sign; a plain space there may be broken at, leaving
  // the mark at the start of a line. Each such space is a no-break space,
  // and the sample has some, so that a sample with none of the marks
  // cannot pass. The PDF's text is read with its whitespace collapsed
  // (report-render-pdf's `normalise`), so this is read from the sample.
  test.each([
    ['euro-invoice-fr', / [:;!?%€»]/u, / [:%€]/u],
    ['euro-invoice-es', / %/u, / %/u],
  ] as const)('%s sets a no-break space before every mark its language spaces', (id, plain, kept) => {
    const sample = EURO_INVOICE_SAMPLES.find((each) => each.id === id) as Starter
    const texts = [...printed(sample.report, sample.data)]
    expect([texts.filter((text) => plain.test(text)), texts.some((text) => kept.test(text))]).toEqual([[], true])
  })

  // The national check digits each account carries before ISO 13616's,
  // computed here by each country's rule: France's RIB key, Italy's CIN,
  // Spain's two DC digits, and the old Dutch eleven test the Netherlands'
  // account number passes. ISO 13616's own digits are report-spec's to
  // check, above; an account whose national digits were wrong would be
  // refused by a bank that checks them, and the page says every account's
  // check digits are right.
  test.each([
    ['euro-invoice-fr', 'FR'],
    ['euro-invoice-it', 'IT'],
    ['euro-invoice-es', 'ES'],
    ['euro-invoice-nl', 'NL'],
  ] as const)('%s pays an account whose national check digits are right', (id, country) => {
    const bban = compact(STATED[id].pays[2]).slice(4)
    expect(NATIONAL[country](bban)).toBe(true)
  })

  // A line the countries file bills that the words give no description
  // would be dropped from the invoice, and its total with it, and nothing
  // would say so (CLAUDE.md: never silently drop). The module refuses to
  // load instead, naming the country.
  test('refuse a country whose lines and words disagree, rather than drop a line', async () => {
    vi.resetModules()
    vi.doMock('./euro-invoice-countries.js', async (original) => {
      const actual = await original<typeof import('./euro-invoice-countries.js')>()
      const IE = { ...actual.EURO_COUNTRIES.IE, work: [...actual.EURO_COUNTRIES.IE.work, ['1.00', '5.00'] as const] }
      return { ...actual, EURO_COUNTRIES: { ...actual.EURO_COUNTRIES, IE } }
    })
    try {
      await expect(import('./euro-invoice.js')).rejects.toThrow('the euro invoice from IE bills 6 lines, and its words describe 5')
    } finally {
      vi.doUnmock('./euro-invoice-countries.js')
      vi.resetModules()
    }
  })

  // Every sample's square prints every payload the EPC allows, up to
  // version 13's 331 bytes, with Austria's frame or without, as the
  // starter's does (0025): a sample made into an invoice with a longer
  // name or note is never refused by its data's length alone.
  test.each(samples)('%s prints its code in a square that holds every payload the EPC allows, with the frame or without', (_id, sample) => {
    const floor = (0.4 * 72) / 25.4
    expect(epcCodes(resolved(sample).body).map((code) => [epcModule(code.size, EPC_MAX_VERSION, undefined) >= floor, epcCaptionBreak(code.size, EPC_MAX_VERSION)])).toEqual([[true, undefined]])
  })

  // Every amount the six samples print is under a thousand euro, so that
  // none prints a grouping mark: fr-FR's is U+202F, which Roboto, the face
  // the invoice prints in, has no glyph for, and the renderer would refuse
  // the French sample (report-render-pdf's glyphs.ts); it-IT and es-ES
  // would print 1000,00 € ungrouped, as their readers do not. The German
  // starter's total groups with a point, which Roboto draws.
  test.each(others)('%s totals under a thousand euro, where no grouping mark prints', (_id, sample) => {
    expect(totalOf(sample) < 100000n).toBe(true)
  })
})
