// The headers every response of the demo carries (0051), decided once, as
// a function of the address the demo is served at: the deploy writes them
// for https://formancy.ai/report/ into the `_headers` file Cloudflare's
// static assets read, `vite preview` serves `pnpm demo` with them for its
// own address (apps/studio/vite.config.ts), and the browser gate serves the
// Studio under them for the address it serves it at. The policies differ in
// that address and in nothing else, which scripts/demo.test.mjs holds.
// formancy.ai-health's demo is served the same way, by the same function of
// its own (formancy.ai-health 0012).
//
// What the policy holds is the Studio's one promise about what a person
// writes into it, the report and the answers it prints: the page sends it
// nowhere. `connect-src 'none'` refuses every fetch, XHR, WebSocket and
// beacon, from the page and from PDF.js's worker, which is served under the
// same headers; `form-action 'none'` refuses a form that posts. Scripts,
// styles, faces and the worker are the builds' own files, from the Studio's
// assets directory or the pages' own directory and nowhere else, and none
// is inline: Vite writes none, React's `style` prop and Angular's style
// bindings go through the CSSOM, which the policy does not govern, and
// PDF.js loads the faces of a PDF through FontFace and its rules through a
// constructed stylesheet, which it does not govern either. Not `'self'`,
// which admits whatever the same origin serves: Cloudflare serves the
// scripts of the features it injects from `/cdn-cgi/` of the same origin,
// and formancy.ai-health's review measured on 18 October 2026 that such a
// script, admitted, sent what was typed to the origin. Under the builds'
// own directories it is refused. `no-transform` asks Cloudflare to inject
// nothing in the first place.
//
// Trusted Types: no script of the page may hand a string to a sink that
// parses it as markup or code, and the one policy that may be made is the
// default one apps/studio/src/preview/pdf-document.ts makes, which lets
// exactly one string through: the address of PDF.js's worker, the build's
// own file, which PDF.js hands `new Worker` as a string. Refused, PDF.js
// would not fail: it would run its worker's code on the page's own thread,
// and print every preview there. The browser gate holds that it starts the
// worker.
//
// `img-src` is the pages' pictures, from their own directory, and `data:`,
// for the `data:,` icon each page names so that no load asks for
// /favicon.ico. The Studio draws no image from a file: the preview is a
// canvas, and the images a report declares are drawn into the PDF.
//
// A header joined from two rules of `_headers` is merged into one value, so
// there is one rule, `/*`, which every file the Worker serves takes: the
// Studio's and the pages', which is why the policy names both directories.

/** The directory the Studio's scripts, styles, faces and worker are written to, as Vite names it by default (`build.assetsDir`). */
export const ASSETS = 'assets/'

/** The directory of the pages' stylesheet, faces and pictures: apps/pages/src/pages.ts's `FILES`, which scripts/demo.test.mjs holds it to. */
export const SITE = 'site/'

/**
 * The headers, name to value, in the order `_headers` lists them, for the
 * demo at `page`: an absolute http or https address of a directory, ending
 * in `/`, as the page's own relative files resolve against it. Anything
 * else is refused, since the policy would admit what it names.
 */
export function headersFor(page) {
  const url = URL.canParse(page) ? new URL(page) : undefined
  if (
    url === undefined ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.href !== page ||
    !url.pathname.endsWith('/') ||
    url.search !== '' ||
    url.hash !== '' ||
    url.username !== ''
  ) {
    throw new Error(
      `the demo's headers are for the address of the directory its page is served from, written as a browser writes it and ending in /, not ${JSON.stringify(page)}`,
    )
  }
  const assets = `${page}${ASSETS}`
  const site = `${page}${SITE}`
  return Object.freeze({
    'Content-Security-Policy': [
      "default-src 'none'",
      `script-src ${assets}`,
      `style-src ${assets} ${site}`,
      `font-src ${assets} ${site}`,
      `img-src data: ${site}`,
      `worker-src ${assets}`,
      "connect-src 'none'",
      "form-action 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "manifest-src 'none'",
      "require-trusted-types-for 'script'",
      'trusted-types default',
    ].join('; '),
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    // The page asks for no device: nothing in the Studio or the pages does.
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Cache-Control': 'public, max-age=0, must-revalidate, no-transform',
  })
}
