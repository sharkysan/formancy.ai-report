import { describe, expect, test } from 'vitest'
import { annotated, annotation, form, widget } from './annotations-test-support.js'
import { DOCUMENT_NOTICE_CODES, noticesOf, Tally, type DocumentNotice } from './notices.js'
import { parsed } from './parse-test-support.js'
import { Counted, printedWhole } from './pages-test-support.js'
import { latin1 } from './test-pdf.js'

/**
 * What a document holds that does not survive printing, said to whoever
 * adds it: how many of each kind, and never what anything is called.
 */

/** The notices a file prints with. */
const noticed = (bytes: Uint8Array): readonly DocumentNotice[] => printedWhole(bytes).notices

describe('a notice', () => {
  // A document's scripts, the action it runs when it opens, the files it
  // embeds and its form fields do not survive printing, and the author is
  // told how many of each -- never what they are called or hold: a
  // script's name, a file's name or a field's value may be a person's
  // data, and a notice is shown to whoever builds the report. A notice is
  // a code and a count and nothing else.
  test('JavaScript, open actions, embedded files and form fields are counted, and a notice holds a count and never a name', () => {
    const notices = noticed(
      annotated(
        [
          widget('/FT/Tx/T(Employee name)/V(Jane Roe)/Rect[72 700 272 720]/AP<</N 40 0 R>>'),
          widget('/FT/Ch/T(Department)/V(Payroll)/Rect[72 650 272 670]/AP<</N 40 0 R>>'),
        ],
        {
          catalog: '/Names<</JavaScript 30 0 R/EmbeddedFiles 33 0 R>>/OpenAction 35 0 R',
          objects: {
            30: '<</Kids[31 0 R 32 0 R]>>',
            31: '<</Names[(SecretInit) 36 0 R (Validate) 36 0 R]>>',
            32: '<</Names[(Zeta) 36 0 R]>>',
            33: '<</Names[(salary-2026.xlsx) 34 0 R]>>',
            34: '<</Type/Filespec/F(salary-2026.xlsx)/EF<</F 37 0 R>>>>',
            35: '<</S/JavaScript/JS(this.print)>>',
            36: '<</S/JavaScript/JS(this.print)>>',
            37: { dict: '/Type/EmbeddedFile', data: latin1('Jane Roe, 120000') },
            40: form('[0 0 200 20]'),
          },
        },
      ),
    )
    expect(notices).toEqual([
      { code: 'javascript', count: 4 },
      { code: 'attachments', count: 1 },
      { code: 'form-fields', count: 2 },
    ])
    for (const notice of notices) expect(Object.keys(notice).sort()).toEqual(['code', 'count'])
    const said = JSON.stringify(notices)
    for (const name of ['Secret', 'Validate', 'salary', 'Jane', 'Employee', 'Payroll', 'this.print']) expect(said).not.toContain(name)
    expect(noticed(annotated([], { catalog: '/OpenAction<</S/URI/URI(https://example.com/track)>>' }))).toEqual([{ code: 'actions', count: 1 }])
  })

  // A notice is for something the document holds: none where it holds
  // nothing that does not survive, never a count of nothing -- an empty
  // tree of scripts is none -- and in one order, DOCUMENT_NOTICE_CODES',
  // whatever order the file holds them in, so that two reads of a document
  // say the same.
  test('a code nothing counted is no notice, and the notices keep the order of the codes', () => {
    expect(noticed(annotated([]))).toEqual([])
    expect(noticed(annotated([], { catalog: '/Names<</JavaScript<</Names[]>>/EmbeddedFiles<<>>>>' }))).toEqual([])
    const every = noticed(
      annotated(
        [
          annotation('Text', '/Rect[0 0 10 10]', 2),
          widget('/FT/Tx/Rect[0 0 0 0]'),
          widget('/FT/Sig/V 30 0 R/Rect[0 0 0 0]'),
          annotation('FileAttachment', '/Rect[0 0 0 0]'),
          annotation('Link', '/Rect[0 0 10 10]/Border[0 0 0]'),
        ],
        {
          catalog: '/AA<</WC 32 0 R>>/Names<</JavaScript<</Names[(a) 31 0 R]>>>>',
          objects: { 30: '<</Type/Sig>>', 31: '<</S/JavaScript/JS(1)>>', 32: '<</S/Named/N/Print>>' },
        },
      ),
    )
    expect(every.map((notice) => notice.code)).toEqual([...DOCUMENT_NOTICE_CODES])
    expect(every.every((notice) => notice.count === 1)).toBe(true)
  })

  // Each action an /AA holds -- the document's, a page's, an annotation's,
  // printed or not -- runs on an event a print never raises, and is
  // counted: a script as a script, any other as an action. An /AA is read
  // under the triggers ISO 32000-1 defines (Tables 194 to 197), looked up
  // by name and never walked, so that a key no viewer runs is no action and
  // an /AA of a million keys costs what one of twenty does; an entry that
  // is no action, or an /AA that is no dictionary, is none.
  test('every action an /AA holds is counted under the triggers ISO defines, a script as javascript', () => {
    const notices = noticed(
      annotated(
        [
          annotation('Stamp', '/AA<</E 30 0 R/X 31 0 R/Zz 31 0 R>>/Rect[0 0 10 10]/AP<</N 40 0 R>>'),
          annotation('Text', '/AA<</PO 31 0 R>>/Rect[0 0 10 10]', 0),
        ],
        {
          catalog: '/AA<</WC 31 0 R/WS 30 0 R/DP 32 0 R>>',
          page: '/AA<</O 31 0 R/C 30 0 R>>',
          objects: { 30: '<</S/JavaScript/JS(1)>>', 31: '<</S/Named/N/Print>>', 32: '[1 2]', 40: form('[0 0 10 10]') },
        },
      ),
    )
    expect(notices).toEqual([
      { code: 'javascript', count: 3 },
      { code: 'actions', count: 4 },
      { code: 'unprinted-annotations', count: 1 },
    ])
    expect(noticed(annotated([annotation('Square', '/AA 99 0 R/Rect[0 0 0 0]')], { catalog: '/AA 5' }))).toEqual([])
  })

  // An annotation's own action, a widget's among them -- a button that
  // submits the form, runs a script, opens a page -- does not survive
  // printing either, and is counted; a link's is the link, counted as one.
  // A field's /AA -- calculate, format, validate, keystroke -- is the
  // field's, wherever it stands up its widget's /Parent, and counted once
  // for the field, however many widgets it has. An action's /Next is not
  // followed.
  test('every action an annotation or a field holds is counted, a field once however many widgets it has', () => {
    const notices = noticed(
      annotated(
        [
          widget('/FT/Btn/Rect[0 0 10 10]/A 33 0 R/AP<</N 40 0 R>>'),
          widget('/FT/Tx/Rect[0 0 0 0]/AA<</K 33 0 R/F 34 0 R>>'),
          widget('/Parent 30 0 R/Rect[0 0 0 0]'),
          widget('/Parent 30 0 R/Rect[0 0 0 0]'),
          annotation('Square', '/Rect[0 0 0 0]/A 34 0 R'),
          annotation('Link', '/Rect[0 0 10 10]/Border[0 0 0]/A 34 0 R'),
        ],
        {
          objects: {
            30: '<</FT/Tx/T(total)/Parent 35 0 R/Kids[22 0 R 23 0 R]/AA<</C 33 0 R/V 34 0 R>>>>',
            35: '<</T(form)/Kids[30 0 R]/AA<</K 34 0 R>>>>',
            33: '<</S/JavaScript/JS(1)/Next<</S/JavaScript/JS(2)>>>>',
            34: '<</S/URI/URI(https://example.com)>>',
            40: form('[0 0 10 10]'),
          },
        },
      ),
    )
    expect(notices).toEqual([
      { code: 'links', count: 1 },
      { code: 'javascript', count: 3 },
      { code: 'actions', count: 4 },
      { code: 'form-fields', count: 4 },
    ])
  })

  // An open action that opens the document at a view -- a destination, or
  // a GoTo to one -- is lost in nothing a print shows; any other is an
  // action that does not survive printing, and a script, however its kind
  // is written, is a script. An /OpenAction that names nothing is none. A
  // GoTo with a /Next is a view no longer: /Next is not followed, so what
  // runs after it -- a script, as like as not -- is counted as an action,
  // or the file would open running a script that no notice mentions.
  test('an open action that opens a view is none, and any other is counted, a script as javascript', () => {
    const opened = (action: string): readonly DocumentNotice[] =>
      noticed(annotated([], { catalog: `/OpenAction ${action}`, objects: { 30: '/GoTo', 31: '/JavaScript' } }))
    for (const view of ['[10 0 R/Fit]', '<</S/GoTo/D[10 0 R/Fit]>>', '<</S 30 0 R/D[10 0 R/Fit]>>', '99 0 R']) expect(opened(view)).toEqual([])
    expect(opened('<</S/Named/N/Print>>')).toEqual([{ code: 'actions', count: 1 }])
    expect(opened('<</S 31 0 R/JS(1)>>')).toEqual([{ code: 'javascript', count: 1 }])
    for (const next of ['<</S/JavaScript/JS(1)>>', '[<</S/JavaScript/JS(1)>>]'])
      expect(opened(`<</S/GoTo/D[10 0 R/Fit]/Next ${next}>>`)).toEqual([{ code: 'actions', count: 1 }])
  })

  // A name tree's kids may name one another, or one list of kids many
  // nodes share: walked as written, the first would never end, and the
  // second would cost every node the whole list -- a thousand nodes
  // sharing a list of a thousand, a million look-ups. Each list is read
  // once, which the objects map counts, so that a walk that read one again
  // stops at the count rather than spins; entries a list holds once are
  // counted once, and a key with no value is no entry.
  test("a name tree's lists are each read once, however its nodes name one another", () => {
    const cycled = { 30: '<</Kids[30 0 R 31 0 R 31 0 R]>>', 31: '<</Names[(a) 32 0 R (b) 32 0 R (c)]>>', 32: '<</S/JavaScript/JS(1)>>' }
    const tree = parsed(annotated([], { catalog: '/Names<</JavaScript 30 0 R>>', objects: cycled }))
    expect(noticesOf({ ...tree, objects: new Counted(tree.objects, 100) }, new Tally())).toEqual([{ code: 'javascript', count: 2 }])

    const nodes = 1_000
    const kids = Array.from({ length: nodes }, (_, i) => `${100 + i} 0 R`).join(' ')
    const objects: Record<number, string> = { 29: '<</Kids 30 0 R>>', 30: `[${kids}]`, 33: '[(a) 32 0 R]', 32: '<</S/JavaScript/JS(1)>>' }
    for (let i = 0; i < nodes; i += 1) objects[100 + i] = '<</Kids 30 0 R/Names 33 0 R>>'
    const document = parsed(annotated([], { catalog: '/Names<</JavaScript 29 0 R>>', objects }))
    const counted = new Counted(document.objects, 5 * nodes)
    expect(noticesOf({ ...document, objects: counted }, new Tally())).toEqual([{ code: 'javascript', count: 1 }])
    expect(counted.gets).toBeLessThan(counted.limit)
  })
})
