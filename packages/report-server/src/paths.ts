/**
 * The paths the server routes, by formancy.ai-data 0037's rule.
 *
 * A proxy in front of the server may decode a path, resolve its `.` and `..`
 * segments and collapse its slashes before it chooses where to forward it;
 * Fastify's router matches the path as sent, decoding it on its own terms,
 * so `/v1/%77hoami` reached whoami. Rather than model anybody's
 * normalisation, the server routes only a path with nothing in it to
 * normalise, and refuses every other before any route's work. No route
 * Report answers is written otherwise, and the parameters later routes
 * take -- a template's id, a version's number, an asset's digest -- are
 * held to the same when they arrive.
 */

/** One segment as it may stand: RFC 3986's unreserved characters, its sub-delims, `:` and `@` -- no `%`, no `\`, nothing outside ASCII. Anchored, one class, so linear. */
const SEGMENT = /^[A-Za-z0-9._~!$&'()*+,;=:@-]+$/

/**
 * Whether a request target is a plain path: before any `?`, a `/` and one or
 * more segments, none empty, none `.` or `..`, each made of characters a path
 * carries as themselves. So no escape, no backslash, no doubled or trailing
 * slash, `/` alone not, and no `#`. The query is not looked at, since nothing
 * routes by it.
 */
export function plainPath(target: string): boolean {
  const query = target.indexOf('?')
  const path = query === -1 ? target : target.slice(0, query)
  if (!path.startsWith('/')) return false
  return path
    .slice(1)
    .split('/')
    .every((segment) => segment !== '.' && segment !== '..' && SEGMENT.test(segment))
}
