/**
 * The Angular report designer's page's words, in each language (0081).
 * Every card is a claim 0012's builders make and their tests hold, and the
 * install gate's (0015), and says no more than they do: that the builder
 * renders under zoneless change detection is what its tests mount it with;
 * that it is written with standalone components and signals is its README's
 * and its manifest's, and no card says it. The React page says the same of
 * its own builder, each in its own words over its own tests. A Studio word
 * the page names, "Builder" and its "Angular", is the Studio's, held to its
 * recorded pictures by checks/studio-words.ts (0056). No translation is
 * reviewed by a native speaker; the German is Switzerland's spelling.
 * Reviewed by a person, not a test, for meaning; the suite holds what can
 * be measured (checks/).
 */
import type { Language } from '../languages.js'
import { FORMANCY_ANGULAR } from '../links.js'
import type { Evidence } from '../pages.js'
import type { Target, TopicCopy } from './topic.js'

/**
 * The tests each card rests on, one list a card, which the card shares in
 * every language (checks/evidence.ts).
 */
const EVIDENCE = {
  // Every scenario mounted with zoneless change detection, the host's view
  // stamped on Angular's schedule, and the editor's state read as signals.
  native: [
    'packages/report-builder-angular/src/scenarios.test.ts',
    'packages/report-builder-angular/src/host-view.test.ts',
    'packages/report-builder-angular/src/editor-state.test.ts',
  ],
  // No React in the manifest, the installed tree or the built code, and
  // the dist the package is published from.
  noReact: ['packages/report-builder-angular/src/dependencies.test.ts', 'scripts/finalize-angular-dist.test.mjs'],
  // A host project per kind, each builder at both ends of its peer range,
  // and the guide's code compiled and run.
  installs: ['scripts/install-hosts.test.mjs', 'scripts/install-test.mjs', 'scripts/getting-started.test.mjs'],
  // One list of scenarios over one editor model, and the switch between
  // the builders in Chromium keeping the report and its history.
  sameEditor: [
    'packages/report-builder-core/src/scenarios.test.ts',
    'packages/report-builder-angular/src/scenarios.test.ts',
    'apps/studio/scripts/gate-switch.mjs',
  ],
  // The keys, a name on every control, and axe over every scenario.
  keyboard: [
    'packages/report-builder-angular/src/keyboard.test.ts',
    'packages/report-builder-angular/src/accessibility.test.ts',
    'packages/report-builder-core/src/keys.test.ts',
  ],
  // The host's template stamped in the design view's place.
  hostView: ['packages/report-builder-angular/src/host-view.test.ts'],
  // Destroyed and made again, or given another editor, with nothing left
  // listening.
  lifecycle: ['packages/report-builder-angular/src/builder.test.ts'],
  // The payment part and the e-invoice edited field by field, and an image
  // added from a file and handed to the host by its digest.
  parts: [
    'packages/report-builder-core/src/payment-part.test.ts',
    'packages/report-builder-core/src/e-invoice.test.ts',
    'packages/report-builder-angular/src/image-chooser.test.ts',
    'apps/studio/scripts/gate-images.mjs',
  ],
} satisfies Record<string, Evidence>

/** Where the page's links lead. */
const TO = {
  use: { github: 'packages/report-builder-angular/README.md#use' },
  guide: { github: 'docs/getting-started.md#5-embed-the-editor-in-angular' },
  notYet: { github: 'packages/report-builder-angular/README.md#what-it-does-not-do' },
  react: { page: 'react' },
  forms: { away: FORMANCY_ANGULAR },
} satisfies Record<string, Target>

