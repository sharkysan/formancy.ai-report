/**
 * What Formancy Report does not do yet, in each language: the start page's
 * list of the absences a reader meets first, each said as an absence
 * today and never as a plan, true of the newest release and of main when
 * it was read, and a link to the roadmap, which says what comes next and is
 * not restated here. A file of its own because the absences change as
 * what they name is built, a reason to change of their own.
 * limits.test.ts holds `pdf`, `codes`, `scripts`, `viewer` and `ai` to
 * the code they rest on -- the packages published, report-spec's component
 * kinds and the scripts it refuses -- so that a change there fails until
 * the sentence is read again; `detail` (report-spec's one detail table and
 * one level of grouping), `data` (0016's best-effort read, said as its
 * costs say it) and `jobs` (no PDF printed on a server of Report's own)
 * are review's. The German is Switzerland's spelling, the French
 * takes its no-break spaces from `frenchSpaces`, and no translation is
 * reviewed by a native speaker. Reviewed by a person, not a test, for
 * meaning; the suite holds what can be measured (checks/).
 */
import type { Language } from '../languages.js'
import type { LimitKey } from './product.js'

export interface LimitsCopy {
  readonly heading: string
  /** Each absence by its key, printed in the order `LIMIT_ORDER` gives in every language. */
  readonly items: Readonly<Record<LimitKey, string>>
  /** The link's words, to docs/roadmap.md, which is in English. */
  readonly roadmap: string
}

