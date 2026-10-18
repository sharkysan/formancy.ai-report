/**
 * The CSS an SVG may hold, in a `style` attribute or a `<style>`, and the
 * cascade that flattens it into one value per property (0030).
 *
 * The subset is svg-to-pdfkit's and Illustrator's: a type, a class, an id,
 * a compound of those, comma lists of them, and declarations of the kept
 * properties. A combinator, an attribute selector, a pseudo-class, `*`, a
 * namespace, an at-rule, `!important`, an escape or a custom property is
 * refused, never ignored as a browser ignores what it cannot parse: what a
 * browser ignores, and what it does not, is a second grammar this one would
 * have to match exactly. A comment separates, as CSS says, and is never
 * deleted in place: `fi/**\/ll` is not `fill`.
 *
 * Matching is indexed. Each rule sits in one bucket -- its first id, else
 * its first class, else its type -- so an element looks only at the rules
 * that could match it, and `MAX_SVG_RULES`, counted in simple selectors,
 * bounds what it compares against. A rule's declarations are read once, not
 * once per element it matches, and the rules one combination of type, id
 * and classes matches are merged once for every element of it. Elements
 * that each hold a combination of their own defeat that, so the work of
 * every merge -- each rule compared, each declaration merged -- is counted,
 * and bounded by `MAX_SVG_CASCADE`.
 */
import { MAX_SVG_CASCADE, MAX_SVG_RULES } from './limits.js'
import { type Property, propertyFate } from './svg-allow.js'
import { CSS_ADVICE, refuse, type Removals, shown } from './svg-refusal.js'
import { hasNonAscii, type Located, type SvgElement } from './svg-tree.js'
import { INHERIT, readProperty, type Value } from './svg-values.js'

export interface Declared {
  readonly value: Value | typeof INHERIT
  readonly where: string
}

export type Declarations = ReadonlyMap<Property, Declared>

interface Rule {
  readonly type: string | undefined
  readonly classes: ReadonlySet<string>
  readonly ids: ReadonlySet<string>
  readonly specificity: number
  readonly order: number
  rank: number
  readonly declarations: Declarations
}

/** The geometry SVG 2 lets CSS set, which svg-to-pdfkit reads from attributes alone. */
const GEOMETRY_PROPERTIES: ReadonlySet<string> = new Set(['x', 'y', 'width', 'height', 'r', 'rx', 'ry', 'cx', 'cy', 'd', 'transform'])

/** The text with each comment replaced by a space, refused when it holds an escape or an unclosed comment or string. */
function uncommented(text: string, where: string): string {
  if (text.includes('\\')) refuse('unsupported', `${where} holds a CSS escape`, CSS_ADVICE)
  let out = ''
  let quote: string | undefined
  for (let i = 0; i < text.length; i += 1) {
    const character = text.charAt(i)
    if (quote !== undefined) {
      if (character === '\n') refuse('unsupported', `${where} holds a CSS string that is not closed`, CSS_ADVICE)
      if (character === quote) quote = undefined
      out += character
    } else if (character === '/' && text.charAt(i + 1) === '*') {
      const close = text.indexOf('*/', i + 2)
      if (close < 0) refuse('unsupported', `${where} holds a CSS comment that is not closed`, CSS_ADVICE)
      out += ' '
      i = close + 1
    } else {
      if (character === '"' || character === "'") quote = character
      out += character
    }
  }
  if (quote !== undefined) refuse('unsupported', `${where} holds a CSS string that is not closed`, CSS_ADVICE)
  return out
}

/** Where each `separator` falls outside strings and parentheses, splitting the text there. */
function splitOutside(text: string, separator: string): string[] {
  const parts: string[] = []
  let quote: string | undefined
  let depth = 0
  let from = 0
  for (let i = 0; i < text.length; i += 1) {
    const character = text.charAt(i)
    if (quote !== undefined) {
      if (character === quote) quote = undefined
    } else if (character === '"' || character === "'") quote = character
    else if (character === '(') depth += 1
    else if (character === ')') depth -= 1
    else if (character === separator && depth === 0) {
      parts.push(text.slice(from, i))
      from = i + 1
    }
  }
  parts.push(text.slice(from))
  return parts
}

const PROPERTY_NAME = /^-{0,2}[a-z_][a-z0-9_-]*$/

