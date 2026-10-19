/**
 * One expression compiled where it stands, with every member it reads
 * checked as the type it is.
 *
 * `@formancy/expressions` 0.6.0, as 0.5.0, declares a variable only by its
 * whole name: a declaration of `row.amount` is a variable with a dot in its
 * name, which an expression reading `row.amount` never finds. So each read of a member
 * is spliced, by upstream's own `rewritePath`, which verifies every splice
 * by parsing the result again, into a read of one variable -- `row.amount`
 * becomes `row_amount` -- declared with the member's type. The real checker
 * then types every member read: a decimal meets a decimal, an integer added
 * to a string is refused. The flat name is exactly as long as the read
 * written plainly, so a position the compiler gives is a position in what
 * the author wrote.
 *
 * What a scope does not bind, a member nothing declares, a member of a
 * single value and an image field read as a value are found first, from
 * the paths the parser says the expression reads; so is an e-invoice's
 * total read where it cannot be (`e-invoice.ts`). The clock and a random
 * draw, which the compiler allows, are refused last (plan 15), and then
 * what its place needs it to give: a payment code's amount, an
 * e-invoice's term.
 */
import { compile, parse, referencedPaths, rewritePath } from '@formancy/expressions'
import type { DeclaredType, ExpressionError, ExpressionErrorKind, Program, SourceSpan, VariableDeclarations } from '@formancy/expressions'
import { E_INVOICE_NAMES, EXPRESSION_NAMES, VALUE_SCOPES } from '@formancy/report-spec'
import type { ValueScope } from '@formancy/report-spec'
import { diagnostic } from '../diagnostics/codes.js'
import type { Diagnostic, DiagnosticCode, Where } from '../diagnostics/codes.js'
import type { ExpressionSite } from '../diagnostics/parts.js'
import { quote } from '../outcome.js'
import { invoiceRefusal, termBreak } from './e-invoice.js'
import { inexactOperations, unboundedCalls } from './exactness.js'
import type { InexactKind } from './exactness.js'
import type { Members, ScopeName } from './members.js'
import { unreproducibleCalls } from './reproducible.js'
import { readSpans } from './spans.js'

/** A member an expression reads, and how the runtime binds it. */
export interface ExpressionRead {
  /** The name and the member as the expression writes them: `row` and `amount` for `row.amount`. */
  readonly name: ScopeName
  readonly member: string
  /** The variable the program reads it as, and `expressionValues` binds it under: `row_amount`. */
  readonly variable: string
  /** The type it is bound as, and checked as unless it may be null. */
  readonly type: DeclaredType
  readonly nullable: boolean
}

/** An expression that compiled clean: what the runtime evaluates, and what it reads. */
export interface CompiledExpression {
  readonly site: ExpressionSite
  /** Compiled from the expression with each member read spliced into its variable; evaluate it with `expressionValues`. */
  readonly program: Program
  readonly reads: readonly ExpressionRead[]
}

export type SiteOutcome = { readonly ok: true; readonly compiled: CompiledExpression } | { readonly ok: false; readonly diagnostics: readonly Diagnostic[] }

/** The image fields each name holds, which nothing reads. */
export type Images = { readonly [N in ScopeName]?: ReadonlySet<string> }

/**
 * The code for each kind of error the compiler gives. It gives the first
 * four when compiling; `runtime` and `budget` are evaluation's, mapped to
 * the nearest so the table is total.
 */
const BY_KIND: { readonly [K in ExpressionErrorKind]: DiagnosticCode } = {
  syntax: 'expression-syntax',
  limit: 'expression-limit',
  type: 'expression-type',
  policy: 'expression-policy',
  runtime: 'expression-type',
  budget: 'expression-limit',
}

/** Where each scope's own names have a value, for a message. */
const WHERE: { readonly [S in ValueScope]: string } = {
  report: 'every part of the report',
  group: "a group's header and footer",
  row: "a table's cells and what an aggregate reads from each row",
}

