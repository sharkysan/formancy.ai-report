/**
 * Calls a report expression may not make: the clock and a random draw.
 *
 * A report rendered twice from the same data and parameters prints the
 * same thing (plan 15), so a reviewer's preview is the customer's PDF and a
 * published version renders as it was approved. `@formancy/expressions`
 * allows `now()` and `today()` in every kind of expression and `random()`
 * in a computed one, because a form captures them with its submission; a
 * report has nothing to capture them in. A date the report needs is a
 * parameter.
 *
 * Its parsed expression is opaque, and no kind's policy forbids the clock,
 * so the calls are found by asking its compiler: each place the name is
 * written as a whole word is renamed, keeping its length, to a function
 * that does not exist. Where the rename makes the compiler refuse an
 * unknown function at exactly that place, the expression called the
 * function there. Everything else -- a string, a member, a comprehension's
 * local -- compiles as before, or fails elsewhere. A generic way to ask
 * which functions an expression calls belongs upstream, and replaces this
 * when it is released.
 */
import { compile } from '@formancy/expressions'
import type { ExpressionKind, SourceSpan, VariableDeclarations } from '@formancy/expressions'

/** The functions whose value is not a function of the report's data. */
export const UNREPRODUCIBLE_FUNCTIONS = ['now', 'today', 'random'] as const

export type UnreproducibleFunction = (typeof UNREPRODUCIBLE_FUNCTIONS)[number]

/** The code `@formancy/expressions` gives a call to a function that has no overload, an unknown one included. */
export const UNKNOWN_FUNCTION = 'no_matching_overload'

const WORD = /[A-Za-z0-9_]/

/** Whether `name` at `at` stands alone, not as part of a longer name. */
function whole(source: string, at: number, name: string): boolean {
  return !WORD.test(source.charAt(at - 1)) && !WORD.test(source.charAt(at + name.length))
}

/**
 * Each call in `source` -- an expression that compiles, of `kind`, against
 * `variables` -- to a function that would make a render unrepeatable, in
 * the order they are written, with the span of the call.
 */
export function unreproducibleCalls(
  source: string,
  kind: ExpressionKind,
  variables: VariableDeclarations,
): { readonly name: UnreproducibleFunction; readonly span: SourceSpan }[] {
  const found: { readonly name: UnreproducibleFunction; readonly span: SourceSpan }[] = []
  for (const name of UNREPRODUCIBLE_FUNCTIONS) {
    for (let at = source.indexOf(name); at !== -1; at = source.indexOf(name, at + 1)) {
      if (!whole(source, at, name)) continue
      const probe = compile(`${source.slice(0, at)}_${source.slice(at + 1)}`, { kind, variables })
      if (!probe.ok && probe.error.code === UNKNOWN_FUNCTION && probe.error.position?.start === at) found.push({ name, span: probe.error.position })
    }
  }
  return found.sort((a, b) => a.span.start - b.span.start)
}
