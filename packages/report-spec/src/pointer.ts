/**
 * JSON Pointers (RFC 6901), the one way this package says where something
 * is: validation errors and `walkComponents` use the same paths, so an
 * error can be matched to the component it is about.
 */

/**
 * `path` extended by one key or index, escaped as RFC 6901 says.
 *
 * Validation builds a path for every property it reads, so the common case
 * -- an index, or a key with nothing to escape -- is a concatenation; the
 * two replacements took half of validation's time when they ran on every
 * key (measured with --cpu-prof on a 40-component report, 14 October 2026).
 */
export function at(path: string, key: string | number): string {
  if (typeof key === 'number' || !(key.includes('~') || key.includes('/'))) return `${path}/${key}`
  return `${path}/${key.replaceAll('~', '~0').replaceAll('/', '~1')}`
}
