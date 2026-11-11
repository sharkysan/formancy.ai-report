import { expect, test } from 'vitest'
import { inputs, site } from '../src/test-site.ts'
import { sitePasses, sitemapPages } from './gate-site.mjs'

// The widths are read from the stylesheet the pages serve: a breakpoint added to it is measured
// without anybody editing the gate, and one taken away stops being measured.
test('measures the reflow width, a phone, one past each breakpoint, a laptop and a screen', () => {
  expect(sitePasses('@media (max-width: 40rem){a{}} @media (max-width: 128.25rem){b{}}').map((pass) => [pass.width, pass.refuseFonts ?? false])).toEqual([
    [320, false],
    [320, true],
    [360, false],
    [641, false],
    [1280, false],
    [1920, false],
    [2053, false],
  ])
})

// A stylesheet read as having no breakpoint would measure no narrow layout at all, and pass.
test('refuses a stylesheet with no breakpoint', () => {
  expect(() => sitePasses('a{}')).toThrow(/no max-width breakpoint/)
})

// A breakpoint the gate cannot read would leave the layout at its edge measured by nobody, while
// every other pass stays green: so each width query of another form is refused, by name.
test.each([['(min-width: 50rem)'], ['(max-width: 700px)'], ['(width <= 40rem)']])('refuses a stylesheet that asks %s', (query) => {
  const css = `@media (max-width: 40rem){a{}} @media ${query}{b{}}`
  expect(() => sitePasses(css)).toThrow(`asks about the width in a form the gate does not measure: ${query}`)
})

// The gate walks the sitemap the build wrote: a page left out of it would be measured by nobody,
// and an empty one would make every pass a pass with nothing in it.
test('reads every page the built sitemap lists, at the address the gate serves it', () => {
  const sitemap = site.files.find((file) => file.path === 'sitemap.xml')
  expect(sitemapPages(sitemap.text, inputs.site, 'http://localhost:4395/report/')).toEqual(
    site.pages.map((page) => page.url.replace(inputs.site, 'http://localhost:4395/report/')),
  )
  expect(() => sitemapPages('<urlset></urlset>', inputs.site, 'http://localhost:4395/report/')).toThrow(/lists no page/)
  expect(() => sitemapPages('<urlset><url><loc>https://example.com/x/</loc></url></urlset>', inputs.site, 'http://x/')).toThrow(/outside the site/)
})
