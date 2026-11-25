/**
 * The Word files page's words, in each language (0081). Every card is a
 * claim the Word writer's decisions make and their tests hold -- 0068's
 * file, 0074's codes, 0075's slip, 0076's charts and 0077's copy -- and says
 * no more than they do: what the file states, never what Word does with
 * it, since lines, pages and whether a marked row repeats are Word's, and
 * no gate opens a file in Word. The limits are those records' costs. A
 * Studio word the page names, "Starter", "Download Word" and "Download PDF",
 * is the Studio's, held to its recorded pictures by checks/studio-words.ts
 * (0056). No translation is reviewed by a native speaker; the German is
 * Switzerland's spelling. Reviewed by a person, not a test, for meaning;
 * the suite holds what can be measured (checks/).
 */
import type { Language } from '../languages.js'
import type { Evidence } from '../pages.js'
import type { Target, TopicCopy } from './topic.js'

/**
 * The tests each card rests on, one list a card, which the card shares in
 * every language (checks/evidence.ts).
 */
const EVIDENCE = {
  // Every starter written, or refused as its record says, and the samples
  // committed held to what the current build writes.
  starters: ['packages/report-render-docx/src/starters.test.ts', 'scripts/samples.test.mjs'],
  // The corpus's reader, a zip walk and a closed vocabulary of its own, and
  // the file held to its document by it.
  proved: ['packages/report-render-docx/src/corpus.test.ts', 'packages/report-corpus/src/check-docx.test.ts', 'packages/report-corpus/src/docx/read.test.ts'],
  // The header row marked to repeat and no row to split, the regions as
  // Word's headers and footers, page 1's own among them, and page numbers
  // as Word's fields.
  layout: ['packages/report-render-docx/src/blocks.test.ts', 'packages/report-render-docx/src/corpus.test.ts'],
  // A picture's bytes, a code decoded from its picture, and a chart as
  // Word's own with no workbook.
  pictures: [
    'packages/report-render-docx/src/pictures.test.ts',
    'packages/report-render-docx/src/codes.test.ts',
    'packages/report-render-docx/src/charts.test.ts',
  ],
  // The slip on its own page, each line where SIX puts it, and the widths
  // held to the renderer's font files.
  slip: ['packages/report-render-docx/src/slip.test.ts', 'packages/report-render-docx/src/slip-widths.test.ts'],
  // Every header the copy's label, in the render's language, the XML in no
  // part.
  copy: ['packages/report-render-docx/src/copy.test.ts', 'packages/report-runtime/src/e-invoice-copy.test.ts'],
  // The same bytes under any clock and time zone, and every string of the
  // data read back as its text.
  stable: ['packages/report-render-docx/src/stable.test.ts', 'packages/report-render-docx/src/text.test.ts'],
  // What the writer refuses, before a byte, and in Chromium the Studio's
  // Download Word, byte for byte the file written under Node.
  refused: ['packages/report-render-docx/src/refusals.test.ts', 'packages/report-render-docx/src/fonts.test.ts', 'apps/studio/scripts/gate-word.mjs'],
} satisfies Record<string, Evidence>

/** Where the page's links lead. */
const TO = {
  invoice: { github: 'samples/invoice.docx' },
  write: { github: 'packages/report-render-docx/README.md#write-a-report-as-a-word-file' },
  refuses: { github: 'packages/report-render-docx/README.md#what-it-refuses' },
  decision: { github: 'docs/decisions/0068-a-report-is-written-as-a-word-file-by-a-writer-of-its-own-and-what-belongs-to-its-pdf-is-refused.md' },
  invoices: { page: 'invoices' },
} satisfies Record<string, Target>