/** A declaration block's kept properties, each read by its grammar; what is removed is listed, what is refused is refused. */
function declarations(block: string, where: string, removals: Removals): Map<Property, Declared> {
  const declared = new Map<Property, Declared>()
  for (const part of splitOutside(block, ';')) {
    if (part.trim() === '') continue
    const colon = part.indexOf(':')
    const name = (colon < 0 ? part : part.slice(0, colon)).trim().toLowerCase()
    const value = colon < 0 ? '' : part.slice(colon + 1).trim()
    if (!PROPERTY_NAME.test(name) || value === '') refuse('unsupported', `${where} holds a CSS declaration this format does not read`, CSS_ADVICE)
    if (value.includes('!')) refuse('unsupported', `${where} holds !important, which this format does not read`, CSS_ADVICE)
    const fate = propertyFate(name, value.toLowerCase().replace(/\s+/g, ' '))
    const at = `${where}: ${shown(name, 'a property')}`
    if (fate === undefined) {
      if (name.startsWith('--')) refuse('unsupported', `${where} holds a custom property, which this format does not read`, CSS_ADVICE)
      if (GEOMETRY_PROPERTIES.has(name)) refuse('unsupported', `${at} is geometry in CSS, which this format reads from attributes alone`, 'write it as an attribute')
      refuse('unsupported', `${at} is not a property this format draws as a browser draws it`)
    }
    if (fate.fate === 'removed') removals.add('property', name)
    else if (fate.fate === 'refused') refuse('unsupported', `${at} is not drawn by this format`, fate.advice)
    else {
      if (hasNonAscii(value)) refuse('encoding', `${at} holds a byte past ASCII`)
      declared.set(fate.property, { value: readProperty(fate.property, value, at), where: at })
    }
  }
  return declared
}

/** An element's `style` attribute, read as a declaration block. */
export function readDeclarations(style: Located, removals: Removals): Declarations {
  return declarations(uncommented(style.value, style.where), style.where, removals)
}

const IDENTIFIER = '-?[A-Za-z_][A-Za-z0-9_-]*'
const COMPOUND = new RegExp(`^(${IDENTIFIER})?((?:[.#]${IDENTIFIER})*)$`)

export class Stylesheet {
  private readonly byId = new Map<string, Rule[]>()
  private readonly byClass = new Map<string, Rule[]>()
  private readonly byType = new Map<string, Rule[]>()
  /** Every class a rule names, in any part of a compound. */
  private readonly named = new Set<string>()

  constructor(styles: readonly Located[], removals: Removals) {
    const rules: Rule[] = []
    let simple = 0
    for (const style of styles) {
      const text = uncommented(style.value, style.where)
      if (text.includes('@')) refuse('unsupported', `${style.where} holds an at-rule, which this format does not read`, CSS_ADVICE)
      if (text.includes('<!--') || text.includes('-->')) refuse('unsupported', `${style.where} holds CSS markup this format does not read`, CSS_ADVICE)
      let at = 0
      for (;;) {
        const open = text.indexOf('{', at)
        if (open < 0) {
          if (text.slice(at).trim() !== '') refuse('unsupported', `${style.where} holds CSS outside a rule`, CSS_ADVICE)
          break
        }
        const close = text.indexOf('}', open)
        if (close < 0 || text.slice(open + 1, close).includes('{')) refuse('unsupported', `${style.where} holds a CSS rule that is not closed`, CSS_ADVICE)
        const block = declarations(text.slice(open + 1, close), style.where, removals)
        for (const selector of text.slice(at, open).split(',')) {
          const rule = this.rule(selector.trim(), style.where, block, rules.length)
          simple += (rule.type === undefined ? 0 : 1) + rule.parts
          if (simple > MAX_SVG_RULES) refuse('too-large', `the stylesheets hold more than ${MAX_SVG_RULES} selectors`, CSS_ADVICE)
          rules.push(rule.rule)
        }
        at = close + 1
      }
    }
    rules.sort((a, b) => a.specificity - b.specificity || a.order - b.order)
    rules.forEach((rule, rank) => {
      rule.rank = rank
      const [id] = rule.ids
      const [name] = rule.classes
      for (const name of rule.classes) this.named.add(name)
      if (id !== undefined) bucket(this.byId, id).push(rule)
      else if (name !== undefined) bucket(this.byClass, name).push(rule)
      else bucket(this.byType, rule.type as string).push(rule)
    })
  }

