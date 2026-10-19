/**
 * The QR-bill page's words, in each language (0024). Every claim is one
 * decision 0022 makes and its tests hold, or one SIX's guidelines make, and
 * says no more than it: what the checks refuse and what they do not see,
 * where the slip prints, what the tests decode, and, from 0022's costs and
 * the guidelines (IG 2.4, 3.3 and 3.7), what it does not do. The release
 * the status names is read from the changelog and handed in, never typed.
 * SIX's words are SIX's: Zahlteil, section paiement, sezione pagamento,
 * payment part, and the bill itself where a sentence names SIX's
 * guidelines and in the eyebrow, QR-facture and QR-fattura (IG, Annex C,
 * Table 24); the titles' are Switzerland's, facture QR, fattura QR. A
 * Studio word the page names, the starter "Invoice" under "Starter", is
 * the Studio's picker's, which nothing here reads (0024). Reviewed by a
 * person, not a test, for meaning; the suite holds what can be measured
 * (checks/).
 */
import type { Language } from '../languages.js'
import type { PageMeta, Teaser } from '../pages.js'

export interface QrBillCopy {
  readonly meta: PageMeta
  /** What the product page says of the page; `unreleased` follows its text there. */
  readonly teaser: Teaser
  readonly eyebrow: string
  readonly h1: string
  readonly lead: string
  /** Where the bill stands, in a sentence: said in the hero and after the teaser, where a reader decides to try it. */
  readonly unreleased: string
  readonly actions: { readonly studio: string; readonly samples: string }
  readonly does: { readonly heading: string; readonly cards: readonly { readonly title: string; readonly text: string }[] }
  readonly samples: { readonly heading: string; readonly intro: string }
  readonly tryIt: {
    readonly heading: string
    /** How to try it: `version` is the changelog's newest release, which the getting-started guide installs. */
    readonly text: (version: string) => string
    readonly links: { readonly studio: string; readonly spec: string; readonly renderer: string; readonly decision: string; readonly guide: string }
  }
  readonly limits: {
    readonly heading: string
    readonly items: readonly string[]
    /** The link's words, after the limits, to the EPC QR code page: for a reader whose invoice is paid by a SEPA transfer in euro (0028). */
    readonly epc: string
  }
  readonly status: {
    readonly heading: string
    /** Where the QR-bill stands: `version` is the changelog's newest release, `date` the day it was last said. */
    readonly text: (version: string, date: string) => string
    readonly licence: string
    /** The link's words, to the product page's licence. */
    readonly terms: string
  }
}

