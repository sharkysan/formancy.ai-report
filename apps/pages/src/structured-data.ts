/**
 * What a page says of itself to a search engine, as schema.org JSON-LD: on
 * the product page, the software, with its licence; on a topic page, the
 * page and the breadcrumb that leads to it from the product page. No offer
 * and no price: the price of a production licence is not on any page.
 */
import type { PageContext } from './pages.js'
import { isRoot, pathOf } from './pages.js'

/** The JSON-LD of `page`, as an object. */
export function structuredData(page: PageContext): Record<string, unknown> {
  const meta = page.group.meta[page.language]
  const root = page.groups.find(isRoot)
  if (root === undefined) throw new Error('the site has no product page')
  if (page.group === root) {
    return {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: 'Formancy Report',
      description: meta.description,
      url: page.url,
      applicationCategory: 'DeveloperApplication',
      operatingSystem: 'Node.js, web browser',
      softwareVersion: page.inputs.release.version,
      license: page.github('LICENSE.md'),
      inLanguage: page.language,
    }
  }
  const product = `${page.inputs.site}${pathOf(root, page.language)}`
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'WebPage',
        '@id': page.url,
        url: page.url,
        name: meta.title,
        description: meta.description,
        inLanguage: page.language,
        breadcrumb: { '@id': `${page.url}#breadcrumb` },
      },
      {
        '@type': 'BreadcrumbList',
        '@id': `${page.url}#breadcrumb`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: root.meta[page.language].name, item: product },
          { '@type': 'ListItem', position: 2, name: meta.name, item: page.url },
        ],
      },
    ],
  }
}

/** JSON as it can stand inside a <script>: no `<` that could close it. */
export const scriptJson = (value: unknown): string => JSON.stringify(value).replaceAll('<', '\\u003c')
