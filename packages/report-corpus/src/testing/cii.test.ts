import { describe, expect, test } from 'vitest'
import { CII_NAMESPACES, elementsAt, pathsOf, readCii, textAt, textsAt } from './cii.js'

/**
 * The reader the corpus's e-invoice tests read the runtime's XML with. A
 * reader that took prefixes at their word, read a malformed file, or
 * passed over an element it does not know would let an XML the binding
 * does not describe pass every test that reads it.
 */

const { rsm, ram } = CII_NAMESPACES

describe('the CII reader', () => {
  // An element is its namespace, not its prefix: a file that binds other
  // prefixes to the binding's namespaces is the same file, and one that
  // binds `ram` to another namespace is not.
  test('knows an element by its namespace, under its own prefix', () => {
    const root = readCii(`<a:CrossIndustryInvoice xmlns:a="${rsm}" xmlns:b="${ram}"><b:ID>RE-1</b:ID></a:CrossIndustryInvoice>`)
    expect([root.name, textAt(root, 'ram:ID')]).toEqual(['rsm:CrossIndustryInvoice', 'RE-1'])
    expect(() => readCii(`<rsm:CrossIndustryInvoice xmlns:rsm="${rsm}" xmlns:ram="urn:example:other"><ram:ID>RE-1</ram:ID></rsm:CrossIndustryInvoice>`)).toThrow('an element of the namespace urn:example:other')
  })

  // A file a strict parser refuses is no e-invoice, whatever a lenient
  // one would make of it.
  test.each([
    ['an element left open', `<rsm:CrossIndustryInvoice xmlns:rsm="${rsm}">`],
    ['an ampersand unescaped', `<rsm:CrossIndustryInvoice xmlns:rsm="${rsm}">Muster & Söhne</rsm:CrossIndustryInvoice>`],
    ['no element at all', '<?xml version="1.0" encoding="UTF-8"?>'],
    ['text after the root', `<rsm:CrossIndustryInvoice xmlns:rsm="${rsm}"/>RE-1`],
  ])('refuses %s', (_, xml) => {
    expect(() => readCii(xml)).toThrow()
  })

  // A term is read where the binding puts it, in document order, and a
  // term that should be there once and is there twice is not read as one.
  test('reads each element at a path, in order, and refuses two where one is asked for', () => {
    const root = readCii(`<rsm:R xmlns:rsm="${rsm}" xmlns:ram="${ram}"><ram:L><ram:N unitCode="H87">1</ram:N></ram:L><ram:L><ram:N>2 &amp; 3</ram:N></ram:L></rsm:R>`)
    expect(textsAt(root, 'ram:L/ram:N')).toEqual(['1', '2 & 3'])
    expect(elementsAt(root, 'ram:L/ram:N').map((element) => element.attributes['unitCode'])).toEqual(['H87', undefined])
    expect(textAt(root, 'ram:L/ram:M')).toBeUndefined()
    expect(() => textAt(root, 'ram:L/ram:N')).toThrow('2 elements at ram:L/ram:N')
    const { texts, attributes } = pathsOf(root)
    expect([...texts]).toEqual([['rsm:R/ram:L/ram:N', ['1', '2 & 3']]])
    expect([...attributes]).toEqual([['rsm:R/ram:L/ram:N/@unitCode', ['H87']]])
  })
})
