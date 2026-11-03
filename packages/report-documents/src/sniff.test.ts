import { expect, test } from 'vitest'
import { isPdf } from './index.js'

const ascii = (text: string): Uint8Array => Uint8Array.from(text, (character) => character.charCodeAt(0) & 0xff)

// A PDF found only past junk is one a viewer may read and the strict reader refuses: never called a PDF.
test('isPdf takes a header at the first byte and nothing else', () => {
  expect(isPdf(ascii('%PDF-1.7\n'))).toBe(true)
  expect(isPdf(ascii('%PDF-2.0\n'))).toBe(true)
  expect(isPdf(ascii('﻿%PDF-1.7'))).toBe(false)
  expect(isPdf(ascii(' %PDF-1.7'))).toBe(false)
  expect(isPdf(ascii('%PDF-3.0'))).toBe(false)
  expect(isPdf(new Uint8Array())).toBe(false)
})
