/**
 * What a page may say, where a rule can be read off the words: "open
 * source" only where a negation governs it (CLAUDE.md, "Never call it open
 * source"); HL7's notice, word for word, on a page that names HL7 or FHIR;
 * every picture described as its figure describes it; and no price -- no
 * amount of money but the ones a picture of a starter or an invoice sample
 * prints, which its own description quotes. What a sentence claims is
 * review's.
 */
import { FIGURES } from '../content/figures.js'
import type { Language } from '../languages.js'
import { HL7_NOTICE } from '../shell.js'
import type { Built } from './read.js'
import { metaOf, read, textOf } from './read.js'

/**
 * A negation that governs the words after it, in each language, as "… not
 * open source" uses it: the text before the phrase ends in it, with nothing
 * between them but Italian's "è" ("non è open source"), and English's
 * contractions ("isn't") among them. A denial anywhere else in the
 * sentence denies something else -- "It is open source, no strings
 * attached" -- and the sentence still says it.
 */
const governs = (words: string): RegExp => new RegExp(`(?<!\\p{L})(?:${words})\\s+$`, 'iu')
const NEGATED: Readonly<Record<Language, RegExp>> = {
  de: governs('nicht|kein|keine|keinen|keinem|keiner|keines|nie|niemals'),
  fr: governs('pas|non|ni|jamais'),
  it: governs('non(?:\\s+è)?|né|mai'),
  en: governs("not|never|no|nor|\\p{L}+n['’]t"),
}

const OPEN_SOURCE = /(?<!\p{L})open[\s-]?source(?!\p{L})/giu
const NAMES_HL7 = /\b(?:HL7|FHIR)\b/

/** A currency written before an amount: its code, the Swiss franc's abbreviations, or its sign. */
const BEFORE = String.raw`CHF|EUR|USD|GBP|S?Fr\.|€|\$|£`
/** A currency written after an amount: as before it, or by its name or its hundredth's, in any of the four languages. */
const AFTER = String.raw`CHF|EUR|USD|GBP|S?Fr\.?|Franken|francs?|franchi|franco|Rappen|centimes?|centesimi|euros?|cents?|dollars?|dollari|€|\$|£`
/** A number as an amount is written: 500, 3'143.00, 1,000.50, and Switzerland's 500.– for whole francs. */
const AMOUNT = String.raw`\d[\d'’.,]*(?:[.,][–-])?`
/** An amount of money: a currency beside a number, either way round, a space between them or none. */
const MONEY = new RegExp(String.raw`(?<!\p{L})(?:${BEFORE})\s*${AMOUNT}|${AMOUNT}\s*(?:${AFTER})(?!\p{L})`, 'iu')

/** A file's name, the last part of its path or address. */
const nameOf = (path: string): string => path.slice(path.lastIndexOf('/') + 1)

/** `text` with its whitespace collapsed, as textOf reads an element's: a no-break space a space, as the French pages set theirs. */
const collapsed = (text: string): string => text.replaceAll(/\s+/g, ' ').trim()

/** The blocks a page's text is written in, each read on its own: its whole text run together would join a heading's last word to the next paragraph's first. */
const BLOCK = 'h1, h2, h3, h4, h5, h6, p, li, td, th, caption, figcaption'

/** The text of every block of `document`'s body that holds no other block. */
const blocksOf = (document: Document): string[] =>
  [...document.body.querySelectorAll(BLOCK)].filter((element) => element.querySelector(BLOCK) === null).map((element) => textOf(element))

export function wordingProblems({ site }: Built): string[] {
  const problems: string[] = []
  for (const page of site.pages.map(read)) {
    const { document, file } = page
    const say = (problem: string): void => void problems.push(`${file}: ${problem}`)
    const said = [textOf(document.querySelector('title')), ...metaOf(document, 'name', 'description'), ...blocksOf(document)]
    const described = [...document.querySelectorAll('img[alt]')].map((image) => image.getAttribute('alt') ?? '')

    // Each picture described as its figure describes it in the page's
    // language, whose quotes figures.test.ts holds to the picture: only
    // that description quotes the document's own words, amounts among them,
    // and only from it are they taken before the words are read for a price.
    const unquoted: string[] = []
    for (const image of document.querySelectorAll('img')) {
      const src = image.getAttribute('src') ?? ''
      const alt = image.getAttribute('alt') ?? ''
      const figure = FIGURES.find((each) => nameOf(each.picture) === nameOf(src))
      const its = figure !== undefined && collapsed(alt) === collapsed(figure.alt[page.language])
      if (figure === undefined) say(`shows ${src}, which is no figure's picture`)
      else if (!its) say(`describes ${src} otherwise than its figure does`)
      unquoted.push(its ? figure.quotes.reduce((left, quote) => left.replaceAll(quote, ''), alt) : alt)
    }

    for (const sentence of [...said, ...described].flatMap((text) => text.split(/(?<=[.!?:;])\s+/))) {
      const undenied = [...sentence.matchAll(OPEN_SOURCE)].some((phrase) => !NEGATED[page.language].test(sentence.slice(0, phrase.index)))
      if (undenied) say(`calls it open source: "${sentence}"`)
    }

    const notice = [...document.querySelectorAll('footer p')].some((paragraph) => textOf(paragraph) === HL7_NOTICE)
    if ([...said, ...described].some((text) => NAMES_HL7.test(text.replace(HL7_NOTICE, ''))) && !notice) say("names HL7 or FHIR and does not carry HL7's notice word for word in its footer")

    for (const text of [...said, ...unquoted]) {
      const money = MONEY.exec(text)
      if (money !== null) say(`states an amount of money no picture prints: "${text.slice(Math.max(0, money.index - 30), money.index + 20)}"`)
    }
  }
  return problems
}
