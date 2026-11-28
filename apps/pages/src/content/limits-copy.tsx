/**
 * What Formancy Report does not do yet, in each language: the start page's
 * list of the absences a reader meets first, each said as an absence
 * today and never as a plan, true of the newest release and of main when
 * it was read, which `intro` says, dated by START_STATUS's `asOf`, and a
 * clause about what main holds and no release has published yet saying
 * so, as `ai` says it of report-ai and report-mcp; and a
 * link to the roadmap, which says what comes next and is not restated
 * here. A file of its own because the absences change as what they name
 * is built, a reason to change of their own.
 * limits.test.ts holds `data`, `formats`, `codes`, `scripts`, `viewer`,
 * `jobs` and `ai` to the code they rest on -- the packages published and what
 * their manifests install, report-spec's component kinds and the blocks it
 * prints -- so that a change there fails until the sentence is read again;
 * `detail` (report-spec's one list of detail rows, grouped by one field at
 * most) is review's, and START_STATUS sends each release back to every
 * item. The German is Switzerland's spelling, the French takes its
 * no-break spaces from `frenchSpaces`, and no translation is reviewed by a
 * native speaker.
 * Reviewed by a person, not a test, for meaning; the suite holds what can
 * be measured (checks/).
 */
import type { Language } from '../languages.js'
import type { LimitKey } from './product.js'

export interface LimitsCopy {
  readonly heading: string
  /** What the list is true of, and since when: `date` is START_STATUS's `asOf`, as the page's language writes it. */
  readonly intro: (date: string) => string
  /** Each absence by its key, printed in the order `LIMIT_ORDER` gives in every language. */
  readonly items: Readonly<Record<LimitKey, string>>
  /** The link's words, to docs/roadmap.md, which is in English. */
  readonly roadmap: string
}

