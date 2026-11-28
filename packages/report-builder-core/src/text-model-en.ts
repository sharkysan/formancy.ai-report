/**
 * The editor's words about a model, in English: a model asked for the
 * words the language edited lacks, and its answer reviewed word by word
 * (0086). A part of text-en.ts's catalogue, in a file of its own because a
 * model's words change for reasons of their own. A count of words or of
 * attempts is said after a colon, as the catalogue's counts are, so that no
 * language needs a plural; a request's bytes and a list's bound, never one,
 * stand in their sentence. A quotation's marks are each language's own.
 */
export const MODEL_EN = {
  'translation.ask': 'Ask a model for the missing words: {count}',
  'translation.stop': 'Stop asking',
  'translation.heading': '{language}: a model’s translation, words to review: {count}',
  'translation.where': 'Where it stands',
  'translation.accepted': 'Accepted',
  'translation.acceptOne': 'Accept “{text}” for “{source}”',
  'translation.acceptAll': 'Accept all',
  'translation.apply': 'Apply the accepted words: {count}',
  'translation.discard': 'Discard',
  'translation.reviewAgain': 'Review again',
  'translation.quoted': '“{text}”',
  'history.translate': 'Translate words into {language}: {count}',

  // The part's own live region, in formancy.ai 0161's order: a run
  // waiting, an Apply refused, a run that ended without an answer, then
  // what is ready and what would still be missing.
  'translation.status.asking': 'Asking a model for the words {language} lacks, and checking its answer.',
  'translation.status.elsewhereAsking': 'A model is translating into {language}. Choose {language} to follow it, or to stop it.',
  'translation.status.elsewhereHeld': 'A model’s translation into {language} is waiting for review. Choose {language} to review it. Nothing has been applied.',
  'translation.status.removed': '{language} was removed from the report, and the model’s translation into it with it. Nothing has been applied.',
  'translation.status.stale': 'Not applied: the report has changed since the model answered. Review again to read its answer against the report as it is now.',
  'translation.status.notApplied': 'Not applied: {reason}',
  'translation.status.ready': 'Words ready to review: {count}. Nothing has been applied.',
  'translation.status.stillMissing': 'With all of them applied, words still missing: {count}.',
  'translation.status.none': 'The model left every word untranslated. Nothing has been applied.',
  'translation.status.noneHeld': 'The model wrote words, and none of them can be applied: each is listed below, with why. Nothing has been applied.',
  'translation.status.nothingAsked': 'Nothing was asked: no word {language} lacks is one a model may be asked for, as said below.',
  'translation.status.stopped': 'Stopped. Nothing has been applied.',
  'translation.status.unreachable': 'Nothing has been applied. The model could not be reached: {reason}',
  'translation.status.unreachableNoReason': 'Nothing has been applied. The model could not be reached.',
  'translation.status.busy': 'Nothing has been applied. The model is answering another request: finish or stop that one first.',
  'translation.status.declined': 'Nothing has been applied. The model declined, and said why: {reason}',
  'translation.status.gaveUp': 'Nothing has been applied. Attempts: {count}, and the answer was still no translation into {language}.',
  'translation.status.tooLarge': 'Nothing was asked. The request would be {bytes} bytes, past the {max} a request may have: write some of the words first.',

  // Under the table, outside the rows: each a sentence of its own.
  'translation.refused': 'Refused, “{text}” for “{source}”: {reason}',
  'translation.dropped.notAsked': 'Not written, because nobody asked for them: {list}',
  'translation.dropped.writtenMeanwhile': 'Not written, because a person has written them since: {list}',
  'translation.dropped.gone': 'Not written, because the report no longer prints them: {list}',
  'translation.dropped.printsNoWords': 'Not written, because the expression no longer prints words: {list}',
  'translation.dropped.noRoom': 'Not written, because {language} has no room left for them: {list}',
  'translation.forPerson': 'For a person to write, since they stand in the payment part: {list}',
  'translation.later': 'Left for another run, once these are applied, words: {count}',
  'translation.unasked': 'Not asked in this run, words: {count}',
  'translation.noRoom.word': '{language} holds as many words as a language may, {max}: no more are asked for until some are removed.',
  'translation.noRoom.expression': '{language} holds as many expressions as a language may, {max}: no more are asked for until some are removed.',
  'translation.leftEmpty': 'Left untranslated by the model, words: {count}',

  // What an action is told, refused or done.
  'translation.noModel': 'No model was given to this editor to ask.',
  'translation.ownLanguage': 'The report’s own words are written where they stand: choose another of its languages to ask a model for its words.',
  'translation.lacksNothing': '{language} lacks no word.',
  'translation.waiting': 'A model is still translating into {language}: stop it, or wait for its answer.',
  'translation.held': 'A model’s translation into {language} is waiting for review: apply or discard it first.',
  'translation.notWaiting': 'No model is being asked.',
  'translation.nothingHeld': 'No model’s translation is held here.',
  'translation.nothingAccepted': 'Nothing is accepted yet: accept a word to apply it.',
  'translation.applied': 'Translated into {language}, words: {count}. Words still missing: {missing}.',
  'translation.appliedAll': 'Translated into {language}, words: {count}. It lacks no word now.',
  'translation.discarded': 'Discarded the model’s translation into {language}. Nothing has been applied.',
  'translation.forgotten': 'The run was discarded before the model answered, and nothing it answers is held.',
  'translation.forgottenRemoved': '{language} was removed before the model answered, and nothing it answers is held.',
} as const
