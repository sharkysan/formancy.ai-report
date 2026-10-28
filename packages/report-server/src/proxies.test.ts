import { mkdtemp, rm } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TemplateStore } from '@formancy/report-server-core'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { createReportServer } from './app.js'
import type { ReportServerOptions } from './app.js'
import { openFileTemplateStore } from './file-store.js'
import type { ReportVerifier } from './identity.js'
import { trustedProxiesProblem, trustedProxiesSetting } from './proxies.js'

/**
 * `FORMANCY_REPORT_TRUSTED_PROXIES`, by formancy.ai-data 0071's rule: the
 * proxies whose X-Forwarded-For the server believes about a client's
 * address, named by address or range, and nothing that would believe every
 * client about itself; and how the server then counts a request, by the
 * address its rate limit keys a bucket by. The image is held to the same
 * by the container gate.
 */
/**
 * Every IPv6 address but those of `::ffff:0:0/112`, which is a part of the
 * IPv4-mapped range: the 112 ranges around it, each the hole's first bits
 * with the next one flipped, written out in full. A list that trusts every
 * IPv6 peer and only some IPv4 ones.
 */
function aroundMapped(): string[] {
  const hole = 0xffff_0000_0000n
  const text = (value: bigint) => Array.from({ length: 8 }, (_, group) => ((value >> BigInt(112 - group * 16)) & 0xffffn).toString(16)).join(':')
  return Array.from({ length: 112 }, (_, at) => {
    const bit = 127n - BigInt(at)
    const kept = (hole >> (bit + 1n)) << (bit + 1n)
    return `${text(kept | ((hole ^ (1n << bit)) & (1n << bit)))}/${String(at + 1)}`
  })
}

/**
 * The matcher Fastify compiles `trustProxy` into: @fastify/proxy-addr as
 * Fastify itself resolves it, and the ipaddr.js that one parses with --
 * not a declared dependency of this package, and not a copy of either.
 */
const fromFastify = createRequire(createRequire(import.meta.url).resolve('fastify'))
const proxyAddr = fromFastify('@fastify/proxy-addr') as { compile: (list: string[]) => (address: string, hop: number) => boolean }
const fromProxyAddr = createRequire(fromFastify.resolve('@fastify/proxy-addr'))
const ipaddr = fromProxyAddr('ipaddr.js') as { parse: (address: string) => { toByteArray: () => number[] } }

/** ::ffff:0:0/96 as IPv6's 128 bits, first and past the last: where an IPv4 address is written as IPv6. */
const MAPPED = 0xffffn << 32n
const PAST_MAPPED = MAPPED + (1n << 32n)

/** An entry's block in IPv6's 128 bits, an IPv4 one as its mapped block, read by ipaddr.js: first, and past the last. */
function block(entry: string): bigint[] {
  const [address = '', prefix] = entry.split('/')
  const bytes = ipaddr.parse(address).toByteArray()
  const v4 = bytes.length === 4
  const value = bytes.reduce((sum, byte) => (sum << 8n) | BigInt(byte), v4 ? 0xffffn : 0n)
  const size = 1n << BigInt(128 - (prefix === undefined ? 128 : Number(prefix) + (v4 ? 96 : 0)))
  const first = (value / size) * size
  return [first, first + size]
}

const dotted = (value: bigint) => [24n, 16n, 8n, 0n].map((shift) => String(((value - MAPPED) >> shift) & 0xffn)).join('.')
const groups = (value: bigint) => Array.from({ length: 8 }, (_, group) => ((value >> BigInt(112 - group * 16)) & 0xffffn).toString(16)).join(':')

/**
 * Which families `list` trusts every peer of, asked of proxy-addr's own
 * matcher. Asked at each address where what it trusts of a family could
 * stop: the family's first, and the first past each entry's block. Of each
 * family the matcher trusts the blocks of some of the entries -- which
 * ones is its rule, and what this asks -- so the first untrusted address
 * of a family, if there is one, is among those. An IPv4 peer is asked as
 * Node names it on an IPv4 socket and on a dual-stack one, ::ffff:a.b.c.d;
 * an IPv6 peer is any address outside the mapped block.
 */
function trustedWhole(list: readonly string[]): 'IPv4' | 'IPv6' | 'both' | undefined {
  const trust = proxyAddr.compile([...list])
  const edges = list.flatMap(block)
  const ipv4 = [MAPPED, ...edges.filter((value) => value >= MAPPED && value < PAST_MAPPED)].flatMap((value) => [dotted(value), `::ffff:${dotted(value)}`])
  const ipv6 = [0n, PAST_MAPPED, ...edges.filter((value) => (value < MAPPED || value >= PAST_MAPPED) && value < 1n << 128n)].map(groups)
  const every = (peers: string[]) => peers.every((peer) => trust(peer, 0))
  const [all4, all6] = [every(ipv4), every(ipv6)]
  return all4 && all6 ? 'both' : all4 ? 'IPv4' : all6 ? 'IPv6' : undefined
}

