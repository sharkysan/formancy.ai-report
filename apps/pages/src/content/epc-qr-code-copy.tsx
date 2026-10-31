/**
 * The EPC QR code page's words, in each language (0028). Every claim is one
 * decision 0025 makes and its tests hold, or one the euro invoice's samples
 * make and theirs hold, and says no more than it: each card's tests are
 * listed beside the cards, in `CARD_EVIDENCE` (epc-qr-code.tsx), and the
 * limits are 0025's costs and 0028's, and 0027's and 0031's where one says
 * what an e-invoice is: its XML written by the runtime and embedded in the
 * PDF/A-3b the renderer draws, for Germany alone, which veraPDF, Mustang and
 * KoSIT judge on the corpus's German samples. The release the status names is read
 * from the changelog and handed in, never typed; the day the samples' rates
 * and registers were read is `EURO_SAMPLES_READ`.
 *
 * The code is named by what it is, never by a bank's or a brand's name for
 * it (0025): the EPC QR code, EPC-QR-Code, and in French and Italian the
 * QR code SEPA, as a reader there meets the transfer. The PSA's words are
 * the PSA's: "Zahlen mit Code", the caption its frame prints. A Studio word
 * the page names, the starter "Euro invoice" under "Starter" and the
 * palette's "EPC payment code", is the Studio's, which nothing here reads
 * (0024). No translation is reviewed by a native speaker; the German is
 * Switzerland's spelling, as every German page's. Reviewed by a person, not
 * a test, for meaning; the suite holds what can be measured (checks/).
 */
import type { Language } from '../languages.js'
import type { PageMeta, Teaser } from '../pages.js'

export interface EpcQrCodeCopy {
  readonly meta: PageMeta
  /** What the product page says of the page; `standing` follows its text there. */
  readonly teaser: Teaser
  readonly eyebrow: string
  readonly h1: string
  readonly lead: string
  /** Where the code stands, in a sentence: said in the hero and after the teaser, where a reader decides to try it. */
  readonly standing: string
  readonly actions: { readonly studio: string; readonly samples: string }
  /** What it does, card by card, in the order `CARD_EVIDENCE` lists each card's tests. */
  readonly does: { readonly heading: string; readonly cards: readonly { readonly title: string; readonly text: string }[] }
  readonly samples: {
    readonly heading: string
    /** What the samples are: `date` is the day their VAT rates were read. */
    readonly intro: (date: string) => string
    /** Whose accounts they pay: `date` is the day the registers were read. */
    readonly accounts: (date: string) => string
    /** The link's words, after the accounts, to the record that cites each rate's and each register's source with its address. */
    readonly record: string
  }
  readonly tryIt: {
    readonly heading: string
    /** How to try it: `version` is the changelog's newest release, which the getting-started guide installs. */
    readonly text: (version: string) => string
    readonly links: { readonly studio: string; readonly spec: string; readonly renderer: string; readonly decision: string; readonly guide: string }
  }
  readonly limits: {
    readonly heading: string
    readonly items: readonly string[]
    /** The link's words, after the limits, to the QR-bill page: for a reader whose invoice is paid to an account in Switzerland or Liechtenstein, in francs or euro. */
    readonly qrBill: string
  }
  readonly status: {
    readonly heading: string
    /** Where the EPC QR code stands: `version` is the changelog's newest release, `date` the day it was last said. */
    readonly text: (version: string, date: string) => string
    readonly licence: string
    /** The link's words, to the product page's licence. */
    readonly terms: string
  }
}

