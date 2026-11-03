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
        { catalog: '/AA<</WC 31 0 R>>/Names<</JavaScript<</Names[(a) 31 0 R]>>>>', objects: { 30: '<</Type/Sig>>', 31: '<</S/JavaScript/JS(1)>>' } },
      ),
    )
    expect(every.map((notice) => notice.code)).toEqual([...DOCUMENT_NOTICE_CODES])
    expect(every.every((notice) => notice.count === 1)).toBe(true)
  })

  // Every /AA -- the document's, a page's, an annotation's -- runs an action
  // on an event a print never raises, and is counted, printed or not; so is
  // an open action that is not a script, and one that is, however its kind
  // is written, is a script. A destination the document opens at is a
  // view, not an action, and an /OpenAction that names nothing is none.
  test('every /AA is an action, and so is an open action that is not a script', () => {
    const notices = noticed(
      annotated([annotation('Stamp', '/AA<</E 30 0 R>>/Rect[0 0 10 10]/AP<</N 40 0 R>>'), annotation('Text', '/AA<</E 30 0 R>>/Rect[0 0 10 10]', 0)], {
        catalog: '/AA<</WC 30 0 R>>/OpenAction 31 0 R',
        page: '/AA<</O 30 0 R>>',
        objects: { 30: '<</S/JavaScript/JS(1)>>', 31: '<</S/Named/N/Print>>', 40: form('[0 0 10 10]') },
      }),
    )
    expect(notices).toEqual([
      { code: 'actions', count: 5 },
      { code: 'unprinted-annotations', count: 1 },
    ])
    expect(noticed(annotated([], { catalog: '/OpenAction[10 0 R/Fit]' }))).toEqual([])
    expect(noticed(annotated([], { catalog: '/OpenAction 99 0 R' }))).toEqual([])
    expect(noticed(annotated([], { catalog: '/OpenAction<</S 30 0 R/JS(1)>>', objects: { 30: '/JavaScript' } }))).toEqual([{ code: 'javascript', count: 1 }])
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
