/**
 * The editor's words about a model, in Swiss German, a message for every
 * one text-model-en.ts has (0086). Switzerland writes ss, never a sharp s,
 * and quotes with guillemets.
 */
import type { ModelCatalogue } from './text-en.js'

export const MODEL_DE_CH: ModelCatalogue = {
  'translation.ask': 'Ein Modell nach den fehlenden Wörtern fragen: {count}',
  'translation.stop': 'Fragen anhalten',
  'translation.heading': '{language}: die Übersetzung eines Modells, zu prüfende Wörter: {count}',
  'translation.where': 'Wo es steht',
  'translation.accepted': 'Angenommen',
  'translation.acceptOne': '«{text}» für «{source}» annehmen',
  'translation.acceptAll': 'Alle annehmen',
  'translation.apply': 'Die angenommenen Wörter übernehmen: {count}',
  'translation.discard': 'Verwerfen',
  'translation.reviewAgain': 'Erneut prüfen',
  'translation.quoted': '«{text}»',
  'history.translate': 'Wörter auf {language} übersetzen: {count}',

  'translation.status.asking': 'Ein Modell wird nach den Wörtern gefragt, die {language} fehlen, und seine Antwort geprüft.',
  'translation.status.elsewhereAsking': 'Ein Modell übersetzt gerade auf {language}. Wählen Sie {language}, um es zu verfolgen oder anzuhalten.',
  'translation.status.elsewhereHeld':
    'Die Übersetzung eines Modells auf {language} wartet auf Prüfung. Wählen Sie {language}, um sie zu prüfen. Nichts wurde übernommen.',
  'translation.status.removed': '{language} wurde aus dem Bericht entfernt, mitsamt der Übersetzung eines Modells darauf. Nichts wurde übernommen.',
  'translation.status.stale':
    'Nicht übernommen: Der Bericht hat sich geändert, seit das Modell geantwortet hat. Prüfen Sie erneut, um seine Antwort am Bericht zu lesen, wie er jetzt ist.',
  'translation.status.notApplied': 'Nicht übernommen: {reason}',
  'translation.status.ready': 'Zu prüfende Wörter: {count}. Nichts wurde übernommen.',
  'translation.status.stillMissing': 'Mit allen übernommen, weiterhin fehlende Wörter: {count}.',
  'translation.status.none': 'Das Modell hat kein Wort übersetzt. Nichts wurde übernommen.',
  'translation.status.noneHeld':
    'Das Modell hat Wörter geschrieben, und keines davon lässt sich übernehmen: Jedes steht unten, mit dem Grund. Nichts wurde übernommen.',
  'translation.status.nothingAsked': 'Nichts wurde gefragt: Kein Wort, das {language} fehlt, darf ein Modell gefragt werden, wie unten steht.',
  'translation.status.stopped': 'Angehalten. Nichts wurde übernommen.',
  'translation.status.unreachable': 'Nichts wurde übernommen. Das Modell war nicht erreichbar: {reason}',
  'translation.status.unreachableNoReason': 'Nichts wurde übernommen. Das Modell war nicht erreichbar.',
  'translation.status.busy': 'Nichts wurde übernommen. Das Modell beantwortet eine andere Anfrage: Schliessen Sie sie zuerst ab oder halten Sie sie an.',
  'translation.status.declined': 'Nichts wurde übernommen. Das Modell hat abgelehnt und den Grund genannt: {reason}',
  'translation.status.gaveUp': 'Nichts wurde übernommen. Versuche: {count}, und die Antwort war noch immer keine Übersetzung auf {language}.',
  'translation.status.tooLarge':
    'Nichts wurde gefragt. Die Anfrage hätte {bytes} Bytes, mehr als die {max}, die eine Anfrage haben darf: Schreiben Sie zuerst einige der Wörter.',

  'translation.refused': 'Abgelehnt, «{text}» für «{source}»: {reason}',
  'translation.dropped.notAsked': 'Nicht geschrieben, weil niemand danach gefragt hat: {list}',
  'translation.dropped.writtenMeanwhile': 'Nicht geschrieben, weil eine Person sie inzwischen geschrieben hat: {list}',
  'translation.dropped.gone': 'Nicht geschrieben, weil der Bericht sie nicht mehr druckt: {list}',
  'translation.dropped.printsNoWords': 'Nicht geschrieben, weil der Ausdruck keine Wörter mehr druckt: {list}',
  'translation.dropped.forPerson': 'Nicht geschrieben, weil sie jetzt im Zahlteil stehen, von einer Person zu schreiben: {list}',
  'translation.dropped.noRoom': 'Nicht geschrieben, weil {language} keinen Platz mehr für sie hat: {list}',
  'translation.forPerson': 'Von einer Person zu schreiben, weil sie im Zahlteil stehen: {list}',
  'translation.later': 'Für einen weiteren Lauf gelassen, sobald diese übernommen sind, Wörter: {count}',
  'translation.unasked': 'In diesem Lauf nicht gefragt, Wörter: {count}',
  'translation.noRoom.word': '{language} enthält so viele Wörter, wie eine Sprache darf, {max}: Weitere werden erst gefragt, wenn einige entfernt sind.',
  'translation.noRoom.expression':
    '{language} enthält so viele Ausdrücke, wie eine Sprache darf, {max}: Weitere werden erst gefragt, wenn einige entfernt sind.',
  'translation.leftEmpty': 'Vom Modell unübersetzt gelassen, Wörter: {count}',

  'translation.noModel': 'Diesem Editor wurde kein Modell gegeben, das er fragen kann.',
  'translation.ownLanguage':
    'Die eigenen Wörter des Berichts werden dort geschrieben, wo sie stehen: Wählen Sie eine andere seiner Sprachen, um ein Modell nach ihren Wörtern zu fragen.',
  'translation.lacksNothing': '{language} fehlt kein Wort.',
  'translation.waiting': 'Ein Modell übersetzt noch auf {language}: Halten Sie es an, oder warten Sie auf seine Antwort.',
  'translation.held': 'Die Übersetzung eines Modells auf {language} wartet auf Prüfung: Übernehmen oder verwerfen Sie sie zuerst.',
  'translation.notWaiting': 'Kein Modell wird gefragt.',
  'translation.nothingHeld': 'Hier wird keine Übersetzung eines Modells gehalten.',
  'translation.nothingAccepted': 'Noch nichts ist angenommen: Nehmen Sie ein Wort an, um es zu übernehmen.',
  'translation.applied': 'Auf {language} übersetzt, Wörter: {count}. Weiterhin fehlende Wörter: {missing}.',
  'translation.appliedAll': 'Auf {language} übersetzt, Wörter: {count}. Jetzt fehlt kein Wort mehr.',
  'translation.discarded': 'Die Übersetzung eines Modells auf {language} verworfen. Nichts wurde übernommen.',
  'translation.forgotten': 'Der Lauf wurde verworfen, bevor das Modell antwortete, und nichts von seiner Antwort wird gehalten.',
}
