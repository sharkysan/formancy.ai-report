/**
 * The start page's exact totals, in each language: a section of the start
 * page, between the topics and how the product behaves, rather than a page
 * of its own. Every claim is one 0009 and 0010 make and the tests each card
 * names hold (`EVIDENCE`), and says no more than they show; the limits are
 * 0010's costs and 0027's, said plainly, the engine's locale data as 0024
 * says it of the samples, and running totals as an absence today. No amount
 * of money: the totals themselves print in the starters' pictures, which the
 * section links, and a number here carries no currency (checks/wording.ts).
 * French and Italian write a decimal with a comma, as the EPC QR code
 * page's copy does; German and English with a point; and 2^53 is written
 * as the runtime's message writes it. No code either: the guide is the
 * compiled one. The German is
 * Switzerland's spelling; no translation is reviewed by a native speaker.
 * Reviewed by a person, not a test, for meaning; the suite holds what can
 * be measured (checks/).
 */
import type { Language } from '../languages.js'
import type { Card, Evidence } from '../pages.js'

export interface TotalsCopy {
  readonly heading: string
  readonly intro: string
  readonly cards: readonly Card[]
  /** The link's words, to the starters' pictures, `#examples`, which print the totals. */
  readonly examples: string
  readonly limits: { readonly heading: string; readonly items: readonly string[] }
}

/**
 * The tests each card of the section rests on, one list a card, which the
 * card shares in every language (checks/evidence.ts).
 */
const EVIDENCE = {
  // A decimal read as the string of its digits, its scale kept, and refused
  // past the places its field declares; a decimal sent as a JavaScript
  // number refused, saying floats lose digits, and an integer past 2^53
  // sent as one; an integer of thirty digits, as a string, read with every
  // one.
  digits: ['packages/report-runtime/src/values.test.ts'],
  // 0.1 + 0.2 exactly 0.3; each rounding mode, and rounding to a step of
  // 0.05, against a BigInt reference; an average the exact quotient rounded
  // once, as declared; and each group's subtotal and the report's total
  // rounded once, each from its own exact sum.
  sums: ['packages/report-runtime/src/decimal.test.ts', 'packages/report-runtime/src/totals.test.ts'],
  // A double literal, a call to double() and every division found where
  // each is written, and refused there by the diagnostics the editor shows,
  // exact division and a remainder accepted; and a format that prints a
  // rounded total at fewer places than its rounding keeps refused.
  refused: ['packages/report-core/src/diagnostics/diagnose.test.ts', 'packages/report-core/src/expressions/exactness.test.ts'],
  // Intl handed a decimal's exact digits, twenty places printed whole; a
  // format's fewer places rounded half away from zero before Intl sees the
  // value, and Intl handed exactly the places it prints; and without a
  // format, a decimal's digits printed as they are, as format.test.ts shows in de-CH.
  printed: ['packages/report-runtime/src/format.test.ts'],
  // The starters and the invoice samples rendered and read back with
  // PDF.js, each total recomputed in plain BigInt from the data and
  // formatted with Intl, the page printing exactly that; and each QR-bill's
  // and EPC QR code's amount, decoded by ZXing from the page's pixels, the
  // total the page prints. The e-invoice starter is among the e-invoice
  // samples: its XML's amounts recomputed in BigInt from its data, its page
  // printing what the XML holds, and its EPC QR code, decoded from the
  // pixels, asking for the amount due.
  proved: [
    'packages/report-render-pdf/src/starters.test.ts',
    'packages/report-render-pdf/src/samples.test.ts',
    'packages/report-render-pdf/src/euro-samples.test.ts',
    'packages/report-render-pdf/src/e-invoice-samples.test.ts',
  ],
} satisfies Record<string, Evidence>

