import { describe, expect, test, vi } from 'vitest'
import { frozenSample } from '../test-support.js'
import { compileReport } from './compile-report.js'
import { compileSite } from './compile-site.js'

// No expression the parser reads a path of makes upstream's splice miss
// that path, so this file stands in a splice that finds nothing.
vi.mock('./spans.js', () => ({ readSpans: () => [] }))

describe('compileSite', () => {
  // A read whose place cannot be found is still an error: without a
  // position, never without the diagnostic, or the report would pass the
  // editor and fail at render.
  test('reports a read it cannot place, without a position', () => {
    const { members } = compileReport(frozenSample())
    const outcome = compileSite({ cel: 'row.nope > 1', scope: 'row', kind: 'visible', path: '/x/cel', componentId: 'lines' }, members, {}, false)
    expect(outcome).toEqual({
      ok: false,
      diagnostics: [{ severity: 'error', code: 'expression-unknown-name', message: expect.stringContaining('nope') as string, path: '/x/cel', componentId: 'lines' }],
    })
  })
})
