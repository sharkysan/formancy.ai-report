/**
 * Values: what a paragraph, a table cell or a footer is made of, where each
 * kind of value has one, and how it is displayed.
 *
 * Kinds are tables, not switches, as components are: an inline, format or
 * currency source added to its list without a reader here does not compile.
 */
import type { RowValue } from './aggregates.js'
import { all, flag, integer, kindOf, matches, oneOf, optional, quote, readArray, readList, readObject, reference, shape, strictKeys, text } from './check.js'
import type { Findings } from './check.js'
import { DATASET_ROLES } from './data.js'
import type { FieldRef, FieldType } from './data.js'
import type { RegionName } from './definition.js'
import { MAX_EXPRESSION_LENGTH, MAX_INLINES, MAX_SCALE, MAX_STYLE_RULES, MAX_TEXT_LENGTH } from './limits.js'
import { at } from './pointer.js'
import type { StyleRule } from './styles.js'
import { CURRENCY } from './syntax.js'
import { resolve } from './validate-context.js'
import type { Ctx } from './validate-context.js'
import { AGGREGATE_SCOPES, CURRENCY_SOURCE_KINDS, DATE_STYLES, FORMAT_KINDS, INLINE_KINDS, TEXT_TRANSFORMS } from './values.js'
import type { CurrencySource, CurrencySourceKind, Expression, Format, FormatKind, Inline, InlineKind, ValueScope } from './values.js'

/** Where a value is read: the region decides page counters, the scope decides detail fields and a group's aggregates. */
export interface InlineScope {
  /** The region the runs stand in, or the payment part or the e-invoice, which stand in none. */
  readonly region: RegionName | 'paymentPart' | 'eInvoice'
  readonly reads: ValueScope
  /** In a group header or footer, the detail field grouped by, when the dataset declares it. */
  readonly groupBy?: string | undefined
  /** What the runs are encoded in, when they are: resolved whole, once, before there are pages to count. */
  readonly encoded?: 'a QR code' | 'an EPC QR code' | 'a QR-bill' | 'an e-invoice'
}

/** The regions drawn once per page, the only ones in which a page number or count has a value. */
const PAGE_REGIONS: readonly InlineScope['region'][] = ['pageHeader', 'pageFooter']

export function readExpression(f: Findings, value: unknown, path: string): Expression | undefined {
  const o = shape(f, value, path, ['cel'])
  const cel = text(f, o?.cel, at(path, 'cel'), MAX_EXPRESSION_LENGTH)
  if (cel === undefined) return undefined
  if (cel.trim() !== '') return { cel }
  f.report(at(path, 'cel'), 'empty-expression', 'an expression needs something to evaluate, and this one is empty')
  return undefined
}

/** A reference to a print style the report declares. */
export function readStyleRef(c: Ctx, value: unknown, path: string): string | undefined {
  const style = reference(c.f, value, path)
  resolve(c.f, c.declared.styles, style, path, 'unknown-style', 'style')
  return style
}

/** Conditional styles: each a condition and the style it applies. */
export function readStyleRules(c: Ctx, value: unknown, path: string): readonly StyleRule[] | undefined {
  const items = readArray(c.f, value, path, MAX_STYLE_RULES)
  const rules = items?.map((item, index): StyleRule | undefined => {
    const where = at(path, index)
    const o = shape(c.f, item, where, ['when', 'style'])
    const when = readExpression(c.f, o?.when, at(where, 'when'))
    const style = readStyleRef(c, o?.style, at(where, 'style'))
    return when === undefined || style === undefined ? undefined : { when, style }
  })
  return rules && all(rules)
}

/** A field reference, its field's type when known, and whether the dataset declares the field. */
export interface FieldBinding {
  readonly ref: FieldRef
  readonly type: FieldType | undefined
  readonly declared: boolean
}

