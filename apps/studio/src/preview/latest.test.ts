import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'
import { latest } from './latest.js'

/** A run that waits for the test to finish it, and remembers the signal it was given. */
function controlled() {
  const runs: { input: string; signal: AbortSignal; finish: (output: string) => void }[] = []
  const run = (input: string, signal: AbortSignal) =>
    new Promise<string>((resolve) => {
      runs.push({ input, signal, finish: resolve })
    })
  return { runs, run }
}

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('the latest render, and only the latest', () => {
  // Typing a title is an edit per key. Rendering each would lay the report
  // out with pdfmake once a key, on the page's own thread; only the last
  // within the delay is run.
  test('runs once for edits that arrive within the delay, with the last of them', async () => {
    const { runs, run } = controlled()
    const delivered: string[] = []
    const renders = latest({ delay: 300, run, deliver: (output) => delivered.push(output) })
    renders.request('a')
    await vi.advanceTimersByTimeAsync(200)
    renders.request('ab')
    await vi.advanceTimersByTimeAsync(299)
    expect(runs).toEqual([])
    await vi.advanceTimersByTimeAsync(1)
    expect(runs.map((each) => each.input)).toEqual(['ab'])
    runs[0]?.finish('pdf of ab')
    await vi.advanceTimersByTimeAsync(0)
    expect(delivered).toEqual(['pdf of ab'])
  })

  // A render still running when the document changes is of a document that
  // is gone: its signal is aborted, which the renderer reads between its
  // passes, and should it finish anyway its PDF is never shown -- the
  // preview would otherwise show an older document after a newer one.
  test('aborts a run the next request overtakes, and never delivers it', async () => {
    const { runs, run } = controlled()
    const delivered: string[] = []
    const renders = latest({ delay: 300, run, deliver: (output, input) => delivered.push(`${output} for ${input}`) })
    renders.request('first')
    await vi.advanceTimersByTimeAsync(300)
    renders.request('second')
    expect(runs[0]?.signal.aborted).toBe(true)
    await vi.advanceTimersByTimeAsync(300)
    runs[1]?.finish('new')
    runs[0]?.finish('old')
    await vi.advanceTimersByTimeAsync(0)
    expect(delivered).toEqual(['new for second'])
  })

  // Switching between preview and final, or to another starter, is not
  // typing: it runs at once, and still aborts what was running.
  test('runs a request asked for now without the delay', async () => {
    const { runs, run } = controlled()
    const renders = latest({ delay: 300, run, deliver: () => undefined })
    renders.request('typed')
    renders.request('final', { now: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(runs.map((each) => each.input)).toEqual(['final'])
    await vi.advanceTimersByTimeAsync(1000)
    expect(runs.map((each) => each.input)).toEqual(['final'])
  })

  // Unmounted, the pane is gone: what was waiting never runs, and what was
  // running is aborted and never delivered into a pane that no longer exists.
  test('stops everything once disposed', async () => {
    const { runs, run } = controlled()
    const delivered: string[] = []
    const renders = latest({ delay: 300, run, deliver: (output) => delivered.push(output) })
    renders.request('running', { now: true })
    await vi.advanceTimersByTimeAsync(0)
    renders.dispose()
    renders.request('after')
    await vi.advanceTimersByTimeAsync(1000)
    runs[0]?.finish('late')
    await vi.advanceTimersByTimeAsync(0)
    expect(runs.map((each) => each.input)).toEqual(['running'])
    expect(runs[0]?.signal.aborted).toBe(true)
    expect(delivered).toEqual([])
  })

  // A run that throws -- a bug, not a refusal, which comes back as an
  // outcome -- is reported once, for the latest request only, rather than
  // lost in an unhandled rejection with the pane waiting forever.
  test('reports a run that throws, when it is the latest', async () => {
    const failed: unknown[] = []
    const renders = latest<string, string>({ delay: 0, run: (input) => (input === 'bad' ? Promise.reject(new Error('broke')) : Promise.resolve(input)), deliver: () => undefined, fail: (error) => failed.push(error) })
    renders.request('bad', { now: true })
    await vi.advanceTimersByTimeAsync(0)
    expect(failed).toEqual([new Error('broke')])
  })
})