export const EPC_QR_CODE_COPY: Readonly<Record<Language, EpcQrCodeCopy>> = {
  // Not reviewed by a native speaker.
  de: {
    meta: {
      title: 'EPC-QR-Codes (SEPA) auf PDF-Rechnungen – Formancy Report',
      description:
        'Rechnungen als PDF mit EPC-QR-Code für die SEPA-Überweisung, aus Ihren eigenen Daten erstellt, nach den Regeln des EPC geprüft und selbst gehostet.',
      name: 'EPC-QR-Code',
    },
    teaser: {
      heading: 'EPC-QR-Codes',
      text: 'Rechnungen in Euro mit dem QR-Code, mit dem eine Banking-App die SEPA-Überweisung vorausfüllt: IBAN, BIC, Referenz und jeder Text nach den Regeln des EPC geprüft, bevor das PDF entsteht, ein Betrag, der exakt aus den Werten der Rechnung berechnet wird, und Beispiele aus Deutschland, Österreich, Frankreich, Italien, Spanien, den Niederlanden und Irland.',
      action: 'EPC-QR-Codes mit Formancy Report',
    },
    eyebrow: 'Formancy Report für den EPC-QR-Code',
    h1: 'EPC-QR-Codes auf Ihren Rechnungen, geprüft nach den Regeln des EPC',
    lead: 'Formancy Report druckt auf Ihre Rechnungen als PDF den QR-Code für Überweisungen, auch SEPA-QR-Code genannt, mit dem eine Banking-App eine SEPA-Überweisung vorausfüllt, so wie der European Payments Council ihn in EPC069-12 festlegt. Ihre Anwendung übergibt die Daten; bevor das PDF entsteht, werden IBAN, BIC, Referenz und jeder Text nach den Regeln des EPC geprüft, und der Betrag wird exakt aus den Werten der Rechnung berechnet, in den Beispielen ihr Rechnungsbetrag.',
    standing: 'Der EPC-QR-Code ist online im Studio zu sehen und im neuesten Release enthalten.',
    actions: { studio: 'Im Studio ausprobieren (Startvorlage Euro invoice)', samples: 'Die Beispiele ansehen' },
    does: {
      heading: 'Was es kann',
      cards: [
        {
          title: 'Die Regeln des EPC, an einem Ort',
          text: 'IBAN, BIC, Referenz und jeder Text werden nach EPC069-12 geprüft, den Richtlinien des EPC: eine IBAN eines Landes im SEPA-Raum, so lang wie die IBANs dieses Landes und mit richtigen Prüfziffern, nie eine QR-IBAN; ein BIC aus dem Land des Kontos, verlangt für ein Konto ausserhalb des EWR; als strukturierte Referenz nur eine Creditor Reference nach ISO 11649; jeder Text nicht länger, als der EPC erlaubt, und ohne Steuerzeichen oder Zeilenumbruch; und alles zusammen höchstens 331 Bytes in UTF-8. Dieselben Prüfungen gelten für das, was im Bericht steht, und für das, was aus den Daten kommt.',
        },
        {
          title: 'Vor dem PDF abgelehnt, auf seinem Feld',
          text: 'Eine IBAN mit falschen Prüfziffern, falscher Länge oder aus einem Land ausserhalb des SEPA-Raums wird schon bei der Validierung des Berichts abgelehnt, auf ihrem Feld und mit der verletzten Regel, und beide Builder zeigen es dort. Was aus den Daten kommt, prüft die Laufzeit nach denselben Regeln, bevor das PDF entsteht. Keine Meldung nennt den Wert selbst, also nie einen Namen, ein Konto oder eine Referenz. Ein Tippfehler, der zu den Prüfziffern trotzdem passt, oder die gültige IBAN eines anderen Kontos fällt nicht auf.',
        },
        {
          title: 'Der Betrag, auf den Cent genau',
          text: 'Der Betrag ist ein Ausdruck über die Werte des Berichts, in den Beispielen ihr Rechnungsbetrag: exakt berechnet und so kurz geschrieben, wie es Payment Services Austria (PSA) verlangt. Ein Betrag mit mehr als zwei Nachkommastellen wird abgelehnt, nicht gerundet. Ohne Betrag bleibt er der zahlenden Person überlassen.',
        },
        {
          title: 'Neben den Angaben, die er enthält',
          text: 'Jedes Beispiel druckt neben dem Code Empfänger, IBAN, BIC, Betrag und Referenz, für den Fall, den EPC069-12 beschreibt: Die zahlende Person sieht die Daten der Überweisung zugleich als Text. Die Tests des Renderers decodieren den Code und lesen jede dieser Angaben neben ihm auf der Seite zurück.',
        },
        {
          title: 'Österreichs Rahmen, auf Wunsch',
          text: 'Auf Wunsch trägt der Code den Rahmen, den die PSA vorgibt, mit «Zahlen mit Code» an seiner rechten Seite, von unten nach oben gelesen, und mit Modulen von 0,381 bis 0,508 mm, wie die PSA sie verlangt. Das österreichische Beispiel trägt ihn.',
        },
        {
          title: 'Am erzeugten PDF bewiesen',
          text: 'Die Tests lesen den Code aus den Pixeln der Seite zurück, die PDF.js aus dem erzeugten PDF zeichnet, und decodieren ihn mit ZXing: die Beispiele des EPC Byte für Byte, mit der Fehlerkorrekturstufe M, und jedes Beispiel dieser Seite bis zum Betrag, den es druckt.',
        },
      ],
    },
    samples: {
      heading: 'Beispiele: eine Rechnung in Euro aus Deutschland, Österreich, Frankreich, Italien, Spanien, den Niederlanden und Irland',
      intro: (date) =>
        `Das deutsche Beispiel ist die Startvorlage Euro invoice des Studios und stellt die Wartung einer Gastherme in Rechnung. Die anderen verkaufen Ersatzteile für eine Heizung an eine Privatperson, jedes von einer erfundenen Firma seines Landes und zum Normalsatz der Umsatzsteuer seines Landes, wie ihn die Tabelle des EU-Portals Your Europe am ${date} angab; sie verkaufen Teile statt Wartung, weil Arbeiten an einer Wohnung in mehreren dieser Länder zu einem ermässigten Satz besteuert werden können. Beträge und Datumsangaben stehen so, wie die Laufzeit sie für die Locale des Beispiels formatiert (de-DE, de-AT, fr-FR, it-IT, es-ES, nl-NL oder en-IE), und das österreichische trägt Österreichs Rahmen. Ein Skript hat jedes Bild aus dem PDF gezeichnet, das der Renderer erzeugt hat.`,
      accounts: (date) =>
        `Die Firmen und ihre Kundschaft sind erfunden. Jedes Konto hat richtige Prüfziffern. Die Bankcodes der Konten aus Deutschland, Österreich, Frankreich, Spanien und den Niederlanden führt keine Bank in den Registern dieser Länder, gelesen am ${date}. Die Register Italiens und Irlands konnten nicht gelesen werden: Das italienische Konto ist mit der ABI 00000 gebildet und das irische mit dem Bankcode FMNC und dem Sort Code 000000, und mehr wird von ihnen nicht gesagt.`,
      record: 'Entscheid 0028 nennt die Quelle jedes Satzes und jedes Registers, mit ihrer Adresse (Englisch).',
    },
    tryIt: {
      heading: 'Ausprobieren',
      text: (version) =>
        `Im Studio ist das deutsche Beispiel die Startvorlage Euro invoice: Wählen Sie sie unter Starter, und die Vorschau zeigt das PDF mit seinem EPC-QR-Code, so wie der Renderer es erzeugt hat. Die Builder des Studios sind englisch, und in ihrer Palette heisst der Code EPC payment code. Die Einführung installiert ${version}, das neueste Release, das einen Bericht mit EPC-QR-Code druckt. Wie ein Bericht seinen Code trägt und wie der Renderer ihn zeichnet, beschreibt die Dokumentation auf GitHub, auf Englisch.`,
      links: {
        studio: 'Das Studio öffnen',
        spec: 'Der EPC-QR-Code im Berichtsformat (report-spec, Englisch)',
        renderer: 'Wie der Renderer den Code und Österreichs Rahmen zeichnet (report-render-pdf, Englisch)',
        decision: 'Entscheid 0025: warum der Code so geprüft und gedruckt wird (Englisch)',
        guide: 'Die Einführung lesen (Englisch)',
      },
    },
    limits: {
      heading: 'Was es nicht tut',
      items: [
        'Es erzeugt die Rechnung, mehr nicht: Formancy Report ist weder E-Banking noch Buchhaltungssoftware, verschickt keine Rechnungen und gleicht keine Zahlungseingänge ab.',
        'Nur die SEPA-Überweisung in Euro: keine Echtzeitüberweisung, keine andere Währung, und als strukturierte Referenz nur die Creditor Reference nach ISO 11649. Eine belgische strukturierte Mitteilung gehört in den Text, den eine Bank nicht als Referenz liest.',
        'Der Betrag trägt keine Währung: Nichts prüft, ob die Vorlage ihm einen Wert in Euro gibt.',
        'Der BIC wird nur für ein Konto ausserhalb des EWR verlangt. Die Bank einer zahlenden Person ausserhalb des EWR, etwa in der Schweiz, kann ihn trotzdem brauchen; das leere BIC-Feld der Builder sagt es.',
        'Wo der Code steht, bestimmt die Vorlage: Den Platz am unteren Seitenrand, den die PSA verlangt, kann das Format nicht festhalten, und ein Code in der Fusszeile steht auf jeder Seite. Der Rahmen ist eine Option, und ein Code ohne ihn wird nicht an den Modulbreiten der PSA gemessen.',
        'Nichts zwingt eine Vorlage, die Angaben neben den Code zu drucken; die Beispiele tun es.',
        'Das PDF ist keine E-Rechnung: weder XRechnung noch ZUGFeRD, Factur-X oder FatturaPA, und die Beispiele dieser Seite tragen keine. Die endgültige Ausgabe eines Berichts mit E-Rechnung zeichnet Formancy Report als Rechnung nach ZUGFeRD oder Factur-X im Profil EN 16931, als PDF/A-3b, in das ihr XML eingebettet ist, allein für Deutschland (Frankreich ist nicht abgedeckt); veraPDF, Mustang und der Validator der KoSIT prüfen die deutschen Beispiele in seinem Quellcode. Wo ein Land die E-Rechnung verlangt, ist das PDF höchstens eine Kopie, wie das italienische Beispiel mit dem Hinweis Copia di cortesia sagt.',
        'Die Beispiele sind keine Steuerberatung: Die Steuersätze darin sind die Normalsätze des Tages, an dem sie gelesen wurden, und ob ein Beispiel alles trägt, was das Rechnungsrecht seines Landes verlangt, hat niemand geprüft.',
        'Noch keine Banking-App hat diese Codes gescannt: Die Tests lesen den Code mit ZXing aus der Zeichnung von PDF.js, und gedruckt wurde noch keiner. Die Richtlinien des EPC sind eine Empfehlung, und eine Bank muss einen Code nicht lesen.',
      ],
      qrBill: 'Für eine Rechnung in Franken oder Euro an ein Konto in der Schweiz oder in Liechtenstein: die QR-Rechnung',
    },
    status: {
      heading: 'Stand',
      text: (version, date) => `In ${version}, dem neuesten Release, im Quellcode auf GitHub und online im Studio (Stand ${date}).`,
      licence: 'Formancy Report ist source-available: Der Quellcode ist öffentlich, und für den Betrieb in Produktion braucht es eine kostenpflichtige Lizenz.',
      terms: 'Die Bedingungen auf der Produktseite',
    },
  },
  // Not reviewed by a native speaker.
  fr: {
    meta: {
      title: 'QR code SEPA (EPC) sur vos factures PDF – Formancy Report',
      description:
        "Des factures PDF avec un QR code SEPA (EPC) pour le virement, générées à partir de vos données et vérifiées selon les règles de l'EPC, sur vos serveurs.",
      name: 'QR code SEPA',
    },
    teaser: {
      heading: 'QR codes SEPA',
      text: "Des factures en euros avec le QR code à partir duquel une application bancaire préremplit le virement SEPA : l'IBAN, le BIC, la référence et chaque texte vérifiés selon les règles de l'EPC avant que le PDF soit produit, un montant calculé de manière exacte à partir des valeurs de la facture, et des exemples d'Allemagne, d'Autriche, de France, d'Italie, d'Espagne, des Pays-Bas et d'Irlande.",
      action: 'Le QR code SEPA avec Formancy Report',
    },
    eyebrow: 'Formancy Report pour le QR code SEPA',
    h1: "Le QR code SEPA sur vos factures, vérifié selon les règles de l'EPC",
    lead: "Formancy Report imprime sur vos factures en PDF le QR code à partir duquel une application bancaire préremplit un virement SEPA, tel que l'European Payments Council le définit dans EPC069-12, et que l'on appelle souvent QR code EPC. Votre application fournit les données ; avant que le PDF soit produit, l'IBAN, le BIC, la référence et chaque texte sont vérifiés selon les règles de l'EPC, et le montant est calculé de manière exacte à partir des valeurs de la facture, son total dans les exemples.",
    standing: 'Le QR code SEPA se découvre en ligne dans le Studio et figure dans la version la plus récente.',
    actions: { studio: "L'essayer dans le Studio (modèle de départ Euro invoice)", samples: 'Voir les exemples' },
    does: {
      heading: "Ce qu'il fait",
      cards: [
        {
          title: "Les règles de l'EPC, en un seul endroit",
          text: "L'IBAN, le BIC, la référence et chaque texte sont vérifiés selon EPC069-12, les directives de l'EPC : un IBAN d'un pays de l'espace SEPA, de la longueur des IBAN de ce pays et avec des chiffres de contrôle corrects, jamais un QR-IBAN ; un BIC du pays du compte, exigé pour un compte hors de l'EEE ; comme référence structurée, seulement une Creditor Reference selon ISO 11649 ; chaque texte pas plus long que l'EPC ne le permet, sans caractère de contrôle ni saut de ligne ; et le tout en 331 octets au plus en UTF-8. Les mêmes contrôles s'appliquent à ce que dit le rapport et à ce qu'apportent les données.",
        },
        {
          title: 'Refusé avant le PDF, sur son champ',
          text: "Un IBAN dont les chiffres de contrôle ou la longueur sont faux, ou qui est d'un pays hors de l'espace SEPA, est refusé dès la validation du rapport, sur son champ et avec la règle enfreinte, et les deux builders l'y affichent. Ce qui vient des données est vérifié par le runtime selon les mêmes règles, avant que le PDF soit produit. Aucun message ne cite la valeur elle-même : jamais un nom, un compte ou une référence. Une faute de frappe qui respecte malgré tout les chiffres de contrôle, ou l'IBAN valide d'un autre compte, passe inaperçue.",
        },
        {
          title: 'Le montant, exact au centime',
          text: "Le montant est une expression sur les valeurs du rapport ; dans les exemples, le total de la facture : calculé de manière exacte et écrit sous la forme la plus courte possible, comme l'exige Payment Services Austria (PSA). Un montant de plus de deux décimales est refusé, pas arrondi. Sans montant, c'est la personne qui paie qui le saisit.",
        },
        {
          title: "À côté des données qu'il contient",
          text: "Chaque exemple imprime à côté du code le bénéficiaire, l'IBAN, le BIC, le montant et la référence, pour le cas que décrit EPC069-12 : la personne qui paie voit en même temps les données du virement en texte. Les tests du moteur de rendu décodent le code et relisent chacune de ces données à côté de lui sur la page.",
        },
        {
          title: 'Le cadre autrichien, sur demande',
          text: "Sur demande, le code porte le cadre que prescrit la PSA, avec « Zahlen mit Code » sur son côté droit, à lire de bas en haut, et des modules de 0,381 à 0,508 mm, comme la PSA les exige. L'exemple autrichien le porte.",
        },
        {
          title: 'Prouvé sur le PDF produit',
          text: "Les tests relisent le code dans les pixels de la page que PDF.js dessine à partir du PDF produit, et le décodent avec ZXing : les exemples de l'EPC octet par octet, au niveau de correction M, et chaque exemple de cette page jusqu'au montant qu'il imprime.",
        },
      ],
    },
    samples: {
      heading: "Exemples : une facture en euros d'Allemagne, d'Autriche, de France, d'Italie, d'Espagne, des Pays-Bas et d'Irlande",
      intro: (date) =>
        `L'exemple allemand est le modèle de départ Euro invoice du Studio et facture l'entretien d'une chaudière à gaz. Les autres vendent des pièces de chauffage à un particulier, chacun d'une entreprise fictive de son pays et au taux normal de TVA de son pays, tel que le tableau du portail Your Europe de l'UE le donnait le ${date} ; ils vendent des pièces plutôt que l'entretien, parce que des travaux dans un logement peuvent être imposés à un taux réduit dans plusieurs de ces pays. Les montants et les dates sont tels que le runtime les formate pour les paramètres régionaux de l'exemple (de-DE, de-AT, fr-FR, it-IT, es-ES, nl-NL ou en-IE), et l'exemple autrichien porte le cadre autrichien. Un script a dessiné chaque image à partir du PDF produit par le moteur de rendu.`,
      accounts: (date) =>
        `Les entreprises et leurs clients sont fictifs. Chaque compte a des chiffres de contrôle corrects. Les codes banque des comptes d'Allemagne, d'Autriche, de France, d'Espagne et des Pays-Bas ne sont ceux d'aucune banque dans les registres de ces pays, consultés le ${date}. Les registres de l'Italie et de l'Irlande n'ont pas pu être lus : le compte italien est formé avec l'ABI 00000 et le compte irlandais avec le code banque FMNC et le sort code 000000, et rien de plus n'est dit d'eux.`,
      record: 'La décision 0028 cite la source de chaque taux et de chaque registre, avec son adresse (en anglais).',
    },
    tryIt: {
      heading: "L'essayer",
      text: (version) =>
        `Dans le Studio, l'exemple allemand est le modèle de départ Euro invoice : choisissez-le sous Starter, et l'aperçu montre le PDF avec son QR code SEPA, tel que le moteur de rendu l'a produit. Les builders du Studio sont en anglais, et dans leur palette le code s'appelle EPC payment code. Le guide de démarrage installe ${version}, la version la plus récente, qui imprime un rapport avec un QR code SEPA. La documentation sur GitHub, en anglais, explique comment un rapport porte son code et comment le moteur de rendu le dessine.`,
      links: {
        studio: 'Ouvrir le Studio',
        spec: 'Le QR code SEPA dans le format des rapports (report-spec, en anglais)',
        renderer: 'Comment le moteur de rendu dessine le code et le cadre autrichien (report-render-pdf, en anglais)',
        decision: 'Décision 0025 : pourquoi le code est vérifié et imprimé ainsi (en anglais)',
        guide: 'Lire le guide de démarrage (en anglais)',
      },
    },
    limits: {
      heading: "Ce qu'il ne fait pas",
      items: [
        "Il génère la facture, rien de plus : Formancy Report n'est ni un service de banque en ligne ni un logiciel de comptabilité, il n'envoie aucune facture et ne rapproche aucun paiement reçu.",
        "Seulement le virement SEPA en euros : pas de virement instantané, pas d'autre devise, et comme référence structurée seulement la Creditor Reference selon ISO 11649. Une communication structurée belge va dans le texte, qu'une banque ne lit pas comme une référence.",
        "Le montant n'indique aucune devise : rien ne vérifie que le modèle lui donne une valeur en euros.",
        "Le BIC n'est exigé que pour un compte hors de l'EEE. La banque d'une personne qui paie hors de l'EEE, en Suisse par exemple, peut en avoir besoin tout de même ; le champ BIC vide des builders le dit.",
        "L'emplacement du code est celui que choisit le modèle : le bas de la page que demande la PSA, le format ne peut pas l'imposer, et un code dans le pied de page s'imprime sur chaque page. Le cadre est une option, et un code sans cadre n'est pas mesuré aux largeurs de module de la PSA.",
        "Rien n'oblige un modèle à imprimer les données à côté du code ; les exemples le font.",
        "Le PDF n'est pas une facture électronique : ni XRechnung, ni ZUGFeRD, ni Factur-X, ni FatturaPA, et les exemples de cette page n'en portent aucune. Formancy Report dessine le rendu final d'un rapport qui porte une facture électronique comme une facture ZUGFeRD ou Factur-X au profil EN 16931, un PDF/A-3b qui intègre son XML, pour la seule Allemagne (la France n'est pas couverte) ; veraPDF, Mustang et le validateur de la KoSIT jugent les exemples allemands de son code source. Là où un pays exige la facture électronique, le PDF n'en est au mieux qu'une copie, comme le dit l'exemple italien avec la mention Copia di cortesia.",
        "Les exemples ne sont pas un conseil fiscal : leurs taux sont les taux normaux du jour où ils ont été lus, et personne n'a vérifié qu'un exemple porte tout ce que le droit de la facturation de son pays exige.",
        "Aucune application bancaire n'a encore scanné ces codes : les tests lisent le code avec ZXing dans le dessin de PDF.js, et aucun n'a encore été imprimé. Les directives de l'EPC ne sont qu'une recommandation, et une banque n'est pas tenue de lire un code.",
      ],
      qrBill: 'Pour une facture en francs ou en euros vers un compte en Suisse ou au Liechtenstein : la facture QR',
    },
    status: {
      heading: 'État',
      text: (version, date) => `Dans la version ${version}, la plus récente, dans le code source sur GitHub et en ligne dans le Studio (état au ${date}).`,
      licence: "Formancy Report est source-available : le code source est public, et l'exploitation en production nécessite une licence payante.",
      terms: 'Les conditions, sur la page du produit',
    },
  },
  // Not reviewed by a native speaker.
  it: {
    meta: {
      title: 'QR code SEPA (EPC) sulle fatture in PDF – Formancy Report',
      description:
        "Fatture in PDF con un QR code SEPA (EPC) per il bonifico, generate dai vostri dati e verificate secondo le regole dell'EPC, sui vostri server.",
      name: 'QR code SEPA',
    },
    teaser: {
      heading: 'QR code SEPA',
      text: "Fatture in euro con il QR code da cui un'app bancaria compila il bonifico SEPA: l'IBAN, il BIC, il riferimento e ogni testo verificati secondo le regole dell'EPC prima che il PDF venga prodotto, un importo calcolato in modo esatto dai valori della fattura, ed esempi da Germania, Austria, Francia, Italia, Spagna, Paesi Bassi e Irlanda.",
      action: 'Il QR code SEPA con Formancy Report',
    },
    eyebrow: 'Formancy Report per il QR code SEPA',
    h1: "Il QR code SEPA sulle vostre fatture, verificato secondo le regole dell'EPC",
    lead: "Formancy Report stampa sulle vostre fatture in PDF il QR code da cui un'app bancaria compila un bonifico SEPA, noto anche come QR code EPC, come lo definisce l'European Payments Council in EPC069-12. La vostra applicazione fornisce i dati; prima che il PDF venga prodotto, l'IBAN, il BIC, il riferimento e ogni testo vengono verificati secondo le regole dell'EPC, e l'importo è calcolato in modo esatto dai valori della fattura, negli esempi il suo totale.",
    standing: 'Il QR code SEPA si può vedere online nello Studio e fa parte della versione più recente.',
    actions: { studio: 'Provarlo nello Studio (modello iniziale Euro invoice)', samples: 'Vedere gli esempi' },
    does: {
      heading: 'Che cosa fa',
      cards: [
        {
          title: "Le regole dell'EPC, in un solo posto",
          text: "L'IBAN, il BIC, il riferimento e ogni testo vengono verificati secondo EPC069-12, le linee guida dell'EPC: un IBAN di un paese dell'area SEPA, della lunghezza degli IBAN di quel paese e con cifre di controllo corrette, mai un QR-IBAN; un BIC del paese del conto, richiesto per un conto fuori dal SEE; come riferimento strutturato solo una Creditor Reference secondo ISO 11649; ogni testo non più lungo di quanto l'EPC permette, senza caratteri di controllo né a capo; e il tutto in 331 byte al massimo in UTF-8. Gli stessi controlli valgono per ciò che dice il report e per ciò che arriva dai dati.",
        },
        {
          title: 'Rifiutato prima del PDF, sul suo campo',
          text: "Un IBAN con cifre di controllo o lunghezza sbagliate, o di un paese fuori dall'area SEPA, viene rifiutato già alla validazione del report, sul suo campo e con la regola violata, e i due builder lo mostrano lì. Ciò che viene dai dati è verificato dal runtime secondo le stesse regole, prima che il PDF venga prodotto. Nessun messaggio cita il valore stesso: mai un nome, un conto o un riferimento. Un errore di battitura che rispetta comunque le cifre di controllo, o l'IBAN valido di un altro conto, non viene notato.",
        },
        {
          title: "L'importo, esatto al centesimo",
          text: "L'importo è un'espressione sui valori del report; negli esempi, il totale della fattura: calcolato in modo esatto e scritto nella forma più breve, come richiede Payment Services Austria (PSA). Un importo con più di due decimali viene rifiutato, non arrotondato. Senza importo, lo inserisce chi paga.",
        },
        {
          title: 'Accanto ai dati che contiene',
          text: "Ogni esempio stampa accanto al codice il beneficiario, l'IBAN, il BIC, l'importo e il riferimento, per il caso che descrive EPC069-12: chi paga vede nello stesso momento i dati del bonifico come testo. I test del renderer decodificano il codice e rileggono ciascuno di questi dati accanto a esso sulla pagina.",
        },
        {
          title: 'La cornice austriaca, su richiesta',
          text: "Su richiesta, il codice porta la cornice che prescrive la PSA, con «Zahlen mit Code» sul lato destro, da leggere dal basso verso l'alto, e moduli da 0,381 a 0,508 mm, come la PSA li richiede. L'esempio austriaco la porta.",
        },
        {
          title: 'Dimostrato sul PDF generato',
          text: "I test rileggono il codice dai pixel della pagina che PDF.js disegna a partire dal PDF prodotto, e lo decodificano con ZXing: gli esempi dell'EPC byte per byte, con il livello di correzione M, e ogni esempio di questa pagina fino all'importo che stampa.",
        },
      ],
    },
    samples: {
      heading: 'Esempi: una fattura in euro da Germania, Austria, Francia, Italia, Spagna, Paesi Bassi e Irlanda',
      intro: (date) =>
        `L'esempio tedesco è il modello iniziale Euro invoice dello Studio e fattura la manutenzione di una caldaia a gas. Gli altri vendono ricambi per il riscaldamento a un privato, ciascuno da un'azienda inventata del suo paese e all'aliquota IVA ordinaria del suo paese, come la indicava la tabella del portale Your Europe dell'UE il ${date}; vendono ricambi invece della manutenzione perché in diversi di questi paesi i lavori in un'abitazione possono essere tassati a un'aliquota ridotta. Importi e date sono come il runtime li formatta per le impostazioni locali dell'esempio (de-DE, de-AT, fr-FR, it-IT, es-ES, nl-NL o en-IE), e l'esempio austriaco porta la cornice austriaca. Uno script ha disegnato ogni immagine dal PDF prodotto dal renderer.`,
      accounts: (date) =>
        `Le aziende e i loro clienti sono inventati. Ogni conto ha cifre di controllo corrette. I codici bancari dei conti di Germania, Austria, Francia, Spagna e Paesi Bassi non sono di nessuna banca nei registri di questi paesi, consultati il ${date}. I registri dell'Italia e dell'Irlanda non si sono potuti leggere: il conto italiano è formato con l'ABI 00000 e quello irlandese con il codice banca FMNC e il sort code 000000, e di loro non si dice altro.`,
      record: 'La decisione 0028 cita la fonte di ogni aliquota e di ogni registro, con il suo indirizzo (in inglese).',
    },
    tryIt: {
      heading: 'Provarlo',
      text: (version) =>
        `Nello Studio, l'esempio tedesco è il modello iniziale Euro invoice: sceglietelo sotto Starter, e l'anteprima mostra il PDF con il suo QR code SEPA, così come l'ha prodotto il renderer. I builder dello Studio sono in inglese, e nella loro palette il codice si chiama EPC payment code. La guida introduttiva installa ${version}, la versione più recente, che stampa un report con un QR code SEPA. La documentazione su GitHub, in inglese, spiega come un report porta il suo codice e come il renderer lo disegna.`,
      links: {
        studio: 'Aprire lo Studio',
        spec: 'Il QR code SEPA nel formato dei report (report-spec, in inglese)',
        renderer: 'Come il renderer disegna il codice e la cornice austriaca (report-render-pdf, in inglese)',
        decision: 'Decisione 0025: perché il codice è verificato e stampato così (in inglese)',
        guide: 'Leggere la guida introduttiva (in inglese)',
      },
    },
    limits: {
      heading: 'Che cosa non fa',
      items: [
        'Genera la fattura, niente di più: Formancy Report non è né un servizio di home banking né un software di contabilità, non invia fatture e non riconcilia i pagamenti ricevuti.',
        "Solo il bonifico SEPA in euro: nessun bonifico istantaneo, nessun'altra valuta, e come riferimento strutturato solo la Creditor Reference secondo ISO 11649. Una comunicazione strutturata belga va nel testo, che una banca non legge come riferimento.",
        "L'importo non indica alcuna valuta: niente verifica che il modello gli dia un valore in euro.",
        'Il BIC è richiesto solo per un conto fuori dal SEE. La banca di chi paga fuori dal SEE, in Svizzera per esempio, può averne bisogno comunque; il campo BIC vuoto dei builder lo dice.',
        "Dove sta il codice lo decide il modello: il margine inferiore della pagina che chiede la PSA, il formato non lo può fissare, e un codice nel piè di pagina si stampa su ogni pagina. La cornice è un'opzione, e un codice senza cornice non è misurato sulle larghezze dei moduli della PSA.",
        'Niente obbliga un modello a stampare i dati accanto al codice; gli esempi lo fanno.',
        "Il PDF non è una fattura elettronica: né XRechnung, né ZUGFeRD, né Factur-X, né FatturaPA, e gli esempi di questa pagina non ne portano alcuna. Formancy Report disegna il rendering finale di un report che porta una fattura elettronica come fattura ZUGFeRD o Factur-X nel profilo EN 16931, un PDF/A-3b che incorpora il suo XML, solo per la Germania (la Francia non è coperta); veraPDF, Mustang e il validatore della KoSIT giudicano gli esempi tedeschi del suo codice sorgente. Dove un paese esige la fattura elettronica, il PDF ne è al massimo una copia, come dice l'esempio italiano con la dicitura Copia di cortesia.",
        'Gli esempi non sono una consulenza fiscale: le loro aliquote sono quelle ordinarie del giorno in cui sono state lette, e nessuno ha verificato che un esempio porti tutto ciò che il diritto della fatturazione del suo paese richiede.',
        "Nessuna app bancaria ha ancora scansionato questi codici: i test leggono il codice con ZXing dal disegno di PDF.js, e nessuno è ancora stato stampato. Le linee guida dell'EPC sono solo una raccomandazione, e una banca non è tenuta a leggere un codice.",
      ],
      qrBill: 'Per una fattura in franchi o in euro verso un conto in Svizzera o nel Liechtenstein: la fattura QR',
    },
    status: {
      heading: 'Stato',
      text: (version, date) => `Nella versione ${version}, la più recente, nel codice sorgente su GitHub e online nello Studio (stato al ${date}).`,
      licence: "Formancy Report è source-available: il codice sorgente è pubblico, e l'uso in produzione richiede una licenza a pagamento.",
      terms: 'Le condizioni, sulla pagina del prodotto',
    },
  },
  // Not reviewed by a native speaker.
  en: {
    meta: {
      title: 'EPC QR codes (SEPA) on PDF invoices – Formancy Report',
      description: "PDF invoices with an EPC QR code for the SEPA credit transfer, made from your own data, checked against the EPC's rules, and self-hosted.",
      name: 'EPC QR code',
    },
    teaser: {
      heading: 'EPC QR codes',
      text: "Euro invoices with the QR code from which a banking app fills in a SEPA credit transfer: the IBAN, the BIC, the reference and every text checked against the EPC's rules before the PDF is made, an amount computed exactly from the invoice's values, and samples from Germany, Austria, France, Italy, Spain, the Netherlands and Ireland.",
      action: 'EPC QR codes with Formancy Report',
    },
    eyebrow: 'Formancy Report for the EPC QR code',
    h1: "EPC QR codes on your invoices, checked against the EPC's rules",
    lead: "Formancy Report prints on your PDF invoices the QR code, often called a SEPA QR code, from which a banking app fills in a SEPA credit transfer, as the European Payments Council defines it in EPC069-12. Your application hands over the data; before the PDF is made, the IBAN, the BIC, the reference and every text are checked against the EPC's rules, and the amount is computed exactly from the invoice's values, in the samples its total.",
    standing: 'The EPC QR code can be tried online in the Studio, and is in the newest release.',
    actions: { studio: 'Try it in the Studio (the Euro invoice starter)', samples: 'See the samples' },
    does: {
      heading: 'What it does',
      cards: [
        {
          title: "The EPC's rules, in one place",
          text: "The IBAN, the BIC, the reference and every text are checked against EPC069-12, the EPC's guidelines: an IBAN of a SEPA country, of that country's length and with its check digits right, never a QR-IBAN; a BIC of the account's country, asked for where the account is outside the EEA; as a structured reference, an ISO 11649 creditor reference and no other; each text no longer than the EPC allows, with no control character or line break; and all of it in 331 bytes at most in UTF-8. The same checks hold what the report says and what the data brings.",
        },
        {
          title: 'Refused before the PDF, on its field',
          text: "An IBAN whose check digits or length are wrong, or of a country outside SEPA, is refused when the report is validated, on its field and naming the rule it breaks, and both builders show it there. What comes from the data is checked by the runtime under the same rules before the PDF is made. No message quotes the value itself: never a name, an account or a reference. A typo that still fits the check digits, or another account's valid IBAN, passes.",
        },
        {
          title: 'The amount, exact to the cent',
          text: "The amount is an expression over the report's values; in the samples, the invoice's total: computed exactly, and written as short as it can be, as Payment Services Austria (PSA) asks. An amount with more than two decimals is refused, not rounded. A code without an amount leaves it to the payer.",
        },
        {
          title: 'Beside the details it holds',
          text: "Each sample prints the beneficiary, the IBAN, the BIC, the amount and the reference beside its code, for the use EPC069-12 describes: the payer sees the transfer's details as text at the same time. The renderer's tests decode the code and read each of those details back beside it on the page.",
        },
        {
          title: "Austria's frame, where asked",
          text: 'Where asked, the code wears the frame the PSA sets out, with “Zahlen mit Code” up its right side, read from bottom to top, and modules of 0.381 to 0.508 mm, as the PSA asks. The Austrian sample wears it.',
        },
        {
          title: 'Proved on the PDF it produced',
          text: "The tests read the code back from the pixels of the page PDF.js draws from the PDF produced, and decode it with ZXing: the EPC's own examples byte for byte, at error correction level M, and every sample on this page down to the amount it prints.",
        },
      ],
    },
    samples: {
      heading: 'Samples: one invoice in euro from Germany, Austria, France, Italy, Spain, the Netherlands and Ireland',
      intro: (date) =>
        `The German sample is the Studio's Euro invoice starter, and bills a gas boiler's maintenance. The others sell heating parts to a private customer, each from an invented firm of its country and at its country's standard VAT rate, as the EU's Your Europe table gave it on ${date}; they sell parts rather than maintenance because work on a home can be taxed at a reduced rate in several of these countries. Their amounts and dates are as the runtime formats them for the sample's locale, de-DE, de-AT, fr-FR, it-IT, es-ES, nl-NL or en-IE, and the Austrian one wears Austria's frame. A script drew each picture from the PDF the renderer produced.`,
      accounts: (date) =>
        `The firms and their customers are invented. Every account's check digits are right. No bank in the registers of Germany, Austria, France, Spain and the Netherlands, read on ${date}, has the bank code of those countries' accounts. Italy's and Ireland's registers could not be read: the Italian account is made with the ABI 00000 and the Irish with the bank code FMNC and the sort code 000000, and nothing more is said of them.`,
      record: 'Decision 0028 cites the source of each rate and register, with its address.',
    },
    tryIt: {
      heading: 'Try it',
      text: (version) =>
        `In the Studio, the German sample is the Euro invoice starter: choose it under Starter, and the preview shows the PDF with its EPC QR code as the renderer produced it. The Studio's builders are in English, and their palette calls the code EPC payment code. The getting-started guide installs ${version}, the newest release, which prints a report with an EPC QR code. The documentation on GitHub says how a report carries its code, and how the renderer draws it.`,
      links: {
        studio: 'Open the Studio',
        spec: 'The EPC QR code in the report format (report-spec)',
        renderer: "How the renderer draws the code and Austria's frame (report-render-pdf)",
        decision: 'Decision 0025: why the code is checked and printed as it is',
        guide: 'Read the getting-started guide',
      },
    },
    limits: {
      heading: 'What it does not do',
      items: [
        'It makes the invoice, and nothing more: Formancy Report is neither e-banking nor accounting software, sends no invoices and matches no incoming payments.',
        'The SEPA credit transfer in euro, and nothing else: no instant transfer, no other currency, and as a structured reference only an ISO 11649 creditor reference. A Belgian structured communication goes in the text, which a bank does not read as a reference.',
        'The amount carries no currency: nothing checks that the template gives it a value in euro.',
        "The BIC is asked for only where the account is outside the EEA. A payer's bank outside the EEA, in Switzerland say, may need it all the same; the builders' empty BIC field says so.",
        "Where the code stands is the template's choice: the foot of the page the PSA asks for is not one the format can pin, and a code in the page footer prints on every page. The frame is an option, and a code without it is not held to the PSA's module widths.",
        'Nothing makes a template print the details beside the code; the samples do.',
        "The PDF is no e-invoice: no XRechnung, ZUGFeRD, Factur-X or FatturaPA, and the samples on this page carry none. Formancy Report draws the final render of a report that carries an e-invoice as a ZUGFeRD or Factur-X invoice in the EN 16931 profile, a PDF/A-3b that embeds its XML, for Germany alone (France is not covered); veraPDF, Mustang and KoSIT's validator judge the German samples in its source code. Where a country requires e-invoices, the PDF is at most a copy, as the Italian sample says with its notice Copia di cortesia.",
        "The samples are no tax advice: their rates are the standard rates of the day they were read, and nobody checked that a sample carries everything its country's invoicing law asks.",
        "No banking app has scanned these codes yet: the tests read the code with ZXing from PDF.js's drawing, and none has been printed. The EPC's guidelines are informative only, and a bank need not read a code at all.",
      ],
      qrBill: 'For an invoice in francs or euro to an account in Switzerland or Liechtenstein: the Swiss QR-bill',
    },
    status: {
      heading: 'Status',
      text: (version, date) => `In ${version}, the newest release, in the source on GitHub and online in the Studio (as of ${date}).`,
      licence: 'Formancy Report is source-available: the source is public, and running it in production needs a paid licence.',
      terms: 'The terms, on the product page',
    },
  },
}