/** Reports a detail field read where there is no current row. */
function placeDetailField(c: Ctx, field: string, path: string, scope: InlineScope): void {
  if (scope.reads === 'row') return
  if (scope.reads === 'report') {
    c.f.report(path, 'misplaced-detail-field', 'a detail field has a current row only in the cells of the table over the detail dataset')
  } else if (scope.groupBy !== undefined && field !== scope.groupBy) {
    c.f.report(path, 'misplaced-detail-field', `in a group header or footer, the one detail field with a single value is the one grouped by, ${quote(scope.groupBy)}`)
  }
}

/**
 * A FieldRef read in `scope`, or, where only a detail field can be named --
 * a sort key, a group key, what an aggregate reads -- with `scope` 'detail'.
 */
export function readFieldRef(c: Ctx, value: unknown, path: string, scope: InlineScope | 'detail'): FieldBinding | undefined {
  const o = shape(c.f, value, path, ['dataset', 'field'])
  const dataset = oneOf(c.f, o?.dataset, at(path, 'dataset'), scope === 'detail' ? (['detail'] as const) : DATASET_ROLES)
  const field = reference(c.f, o?.field, at(path, 'field'))
  if (scope !== 'detail' && dataset === 'detail' && field !== undefined) placeDetailField(c, field, path, scope)
  const fields = resolve(c.f, c.declared.datasets, dataset, at(path, 'dataset'), 'unknown-dataset', 'dataset')
  const type = resolve(c.f, fields, field, at(path, 'field'), 'unknown-field', `field of the ${String(dataset)} dataset`)
  if (dataset === undefined || field === undefined) return undefined
  return { ref: { dataset, field }, type, declared: fields?.has(field) === true }
}

/** Reports a field or parameter whose type is not `wanted`, where it is bound. */
function expectType(c: Ctx, type: FieldType | undefined, wanted: FieldType, path: string, where: string): void {
  if (type !== undefined && type !== wanted) c.f.report(path, 'binding-type-mismatch', `${where} reads a ${wanted}, and this is a ${type}`)
}

type CurrencyReader = (c: Ctx, o: Record<string, unknown>, path: string, scope: InlineScope) => CurrencySource | undefined

const CURRENCIES: { readonly [K in CurrencySourceKind]: { readonly required: readonly string[]; readonly read: CurrencyReader } } = {
  code: {
    required: ['code'],
    read: (c, o, path) => {
      const code = matches(c.f, o.code, at(path, 'code'), CURRENCY, 'invalid-currency', 'an ISO 4217 code in capitals, such as CHF')
      return code === undefined ? undefined : { kind: 'code', code }
    },
  },
  field: {
    required: ['field'],
    read: (c, o, path, scope) => {
      const field = readFieldRef(c, o.field, at(path, 'field'), scope)
      expectType(c, field?.type, 'string', at(path, 'field'), 'a currency')
      return field && { kind: 'field', field: field.ref }
    },
  },
  parameter: {
    required: ['parameter'],
    read: (c, o, path) => {
      const parameter = reference(c.f, o.parameter, at(path, 'parameter'))
      const type = resolve(c.f, c.declared.parameters, parameter, at(path, 'parameter'), 'unknown-parameter', 'parameter')
      expectType(c, type, 'string', at(path, 'parameter'), 'a currency')
      return parameter === undefined ? undefined : { kind: 'parameter', parameter }
    },
  },
}

function readCurrency(c: Ctx, value: unknown, path: string, scope: InlineScope): CurrencySource | undefined {
  const o = readObject(c.f, value, path)
  const kind = o && kindOf(c.f, o, path, CURRENCY_SOURCE_KINDS)
  if (o === undefined || kind === undefined) return undefined
  strictKeys(c.f, o, path, ['kind', ...CURRENCIES[kind].required])
  return CURRENCIES[kind].read(c, o, path, scope)
}

type FormatReader = (c: Ctx, o: Record<string, unknown>, path: string, scope: InlineScope) => Format | undefined

