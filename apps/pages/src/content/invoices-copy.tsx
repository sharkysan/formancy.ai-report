/**
 * The invoices page's words, in each language (0081): every way Formancy
 * Report bills, on one page, each card a claim another decision makes and
 * its tests hold -- the QR-bill's (0022, 0039), the EPC QR code's (0025),
 * the e-invoice's (0027, 0031, 0038, 0044), the payment reminder's (0066)
 * and the Word file's (0075, 0077) -- and saying no more than it. The
 * QR-bill page and the EPC QR code page say each code in detail; this one
 * links them. The French and Italian name Factur-X and XRechnung where a
 * reader there would read "facture électronique" or "fattura elettronica"
 * as France's reform or Italy's FatturaPA, which Report does not claim,
 * and the limits say so. A Studio word the page names, each starter under
 * "Starter", "Final" and "Download XML", is the Studio's, held to its
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
  // SIX's rules on what the report writes and on what the data brings, and
  // the slip read back from the PDF where SIX puts it.
  qrBill: [
    'packages/report-spec/src/qr-bill.test.ts',
    'packages/report-spec/src/validate-payment-part.test.ts',
    'packages/report-runtime/src/lower-payment-part.test.ts',
    'packages/report-render-pdf/src/qr-bill.test.ts',
  ],
  // The EPC's rules, the code decoded from the page's pixels, and each
  // country's euro invoice paid for the total it prints.
  epc: [
    'packages/report-spec/src/epc-payload.test.ts',
    'packages/report-spec/src/validate-epc-qr-code.test.ts',
    'packages/report-render-pdf/src/epc-qr-code.test.ts',
    'packages/report-render-pdf/src/euro-samples.test.ts',
  ],
  // The CII written from the values the page prints, the PDF/A-3b that
  // embeds it, and the gate in which Mustang, KoSIT's validator and
  // veraPDF judge the samples.
  facturX: [
    'packages/report-runtime/src/cii.test.ts',
    'packages/report-render-pdf/src/e-invoice.test.ts',
    'packages/report-render-pdf/src/e-invoice-samples.test.ts',
    'scripts/e-invoice.mjs',
  ],
  // XRechnung's rules, its PDF refused unless it is the labelled copy, and
  // its XML judged in KoSIT's XRechnung scenario.
  xrechnung: ['packages/report-runtime/src/xrechnung.test.ts', 'packages/report-render-pdf/src/xrechnung.test.ts', 'scripts/e-invoice.mjs'],
  // Totals exact and rounded once, an e-invoice's VAT once a category, and
  // the samples' totals recomputed in BigInt against what the page prints
  // and what its code, decoded from the pixels, asks for.
  totals: [
    'packages/report-runtime/src/e-invoice-totals.test.ts',
    'packages/report-runtime/src/totals.test.ts',
    'packages/report-render-pdf/src/samples.test.ts',
    'packages/report-render-pdf/src/e-invoice-samples.test.ts',
  ],
  // The reminder in each language it is written in, every total recomputed
  // in BigInt and its bill decoded.
  reminder: ['packages/report-render-pdf/src/payment-reminder.test.ts'],
  // Each part selected and edited field by field in the editor model, and
  // the scenarios both builders run over it.
  builders: [
    'packages/report-builder-core/src/payment-part.test.ts',
    'packages/report-builder-core/src/epc-qr-code.test.ts',
    'packages/report-builder-core/src/e-invoice.test.ts',
    'packages/report-builder-react/src/scenarios.test.tsx',
    'packages/report-builder-angular/src/scenarios.test.ts',
  ],
  // The slip on a page of its own in the Word file, and an e-invoice's
  // file the copy labelled on every page.
  word: ['packages/report-render-docx/src/slip.test.ts', 'packages/report-render-docx/src/copy.test.ts'],
} satisfies Record<string, Evidence>

/** Where the page's links lead. */
const TO = {
  samples: { github: 'samples/README.md' },
  qrBill: { page: 'qr-bill' },
  epc: { page: 'epc-qr-code' },
  word: { page: 'word' },
  xrechnung: { github: 'docs/getting-started.md#an-xrechnung-take-the-xml' },
  decision: { github: 'docs/decisions/0027-a-report-carries-one-en-16931-invoice-written-from-the-values-its-page-prints.md' },
} satisfies Record<string, Target>