/**
 * Entries each the rule accepts alone, chosen where a family's edges are:
 * IPv4's halves and quarters, the mapped block whole, halved and as one
 * address, IPv6 ranges that hold the mapped block, that end or begin just
 * beside it, and ranges far from it.
 */
const POOL = [
  ...['0.0.0.0/1', '128.0.0.0/1', '0.0.0.0/2', '64.0.0.0/2', '128.0.0.0/2', '192.0.0.0/2', '10.0.0.0/8', '127.0.0.1'],
  ...['::ffff:0:0/96', '::ffff:0.0.0.0/97', '::ffff:128.0.0.0/97', '::ffff:10.0.0.1', '::ffff:10.0.0.0/104'],
  ...['::/1', '8000::/1', '::/2', '4000::/2', '8000::/2', 'c000::/2', '::/80', '::/81', '::8000:0:0/81', '::fffe:0:0/96', '::1:0:0:0/80', '2001:db8::/32', '::1', 'fe80::/10'],
]

/** Every list of one, two or three of POOL's entries, and longer ones no three of them make. */
function corpus(): string[][] {
  const lists: string[][] = []
  for (const [a, first] of POOL.entries()) {
    lists.push([first])
    for (const [b, second] of POOL.entries()) {
      if (b <= a) continue
      lists.push([first, second])
      for (const third of POOL.slice(b + 1)) lists.push([first, second, third])
    }
  }
  return [
    ...lists,
    ['0.0.0.0/2', '64.0.0.0/2', '128.0.0.0/2', '192.0.0.0/3', '224.0.0.0/3'],
    ['0.0.0.0/2', '64.0.0.0/2', '128.0.0.0/2', '192.0.0.0/3'],
    ['::/2', '4000::/2', '8000::/2', 'c000::/2'],
    ['10.0.0.0/8', '::ffff:10.0.0.0/104', '2001:db8::/32', '::1'],
    aroundMapped(),
    [...aroundMapped(), '::ffff:0:0/112'],
  ]
}

describe('as Fastify’s proxy-addr matches a peer', () => {
  // The rule is there to refuse a list under which any client of a family
  // names its own address, and so its own rate-limit bucket; it is right
  // only where it agrees with the matcher that decides that. A list it
  // refuses that trusts no family whole stops a server an operator
  // configured rightly, and a list it accepts that trusts one whole is `*`
  // by another name. So each list is held to the matcher itself, both ways.
  test('refuses exactly the lists under which proxy-addr trusts every IPv4 peer or every IPv6 peer', () => {
    const differ: string[] = []
    const seen = new Map<string, number>()
    for (const list of corpus()) {
      const matcher = trustedWhole(list)
      seen.set(String(matcher), (seen.get(String(matcher)) ?? 0) + 1)
      const read = trustedProxiesSetting(list.join(', '))
      const setting = read.ok ? undefined : (/^FORMANCY_REPORT_TRUSTED_PROXIES: its entries together trust every (IPv4 |IPv6 )?peer/.exec(read.problem)?.[1]?.trim() ?? (/every peer/.test(read.problem) ? 'both' : read.problem))
      const embedded = trustedProxiesProblem(list)
      const option = embedded === undefined ? undefined : (/^trustedProxies together trust every (IPv4 |IPv6 )?peer/.exec(embedded)?.[1]?.trim() ?? (/every peer/.test(embedded) ? 'both' : embedded))
      if (setting !== matcher || option !== matcher) differ.push(`${list.length > 4 ? `${list.slice(0, 3).join(', ')}, … (${String(list.length)})` : list.join(', ')}: proxy-addr ${String(matcher)}, the setting ${String(setting)}, the option ${String(option)}`)
    }
    expect(differ.slice(0, 12), `${String(differ.length)} lists differ`).toEqual([])
    // A corpus whose every list came out alike would hold the rule to one answer only.
    expect(Object.fromEntries([...seen].map(([family, count]) => [family, count > 0]))).toEqual({ IPv4: true, IPv6: true, both: true, undefined: true })
  })

  // 0046 and the README say the rule is read as this release of proxy-addr
  // matches; another may match otherwise, and is read again before this
  // moves.
  test('is read against the proxy-addr Fastify resolves', () => {
    expect((fromFastify('@fastify/proxy-addr/package.json') as { version: string }).version).toBe('5.1.2')
  })
})

