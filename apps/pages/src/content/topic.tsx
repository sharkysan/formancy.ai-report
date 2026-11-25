/**
 * The layout the invoices page, the Word files page and the two report
 * designers' pages share (0081), in the QR-bill page's order (0024): a hero
 * that says where the page stands; what it does, each card naming the tests
 * it rests on; its pictures; how to try it; what it does not do; and its
 * status, dated, with the licence's terms and where to ask for a licence.
 * One layout, and a group made by `topicGroup`; each page's words are its
 * own copy's, its status, pictures and picture for a shared link its own
 * file's.
 */
import type { ReactElement, ReactNode } from 'react'
import type { Language } from '../languages.js'
import { isRoot } from '../pages.js'
import type { Card, PageContext, PageGroup, PageMeta, PageStatus, Teaser } from '../pages.js'
import { FigureView } from './figures.js'
import type { Figure } from './figures.js'

/**
 * Where a link of a topic page leads, beside the hero's link to the Studio:
 * a file of this repository on GitHub, a heading of it after `#`; another
 * page of the site, by its group, in the page's own language; or an
 * address links.ts names. The link check holds each to what is there
 * (checks/links.ts).
 */
export type Target = { readonly github: string } | { readonly page: string } | { readonly away: string }

/** A link of a topic page: where it leads, and its words, which name where. */
export interface TopicLink {
  readonly to: Target
  readonly words: string
}

/** A topic page's words in one language. */
export interface TopicCopy {
  readonly meta: PageMeta
  /** What the product page says of the page; `standing` follows its text there. */
  readonly teaser: Teaser
  readonly eyebrow: string
  readonly h1: string
  readonly lead: string
  /**
   * Where the page's subject stands, in a sentence that stands on its own:
   * said in the hero and on the start page's card for the page, after the
   * teaser, where a reader decides to try it.
   */
  readonly standing: string
  /** The hero's links: the Studio, its words naming what to choose there, and one more. */
  readonly actions: { readonly studio: string; readonly more: TopicLink }
  readonly does: { readonly heading: string; readonly cards: readonly Card[] }
  readonly pictures: { readonly heading: string; readonly intro: string }
  readonly tryIt: {
    readonly heading: string
    /** How to try it: `version` is the changelog's newest release, which the getting-started guide installs. */
    readonly text: (version: string) => string
    readonly links: readonly TopicLink[]
  }
  /** What it does not do: true of the release the status names, and read again with it. */
  readonly limits: { readonly heading: string; readonly items: readonly string[] }
  readonly status: {
    readonly heading: string
    /** Where it stands: `version` is the changelog's newest release, `date` the day it was last said. */
    readonly text: (version: string, date: string) => string
  }
}

/**
 * The licence, as every topic page's status says it in each language: what
 * is free and what is paid, as LICENSE.md's table words it, and the
 * licence's own address, read from LICENSE.md, to ask for a licence at;
 * then a link to the table itself, on the product page. One sentence for
 * the four pages, so that no page says the terms otherwise.
 */
const LICENCE: Readonly<Record<Language, { readonly says: (mail: ReactNode) => ReactNode; readonly terms: string }>> = {
  de: {
    says: (mail) => (
      <>
        Formancy Report ist source-available: Den Quellcode lesen, es evaluieren, damit entwickeln und testen ist kostenlos, auch in Unternehmen; für den
        Betrieb in Produktion braucht es eine kostenpflichtige Lizenz, die Sie bei {mail} anfragen.
      </>
    ),
    terms: 'Die Bedingungen auf der Produktseite',
  },
  fr: {
    says: (mail) => (
      <>
        Formancy Report est source-available : lire le code source, l'évaluer, développer et tester avec est gratuit, y compris en entreprise ; l'exploitation
        en production nécessite une licence payante, à demander à {mail}.
      </>
    ),
    terms: 'Les conditions, sur la page du produit',
  },
  it: {
    says: (mail) => (
      <>
        Formancy Report è source-available: leggere il codice sorgente, valutarlo, sviluppare e testare con esso è gratuito, anche nelle aziende; l'uso in
        produzione richiede una licenza a pagamento, da richiedere a {mail}.
      </>
    ),
    terms: 'Le condizioni, sulla pagina del prodotto',
  },
  en: {
    says: (mail) => (
      <>
        Formancy Report is source-available: reading the source, evaluating it, and developing and testing with it are free, in companies too; running it in
        production needs a paid licence, which you ask for at {mail}.
      </>
    ),
    terms: 'The terms, on the product page',
  },
}