export const ANGULAR_COPY: Readonly<Record<Language, TopicCopy>> = {
  de: {
    meta: {
      title: 'Reportdesigner für Angular, PDF und Word – Formancy Report',
      description:
        'Ein nativer Reportdesigner für Angular 22: Standalone-Komponenten und Signals, zoneless getestet, ohne React. Berichte als PDF und Word in Ihrer Anwendung.',
      name: 'Angular',
    },
    teaser: {
      heading: 'Für Angular',
      text: 'Der Reportdesigner als Komponente für Angular 22, mit zoneless Change Detection getestet, ohne React in dem, was er installiert.',
      action: 'Der Reportdesigner für Angular',
    },
    eyebrow: 'Formancy Report für Angular',
    h1: 'Ein Reportdesigner, nativ für Angular gebaut',
    lead: 'Ihre Angular-Anwendung bekommt einen eigenen visuellen Reportdesigner, für Angular 22 geschrieben, ohne React darin. Wer einen Bericht gestaltet, legt eine Rechnung, eine Offerte oder einen Verkaufsbericht in Ihrer Anwendung an; Ihre Anwendung übergibt die Daten, und der Renderer druckt das PDF oder schreibt eine Word-Datei.',
    standing: 'Der Angular-Builder ist im neuesten Release enthalten; im Studio wählen Sie dafür Builder: Angular.',
    actions: { studio: 'Im Studio ausprobieren (Builder: Angular)', more: { to: TO.use, words: 'In Ihrer Angular-Anwendung verwenden (README, Englisch)' } },
    does: {
      heading: 'Was es kann',
      cards: [
        {
          title: 'Nativ für Angular 22, zoneless getestet',
          text: 'Jedes Szenario bindet den Builder mit der zoneless Change Detection von Angular ein, und die eigene Ansicht Ihrer Anwendung darin rendert im Takt von Angular.',
          evidence: EVIDENCE.native,
        },
        {
          title: 'Kein React darin',
          text: 'Was das Bearbeiten eines Berichts in Angular in Ihre Anwendung bringt, gelesen aus dem Manifest, dem installierten Baum und dem gebauten Code, enthält nichts von React.',
          evidence: EVIDENCE.noReact,
        },
        {
          title: 'Installiert in ein schlichtes Angular-Projekt',
          text: 'Das gepackte Paket wird in ein Projekt installiert, das nichts von diesem Repository weiss, an beiden Enden seines Angular-Peer-Bereichs, dann typgeprüft und gebaut. Der Angular-Code der Einführung wird genauso kompiliert und ausgeführt.',
          evidence: EVIDENCE.installs,
        },
        {
          title: 'Derselbe Editor wie der React-Builder',
          text: 'Beide Builder stellen ein Editormodell dar und bestehen eine Liste von Szenarien. Wechseln Sie zwischen ihnen, und Bericht und Rückgängig-Verlauf bleiben.',
          evidence: EVIDENCE.sameEditor,
        },
        {
          title: 'Tastatur zuerst, mit axe geprüft',
          text: 'Was sich ziehen lässt, geht auch mit der Tastatur, jedes Bedienelement hat einen Namen, und axe läuft über jedes Szenario in den drei Sprachen des Editors: Englisch, Deutsch (Schweiz) und Französisch (Schweiz).',
          evidence: EVIDENCE.keyboard,
        },
        {
          title: 'Ihre Seite im Editor',
          text: 'Ihre eigene Vorlage, als <ng-template reportHostView> übergeben, steht an der Stelle der Entwurfsansicht, solange der Editor sie zeigt.',
          evidence: EVIDENCE.hostView,
        },
        {
          title: 'Kommt und geht, ohne eine Änderung zu verlieren',
          text: 'Zerstört und neu erstellt oder mit einem anderen Editor versehen: Dokument und Verlauf bleiben in der Sitzung, und ein Builder, der geht, lässt nichts zurück, das noch zuhört.',
          evidence: EVIDENCE.lifecycle,
        },
        {
          title: 'Rechnungen und Bilder, direkt bearbeitet',
          text: 'QR-Rechnung, EPC-QR-Code und E-Rechnung werden Feld für Feld bearbeitet. Ein Bild wird aus einer Datei hinzugefügt und Ihrer Anwendung übergeben, die es unter seinem Hashwert aufbewahrt, bevor der Bericht es deklariert.',
          evidence: EVIDENCE.parts,
        },
      ],
    },
    pictures: {
      heading: 'Im Studio',
      intro:
        'Ein Skript hat das Bild vom gebauten Studio aufgenommen, nicht von Hand. Der Schalter Builder bewegt dieselbe Sitzung zwischen React und Angular.',
    },
    tryIt: {
      heading: 'Ausprobieren',
      text: (version) =>
        `Wählen Sie im Studio unter Builder Angular, und jede Startvorlage öffnet sich im Angular-Builder. Die Einführung installiert ${version}, das neueste Release, und bettet den Editor in eine Angular-Seite ein (Englisch).`,
      links: [
        { to: TO.guide, words: 'Den Editor in Angular einbetten (Einführung, Englisch)' },
        { to: TO.notYet, words: 'Was der Angular-Builder noch nicht tut (README, Englisch)' },
        { to: TO.react, words: 'Der Reportdesigner für React' },
        { to: TO.forms, words: 'Der Formular-Builder von formancy für Angular, unter Apache-2.0' },
      ],
    },
    limits: {
      heading: 'Was es nicht tut',
      items: [
        'Nur Angular 22: Sein Peer-Bereich ist ^22.0.0.',
        'Kein veröffentlichter PDF-Viewer: Ihre Anwendung zeigt das PDF in einem eigenen Viewer.',
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
      title: 'Concepteur de rapports pour Angular – Formancy Report',
      description:
        'Concepteur de rapports natif pour Angular 22 : composants standalone, signals, testé zoneless, sans React. Rapports PDF et Word dans votre application.',
      name: 'Angular',
    },
    teaser: {
      heading: 'Pour Angular',
      text: "Le concepteur de rapports en composant Angular 22, testé avec la détection de changements zoneless, sans React dans ce qu'il installe.",
      action: 'Le concepteur de rapports pour Angular',
    },
    eyebrow: 'Formancy Report pour Angular',
    h1: 'Un concepteur de rapports conçu nativement pour Angular',
    lead: "Votre application Angular reçoit son propre concepteur visuel de rapports, écrit pour Angular 22, sans React à l'intérieur. La personne qui conçoit un rapport met en page une facture, une offre ou un rapport de ventes dans votre application ; votre application fournit les données, et le moteur de rendu imprime le PDF ou écrit un fichier Word.",
    standing: 'Le builder Angular figure dans la version la plus récente ; dans le Studio en ligne, choisissez Builder : Angular.',
    actions: {
      studio: "L'essayer dans le Studio (Builder : Angular)",
      more: { to: TO.use, words: "L'utiliser dans votre application Angular (README, en anglais)" },
    },
    does: {
      heading: "Ce qu'il fait",
      cards: [
        {
          title: 'Natif pour Angular 22, testé zoneless',
          text: "Chaque scénario monte le builder avec la détection de changements zoneless d'Angular, et la vue propre à votre application, à l'intérieur, se rend au rythme d'Angular.",
          evidence: EVIDENCE.native,
        },
        {
          title: "Pas de React à l'intérieur",
          text: "Ce que la modification d'un rapport dans Angular apporte à votre application, lu dans le manifeste, l'arbre installé et le code construit, ne contient rien de React.",
          evidence: EVIDENCE.noReact,
        },
        {
          title: "S'installe dans un projet Angular ordinaire",
          text: "Le paquet empaqueté est installé dans un projet qui ne sait rien de ce dépôt, aux deux bouts de sa plage de versions d'Angular, puis vérifié par le compilateur et construit. Le code Angular du guide de démarrage est compilé et exécuté de la même façon.",
          evidence: EVIDENCE.installs,
        },
        {
          title: 'Le même éditeur que le builder React',
          text: "Les deux builders reposent sur un même modèle d'éditeur et passent une même liste de scénarios. Passez de l'un à l'autre : le rapport et son historique d'annulation sont conservés.",
          evidence: EVIDENCE.sameEditor,
        },
        {
          title: "Le clavier d'abord, vérifié avec axe",
          text: "Chaque glisser-déposer a son équivalent au clavier, chaque contrôle a un nom, et axe passe sur chaque scénario dans les trois langues de l'éditeur : l'anglais, l'allemand (Suisse) et le français (Suisse).",
          evidence: EVIDENCE.keyboard,
        },
        {
          title: "Votre page dans l'éditeur",
          text: "Votre propre modèle, donné comme <ng-template reportHostView>, prend la place de la vue de conception tant que l'éditeur l'affiche.",
          evidence: EVIDENCE.hostView,
        },
        {
          title: 'Il va et vient sans perdre une modification',
          text: "Détruit puis recréé, ou confié à un autre éditeur : le document et son historique restent dans la session, et un builder qui s'en va ne laisse rien à l'écoute.",
          evidence: EVIDENCE.lifecycle,
        },
        {
          title: 'Factures et images, modifiées sur place',
          text: "La facture QR, le QR code SEPA et la facture Factur-X ou XRechnung se modifient champ par champ. Une image s'ajoute depuis un fichier et est confiée à votre application, qui la garde sous son empreinte, avant que le rapport la déclare.",
          evidence: EVIDENCE.parts,
        },
      ],
    },
    pictures: {
      heading: 'Dans le Studio',
      intro:
        "Un script a pris l'image dans le Studio construit, jamais à la main. Le sélecteur Builder fait passer la même session de React à Angular et inversement.",
    },
    tryIt: {
      heading: "L'essayer",
      text: (version) =>
        `Dans le Studio, choisissez Angular sous Builder, et chaque modèle de départ s'ouvre dans le builder Angular. Le guide de démarrage installe ${version}, la version la plus récente, et intègre l'éditeur dans une page Angular (en anglais).`,
      links: [
        { to: TO.guide, words: "Intégrer l'éditeur dans Angular (guide de démarrage, en anglais)" },
        { to: TO.notYet, words: 'Ce que le builder Angular ne fait pas encore (README, en anglais)' },
        { to: TO.react, words: 'Le concepteur de rapports pour React' },
        { to: TO.forms, words: 'Le builder de formulaires de formancy pour Angular, sous Apache-2.0' },
      ],
    },
    limits: {
      heading: "Ce qu'il ne fait pas",
      items: [
        "Angular 22 seulement : sa plage de versions d'Angular est ^22.0.0.",
        'Pas de visionneuse PDF publiée : votre application affiche le PDF dans sa propre visionneuse.',
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
      title: 'Report designer per Angular, PDF e Word – Formancy Report',
      description:
        'Un report designer nativo per Angular 22: componenti standalone e signals, testato zoneless, senza React. Report PDF e Word nella vostra applicazione.',
      name: 'Angular',
    },
    teaser: {
      heading: 'Per Angular',
      text: 'Il report designer come componente Angular 22, testato con il rilevamento delle modifiche zoneless, senza React in ciò che installa.',
      action: 'Il report designer per Angular',
    },
    eyebrow: 'Formancy Report per Angular',
    h1: 'Un report designer nativo per Angular',
    lead: "La vostra applicazione Angular riceve un proprio report designer visuale, scritto per Angular 22, senza React all'interno. Chi progetta un report impagina una fattura, un'offerta o un report di vendita nella vostra applicazione; la vostra applicazione fornisce i dati, e il renderer stampa il PDF o scrive un file Word.",
    standing: 'Il builder Angular fa parte della versione più recente; nello Studio online, scegliete Builder: Angular.',
    actions: {
      studio: 'Provarlo nello Studio (Builder: Angular)',
      more: { to: TO.use, words: 'Usarlo nella vostra applicazione Angular (README, in inglese)' },
    },
    does: {
      heading: 'Che cosa fa',
      cards: [
        {
          title: 'Nativo per Angular 22, testato zoneless',
          text: 'Ogni scenario monta il builder con il rilevamento delle modifiche zoneless di Angular, e la vista propria della vostra applicazione, al suo interno, si rende al ritmo di Angular.',
          evidence: EVIDENCE.native,
        },
        {
          title: "Nessun React all'interno",
          text: "Ciò che la modifica di un report in Angular porta nella vostra applicazione, letto dal manifest, dall'albero installato e dal codice compilato, non contiene nulla di React.",
          evidence: EVIDENCE.noReact,
        },
        {
          title: 'Si installa in un normale progetto Angular',
          text: 'Il pacchetto impacchettato viene installato in un progetto che non sa nulla di questo repository, ai due estremi del suo intervallo di versioni di Angular, poi verificato dal compilatore e compilato. Il codice Angular della guida introduttiva viene compilato ed eseguito allo stesso modo.',
          evidence: EVIDENCE.installs,
        },
        {
          title: 'Lo stesso editor del builder React',
          text: "I due builder si basano su un unico modello di editor e superano un'unica lista di scenari. Passando dall'uno all'altro, il report e la cronologia degli annullamenti restano.",
          evidence: EVIDENCE.sameEditor,
        },
        {
          title: 'Prima la tastiera, verificato con axe',
          text: "Ogni trascinamento ha un equivalente da tastiera, ogni controllo ha un nome, e axe passa su ogni scenario nelle tre lingue dell'editor: inglese, tedesco (Svizzera) e francese (Svizzera).",
          evidence: EVIDENCE.keyboard,
        },
        {
          title: "La vostra pagina nell'editor",
          text: "Il vostro modello, dato come <ng-template reportHostView>, prende il posto della vista di progettazione finché l'editor la mostra.",
          evidence: EVIDENCE.hostView,
        },
        {
          title: 'Va e viene senza perdere una modifica',
          text: 'Distrutto e ricreato, o affidato a un altro editor: il documento e la sua cronologia restano nella sessione, e un builder che se ne va non lascia nulla in ascolto.',
          evidence: EVIDENCE.lifecycle,
        },
        {
          title: 'Fatture e immagini, modificate sul posto',
          text: "La fattura QR, il QR code SEPA e la fattura Factur-X o XRechnung si modificano campo per campo. Un'immagine si aggiunge da un file ed è affidata alla vostra applicazione, che la conserva con il suo hash, prima che il report la dichiari.",
          evidence: EVIDENCE.parts,
        },
      ],
    },
    pictures: {
      heading: 'Nello Studio',
      intro: "Uno script ha preso l'immagine dallo Studio compilato, mai a mano. Il selettore Builder sposta la stessa sessione tra React e Angular.",
    },
    tryIt: {
      heading: 'Provarlo',
      text: (version) =>
        `Nello Studio, scegliete Angular sotto Builder, e ogni modello iniziale si apre nel builder Angular. La guida introduttiva installa ${version}, la versione più recente, e integra l'editor in una pagina Angular (in inglese).`,
      links: [
        { to: TO.guide, words: "Integrare l'editor in Angular (guida introduttiva, in inglese)" },
        { to: TO.notYet, words: 'Che cosa il builder Angular non fa ancora (README, in inglese)' },
        { to: TO.react, words: 'Il report designer per React' },
        { to: TO.forms, words: 'Il builder di moduli di formancy per Angular, sotto Apache-2.0' },
      ],
    },
    limits: {
      heading: 'Che cosa non fa',
      items: [
        'Solo Angular 22: il suo intervallo di versioni di Angular è ^22.0.0.',
        'Nessun visualizzatore PDF pubblicato: la vostra applicazione mostra il PDF in un visualizzatore proprio.',
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
      title: 'Angular report designer for PDF and Word – Formancy Report',
      description:
        'A report designer native to Angular 22: standalone components and signals, tested zoneless, no React inside. Design PDF and Word reports in your app.',
      name: 'Angular',
    },
    teaser: {
      heading: 'For Angular',
      text: 'The report designer as an Angular 22 component, tested under zoneless change detection, with no React in what it installs.',
      action: 'The Angular report designer',
    },
    eyebrow: 'Formancy Report for Angular',
    h1: 'A report designer built natively for Angular',
    lead: 'Your Angular application gets a visual report designer of its own, written for Angular 22, with no React inside. A person lays out an invoice, a quotation or a sales report inside your application; your application hands over the data, and the renderer prints the PDF or writes a Word file.',
    standing: 'The Angular builder is in the newest release; in the online Studio, choose Builder: Angular.',
    actions: { studio: 'Try it in the Studio (Builder: Angular)', more: { to: TO.use, words: 'Use it in your Angular application (README)' } },
    does: {
      heading: 'What it does',
      cards: [
        {
          title: 'Native to Angular 22, tested zoneless',
          text: "Every scenario mounts the builder with Angular's zoneless change detection, and your application's own view inside it renders on Angular's schedule.",
          evidence: EVIDENCE.native,
        },
        {
          title: 'No React inside',
          text: 'What editing a report in Angular brings into your application, read from the manifest, the installed tree and the built code, holds nothing of React.',
          evidence: EVIDENCE.noReact,
        },
        {
          title: 'Installs into a plain Angular project',
          text: "The packed package is installed into a project that knows nothing of this repository, at both ends of its Angular peer range, then type-checked and built. The getting-started guide's Angular code is compiled and run the same way.",
          evidence: EVIDENCE.installs,
        },
        {
          title: 'The same editor as the React builder',
          text: 'Both builders render one editor model and pass one list of scenarios. Switch between them and the report and its undo history stay.',
          evidence: EVIDENCE.sameEditor,
        },
        {
          title: 'Keyboard first, checked with axe',
          text: "Every drag has a keyboard path, every control has a name, and axe runs over each scenario in the editor's three languages: English, German (Switzerland) and French (Switzerland).",
          evidence: EVIDENCE.keyboard,
        },
        {
          title: 'Your page inside the editor',
          text: "Your own template, given as <ng-template reportHostView>, is stamped in the design view's place while the editor shows it.",
          evidence: EVIDENCE.hostView,
        },
        {
          title: 'Comes and goes without losing an edit',
          text: 'Destroyed and made again, or given another editor: the document and its history stay in the session, and a builder that goes leaves nothing listening.',
          evidence: EVIDENCE.lifecycle,
        },
        {
          title: 'Invoices and images, edited in place',
          text: 'The QR-bill, the EPC QR code and the e-invoice are edited field by field. An image is added from a file and handed to your application to keep, by its digest, before the report declares it.',
          evidence: EVIDENCE.parts,
        },
      ],
    },
    pictures: {
      heading: 'In the Studio',
      intro: "A script took the picture of the built Studio, never by hand. The Studio's Builder switch moves the same session between React and Angular.",
    },
    tryIt: {
      heading: 'Try it',
      text: (version) =>
        `In the Studio, choose Angular under Builder, and every starter opens in the Angular builder. The getting-started guide installs ${version}, the newest release, and embeds the editor in an Angular page.`,
      links: [
        { to: TO.guide, words: 'Embed the editor in Angular (getting-started guide)' },
        { to: TO.notYet, words: 'What the Angular builder does not do yet (README)' },
        { to: TO.react, words: 'The React report designer' },
        { to: TO.forms, words: "formancy's Angular form builder, under Apache-2.0" },
      ],
    },
    limits: {
      heading: 'What it does not do',
      items: [
        'Angular 22 only: its peer range is ^22.0.0.',
        'No published PDF viewer: your application shows the PDF in a viewer of its own.',
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
