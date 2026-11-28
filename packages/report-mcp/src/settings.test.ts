import { describe, expect, test } from 'vitest'
import { isFilePath } from './settings.js'

/**
 * What a token's file may be named by, on either kind of system (0088):
 * held here by the rule itself, for both, since the suite runs on one
 * system at a time and a case that ran on one alone would be skipped on
 * the other. main.test.ts holds the bin to it on the system it runs on.
 */
describe('a file a token is read from', () => {
  // A file is read again before every request, from wherever the bin then
  // runs: a relative path would read another file once the client started
  // the bin elsewhere.
  test('is named by an absolute path on a POSIX system', () => {
    for (const path of ['/home/me/.config/reports/token', '/run/secrets/token']) expect(isFilePath(path, false), path).toBe(true)
    for (const path of ['token', './token', '../token', 'C:\\Users\\me\\token']) expect(isFilePath(path, false), path).toBe(false)
  })

  // On Windows a path from the root alone, `\token` or `/home/me/token`, is
  // absolute to Node and names a file on whichever drive the bin runs
  // from; one with a drive and no separator, `C:token`, is relative to
  // that drive's current directory. A drive and its root, or a share, name
  // one file.
  test('is named by a drive and its root, or a share, on Windows', () => {
    for (const path of ['C:\\Users\\me\\token', 'D:/secrets/token', '\\\\server\\share\\token', '//server/share/token'])
      expect(isFilePath(path, true), path).toBe(true)
    for (const path of ['/home/me/token', '\\token', 'C:token', 'token', '\\\\', '//']) expect(isFilePath(path, true), path).toBe(false)
  })
})