  private rule(selector: string, where: string, declared: Declarations, order: number): { readonly rule: Rule; readonly type: string | undefined; readonly parts: number } {
    if (hasNonAscii(selector)) refuse('encoding', `${where} holds a selector with a byte past ASCII`)
    const match = COMPOUND.exec(selector)
    if (selector === '' || match === null) refuse('unsupported', `${where} holds a selector this format does not read: a type, a class, an id or a compound of them alone`, CSS_ADVICE)
    const [, type, rest = ''] = match
    const parts = rest.match(/[.#][^.#]+/g) ?? []
    const classes = parts.filter((part) => part.startsWith('.')).map((part) => part.slice(1))
    const ids = parts.filter((part) => part.startsWith('#')).map((part) => part.slice(1))
    const specificity = ids.length * 1_000_000 + classes.length * 1_000 + (type === undefined ? 0 : 1)
    return {
      rule: { type, classes: new Set(classes), ids: new Set(ids), specificity, order, rank: 0, declarations: declared },
      type,
      parts: parts.length,
    }
  }

  /**
   * What every rule that matches the element declares, merged in cascade
   * order. Which rules match depends only on the element's type, on its id
   * when a rule names it and on the classes rules name, so the merge is
   * made once for each such combination: ten thousand elements of one
   * class matched by every rule are merged once, not ten thousand times.
   */
  matches(element: SvgElement): Declarations {
    const type = element.link ? 'a' : element.name
    const id = element.id !== undefined && this.byId.has(element.id) ? element.id : undefined
    const classes = [...new Set(element.classes)].filter((name) => this.named.has(name)).sort()
    const key = `${type} ${id ?? ''} ${classes.join(' ')}`
    const cached = this.merged.get(key)
    if (cached !== undefined) return cached
    const held = new Set(classes)
    const candidates: Rule[] = [...(id === undefined ? [] : (this.byId.get(id) ?? [])), ...classes.flatMap((name) => this.byClass.get(name) ?? []), ...(this.byType.get(type) ?? [])]
    this.spend(candidates.length)
    const matching = candidates
      .filter((rule) => (rule.type === undefined || rule.type === type) && [...rule.ids].every((ruleId) => ruleId === id) && [...rule.classes].every((name) => held.has(name)))
      .sort((a, b) => a.rank - b.rank)
    this.spend(matching.reduce((sum, rule) => sum + rule.declarations.size, 0))
    const merged = new Map<Property, Declared>()
    for (const rule of matching) for (const [property, value] of rule.declarations) merged.set(property, value)
    this.merged.set(key, merged)
    return merged
  }

  private readonly merged = new Map<string, Declarations>()
  /** The rules compared and the declarations merged so far, in all merges. */
  private work = 0

  /** `units` more of the work `MAX_SVG_CASCADE` bounds, refused before it is done when it would pass the bound. */
  private spend(units: number): void {
    this.work += units
    if (this.work > MAX_SVG_CASCADE) refuse('too-large', `the stylesheets would be matched against its elements more than ${MAX_SVG_CASCADE} times`, CSS_ADVICE)
  }
}

function bucket(index: Map<string, Rule[]>, key: string): Rule[] {
  let rules = index.get(key)
  if (rules === undefined) {
    rules = []
    index.set(key, rules)
  }
  return rules
}

/**
 * Each element's kept properties after the cascade, lowest to highest: its
 * presentation attributes, then the stylesheets' rules by specificity and
 * order, then its `style` attribute -- CSS's cascade for SVG. One value per
 * property; `INHERIT` where the winner said to inherit.
 */
export function cascade(element: SvgElement, sheet: Stylesheet, removals: Removals): Map<Property, Declared> {
  const specified = new Map<Property, Declared>()
  for (const [property, { value, where }] of element.presentation) specified.set(property, { value: readProperty(property, value, where), where })
  for (const [property, value] of sheet.matches(element)) specified.set(property, value)
  if (element.style !== undefined) for (const [property, value] of readDeclarations(element.style, removals)) specified.set(property, value)
  return specified
}
