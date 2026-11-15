/**
 * A word's field in a language besides the report's own (0063): it shows
 * the word's translation in the language edited, and is empty where there
 * is none yet, the report's own word its placeholder; what is typed into
 * it is the translation -- report-core's `translateWord`, or, for an
 * expression that prints words, `translateExpression` -- and emptying it
 * takes the translation back. A language looks a word up by its text, so
 * every place it stands takes the one translation, and the field says how
 * many places those are. The report's own words are edited in its own
 * language alone, by the fields that language shows.
 */
import { translateExpression, translateWord } from '@formancy/report-core'
import { isWord } from '@formancy/report-spec'
import type { Expression, Translation } from '@formancy/report-spec'
import type { Edited } from './languages.js'
import { refused, textField, UNCHANGED, value } from './property-fields.js'
import type { FieldContext, FieldSpec, FieldWords } from './property-fields.js'

/** The language edited, where it is one a translation declares, which stands where `at` says. */
export type InTranslation = Edited & { readonly translation: Translation; readonly at: string }

/** Whether `context`'s fields at a word write a translation: whether the language edited is not the report's own. */
export function translating(context: FieldContext): context is FieldContext & { readonly edited: InTranslation } {
  return context.edited?.translation !== undefined
}

/** What is typed, as the translation it writes: unchanged as it was shown, null once emptied, else what `written` makes of it. */
function translationWrite(shown: string, written: (input: string) => unknown): FieldSpec['write'] {
  return (input) => {
    if (typeof input !== 'string') return refused('input.option')
    if (input === shown) return UNCHANGED
    return value(input.trim() === '' ? null : written(input))
  }
}

/** The field of `word`, a word of the report's own language, at `key`: its translation in the language edited. */
export function wordField(key: string, words: FieldWords, kind: 'text' | 'multiline', word: string, edited: InTranslation): FieldSpec {
  const { locale } = edited
  const shown = edited.translation.words.find((entry) => entry.word === word)?.text ?? ''
  return {
    key,
    words,
    kind,
    // A translation is taken back by emptying its field, never required.
    required: false,
    translation: { language: edited.name, word, missing: shown === '', places: edited.words.get(word) ?? 1 },
    read: () => shown,
    write: translationWrite(shown, (input) => input),
    change: (text) => ({ command: (r) => translateWord(r, locale, word, text as string | null) }),
  }
}

/** The field of the expression whose source is `cel`, where it prints words, at `key`: its translation in the language edited, another expression. */
export function wordExpressionField(key: string, words: FieldWords, cel: string, edited: InTranslation): FieldSpec {
  const { locale } = edited
  const entry = edited.translation.expressions.findIndex((candidate) => candidate.cel === cel)
  const shown = edited.translation.expressions[entry]?.expression.cel ?? ''
  return {
    key,
    words,
    kind: 'expression',
    required: false,
    // Its errors, and a translation that would print another thing, are the translation's, and stand at its entry.
    ...(entry === -1 ? {} : { diagnosed: `${edited.at}/expressions/${String(entry)}` }),
    translation: { language: edited.name, word: cel, missing: shown === '', places: edited.sources.get(cel) ?? 1 },
    read: () => shown,
    write: translationWrite(shown, (input) => ({ cel: input })),
    change: (expression) => ({ command: (r) => translateExpression(r, locale, cel, expression as Expression | null) }),
  }
}

/**
 * A required string where a word stands -- a report's title, a column's
 * header, a table's empty text -- at `key`: its translation's field in a
 * language besides the report's own, where it holds a letter, and the
 * report's own field otherwise.
 */
export function wordOrTextField(key: string, words: FieldWords, text: string, context: FieldContext): FieldSpec {
  return translating(context) && isWord(text) ? wordField(key, words, 'text', text, context.edited) : textField(key, words, 'text', () => text)
}
