import { describe, expect, test } from 'vitest'
import { formatDay, frenchSpaces } from './languages.js'
import { relativeHref } from './pages.js'

/**
 * The two small decisions every page leans on: how one page links to
 * another, and how a day is written in each language.
 */
describe('a link from one page to another', () => {
  // Relative, so the pages are right under /report/ on formancy.ai and
  // wherever else the site is served; one `../` too many or too few is a
  // 404 the browser asks formancy.ai's own site for.
  test.each([
    ['de/', 'de/', './'],
    ['de/', 'de/gesundheitswesen/', 'gesundheitswesen/'],
    ['de/gesundheitswesen/', 'de/', '../'],
    ['de/gesundheitswesen/', 'fr/sante/', '../../fr/sante/'],
    ['de/', 'fr/', '../fr/'],
    ['de/', '', '../'],
    ['de/gesundheitswesen/', '', '../../'],
    ['en/healthcare/', 'site/pages.css', '../../site/pages.css'],
    ['en/', 'en/notes.txt', 'notes.txt'],
  ])('from %s to %s is %s', (from, to, link) => {
    expect(relativeHref(from, to)).toBe(link)
    expect(new URL(link, `https://formancy.ai/report/${from}`).href).toBe(`https://formancy.ai/report/${to}`)
  })
})

describe('French punctuation', () => {
  // French sets a space before a colon, a semicolon, a question or an
  // exclamation mark and inside guillemets; an ordinary space there lets a
  // narrow screen start a line with the mark, alone. Written once for every
  // French page, not remembered in every string.
  test('keeps its mark on the line of the word before it, and nothing else changes', () => {
    expect(frenchSpaces('État : 0.1.0 ; « Download PDF » ? Oui !')).toBe('État : 0.1.0 ; « Download PDF » ? Oui !')
    expect(frenchSpaces('<a href="https://formancy.ai/">formancy.ai</a>: x')).toBe('<a href="https://formancy.ai/">formancy.ai</a>: x')
  })
})

describe('a day, as a page writes it', () => {
  // Typed, a date is right in one language and wrong in three; through
  // Intl, each page writes it as its readers do.
  test('is written by Intl for the language, Swiss where the language is Switzerland’s', () => {
    expect(formatDay('2026-10-16', 'de')).toBe('16. Oktober 2026')
    expect(formatDay('2026-10-16', 'fr')).toBe('16 octobre 2026')
    expect(formatDay('2026-10-16', 'it')).toBe('16 ottobre 2026')
    expect(formatDay('2026-10-16', 'en')).toBe('16 October 2026')
    expect(() => formatDay('16 October 2026', 'en')).toThrow(/not an ISO day/)
  })
})
