import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createReportEditor, scenarioReport } from '@formancy/report-builder-core'
import { ReportBuilder } from '@formancy/report-builder-react'
import { openReportSession } from '@formancy/report-core'
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, test } from 'vitest'

/**
 * The Studio's stylesheets, held to the promises studio.css makes: the
 * builder takes the room's geometry from builder.css and its colours only
 * from --wb-* (CLAUDE.md, "The same room"), nothing else of the Studio's
 * reaches into it, and the paper is the document's ("The page is the
 * document, not the room").
 *
 * The rules are read as the browser reads them -- jsdom's CSS object model,
 * in the order studio.css imports them -- and matched with the DOM's own
 * `matches`, not with a pattern over the text, so a selector that reaches
 * the builder or the paper by a route nobody thought of is caught too. What
 * jsdom cannot do -- lay out, compute a colour, resolve a media query -- is
 * the browser gate's.
 */

const styles = join(dirname(fileURLToPath(import.meta.url)))

interface Rule {
  readonly file: string
  readonly selector: string
  /** The properties it declares, each shorthand with the longhands jsdom expands it to. */
  readonly properties: readonly string[]
}

/** The files studio.css imports, in its order, read from its @import lines. */
function files(): string[] {
  const entry = readFileSync(join(styles, 'studio.css'), 'utf8')
  return [...entry.matchAll(/@import '\.\/(.+?)';/g)].map((match) => match[1] ?? '')
}

/** Every style rule of `text`, those inside @media included. */
function rulesOf(file: string, text: string): Rule[] {
  const found: Rule[] = []
  const style = document.createElement('style')
  style.textContent = text
  document.head.append(style)
  const walk = (list: CSSRuleList): void => {
    for (const rule of list) {
      if (rule instanceof CSSStyleRule) found.push({ file, selector: rule.selectorText, properties: Array.from({ length: rule.style.length }, (_, index) => rule.style.item(index)) })
      else if ('cssRules' in rule) walk((rule as CSSGroupingRule).cssRules)
    }
  }
  walk((style.sheet as CSSStyleSheet).cssRules)
  style.remove()
  return found
}

/** Every style rule of the Studio's stylesheets, with its file. */
const rules = (): Rule[] => files().flatMap((file) => rulesOf(file, readFileSync(join(styles, file), 'utf8')))

afterEach(() => {
  cleanup()
  document.body.replaceChildren()
})

/** Each selector of a list, without the pseudo-element `matches` cannot take: `::selection` applies to what the rest matches. */
const selectorsOf = (list: string): string[] => list.split(/,(?![^(]*\))/).map((one) => one.replace(/::[\w-]+(\([^)]*\))?$/, '').trim() || '*')

/**
 * A selector as it matches at some moment: the states the pointer or the
 * keyboard puts an element in taken off, so a rule for a focused select is
 * matched against every select -- as the browser gate's `rulesOnThePaper`.
 */
const always = (selector: string): string => selector.replace(/:(?:focus-visible|focus-within|focus|hover|active)(?![\w-])/g, '').trim() || '*'