export const WORD_COPY: Readonly<Record<Language, TopicCopy>> = {
  de: {
    meta: {
      title: 'Berichte als Word-Datei (.docx) – Formancy Report',
      description:
        'Denselben Bericht als PDF und als Word-Datei, die man weiter bearbeiten kann: Tabellen, Kopf- und Fusszeilen, Seitenzahlen, Bilder, QR-Codes, Diagramme.',
      name: 'Word-Dateien',
    },
    teaser: {
      heading: 'Word-Dateien',
      text: 'Derselbe Bericht, aus dem das PDF gedruckt wird, als Word-Datei, die man weiter bearbeiten kann: Tabellen, Kopf- und Fusszeilen, Seitenzahlen, Bilder, QR-Codes, Diagramme und der Zahlteil der QR-Rechnung.',
      action: 'Word-Dateien mit Formancy Report',
    },
    eyebrow: 'Formancy Report für Word-Dateien',
    h1: 'Derselbe Bericht als Word-Datei, bereit zum Bearbeiten',
    lead: 'Manche Dokumente verlassen Ihre Anwendung, um von Hand fertig geschrieben zu werden. Formancy Report schreibt den Bericht, den es als PDF druckt, auch als Word-Datei (.docx): Tabellen, Kopf- und Fusszeilen, Seitenzahlen, Bilder, QR-Codes, Diagramme und den Zahlteil der QR-Rechnung. Was es nicht so schreiben kann, wie das PDF es druckt, lehnt es ab, statt es wegzulassen, und die Word-Datei einer E-Rechnung ist eine Kopie, die das sagt. Zeilen und Seiten setzt Word.',
    standing: 'Die Ausgabe als Word-Datei ist im neuesten Release enthalten; im Studio gibt Download Word die Datei.',
    actions: { studio: 'Im Studio ausprobieren (Download Word)', more: { to: TO.invoice, words: 'Die Rechnung als Word-Datei (GitHub)' } },
    does: {
      heading: 'Was es kann',
      cards: [
        {
          title: 'Jede Startvorlage, auch als Word-Datei',
          text: 'Jede Startvorlage wird aus demselben aufgelösten Dokument als Word-Datei geschrieben, aus dem ihr PDF gedruckt wird, oder abgelehnt, wie es ihr Entscheid festhält. Die Beispieldateien im Repository sind, was der aktuelle Build schreibt.',
          evidence: EVIDENCE.starters,
        },
        {
          title: 'An der geschriebenen Datei bewiesen',
          text: 'Jede Datei wird von einem Leser zurückgelesen, der nicht ihr Schreiber ist, und an dem gemessen, was das Dokument sagt: jedes Wort, jede Zelle und jedes Bild, die Seite und ihre Bereiche.',
          evidence: EVIDENCE.proved,
        },
        {
          title: 'Tabellen, Kopf- und Fusszeilen, Seitenzahlen',
          text: 'Die Kopfzeile einer Tabelle ist zum Wiederholen auf jeder Seite markiert, und keine ihrer Zeilen wird geteilt. Seitenkopf und Seitenfuss, auch die einer eigenen ersten Seite, werden zu Kopf- und Fusszeilen von Word, und Seitenzahlen sind Felder von Word.',
          evidence: EVIDENCE.layout,
        },
        {
          title: 'Bilder, QR-Codes und Diagramme',
          text: 'Ein Bild wird mit den Bytes des Assets selbst eingebettet. Ein QR-Code oder ein EPC-QR-Code ist ein Bild, das sein Test aus der Datei decodiert. Ein Balken-, Linien- oder Kreisdiagramm ist ein Diagramm von Word selbst, ohne Arbeitsmappe darin.',
          evidence: EVIDENCE.pictures,
        },
        {
          title: 'Der Zahlteil der QR-Rechnung, auf eigener Seite',
          text: 'Empfangsschein und Zahlteil stehen auf einer eigenen Seite, jede Überschrift und jeder Wert dort, wo SIX sie hinsetzt. Von jeder Zeile ist gezeigt, dass sie passt, gemessen mit den Laufweiten der Schriften, die der PDF-Renderer mitbringt.',
          evidence: EVIDENCE.slip,
        },
        {
          title: 'Eine E-Rechnung, als Kopie, die das sagt',
          text: 'Ein Bericht mit E-Rechnung wird als die Kopie geschrieben, die die Laufzeit auf jeder Seite beschriftet. Die Rechnung selbst bleibt das PDF/A-3b oder das XML.',
          evidence: EVIDENCE.copy,
        },
        {
          title: 'Dieselben Bytes, und Text bleibt Text',
          text: 'Dasselbe Dokument gibt dieselbe Datei, unabhängig von Uhr und Zeitzone. Ein Text aus Ihren Daten wird als dieser Text zurückgelesen, nie als Markup, als Feld oder als Adresse, der Word folgen würde.',
          evidence: EVIDENCE.stable,
        },
        {
          title: 'Lieber ablehnen als weglassen',
          text: 'Was nur ins PDF gehört oder was noch niemand Word wie das PDF drucken sah, lehnt die ganze Datei ab, bevor ein Byte geschrieben ist, nie eine Datei, die sich öffnet und vollständig aussieht. Im Studio gibt Download Word Byte für Byte die Datei, die der Schreiber unter Node schreibt.',
          evidence: EVIDENCE.refused,
        },
      ],
    },
    pictures: {
      heading: 'Im Studio',
      intro:
        'Ein Skript hat das Bild vom gebauten Studio aufgenommen, nicht von Hand. Download Word schreibt die Datei im Browser, mit demselben Paket, das Ihre Anwendung installiert.',
    },
    tryIt: {
      heading: 'Ausprobieren',
      text: (version) =>
        `Wählen Sie im Studio unter Starter eine Startvorlage, und die Vorschau bietet Download Word neben Download PDF an. ${version}, das neueste Release, veröffentlicht den Schreiber als @formancy/report-render-docx; sein README zeigt, wie Ihre Anwendung einen Bericht als Word-Datei schreibt (Englisch).`,
      links: [
        { to: TO.write, words: 'Einen Bericht als Word-Datei schreiben (report-render-docx, Englisch)' },
        { to: TO.refuses, words: 'Was der Schreiber ablehnt (Englisch)' },
        { to: TO.decision, words: 'Entscheid 0068: warum der Schreiber ablehnt, was ins PDF gehört (Englisch)' },
        { to: TO.invoices, words: 'Rechnungen mit QR-Rechnung oder E-Rechnung' },
      ],
    },
    limits: {
      heading: 'Was es nicht tut',
      items: [
        'Kein automatischer Test öffnet eine Datei in Word: Die Datei der Rechnung wurde von Hand in Word geöffnet, und nichts wiederholt das.',
        'Zeilen und Seiten setzt Word, darum kann eine Seite anders umbrechen als im PDF.',
        'Die Schriften des Berichts werden nicht in die Datei eingebettet, und noch prüft kein automatischer Test eine Datei gegen die Schemas von ECMA-376.',
        'Die Daten eines Diagramms sind keine bearbeitbare Arbeitsmappe, und die Trennlinie der QR-Rechnung trägt in Word keine Schere.',
        'Es schreibt Word-Dateien und liest keine: Eine Word-Vorlage lässt sich nicht importieren. Kein Excel, kein CSV, kein HTML.',
      ],
    },
    status: {
      heading: 'Stand',
      text: (version, date) => `In ${version}, dem neuesten Release, im Quellcode auf GitHub und online im Studio (Stand ${date}).`,
    },
  },
  fr: {
    meta: {
      title: 'Rapports en fichier Word (.docx) – Formancy Report',
      description:
        "Le même rapport en PDF et en fichier Word que l'on peut continuer à modifier : tableaux, en-têtes, numéros de page, images, QR codes, graphiques.",
      name: 'Fichiers Word',
    },
    teaser: {
      heading: 'Fichiers Word',
      text: "Le rapport dont le PDF est imprimé, écrit aussi en fichier Word que l'on peut continuer à modifier : tableaux, en-têtes et pieds de page, numéros de page, images, QR codes, graphiques et la section paiement de la facture QR.",
      action: 'Les fichiers Word avec Formancy Report',
    },
    eyebrow: 'Formancy Report pour les fichiers Word',
    h1: 'Le même rapport en fichier Word, prêt à modifier',
    lead: "Certains documents quittent votre application pour être terminés à la main. Formancy Report écrit le rapport qu'il imprime en PDF aussi en fichier Word (.docx) : tableaux, en-têtes et pieds de page, numéros de page, images, QR codes, graphiques et la section paiement de la facture QR. Ce qu'il ne peut pas écrire comme le PDF l'imprime, il le refuse plutôt que de l'omettre, et le fichier Word d'une facture Factur-X ou XRechnung est une copie qui le dit. Les lignes et les pages, c'est Word qui les compose.",
    standing: "L'export en fichier Word figure dans la version la plus récente ; dans le Studio en ligne, Download Word donne le fichier.",
    actions: { studio: "L'essayer dans le Studio (Download Word)", more: { to: TO.invoice, words: 'La facture en fichier Word (GitHub)' } },
    does: {
      heading: "Ce qu'il fait",
      cards: [
        {
          title: 'Chaque modèle de départ, aussi en fichier Word',
          text: "Chaque modèle de départ s'écrit en fichier Word à partir du même document résolu que celui dont son PDF est imprimé, ou il est refusé, comme le dit sa décision. Les fichiers d'exemple du dépôt sont ce qu'écrit le build actuel.",
          evidence: EVIDENCE.starters,
        },
        {
          title: 'Prouvé sur le fichier écrit',
          text: "Chaque fichier est relu par un lecteur qui n'est pas celui qui l'a écrit, et confronté à ce que dit le document : chaque mot, chaque cellule et chaque image, la page et ses zones.",
          evidence: EVIDENCE.proved,
        },
        {
          title: 'Tableaux, en-têtes, pieds de page, numéros de page',
          text: "La ligne d'en-tête d'un tableau est marquée pour se répéter sur chaque page, et aucune de ses lignes ne se coupe. L'en-tête et le pied de page, et ceux d'une première page à part, deviennent ceux de Word, et les numéros de page sont des champs de Word.",
          evidence: EVIDENCE.layout,
        },
        {
          title: 'Images, QR codes et graphiques',
          text: "Une image est incorporée avec les octets mêmes de la ressource. Un QR code ou un QR code SEPA est une image que son test décode dans le fichier. Un graphique en barres, en lignes ou en secteurs est un graphique de Word lui-même, sans classeur à l'intérieur.",
          evidence: EVIDENCE.pictures,
        },
        {
          title: 'La section paiement de la facture QR, sur sa propre page',
          text: "Le récépissé et la section paiement s'écrivent sur une page à part, chaque titre et chaque valeur là où SIX les place. Chaque ligne est montrée tenir, mesurée avec les chasses des polices que fournit le moteur de rendu PDF.",
          evidence: EVIDENCE.slip,
        },
        {
          title: 'Une facture Factur-X ou XRechnung, en copie qui le dit',
          text: "Un rapport qui porte une facture Factur-X ou XRechnung s'écrit comme la copie que le runtime signale sur chaque page. La facture elle-même reste le PDF/A-3b ou le XML.",
          evidence: EVIDENCE.copy,
        },
        {
          title: 'Les mêmes octets, et du texte qui reste du texte',
          text: "Le même document donne le même fichier, quels que soient l'horloge et le fuseau horaire. Une chaîne issue de vos données se relit comme ce texte, jamais comme du balisage, un champ ou une adresse que Word suivrait.",
          evidence: EVIDENCE.stable,
        },
        {
          title: "Refusé plutôt qu'omis",
          text: "Ce qui n'appartient qu'au PDF, ou ce que personne n'a vu Word imprimer comme le PDF, fait refuser tout le fichier avant qu'un octet soit écrit, jamais un fichier qui s'ouvre et semble complet. Dans le Studio, Download Word donne, octet pour octet, le fichier que le moteur écrit sous Node.",
          evidence: EVIDENCE.refused,
        },
      ],
    },
    pictures: {
      heading: 'Dans le Studio',
      intro:
        "Un script a pris l'image dans le Studio construit, jamais à la main. Download Word écrit le fichier dans le navigateur, avec le même paquet que celui que votre application installe.",
    },
    tryIt: {
      heading: "L'essayer",
      text: (version) =>
        `Dans le Studio, choisissez un modèle de départ sous Starter, et l'aperçu propose Download Word à côté de Download PDF. La version ${version}, la plus récente, publie le moteur sous le nom @formancy/report-render-docx ; son README montre comment votre application écrit un rapport en fichier Word (en anglais).`,
      links: [
        { to: TO.write, words: 'Écrire un rapport en fichier Word (report-render-docx, en anglais)' },
        { to: TO.refuses, words: 'Ce que le moteur refuse (en anglais)' },
        { to: TO.decision, words: 'Décision 0068 : pourquoi le moteur refuse ce qui appartient au PDF (en anglais)' },
        { to: TO.invoices, words: 'Les factures, avec facture QR, Factur-X ou XRechnung' },
      ],
    },
    limits: {
      heading: "Ce qu'il ne fait pas",
      items: [
        "Aucun test automatique n'ouvre un fichier dans Word : le fichier de la facture a été ouvert dans Word à la main, et rien ne le refait.",
        'Les lignes et les pages sont celles de Word : une page peut donc se couper ailleurs que dans le PDF.',
        "Les polices du rapport ne sont pas embarquées dans le fichier, et aucun contrôle ne valide encore un fichier selon les schémas d'ECMA-376.",
        "Les données d'un graphique ne sont pas un classeur modifiable, et la ligne de découpe de la facture QR ne porte pas de ciseaux dans Word.",
        "Il écrit des fichiers Word et n'en lit aucun : un modèle Word ne peut pas être importé. Ni Excel, ni CSV, ni HTML.",
      ],
    },
    status: {
      heading: 'État',
      text: (version, date) => `Dans la version ${version}, la plus récente, dans le code source sur GitHub et en ligne dans le Studio (état au ${date}).`,
    },
  },
  it: {
    meta: {
      title: 'Report come file Word (.docx) – Formancy Report',
      description: 'Lo stesso report in PDF e come file Word da continuare a modificare: tabelle, intestazioni, numeri di pagina, immagini, QR code e grafici.',
      name: 'File Word',
    },
    teaser: {
      heading: 'File Word',
      text: 'Lo stesso report da cui si stampa il PDF, scritto come file Word da continuare a modificare: tabelle, intestazioni e piè di pagina, numeri di pagina, immagini, QR code, grafici e la sezione pagamento della fattura QR.',
      action: 'I file Word con Formancy Report',
    },
    eyebrow: 'Formancy Report per i file Word',
    h1: 'Lo stesso report come file Word, pronto da modificare',
    lead: 'Alcuni documenti lasciano la vostra applicazione per essere completati a mano. Formancy Report scrive il report che stampa in PDF anche come file Word (.docx): tabelle, intestazioni e piè di pagina, numeri di pagina, immagini, QR code, grafici e la sezione pagamento della fattura QR. Ciò che non può scrivere come il PDF lo stampa, lo rifiuta invece di ometterlo, e il file Word di una fattura Factur-X o XRechnung è una copia che lo dice. Righe e pagine le impagina Word.',
    standing: "L'esportazione in file Word fa parte della versione più recente; nello Studio online, Download Word dà il file.",
    actions: { studio: 'Provarlo nello Studio (Download Word)', more: { to: TO.invoice, words: 'La fattura come file Word (GitHub)' } },
    does: {
      heading: 'Che cosa fa',
      cards: [
        {
          title: 'Ogni modello iniziale, anche come file Word',
          text: 'Ogni modello iniziale si scrive come file Word dallo stesso documento risolto da cui si stampa il suo PDF, oppure viene rifiutato, come dice la sua decisione. I file di esempio del repository sono ciò che scrive la build attuale.',
          evidence: EVIDENCE.starters,
        },
        {
          title: 'Dimostrato sul file scritto',
          text: 'Ogni file viene riletto da un lettore che non è chi lo ha scritto, e confrontato con ciò che dice il documento: ogni parola, cella e immagine, la pagina e le sue aree.',
          evidence: EVIDENCE.proved,
        },
        {
          title: 'Tabelle, intestazioni, piè di pagina, numeri di pagina',
          text: "La riga d'intestazione di una tabella è marcata per ripetersi su ogni pagina, e nessuna sua riga si spezza. L'intestazione e il piè di pagina, e quelli di una prima pagina propria, diventano quelli di Word, e i numeri di pagina sono campi di Word.",
          evidence: EVIDENCE.layout,
        },
        {
          title: 'Immagini, QR code e grafici',
          text: "Un'immagine è incorporata con i byte stessi della risorsa. Un QR code o un QR code SEPA è un'immagine che il suo test decodifica dal file. Un grafico a barre, a linee o a torta è un grafico di Word stesso, senza cartella di lavoro all'interno.",
          evidence: EVIDENCE.pictures,
        },
        {
          title: 'La sezione pagamento della fattura QR, su una pagina propria',
          text: 'La ricevuta e la sezione pagamento si scrivono su una pagina propria, ogni titolo e ogni valore dove SIX li colloca. Ogni riga è mostrata entrare, misurata con le larghezze dei caratteri che il renderer PDF fornisce.',
          evidence: EVIDENCE.slip,
        },
        {
          title: 'Una fattura Factur-X o XRechnung, come copia che lo dice',
          text: "Un report che porta una fattura Factur-X o XRechnung si scrive come la copia che il runtime segnala su ogni pagina. La fattura stessa resta il PDF/A-3b o l'XML.",
          evidence: EVIDENCE.copy,
        },
        {
          title: 'Gli stessi byte, e testo che resta testo',
          text: "Lo stesso documento dà lo stesso file, qualunque siano l'orologio e il fuso orario. Una stringa dei vostri dati si rilegge come quel testo, mai come markup, un campo o un indirizzo che Word seguirebbe.",
          evidence: EVIDENCE.stable,
        },
        {
          title: 'Rifiutato invece di omesso',
          text: "Ciò che appartiene solo al PDF, o ciò che nessuno ha visto Word stampare come il PDF, fa rifiutare l'intero file prima che un byte sia scritto, mai un file che si apre e sembra completo. Nello Studio, Download Word dà byte per byte il file che il writer scrive sotto Node.",
          evidence: EVIDENCE.refused,
        },
      ],
    },
    pictures: {
      heading: 'Nello Studio',
      intro:
        "Uno script ha preso l'immagine dallo Studio compilato, mai a mano. Download Word scrive il file nel browser, con lo stesso pacchetto che la vostra applicazione installa.",
    },
    tryIt: {
      heading: 'Provarlo',
      text: (version) =>
        `Nello Studio, scegliete un modello iniziale sotto Starter, e l'anteprima offre Download Word accanto a Download PDF. La versione ${version}, la più recente, pubblica il writer come @formancy/report-render-docx; il suo README mostra come la vostra applicazione scrive un report come file Word (in inglese).`,
      links: [
        { to: TO.write, words: 'Scrivere un report come file Word (report-render-docx, in inglese)' },
        { to: TO.refuses, words: 'Che cosa rifiuta il writer (in inglese)' },
        { to: TO.decision, words: 'Decisione 0068: perché il writer rifiuta ciò che appartiene al PDF (in inglese)' },
        { to: TO.invoices, words: 'Le fatture, con fattura QR, Factur-X o XRechnung' },
      ],
    },
    limits: {
      heading: 'Che cosa non fa',
      items: [
        'Nessun test automatico apre un file in Word: il file della fattura è stato aperto in Word a mano, e nulla lo ripete.',
        'Righe e pagine sono quelle di Word: una pagina può quindi spezzarsi altrove che nel PDF.',
        'I caratteri del report non sono incorporati nel file, e nessun controllo valida ancora un file secondo gli schemi di ECMA-376.',
        'I dati di un grafico non sono una cartella di lavoro modificabile, e la linea da tagliare della fattura QR non porta forbici in Word.',
        'Scrive file Word e non ne legge nessuno: un modello Word non si può importare. Niente Excel, CSV o HTML.',
      ],
    },
    status: {
      heading: 'Stato',
      text: (version, date) => `Nella versione ${version}, la più recente, nel codice sorgente su GitHub e online nello Studio (stato al ${date}).`,
    },
  },
  en: {
    meta: {
      title: 'Reports as Word files (.docx) – Formancy Report',
      description:
        'Write the same report as a PDF and as a Word file a person can go on editing: tables, headers, page numbers, pictures, QR codes, charts and the QR-bill.',
      name: 'Word files',
    },
    teaser: {
      heading: 'Word files',
      text: "The same report a PDF is printed from, written as a Word file a person can go on editing: tables, headers, page numbers, pictures, QR codes, charts and the QR-bill's slip.",
      action: 'Word files with Formancy Report',
    },
    eyebrow: 'Formancy Report for Word files',
    h1: 'The same report as a Word file, ready to edit',
    lead: "Some documents leave your application to be finished by hand. Formancy Report writes the report it prints as a PDF as a Word file (.docx) too: tables, headers and footers, page numbers, pictures, QR codes, charts and the QR-bill's slip. What it cannot write as the PDF prints it, it refuses rather than leave out, and an e-invoice's Word file is a copy that says so. Word lays out the lines and pages.",
    standing: 'The Word writer is in the newest release; in the online Studio, Download Word gives the file.',
    actions: { studio: 'Try it in the Studio (Download Word)', more: { to: TO.invoice, words: 'The invoice as a Word file (GitHub)' } },
    does: {
      heading: 'What it does',
      cards: [
        {
          title: 'Every starter, as a Word file too',
          text: 'Each starter is written as a Word file from the same resolved document its PDF is printed from, or refused, as its record says. The sample files in the repository are what the current build writes.',
          evidence: EVIDENCE.starters,
        },
        {
          title: 'Proved on the file it wrote',
          text: 'Each file is read back by a reader that is not its writer, and held to what the document says: every word, cell and picture, the page and its regions.',
          evidence: EVIDENCE.proved,
        },
        {
          title: 'Tables, headers, footers, page numbers',
          text: "A table's header row is marked to repeat on every page, and no row of it to split. The page header and footer, and a first page's own, become Word's headers and footers, and page numbers are Word's own fields.",
          evidence: EVIDENCE.layout,
        },
        {
          title: 'Pictures, QR codes and charts',
          text: "A picture is embedded as the asset's very bytes. A QR code or an EPC QR code is a picture its test decodes from the file. A bar, line or pie chart is Word's own chart, with no workbook inside.",
          evidence: EVIDENCE.pictures,
        },
        {
          title: "The QR-bill's slip, on a page of its own",
          text: 'The receipt and the payment part are written on a page of their own, every heading and value where SIX puts it. Every line is shown to fit, measured by the advances of the fonts the PDF renderer ships.',
          evidence: EVIDENCE.slip,
        },
        {
          title: 'An e-invoice, as a copy that says so',
          text: 'A report that carries an e-invoice is written as the copy the runtime labels on every page. The invoice itself stays the PDF/A-3b or the XML.',
          evidence: EVIDENCE.copy,
        },
        {
          title: 'The same bytes, and text that stays text',
          text: 'The same document gives the same file, whatever the clock or the time zone. A string from your data is read back as that text, never as markup, a field or an address Word would follow.',
          evidence: EVIDENCE.stable,
        },
        {
          title: 'Refused rather than left out',
          text: 'What belongs to the PDF alone, or what nobody has seen Word print as the PDF does, refuses the whole file before a byte is written, never a file that opens and looks whole. In the Studio, Download Word gives byte for byte the file the writer writes under Node.',
          evidence: EVIDENCE.refused,
        },
      ],
    },
    pictures: {
      heading: 'In the Studio',
      intro:
        'A script took the picture of the built Studio, never by hand. Download Word writes the file in the browser, with the same package your application installs.',
    },
    tryIt: {
      heading: 'Try it',
      text: (version) =>
        `In the Studio, choose a starter under Starter, and the Preview offers Download Word beside Download PDF. ${version}, the newest release, publishes the writer as @formancy/report-render-docx, and its README shows how your application writes a report as a Word file.`,
      links: [
        { to: TO.write, words: 'Write a report as a Word file (report-render-docx)' },
        { to: TO.refuses, words: 'What the writer refuses' },
        { to: TO.decision, words: 'Decision 0068: why the writer refuses what belongs to the PDF' },
        { to: TO.invoices, words: 'Invoices, with a QR-bill or as an e-invoice' },
      ],
    },
    limits: {
      heading: 'What it does not do',
      items: [
        "No automated test opens a file in Word: the invoice's file was opened in Word by hand, and nothing repeats that.",
        'Word lays out the lines and pages, so a page can break elsewhere than in the PDF.',
        "The report's own fonts are not embedded in the file, and no automated test validates a file against ECMA-376's schemas yet.",
        "A chart's data is not an editable workbook, and the QR-bill's cut line carries no scissors in Word.",
        'It writes Word files and reads none: a Word template cannot be imported. No Excel, CSV or HTML.',
      ],
    },
    status: {
      heading: 'Status',
      text: (version, date) => `In ${version}, the newest release, in the source on GitHub and online in the Studio (as of ${date}).`,
    },
  },
}