/** What each name's members are, for a message about one it lacks. */
const MEMBERS_ARE: { readonly [N in ScopeName]: string } = {
  params: 'parameter',
  header: 'field of the header dataset',
  row: 'field of the detail dataset',
  totals: 'aggregate',
  group: 'aggregate',
  invoice: 'total of the e-invoice',
  vatBasis: 'VAT category of the e-invoice',
  vatAmount: 'VAT category of the e-invoice',
}

/** A read path's parts: the name it starts with, the member a dot names after it, and anything else after that. */
export interface PathParts {
  readonly name: string
  /** The member, when the name is followed by `.` and an identifier; undefined for a whole read, or one by a key no member could have. */
  readonly member?: string
  /** What follows the name, or the member when there is one: '' when nothing does. */
  readonly rest: string
}

const NAME = /^[A-Za-z_][A-Za-z0-9_]*/

/**
 * `path` -- as `referencedPaths` gives one: `row.amount`, `params`, or
 * `row["a.b"]` for a key that is no identifier -- taken apart. A member's
 * id is a field key, an identifier (0007), so a read by any other key reads
 * no member.
 */
export function pathParts(path: string): PathParts {
  // Every path upstream gives starts with the name it reads.
  const name = (NAME.exec(path) as RegExpExecArray)[0]
  const after = path.slice(name.length)
  const member = after.startsWith('.') ? NAME.exec(after.slice(1))?.[0] : undefined
  return member === undefined ? { name, rest: after } : { name, member, rest: after.slice(1 + member.length) }
}

function failed(diagnostics: readonly Diagnostic[]): SiteOutcome {
  return { ok: false, diagnostics }
}

/** Where a diagnostic about `site` points. */
function at(site: ExpressionSite, position?: SourceSpan, hint?: string): Where {
  return { path: site.path, componentId: site.componentId, columnId: site.columnId, position, hint }
}

/** One diagnostic per place `source` reads `path`, or one with no place when the reads cannot be found. */
function eachRead(site: ExpressionSite, path: string, code: DiagnosticCode, message: string): Diagnostic[] {
  const spans = readSpans(site.cel, path)
  return spans.length === 0 ? [diagnostic(code, message, at(site))] : spans.map((span) => diagnostic(code, message, at(site, span)))
}

/** What the expression at a site reads: the names its scope binds, and the e-invoice's where it may read them, or why it cannot. */
interface Names {
  readonly names: readonly string[]
  /** Why the e-invoice's names are not read here, said after the name; undefined where they are. */
  readonly refusal: string | undefined
}

const INVOICE_NAMES: readonly string[] = E_INVOICE_NAMES

/** The names `site` reads, in a report that is an e-invoice when `invoiced` says so. */
function namesAt(site: ExpressionSite, invoiced: boolean): Names {
  const refusal = invoiceRefusal(site, invoiced)
  return { names: refusal === undefined ? [...EXPRESSION_NAMES[site.scope], ...INVOICE_NAMES] : EXPRESSION_NAMES[site.scope], refusal }
}

/** The diagnostics for a read of `path` that the site's names and their members do not allow; none for one they do. */
function readProblems(site: ExpressionSite, path: string, members: Members, images: Images, { names, refusal }: Names): Diagnostic[] {
  const { name, member, rest } = pathParts(path)
  if (refusal !== undefined && INVOICE_NAMES.includes(name)) return eachRead(site, name, 'expression-unknown-name', `${name} ${refusal}`)
  if (!names.includes(name)) {
    const scopes = VALUE_SCOPES.filter((scope) => EXPRESSION_NAMES[scope].includes(name))
    if (scopes.length > 0) return eachRead(site, name, 'expression-out-of-scope', `${name} has a value only in ${scopes.map((scope) => WHERE[scope]).join(' and ')}`)
    return eachRead(site, name, 'expression-unknown-name', `${quote(name)} is not a name an expression reads; here it reads ${names.join(', ')}`)
  }
  // A whole read -- size(params) -- is found once every member read is
  // spliced, when what still reads the name reads it whole.
  if (rest === '' && member === undefined) return []
  const scoped = name as ScopeName
  if (member === undefined) return eachRead(site, path, 'expression-unknown-name', `${name} has no member ${quote(rest)}: a ${MEMBERS_ARE[scoped]} is read by its id, as ${name}.<id>`)
  const held = members[scoped].get(member)
  if (held === undefined && images[scoped]?.has(member) === true) {
    return eachRead(site, path, 'expression-unreadable-field', `${name}.${member} is an image field: an image component draws it, and nothing reads it as a value`)
  }
  if (held === undefined) return eachRead(site, path, 'expression-unknown-name', `${name} has no member ${quote(member)}: no ${MEMBERS_ARE[scoped]} of the report has that id`)
  if (rest !== '') return eachRead(site, path, 'expression-unknown-name', `${name}.${member} is a single value, and has no member ${quote(rest.replace(/^\./, ''))}`)
  return []
}