export const TOTALS_COPY: Readonly<Record<Language, TotalsCopy>> = {
  de: {
    heading: 'Exakte Summen',
    intro:
      'Von den Daten bis zur gedruckten Seite wird eine Summe aus exakten Ziffern berechnet und höchstens einmal gerundet: wie der Bericht es festlegt oder sonst durch das Format, das sie druckt.',
    cards: [
      {
        title: 'Jede Dezimalzahl als ihre Ziffern',
        text: 'Eine Dezimalzahl wird als String ihrer Ziffern übergeben, mit nicht mehr Nachkommastellen, als ihr Feld festlegt. Als JavaScript-Zahl wird sie abgelehnt, denn eine Gleitkommazahl kann schon Ziffern verloren haben, und ebenso eine ganze Zahl über 2^53 als JavaScript-Zahl; als String behält eine ganze Zahl jede Ziffer.',
        evidence: EVIDENCE.digits,
      },
      {
        title: 'Summen und Mittelwerte, exakt',
        text: 'Summen und Mittelwerte werden aus den exakten Ziffern berechnet: 0.1 + 0.2 ergibt 0.3. Eine Rundung, die der Bericht festlegt, wird einmal auf die Zwischensumme jeder Gruppe und einmal auf die Summe des Berichts angewendet, jede aus ihrer eigenen exakten Summe: kaufmännisch oder zur geraden Ziffer, und wo festgelegt auf einen Schritt wie 0.05.',
        evidence: EVIDENCE.sums,
      },
      {
        title: 'Abgelehnt, wo es steht',
        text: 'Die Prüfungen des Editors lehnen ab, jeweils dort, wo es steht: eine Gleitkommazahl, das Divisionszeichen, das bei ganzen Zahlen den Rest verwirft, und ein Format, das eine gerundete Summe mit weniger Nachkommastellen, als sie behält, drucken und sie so ein zweites Mal runden würde.',
        evidence: EVIDENCE.refused,
      },
      {
        title: 'Gedruckt aus den exakten Ziffern',
        text: 'Eine Zahl, die ein Format zeigt, wird dem Intl der JavaScript-Engine als ihre exakten Ziffern übergeben, nie als JavaScript-Zahl, und für Sprache und Region des Berichts gedruckt; ohne Format druckt sie ihre exakten Ziffern, wie sie sind. Zeigt ein Format weniger Nachkommastellen, als eine Zahl hat, rundet die Laufzeit sie zuvor kaufmännisch, und Intl rundet nichts.',
        evidence: EVIDENCE.printed,
      },
      {
        title: 'Am erzeugten PDF bewiesen',
        text: 'Die Tests lesen die PDFs zurück, die die Startvorlagen und die Beispielrechnungen drucken, berechnen deren Summen unabhängig von der Laufzeit mit BigInt aus den Daten neu und verlangen, dass die Seite genau diese druckt. Der Betrag, den die QR-Rechnung oder der EPC-QR-Code einer Rechnung verlangt, aus den Pixeln der Seite decodiert, ist die Summe, die die Seite druckt.',
        evidence: EVIDENCE.proved,
      },
    ],
    examples: 'Die Summen ansehen, die die Startvorlagen drucken',
    limits: {
      heading: 'Was die Summen nicht leisten',
      items: [
        'Gerundete Zwischensummen ergeben zusammen nicht unbedingt die gerundete Summe: Jede wird einmal gerundet, aus ihrer eigenen exakten Summe.',
        'Ein Ausdruck dividiert nur mit einer Funktion, die die Nachkommastellen ihres Ergebnisses nennt; das Divisionszeichen und Gleitkommazahlen werden abgelehnt, wo sie stehen.',
        'Die Umsatzsteuer einer E-Rechnung wird je Kategorie berechnet und einmal gerundet, nie je Zeile: Ein ERP, das die Steuer jeder Zeile rundet, kann um bis zu einen halben Cent pro Zeile davon abweichen.',
        'Wie eine Zahl geschrieben wird, mit welchen Trennzeichen und in welchen Gruppen, bestimmen die Locale-Daten der JavaScript-Engine: Zwei Engines können dieselbe Summe verschieden drucken.',
        'Keine laufenden Summen: Keine Zwischensumme wird von einer Seite auf die nächste übertragen.',
      ],
    },
  },
  fr: {
    heading: 'Des totaux exacts',
    intro:
      "Des données à la page imprimée, un total est calculé à partir de chiffres exacts et arrondi au plus une fois : comme le rapport le déclare, ou sinon par le format qui l'imprime.",
    cards: [
      {
        title: 'Chaque nombre décimal par ses chiffres',
        text: "Un nombre décimal circule sous forme de chaîne de ses chiffres, sans plus de décimales que son champ n'en déclare. Envoyé comme nombre JavaScript, il est refusé, car un nombre à virgule flottante peut avoir déjà perdu des chiffres, et un entier au-delà de 2^53 envoyé ainsi l'est aussi ; sous forme de chaîne, un entier garde tous ses chiffres.",
        evidence: EVIDENCE.digits,
      },
      {
        title: 'Sommes et moyennes exactes',
        text: "Les sommes et les moyennes sont calculées à partir des chiffres exacts : 0,1 + 0,2 donne 0,3. Un arrondi que le rapport déclare s'applique une seule fois au sous-total de chaque groupe et une seule fois au total du rapport, chacun à partir de sa propre somme exacte : commercial ou au pair, et là où il est déclaré, à un pas tel que 0,05.",
        evidence: EVIDENCE.sums,
      },
      {
        title: "Refusé là où c'est écrit",
        text: "Les vérifications de l'éditeur refusent, là où chacun est écrit, un nombre à virgule flottante, le signe de division, qui sur des entiers abandonne le reste, et un format qui imprimerait un total arrondi avec moins de décimales qu'il n'en garde, l'arrondissant une seconde fois.",
        evidence: EVIDENCE.refused,
      },
      {
        title: 'Imprimé à partir des chiffres exacts',
        text: "Un nombre qu'un format affiche est remis à l'Intl du moteur JavaScript sous forme de ses chiffres exacts, jamais comme nombre JavaScript, et imprimé selon la langue et la région du rapport ; sans format, il imprime ses chiffres exacts tels quels. Quand un format montre moins de décimales qu'un nombre n'en a, le runtime l'arrondit d'abord selon l'arrondi commercial, et Intl n'arrondit rien.",
        evidence: EVIDENCE.printed,
      },
      {
        title: 'Prouvé sur le PDF produit',
        text: "Les tests relisent les PDF qu'impriment les modèles de départ et les factures d'exemple, recalculent leurs totaux à partir des données en BigInt, indépendamment du runtime, et exigent que la page imprime exactement ces totaux. Le montant que demande la facture QR ou le QR code SEPA d'une facture, décodé à partir des pixels de la page, est le total qu'elle imprime.",
        evidence: EVIDENCE.proved,
      },
    ],
    examples: "Voir les totaux qu'impriment les modèles de départ",
    limits: {
      heading: 'Ce que les totaux ne font pas',
      items: [
        'Les sous-totaux arrondis, additionnés, ne donnent pas forcément le total arrondi : chacun est arrondi une seule fois, à partir de sa propre somme exacte.',
        "Une expression ne divise qu'au moyen d'une fonction qui indique les décimales que garde son résultat ; le signe de division et les nombres à virgule flottante sont refusés là où ils sont écrits.",
        "La TVA d'une facture électronique est calculée par catégorie et arrondie une seule fois, jamais par ligne : un ERP qui arrondit la TVA de chaque ligne peut s'en écarter d'un demi-centime au plus par ligne.",
        "La façon d'écrire un nombre, ses séparateurs et ses groupes de chiffres, relève des données régionales du moteur JavaScript : deux moteurs peuvent imprimer le même total différemment.",
        "Pas de totaux cumulés : aucun sous-total n'est reporté d'une page à la suivante.",
      ],
    },
  },
  it: {
    heading: 'Totali esatti',
    intro:
      'Dai dati alla pagina stampata, un totale è calcolato da cifre esatte e arrotondato al massimo una volta: come il report lo dichiara, oppure dal formato che lo stampa.',
    cards: [
      {
        title: 'Ogni decimale con le sue cifre',
        text: 'Un decimale circola come stringa delle sue cifre, con non più decimali di quanti ne dichiara il suo campo. Inviato come numero JavaScript viene rifiutato, perché un numero in virgola mobile può aver già perso cifre, e così un intero oltre 2^53 inviato allo stesso modo; come stringa, un intero conserva ogni cifra.',
        evidence: EVIDENCE.digits,
      },
      {
        title: 'Somme e medie esatte',
        text: 'Somme e medie sono calcolate dalle cifre esatte: 0,1 + 0,2 fa 0,3. Un arrotondamento che il report dichiara si applica una sola volta al subtotale di ogni gruppo e una sola volta al totale del report, ciascuno dalla propria somma esatta: commerciale o al pari, e dove dichiarato a un passo come 0,05.',
        evidence: EVIDENCE.sums,
      },
      {
        title: 'Rifiutato dove è scritto',
        text: "I controlli dell'editor rifiutano, dove ciascuno è scritto, un numero in virgola mobile, il segno di divisione, che sugli interi scarta il resto, e un formato che stamperebbe un totale arrotondato con meno decimali di quanti ne conserva, arrotondandolo una seconda volta.",
        evidence: EVIDENCE.refused,
      },
      {
        title: 'Stampato dalle cifre esatte',
        text: "Un numero che un formato mostra è passato all'Intl del motore JavaScript come le sue cifre esatte, mai come numero JavaScript, e stampato per la lingua e la regione del report; senza formato, stampa le sue cifre esatte così come sono. Dove un formato mostra meno decimali di quanti ne ha un numero, il runtime lo arrotonda prima con l'arrotondamento commerciale, e Intl non arrotonda nulla.",
        evidence: EVIDENCE.printed,
      },
      {
        title: 'Dimostrato sul PDF generato',
        text: "I test rileggono i PDF che stampano i modelli iniziali e le fatture d'esempio, ne ricalcolano i totali dai dati in BigInt, indipendentemente dal runtime, ed esigono che la pagina stampi esattamente quei totali. L'importo che chiede la fattura QR o il QR code SEPA di una fattura, decodificato dai pixel della pagina, è il totale che la pagina stampa.",
        evidence: EVIDENCE.proved,
      },
    ],
    examples: 'Vedere i totali che stampano i modelli iniziali',
    limits: {
      heading: 'Che cosa i totali non fanno',
      items: [
        'I subtotali arrotondati, sommati, non danno per forza il totale arrotondato: ciascuno è arrotondato una sola volta, dalla propria somma esatta.',
        "Un'espressione divide solo con una funzione che indica i decimali che il suo risultato conserva; il segno di divisione e i numeri in virgola mobile vengono rifiutati dove sono scritti.",
        "L'IVA di una fattura elettronica è calcolata per categoria e arrotondata una sola volta, mai per riga: un ERP che arrotonda l'IVA di ogni riga può scostarsene fino a mezzo centesimo per riga.",
        'Il modo di scrivere un numero, i suoi separatori e il raggruppamento delle cifre, dipende dai dati locali del motore JavaScript: due motori possono stampare lo stesso totale in modo diverso.',
        'Nessun totale progressivo: nessun subtotale viene riportato da una pagina alla successiva.',
      ],
    },
  },
  en: {
    heading: 'Totals that are exact',
    intro:
      'From the data to the printed page, a total is computed from exact digits and rounded at most once: as the report declares, or else by the format that prints it.',
    cards: [
      {
        title: 'Each decimal as its digits',
        text: 'A decimal travels as a string of its digits, with no more places than its field declares. One sent as a JavaScript number is refused, since a float may already have lost digits, and so is an integer past 2^53 sent as one; as a string, an integer keeps every digit.',
        evidence: EVIDENCE.digits,
      },
      {
        title: 'Sums and averages, exact',
        text: "Sums and averages are computed from the exact digits: 0.1 + 0.2 is 0.3. A rounding the report declares is applied once to each group's subtotal and once to the report's total, each from its own exact sum: half away from zero or half to even, and where declared to a step such as 0.05.",
        evidence: EVIDENCE.sums,
      },
      {
        title: 'Refused where it is written',
        text: "The editor's checks refuse, where each is written, a floating-point number, the division sign, which on integers drops the remainder, and a format that would print a rounded total at fewer places than it keeps, rounding it a second time.",
        evidence: EVIDENCE.refused,
      },
      {
        title: 'Printed from the exact digits',
        text: "A number a format shows is handed to the JavaScript engine's Intl as its exact digits, never as a JavaScript number, and printed for the report's language and region; without a format, it prints its exact digits as they are. Where a format shows fewer places than a number has, the runtime rounds it half away from zero first, and Intl rounds nothing.",
        evidence: EVIDENCE.printed,
      },
      {
        title: 'Proved on the PDF it produced',
        text: "The tests read back the PDFs the starters and the invoice samples print, recompute their totals from the data in BigInt, apart from the runtime, and require the page to print exactly those. The amount an invoice's QR-bill or EPC QR code asks for, decoded from the page's pixels, is the total the page prints.",
        evidence: EVIDENCE.proved,
      },
    ],
    examples: 'See the totals the starters print',
    limits: {
      heading: 'What the totals do not do',
      items: [
        'Rounded subtotals need not add up to the rounded total: each is rounded once, from its own exact sum.',
        'An expression divides only through a function that names the places its result keeps; the division sign and floating-point numbers are refused where they are written.',
        "An e-invoice's VAT is computed per category and rounded once, never per line: an ERP that rounds each line's VAT may differ from it by up to half a cent a line.",
        "How a number is written, its separators and its grouping, comes from the JavaScript engine's locale data: two engines may print the same total differently.",
        'No running totals: no subtotal is carried from one page to the next.',
      ],
    },
  },
}