describe('trustedProxiesSetting', () => {
  // Unset, nothing is trusted: every request is its peer's.
  test('trusts nothing unset, empty or blank', () => {
    for (const text of [undefined, '', '  ']) expect(trustedProxiesSetting(text)).toEqual({ ok: true, trustedProxies: [] })
  })

  // Addresses and ranges as Node's isIP reads an address, each kept once.
  test('reads addresses and CIDR ranges of both families', () => {
    expect(trustedProxiesSetting(' 10.0.0.0/8, 192.168.1.10 ,::1, 2001:db8::/32, ::ffff:10.0.0.0/104, 10.0.0.0/8')).toEqual({ ok: true, trustedProxies: ['10.0.0.0/8', '192.168.1.10', '::1', '2001:db8::/32', '::ffff:10.0.0.0/104'] })
  })

  // Each of these would let any client name its own address in
  // X-Forwarded-For, and so choose its own rate-limit bucket and the
  // address the log gives it, or names something no reader could check.
  test('refuses every entry that trusts everybody, counts hops, or is no address or range', () => {
    const cases = {
      '*': 'entry 1 trusts every peer',
      true: 'entry 1 trusts every peer',
      TRUE: 'entry 1 trusts every peer',
      '0.0.0.0/0': 'entry 1 trusts every peer',
      '::/0': 'entry 1 trusts every peer',
      '2': 'entry 1 counts hops',
      '10.0.0.1,,10.0.0.2': 'entry 2 is empty',
      'proxy.internal': 'entry 1 is not an IP address or a CIDR range',
      '10.0.0.0/33': 'entry 1 is not an IP address or a CIDR range',
      '::1/129': 'entry 1 is not an IP address or a CIDR range',
      '10.0.0.0/08': 'entry 1 is not an IP address or a CIDR range',
      '10.0.0.0/': 'entry 1 is not an IP address or a CIDR range',
      'fe80::1%eth0': 'entry 1 is not an IP address or a CIDR range',
      '010.0.0.1': 'entry 1 is not an IP address or a CIDR range',
      '10.0.0.1/24': 'entry 1 has bits set past its prefix',
      '2001:db8::1/32': 'entry 1 has bits set past its prefix',
      '::ffff:10.0.0.1/104': 'entry 1 has bits set past its prefix',
    }
    for (const [text, says] of Object.entries(cases)) {
      const read = trustedProxiesSetting(text)
      expect(read.ok, text).toBe(false)
      if (!read.ok) expect(read.problem.startsWith(`FORMANCY_REPORT_TRUSTED_PROXIES: ${says}`), `${text}: ${read.problem}`).toBe(true)
    }
  })

  // Ranges that each trust part of a family can together trust all of it,
  // and an IPv4 peer is trusted by an IPv4-mapped IPv6 range as by its own:
  // ::ffff:0:0/96 alone, or the two halves of IPv4, let a client at
  // 127.0.0.1 name itself five ways and get five buckets. The list is
  // refused as `*` is; a list that leaves any address of each family out
  // is not, and neither is ::/1, which holds the mapped range and which
  // proxy-addr matches against no IPv4 peer. The matcher's own answer for
  // every such list is the suite below.
  test('refuses entries that together trust every IPv4 or every IPv6 peer', () => {
    for (const [text, family] of [
      ['0.0.0.0/1, 128.0.0.0/1', 'IPv4'],
      ['::ffff:0:0/96', 'IPv4'],
      ['::ffff:0.0.0.0/97, 128.0.0.0/1', 'IPv4'],
      ['0.0.0.0/2, 64.0.0.0/2, 128.0.0.0/2, 192.0.0.0/3, 224.0.0.0/3', 'IPv4'],
      ['::/1, 8000::/1', 'IPv6'],
      ['::/1, 8000::/1, ::ffff:0:0/96', ''],
      [aroundMapped().join(','), 'IPv6'],
    ] as const) {
      expect(trustedProxiesSetting(text), text).toEqual({ ok: false, problem: `FORMANCY_REPORT_TRUSTED_PROXIES: its entries together trust every ${family === '' ? '' : `${family} `}peer, which lets any client name its own address in X-Forwarded-For and so choose its own rate-limit bucket and the address the log gives it: name each proxy by its address, or the range its addresses are in.` })
    }
    for (const text of ['0.0.0.0/1', '0.0.0.0/2, 64.0.0.0/2, 128.0.0.0/2, 192.0.0.0/3', '::ffff:0:0/97', '8000::/1, 2001:db8::/32', '10.0.0.0/8, ::ffff:10.0.0.0/104, 2001:db8::/32, ::1', '::/1', '0.0.0.0/1, ::/1', '::/1, 8000::/2, ::ffff:0.0.0.0/97']) {
      expect(trustedProxiesSetting(text).ok, text).toBe(true)
    }
    expect(trustedProxiesProblem(['0.0.0.0/1', '128.0.0.0/1'])).toMatch(/^trustedProxies together trust every IPv4 peer/)
  })

  // The value can be a typo of something else an operator holds; the
  // sentence names the entry by its place and never quotes it.
  test('names an entry by its place, never by its text', () => {
    const read = trustedProxiesSetting('10.0.0.1, my-secret-host')
    expect(read).toEqual({ ok: false, problem: 'FORMANCY_REPORT_TRUSTED_PROXIES: entry 2 is not an IP address or a CIDR range -- an address, a slash and a prefix length: name each proxy by its address, or the range its addresses are in.' })
  })
})