export const QR_BILL_COPY: Readonly<Record<Language, QrBillCopy>> = {
  de: {
    meta: {
      title: 'QR-Rechnungen als PDF aus Ihren Daten – Formancy Report',
      description: 'QR-Rechnungen als PDF aus Ihren eigenen Daten erstellen, in Ihrer Anwendung auf dem Server oder im Browser, nach den Regeln von SIX geprüft, selbst gehostet.',
      name: 'QR-Rechnung',
    },
    teaser: {
      heading: 'QR-Rechnungen',
      text: 'Rechnungen mit QR-Zahlteil aus Ihren eigenen Daten: nach den Regeln von SIX geprüft, bevor das PDF entsteht, mit einem Betrag, der exakt aus den Werten der Rechnung berechnet wird, und mit Beispielen auf Deutsch, Französisch, Italienisch und Englisch.',
      action: 'QR-Rechnungen mit Formancy Report',
    },
    eyebrow: 'Formancy Report für die QR-Rechnung',
    h1: 'QR-Rechnungen aus Ihren eigenen Daten, geprüft nach den Regeln von SIX',
    lead: 'Formancy Report erzeugt Ihre Rechnungen als PDF, mit Empfangsschein und Zahlteil, oft QR-Einzahlungsschein genannt, am Fuss der letzten Seite, wie SIX sie vorgibt. Ihre Anwendung übergibt die Daten; bevor das PDF entsteht, werden Konto, Referenz und jeder Text nach den Regeln von SIX geprüft, und der Betrag wird exakt aus den Werten der Rechnung berechnet, in den Beispielen ihr Total.',
    unreleased: 'Die QR-Rechnung ist online im Studio zu sehen und im neuesten Release enthalten.',
    actions: { studio: 'Im Studio ausprobieren (Startvorlage Invoice)', samples: 'Die Beispiele ansehen' },
    does: {
      heading: 'Was es kann',
      cards: [
        {
          title: 'Die Regeln von SIX, an einem Ort',
          text: 'Konto, Referenz und jeder Text werden nach den Implementation Guidelines von SIX für die QR-Rechnung geprüft, Versionen 2.3 und 2.4: eine IBAN oder QR-IBAN aus der Schweiz oder Liechtenstein, eine QR-Referenz oder Creditor Reference, jede mit ihren Prüfziffern, die Zeichen und Längen, die jedes Feld zulässt, und welches Konto zu welcher Referenz und Währung passt. Dieselben Prüfungen gelten für das, was im Bericht steht, und für das, was aus den Daten kommt.',
        },
        {
          title: 'Ein Tippfehler fällt vor dem PDF auf',
          text: 'Eine falsch eingegebene IBAN wird schon bei der Validierung des Berichts abgelehnt, bevor etwas gerendert wird, mit dem Feld und der verletzten Regel. Kommt ein Text aus den Daten, prüft ihn die Laufzeit nach denselben Regeln, bevor das PDF entsteht. Keine Meldung nennt den Wert selbst, also nie einen Namen, eine Adresse oder ein Konto.',
        },
        {
          title: 'Der Betrag, auf den Rappen genau',
          text: 'Der Betrag der QR-Rechnung ist ein Ausdruck über die Werte des Berichts, in der Beispielrechnung ihr Total: exakt berechnet, einmal auf den Rappen gerundet und nie als JavaScript-Zahl weitergegeben. Ein Betrag, der nicht auf den Rappen genau ist, wird abgelehnt, nicht gerundet. Ohne Betrag druckt der Zahlteil das leere Feld, in das die zahlende Person ihn schreibt.',
        },
        {
          title: 'Das Layout von SIX, am Fuss der letzten Seite',
          text: 'Empfangsschein und Zahlteil haben die Grösse und Lage, die SIX vorschreibt, über die ganze Breite am Fuss der letzten A4-Seite, oder auf einer eigenen Seite, wenn auf der letzten kein Platz mehr ist. Der Swiss QR Code trägt das Schweizerkreuz, und die Linien zum Abtrennen tragen die Schere oder den Hinweis, vor der Einzahlung abzutrennen. Empfangsschein und Zahlteil werden in Liberation Sans gedruckt, einer der Schriften, die SIX zulässt; der Renderer bringt sie mit.',
        },
        {
          title: 'Am erzeugten PDF bewiesen',
          text: 'Die Tests lesen den Code aus den Pixeln der Seite zurück, die PDF.js aus dem erzeugten PDF zeichnet, und decodieren ihn mit ZXing: die Beispiele von SIX Byte für Byte, die Beispielrechnungen bis zum Betrag, den sie drucken. Jede Überschrift und jeder Wert des Zahlteils wird dort zurückgelesen, wo SIX ihn hinsetzt.',
        },
        {
          title: 'In der Sprache der Rechnung',
          text: 'Die Überschriften des Zahlteils sind die Begriffe von SIX, auf Deutsch, Französisch, Italienisch, Rätoromanisch oder Englisch, und der Zahlteil kann in einer anderen Sprache stehen als die Rechnung.',
        },
      ],
    },
    samples: {
      heading: 'Beispiele: eine Rechnung auf Deutsch, Französisch, Italienisch und Englisch',
      intro: 'Jedes Beispiel verrechnet dieselbe Arbeit, in den Worten seiner Sprache, mit Beträgen und Datumsangaben, wie die Laufzeit sie für seine Locale formatiert (de-CH, fr-CH, it-CH oder en-CH), und mit dem Zahlteil in seiner Sprache. Ein Skript hat jedes Bild aus dem PDF gezeichnet, das der Renderer erzeugt hat. Die Firmen und ihre Kundschaft sind erfunden, und das Konto ist die Beispiel-QR-IBAN von SIX, die keine Bank führt.',
    },
    tryIt: {
      heading: 'Ausprobieren',
      text: (version) =>
        `Im Studio ist das deutsche Beispiel die Startvorlage Invoice: Wählen Sie sie unter Starter, und die Vorschau zeigt das PDF mit seinem Zahlteil, so wie der Renderer es erzeugt hat. Die Einführung installiert ${version}, das neueste Release, das einen Bericht mit Zahlteil druckt. Wie ein Bericht seine QR-Rechnung trägt und warum der Zahlteil so gedruckt wird, beschreibt die Dokumentation auf GitHub, auf Englisch.`,
      links: {
        studio: 'Das Studio öffnen',
        spec: 'Die QR-Rechnung im Berichtsformat (report-spec, Englisch)',
        renderer: 'Wie der Renderer den Zahlteil zeichnet (report-render-pdf, Englisch)',
        decision: 'Entscheid 0022: warum der Zahlteil so gedruckt wird (Englisch)',
        guide: 'Die Einführung lesen (Englisch)',
      },
    },
    limits: {
      heading: 'Was es nicht tut',
      items: [
        'Es erzeugt die Rechnung, mehr nicht: Formancy Report ist weder E-Banking noch Buchhaltungssoftware, verschickt keine Rechnungen und gleicht keine Zahlungseingänge ab.',
        'Nach den Richtlinien von SIX ist eine Rechnung als PDF für die Zahlung per E-Banking oder Mobile Banking gedacht; darum tragen ihre Linien die Schere und den Hinweis zum Abtrennen. Eine QR-Rechnung, die auf Papier verschickt wird, gehört auf weisses, perforiertes Papier, und das kann Formancy Report nicht prüfen.',
        'Eine QR-Rechnung pro Bericht, am Fuss seiner letzten Seite, im A4-Hochformat. Ein Bericht, der mehrere Rechnungen druckt, kann nicht jeder ihren eigenen Zahlteil geben.',
        'Die beiden Builder bearbeiten die QR-Rechnung noch nicht: Die Entwurfsansicht zeigt, wo der Zahlteil gedruckt wird, und Konto, Referenz, Adressen und Betrag stehen in der Definition des Berichts.',
        'Nicht jede Regel von SIX wird geprüft: ob es einen Ländercode wirklich gibt, was in den Rechnungsinformationen nach «//» folgt, ob eine Postleitzahl das Länderpräfix trägt, das SIX verbietet, und ob das Konto dem Zahlungsempfänger gehört.',
        'Keine alternativen Verfahren und keine Rechnung «NICHT ZUR ZAHLUNG VERWENDEN». Eine Rechnung in Euro an eine QR-IBAN mit QR-Referenz wird abgelehnt, wie es Version 2.4 verlangt.',
        'Text wird nie verkleinert, damit er passt: Angaben, die nicht in ihren Abschnitt passen, werden abgelehnt.',
        'Noch keine Banking-App hat diese Rechnungen gescannt: Die Tests lesen den Code mit ZXing aus der Zeichnung von PDF.js, und auf Papier gedruckt wurde noch kein Zahlteil.',
      ],
      // Not reviewed by a native speaker, as the rest of this page's German (0028).
      epc: 'Für eine SEPA-Überweisung in Euro: der EPC-QR-Code',
    },
    status: {
      heading: 'Stand',
      text: (version, date) => `In ${version}, dem neuesten Release, im Quellcode auf GitHub und online im Studio (Stand ${date}).`,
      licence: 'Formancy Report ist source-available: Der Quellcode ist öffentlich, und für den Betrieb in Produktion braucht es eine kostenpflichtige Lizenz.',
      terms: 'Die Bedingungen auf der Produktseite',
    },
  },
  fr: {
    meta: {
      title: 'Factures QR en PDF à partir de vos données – Formancy Report',
      description: 'Créez des factures QR en PDF à partir de vos données, récépissé et section paiement vérifiés selon les règles de SIX, dans votre application, sur vos serveurs.',
      name: 'Facture QR',
    },
    teaser: {
      heading: 'Factures QR',
      text: "Des factures avec section paiement QR, générées à partir de vos propres données : vérifiées selon les règles de SIX avant que le PDF soit produit, avec un montant calculé de manière exacte à partir des valeurs de la facture, et des exemples en allemand, en français, en italien et en anglais.",
      action: 'Les factures QR avec Formancy Report',
    },
    eyebrow: 'Formancy Report pour la QR-facture',
    h1: 'Des factures QR à partir de vos propres données, vérifiées selon les règles de SIX',
    lead: "Formancy Report génère vos factures en PDF, avec le récépissé et la section paiement, souvent appelés bulletin de versement QR, au pied de la dernière page, comme SIX les définit. Votre application fournit les données ; avant que le PDF soit produit, le compte, la référence et chaque texte sont vérifiés selon les règles de SIX, et le montant est calculé de manière exacte à partir des valeurs de la facture, son total dans les exemples.",
    unreleased: 'La facture QR se découvre en ligne dans le Studio et figure dans la version la plus récente.',
    actions: { studio: "L'essayer dans le Studio (modèle de départ Invoice)", samples: 'Voir les exemples' },
    does: {
      heading: "Ce qu'il fait",
      cards: [
        {
          title: 'Les règles de SIX, en un seul endroit',
          text: "Le compte, la référence et chaque texte sont vérifiés selon les Implementation Guidelines suisses pour QR-facture de SIX, versions 2.3 et 2.4 : un IBAN ou un QR-IBAN suisse ou liechtensteinois, une référence QR ou une Creditor Reference, chacun avec ses chiffres de contrôle, les caractères et les longueurs que chaque champ admet, et quel compte va avec quelle référence et quelle monnaie. Les mêmes contrôles s'appliquent à ce que dit le rapport et à ce qu'apportent les données.",
        },
        {
          title: 'Une faute de frappe repérée avant le PDF',
          text: "Un IBAN mal saisi est refusé dès la validation du rapport, avant tout rendu, avec le champ et la règle enfreinte. Un texte qui vient des données est vérifié par le runtime selon les mêmes règles, avant que le PDF soit produit. Aucun message ne cite la valeur elle-même : jamais un nom, une adresse ou un compte.",
        },
        {
          title: 'Le montant, exact au centime',
          text: "Le montant de la facture QR est une expression sur les valeurs du rapport ; dans la facture d'exemple, son total : calculé de manière exacte, arrondi une seule fois au centime, et jamais converti en nombre JavaScript. Un montant qui n'est pas exact au centime est refusé, pas arrondi. Sans montant, la section paiement imprime le champ vide que remplit la personne qui paie.",
        },
        {
          title: 'La mise en page de SIX, au pied de la dernière page',
          text: "Le récépissé et la section paiement ont la taille et la place que SIX prescrit, sur toute la largeur au pied de la dernière page A4, ou sur une page à part s'il ne reste plus de place sur la dernière. Le Swiss QR Code porte la croix suisse, et les lignes de découpe portent les ciseaux ou la consigne de détacher avant le versement. Le récépissé et la section paiement sont en Liberation Sans, l'une des polices que SIX admet, et le moteur de rendu la fournit.",
        },
        {
          title: 'Prouvé sur le PDF produit',
          text: "Les tests relisent le code dans les pixels de la page que PDF.js dessine à partir du PDF produit, et le décodent avec ZXing : les exemples de SIX octet par octet, les factures d'exemple jusqu'au montant qu'elles impriment. Chaque titre et chaque valeur de la section paiement sont relus là où SIX les place.",
        },
        {
          title: 'Dans la langue de la facture',
          text: 'Les titres de la section paiement sont les termes de SIX, en allemand, en français, en italien, en romanche ou en anglais, et la section paiement peut être dans une autre langue que la facture.',
        },
      ],
    },
    samples: {
      heading: 'Exemples : une facture en allemand, en français, en italien et en anglais',
      intro: "Chaque exemple facture le même travail avec les mots de sa langue, ses montants et ses dates tels que le runtime les formate pour ses paramètres régionaux (de-CH, fr-CH, it-CH ou en-CH), et sa section paiement dans sa langue. Un script a dessiné chaque image à partir du PDF produit par le moteur de rendu. Les entreprises et leurs clients sont inventés, et le compte est le QR-IBAN d'exemple de SIX, qu'aucune banque ne tient.",
    },
    tryIt: {
      heading: "L'essayer",
      text: (version) =>
        `Dans le Studio, l'exemple allemand est le modèle de départ Invoice : choisissez-le sous Starter, et l'aperçu montre le PDF avec sa section paiement, tel que le moteur de rendu l'a produit. Le guide de démarrage installe ${version}, la version la plus récente, qui imprime un rapport avec une section paiement. La documentation sur GitHub, en anglais, explique comment un rapport porte sa facture QR et pourquoi la section paiement est imprimée ainsi.`,
      links: {
        studio: 'Ouvrir le Studio',
        spec: 'La facture QR dans le format des rapports (report-spec, en anglais)',
        renderer: 'Comment le moteur de rendu dessine la section paiement (report-render-pdf, en anglais)',
        decision: 'Décision 0022 : pourquoi la section paiement est imprimée ainsi (en anglais)',
        guide: 'Lire le guide de démarrage (en anglais)',
      },
    },
    limits: {
      heading: "Ce qu'il ne fait pas",
      items: [
        "Il génère la facture, rien de plus : Formancy Report n'est ni un e-banking ni un logiciel de comptabilité, il n'envoie aucune facture et ne rapproche aucun paiement reçu.",
        "Selon les directives de SIX, une facture en PDF est destinée au paiement par e-banking ou mobile banking ; c'est pourquoi ses lignes portent les ciseaux et la consigne de détacher. Une QR-facture envoyée sur papier doit être imprimée sur du papier blanc perforé, ce que Formancy Report ne peut pas vérifier.",
        'Une facture QR par rapport, au pied de sa dernière page, en A4 portrait. Un rapport qui imprime plusieurs factures ne peut pas donner à chacune sa propre section paiement.',
        "Les deux builders ne modifient pas encore la facture QR : la vue de conception montre où s'imprime la section paiement, et le compte, la référence, les adresses et le montant s'écrivent dans la définition du rapport.",
        "Toutes les règles de SIX ne sont pas vérifiées : qu'un code pays existe vraiment, ce qui suit « // » dans les informations de facture, un code postal précédé du préfixe de son pays, que SIX interdit, et que le compte appartienne bien au créancier.",
        "Pas de procédures alternatives, ni de facture « NE PAS UTILISER POUR LE PAIEMENT ». Une facture en euros vers un QR-IBAN avec une référence QR est refusée, comme l'exige la version 2.4.",
        "Le texte n'est jamais réduit pour tenir : une information qui dépasse la hauteur de sa section est refusée.",
        "Aucune application bancaire n'a encore scanné ces factures : les tests lisent le code avec ZXing dans le dessin de PDF.js, et aucune section paiement n'a encore été imprimée sur papier.",
      ],
      // Not reviewed by a native speaker, as the rest of this page's French (0028).
      epc: 'Pour un virement SEPA en euros : le QR code SEPA',
    },
    status: {
      heading: 'État',
      text: (version, date) => `Dans la version ${version}, la plus récente, dans le code source sur GitHub et en ligne dans le Studio (état au ${date}).`,
      licence: "Formancy Report est source-available : le code source est public, et l'exploitation en production nécessite une licence payante.",
      terms: 'Les conditions, sur la page du produit',
    },
  },
  it: {
    meta: {
      title: 'Fatture QR in PDF dai vostri dati – Formancy Report',
      description: 'Generate fatture QR in PDF dai vostri dati, con ricevuta e sezione pagamento verificate secondo le regole di SIX, nella vostra applicazione, sui vostri server.',
      name: 'Fattura QR',
    },
    teaser: {
      heading: 'Fatture QR',
      text: 'Fatture con sezione pagamento QR, generate dai vostri dati: verificate secondo le regole di SIX prima che il PDF venga prodotto, con un importo calcolato in modo esatto dai valori della fattura, ed esempi in tedesco, francese, italiano e inglese.',
      action: 'Le fatture QR con Formancy Report',
    },
    eyebrow: 'Formancy Report per la QR-fattura',
    h1: 'Fatture QR dai vostri dati, verificate secondo le regole di SIX',
    lead: "Formancy Report genera le vostre fatture in PDF, con la ricevuta e la sezione pagamento, spesso chiamate polizza di versamento QR, in fondo all'ultima pagina, come le definisce SIX. La vostra applicazione fornisce i dati; prima che il PDF venga prodotto, il conto, il riferimento e ogni testo vengono verificati secondo le regole di SIX, e l'importo è calcolato in modo esatto dai valori della fattura, negli esempi il suo totale.",
    unreleased: 'La fattura QR si può vedere online nello Studio e fa parte della versione più recente.',
    actions: { studio: 'Provarlo nello Studio (modello iniziale Invoice)', samples: 'Vedere gli esempi' },
    does: {
      heading: 'Che cosa fa',
      cards: [
        {
          title: 'Le regole di SIX, in un solo posto',
          text: 'Il conto, il riferimento e ogni testo vengono verificati secondo le Implementation Guidelines di SIX per la QR-fattura, versioni 2.3 e 2.4: un IBAN o un QR-IBAN svizzero o del Liechtenstein, un riferimento QR o una Creditor Reference, ciascuno con le sue cifre di controllo, i caratteri e le lunghezze che ogni campo ammette, e quale conto va con quale riferimento e quale valuta. Gli stessi controlli valgono per ciò che dice il report e per ciò che portano i dati.',
        },
        {
          title: 'Un errore di battitura scoperto prima del PDF',
          text: 'Un IBAN digitato male viene rifiutato già alla validazione del report, prima di qualsiasi rendering, con il campo e la regola violata. Un testo che viene dai dati è verificato dal runtime secondo le stesse regole, prima che il PDF venga prodotto. Nessun messaggio cita il valore stesso: mai un nome, un indirizzo o un conto.',
        },
        {
          title: "L'importo, esatto al centesimo",
          text: "L'importo della fattura QR è un'espressione sui valori del report; nella fattura d'esempio, il suo totale: calcolato in modo esatto, arrotondato una sola volta al centesimo, e mai convertito in un numero JavaScript. Un importo che non è esatto al centesimo viene rifiutato, non arrotondato. Senza importo, la sezione pagamento stampa il campo vuoto che compila chi paga.",
        },
        {
          title: "L'impaginazione di SIX, in fondo all'ultima pagina",
          text: "La ricevuta e la sezione pagamento hanno la dimensione e la posizione che SIX prescrive, su tutta la larghezza in fondo all'ultima pagina A4, o su una pagina propria se nell'ultima non c'è più posto. Lo Swiss QR Code porta la croce svizzera, e le linee da tagliare portano le forbici o l'indicazione di staccare prima del versamento. La ricevuta e la sezione pagamento sono in Liberation Sans, uno dei caratteri che SIX ammette, e il renderer lo fornisce.",
        },
        {
          title: 'Dimostrato sul PDF generato',
          text: "I test rileggono il codice dai pixel della pagina che PDF.js disegna a partire dal PDF prodotto, e lo decodificano con ZXing: gli esempi di SIX byte per byte, le fatture d'esempio fino all'importo che stampano. Ogni titolo e ogni valore della sezione pagamento viene riletto là dove SIX lo colloca.",
        },
        {
          title: 'Nella lingua della fattura',
          text: 'I titoli della sezione pagamento sono i termini di SIX, in tedesco, francese, italiano, romancio o inglese, e la sezione pagamento può essere in una lingua diversa da quella della fattura.',
        },
      ],
    },
    samples: {
      heading: 'Esempi: una fattura in tedesco, francese, italiano e inglese',
      intro: "Ogni esempio fattura lo stesso lavoro con le parole della sua lingua, con importi e date come il runtime li formatta per le sue impostazioni locali (de-CH, fr-CH, it-CH o en-CH), e con la sezione pagamento nella sua lingua. Uno script ha disegnato ogni immagine dal PDF prodotto dal renderer. Le aziende e i loro clienti sono inventati, e il conto è il QR-IBAN d'esempio di SIX, che nessuna banca gestisce.",
    },
    tryIt: {
      heading: 'Provarlo',
      text: (version) =>
        `Nello Studio, l'esempio tedesco è il modello iniziale Invoice: sceglietelo sotto Starter, e l'anteprima mostra il PDF con la sua sezione pagamento, così come l'ha prodotto il renderer. La guida introduttiva installa ${version}, la versione più recente, che stampa un report con una sezione pagamento. La documentazione su GitHub, in inglese, spiega come un report porta la sua fattura QR e perché la sezione pagamento è stampata così.`,
      links: {
        studio: 'Aprire lo Studio',
        spec: 'La fattura QR nel formato dei report (report-spec, in inglese)',
        renderer: 'Come il renderer disegna la sezione pagamento (report-render-pdf, in inglese)',
        decision: 'Decisione 0022: perché la sezione pagamento è stampata così (in inglese)',
        guide: 'Leggere la guida introduttiva (in inglese)',
      },
    },
    limits: {
      heading: 'Che cosa non fa',
      items: [
        'Genera la fattura, niente di più: Formancy Report non è né un e-banking né un software di contabilità, non invia fatture e non riconcilia i pagamenti ricevuti.',
        "Secondo le direttive di SIX, una fattura in PDF è destinata al pagamento tramite e-banking o mobile banking; per questo le sue linee portano le forbici e l'indicazione di staccare. Una QR-fattura spedita su carta va stampata su carta bianca perforata, cosa che Formancy Report non può verificare.",
        'Una fattura QR per report, in fondo alla sua ultima pagina, in A4 verticale. Un report che stampa più fatture non può dare a ciascuna la propria sezione pagamento.',
        'I due builder non modificano ancora la fattura QR: la vista di progettazione mostra dove si stampa la sezione pagamento, e conto, riferimento, indirizzi e importo si scrivono nella definizione del report.',
        'Non tutte le regole di SIX vengono verificate: che un codice paese esista davvero, ciò che segue «//» nelle informazioni per la fattura, un codice postale preceduto dal prefisso del suo paese, che SIX vieta, e che il conto appartenga davvero al creditore.',
        'Nessuna procedura alternativa, e nessuna fattura «NON UTILIZZARE PER IL PAGAMENTO». Una fattura in euro verso un QR-IBAN con un riferimento QR viene rifiutata, come richiede la versione 2.4.',
        "Il testo non viene mai rimpicciolito: un'informazione che non sta nella sua sezione viene rifiutata.",
        'Nessuna app bancaria ha ancora scansionato queste fatture: i test leggono il codice con ZXing dal disegno di PDF.js, e nessuna sezione pagamento è ancora stata stampata su carta.',
      ],
      // Not reviewed by a native speaker, as the rest of this page's Italian (0028).
      epc: 'Per un bonifico SEPA in euro: il QR code SEPA',
    },
    status: {
      heading: 'Stato',
      text: (version, date) => `Nella versione ${version}, la più recente, nel codice sorgente su GitHub e online nello Studio (stato al ${date}).`,
      licence: "Formancy Report è source-available: il codice sorgente è pubblico, e l'uso in produzione richiede una licenza a pagamento.",
      terms: 'Le condizioni, sulla pagina del prodotto',
    },
  },
  en: {
    meta: {
      title: 'Swiss QR-bill PDFs from your own data – Formancy Report',
      description: "Create Swiss QR-bills as PDFs from your own data, in your own application, on the server or in the browser, checked against SIX's rules and self-hosted.",
      name: 'Swiss QR-bill',
    },
    teaser: {
      heading: 'Swiss QR-bills',
      text: "Invoices with a QR payment part, made from your own data: checked against SIX's rules before the PDF is made, with an amount computed exactly from the invoice's values, and samples in German, French, Italian and English.",
      action: 'Swiss QR-bills with Formancy Report',
    },
    eyebrow: 'Formancy Report for the Swiss QR-bill',
    h1: "Swiss QR-bills from your own data, checked against SIX's rules",
    lead: "Formancy Report renders your invoices as PDFs, with the receipt and the payment part, often called the QR payment slip, at the foot of the last page, as SIX lays them out. Your application hands over the data; before the PDF is made, the account, the reference and every text are checked against SIX's rules, and the amount is computed exactly from the invoice's values, in the samples its total.",
    unreleased: 'The QR-bill can be tried online in the Studio, and is in the newest release.',
    actions: { studio: 'Try it in the Studio (the Invoice starter)', samples: 'See the samples' },
    does: {
      heading: 'What it does',
      cards: [
        {
          title: "SIX's rules, in one place",
          text: "The account, the reference and every text are checked against SIX's Swiss Implementation Guidelines for the QR-bill, versions 2.3 and 2.4: an IBAN or QR-IBAN of Switzerland or Liechtenstein, a QR reference or a creditor reference, each with its check digits, the characters and lengths each field allows, and which account goes with which reference and currency. The same checks hold what the report says and what the data brings.",
        },
        {
          title: 'A typo caught before the PDF',
          text: 'A mistyped IBAN is refused when the report is validated, before anything renders, naming the field and the rule it breaks. A text that comes from the data is checked by the runtime under the same rules before the PDF is made. No message quotes the value itself: never a name, an address or an account.',
        },
        {
          title: 'The amount, exact to the centime',
          text: "The bill's amount is an expression over the report's values; in the sample invoice, its total: computed exactly, rounded once to the centime, and never passed through a JavaScript number. An amount that is not exact to the centime is refused, not rounded. A bill without an amount prints the blank field the payer fills in.",
        },
        {
          title: "SIX's layout, at the foot of the last page",
          text: 'The receipt and the payment part stand at the size and place SIX prescribes, across the foot of the last A4 page, or on a page of their own when the last one has no room left. The Swiss QR Code carries the Swiss cross, and the lines to cut along carry the scissors or the instruction to separate before paying in. The slip is set in Liberation Sans, one of the fonts SIX allows, which the renderer ships.',
        },
        {
          title: 'Proved on the PDF it produced',
          text: "The tests read the code back from the pixels of the page PDF.js draws from the PDF produced, and decode it with ZXing: SIX's own examples byte for byte, and the sample invoices down to the amount they print. Every heading and value of the slip is read back where SIX puts it.",
        },
        {
          title: "In the bill's language",
          text: "The slip's headings are SIX's own words, in German, French, Italian, Romansh or English, and the slip may be in a different language from the invoice.",
        },
      ],
    },
    samples: {
      heading: 'Samples: one invoice in German, French, Italian and English',
      intro: "Each sample bills the same work in its own language's words, with its amounts and dates as the runtime formats them for its locale, de-CH, fr-CH, it-CH or en-CH, and its payment part in its language. A script drew each picture from the PDF the renderer produced. The firms and their customers are invented, and the account is SIX's example QR-IBAN, which no bank holds.",
    },
    tryIt: {
      heading: 'Try it',
      text: (version) =>
        `In the Studio, the German sample is the Invoice starter: choose it under Starter, and the preview shows the PDF with its payment part as the renderer produced it. The getting-started guide installs ${version}, the newest release, which prints a report with a payment part. The documentation on GitHub says how a report carries its QR-bill, and why the slip is printed as it is.`,
      links: {
        studio: 'Open the Studio',
        spec: 'The QR-bill in the report format (report-spec)',
        renderer: 'How the renderer draws the slip (report-render-pdf)',
        decision: 'Decision 0022: why the slip is printed as it is',
        guide: 'Read the getting-started guide',
      },
    },
    limits: {
      heading: 'What it does not do',
      items: [
        'It makes the bill, and nothing more: Formancy Report is neither e-banking nor accounting software, sends no invoices and matches no incoming payments.',
        "Under SIX's guidelines, a bill as a PDF is for paying by e-banking or mobile banking, which is why its lines carry the scissors and the instruction to separate. A QR-bill sent on paper must be printed on white, perforated paper, which Formancy Report cannot check.",
        'One QR-bill per report, at the foot of its last page, on A4 in portrait. A report that prints several invoices cannot give each one a slip of its own.',
        "Neither builder edits the QR-bill yet: the design view shows where the slip prints, and the bill's account, reference, addresses and amount are written in the report's definition.",
        "Not every one of SIX's rules is checked: whether a country code is one that exists, what follows the “//” in the billing information, a postal code written with its country's prefix, which SIX forbids, and whether the account is the creditor's.",
        'No alternative procedures, and no bill marked “DO NOT USE FOR PAYMENT”. A bill in euros to a QR-IBAN with a QR reference is refused, as version 2.4 requires.',
        'Text is never shrunk to fit: information taller than its section is refused.',
        "No banking app has scanned these bills yet: the tests read the code with ZXing from PDF.js's drawing, and no slip has been printed on paper.",
      ],
      // Not reviewed by a native speaker, as the rest of this page's English (0028).
      epc: 'For a SEPA credit transfer in euro: the EPC QR code',
    },
    status: {
      heading: 'Status',
      text: (version, date) => `In ${version}, the newest release, in the source on GitHub and online in the Studio (as of ${date}).`,
      licence: 'Formancy Report is source-available: the source is public, and running it in production needs a paid licence.',
      terms: 'The terms, on the product page',
    },
  },
}