const FORMATS: { readonly [K in FormatKind]: FormatReader } = {
  number: (c, o, path) => {
    strictKeys(c.f, o, path, ['kind', 'scale', 'grouping'])
    const scale = integer(c.f, o.scale, at(path, 'scale'), 0, MAX_SCALE)
    const grouping = flag(c.f, o.grouping, at(path, 'grouping'))
    return scale === undefined || grouping === undefined ? undefined : { kind: 'number', scale, grouping }
  },
  currency: (c, o, path, scope) => {
    strictKeys(c.f, o, path, ['kind', 'currency', 'scale'])
    const currency = readCurrency(c, o.currency, at(path, 'currency'), scope)
    const scale = integer(c.f, o.scale, at(path, 'scale'), 0, MAX_SCALE)
    return currency === undefined || scale === undefined ? undefined : { kind: 'currency', currency, scale }
  },
  date: (c, o, path) => {
    strictKeys(c.f, o, path, ['kind', 'style'])
    const style = oneOf(c.f, o.style, at(path, 'style'), DATE_STYLES)
    return style === undefined ? undefined : { kind: 'date', style }
  },
  text: (c, o, path) => {
    strictKeys(c.f, o, path, ['kind'], ['transform'])
    return { kind: 'text', ...optional('transform', oneOf(c.f, o.transform, at(path, 'transform'), TEXT_TRANSFORMS)) }
  },
}

function readFormat(c: Ctx, value: unknown, path: string, scope: InlineScope): Format | undefined {
  const o = readObject(c.f, value, path)
  const kind = o && kindOf(c.f, o, path, FORMAT_KINDS)
  return o && kind && FORMATS[kind](c, o, path, scope)
}

/** The types each format displays. Text displays anything that prints. */
const FORMATTED: { readonly [K in FormatKind]: readonly FieldType[] | 'any' } = {
  number: ['integer', 'decimal'],
  currency: ['integer', 'decimal'],
  date: ['date', 'datetime', 'instant'],
  text: 'any',
}

/**
 * The format at `path` read, and reported when it does not display a value
 * of `type`. An expression's type is known only when the runtime compiles
 * it, so its format is not checked here: `type` is then undefined.
 */
function readCheckedFormat(c: Ctx, value: unknown, path: string, scope: InlineScope, type: FieldType | undefined): Format | undefined {
  const format = readFormat(c, value, path, scope)
  const formatted = format && FORMATTED[format.kind]
  if (format !== undefined && type !== undefined && formatted !== 'any' && formatted?.includes(type) === false) {
    c.f.report(path, 'format-type-mismatch', `a ${format.kind} format displays ${formatted.join(', ')} values, and this value is a ${type}`)
  }
  return format
}

/**
 * A page number or count, and whether it stands where it has a value: in
 * the page header and footer, printed. A table never stands in a page
 * region, so its cells are refused by region too; what a QR code, an EPC
 * QR code, a QR-bill or an e-invoice encodes is resolved before there are
 * pages, so it is refused in every region.
 */
function readCounter(c: Ctx, path: string, scope: InlineScope, kind: 'pageNumber' | 'pageCount'): Inline {
  if (scope.encoded !== undefined) {
    c.f.report(path, 'misplaced-page-counter', `what ${scope.encoded} encodes is resolved once, before pages are counted, so a page number or count has no value in it`)
  } else if (!PAGE_REGIONS.includes(scope.region)) {
    c.f.report(path, 'misplaced-page-counter', `page numbers and counts have a value only in the page header and footer, not in the ${scope.region}`)
  }
  return { kind }
}

interface InlineRule {
  readonly required: readonly string[]
  readonly optional?: readonly string[]
  readonly read: (c: Ctx, o: Record<string, unknown>, path: string, scope: InlineScope) => Inline | undefined
}

