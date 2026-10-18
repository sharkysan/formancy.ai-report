// The Java the e-invoice gate runs its tools on (0027): what `java -version`
// says, and the options every tool is started with.

/**
 * The options every tool starts with, before its own:
 *
 * - **No network.** Java's HTTP and HTTPS proxies point at port 9 of this
 *   machine, where nothing listens, and the system's proxies are not
 *   asked, so a tool that starts fetching a schema, a code list or an
 *   update fails loudly rather than making the verdict a server's. A raw
 *   socket would not be caught; no tool was seen to open one: Mustang and
 *   KoSIT gave the same verdicts with these options as without them, on 17
 *   October 2026, and veraPDF 1.30.3 the same verdicts, rules and feature
 *   reports on the gate's seventeen PDFs, listing one file's two failed
 *   rules in another order, on Zulu 25 on 18 October 2026.
 * - **One language and one encoding.** English messages, UTF-8 on every
 *   stream. Without them, on a German Windows, Mustang 2.26.0 wrote its
 *   report's XSD message in German and in the console's code page, which is
 *   not the UTF-8 its declaration says (measured on Java 25, 17 October
 *   2026). `stdout.encoding` and `stderr.encoding` are Java 19's; Java 17
 *   writes its streams in `file.encoding`, and both gave the same reports.
 */
export const JVM_OPTIONS = Object.freeze([
  '-Dhttp.proxyHost=127.0.0.1',
  '-Dhttp.proxyPort=9',
  '-Dhttps.proxyHost=127.0.0.1',
  '-Dhttps.proxyPort=9',
  '-Djava.net.useSystemProxies=false',
  '-Dfile.encoding=UTF-8',
  '-Dstdout.encoding=UTF-8',
  '-Dstderr.encoding=UTF-8',
  '-Duser.language=en',
  '-Duser.country=US',
])

/** The version `java -version` reports: `openjdk version "17.0.20.1"` is 17.0.20.1. */
export function javaVersion(text) {
  return /version "([^"]+)"/.exec(String(text))?.[1]
}

/** The major version `java -version` reports: `"17.0.20.1"` is 17, `"1.8.0_402"` is 8. */
export function javaMajor(text) {
  const match = /^(\d+)(?:\.(\d+))?/.exec(javaVersion(text) ?? '')
  if (match === null) return undefined
  return match[1] === '1' ? Number.parseInt(match[2], 10) : Number.parseInt(match[1], 10)
}
