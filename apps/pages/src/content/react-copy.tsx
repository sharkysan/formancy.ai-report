/**
 * The React report designer's page's words, in each language (0081). Every
 * card is a claim 0012's builders make and their tests hold, and the
 * install gate's (0015), and says no more than they do: the Angular page
 * says the same of its own builder, each in its own words over its own
 * tests. The PDF printed in the browser is the renderer's browser entry,
 * and the Studio's preview the proof of it in a page. A Studio word the
 * page names, "Builder" and its "React", is the Studio's, held to its
 * recorded pictures by checks/studio-words.ts (0056). No translation is
 * reviewed by a native speaker; the German is Switzerland's spelling.
 * Reviewed by a person, not a test, for meaning; the suite holds what can
 * be measured (checks/).
 */
import type { Language } from '../languages.js'
import type { Evidence } from '../pages.js'
import type { Target, TopicCopy } from './topic.js'

/**
 * The tests each card rests on, one list a card, which the card shares in
 * every language (checks/evidence.ts).
 */
const EVIDENCE = {
  // The React host holding no Angular builder, and every scenario run in
  // the React builder over the core's session.
  native: ['scripts/install-hosts.test.mjs', 'packages/report-builder-react/src/scenarios.test.tsx'],
  // A host project per kind, each builder at both ends of its peer range,
  // and the guide's code compiled and run.
  installs: ['scripts/install-hosts.test.mjs', 'scripts/install-test.mjs', 'scripts/getting-started.test.mjs'],
  // One list of scenarios over one editor model, and the switch between
  // the builders in Chromium keeping the report and its history.
  sameEditor: [
    'packages/report-builder-core/src/scenarios.test.ts',
    'packages/report-builder-react/src/scenarios.test.tsx',
    'apps/studio/scripts/gate-switch.mjs',
  ],
  // The keys, the places a drag reaches as a list, and axe over every
  // scenario.
  keyboard: [
    'packages/report-builder-react/src/keyboard.test.tsx',
    'packages/report-builder-react/src/accessibility.test.tsx',
    'packages/report-builder-core/src/keys.test.ts',
    'packages/report-builder-core/src/targets.test.ts',
  ],
  // Mounted, unmounted, mounted again, given another editor, two at once.
  lifecycle: ['packages/report-builder-react/src/lifecycle.test.tsx'],
  // The host's node mounted in the design view's place.
  hostView: ['packages/report-builder-react/src/host-view.test.tsx'],
  // Each read of an undeclared field named where it is, and the builder's
  // list of problems, each linked to its component.
  problems: ['packages/report-core/src/diagnostics/diagnose.test.ts', 'packages/report-builder-react/src/scenarios.test.tsx'],
  // The renderer's browser entry, the Studio's preview printed by it, and
  // in Chromium the PDF Download PDF gives.
  browser: ['packages/report-render-pdf/src/browser.test.ts', 'apps/studio/src/preview/pipeline.test.ts', 'apps/studio/scripts/browser-test.mjs'],
} satisfies Record<string, Evidence>

/** Where the page's links lead. */
const TO = {
  mount: { github: 'packages/report-builder-react/README.md#mounting-it' },
  guide: { github: 'docs/getting-started.md#4-embed-the-editor-in-react' },
  tests: { github: 'packages/report-builder-react/README.md#what-the-tests-show' },
  angular: { page: 'angular' },
  invoices: { page: 'invoices' },
} satisfies Record<string, Target>