/** Each member the paths read, once, in the order first read, with how it is bound. */
function readsOf(paths: readonly string[], members: Members): ExpressionRead[] {
  const reads = new Map<string, ExpressionRead>()
  for (const path of paths) {
    const { name, member } = pathParts(path)
    const held = member === undefined ? undefined : members[name as ScopeName].get(member)
    if (member === undefined || held === undefined || reads.has(`${name}.${member}`)) continue
    reads.set(`${name}.${member}`, { name: name as ScopeName, member, variable: `${name}_${member}`, type: held.type, nullable: held.nullable })
  }
  return [...reads.values()]
}

/** The source with each read spliced into its variable, or the diagnostic for a splice upstream refused. */
function flattened(site: ExpressionSite, reads: readonly ExpressionRead[]): { readonly source: string } | Diagnostic {
  let source = site.cel
  for (const read of reads) {
    const rewritten = rewritePath(source, `${read.name}.${read.member}`, read.variable)
    if (!rewritten.ok) {
      return diagnostic(
        BY_KIND[rewritten.error.kind],
        `${read.variable} is the name ${read.name}.${read.member} is checked under, and this expression gives that name to a variable of its own; give the variable another`,
        at(site),
      )
    }
    source = rewritten.source
  }
  return { source }
}

/** `text` with each variable written back as the read it stands for, so a message names what the author wrote. */
function authored(text: string | undefined, reads: readonly ExpressionRead[]): string | undefined {
  return reads.reduce<string | undefined>((said, read) => said?.replace(new RegExp(`(?<![A-Za-z0-9_])${read.variable}(?![A-Za-z0-9_])`, 'g'), `${read.name}.${read.member}`), text)
}

/** The diagnostic for an error the compiler gave; its position kept only when the source it checked is the author's, character for character. */
function refused(site: ExpressionSite, error: ExpressionError, source: string, reads: readonly ExpressionRead[]): Diagnostic {
  const position = source.length === site.cel.length ? error.position : undefined
  return diagnostic(BY_KIND[error.kind], authored(error.message, reads) as string, at(site, position, authored(error.hint, reads)))
}

/**
 * A diagnostic at each place `source` -- with every member read spliced --
 * still reads a name of the scope: each such read reads the name whole,
 * since every read of a member by its id is spliced away. Positions only
 * when `source` is the author's, character for character.
 */
function wholeReads(site: ExpressionSite, paths: readonly string[], source: string, names: readonly string[]): Diagnostic[] {
  const exact = source.length === site.cel.length
  return paths
    .filter((path) => names.includes(path))
    .flatMap((name) =>
      readSpans(source, name).map((span) =>
        diagnostic('expression-dynamic-read', `${name} is read whole; an expression reads each ${MEMBERS_ARE[name as ScopeName]} by its id, as ${name}.<id>`, at(site, exact ? span : undefined)),
      ),
    )
}

/**
 * `site` compiled against what its scope binds in this report -- a report
 * that is an e-invoice when `invoiced` says so -- or every reason it
 * cannot be: a read its scope does not allow, each where it is; the
 * compiler's first error; each call to the clock or a random draw; or a
 * value its place does not take.
 */
