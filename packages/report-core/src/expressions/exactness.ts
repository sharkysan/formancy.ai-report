/**
 * Arithmetic a report expression may not do, and a call whose time nothing
 * bounds.
 *
 * - **A double.** A report's numbers are exact: integers, and decimals from
 *   strings (formancy.ai-data 0008). A double is not, and `int()` of one
 *   hands back an integer the runtime cannot tell from an exact one:
 *   `int(double("4.35") * 100.0)` is 434. Every double comes in through a
 *   literal (`100.0`, `1e3`) or `double()`, since the data binds none.
 * - **Division with `/`.** On integers it drops the remainder -- 3 / 2 is
 *   1, -3 / 2 is -1 -- a rounding nobody declared. Decimals have no `/`,
 *   and doubles are refused, so every `/` that compiles divides integers.
 *   `divide(dec(a), dec(b), places)` rounds where it says, half away from
 *   zero. A remainder, `%`, is exact, and allowed.
 * - **`matches()`.** It runs its pattern on JavaScript's backtracking
 *   engine, and one call is a few steps of upstream's budget however long
 *   it runs: no budget bounds it, and a render cannot be interrupted while
 *   it runs.
 *
 * The parsed expression is opaque, so each is found by asking the parser
 * and the compiler, as `reproducible.ts` finds the clock: a candidate is
 * spelled differently where it stands, and the probe sees whether that
 * changes the outcome there. A character no CEL token has makes a syntax
 * error exactly where it stands, unless it stands in a string or a comment;
 * a renamed function makes the call fail. So text that only looks like a
 * double, a division or a call is never one. A generic way to ask an
 * expression's types and calls belongs upstream, and replaces this when it
 * is released.
 */
import { compile, parse } from '@formancy/expressions'
import type { ExpressionKind, SourceSpan, VariableDeclarations } from '@formancy/expressions'
import { UNKNOWN_FUNCTION } from './reproducible.js'

export type InexactKind = 'double-literal' | 'double-call' | 'integer-division'

export interface Found<K> {
  readonly kind: K
  readonly span: SourceSpan
}

/** A CEL float literal: digits, a point and digits, or digits and an exponent; never part of a name or of a hex literal. */
const FLOAT = /(?<![A-Za-z0-9_.])(?:\d+\.\d+(?:[eE][+-]?\d+)?|\d+[eE][+-]?\d+)(?![A-Za-z0-9_])/g

/** A character no CEL token has. */
const FOREIGN = '@'

/** Whether the `length` characters at `at` are part of the expression, not of a string or a comment: spelled as a foreign character, they make a syntax error there. */
function inCode(source: string, at: number, length: number): boolean {
  const probe = parse(`${source.slice(0, at)}${FOREIGN}${' '.repeat(length - 1)}${source.slice(at + length)}`)
  return !probe.ok && probe.error.kind === 'syntax' && probe.error.position?.start === at
}

const WORD = /[A-Za-z0-9_]/

/**
 * Each call in `source` -- which compiles, of `kind`, against `variables` --
 * to the function `name`, by function or method, with the span the compiler
 * gives the call once the function is renamed to one that does not exist.
 */
function callsTo(name: string, source: string, kind: ExpressionKind, variables: VariableDeclarations): SourceSpan[] {
  const spans: SourceSpan[] = []
  for (let at = source.indexOf(name); at !== -1; at = source.indexOf(name, at + 1)) {
    if (WORD.test(source.charAt(at - 1)) || WORD.test(source.charAt(at + name.length))) continue
    const probe = compile(`${source.slice(0, at)}_${source.slice(at + 1)}`, { kind, variables })
    const span = probe.ok ? undefined : probe.error.position
    if (!probe.ok && probe.error.code === UNKNOWN_FUNCTION && span !== undefined && span.start <= at && at < span.end) spans.push(span)
  }
  return spans
}

/**
 * Each double literal, call to `double()` and division in `source`, an
 * expression that compiles, of `kind`, against `variables`, in the order
 * they are written.
 */
export function inexactOperations(source: string, kind: ExpressionKind, variables: VariableDeclarations): Found<InexactKind>[] {
  const found: Found<InexactKind>[] = callsTo('double', source, kind, variables).map((span) => ({ kind: 'double-call', span }))
  for (const literal of source.matchAll(FLOAT)) {
    if (inCode(source, literal.index, literal[0].length)) found.push({ kind: 'double-literal', span: { start: literal.index, end: literal.index + literal[0].length } })
  }
  for (let at = source.indexOf('/'); at !== -1; at = source.indexOf('/', at + 1)) {
    // Two slashes start a comment, or stand in a string; never a division.
    if (source.charAt(at - 1) === '/' || source.charAt(at + 1) === '/') continue
    if (inCode(source, at, 1)) found.push({ kind: 'integer-division', span: { start: at, end: at + 1 } })
  }
  return found.sort((a, b) => a.span.start - b.span.start)
}

/** The functions whose time no step budget bounds. */
export const UNBOUNDED_FUNCTIONS = ['matches'] as const

/** Each call in `source` to a function whose time no budget bounds, in the order written. */
export function unboundedCalls(source: string, kind: ExpressionKind, variables: VariableDeclarations): { readonly name: (typeof UNBOUNDED_FUNCTIONS)[number]; readonly span: SourceSpan }[] {
  return UNBOUNDED_FUNCTIONS.flatMap((name) => callsTo(name, source, kind, variables).map((span) => ({ name, span }))).sort((a, b) => a.span.start - b.span.start)
}
