/**
 * The shell every page wears (formancy.ai 0106): the Studio's bar, with the
 * wordmark, the site's pages, the Studio and the source, and the language
 * switcher; a breadcrumb on a topic page; and the footer. Its classes are
 * the Studio's own where the Studio has the part -- `.skip`, `.studio-bar`,
 * `.wordmark`, `.quiet` -- dressed by the Studio's stylesheets, which
 * pages.css imports rather than copies (0021).
 */
import type { ReactElement, ReactNode } from 'react'
import { LANGUAGE, LANGUAGES } from './languages.js'
import type { Language } from './languages.js'
import { FORMANCY } from './links.js'
import { isRoot } from './pages.js'
import type { PageContext } from './pages.js'

/**
 * HL7's notice, word for word, as HL7 International asks it of a page that
 * names its marks. In English on every page, and said to be English.
 */
export const HL7_NOTICE = 'HL7, FHIR and the FHIR [FLAME DESIGN] are the registered trademarks of Health Level Seven International and their use does not constitute endorsement by HL7.'

interface ShellWords {
  readonly skip: string
  readonly pages: string
  readonly languages: string
  readonly breadcrumb: string
  readonly studio: string
  readonly source: string
  readonly builtOn: (formancy: ReactNode) => ReactNode
  readonly licence: string
  readonly changelog: string
}

const WORDS: Readonly<Record<Language, ShellWords>> = {
  de: {
    skip: 'Zum Inhalt springen',
    pages: 'Seiten',
    languages: 'Sprache',
    breadcrumb: 'Navigationspfad',
    studio: 'Studio öffnen',
    source: 'Quellcode auf GitHub',
    builtOn: (formancy) => <>Formancy Report baut auf {formancy} auf, dem visuellen Formular-Builder für Angular und React, dessen Pakete unter Apache-2.0 stehen.</>,
    licence: 'Lizenz (LICENSE.md, Englisch)',
    changelog: 'Changelog (Englisch)',
  },
  fr: {
    skip: 'Aller au contenu',
    pages: 'Pages',
    languages: 'Langue',
    breadcrumb: "Fil d'Ariane",
    studio: 'Ouvrir le Studio',
    source: 'Code source sur GitHub',
    builtOn: (formancy) => <>Formancy Report repose sur {formancy}, le builder visuel de formulaires pour Angular et React, dont les paquets sont sous Apache-2.0.</>,
    licence: 'Licence (LICENSE.md, en anglais)',
    changelog: 'Changelog (en anglais)',
  },
  it: {
    skip: 'Vai al contenuto',
    pages: 'Pagine',
    languages: 'Lingua',
    breadcrumb: 'Percorso',
    studio: 'Apri lo Studio',
    source: 'Codice sorgente su GitHub',
    builtOn: (formancy) => <>Formancy Report si basa su {formancy}, il builder visuale di moduli per Angular e React, i cui pacchetti sono sotto Apache-2.0.</>,
    licence: 'Licenza (LICENSE.md, in inglese)',
    changelog: 'Changelog (in inglese)',
  },
  en: {
    skip: 'Skip to the content',
    pages: 'Pages',
    languages: 'Language',
    breadcrumb: 'Breadcrumb',
    studio: 'Open the Studio',
    source: 'Source code on GitHub',
    builtOn: (formancy) => <>Formancy Report builds on {formancy}, the visual form builder for Angular and React, whose packages are under Apache-2.0.</>,
    licence: 'Licence (LICENSE.md)',
    changelog: 'Changelog',
  },
}

/** `aria-current` for a link to the page it is on. */
const current = (yes: boolean): 'page' | undefined => (yes ? 'page' : undefined)

export function Shell({ page, children }: { readonly page: PageContext; readonly children: ReactNode }): ReactElement {
  const words = WORDS[page.language]
  const root = page.groups.find(isRoot)
  if (root === undefined) throw new Error('the site has no product page: no group whose slugs are empty')
  const topic = page.group !== root
  const english = page.language === 'en' ? undefined : 'en'
  return (
    <>
      <a className="skip" href="#main">
        {words.skip}
      </a>
      <div className="site">
        <header className="studio-bar site-bar">
          <a className="wordmark" href={page.pageHref(root.id)} aria-current={current(!topic)}>
            Formancy Report
          </a>
          <nav className="site-nav" aria-label={words.pages}>
            <ul>
              {page.groups.filter((group) => group !== root).map((group) => (
                <li key={group.id}>
                  <a className="quiet" href={page.pageHref(group.id)} aria-current={current(group.id === page.group.id)}>
                    {group.meta[page.language].name}
                  </a>
                </li>
              ))}
              <li>
                <a className="quiet" href={page.href('')}>
                  {words.studio}
                </a>
              </li>
              <li>
                <a className="quiet" href={page.inputs.repository}>
                  {words.source}
                </a>
              </li>
            </ul>
          </nav>
          <nav className="languages" aria-label={words.languages}>
            <ul>
              {LANGUAGES.map((language) => (
                <li key={language}>
                  <a href={page.pageHref(page.group.id, language)} hrefLang={language} lang={language} aria-current={current(language === page.language)}>
                    {LANGUAGE[language].name}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </header>
        {topic ? (
          <nav className="crumbs" aria-label={words.breadcrumb}>
            <ol>
              <li>
                <a href={page.pageHref(root.id)}>{root.meta[page.language].name}</a>
              </li>
              <li aria-current="page">{page.group.meta[page.language].name}</li>
            </ol>
          </nav>
        ) : null}
        <main id="main" tabIndex={-1} className="site-main">
          {children}
        </main>
        <footer className="site-foot">
          <p>{words.builtOn(<a href={FORMANCY}>formancy</a>)}</p>
          <ul className="foot-links">
            <li>
              <a href={page.github('LICENSE.md')}>{words.licence}</a>
            </li>
            <li>
              <a href={page.github('CHANGELOG.md')}>{words.changelog}</a>
            </li>
          </ul>
          {page.group.hl7Notice === true ? (
            <p className="notice" lang={english}>
              {HL7_NOTICE}
            </p>
          ) : null}
        </footer>
      </div>
    </>
  )
}