export const REACT_COPY: Readonly<Record<Language, TopicCopy>> = {
  de: {
    meta: {
      title: 'Reportdesigner für React, PDF und Word – Formancy Report',
      description:
        'Ein nativer Reportdesigner für React 19 in Ihrer Anwendung, Tastatur zuerst und mit axe geprüft. PDF im Browser oder auf dem Server, oder eine Word-Datei.',
      name: 'React',
    },
    teaser: {
      heading: 'Für React',
      text: 'Der Reportdesigner als Komponente für React 19 in Ihrer eigenen Anwendung, Tastatur zuerst, und das PDF im Browser oder auf Ihrem Server gedruckt.',
      action: 'Der Reportdesigner für React',
    },
    eyebrow: 'Formancy Report für React',
    h1: 'Ein Reportdesigner, nativ für React gebaut',
    lead: 'Ihre React-Anwendung bekommt einen eigenen visuellen Reportdesigner, für React 19 geschrieben. Wer einen Bericht gestaltet, legt eine Rechnung, eine Offerte oder einen Verkaufsbericht in Ihrer Anwendung an; Ihre Anwendung übergibt die Daten, und der Renderer druckt das PDF, im Browser oder auf Ihrem Server, oder schreibt eine Word-Datei. Angular kommt nicht mit.',
    standing: 'Der React-Builder ist im neuesten Release enthalten; im Studio wählen Sie dafür Builder: React.',
    actions: { studio: 'Im Studio ausprobieren (Builder: React)', more: { to: TO.mount, words: 'In Ihre React-Anwendung einbinden (README, Englisch)' } },
    does: {
      heading: 'Was es kann',
      cards: [
        {
          title: 'Nativ für React 19',
          text: 'Der Builder für React 19 stellt dieselbe Bearbeitungssitzung dar wie der Angular-Builder, und eine React-Anwendung installiert keinen Angular-Builder.',
          evidence: EVIDENCE.native,
        },
        {
          title: 'Installiert in ein schlichtes React-Projekt',
          text: 'Das gepackte Paket wird in ein Projekt installiert, das nichts von diesem Repository weiss, an beiden Enden seines React-Peer-Bereichs, dann typgeprüft, ausgeführt und für den Browser gebündelt. Der React-Code der Einführung wird genauso kompiliert und ausgeführt.',
          evidence: EVIDENCE.installs,
        },
        {
          title: 'Derselbe Editor wie der Angular-Builder',
          text: 'Beide Builder stellen ein Editormodell dar und bestehen eine Liste von Szenarien. Wechseln Sie zwischen ihnen, und Bericht und Rückgängig-Verlauf bleiben.',
          evidence: EVIDENCE.sameEditor,
        },
        {
          title: 'Tastatur zuerst, mit axe geprüft',
          text: 'Was sich ziehen lässt, geht auch mit der Tastatur, die Orte, die ein Ziehen erreicht, sind eine Liste zum Auswählen, und axe läuft über jedes Szenario in den drei Sprachen des Editors.',
          evidence: EVIDENCE.keyboard,
        },
        {
          title: 'Eingebunden, entfernt, zweimal gezeigt',
          text: 'Der Builder arbeitet über einer Sitzung, die ihm nicht gehört: eingebunden, entfernt, wieder eingebunden, mit einem anderen Editor versehen und zweimal zugleich gezeigt, ohne eine Änderung zu verlieren oder ein Abonnement zurückzulassen.',
          evidence: EVIDENCE.lifecycle,
        },
        {
          title: 'Ihre Seite im Editor',
          text: 'Ihre eigene Ansicht steht an der Stelle der Entwurfsansicht, solange der Editor sie zeigt.',
          evidence: EVIDENCE.hostView,
        },
        {
          title: 'Probleme vor dem Druck',
          text: 'Jedes Lesen eines Felds, das die Daten nicht deklarieren, wird dort genannt, wo es steht, und der Builder listet die Probleme auf, jedes mit seiner Komponente verknüpft.',
          evidence: EVIDENCE.problems,
        },
        {
          title: 'Ein PDF auch im Browser',
          text: 'Der Renderer hat einen Einstieg für den Browser. Im Studio ist die Vorschau das PDF, das er in der Seite gedruckt hat, und Download PDF gibt genau diese Datei.',
          evidence: EVIDENCE.browser,
        },
      ],
    },
    pictures: {
      heading: 'Im Studio',
      intro:
        'Ein Skript hat jedes Bild vom gebauten Studio aufgenommen, nicht von Hand: die XRechnung und die Offerte, jede im React-Builder und daneben das PDF, das die Sitzung druckt.',
    },
    tryIt: {
      heading: 'Ausprobieren',
      text: (version) =>
        `Wählen Sie im Studio unter Builder React, und jede Startvorlage öffnet sich im React-Builder. Die Einführung installiert ${version}, das neueste Release, und bindet den Editor in eine React-Seite ein (Englisch).`,
      links: [
        { to: TO.guide, words: 'Den Editor in React einbetten (Einführung, Englisch)' },
        { to: TO.tests, words: 'Was die Tests des React-Builders zeigen (README, Englisch)' },
        { to: TO.angular, words: 'Der Reportdesigner für Angular' },
        { to: TO.invoices, words: 'Rechnungen mit QR-Rechnung oder E-Rechnung' },
      ],
    },
    limits: {
      heading: 'Was es nicht tut',
      items: [
        'Nur React 19: Sein Peer-Bereich ist ^19.0.0.',
        'Kein veröffentlichter PDF-Viewer: Der des Studios ist in keinem Paket, darum zeigt Ihre Anwendung das PDF in einem eigenen Viewer.',
        'Noch kein Diagramm in der Palette des Builders, und die Worte des Editors gibt es nur auf Englisch, Deutsch (Schweiz) und Französisch (Schweiz), noch nicht auf Italienisch.',
        'Das Berichtsformat ist noch ein Entwurf (Version 0).',
      ],
    },
    status: {
      heading: 'Stand',
      text: (version, date) => `In ${version}, dem neuesten Release, im Quellcode auf GitHub und online im Studio (Stand ${date}).`,
    },
  },
  fr: {
    meta: {
      title: 'Concepteur de rapports pour React – Formancy Report',
      description:
        "Un concepteur de rapports natif pour React 19 dans votre application, clavier d'abord, vérifié avec axe. PDF dans le navigateur ou sur le serveur, ou Word.",
      name: 'React',
    },
    teaser: {
      heading: 'Pour React',
      text: "Le concepteur de rapports en composant React 19 dans votre propre application, le clavier d'abord, le PDF imprimé dans le navigateur ou sur votre serveur.",
      action: 'Le concepteur de rapports pour React',
    },
    eyebrow: 'Formancy Report pour React',
    h1: 'Un concepteur de rapports conçu nativement pour React',
    lead: 'Votre application React reçoit son propre concepteur visuel de rapports, écrit pour React 19. La personne qui conçoit un rapport met en page une facture, une offre ou un rapport de ventes dans votre application ; votre application fournit les données, et le moteur de rendu imprime le PDF, dans le navigateur ou sur votre serveur, ou écrit un fichier Word. Angular ne vient pas avec.',
    standing: 'Le builder React figure dans la version la plus récente ; dans le Studio en ligne, choisissez Builder : React.',
    actions: {
      studio: "L'essayer dans le Studio (Builder : React)",
      more: { to: TO.mount, words: "L'intégrer dans votre application React (README, en anglais)" },
    },
    does: {
      heading: "Ce qu'il fait",
      cards: [
        {
          title: 'Natif pour React 19',
          text: "Le builder pour React 19 affiche la même session d'édition que le builder Angular, et une application React n'installe aucun builder Angular.",
          evidence: EVIDENCE.native,
        },
        {
          title: "S'installe dans un projet React ordinaire",
          text: 'Le paquet empaqueté est installé dans un projet qui ne sait rien de ce dépôt, aux deux bouts de sa plage de versions de React, puis vérifié par le compilateur, exécuté et regroupé pour le navigateur. Le code React du guide de démarrage est compilé et exécuté de la même façon.',
          evidence: EVIDENCE.installs,
        },
        {
          title: 'Le même éditeur que le builder Angular',
          text: "Les deux builders reposent sur un même modèle d'éditeur et passent une même liste de scénarios. Passez de l'un à l'autre : le rapport et son historique d'annulation sont conservés.",
          evidence: EVIDENCE.sameEditor,
        },
        {
          title: "Le clavier d'abord, vérifié avec axe",
          text: "Chaque glisser-déposer a son équivalent au clavier, les endroits qu'un glisser atteint forment une liste où choisir, et axe passe sur chaque scénario dans les trois langues de l'éditeur.",
          evidence: EVIDENCE.keyboard,
        },
        {
          title: 'Monté, démonté, montré deux fois',
          text: "Le builder travaille sur une session qui ne lui appartient pas : monté, démonté, remonté, confié à un autre éditeur et montré deux fois à la fois, sans perdre une modification ni laisser d'abonnement derrière lui.",
          evidence: EVIDENCE.lifecycle,
        },
        {
          title: "Votre page dans l'éditeur",
          text: "Votre propre vue prend la place de la vue de conception tant que l'éditeur l'affiche.",
          evidence: EVIDENCE.hostView,
        },
        {
          title: "Les problèmes avant l'impression",
          text: "Chaque lecture d'un champ que les données ne déclarent pas est signalée là où elle se trouve, et le builder liste les problèmes, chacun relié à son composant.",
          evidence: EVIDENCE.problems,
        },
        {
          title: 'Un PDF aussi dans le navigateur',
          text: "Le moteur de rendu a une entrée pour le navigateur. Dans le Studio, l'aperçu est le PDF qu'il a imprimé dans la page, et Download PDF donne ce fichier même.",
          evidence: EVIDENCE.browser,
        },
      ],
    },
    pictures: {
      heading: 'Dans le Studio',
      intro:
        "Un script a pris chaque image dans le Studio construit, jamais à la main : la XRechnung et l'offre, chacune dans le builder React et, à côté, le PDF que la session imprime.",
    },
    tryIt: {
      heading: "L'essayer",
      text: (version) =>
        `Dans le Studio, choisissez React sous Builder, et chaque modèle de départ s'ouvre dans le builder React. Le guide de démarrage installe ${version}, la version la plus récente, et intègre l'éditeur dans une page React (en anglais).`,
      links: [
        { to: TO.guide, words: "Intégrer l'éditeur dans React (guide de démarrage, en anglais)" },
        { to: TO.tests, words: 'Ce que montrent les tests du builder React (README, en anglais)' },
        { to: TO.angular, words: 'Le concepteur de rapports pour Angular' },
        { to: TO.invoices, words: 'Les factures, avec facture QR, Factur-X ou XRechnung' },
      ],
    },
    limits: {
      heading: "Ce qu'il ne fait pas",
      items: [
        'React 19 seulement : sa plage de versions de React est ^19.0.0.',
        "Pas de visionneuse PDF publiée : celle du Studio n'est dans aucun paquet, votre application affiche donc le PDF dans sa propre visionneuse.",
        "Pas encore de graphique dans la palette du builder, et l'éditeur ne parle qu'anglais, allemand (Suisse) et français (Suisse), pas encore italien.",
        'Le format des rapports est encore un brouillon (version 0).',
      ],
    },
    status: {
      heading: 'État',
      text: (version, date) => `Dans la version ${version}, la plus récente, dans le code source sur GitHub et en ligne dans le Studio (état au ${date}).`,
    },
  },
  it: {
    meta: {
      title: 'Report designer per React, PDF e Word – Formancy Report',
      description:
        'Un report designer nativo per React 19 nella vostra applicazione, prima la tastiera, verificato con axe. PDF nel browser o sul server, oppure file Word.',
      name: 'React',
    },
    teaser: {
      heading: 'Per React',
      text: 'Il report designer come componente React 19 nella vostra applicazione, prima la tastiera, con il PDF stampato nel browser o sul vostro server.',
      action: 'Il report designer per React',
    },
    eyebrow: 'Formancy Report per React',
    h1: 'Un report designer nativo per React',
    lead: "La vostra applicazione React riceve un proprio report designer visuale, scritto per React 19. Chi progetta un report impagina una fattura, un'offerta o un report di vendita nella vostra applicazione; la vostra applicazione fornisce i dati, e il renderer stampa il PDF, nel browser o sul vostro server, oppure scrive un file Word. Angular non viene con lui.",
    standing: 'Il builder React fa parte della versione più recente; nello Studio online, scegliete Builder: React.',
    actions: {
      studio: 'Provarlo nello Studio (Builder: React)',
      more: { to: TO.mount, words: 'Integrarlo nella vostra applicazione React (README, in inglese)' },
    },
    does: {
      heading: 'Che cosa fa',
      cards: [
        {
          title: 'Nativo per React 19',
          text: "Il builder per React 19 mostra la stessa sessione di modifica del builder Angular, e un'applicazione React non installa alcun builder Angular.",
          evidence: EVIDENCE.native,
        },
        {
          title: 'Si installa in un normale progetto React',
          text: 'Il pacchetto impacchettato viene installato in un progetto che non sa nulla di questo repository, ai due estremi del suo intervallo di versioni di React, poi verificato dal compilatore, eseguito e impacchettato per il browser. Il codice React della guida introduttiva viene compilato ed eseguito allo stesso modo.',
          evidence: EVIDENCE.installs,
        },
        {
          title: 'Lo stesso editor del builder Angular',
          text: "I due builder si basano su un unico modello di editor e superano un'unica lista di scenari. Passando dall'uno all'altro, il report e la cronologia degli annullamenti restano.",
          evidence: EVIDENCE.sameEditor,
        },
        {
          title: 'Prima la tastiera, verificato con axe',
          text: "Ogni trascinamento ha un equivalente da tastiera, i punti che un trascinamento raggiunge sono una lista da cui scegliere, e axe passa su ogni scenario nelle tre lingue dell'editor.",
          evidence: EVIDENCE.keyboard,
        },
        {
          title: 'Montato, smontato, mostrato due volte',
          text: "Il builder lavora su una sessione che non è sua: montato, smontato, rimontato, affidato a un altro editor e mostrato due volte insieme, senza perdere una modifica né lasciare un'iscrizione dietro di sé.",
          evidence: EVIDENCE.lifecycle,
        },
        {
          title: "La vostra pagina nell'editor",
          text: "La vostra vista prende il posto della vista di progettazione finché l'editor la mostra.",
          evidence: EVIDENCE.hostView,
        },
        {
          title: 'I problemi prima della stampa',
          text: 'Ogni lettura di un campo che i dati non dichiarano viene indicata là dove si trova, e il builder elenca i problemi, ciascuno collegato al suo componente.',
          evidence: EVIDENCE.problems,
        },
        {
          title: 'Un PDF anche nel browser',
          text: "Il renderer ha un punto d'ingresso per il browser. Nello Studio l'anteprima è il PDF che ha stampato nella pagina, e Download PDF dà proprio quel file.",
          evidence: EVIDENCE.browser,
        },
      ],
    },
    pictures: {
      heading: 'Nello Studio',
      intro:
        "Uno script ha preso ogni immagine dallo Studio compilato, mai a mano: la XRechnung e l'offerta, ciascuna nel builder React e, accanto, il PDF che la sessione stampa.",
    },
    tryIt: {
      heading: 'Provarlo',
      text: (version) =>
        `Nello Studio, scegliete React sotto Builder, e ogni modello iniziale si apre nel builder React. La guida introduttiva installa ${version}, la versione più recente, e integra l'editor in una pagina React (in inglese).`,
      links: [
        { to: TO.guide, words: "Integrare l'editor in React (guida introduttiva, in inglese)" },
        { to: TO.tests, words: 'Che cosa mostrano i test del builder React (README, in inglese)' },
        { to: TO.angular, words: 'Il report designer per Angular' },
        { to: TO.invoices, words: 'Le fatture, con fattura QR, Factur-X o XRechnung' },
      ],
    },
    limits: {
      heading: 'Che cosa non fa',
      items: [
        'Solo React 19: il suo intervallo di versioni di React è ^19.0.0.',
        'Nessun visualizzatore PDF pubblicato: quello dello Studio non è in alcun pacchetto, quindi la vostra applicazione mostra il PDF in un visualizzatore proprio.',
        "Ancora nessun grafico nella palette del builder, e l'editor parla solo inglese, tedesco (Svizzera) e francese (Svizzera), non ancora italiano.",
        'Il formato dei report è ancora una bozza (versione 0).',
      ],
    },
    status: {
      heading: 'Stato',
      text: (version, date) => `Nella versione ${version}, la più recente, nel codice sorgente su GitHub e online nello Studio (stato al ${date}).`,
    },
  },
  en: {
    meta: {
      title: 'React report designer for PDF and Word – Formancy Report',
      description:
        'A report designer native to React 19, in your own app, keyboard first, tested with axe. Print PDF in the browser or on the server, or write a Word file.',
      name: 'React',
    },
    teaser: {
      heading: 'For React',
      text: 'The report designer as a React 19 component in your own application, keyboard first, printing PDF in the browser or on your server.',
      action: 'The React report designer',
    },
    eyebrow: 'Formancy Report for React',
    h1: 'A report designer built natively for React',
    lead: 'Your React application gets a visual report designer of its own, written for React 19. A person lays out an invoice, a quotation or a sales report inside your application; your application hands over the data, and the renderer prints the PDF, in the browser or on your server, or writes a Word file. No Angular comes with it.',
    standing: 'The React builder is in the newest release; in the online Studio, choose Builder: React.',
    actions: { studio: 'Try it in the Studio (Builder: React)', more: { to: TO.mount, words: 'Mount it in your React application (README)' } },
    does: {
      heading: 'What it does',
      cards: [
        {
          title: 'Native to React 19',
          text: 'The builder for React 19 draws the same editing session the Angular builder edits, and a React host installs no Angular builder.',
          evidence: EVIDENCE.native,
        },
        {
          title: 'Installs into a plain React project',
          text: "The packed package is installed into a project that knows nothing of this repository, at both ends of its React peer range, then type-checked, run and bundled for the browser. The getting-started guide's React code is compiled and run the same way.",
          evidence: EVIDENCE.installs,
        },
        {
          title: 'The same editor as the Angular builder',
          text: 'Both builders render one editor model and pass one list of scenarios. Switch between them and the report and its undo history stay.',
          evidence: EVIDENCE.sameEditor,
        },
        {
          title: 'Keyboard first, checked with axe',
          text: "Every drag has a keyboard path, the places a drag reaches are a list to choose from, and axe runs over each scenario in the editor's three languages.",
          evidence: EVIDENCE.keyboard,
        },
        {
          title: 'Mounted, unmounted, shown twice',
          text: 'The builder works over a session it does not own: mounted, unmounted, mounted again, given another editor and shown twice at once, without losing an edit or leaving a subscription behind.',
          evidence: EVIDENCE.lifecycle,
        },
        {
          title: 'Your page inside the editor',
          text: "Your own view is drawn in the design view's place while the editor shows it.",
          evidence: EVIDENCE.hostView,
        },
        {
          title: 'Problems before printing',
          text: 'Each read of a field the data does not declare is named where it is, and the builder lists the problems, each linked to its component.',
          evidence: EVIDENCE.problems,
        },
        {
          title: 'A PDF in the browser, too',
          text: 'The renderer has a browser entry. In the Studio, the preview is the PDF it printed in the page, and Download PDF gives that very file.',
          evidence: EVIDENCE.browser,
        },
      ],
    },
    pictures: {
      heading: 'In the Studio',
      intro:
        'A script took each picture of the built Studio, never by hand: the XRechnung and the quotation, each in the React builder, and beside it the PDF the session prints.',
    },
    tryIt: {
      heading: 'Try it',
      text: (version) =>
        `In the Studio, choose React under Builder, and every starter opens in the React builder. The getting-started guide installs ${version}, the newest release, and embeds the editor in a React page.`,
      links: [
        { to: TO.guide, words: 'Embed the editor in React (getting-started guide)' },
        { to: TO.tests, words: "What the React builder's tests show (README)" },
        { to: TO.angular, words: 'The Angular report designer' },
        { to: TO.invoices, words: 'Invoices, with a QR-bill or as an e-invoice' },
      ],
    },
    limits: {
      heading: 'What it does not do',
      items: [
        'React 19 only: its peer range is ^19.0.0.',
        "No published PDF viewer: the Studio's is in no package, so your application shows the PDF in a viewer of its own.",
        "No chart in the builder's palette yet, and the editor's own words are in English, German (Switzerland) and French (Switzerland) only, not yet Italian.",
        'The report format is still a draft (version 0).',
      ],
    },
    status: {
      heading: 'Status',
      text: (version, date) => `In ${version}, the newest release, in the source on GitHub and online in the Studio (as of ${date}).`,
    },
  },
}