export const LIMITS_COPY: Readonly<Record<Language, LimitsCopy>> = {
  de: {
    heading: 'Was es noch nicht tut',
    intro: (date) => `Jeder dieser Punkte gilt für das neueste Release und für den Quellcode auf GitHub (Stand ${date}).`,
    items: {
      detail:
        'Eine Liste von Detailzeilen, gruppiert nach höchstens einem Feld: Ein Bericht liest eine Liste von Detailzeilen, und seine Tabellen drucken nur Zeilen dieser Liste, jede nach einem Feld oder gar nicht gruppiert.',
      data: 'Kein konsistentes Lesen aus Formancy Data: Die Daten eines Berichts werden nach bestem Bemühen (best-effort) gelesen, der Kopf, die Zeilen Anfrage für Anfrage und jede Bezeichnung zu verschiedenen Zeitpunkten, und eine Summe kann verschiedene Datenstände mischen. Im neuesten Release, das Data 0.1.0 liest, kann eine Zeile, die zwischen zwei Anfragen hinzukommt oder wegfällt, doppelt oder gar nicht gedruckt werden. Im Quellcode auf GitHub, der Data 0.5.0 liest, noch in keinem Release, kann eine Zeile, die zwischen zwei Anfragen in der Reihenfolge an einen anderen Platz rückt, fehlen, und ist sie die letzte Zeile einer Anfrage, so können alle Zeilen zwischen ihrem alten und ihrem neuen Platz fehlen; eine Zeile, die doppelt gedruckt würde, führt stattdessen dazu, dass der Bericht abgelehnt wird, ausser Data nennt sie ohne Token oder eine andere Anwendung hat ihren Schlüssel zwischen zwei Anfragen geändert.',
      formats:
        'Kein Excel, CSV oder HTML: Ein Bericht wird als PDF gedruckt oder als Word-Datei geschrieben; nichts schreibt seine Tabellen als Arbeitsmappe oder als Text, und nichts den Bericht als Webseite.',
      codes:
        'Keine Codes ausser QR-Codes: Ein Bericht druckt QR-Codes, EPC-QR-Codes und den Swiss QR Code einer QR-Rechnung, aber keine andere Art von Barcode.',
      scripts:
        'Nur lateinische, griechische und kyrillische Schrift, mit ihren Satz- und Sonderzeichen: Jede andere Schrift wird abgelehnt, darunter Arabisch, Hebräisch, Devanagari, Thai, Chinesisch und Japanisch.',
      viewer:
        'Kein veröffentlichter PDF-Viewer: Der Viewer, in dem das Studio seine Vorschau zeichnet, steckt in keinem Paket, das Formancy Report veröffentlicht; Ihre Anwendung zeigt ein PDF in einem eigenen Viewer.',
      jobs: 'Keine Render-Jobs: Formancy Report erzeugt kein PDF für Ihre Anwendung auf einem eigenen Server; Ihre Anwendung ruft für jedes PDF den Renderer auf, auf Ihrem Server oder im Browser.',
      ai: 'Keine in Worten beschriebenen Änderungen in den Buildern: Keiner der beiden Builder lässt eine Person eine Änderung an einem Bericht in Worten beschreiben, damit eine KI sie vorschlägt. Im Quellcode auf GitHub, noch in keinem Release, fragt report-ai eine KI nur nach den Wörtern, die einer Sprache eines Berichts fehlen, und ein Coding-Agent, den Sie mitbringen, arbeitet über report-mcp an einer Vorlage, ausserhalb der Builder.',
    },
    roadmap: 'Die Roadmap lesen (Englisch)',
  },
  fr: {
    heading: "Ce qu'il ne fait pas encore",
    intro: (date) => `Chacun de ces points vaut pour la version la plus récente et pour le code source sur GitHub (état au ${date}).`,
    items: {
      detail:
        "Une liste de lignes de détail, regroupée selon un champ au plus : un rapport lit une liste de lignes de détail, et ses tableaux n'impriment que des lignes de cette liste, chacun regroupé selon un champ ou pas du tout.",
      data: "Pas de lecture cohérente depuis Formancy Data : les données d'un rapport y sont lues en mode best-effort, l'en-tête, les lignes requête après requête et chaque libellé à des moments différents, et un total peut mêler des états différents. Dans la version la plus récente, qui lit Data 0.1.0, une ligne ajoutée ou supprimée entre deux requêtes peut être imprimée deux fois ou pas du tout. Dans le code source sur GitHub, qui lit Data 0.5.0, mais encore dans aucune version publiée, une ligne qui change de place dans l'ordre entre deux requêtes peut manquer, et si c'est la dernière ligne d'une requête, toutes les lignes entre son ancienne place et la nouvelle peuvent manquer ; une ligne qui serait imprimée deux fois fait refuser le rapport, sauf si Data ne la nomme par aucun jeton ou si une autre application a changé sa clé entre deux requêtes.",
      formats:
        "Ni Excel, ni CSV, ni HTML : un rapport est imprimé en PDF ou écrit en fichier Word ; rien n'écrit ses tableaux sous forme de classeur ou de texte, ni le rapport sous forme de page web.",
      codes:
        "Pas d'autres codes que les QR codes : un rapport imprime des QR codes, des QR codes SEPA et le Swiss QR Code d'une facture QR, mais aucun autre type de code-barres.",
      scripts:
        "Les écritures latine, grecque et cyrillique seulement, avec leur ponctuation et leurs symboles : toute autre écriture est refusée, dont l'arabe, l'hébreu, le devanagari, le thaï, le chinois et le japonais.",
      viewer:
        "Pas de visualiseur PDF publié : celui dans lequel le Studio dessine son aperçu ne fait partie d'aucun paquet que Formancy Report publie ; votre application affiche un PDF dans son propre visualiseur.",
      jobs: 'Pas de tâches de rendu : Formancy Report ne génère aucun PDF pour votre application sur un serveur qui lui soit propre ; votre application appelle le moteur de rendu pour chaque PDF, sur votre serveur ou dans le navigateur.',
      ai: "Pas de modifications décrites en mots dans les builders : aucun des deux builders ne laisse une personne décrire en mots une modification d'un rapport pour qu'une IA la propose. Dans le code source sur GitHub, mais encore dans aucune version publiée, report-ai n'interroge une IA que sur les mots qui manquent à une langue d'un rapport, et un agent de codage que vous apportez travaille sur un modèle via report-mcp, hors des builders.",
    },
    roadmap: 'Lire la feuille de route (en anglais)',
  },
  it: {
    heading: 'Che cosa non fa ancora',
    intro: (date) => `Ciascuno di questi punti vale per la versione più recente e per il codice sorgente su GitHub, in data ${date}.`,
    items: {
      detail:
        "Un elenco di righe di dettaglio, raggruppato al massimo per un campo: un report legge un elenco di righe di dettaglio, e le sue tabelle stampano solo righe di quell'elenco, ciascuna raggruppata per un campo o per nessuno.",
      data: "Nessuna lettura coerente da Formancy Data: i dati di un report vengono letti in modalità best-effort, l'intestazione, le righe una richiesta dopo l'altra e ogni etichetta in momenti diversi, e un totale può mescolare stati diversi. Nella versione più recente, che legge Data 0.1.0, una riga aggiunta o rimossa tra due richieste può essere stampata due volte o per niente. Nel codice sorgente su GitHub, che legge Data 0.5.0, e non ancora in alcuna versione, una riga che cambia posto nell'ordine tra due richieste può mancare, e se è l'ultima riga di una richiesta possono mancare tutte le righe tra il suo vecchio posto e il nuovo; una riga che verrebbe stampata due volte fa rifiutare il report, a meno che Data non la indichi senza token o che un'altra applicazione ne abbia cambiato la chiave tra due richieste.",
      formats:
        'Né Excel, né CSV, né HTML: un report viene stampato in PDF o scritto come file Word; niente scrive le sue tabelle come cartella di lavoro o come testo, né il report come pagina web.',
      codes:
        'Nessun codice se non i QR code: un report stampa QR code, QR code SEPA e lo Swiss QR Code di una fattura QR, ma nessun altro tipo di codice a barre.',
      scripts:
        "Solo le scritture latina, greca e cirillica, con la loro punteggiatura e i loro simboli: ogni altra scrittura viene rifiutata, tra cui l'arabo, l'ebraico, il devanagari, il thai, il cinese e il giapponese.",
      viewer:
        'Nessun visualizzatore PDF pubblicato: quello in cui lo Studio disegna la sua anteprima non fa parte di alcun pacchetto che Formancy Report pubblica; la vostra applicazione mostra un PDF in un visualizzatore proprio.',
      jobs: 'Nessun job di rendering: Formancy Report non genera alcun PDF per la vostra applicazione su un server proprio; la vostra applicazione chiama il renderer per ogni PDF, sul vostro server o nel browser.',
      ai: "Nessuna modifica descritta a parole nei builder: nessuno dei due builder fa descrivere a parole a una persona una modifica a un report perché un'IA la proponga. Nel codice sorgente su GitHub, e non ancora in alcuna versione, report-ai chiede a un'IA solo le parole che mancano a una lingua di un report, e un agente di programmazione che portate voi lavora su un modello tramite report-mcp, fuori dai builder.",
    },
    roadmap: 'Leggere la roadmap (in inglese)',
  },
  en: {
    heading: 'What it does not do yet',
    intro: (date) => `Each of these is true of the newest release and of the source on GitHub (as of ${date}).`,
    items: {
      detail:
        'One list of detail rows, grouped by one field at most: a report reads one list of detail rows, and its tables print rows of that list alone, each grouped by one field or by none.',
      data: "No consistent read from Formancy Data: a report's data is read from it best-effort, its header, its rows a request at a time and each label at different moments, and a total can mix states. In the newest release, which reads Data 0.1.0, a row added or removed between two requests can print twice or not at all. In the source on GitHub, which reads Data 0.5.0, and in no release yet, a row that moves in the order between two requests can be left out, and when it is the last row of a request, so can every row between its old place and its new; a row that would print twice refuses the report instead, unless Data names it by no token or another application changed its key between two requests.",
      formats:
        'No Excel, CSV or HTML: a report is printed as a PDF or written as a Word file, and nothing writes its tables as a workbook or as text, or the report as a web page.',
      codes: "No codes but QR codes: a report prints QR codes, EPC QR codes and a QR-bill's Swiss QR Code, but no other kind of barcode.",
      scripts:
        'Latin, Greek and Cyrillic only, with their punctuation and symbols: every other script is refused, Arabic, Hebrew, Devanagari, Thai, Chinese and Japanese among them.',
      viewer:
        'No published PDF viewer: the one the Studio draws its preview in is in no package Formancy Report publishes, and your application shows a PDF in a viewer of its own.',
      jobs: 'No render jobs: Formancy Report prints no PDF for your application on a server of its own; your application calls the renderer for each PDF, on your server or in the browser.',
      ai: "No changes described in words in the builders: neither builder has a person describe a change to a report in words for an AI to propose. In the source on GitHub, and in no release yet, report-ai asks an AI only for the words a report's language lacks, and a coding agent you bring works on a template through report-mcp, outside the builders.",
    },
    roadmap: 'Read the roadmap',
  },
}