export function compileSite(site: ExpressionSite, members: Members, images: Images, invoiced: boolean): SiteOutcome {
  const parsed = parse(site.cel)
  if (!parsed.ok) return failed([refused(site, parsed.error, site.cel, [])])
  const paths = referencedPaths(parsed.ast)
  const names = namesAt(site, invoiced)
  const problems = paths.flatMap((path) => readProblems(site, path, members, images, names))
  if (problems.length > 0) return failed(problems)
  const reads = readsOf(paths, members)
  const flat = flattened(site, reads)
  if (!('source' in flat)) return failed([flat])
  const whole = wholeReads(site, paths, flat.source, names.names)
  if (whole.length > 0) return failed(whole)
  const variables: VariableDeclarations = Object.fromEntries(reads.map((read) => [read.variable, read.nullable ? 'dyn' : read.type]))
  const compiled = compile(flat.source, { kind: site.kind, variables })
  if (!compiled.ok) return failed([refused(site, compiled.error, flat.source, reads)])
  const exact = flat.source.length === site.cel.length
  const calls = unreproducibleCalls(flat.source, site.kind, variables)
  if (calls.length > 0) {
    const message = (name: string): string => `${name}() differs from one render to the next, and a report prints the same from the same data; a date the report needs is a parameter`
    return failed(calls.map(({ name, span }) => diagnostic('expression-not-reproducible', message(name), at(site, exact ? span : undefined))))
  }
  const inexact = [
    ...inexactOperations(flat.source, site.kind, variables).map(({ kind, span }) => diagnostic('expression-inexact', INEXACT[kind].message, at(site, exact ? span : undefined, INEXACT[kind].hint))),
    ...unboundedCalls(flat.source, site.kind, variables).map(({ name, span }) => diagnostic('expression-unbounded', UNBOUNDED(name), at(site, exact ? span : undefined))),
  ].sort((a, b) => (a.position?.start ?? 0) - (b.position?.start ?? 0))
  if (inexact.length > 0) return failed(inexact)
  const type = compiled.program.resultType
  if (site.amount !== undefined && !AMOUNTS.has(type)) {
    const hint = type === 'int' || type === 'string' ? 'dec() makes a decimal of an integer, or of a string of digits' : undefined
    return failed([diagnostic('expression-type', `${site.amount}'s amount is a decimal, or null to leave it for the payer, and this expression gives ${type}`, at(site, undefined, hint))])
  }
  const broken = termBreak(site, type)
  if (broken !== undefined) return failed([diagnostic('expression-type', broken.message, at(site, undefined, broken.hint))])
  return { ok: true, compiled: { site, program: compiled.program, reads } }
}

/**
 * What a payment code's amount -- a QR-bill's, an EPC QR code's -- may
 * give: one rule for both. A decimal, null, or a value that may be
 * either -- a decimal that may be null is checked as `dyn` -- which the
 * render, seeing the value, checks again.
 */
const AMOUNTS: ReadonlySet<string> = new Set(['decimal', 'null', 'dyn'])

/** What to say of each inexact operation, and what to write instead. */
const INEXACT: { readonly [K in InexactKind]: { readonly message: string; readonly hint: string } } = {
  'double-literal': {
    message: 'a number written with a point or an exponent is a double, which is not exact: 0.1 + 0.2 is not 0.3, and int() of one drops what it lost',
    hint: 'write it as a decimal, dec("100.0"), to keep it exact',
  },
  'double-call': {
    message: 'double() makes a double, which is not exact: double("4.35") * 100.0 is 434.99999999999994, and int() of it is 434',
    hint: 'compute with decimals instead: dec("4.35") * dec("100")',
  },
  'integer-division': {
    message: '/ divides integers and drops the remainder, a rounding the report never declares: 3 / 2 is 1, and -3 / 2 is -1',
    hint: 'divide(dec(a), dec(b), places) keeps it exact, and rounds half away from zero where it says',
  },
}

const UNBOUNDED = (name: string): string =>
  `${name}() runs its pattern on a backtracking engine that a step budget cannot stop: one pattern can take minutes on a short text, and a render cannot be interrupted while it runs`
