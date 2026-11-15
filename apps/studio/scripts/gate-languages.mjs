// A report's languages in a real browser (0063): what jsdom cannot show of
// them is what the Preview prints, or refuses, in the language the builder
// shows, drawn by PDF.js on the paper.
//
// On the invoice, in the builder `framework` names, at every pass of the
// journey: French added from the keyboard at the report's level -- Add
// language typed into and left with Tab -- and the switch between the
// report's languages then in the bar, which the page holds without
// scrolling sideways at every width; French chosen in it, and the Preview
// refusing it while its words are missing, the runtime's reason listed;
// the title's French typed into the title's field, which in French is
// empty, the German its placeholder; the report's own chosen again, and
// the Preview printing the German invoice, its title a line of the paper;
// and both steps undone from the toolbar, the switch gone with the
// language. Everything is undone, so the journey goes on from the invoice
// as it was.
//
// Found by role and accessible name, but for two things read from the
// DOM: the paper's lines, from PDF.js's text layer (`untilLine`), as every
// check of what printed reads them; and whether the toolbar's Undo is
// unavailable, `aria-disabled`, which a builder keeps in the tree.

import { STARTERS } from '@formancy/report-corpus'
import { editorOf, open, present, previewOf, said, settled, showing, untilLine } from './gate-steps.mjs'

/** What the Preview says while the runtime refuses the language shown. */
const REFUSED = /^Preview: refused by the runtime, \d+ problems?\.$/
/** The language added, and the report's own: the invoice starter is Swiss German. */
const ADDED = 'fr-CH'
const OWN = 'de-CH'
/** The invoice's title in its own language: what its title's field shows in French until it is written there. */
const TITLE = STARTERS.find((starter) => starter.id === 'invoice')?.report.title

/** Null once `promise` settles, or the first line of why it failed. */
const outcome = (promise) =>
  promise.then(
    () => null,
    (error) => String(error?.message ?? error).split('\n')[0],
  )

/** The checks, in the builder shown, which `framework` names. */
export async function languageChecks(gate, page, framework) {
  const { check } = gate
  const editor = editorOf(page)
  await open(page, 'invoice')
  await settled(page)

  // The report's own properties, and Add language typed into and left as
  // a keyboard leaves it: the switch appears in the bar with the language.
  // The Properties pane is shown first, since a narrow builder draws one
  // pane at a time and a pane it hides is in no accessibility tree; then,
  // where what the checks before left selected is shown there, the
  // report's own, as a person goes back to it.
  const add = editor.getByRole('textbox', { name: said('field.addLanguage'), exact: true })
  const toReport = editor.getByRole('button', { name: said('properties.report'), exact: true })
  await showing(editor, 'Properties', add.or(toReport).first())
  if ((await toReport.count()) === 1) await toReport.click()
  await add.waitFor()
  await add.focus()
  await page.keyboard.type(ADDED)
  await page.keyboard.press('Tab')
  const switcher = editor.getByRole('combobox', { name: said('language.label'), exact: true })
  check(`${framework}: a language typed into Add language and left with Tab is added, its switch in the bar`, await present(switcher, 'switch'))
  const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  check(
    `${framework}: and the bar holds the switch without the page scrolling sideways`,
    sideways <= 0 ? null : `the page scrolls ${String(sideways)}px sideways`,
  )

  // French shown: the Preview refuses it while a word is missing, and
  // lists why, in the runtime's words.
  await switcher.selectOption(ADDED)
  check(`${framework}: French chosen, the Preview refuses it while its words are missing`, await outcome(settled(page, REFUSED)))
  const reason = previewOf(page)
    .getByRole('list', { name: 'Why the preview was not printed', exact: true })
    .getByText(`has no translation in ${ADDED}`, { exact: false })
    .first()
  check(`${framework}: and lists a word missing in French among why`, await present(reason, 'word missing among the reasons'))

  // The title's French, typed where the German is the empty field's placeholder.
  const title = await showing(editor, 'Properties', editor.getByRole('textbox', { name: said('field.title'), exact: true }))
  const shown = { value: await title.inputValue(), placeholder: await title.getAttribute('placeholder') }
  check(
    `${framework}: in French the title's field is empty, the German its placeholder`,
    shown.value === '' && shown.placeholder === TITLE ? null : `it shows ${JSON.stringify(shown)}, not ${JSON.stringify({ value: '', placeholder: TITLE })}`,
  )
  await title.fill('Facture')
  await title.press('Tab')
  const written = editor
    .getByRole('status')
    .filter({ hasText: said('status.changed', { field: said('field.title') }) })
    .first()
  check(`${framework}: the title's French is typed into its field`, await present(written, 'word that it changed'))

  // The report's own chosen again: the German invoice prints.
  await switcher.selectOption(OWN)
  check(`${framework}: the report's own chosen again, the Preview prints its German title`, await outcome(untilLine(page, 'Rechnung')))

  // Both steps undone from the toolbar: the language goes, and its switch with it.
  const undo = editor.getByRole('toolbar', { name: said('toolbar.label'), exact: true }).getByRole('button', { name: said('action.undo'), exact: true })
  for (let step = 0; step < 2; step += 1) if ((await undo.getAttribute('aria-disabled')) !== 'true') await undo.click()
  const gone = await outcome(switcher.waitFor({ state: 'detached', timeout: 5_000 }))
  check(`${framework}: undone, the language is gone with its switch`, gone)
  await settled(page)
}
