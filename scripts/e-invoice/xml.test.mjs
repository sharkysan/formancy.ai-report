import { describe, expect, test } from 'vitest'
import { attribute, childOf, childrenOf, descendants, readXml, textOf } from './xml.mjs'

/**
 * The XML reader every judge reads a tool's output with, and the oracle
 * the pinned schematrons with (0027): saxes, strictly, with namespaces
 * resolved, so an element is known by its namespace and local name and
 * never by the prefix a tool happened to write.
 */
const REP = 'http://www.xoev.de/de/validator/varl/1'

describe('readXml', () => {
  // KoSIT writes its report under `rep:`; a prefix is the writer's choice,
  // so a reader that matched `rep:accept` would miss the same report written
  // under another, and find an element of another namespace written under
  // that one.
  test('knows an element by its namespace and local name, whatever its prefix', () => {
    const root = readXml(
      `<?xml version="1.0"?><r:report xmlns:r="${REP}" valid="true"><r:assessment><r:accept/></r:assessment><x:accept xmlns:x="urn:other"/></r:report>`,
    )
    expect([root.uri, root.local, attribute(root, 'valid')]).toEqual([REP, 'report', 'true'])
    expect(childOf(root, REP, 'assessment') && childOf(childOf(root, REP, 'assessment'), REP, 'accept')?.local).toBe('accept')
    expect(childrenOf(root, REP, 'accept')).toEqual([])
    expect(descendants(root, REP, 'accept')).toHaveLength(1)
  })

  // A message's text is what a judge reports and an id is read out of:
  // entities, character references and CDATA are given back as the text
  // they stand for, across the pieces the parser hands them in.
  test('gives back an element’s own text whole, references and CDATA resolved', () => {
    const root = readXml('<m>[ID BR-27] a &lt; b &amp; c &#956;<![CDATA[ <raw> ]]><child>not mine</child></m>')
    expect(textOf(root)).toBe('[ID BR-27] a < b & c μ <raw> ')
    expect(textOf(childOf(root, '', 'child'))).toBe('not mine')
  })

  // A tool that crashed mid-write leaves half a report; read as an empty
  // one it would be a pass. A DOCTYPE is refused too: no output the gate
  // reads has one, and one could declare what the reader should not expand.
  test('refuses a document that is not well formed, has no root, or declares a DOCTYPE', () => {
    expect(() => readXml('<validation><xml>')).toThrow()
    expect(() => readXml('')).toThrow()
    expect(() => readXml('<!DOCTYPE r [<!ENTITY e "x">]><r>&e;</r>')).toThrow('a DOCTYPE, which no output the gate reads has')
    expect(() => readXml('<a xmlns:p="urn:p"><q:b/></a>')).toThrow()
  })
})
