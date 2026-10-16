/**
 * What a page may say, where a rule can be read off the words: "open
 * source" only where it is denied (CLAUDE.md, "Never call it open
 * source"); HL7's notice, word for word, on a page that names HL7 or FHIR;
 * and no price -- no amount of money but the ones a starter's picture
 * prints, which its description quotes. What a sentence claims is review's.
 */
import { STARTERS, STUDIO } from '../content/figures.js'
import type { Language } from '../languages.js'
import { HL7_NOTICE } from '../shell.js'
import type { Built } from './read.js'
import { metaOf, read, textOf } from './read.js'

/** The words that deny, in each language, as the sentence "… not open source" would use them. */
const word = (words: string): RegExp => new RegExp(`(?<!\\p{L})(?:${words})(?!\\p{L})`, 'iu')
const DENIES: Readonly<Record<Language, RegExp>> = {
  de: word('nicht|kein|keine|keiner'),
  fr: word('pas|non|ni|jamais'),
  it: word('non|né|mai'),
  en: word('not|no|never|nor'),
}

const OPEN_SOURCE = /\bopen[\s-]?source\b/i
const NAMES_HL7 = /\b(?:HL7|FHIR)\b/
/** An amount of money: a currency beside a number, either way round. */
const MONEY = /(?:\b(?:CHF|EUR|USD|GBP|Fr\.)|[€$£])\s?\d|\d[\d'’.,]*\s?(?:\b(?:CHF|EUR|USD|GBP)\b|[€$£])/

/** Every quote a picture's description holds: the document's own words, an amount among them. */
const QUOTES = [STUDIO, ...STARTERS].flatMap((figure) => figure.quotes)

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

    for (const sentence of [...said, ...described].flatMap((text) => text.split(/(?<=[.!?:;])\s+/))) {
      if (OPEN_SOURCE.test(sentence) && !DENIES[page.language].test(sentence)) say(`calls it open source: "${sentence}"`)
    }

    const notice = [...document.querySelectorAll('footer p')].some((paragraph) => textOf(paragraph) === HL7_NOTICE)
    if ([...said, ...described].some((text) => NAMES_HL7.test(text.replace(HL7_NOTICE, ''))) && !notice) say("names HL7 or FHIR and does not carry HL7's notice word for word in its footer")

    for (const text of [...said, ...described]) {
      const rest = QUOTES.reduce((left, quote) => left.replaceAll(quote, ''), text)
      const money = MONEY.exec(rest)
      if (money !== null) say(`states an amount of money no picture prints: "${rest.slice(Math.max(0, money.index - 30), money.index + 20)}"`)
    }
  }
  return problems
}
