/**
 * The latest request, and only the latest: what keeps the preview from
 * showing a document that is gone.
 *
 * A request waits `delay` milliseconds for the next one, so that typing is
 * rendered once rather than once a key; a request asked for `now` does not.
 * Each run gets a signal of its own, aborted the moment another request
 * arrives, and a run's result is delivered only while it is the latest: a
 * render the renderer could not stop between its passes (0011) finishes
 * into nothing.
 */
export interface Latest<I> {
  request(input: I, options?: { readonly now?: boolean }): void
  /** Aborts what is running, forgets what is waiting, and delivers nothing more. */
  dispose(): void
}

export interface LatestOptions<I, O> {
  readonly delay: number
  /** The work, which reads `signal`; an outcome it can report, a refusal included, resolves. */
  readonly run: (input: I, signal: AbortSignal) => Promise<O>
  readonly deliver: (output: O, input: I) => void
  /** A run that rejected while it was the latest: a fault, not an outcome. */
  readonly fail?: (error: unknown, input: I) => void
}

export function latest<I, O>({ delay, run, deliver, fail }: LatestOptions<I, O>): Latest<I> {
  let timer: ReturnType<typeof setTimeout> | undefined
  let current: AbortController | undefined
  let disposed = false

  function start(input: I): void {
    timer = undefined
    const controller = new AbortController()
    current = controller
    const mine = (): boolean => !disposed && current === controller && !controller.signal.aborted
    run(input, controller.signal).then(
      (output) => {
        if (mine()) deliver(output, input)
      },
      (error: unknown) => {
        if (mine()) fail?.(error, input)
      },
    )
  }

  function stop(): void {
    if (timer !== undefined) clearTimeout(timer)
    timer = undefined
    current?.abort()
    current = undefined
  }

  return {
    request(input, options = {}) {
      if (disposed) return
      stop()
      if (options.now === true) start(input)
      else timer = setTimeout(() => start(input), delay)
    },
    dispose() {
      disposed = true
      stop()
    },
  }
}
