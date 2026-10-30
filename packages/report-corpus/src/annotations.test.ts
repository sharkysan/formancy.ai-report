import { describe, expect, test } from 'vitest'
import { readAnnotations } from './annotations.js'
import { pdfmakePdf } from './testing/pdfmake.js'

describe('readAnnotations', () => {
  // A link is what a page carries and does not draw: a reader that missed
  // one would say a page holds no link that would take its reader to an
  // address. pdfmake writes a link annotation for a node's `link`, on the
  // page the node is laid out on, with the address as given.
  test('reads each link on the page it is on, with its address', async () => {
    const pdf = await pdfmakePdf({ content: [{ text: 'first' }, { text: 'Visit', link: 'https://example.invalid/visit', pageBreak: 'before' }] })
    expect(await readAnnotations(pdf)).toEqual([{ page: 2, subtype: 'Link', url: 'https://example.invalid/visit' }])
  })

  // PDF.js does not follow a javascript: address, and does not give it as
  // the link's url; a reader that read only that would say a page with one
  // holds a link to nowhere, and a check for addresses would pass it.
  test('reads an address PDF.js would not follow as it is written', async () => {
    const pdf = await pdfmakePdf({ content: [{ text: 'Run', link: 'javascript:app.alert(1)' }] })
    expect(await readAnnotations(pdf)).toEqual([{ page: 1, subtype: 'Link', url: 'javascript:app.alert(1)' }])
  })

  // A link to a page of the document goes nowhere outside it: it is read
  // as a link, with no address.
  test('reads a link to a page as a link with no address', async () => {
    const pdf = await pdfmakePdf({
      content: [
        { text: 'Onwards', linkToPage: 2 },
        { text: 'Page 2', pageBreak: 'before' },
      ],
    })
    expect(await readAnnotations(pdf)).toEqual([{ page: 1, subtype: 'Link' }])
  })

  // The claim a renderer's tests make most: none at all.
  test('reads none on pages that carry none', async () => {
    expect(await readAnnotations(await pdfmakePdf({ content: [{ text: 'plain' }, { text: 'more', pageBreak: 'before' }] }))).toEqual([])
  })
})