const INLINES: { readonly [K in InlineKind]: InlineRule } = {
  text: {
    required: ['text'],
    read: (c, o, path) => {
      const literal = text(c.f, o.text, at(path, 'text'), MAX_TEXT_LENGTH)
      return literal === undefined ? undefined : { kind: 'text', text: literal }
    },
  },
  field: {
    required: ['field'],
    optional: ['format'],
    read: (c, o, path, scope) => {
      const field = readFieldRef(c, o.field, at(path, 'field'), scope)
      // An image is drawn by an image component; printed, it would be an asset id.
      if (field?.type === 'image') c.f.report(at(path, 'field'), 'binding-type-mismatch', 'an image field is drawn by an image, never printed as text')
      const format = readCheckedFormat(c, o.format, at(path, 'format'), scope, field?.type === 'image' ? undefined : field?.type)
      return field && { kind: 'field', field: field.ref, ...optional('format', format) }
    },
  },
  parameter: {
    required: ['parameter'],
    optional: ['format'],
    read: (c, o, path, scope) => {
      const parameter = reference(c.f, o.parameter, at(path, 'parameter'))
      const type = resolve(c.f, c.declared.parameters, parameter, at(path, 'parameter'), 'unknown-parameter', 'parameter')
      const format = readCheckedFormat(c, o.format, at(path, 'format'), scope, type)
      return parameter === undefined ? undefined : { kind: 'parameter', parameter, ...optional('format', format) }
    },
  },
  expression: {
    required: ['expression'],
    optional: ['format'],
    read: (c, o, path, scope) => {
      const expression = readExpression(c.f, o.expression, at(path, 'expression'))
      const format = readCheckedFormat(c, o.format, at(path, 'format'), scope, undefined)
      return expression && { kind: 'expression', expression, ...optional('format', format) }
    },
  },
  aggregate: {
    required: ['aggregate', 'over'],
    optional: ['format'],
    read: (c, o, path, scope) => {
      const aggregate = reference(c.f, o.aggregate, at(path, 'aggregate'))
      const type = resolve(c.f, c.declared.aggregates, aggregate, at(path, 'aggregate'), 'unknown-aggregate', 'aggregate')
      const over = oneOf(c.f, o.over, at(path, 'over'), AGGREGATE_SCOPES)
      if (over === 'group' && scope.reads !== 'group') {
        c.f.report(at(path, 'over'), 'misplaced-group-aggregate', 'an aggregate over a group has a value only in that group\'s header and footer; over "report", it is taken over every row')
      }
      const format = readCheckedFormat(c, o.format, at(path, 'format'), scope, type)
      return aggregate === undefined || over === undefined ? undefined : { kind: 'aggregate', aggregate, over, ...optional('format', format) }
    },
  },
  pageNumber: { required: [], read: (c, _o, path, scope) => readCounter(c, path, scope, 'pageNumber') },
  pageCount: { required: [], read: (c, _o, path, scope) => readCounter(c, path, scope, 'pageCount') },
}

export function readInline(c: Ctx, value: unknown, path: string, scope: InlineScope): Inline | undefined {
  const o = readObject(c.f, value, path)
  const kind = o && kindOf(c.f, o, path, INLINE_KINDS)
  if (o === undefined || kind === undefined) return undefined
  const rule = INLINES[kind]
  strictKeys(c.f, o, path, ['kind', ...rule.required], rule.optional)
  return rule.read(c, o, path, scope)
}

/** Runs, at least `min` of them: none is an empty line in a paragraph, and nothing at all in a QR code. */
export function readInlines(c: Ctx, value: unknown, path: string, scope: InlineScope, min = 0): readonly Inline[] | undefined {
  const items = readList(c.f, value, path, min, MAX_INLINES)
  return items && all(items.map((item, index) => readInline(c, item, at(path, index), scope)))
}

/** What an aggregate reads from each row, and that value's type when it is a field's. */
export function readRowValue(c: Ctx, value: unknown, path: string): { value: RowValue; type: FieldType | undefined } | undefined {
  const o = readObject(c.f, value, path)
  const kind = o && kindOf(c.f, o, path, ['field', 'expression'] as const)
  if (o === undefined || kind === undefined) return undefined
  strictKeys(c.f, o, path, ['kind', kind])
  if (kind === 'expression') {
    const expression = readExpression(c.f, o.expression, at(path, 'expression'))
    return expression && { value: { kind, expression }, type: undefined }
  }
  const field = readFieldRef(c, o.field, at(path, 'field'), 'detail')
  return field && { value: { kind, field: field.ref }, type: field.type }
}
