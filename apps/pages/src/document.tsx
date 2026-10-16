/**
 * A page's whole document: the head a search engine and a shared link
 * read -- title, description, canonical address, every translation as an
 * alternate with English as the default, Open Graph, JSON-LD -- and the
 * shell with the page's body in it. Static HTML: the only script is the
 * JSON-LD, which no browser runs, so a reader without JavaScript reads it
 * all (0021).
 */
import type { ReactElement } from 'react'
import { LANGUAGE, LANGUAGES } from './languages.js'
import type { PageContext } from './pages.js'
import { picturePath, STYLESHEET } from './pages.js'
import { Shell } from './shell.js'
import { scriptJson, structuredData } from './structured-data.js'

export function Document({ page, alternates }: { readonly page: PageContext; readonly alternates: readonly (readonly [string, string])[] }): ReactElement {
  const meta = page.group.meta[page.language]
  const image = page.group.image === undefined ? undefined : page.inputs.pictures.find((picture) => picture.name === page.group.image)
  if (page.group.image !== undefined && image === undefined) throw new Error(`${page.group.id}'s picture ${page.group.image} is not among the site's pictures`)
  const { Body } = page.group
  return (
    <html lang={page.language} dir="ltr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content={page.inputs.ground} />
        <title>{meta.title}</title>
        <meta name="description" content={meta.description} />
        <link rel="canonical" href={page.url} />
        {alternates.map(([language, href]) => (
          <link key={language} rel="alternate" hrefLang={language} href={href} />
        ))}
        <meta property="og:type" content="website" />
        <meta property="og:site_name" content="Formancy Report" />
        <meta property="og:title" content={meta.title} />
        <meta property="og:description" content={meta.description} />
        <meta property="og:url" content={page.url} />
        <meta property="og:locale" content={LANGUAGE[page.language].og} />
        {LANGUAGES.filter((language) => language !== page.language).map((language) => (
          <meta key={language} property="og:locale:alternate" content={LANGUAGE[language].og} />
        ))}
        {image === undefined ? null : (
          <>
            <meta property="og:image" content={`${page.inputs.site}${picturePath(image.name)}`} />
            <meta property="og:image:width" content={String(image.width)} />
            <meta property="og:image:height" content={String(image.height)} />
          </>
        )}
        {/* No icon, said rather than requested, as the Studio says it: otherwise every load is a 404. */}
        <link rel="icon" href="data:," />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={page.inputs.fonts} />
        <link rel="stylesheet" href={page.href(STYLESHEET)} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: scriptJson(structuredData(page)) }} />
      </head>
      <body>
        <Shell page={page}>
          <Body page={page} />
        </Shell>
      </body>
    </html>
  )
}