/** A selector that names the builder: the workbench's classes, its parts, its panes, or its Angular element. */
const NAMES_BUILDER = /(^|[\s>+~(,])\.wb(-[\w-]+)?\b|\[data-(report-part|pane|panel)\b|\breport-builder\b/

/**
 * A property that sets a colour, or a shorthand that may: what the
 * workbench's --wb-* variables are for. `border` and `outline` say a
 * colour with their width; `background` and every `*-shadow` paint.
 */
const COLOUR = /colou?r|^background|shadow$|^(border|outline)(-(top|right|bottom|left|block|inline)(-(start|end))?)?$|^(fill|stroke)$/

/**
 * The room's three rules for every element, the builder's too, as the
 * admin's are (admin.css's `*`, `::selection` and `:focus-visible`): the box
 * model, the selection's violet and the teal focus ring. Nothing else of the
 * room's may reach inside the builder.
 */
const EVERYWHERE = new Set(['*:where(:not(.paper *))', ':where(:not(.paper *))::selection', ':where(:not(.paper *)):focus-visible'])

/** The React builder over the scenario report, the introduction selected and a text being placed by keyboard: every kind of control it draws. */
function builder(): Element[] {
  const opening = openReportSession(scenarioReport())
  if (!opening.ok) throw new Error('the scenario report does not open')
  const editor = createReportEditor(opening.session)
  editor.dispatch({ type: 'select', id: 'intro' })
  editor.dispatch({ type: 'startDrag', subject: { kind: 'text' }, via: 'keyboard' })
  const { container } = render(<ReportBuilder editor={editor} />)
  return [...container.querySelectorAll('.wb *')]
}

/** The rules of `list` that select an element of `inside`, said as `file: selector`. */
const reaching = (list: readonly Rule[], inside: readonly Element[]): string[] =>
  list.flatMap((rule) =>
    selectorsOf(rule.selector)
      .filter((selector) => inside.some((element) => element.matches(always(selector))))
      .map((selector) => `${rule.file}: ${selector}`),
  )

describe("the Studio's stylesheets", () => {
  // A guard on the guard: the assertions below are about absence, so a
  // reader that found no rules -- an import renamed, @media not walked --
  // would pass them forever.
  test('are read, every file and the rules inside @media', () => {
    const read = rules()
    expect(files()).toEqual(['styles/room.css', 'styles/controls.css', 'styles/shell.css', 'styles/builder.css', 'styles/preview.css', 'styles/narrow.css'])
    expect(read.length).toBeGreaterThan(50)
    expect(read.filter((rule) => rule.file === 'styles/narrow.css').length).toBeGreaterThan(5)
    // and each rule's declarations, which the colour check reads.
    expect(read.find((rule) => /^\.tool,\s*\.quiet$/.test(rule.selector))?.properties).toContain('min-height')
  })

  // The workbench's panes and report-builder.css's parts take their colours
  // from the --wb-* room.css sets, and from nothing else: a Studio rule that
  // paints `.wb-pane` or a part would dress the builder differently here
  // than in a host's page, where only the variables travel -- the same
  // builder, two looks. Geometry is the room's to give (builder.css); colour
  // is not.
  test('declare no colour on a rule that names the builder', () => {
    const painting = (list: readonly Rule[]): string[] =>
      list
        .filter((rule) => NAMES_BUILDER.test(rule.selector))
        .filter((rule) => rule.properties.some((property) => COLOUR.test(property)))
        .map((rule) => `${rule.file}: ${rule.selector} { ${rule.properties.filter((property) => COLOUR.test(property)).join(', ')} }`)
    // A guard on the guard: it finds a colour on the workbench's pane and on
    // a part, and lets the shape of a button through.
    const sample = rulesOf('sample', ".wb-pane > header { background-color: rgb(255 255 255 / 2%) } [data-report-part='title'] { color: white } .wb-pane button { border-radius: 999px }")
    expect(painting(sample)).toEqual(['sample: .wb-pane > header { background-color }', "sample: [data-report-part='title'] { color }"])
    expect(rules().filter((rule) => NAMES_BUILDER.test(rule.selector)).length).toBeGreaterThan(0)
    expect(painting(rules())).toEqual([])
  })

  // A rule written for the Studio's own controls -- a select, a button --
  // that also selects the builder's would dress them as the room's
  // controls: taller selects than the inputs beside them, a second focus
  // ring over the builder's own. Matched against the builder as React draws
  // it, every rule but builder.css's and the room's three for every element.
  test('reach inside the builder only from builder.css, and with the room’s box model, selection and focus ring', () => {
    const inside = builder()
    expect(inside.some((element) => element.matches('select'))).toBe(true)
    expect(inside.some((element) => element.matches('[role="dialog"] button'))).toBe(true)
    const studio = rules().filter((rule) => rule.file !== 'styles/builder.css' && !EVERYWHERE.has(rule.selector))
    expect(reaching(studio, inside)).toEqual([])
    // A guard on the guard: builder.css's rules do reach the builder drawn here.
    expect(reaching(rules().filter((rule) => rule.file === 'styles/builder.css'), inside).length).toBeGreaterThan(0)
  })

  // The paper is what prints. A rule of the room's on a page's canvas or on
  // PDF.js's text spans -- a font, a focus ring, box-sizing, a selection
  // colour -- would show something the PDF does not hold. Only rules that
  // are the paper's own (their selector names it) may match inside it: the
  // white page, and the text layer PDF.js expects.
  test('reach nothing on the paper but the rules that are its own', () => {
    document.body.innerHTML = '<div class="viewer"><div class="paper"><div class="paper-page"><canvas></canvas><div class="paper-text"><span>Total</span><br><span class="markedContent"><span>CHF</span></span></div></div></div></div>'
    const inside = [...document.querySelectorAll('.paper *')]
    expect(inside.length).toBe(7)
    expect(reaching(rules().filter((rule) => !rule.selector.includes('.paper')), inside)).toEqual([])
    // A guard on the guard: the room's own element rules do reach an element
    // that is not on the paper.
    document.body.insertAdjacentHTML('beforeend', '<button>Off the paper</button>')
    const button = document.querySelector('body > button') as Element
    expect(rules().some((rule) => selectorsOf(rule.selector).some((selector) => button.matches(selector)))).toBe(true)
  })
})