export const INVOICES_COPY: Readonly<Record<Language, TopicCopy>> = {
  de: {
    meta: {
      title: 'PDF-Rechnungen, QR-Rechnung, E-Rechnung – Formancy Report',
      description:
        'Rechnungen aus Ihren Daten als PDF, mit QR-Rechnung oder EPC-QR-Code zum Bezahlen, oder als E-Rechnung in Factur-X und XRechnung. Exakte Summen.',
      name: 'Rechnungen',
    },
    teaser: {
      heading: 'Rechnungen',
      text: 'Rechnungen aus Ihren eigenen Daten, bezahlt per QR-Rechnung oder EPC-QR-Code oder ausgestellt als E-Rechnung in Factur-X und XRechnung, jede Summe exakt.',
      action: 'Rechnungen mit Formancy Report',
    },
    eyebrow: 'Formancy Report für Rechnungen',
    h1: 'Rechnungen aus Ihren eigenen Daten: QR-Rechnung, EPC-QR-Code und E-Rechnung',
    lead: 'Für Teams, die die Rechnungsstellung in ihre eigene Anwendung einbauen: Rechnungen, die Ihre Kundschaft per Scan bezahlt, oder E-Rechnungen, die Ihre Anwendung verschickt. Formancy Report druckt sie aus Ihren eigenen Daten, in Ihrer Anwendung, auf Ihrem Server oder im Browser. Jede Summe wird aus exakten Ziffern berechnet und einmal gerundet, und ein Zahlungscode wird nach seinen Regeln geprüft, bevor das PDF entsteht. Report schreibt die Rechnung; Ihre Anwendung verschickt sie.',
    standing: 'Jede dieser Rechnungen ist im neuesten Release enthalten und öffnet sich im Studio online als Startvorlage.',
    actions: {
      studio: 'Im Studio ausprobieren (Startvorlage Invoice)',
      more: { to: TO.samples, words: 'Die Beispiele als PDF und Word-Datei (GitHub, Englisch)' },
    },
    does: {
      heading: 'Was es kann',
      cards: [
        {
          title: 'Die QR-Rechnung, nach den Regeln von SIX',
          text: 'Empfangsschein und Zahlteil stehen am Fuss der letzten Seite, wo SIX sie hinsetzt. Konto, Referenz und jeder Text werden nach den Implementation Guidelines von SIX geprüft, bevor das PDF entsteht, und der Betrag wird aus seinen exakten Ziffern geschrieben.',
          evidence: EVIDENCE.qrBill,
        },
        {
          title: 'Der EPC-QR-Code für eine SEPA-Überweisung',
          text: 'Eine Rechnung in Euro trägt den Code, aus dem eine Banking-App eine SEPA-Überweisung ausfüllt. IBAN, BIC, Referenz und Texte werden nach den Richtlinien des EPC geprüft, EPC069-12, und der Betrag ist auf den Cent genau.',
          evidence: EVIDENCE.epc,
        },
        {
          title: 'Factur-X / ZUGFeRD: ein PDF, das sein XML trägt',
          text: 'Ein endgültiger Druck ist ein PDF/A-3b, das sein XML einbettet, Factur-X 1.09.2 / ZUGFeRD 2.5.2 im Profil EN 16931, geschrieben aus den Werten, die die Seite druckt. In der CI beurteilen Mustang und der Validator der KoSIT das XML der Beispiele, veraPDF und Mustang ihre PDFs.',
          evidence: EVIDENCE.facturX,
        },
        {
          title: 'XRechnung 3.0: Das XML ist die Rechnung',
          text: 'Für öffentliche Auftraggeber in Deutschland ist die Rechnung ihr XML, das Ihre Anwendung dem Druck entnimmt und verschickt. Ihr PDF ist eine Kopie, die das oben auf jeder Seite sagt.',
          evidence: EVIDENCE.xrechnung,
        },
        {
          title: 'Summen und Mehrwertsteuer, exakt',
          text: 'Jede Summe wird aus exakten Ziffern berechnet und einmal gerundet, die Steuer einer E-Rechnung einmal je Kategorie. Die Tests rechnen die Summen jedes Beispiels unabhängig von der Laufzeit in BigInt nach und lesen den Betrag, den eine QR-Rechnung oder ein EPC-QR-Code verlangt, aus den Pixeln der Seite zurück: Es ist das Total, das die Seite druckt.',
          evidence: EVIDENCE.totals,
        },
        {
          title: 'Mahnungen, mit QR-Rechnung',
          text: 'Die Startvorlage Payment reminder druckt, was überfällig ist und was bezahlt wurde, je in einer eigenen Tabelle, und eine QR-Rechnung über den offenen Betrag, in jeder Sprache, in der sie geschrieben ist. Ihre Tests rechnen jede Summe aus den Daten nach.',
          evidence: EVIDENCE.reminder,
        },
        {
          title: 'Feld für Feld bearbeitet, in beiden Buildern',
          text: 'QR-Rechnung, EPC-QR-Code und E-Rechnung sind Teile des Berichts: in seiner Gliederung ausgewählt und im React- wie im Angular-Builder Feld für Feld bearbeitet. Eine falsch eingegebene IBAN wird in ihrem Feld abgelehnt, in den Worten der Regel.',
          evidence: EVIDENCE.builders,
        },
        {
          title: 'Dieselbe Rechnung als Word-Datei',
          text: 'Eine Rechnung wird auch als Word-Datei geschrieben, der Zahlteil ihrer QR-Rechnung auf einer eigenen Seite. Eine E-Rechnung wird als Kopie geschrieben, die auf jeder Seite sagt, dass sie nicht die Rechnung ist.',
          evidence: EVIDENCE.word,
        },
      ],
    },
    pictures: {
      heading: 'Rechnungen, wie der Renderer sie druckt',
      intro: 'Ein Skript hat jedes Bild aus dem PDF gezeichnet, das der Renderer erzeugt hat. Die Firmen, ihre Kundschaft und ihre Daten sind erfunden.',
    },
    tryIt: {
      heading: 'Ausprobieren',
      text: (version) =>
        `Wählen Sie im Studio unter Starter eine Startvorlage: Invoice für die QR-Rechnung, Euro invoice für den EPC-QR-Code, E-invoice (Factur-X) oder E-invoice (XRechnung) für eine E-Rechnung und Payment reminder für eine Mahnung. Die Vorschau zeigt das PDF, wie der Renderer es erzeugt hat; ist Final angekreuzt, gibt Download XML das XML einer E-Rechnung. Die Einführung installiert ${version}, das neueste Release, das sie alle druckt.`,
      links: [
        { to: TO.qrBill, words: 'Die QR-Rechnung im Einzelnen' },
        { to: TO.epc, words: 'Der EPC-QR-Code im Einzelnen' },
        { to: TO.word, words: 'Rechnungen als Word-Datei' },
        { to: TO.xrechnung, words: 'Eine XRechnung: das XML übernehmen (Einführung, Englisch)' },
        { to: TO.decision, words: 'Entscheid 0027: wie ein Bericht seine E-Rechnung trägt (Englisch)' },
      ],
    },
    limits: {
      heading: 'Was es nicht tut',
      items: [
        'Report verschickt nichts: kein E-Mail und kein Peppol. Ihre Anwendung verschickt das PDF oder das XML.',
        'E-Rechnungen sind CII, für Deutschland: kein UBL, die Regeln Frankreichs (BR-FR) werden nicht geprüft, und FatturaPA für Italien wird nicht geschrieben.',
        'Die Steuer einer E-Rechnung wird einmal je Kategorie gerundet, nie je Zeile: Ein ERP, das die Steuer jeder Zeile rundet, kann davon um bis zu einen halben Cent je Zeile abweichen.',
        'Keine Zwischensummen, die von Seite zu Seite übertragen werden, und keine Strichcodes ausser QR-Codes.',
      ],
    },
    status: {
      heading: 'Stand',
      text: (version, date) => `In ${version}, dem neuesten Release, im Quellcode auf GitHub und online im Studio (Stand ${date}).`,
    },
  },
  fr: {
    meta: {
      title: 'Factures PDF, facture QR et Factur-X – Formancy Report',
      description:
        'Des factures PDF à partir de vos données, payables par facture QR ou QR code SEPA, ou émises en Factur-X et XRechnung, avec des totaux exacts.',
      name: 'Factures',
    },
    teaser: {
      heading: 'Factures',
      text: 'Des factures imprimées à partir de vos données, payables par facture QR ou QR code SEPA, ou émises en Factur-X et XRechnung, chaque total exact.',
      action: 'Les factures avec Formancy Report',
    },
    eyebrow: 'Formancy Report pour les factures',
    h1: 'Des factures à partir de vos données : facture QR, QR code SEPA, Factur-X et XRechnung',
    lead: "Pour les équipes qui intègrent la facturation à leur propre application : des factures que vos clients paient en scannant un code, ou des factures Factur-X et XRechnung que votre application envoie. Formancy Report les imprime à partir de vos propres données, dans votre application, sur votre serveur ou dans le navigateur. Chaque total est calculé à partir de chiffres exacts et arrondi une seule fois, et un code de paiement est vérifié selon ses règles avant que le PDF soit produit. Report écrit la facture ; votre application l'envoie.",
    standing: "Chacune de ces factures figure dans la version la plus récente et s'ouvre comme modèle de départ dans le Studio en ligne.",
    actions: {
      studio: "L'essayer dans le Studio (modèle de départ Invoice)",
      more: { to: TO.samples, words: 'Les exemples en PDF et en fichier Word (GitHub, en anglais)' },
    },
    does: {
      heading: "Ce qu'il fait",
      cards: [
        {
          title: 'La facture QR, selon les règles de SIX',
          text: "Le récépissé et la section paiement s'impriment au pied de la dernière page, là où SIX les place. Le compte, la référence et chaque texte sont vérifiés selon les Implementation Guidelines de SIX avant que le PDF soit produit, et le montant est écrit à partir de ses chiffres exacts.",
          evidence: EVIDENCE.qrBill,
        },
        {
          title: 'Le QR code SEPA pour un virement',
          text: "Une facture en euros porte le code qu'une application bancaire lit pour remplir un virement SEPA. L'IBAN, le BIC, la référence et les textes sont vérifiés selon les directives de l'EPC, EPC069-12, et le montant est exact au centime.",
          evidence: EVIDENCE.epc,
        },
        {
          title: 'Factur-X / ZUGFeRD : un PDF qui porte son XML',
          text: 'Un rendu final est un PDF/A-3b qui embarque son XML, Factur-X 1.09.2 / ZUGFeRD 2.5.2 dans le profil EN 16931, écrit à partir des valeurs que la page imprime. En CI, Mustang et le validateur de la KoSIT jugent le XML des exemples, veraPDF et Mustang leurs PDF.',
          evidence: EVIDENCE.facturX,
        },
        {
          title: 'XRechnung 3.0 : le XML est la facture',
          text: 'Pour les acheteurs publics allemands, la facture est son XML, que votre application prend dans le rendu et envoie. Son PDF est une copie qui le dit en haut de chaque page.',
          evidence: EVIDENCE.xrechnung,
        },
        {
          title: 'Totaux et TVA, exacts',
          text: "Chaque total est calculé à partir de chiffres exacts et arrondi une seule fois, la TVA d'une facture Factur-X ou XRechnung une fois par catégorie. Les tests recalculent les totaux de chaque exemple en BigInt, indépendamment du runtime, et relisent dans les pixels de la page le montant que demande une facture QR ou un QR code SEPA : c'est le total que la page imprime.",
          evidence: EVIDENCE.totals,
        },
        {
          title: 'Des rappels de paiement, avec la facture QR',
          text: 'Le modèle de départ Payment reminder imprime ce qui est échu et ce qui a été payé, chacun dans son tableau, et une facture QR pour le montant dû, dans chaque langue où il est écrit. Ses tests recalculent chaque total à partir des données.',
          evidence: EVIDENCE.reminder,
        },
        {
          title: 'Modifiés champ par champ, dans les deux builders',
          text: 'La facture QR, le QR code SEPA et la facture Factur-X ou XRechnung sont des parties du rapport, sélectionnées dans son plan et modifiées champ par champ dans le builder React comme dans le builder Angular. Un IBAN mal saisi est refusé sur son champ, avec les mots de la règle.',
          evidence: EVIDENCE.builders,
        },
        {
          title: 'La même facture en fichier Word',
          text: "Une facture s'écrit aussi en fichier Word, la section paiement de sa facture QR sur une page à part. Une facture Factur-X ou XRechnung s'écrit comme une copie qui dit sur chaque page qu'elle n'est pas la facture.",
          evidence: EVIDENCE.word,
        },
      ],
    },
    pictures: {
      heading: 'Des factures telles que le moteur de rendu les imprime',
      intro: 'Un script a dessiné chaque image à partir du PDF produit par le moteur de rendu. Les entreprises, leurs clients et leurs données sont inventés.',
    },
    tryIt: {
      heading: "L'essayer",
      text: (version) =>
        `Dans le Studio, choisissez un modèle de départ sous Starter : Invoice pour la facture QR, Euro invoice pour le QR code SEPA, E-invoice (Factur-X) ou E-invoice (XRechnung), et Payment reminder pour un rappel. L'aperçu montre le PDF tel que le moteur de rendu l'a produit ; avec Final coché, Download XML donne le XML d'une facture Factur-X ou XRechnung. Le guide de démarrage installe ${version}, la version la plus récente, qui les imprime toutes.`,
      links: [
        { to: TO.qrBill, words: 'La facture QR en détail' },
        { to: TO.epc, words: 'Le QR code SEPA en détail' },
        { to: TO.word, words: 'Les factures en fichier Word' },
        { to: TO.xrechnung, words: 'Une XRechnung : prendre le XML (guide de démarrage, en anglais)' },
        { to: TO.decision, words: 'Décision 0027 : comment un rapport porte sa facture Factur-X ou XRechnung (en anglais)' },
      ],
    },
    limits: {
      heading: "Ce qu'il ne fait pas",
      items: [
        "Report n'envoie rien : ni e-mail ni Peppol. Votre application envoie le PDF ou le XML.",
        "Les factures Factur-X et XRechnung sont en CII, pour l'Allemagne : pas d'UBL, les règles françaises (BR-FR) ne sont pas vérifiées, et la FatturaPA italienne n'est pas écrite.",
        "La TVA d'une facture Factur-X ou XRechnung est arrondie une fois par catégorie, jamais par ligne : un ERP qui arrondit la TVA de chaque ligne peut s'en écarter d'un demi-centime par ligne au plus.",
        "Pas de totaux reportés d'une page à l'autre, et pas de codes-barres autres que les QR codes.",
      ],
    },
    status: {
      heading: 'État',
      text: (version, date) => `Dans la version ${version}, la plus récente, dans le code source sur GitHub et en ligne dans le Studio (état au ${date}).`,
    },
  },
  it: {
    meta: {
      title: 'Fatture PDF, fattura QR e Factur-X – Formancy Report',
      description: 'Fatture in PDF dai vostri dati, da pagare con la fattura QR o il QR code SEPA, oppure emesse come Factur-X e XRechnung, con totali esatti.',
      name: 'Fatture',
    },
    teaser: {
      heading: 'Fatture',
      text: 'Fatture stampate dai vostri dati, da pagare con la fattura QR o il QR code SEPA, oppure emesse come Factur-X e XRechnung, ogni totale esatto.',
      action: 'Le fatture con Formancy Report',
    },
    eyebrow: 'Formancy Report per le fatture',
    h1: 'Fatture dai vostri dati: fattura QR, QR code SEPA, Factur-X e XRechnung',
    lead: 'Per i team che integrano la fatturazione nella propria applicazione: fatture che i vostri clienti pagano scansionando un codice, oppure fatture Factur-X e XRechnung che la vostra applicazione invia. Formancy Report le stampa dai vostri dati, nella vostra applicazione, sul vostro server o nel browser. Ogni totale è calcolato da cifre esatte e arrotondato una sola volta, e un codice di pagamento viene verificato secondo le sue regole prima che il PDF venga prodotto. Report scrive la fattura; la vostra applicazione la invia.',
    standing: 'Ognuna di queste fatture fa parte della versione più recente e si apre come modello iniziale nello Studio online.',
    actions: {
      studio: 'Provarlo nello Studio (modello iniziale Invoice)',
      more: { to: TO.samples, words: 'Gli esempi in PDF e come file Word (GitHub, in inglese)' },
    },
    does: {
      heading: 'Che cosa fa',
      cards: [
        {
          title: 'La fattura QR, secondo le regole di SIX',
          text: "La ricevuta e la sezione pagamento si stampano in fondo all'ultima pagina, dove SIX le colloca. Il conto, il riferimento e ogni testo vengono verificati secondo le Implementation Guidelines di SIX prima che il PDF venga prodotto, e l'importo è scritto dalle sue cifre esatte.",
          evidence: EVIDENCE.qrBill,
        },
        {
          title: 'Il QR code SEPA per un bonifico',
          text: "Una fattura in euro porta il codice che un'app bancaria legge per compilare un bonifico SEPA. IBAN, BIC, riferimento e testi vengono verificati secondo le linee guida dell'EPC, EPC069-12, e l'importo è esatto al centesimo.",
          evidence: EVIDENCE.epc,
        },
        {
          title: 'Factur-X / ZUGFeRD: un PDF che porta il suo XML',
          text: "Una stampa definitiva è un PDF/A-3b che incorpora il suo XML, Factur-X 1.09.2 / ZUGFeRD 2.5.2 nel profilo EN 16931, scritto dai valori che la pagina stampa. In CI, Mustang e il validatore della KoSIT giudicano l'XML degli esempi, veraPDF e Mustang i loro PDF.",
          evidence: EVIDENCE.facturX,
        },
        {
          title: "XRechnung 3.0: l'XML è la fattura",
          text: 'Per gli acquirenti pubblici tedeschi la fattura è il suo XML, che la vostra applicazione prende dalla stampa e invia. Il suo PDF è una copia che lo dice in cima a ogni pagina.',
          evidence: EVIDENCE.xrechnung,
        },
        {
          title: 'Totali e IVA, esatti',
          text: "Ogni totale è calcolato da cifre esatte e arrotondato una sola volta, l'IVA di una fattura Factur-X o XRechnung una volta per categoria. I test ricalcolano i totali di ogni esempio in BigInt, indipendentemente dal runtime, e rileggono dai pixel della pagina l'importo che chiede una fattura QR o un QR code SEPA: è il totale che la pagina stampa.",
          evidence: EVIDENCE.totals,
        },
        {
          title: 'Solleciti di pagamento, con la fattura QR',
          text: "Il modello iniziale Payment reminder stampa ciò che è scaduto e ciò che è stato pagato, ciascuno in una tabella propria, e una fattura QR per l'importo dovuto, in ogni lingua in cui è scritto. I suoi test ricalcolano ogni totale dai dati.",
          evidence: EVIDENCE.reminder,
        },
        {
          title: 'Modificati campo per campo, in entrambi i builder',
          text: 'La fattura QR, il QR code SEPA e la fattura Factur-X o XRechnung sono parti del report, selezionate dalla sua struttura e modificate campo per campo nel builder React come nel builder Angular. Un IBAN digitato male viene rifiutato sul suo campo, con le parole della regola.',
          evidence: EVIDENCE.builders,
        },
        {
          title: 'La stessa fattura come file Word',
          text: 'Una fattura si scrive anche come file Word, la sezione pagamento della sua fattura QR su una pagina propria. Una fattura Factur-X o XRechnung si scrive come copia che dice su ogni pagina di non essere la fattura.',
          evidence: EVIDENCE.word,
        },
      ],
    },
    pictures: {
      heading: 'Fatture come le stampa il renderer',
      intro: 'Uno script ha disegnato ogni immagine dal PDF prodotto dal renderer. Le aziende, i loro clienti e i loro dati sono inventati.',
    },
    tryIt: {
      heading: 'Provarlo',
      text: (version) =>
        `Nello Studio, scegliete un modello iniziale sotto Starter: Invoice per la fattura QR, Euro invoice per il QR code SEPA, E-invoice (Factur-X) o E-invoice (XRechnung), e Payment reminder per un sollecito. L'anteprima mostra il PDF così come l'ha prodotto il renderer; con Final selezionato, Download XML dà l'XML di una fattura Factur-X o XRechnung. La guida introduttiva installa ${version}, la versione più recente, che le stampa tutte.`,
      links: [
        { to: TO.qrBill, words: 'La fattura QR in dettaglio' },
        { to: TO.epc, words: 'Il QR code SEPA in dettaglio' },
        { to: TO.word, words: 'Le fatture come file Word' },
        { to: TO.xrechnung, words: "Una XRechnung: prendere l'XML (guida introduttiva, in inglese)" },
        { to: TO.decision, words: 'Decisione 0027: come un report porta la sua fattura Factur-X o XRechnung (in inglese)' },
      ],
    },
    limits: {
      heading: 'Che cosa non fa',
      items: [
        "Report non invia nulla: né e-mail né Peppol. La vostra applicazione invia il PDF o l'XML.",
        'Le fatture Factur-X e XRechnung sono CII, per la Germania: niente UBL, le regole francesi (BR-FR) non vengono verificate, e la FatturaPA italiana non viene scritta.',
        "L'IVA di una fattura Factur-X o XRechnung è arrotondata una volta per categoria, mai per riga: un ERP che arrotonda l'IVA di ogni riga può discostarsene fino a mezzo centesimo per riga.",
        "Nessun totale riportato da una pagina all'altra, e nessun codice a barre se non i QR code.",
      ],
    },
    status: {
      heading: 'Stato',
      text: (version, date) => `Nella versione ${version}, la più recente, nel codice sorgente su GitHub e online nello Studio (stato al ${date}).`,
    },
  },
  en: {
    meta: {
      title: 'PDF invoices, QR-bills and e-invoices – Formancy Report',
      description:
        'Invoices printed as PDF from your own data, paid by a Swiss QR-bill or an EPC QR code, or issued as Factur-X and XRechnung e-invoices, with exact totals.',
      name: 'Invoices',
    },
    teaser: {
      heading: 'Invoices',
      text: 'Invoices printed from your own data, paid by a Swiss QR-bill or an EPC QR code, or issued as Factur-X and XRechnung e-invoices, every total exact.',
      action: 'Invoices with Formancy Report',
    },
    eyebrow: 'Formancy Report for invoices',
    h1: 'Invoices from your own data: QR-bill, EPC QR code and e-invoice',
    lead: 'For teams building invoicing into their own application: invoices your customers pay by scanning a code, or e-invoices your application sends. Formancy Report prints them from your own data, in your own application, on your server or in the browser. Every total is computed from exact digits and rounded once, and a payment code is checked against its rules before the PDF is made. Report writes the invoice; your application sends it.',
    standing: 'Each of these invoices is in the newest release and opens as a starter in the online Studio.',
    actions: { studio: 'Try them in the Studio (the Invoice starter)', more: { to: TO.samples, words: 'The samples as PDF and Word files (GitHub)' } },
    does: {
      heading: 'What it does',
      cards: [
        {
          title: "The Swiss QR-bill, held to SIX's rules",
          text: "The receipt and the payment part print at the foot of the last page, where SIX puts them. The account, the reference and every text are checked against SIX's implementation guidelines before the PDF is made, and the amount is written from its exact digits.",
          evidence: EVIDENCE.qrBill,
        },
        {
          title: 'The EPC QR code for a SEPA transfer',
          text: "A euro invoice carries the code a banking app reads to fill in a SEPA credit transfer. The IBAN, the BIC, the reference and the texts are checked against the EPC's guidelines, EPC069-12, and the amount is exact to the cent.",
          evidence: EVIDENCE.epc,
        },
        {
          title: 'Factur-X / ZUGFeRD: a PDF that carries its XML',
          text: "A final render is a PDF/A-3b that embeds its XML, Factur-X 1.09.2 / ZUGFeRD 2.5.2 in the EN 16931 profile, written from the values the page prints. In CI, Mustang and KoSIT's validator judge the samples' XML, and veraPDF and Mustang their PDFs.",
          evidence: EVIDENCE.facturX,
        },
        {
          title: 'XRechnung 3.0: the XML is the invoice',
          text: 'For German public buyers, the invoice is its XML, which your application takes from the render and sends. Its PDF is a copy that says so at the top of every page.',
          evidence: EVIDENCE.xrechnung,
        },
        {
          title: 'Totals and VAT, exact',
          text: "Every total is computed from exact digits and rounded once, an e-invoice's VAT once for each category. The tests recompute every sample's totals in BigInt, independently of the runtime, and read the amount a QR-bill or an EPC QR code asks for back from the page's pixels: it is the total the page prints.",
          evidence: EVIDENCE.totals,
        },
        {
          title: 'Payment reminders, with the QR-bill',
          text: 'The Payment reminder starter prints what is overdue and what was paid, each in a table of its own, and a QR-bill for the amount due, in each language it is written in. Its tests recompute every total from the data.',
          evidence: EVIDENCE.reminder,
        },
        {
          title: 'Edited field by field, in either builder',
          text: "The QR-bill, the EPC QR code and the e-invoice are parts of the report, selected from its outline and edited field by field in the React and the Angular builder. A mistyped IBAN is refused on its field, in the rule's words.",
          evidence: EVIDENCE.builders,
        },
        {
          title: 'The same invoice as a Word file',
          text: "An invoice is also written as a Word file, its QR-bill's slip on a page of its own. An e-invoice is written as a copy that says on every page that it is not the invoice.",
          evidence: EVIDENCE.word,
        },
      ],
    },
    pictures: {
      heading: 'Invoices as the renderer prints them',
      intro: 'A script drew each picture from the PDF the renderer produced. The firms, their customers and their data are invented.',
    },
    tryIt: {
      heading: 'Try it',
      text: (version) =>
        `In the Studio, choose a starter under Starter: Invoice for the QR-bill, Euro invoice for the EPC QR code, E-invoice (Factur-X) or E-invoice (XRechnung) for an e-invoice, and Payment reminder for a reminder. The Preview shows the PDF as the renderer produced it; with Final on, Download XML gives an e-invoice's XML. The getting-started guide installs ${version}, the newest release, which prints them all.`,
      links: [
        { to: TO.qrBill, words: 'The Swiss QR-bill, in detail' },
        { to: TO.epc, words: 'The EPC QR code, in detail' },
        { to: TO.word, words: 'Invoices as Word files' },
        { to: TO.xrechnung, words: 'An XRechnung: take the XML (getting-started guide)' },
        { to: TO.decision, words: 'Decision 0027: how a report carries its e-invoice' },
      ],
    },
    limits: {
      heading: 'What it does not do',
      items: [
        'Report sends nothing: no e-mail and no Peppol. Your application sends the PDF or the XML.',
        "E-invoices are CII, for Germany: no UBL, France's rules (BR-FR) are not checked, and Italy's FatturaPA is not written.",
        "An e-invoice's VAT is rounded once for each category, never line by line: an ERP that rounds each line's VAT can differ from it by up to half a cent a line.",
        'No running totals carried from page to page, and no barcodes but QR codes.',
      ],
    },
    status: {
      heading: 'Status',
      text: (version, date) => `In ${version}, the newest release, in the source on GitHub and online in the Studio (as of ${date}).`,
    },
  },
}
