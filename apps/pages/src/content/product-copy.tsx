/**
 * The product page's words, in each language. Every claim is one README.md
 * or a decision record makes, and says no more than it; a fact a file here
 * states -- the release, its date, the licence's terms and version -- is
 * read from that file (scripts/inputs.mjs) and handed in, never typed.
 * Reviewed by a person, not a test, for meaning; the suite holds what can
 * be measured (checks/).
 */
import type { ReactNode } from 'react'
import type { Language } from '../languages.js'
import { FORMANCY_DATA } from '../links.js'
import type { PageMeta } from '../pages.js'

export interface Card {
  readonly title: string
  readonly text: ReactNode
}

/** The licence's footnote's parts: the version line's, and the two links. */
export interface Footnote {
  readonly version: string
  readonly date: string
  readonly licence: ReactNode
  readonly mail: ReactNode
}

export interface ProductCopy {
  readonly meta: PageMeta
  readonly eyebrow: (version: string) => string
  readonly h1: string
  readonly lead: string
  readonly actions: { readonly studio: string; readonly guide: string; readonly source: string }
  readonly today: { readonly heading: string; readonly cards: readonly Card[] }
  readonly examples: { readonly heading: string; readonly intro: string; readonly action: string }
  readonly status: {
    readonly heading: (version: string) => string
    readonly released: (date: string) => string
    readonly format: string
    readonly missing: string
    readonly changelog: (version: string) => string
    readonly npm: (name: string) => string
  }
  readonly licence: {
    readonly heading: string
    readonly intro: string
    readonly caption: string
    readonly use: string
    readonly terms: string
    /** Each of LICENSE.md's rows, use and terms, by its English words: a row LICENSE.md changes has no words here, and the site refuses to render. */
    readonly rows: Readonly<Record<string, string>>
    readonly footnote: (parts: Footnote) => ReactNode
    readonly upstream: string
  }
}

const data = <a href={FORMANCY_DATA}>Formancy Data</a>

