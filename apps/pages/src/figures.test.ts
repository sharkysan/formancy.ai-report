import { describe, expect, test } from 'vitest'
import { FIGURES, PICTURES, STUDIO } from './content/figures.js'
import { LANGUAGES } from './languages.js'
import { renderSite } from './site.js'
import { inputs, site } from './test-site.js'

/**
 * The pictures the pages show, and what their descriptions say. A picture
 * is copied from docs/images, where a script made it; a description quotes
 * the document's own words, which must be words the picture's page prints
 * -- docs/images/pictures.json records them for a starter and samples.json
 * for an invoice sample, as report-render-pdf's pictures.test.ts holds them
 * to the PDF -- and in every language's description, so no translation
 * quotes what the picture does not show.
 */
describe('the pictures (0021, 0024)', () => {
  // A quote the picture does not print describes another picture: the
  // French sample's figure showing the Italian's file quotes a Facture the
  // page does not print. One a translation leaves out, or changes, quotes
  // the document wrongly.
  test("quote, in every language, only words their picture's page prints", () => {
    for (const figure of FIGURES) {
      const lines = inputs.pictures.find((picture) => picture.name === figure.picture)?.lines ?? []
      for (const quote of figure.quotes) {
        expect({ picture: figure.picture, quote, printed: lines.some((line) => line.includes(quote)) }).toEqual({
          picture: figure.picture,
          quote,
          printed: true,
        })
        for (const language of LANGUAGES)
          expect({ picture: figure.picture, language, quotes: figure.alt[language].includes(quote) }).toEqual({
            picture: figure.picture,
            language,
            quotes: true,
          })
      }
    }
    expect(FIGURES.filter((figure) => figure !== STUDIO).every((figure) => figure.quotes.length > 0)).toBe(true)
  })

  // The check above reads FIGURES: a picture a page shows that is not one
  // of them would have its description quoted by nobody's check, and a
  // figure no page shows is a picture copied for nothing. Read from the
  // HTML, as a crawler finds them; that each is described as its figure
  // describes it is the wording check's (checks.test.ts).
  test('are every picture a page shows', () => {
    const shown = new Set(
      site.pages.flatMap((page) =>
        [...new DOMParser().parseFromString(page.html, 'text/html').querySelectorAll('img')].map((image) => image.getAttribute('src')?.split('/').pop()),
      ),
    )
    expect([...shown].sort()).toEqual(FIGURES.map((figure) => figure.picture.split('/').pop()).sort())
  })

  // Copied, never redrawn: every picture the site serves is a file of
  // docs/images, copied at build time, and nothing else is a picture. The
  // only other files copied are the faces, under site/fonts/, from the
  // pages' own packages (0023).
  test('are copied from docs/images, each one the site shows', () => {
    const copied = renderSite(inputs).files.flatMap((file) => ('from' in file ? [file] : []))
    const faces = copied.filter((file) => file.path.startsWith('site/fonts/'))
    expect(copied.filter((file) => !faces.includes(file)).map((file) => file.from)).toEqual(PICTURES.map((name) => `docs/images/${name}`))
    expect(faces.length).toBeGreaterThan(0)
    expect(faces.filter((file) => !file.from.startsWith('apps/pages/node_modules/@fontsource'))).toEqual([])
  })
})

describe("the licence's terms on the product page", () => {
  // A row LICENSE.md adds or rewords has no translation yet: the site
  // refuses to render rather than state the terms the licence no longer
  // has, and says which row.
  test('refuse a row the page has no words for', () => {
    const changed = { ...inputs, licence: { ...inputs.licence, terms: [...inputs.licence.terms, ['Sell it as your own', 'Never'] as const] } }
    expect(() => renderSite(changed)).toThrow(/LICENSE\.md's table says "Sell it as your own", and the product page has no words for it/)
  })
})