export const LIMITS_COPY: Readonly<Record<Language, LimitsCopy>> = {
  de: {
    heading: 'Was es noch nicht tut',
    items: {
      detail:
        'Eine Detailtabelle und eine Gruppierungsebene: Ein Bericht liest eine Liste von Detailzeilen, druckt sie in einer Tabelle und gruppiert sie nach höchstens einem Feld.',
      data: 'Kein konsistentes Lesen aus Formancy Data: Die Daten eines Berichts werden nach bestem Bemühen (best-effort) gelesen, der Kopf, die Zeilen Anfrage für Anfrage und jede Bezeichnung zu verschiedenen Zeitpunkten; eine Zeile, die zwischen zwei Anfragen hinzukommt oder wegfällt, kann doppelt oder gar nicht gedruckt werden.',
      pdf: 'Nur PDF: Der Renderer druckt einen Bericht als PDF und in keinem anderen Format.',
      codes:
        'Keine Codes ausser QR-Codes: Ein Bericht druckt QR-Codes, EPC-QR-Codes und den Swiss QR Code einer QR-Rechnung, aber keine andere Art von Barcode.',
      scripts:
        'Nur lateinische, griechische und kyrillische Schrift, mit ihren Satz- und Sonderzeichen: Jede andere Schrift wird abgelehnt, darunter Arabisch, Hebräisch, Devanagari, Thai, Chinesisch und Japanisch.',
      viewer:
        'Kein veröffentlichter PDF-Viewer: Der Viewer, in dem das Studio seine Vorschau zeichnet, steckt in keinem Paket auf npm; Ihre Anwendung zeigt ein PDF in einem eigenen Viewer.',
      jobs: 'Keine Render-Jobs: Formancy Report erzeugt kein PDF auf einem eigenen Server; Ihre Anwendung ruft für jedes PDF den Renderer auf, auf Ihrem Server oder im Browser.',
      ai: 'Keine Änderungsvorschläge einer KI: Kein veröffentlichtes Paket lässt eine KI Änderungen an einem Bericht vorschlagen, die eine Person prüft, bevor sie gelten.',
    },
    roadmap: 'Die Roadmap lesen (Englisch)',
  },
  fr: {
    heading: "Ce qu'il ne fait pas encore",
    items: {
      detail:
        "Un tableau de détail et un niveau de regroupement : un rapport lit une liste de lignes de détail, l'imprime dans un tableau et la regroupe selon un champ au plus.",
      data: "Pas de lecture cohérente depuis Formancy Data : les données d'un rapport y sont lues en mode best-effort, l'en-tête, les lignes requête après requête et chaque libellé à des moments différents ; une ligne ajoutée ou supprimée entre deux requêtes peut être imprimée deux fois ou pas du tout.",
      pdf: "PDF uniquement : le moteur de rendu n'imprime un rapport qu'en PDF.",
      codes:
        "Pas d'autres codes que les QR codes : un rapport imprime des QR codes, des QR codes SEPA et le Swiss QR Code d'une facture QR, mais aucun autre type de code-barres.",
      scripts:
        "Les écritures latine, grecque et cyrillique seulement, avec leur ponctuation et leurs symboles : toute autre écriture est refusée, dont l'arabe, l'hébreu, le devanagari, le thaï, le chinois et le japonais.",
      viewer:
        "Pas de visualiseur PDF publié : celui dans lequel le Studio dessine son aperçu ne fait partie d'aucun paquet sur npm ; votre application affiche un PDF dans son propre visualiseur.",
      jobs: 'Pas de tâches de rendu : Formancy Report ne génère aucun PDF sur un serveur qui lui soit propre ; votre application appelle le moteur de rendu pour chaque PDF, sur votre serveur ou dans le navigateur.',
      ai: "Pas de modifications proposées par une IA : aucun paquet publié ne laisse une IA proposer des modifications d'un rapport qu'une personne revoit avant qu'elles s'appliquent.",
    },
    roadmap: 'Lire la feuille de route (en anglais)',
  },
  it: {
    heading: 'Che cosa non fa ancora',
    items: {
      detail:
        'Una tabella di dettaglio e un livello di raggruppamento: un report legge un elenco di righe di dettaglio, lo stampa in una tabella e lo raggruppa al massimo per un campo.',
      data: "Nessuna lettura coerente da Formancy Data: i dati di un report vengono letti in modalità best-effort, l'intestazione, le righe una richiesta dopo l'altra e ogni etichetta in momenti diversi; una riga aggiunta o rimossa tra due richieste può essere stampata due volte o per niente.",
      pdf: 'Solo PDF: il renderer non stampa un report in nessun altro formato.',
      codes:
        'Nessun codice se non i QR code: un report stampa QR code, QR code SEPA e lo Swiss QR Code di una fattura QR, ma nessun altro tipo di codice a barre.',
      scripts:
        "Solo le scritture latina, greca e cirillica, con la loro punteggiatura e i loro simboli: ogni altra scrittura viene rifiutata, tra cui l'arabo, l'ebraico, il devanagari, il thai, il cinese e il giapponese.",
      viewer:
        'Nessun visualizzatore PDF pubblicato: quello in cui lo Studio disegna la sua anteprima non fa parte di alcun pacchetto su npm; la vostra applicazione mostra un PDF in un visualizzatore proprio.',
      jobs: 'Nessun job di rendering: Formancy Report non genera alcun PDF su un server proprio; la vostra applicazione chiama il renderer per ogni PDF, sul vostro server o nel browser.',
      ai: "Nessuna modifica proposta da un'IA: nessun pacchetto pubblicato fa proporre a un'IA modifiche a un report, verificate da una persona prima di essere applicate.",
    },
    roadmap: 'Leggere la roadmap (in inglese)',
  },
  en: {
    heading: 'What it does not do yet',
    items: {
      detail: 'One detail table and one level of grouping: a report reads one list of detail rows, prints it in one table, and groups it by one field at most.',
      data: "No consistent read from Formancy Data: a report's data is read from it best-effort, its header, its rows a request at a time and each label at different moments, so a row added or removed between two requests can print twice or not at all.",
      pdf: 'PDF only: the renderer prints a report as a PDF and in no other format.',
      codes: "No codes but QR codes: a report prints QR codes, EPC QR codes and a QR-bill's Swiss QR Code, but no other kind of barcode.",
      scripts:
        'Latin, Greek and Cyrillic only, with their punctuation and symbols: every other script is refused, Arabic, Hebrew, Devanagari, Thai, Chinese and Japanese among them.',
      viewer:
        'No published PDF viewer: the one the Studio draws its preview in is in no package on npm, and your application shows a PDF in a viewer of its own.',
      jobs: 'No render jobs: Formancy Report prints no PDF on a server of its own; your application calls the renderer for each PDF, on your server or in the browser.',
      ai: 'No changes proposed by an AI: no published package has an AI propose changes to a report for a person to review before they apply.',
    },
    roadmap: 'Read the roadmap',
  },
}