describe('trustedProxiesProblem', () => {
  // An embedder's list is held to the same rule, without the trimming.
  test('holds an embedder’s list to the setting’s rule', () => {
    expect(trustedProxiesProblem(['10.0.0.0/8', '::1'])).toBeUndefined()
    expect(trustedProxiesProblem([])).toBeUndefined()
    expect(trustedProxiesProblem('10.0.0.1')).toBe('trustedProxies is not a list of addresses and ranges.')
    expect(trustedProxiesProblem(['10.0.0.1', ' 10.0.0.2'])).toMatch(/^trustedProxies\[1\] is not an IP address or a CIDR range/)
    expect(trustedProxiesProblem([7])).toBe('trustedProxies[0] is not a string.')
    expect(trustedProxiesProblem(['*'])).toMatch(/^trustedProxies\[0\] trusts every peer/)
  })
})

/** Accepts nothing: every request is the one 401, so a status says only whether the limit counted it. */
const refuseAll: ReportVerifier = async () => ({ ok: false, reason: 'ERR_JWS_SIGNATURE_VERIFICATION_FAILED' })

describe('whom the server believes', () => {
  let app: FastifyInstance | undefined
  afterEach(async () => {
    await app?.close()
    app = undefined
  })
  /**
   * The server is given a store whatever the case asks of it (0049), so each
   * case has one of its own: the file store on a directory made for it and
   * removed after it, as the server runs on one, and never one shared
   * between cases.
   */
  let store: TemplateStore
  let storeDirectory: string
  beforeEach(async () => {
    storeDirectory = await mkdtemp(join(tmpdir(), 'formancy-report-proxies-'))
    const opened = await openFileTemplateStore(storeDirectory)
    if (!opened.ok) throw new Error(opened.problem)
    store = opened.store
  })
  afterEach(async () => {
    await rm(storeDirectory, { recursive: true, force: true })
  })
  const statuses = async (options: Partial<ReportServerOptions>, forwarded: string[], remoteAddress = '127.0.0.1') => {
    await app?.close()
    app = await createReportServer({ verifyIdentity: refuseAll, roles: { author: [], publisher: [], admin: [] }, store, rateLimit: { max: 2, timeWindowMs: 60_000 }, ...options })
    const seen = []
    for (const address of forwarded) seen.push((await app.inject({ method: 'GET', url: '/v1/whoami', remoteAddress, headers: { 'x-forwarded-for': address } })).statusCode)
    return seen
  }

  // Behind a proxy it names, each client its proxy forwards is a bucket of
  // its own: the fourth request, from a second address, is counted apart.
  test('counts a named proxy’s clients by the address it forwards', async () => {
    expect(await statuses({ trustedProxies: ['127.0.0.1'] }, ['198.51.100.7', '198.51.100.7', '198.51.100.7', '198.51.100.8'])).toEqual([401, 401, 429, 401])
  })

  // Unnamed, the header is the client's own word, and every request is
  // its peer's: one bucket, whatever the header says.
  test('believes no X-Forwarded-For from a peer it does not name', async () => {
    expect(await statuses({}, ['198.51.100.7', '198.51.100.8', '198.51.100.9'])).toEqual([401, 401, 429])
  })

  // ::/1 holds the IPv4-mapped range, and the rule accepts it because the
  // matcher Fastify uses compares an IPv4 peer, however Node writes it,
  // only with IPv4 entries and mapped ranges: under it an IPv4 client still
  // names no address of its own, one bucket whatever it forwards, while a
  // peer inside ::/1 is believed, three buckets for three addresses.
  test('believes an IPv6 range holding the mapped one about no IPv4 peer', async () => {
    for (const peer of ['127.0.0.1', '::ffff:127.0.0.1']) expect(await statuses({ trustedProxies: ['::/1'] }, ['198.51.100.7', '198.51.100.8', '198.51.100.9'], peer), peer).toEqual([401, 401, 429])
    expect(await statuses({ trustedProxies: ['::/1'] }, ['198.51.100.7', '198.51.100.8', '198.51.100.9'], '::1')).toEqual([401, 401, 401])
  })

  // A named proxy that forwards whatever a client typed would make a
  // bucket of each spelling; what is not an address is the peer's.
  test('counts a forwarded value that is no address as the peer’s', async () => {
    expect(await statuses({ trustedProxies: ['127.0.0.1'] }, ['not-an-address', 'still-not-one', 'nor-this'])).toEqual([401, 401, 429])
  })
})
