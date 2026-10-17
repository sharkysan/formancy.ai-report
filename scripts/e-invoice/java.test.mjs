import { describe, expect, test } from 'vitest'
import { javaMajor, javaVersion, JVM_OPTIONS } from './java.mjs'

/**
 * The Java the gate runs the tools on, and how it starts every one of them
 * (0027). The tools register names the oldest Java each JAR runs on; the
 * gate refuses an older one by what `java -version` says.
 */
describe('java -version', () => {
  // Java 8 and before say `1.8.0_402`, every release since says its major
  // first; read wrong, a Java 8 would pass a pin that needs 11.
  test('gives the major and the version, in the old numbering and the new', () => {
    expect(javaMajor('openjdk version "25.0.4.1" 2026-08-18 LTS')).toBe(25)
    expect(javaMajor('openjdk version "17.0.20.1" 2026-08-18')).toBe(17)
    expect(javaMajor('java version "1.8.0_402"')).toBe(8)
    expect(javaMajor('Error: could not find java.dll')).toBeUndefined()
    expect(javaVersion('openjdk version "17.0.20.1" 2026-08-18\nOpenJDK Runtime Environment Temurin-17.0.20.1+1')).toBe('17.0.20.1')
    expect(javaVersion('nothing')).toBeUndefined()
  })
})

describe('the options every tool starts with', () => {
  // A tool that starts reaching the network -- a schema, a code list, an
  // update check -- would make the gate's verdict a server's on the day.
  // Every proxy is a dead port on this machine, so a request fails loudly
  // and the run with it; and the messages are English and UTF-8 whatever
  // the machine's locale, so a judge never reads a German XSD error or a
  // console in Windows' code page (measured with both tools on Java 17 and
  // 25 on 17 October 2026: without them Mustang wrote its report's text in
  // the console's code page, in German).
  test('point every proxy at a dead port and fix the language and the encoding', () => {
    expect(JVM_OPTIONS).toEqual([
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
  })
})