/** A picture a topic page shows: one of figures.tsx's, under its own caption or under one the page writes for it, in the page's language. */
export interface Shown {
  readonly figure: Figure
  readonly caption?: string
}

/** A topic page as data: its group's id and slugs, its words, its pictures, its status and the Studio's words it names. */
export interface Topic {
  readonly id: string
  readonly slug: Readonly<Record<Language, string>>
  readonly copy: Readonly<Record<Language, TopicCopy>>
  /** Its pictures in each language, its own language's first: each one of figures.tsx's, which figures.test.ts holds. */
  readonly figures: (language: Language) => readonly [Shown, ...Shown[]]
  /** Its picture for a shared link, one of the site's pictures: a page of a document, as every page's is, never a picture of the Studio. */
  readonly image: string | Readonly<Record<Language, string>>
  readonly status: PageStatus
  readonly studioWords?: readonly string[]
}

/** The address `to` names, from `page`. */
function hrefOf(page: PageContext, to: Target): string {
  if ('github' in to) return page.github(to.github)
  if ('page' in to) return page.pageHref(to.page)
  return to.away
}

function TopicBody({ page, topic }: { readonly page: PageContext; readonly topic: Topic }): ReactElement {
  const copy = topic.copy[page.language]
  const licence = LICENCE[page.language]
  const { release } = page.inputs
  const { address } = page.inputs.licence
  const root = page.groups.find(isRoot)
  return (
    <>
      <section className="hero" aria-labelledby="top">
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 id="top">{copy.h1}</h1>
        <p className="lead">{copy.lead}</p>
        <ul className="actions">
          <li>
            <a className="action" href={page.href('')}>
              {copy.actions.studio}
            </a>
          </li>
          <li>
            <a className="quiet" href={hrefOf(page, copy.actions.more.to)}>
              {copy.actions.more.words}
            </a>
          </li>
        </ul>
        <p>{copy.standing}</p>
      </section>

      <section className="band" aria-labelledby="does">
        <h2 id="does">{copy.does.heading}</h2>
        <ul className="cards">
          {copy.does.cards.map((card) => (
            <li key={card.title} className="card">
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="band" aria-labelledby="pictures">
        <h2 id="pictures">{copy.pictures.heading}</h2>
        <p>{copy.pictures.intro}</p>
        <div className="figures">
          {topic.figures(page.language).map(({ figure, caption }, index) => (
            <FigureView key={figure.picture} figure={figure} page={page} first={index === 0} {...(caption === undefined ? {} : { caption })} />
          ))}
        </div>
      </section>

      <section className="band" aria-labelledby="try">
        <h2 id="try">{copy.tryIt.heading}</h2>
        <p>{copy.tryIt.text(release.version)}</p>
        <ul className="links">
          {copy.tryIt.links.map((link) => (
            <li key={link.words}>
              <a href={hrefOf(page, link.to)}>{link.words}</a>
            </li>
          ))}
        </ul>
      </section>

      <section className="band panel" aria-labelledby="limits">
        <h2 id="limits">{copy.limits.heading}</h2>
        <ul className="links">
          {copy.limits.items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>

      <section className="band panel" aria-labelledby="status">
        <h2 id="status">{copy.status.heading}</h2>
        <p>
          <strong>{copy.status.text(release.version, page.day(topic.status.asOf))}</strong>
        </p>
        <p>{licence.says(<a href={`mailto:${address}`}>{address}</a>)}</p>
        {root === undefined ? null : (
          <p>
            <a href={`${page.pageHref(root.id)}#licence`}>{licence.terms}</a>
          </p>
        )}
      </section>
    </>
  )
}

/** `of`, one value for each language. */
const each = <T,>(of: (language: Language) => T): Readonly<Record<Language, T>> => ({ de: of('de'), fr: of('fr'), it: of('it'), en: of('en') })

/**
 * `topic`'s page group: built in every language, linked from every page's
 * bar, introduced on the product page by its teaser with its standing
 * after it, and refused by the site once the changelog names a release its
 * status was not written against (0028).
 */
export function topicGroup(topic: Topic): PageGroup {
  return {
    id: topic.id,
    ...(topic.studioWords === undefined ? {} : { studioWords: topic.studioWords }),
    slug: topic.slug,
    meta: each((language) => topic.copy[language].meta),
    cards: each((language) => topic.copy[language].does.cards),
    teaser: each((language) => ({ ...topic.copy[language].teaser, standing: topic.copy[language].standing })),
    image: topic.image,
    status: topic.status,
    Body: function Body({ page }: { readonly page: PageContext }): ReactElement {
      return <TopicBody page={page} topic={topic} />
    },
  }
}