export const PRODUCT_COPY: Readonly<Record<Language, ProductCopy>> = {
  de: {
    meta: {
      title: 'Formancy Report: PDF-Berichtsdesigner für Angular und React',
      description: 'Paginierte PDF-Berichte in nativen Editoren für Angular und React gestalten: exakte Summen, eine Vorschau, die das echte PDF ist. Selbst gehostet.',
      name: 'Formancy Report',
    },
    eyebrow: (version) => `Version ${version} · Developer Preview`,
    h1: 'Paginierte PDF-Berichte, gestaltet in Ihrer Angular- oder React-Anwendung',
    lead: 'Formancy Report ist ein Berichtsdesigner, den Sie selbst betreiben. Wer einen Bericht gestaltet, legt ihn in einem visuellen Editor an, nativ in Angular und in React; Ihre Anwendung übergibt die Daten, und der Renderer erzeugt das PDF, auf Ihrem Server oder im Browser.',
    actions: { studio: 'Im Studio ausprobieren', guide: 'Die Einführung lesen (Englisch)', source: 'Quellcode auf GitHub' },
    today: {
      heading: 'Was es heute kann',
      cards: [
        {
          title: 'Zwei native Editoren, eine Sitzung',
          text: 'Der React-Builder und der Angular-Builder sind je nativ in ihrem Framework und stellen dasselbe Editormodell dar. Wechseln Sie vom einen zum anderen: Bericht, Rückgängig-Verlauf und Auswahl bleiben erhalten. Keiner hängt vom anderen ab.',
        },
        {
          title: 'Exakte Summen',
          text: 'Beträge werden als Dezimal-Strings weitergegeben, nie als JavaScript-Zahl. Summen werden exakt berechnet und einmal gerundet, wie es der Bericht festlegt, und jeder Wert wird für Sprache und Region des Berichts formatiert.',
        },
        {
          title: 'Lieber ablehnen als abschneiden',
          text: 'Ein Wort, breiter als seine Spalte, eine Seite zu viel, ein Zeichen, das die Schrift nicht darstellen kann: Der Renderer sagt, warum er abbricht, und liefert dann gar kein PDF – nie eines, dem etwas fehlt. Ein endgültiger Druck lehnt unvollständige Daten ab.',
        },
        {
          title: 'Die Vorschau ist das PDF',
          text: 'Die Vorschau im Studio ist keine Nachbildung in HTML: Sie ist das PDF, das der Renderer erzeugt hat, von PDF.js auf weisses Papier gezeichnet, und «Download PDF» gibt Ihnen genau diese Datei.',
        },
        {
          title: 'Probleme vor dem Druck',
          text: 'Der Builder prüft jeden Ausdruck gegen die Felder, die die Daten des Berichts deklarieren, und sagt, was nicht stimmt, bevor etwas gedruckt wird. Kann die Vorschau nicht drucken, nennt sie die Komponente, die das verhindert – einen Tastendruck entfernt.',
        },
        {
          title: 'Tastatur zuerst',
          text: 'Was sich ziehen lässt, geht auch mit der Tastatur, und beide Builder werden mit axe in den drei Sprachen geprüft, die der Editor heute spricht: Englisch, Deutsch (Schweiz) und Französisch (Schweiz).',
        },
        {
          title: 'Ihre Daten bleiben bei Ihnen',
          text: <>Laufzeit und Renderer laden nichts nach und folgen keiner Adresse. Ein Bericht nennt seine Datensätze und Bilder, und Ihre Anwendung übergibt beides: als eigenes JSON oder, nach bestem Bemühen (best-effort), aus einem Server von {data}, mit den Rechten der Person, deren Token Ihre Anwendung mitgibt.</>,
        },
      ],
    },
    examples: {
      heading: 'Beispiele: was die Startvorlagen drucken',
      intro: 'Jede Startvorlage ist ein Bericht mit synthetischen Daten, eingebaut ins Studio. Öffnen Sie eine dort, ändern Sie sie, und die Vorschau druckt sie neu.',
      action: 'Die Startvorlagen im Studio öffnen',
    },
    status: {
      heading: (version) => `Stand: ${version}, eine Developer Preview`,
      released: (date) => `Veröffentlicht am ${date}. Die Pakete sind auf npm, mit Provenance, und das Release auf GitHub enthält die signierte SBOM und den Release-Bericht des Laufs, der sie veröffentlicht hat.`,
      format: 'Das Berichtsformat ist noch ein Entwurf: Dass eine spätere Version einen heute geschriebenen Bericht liest, ist nicht zugesichert.',
      missing: 'Noch nicht dabei: der Server und seine Jobs, Änderungsvorschläge einer KI, die eine Person prüft, bevor sie gelten, ein veröffentlichter PDF-Viewer und konsistentes Lesen aus Formancy Data.',
      changelog: (version) => `Was ${version} enthält, im Changelog (Englisch)`,
      npm: (name) => `${name} auf npm`,
    },
    licence: {
      heading: 'Source-available, nicht Open Source',
      intro: 'Der Quellcode ist öffentlich: Lesen, Forken, Evaluieren, Entwickeln und Testen sind kostenlos, auch in Unternehmen. Für den Betrieb in Produktion braucht es eine kostenpflichtige Lizenz.',
      caption: 'Die Bedingungen, wie LICENSE.md sie festhält',
      use: 'Nutzung',
      terms: 'Bedingungen',
      rows: {
        'Read the source and fork the repository': 'Den Quellcode lesen und das Repository forken',
        'Evaluate, develop and test — including in companies': 'Evaluieren, entwickeln und testen – auch in Unternehmen',
        'Run in production, internally or customer-facing': 'In Produktion betreiben, intern oder für Kundinnen und Kunden',
        'Redistribute inside another software product': 'In einem anderen Softwareprodukt weitergeben',
        'Customer data, report templates and generated documents': 'Kundendaten, Berichtsvorlagen und erzeugte Dokumente',
        Free: 'Kostenlos',
        'Paid licence': 'Kostenpflichtige Lizenz',
        'Separate commercial agreement': 'Separate kommerzielle Vereinbarung',
        "Remain the customer's": 'Bleiben bei der Kundschaft',
      },
      footnote: ({ version, date, licence, mail }) => (
        <>
          Die Bedingungen stehen in {licence} (Englisch): Version {version}, in Kraft seit dem {date}, noch von keiner Anwältin und keinem Anwalt geprüft. Eine Produktionslizenz können Sie bei {mail} anfragen.
        </>
      ),
      upstream: 'Die formancy-Pakete, auf denen es aufbaut, bleiben unter Apache-2.0. Wer in Produktion Daten aus Formancy Data liest, braucht zusätzlich eine Produktionslizenz für Formancy Data.',
    },
  },
  fr: {
    meta: {
      title: 'Formancy Report : rapports PDF pour Angular et React',
      description: 'Concevez des rapports PDF paginés dans des éditeurs natifs pour Angular et React : totaux exacts, un aperçu qui est le vrai PDF, hébergé chez vous.',
      name: 'Formancy Report',
    },
    eyebrow: (version) => `Version ${version} · préversion pour développeurs`,
    h1: 'Des rapports PDF paginés, conçus dans votre application Angular ou React',
    lead: "Formancy Report est un concepteur de rapports que vous hébergez vous-même. La personne qui conçoit le rapport le met en page dans un éditeur visuel, natif en Angular et en React ; votre application fournit les données, et le moteur de rendu génère le PDF, sur votre serveur ou dans le navigateur.",
    actions: { studio: "L'essayer dans le Studio", guide: 'Lire le guide de démarrage (en anglais)', source: 'Le code source sur GitHub' },
    today: {
      heading: "Ce qu'il fait aujourd'hui",
      cards: [
        {
          title: 'Deux éditeurs natifs, une session',
          text: "Le builder React et le builder Angular sont chacun natifs dans leur framework et reposent sur un même modèle d'éditeur. Passez de l'un à l'autre : le rapport, l'historique d'annulation et la sélection sont conservés. Aucun ne dépend de l'autre.",
        },
        {
          title: 'Des totaux exacts',
          text: 'Les montants circulent sous forme de chaînes décimales, jamais comme nombre JavaScript. Les totaux sont calculés de manière exacte et arrondis une seule fois, comme le rapport le déclare, et chaque valeur est formatée selon la langue et la région du rapport.',
        },
        {
          title: 'Il refuse plutôt que de tronquer',
          text: "Un mot plus large que sa colonne, une page de trop, un caractère que la police ne peut pas dessiner : le moteur de rendu dit pourquoi il s'arrête et ne livre aucun PDF, jamais un PDF auquel il manque quelque chose. Un rendu final refuse les données incomplètes.",
        },
        {
          title: "L'aperçu est le PDF",
          text: "L'aperçu du Studio n'est pas une imitation en HTML : c'est le PDF que le moteur de rendu a généré, dessiné par PDF.js sur papier blanc, et « Download PDF » vous remet ce même fichier.",
        },
        {
          title: "Les problèmes avant l'impression",
          text: "Le builder vérifie chaque expression par rapport aux champs que déclarent les données du rapport, et signale ce qui ne va pas avant tout rendu. Si l'aperçu ne peut pas s'imprimer, il nomme le composant en cause, accessible d'une seule touche.",
        },
        {
          title: "Le clavier d'abord",
          text: "Chaque glisser-déposer a son équivalent au clavier, et les deux builders sont testés avec axe dans les trois langues que l'éditeur parle aujourd'hui : l'anglais, l'allemand (Suisse) et le français (Suisse).",
        },
        {
          title: 'Vos données restent chez vous',
          text: <>Le runtime et le moteur de rendu ne vont rien chercher et ne suivent aucune adresse. Un rapport nomme ses jeux de données et ses images, et votre application fournit les deux : en JSON, ou, en mode best-effort, depuis un serveur {data}, avec les droits de la personne dont votre application transmet le jeton.</>,
        },
      ],
    },
    examples: {
      heading: "Exemples : ce qu'impriment les modèles de départ",
      intro: "Chaque modèle de départ est un rapport avec des données synthétiques, intégré au Studio. Ouvrez-en un, modifiez-le, et l'aperçu l'imprime à nouveau.",
      action: 'Ouvrir les modèles de départ dans le Studio',
    },
    status: {
      heading: (version) => `État : ${version}, une préversion pour développeurs`,
      released: (date) => `Publiée le ${date}. Ses paquets sont sur npm, avec provenance, et la release sur GitHub contient le SBOM signé et le rapport de release de l'exécution qui les a publiés.`,
      format: "Le format des rapports est encore un brouillon : rien ne garantit qu'une version ultérieure lise un rapport écrit aujourd'hui.",
      missing: "Pas encore disponible : le serveur et ses tâches, les modifications proposées par une IA et revues par une personne avant de s'appliquer, un visualiseur PDF publié, et une lecture cohérente depuis Formancy Data.",
      changelog: (version) => `Ce que contient ${version}, dans le changelog (en anglais)`,
      npm: (name) => `${name} sur npm`,
    },
    licence: {
      heading: 'Source-available, pas open source',
      intro: "Le code source est public : le lire, le forker, l'évaluer, développer et tester avec lui, c'est gratuit, y compris en entreprise. L'exploitation en production nécessite une licence payante.",
      caption: 'Les conditions, telles que LICENSE.md les énonce',
      use: 'Usage',
      terms: 'Conditions',
      rows: {
        'Read the source and fork the repository': 'Lire le code source et forker le dépôt',
        'Evaluate, develop and test — including in companies': 'Évaluer, développer et tester — y compris en entreprise',
        'Run in production, internally or customer-facing': 'Exploiter en production, en interne ou pour des clients',
        'Redistribute inside another software product': 'Redistribuer dans un autre produit logiciel',
        'Customer data, report templates and generated documents': 'Données des clients, modèles de rapports et documents générés',
        Free: 'Gratuit',
        'Paid licence': 'Licence payante',
        'Separate commercial agreement': 'Accord commercial distinct',
        "Remain the customer's": 'Restent au client',
      },
      footnote: ({ version, date, licence, mail }) => (
        <>
          Les conditions sont dans {licence} (en anglais) : version {version}, en vigueur depuis le {date}, pas encore revue par un avocat ou une avocate. Une licence de production se demande à {mail}.
        </>
      ),
      upstream: 'Les paquets formancy sur lesquels il repose restent sous Apache-2.0. Lire des données depuis Formancy Data en production nécessite en plus une licence de production Formancy Data.',
    },
  },
  it: {
    meta: {
      title: 'Formancy Report: progettare report PDF per Angular e React',
      description: "Progettate report PDF impaginati in editor nativi per Angular e React: totali esatti, un'anteprima che è il vero PDF, sui vostri server.",
      name: 'Formancy Report',
    },
    eyebrow: (version) => `Versione ${version} · anteprima per sviluppatori`,
    h1: 'Report PDF impaginati, progettati nella vostra applicazione Angular o React',
    lead: 'Formancy Report è un designer di report che ospitate voi stessi. Chi progetta un report lo impagina in un editor visuale, nativo in Angular e in React; la vostra applicazione fornisce i dati, e il renderer genera il PDF, sul vostro server o nel browser.',
    actions: { studio: 'Provarlo nello Studio', guide: 'Leggere la guida introduttiva (in inglese)', source: 'Il codice sorgente su GitHub' },
    today: {
      heading: 'Che cosa fa oggi',
      cards: [
        {
          title: 'Due editor nativi, una sessione',
          text: "Il builder React e il builder Angular sono ciascuno nativo nel proprio framework e si basano su un unico modello di editor. Passando dall'uno all'altro, il report, la cronologia degli annullamenti e la selezione restano invariati. Nessuno dei due dipende dall'altro.",
        },
        {
          title: 'Totali esatti',
          text: 'Gli importi circolano come stringhe decimali, mai come numero JavaScript. I totali sono calcolati in modo esatto e arrotondati una sola volta, come il report dichiara, e ogni valore è formattato per la lingua e la regione del report.',
        },
        {
          title: 'Rifiuta invece di troncare',
          text: 'Una parola più larga della sua colonna, una pagina di troppo, un carattere che il font non sa disegnare: il renderer dice perché si è fermato e non restituisce alcun PDF, mai uno a cui manchi qualcosa. Una stampa definitiva rifiuta dati incompleti.',
        },
        {
          title: "L'anteprima è il PDF",
          text: "L'anteprima dello Studio non è un'imitazione in HTML: è il PDF che il renderer ha generato, disegnato da PDF.js su carta bianca, e «Download PDF» vi consegna proprio quel file.",
        },
        {
          title: 'I problemi prima della stampa',
          text: "Il builder verifica ogni espressione rispetto ai campi che i dati del report dichiarano, e segnala che cosa non va prima di qualsiasi stampa. Se l'anteprima non si può stampare, indica il componente che l'ha bloccata, raggiungibile con un tasto.",
        },
        {
          title: 'Prima la tastiera',
          text: "Ogni trascinamento ha un equivalente da tastiera, ed entrambi i builder sono verificati con axe nelle tre lingue che l'editor parla oggi: inglese, tedesco (Svizzera) e francese (Svizzera). L'italiano non ancora.",
        },
        {
          title: 'I vostri dati restano da voi',
          text: <>Il runtime e il renderer non caricano nulla e non seguono alcun indirizzo. Un report nomina i suoi set di dati e le sue immagini, e la vostra applicazione fornisce entrambi: come JSON proprio o, in modalità best-effort, da un server {data}, con i permessi della persona di cui la vostra applicazione fornisce il token.</>,
        },
      ],
    },
    examples: {
      heading: 'Esempi: che cosa stampano i modelli iniziali',
      intro: "Ogni modello iniziale è un report con dati sintetici, integrato nello Studio. Apritene uno, modificatelo, e l'anteprima lo stampa di nuovo.",
      action: 'Aprire i modelli iniziali nello Studio',
    },
    status: {
      heading: (version) => `Stato: ${version}, un'anteprima per sviluppatori`,
      released: (date) => `Pubblicata il ${date}. I suoi pacchetti sono su npm, con provenance, e la release su GitHub contiene lo SBOM firmato e il rapporto di release dell'esecuzione che li ha pubblicati.`,
      format: 'Il formato dei report è ancora una bozza: non è garantito che una versione successiva legga un report scritto oggi.',
      missing: "Non ancora disponibili: il server e i suoi job, le modifiche proposte da un'IA e verificate da una persona prima di essere applicate, un visualizzatore PDF pubblicato e una lettura coerente da Formancy Data.",
      changelog: (version) => `Che cosa contiene ${version}, nel changelog (in inglese)`,
      npm: (name) => `${name} su npm`,
    },
    licence: {
      heading: 'Source-available, non open source',
      intro: "Il codice sorgente è pubblico: leggerlo, farne un fork, valutarlo, svilupparci e testarlo è gratuito, anche in un'azienda. L'uso in produzione richiede una licenza a pagamento.",
      caption: 'Le condizioni, come le stabilisce LICENSE.md',
      use: 'Uso',
      terms: 'Condizioni',
      rows: {
        'Read the source and fork the repository': 'Leggere il codice sorgente e fare un fork del repository',
        'Evaluate, develop and test — including in companies': 'Valutare, sviluppare e testare — anche in azienda',
        'Run in production, internally or customer-facing': 'Usare in produzione, internamente o per i clienti',
        'Redistribute inside another software product': "Ridistribuire all'interno di un altro prodotto software",
        'Customer data, report templates and generated documents': 'Dati dei clienti, modelli di report e documenti generati',
        Free: 'Gratuito',
        'Paid licence': 'Licenza a pagamento',
        'Separate commercial agreement': 'Accordo commerciale separato',
        "Remain the customer's": 'Restano del cliente',
      },
      footnote: ({ version, date, licence, mail }) => (
        <>
          Le condizioni sono in {licence} (in inglese): versione {version}, in vigore dal {date}, non ancora esaminata da un avvocato o da un'avvocata. Una licenza di produzione si richiede a {mail}.
        </>
      ),
      upstream: 'I pacchetti formancy su cui si basa restano sotto Apache-2.0. Leggere dati da Formancy Data in produzione richiede anche una licenza di produzione di Formancy Data.',
    },
  },
  en: {
    meta: {
      title: 'Formancy Report: PDF report designer for Angular and React',
      description: 'Design paginated PDF reports in native Angular and React editors. Exact totals, a preview that is the real PDF, self-hosted and source-available.',
      name: 'Formancy Report',
    },
    eyebrow: (version) => `Version ${version} · developer preview`,
    h1: 'Paginated PDF reports, designed inside your Angular or React application',
    lead: 'Formancy Report is a report designer you host yourself. An author lays out a report in a visual editor, native in Angular and in React; your application hands over the data, and the renderer prints the PDF, on your server or in the browser.',
    actions: { studio: 'Try it in the Studio', guide: 'Read the getting-started guide', source: 'Source code on GitHub' },
    today: {
      heading: 'What it does today',
      cards: [
        {
          title: 'Two native editors, one session',
          text: 'The React builder and the Angular builder are each native to their framework and render one editor model. Switch from one to the other and the report, its undo history and the selection stay. Neither depends on the other.',
        },
        {
          title: 'Totals that are exact',
          text: "Amounts travel as decimal strings, never through a JavaScript number. Totals are computed exactly and rounded once, as the report declares, and each value is formatted for the report's language and region.",
        },
        {
          title: 'It refuses rather than truncates',
          text: 'A word wider than its column, a page too many, a character the font cannot draw: the renderer says why it stopped and returns no PDF, never one with something missing. A final render refuses incomplete data.',
        },
        {
          title: 'The preview is the PDF',
          text: "The Studio's preview is no imitation in HTML: it is the PDF the renderer printed, drawn by PDF.js on white paper, and “Download PDF” hands you that same file.",
        },
        {
          title: 'Problems before printing',
          text: "The builder checks every expression against the fields the report's data declares, and says what is wrong before anything is rendered. A preview that cannot print names the component that stopped it, one key press away.",
        },
        {
          title: 'Keyboard first',
          text: 'Every drag has a keyboard path, and both builders are tested with axe in the three languages the editor speaks today: English, German (Switzerland) and French (Switzerland).',
        },
        {
          title: 'Your data stays with you',
          text: <>The runtime and the renderer fetch nothing and follow no address. A report names its datasets and its images, and your application hands over both: as JSON of its own or, best-effort, from a {data} server, read as the person whose token your application supplies.</>,
        },
      ],
    },
    examples: {
      heading: 'Examples: what the starters print',
      intro: 'Each starter is a report with synthetic data, built into the Studio. Open one there, change it, and the preview prints it again.',
      action: 'Open the starters in the Studio',
    },
    status: {
      heading: (version) => `Status: ${version}, a developer preview`,
      released: (date) => `Released on ${date}. Its packages are on npm, with provenance, and the GitHub release carries the signed SBOM and the release report of the run that published them.`,
      format: 'The report format is still a draft: a report written now is not promised to be read by a later release.',
      missing: 'Not here yet: the server and its jobs, changes an AI proposes and a person reviews before they apply, a published PDF viewer, and a consistent read from Formancy Data.',
      changelog: (version) => `What ${version} holds, in the changelog`,
      npm: (name) => `${name} on npm`,
    },
    licence: {
      heading: 'Source-available, not open source',
      intro: 'The source is public: reading it, forking it, and evaluating, developing and testing with it are free, in a company too. Running it in production needs a paid licence.',
      caption: 'The terms, as LICENSE.md states them',
      use: 'Use',
      terms: 'Terms',
      rows: {
        'Read the source and fork the repository': 'Read the source and fork the repository',
        'Evaluate, develop and test — including in companies': 'Evaluate, develop and test — including in companies',
        'Run in production, internally or customer-facing': 'Run in production, internally or customer-facing',
        'Redistribute inside another software product': 'Redistribute inside another software product',
        'Customer data, report templates and generated documents': 'Customer data, report templates and generated documents',
        Free: 'Free',
        'Paid licence': 'Paid licence',
        'Separate commercial agreement': 'Separate commercial agreement',
        "Remain the customer's": "Remain the customer's",
      },
      footnote: ({ version, date, licence, mail }) => (
        <>
          The terms are in {licence}: Version {version}, in force from {date}, not yet reviewed by a lawyer. A production licence is requested from {mail}.
        </>
      ),
      upstream: 'The formancy packages it builds on stay under Apache-2.0. Reading data from Formancy Data in production needs a Formancy Data production licence as well.',
    },
  },
}
