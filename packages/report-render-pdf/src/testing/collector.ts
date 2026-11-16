import { setFlagsFromString } from 'node:v8'
import { runInNewContext } from 'node:vm'

/**
 * V8's collector, for the tests that show a render lets go of what it
 * measured by (0043): what a test still reaches is no proof that nothing
 * else does, and only a collection shows a render's widths were let go.
 */

/**
 * V8's collector, which `--expose-gc` lets a script run: the flag set once
 * V8 has started, for the one context made to take `gc` from, and turned
 * off again, so that no other context of the worker's sees it.
 */
export function collector(): () => void {
  setFlagsFromString('--expose-gc')
  try {
    return runInNewContext('gc') as () => void
  } finally {
    setFlagsFromString('--no-expose-gc')
  }
}

/** The rest of this turn let go, in which a WeakRef keeps what it was made of or dereferenced to. */
export const turn = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

/**
 * Whether what `refs` were made of is gone once the turn it was let go in
 * has passed: collected up to three times, a turn apart, so that an
 * unlucky collection is not a failure and an object truly kept still is.
 */
export async function collected(refs: readonly WeakRef<object>[]): Promise<boolean> {
  const gc = collector()
  for (let collection = 0; collection < 3; collection += 1) {
    await turn()
    gc()
    if (refs.every((ref) => ref.deref() === undefined)) return true
  }
  return false
}
