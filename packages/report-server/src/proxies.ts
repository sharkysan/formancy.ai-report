/**
 * Whom the server believes about a client's address, by formancy.ai-data
 * 0071's rule: the proxies an operator names, by address or range, and
 * nothing that would believe every client about itself.
 *
 * `FORMANCY_REPORT_TRUSTED_PROXIES` is read by the composition root and
 * parsed here; createReportServer holds an embedder's `trustedProxies` to
 * the same rule and hands the list to Fastify's `trustProxy`. Unset,
 * nothing is trusted, and every request is counted and logged by the
 * address of the peer that connected. Listed, a request whose peer is in
 * the list is counted and logged by the address Fastify reads from
 * X-Forwarded-For: from the right, the first address not in the list. Only
 * X-Forwarded-For; RFC 7239's Forwarded is not read.
 */
import { isIP } from 'node:net'
import type { FastifyRequest } from 'fastify'

const SETTING = 'FORMANCY_REPORT_TRUSTED_PROXIES'

/** What every refusal asks for instead. */
const ASK = 'name each proxy by its address, or the range its addresses are in'

/** Why trusting every peer, or every peer of a family, is refused: `trusts` for one entry, `trust` for a list's entries together. */
const everybody = (verb: 'trusts' | 'trust' = 'trusts', family: 'IPv4' | 'IPv6' | 'both' = 'both') =>
  `${verb} every ${family === 'both' ? '' : `${family} `}peer, which lets any client name its own address in X-Forwarded-For and so choose its own rate-limit bucket and the address the log gives it: ${ASK}`

/** A prefix length as a CIDR range writes it: decimal, no sign, no leading zero. */
const PREFIX = /^(0|[1-9][0-9]{0,2})$/

/**
 * An address's bytes, most significant first: 4 or 16. `address` is one
 * `isIP` accepted with no zone, so an IPv6 address holds at most one `::`
 * and, at its end, at most one dotted IPv4 address.
 */
function bytesOf(address: string, family: 4 | 6): number[] {
  if (family === 4) return address.split('.').map(Number)
  const last = address.lastIndexOf(':')
  const dotted = address.includes('.')
    ? address
        .slice(last + 1)
        .split('.')
        .map(Number)
    : undefined
  const hex = dotted === undefined ? address : `${address.slice(0, last + 1)}0:0`
  const groups = (part: string) => (part === '' ? [] : part.split(':').map((group) => Number.parseInt(group, 16)))
  const [head = '', tail] = hex.split('::')
  const before = groups(head)
  const after = tail === undefined ? [] : groups(tail)
  const bytes = [...before, ...new Array<number>(8 - before.length - after.length).fill(0), ...after].flatMap((group) => [group >> 8, group & 0xff])
  if (dotted !== undefined) bytes.splice(12, 4, ...dotted)
  return bytes
}

/** An accepted entry as the IPv6 addresses it names, first and last: an IPv4 one as its IPv4-mapped range, ::ffff:a.b.c.d. */
function rangeOf(entry: string): [bigint, bigint] {
  const slash = entry.indexOf('/')
  const address = slash === -1 ? entry : entry.slice(0, slash)
  const family = isIP(address) === 4 ? 4 : 6
  const bytes = family === 4 ? [...new Array<number>(10).fill(0), 0xff, 0xff, ...bytesOf(address, 4)] : bytesOf(address, 6)
  const prefix = (slash === -1 ? (family === 4 ? 32 : 128) : Number(entry.slice(slash + 1))) + (family === 4 ? 96 : 0)
  const first = bytes.reduce((value, byte) => (value << 8n) | BigInt(byte), 0n)
  return [first, first + (1n << BigInt(128 - prefix)) - 1n]
}

/** Whether `ranges` together hold every address from `first` to `last`. */
function covers(ranges: readonly [bigint, bigint][], first: bigint, last: bigint): boolean {
  let next = first
  for (const [start, end] of [...ranges].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))) {
    if (start > next) return false
    if (end >= next) next = end + 1n
    if (next > last) return true
  }
  return false
}

const IPV4_MAPPED: [bigint, bigint] = [0xffff_0000_0000n, 0xffff_ffff_ffffn]
const IPV6: [bigint, bigint] = [0n, (1n << 128n) - 1n]

/** Whether a range lies inside ::ffff:0:0/96: an IPv4 entry, or an IPv6 one whose first address is IPv4-mapped, which no bit past its prefix means is /96 or narrower. */
const insideMapped = ([first, last]: [bigint, bigint]) => first >= IPV4_MAPPED[0] && last <= IPV4_MAPPED[1]

/**
 * Which peers a list of accepted entries trusts whole, or `undefined`, as
 * Fastify's @fastify/proxy-addr matches a peer (proxies.test.ts asks its
 * matcher): an IPv4 peer, an IPv4-mapped one read as IPv4, against the
 * IPv4 entries and the IPv6 ranges inside ::ffff:0:0/96; every other IPv6
 * peer against the other IPv6 ranges. So `::ffff:0:0/96` alone trusts every
 * IPv4 peer, and `::/1`, which holds that range, trusts none. Ranges that
 * each trust part of a family can together trust all of it, IPv6 whole
 * when everything outside the mapped range is trusted; then any client of
 * that family names its own address, as with `*`.
 */
function wholeFamily(entries: readonly string[]): 'IPv4' | 'IPv6' | 'both' | undefined {
  const ranges = entries.map(rangeOf)
  const ipv4 = covers(ranges.filter(insideMapped), ...IPV4_MAPPED)
  const ipv6 = covers([...ranges.filter((range) => !insideMapped(range)), IPV4_MAPPED], ...IPV6)
  return ipv4 && ipv6 ? 'both' : ipv4 ? 'IPv4' : ipv6 ? 'IPv6' : undefined
}

/** Whether any bit past the first `prefix` is set. */
function bitsPast(bytes: readonly number[], prefix: number): boolean {
  return bytes.some((byte, index) => (byte & (0xff >> Math.max(0, Math.min(8, prefix - index * 8)))) !== 0)
}

/**
 * Why `entry` is not a proxy this server trusts, as the end of a sentence
 * that never repeats it, or `undefined`: an IP address as Node's `isIP`
 * reads one, alone or with `/` and a prefix of 1 to 32 or 128, and no bit
 * set past the prefix.
 */
function entryProblem(entry: unknown): string | undefined {
  if (typeof entry !== 'string') return 'is not a string'
  if (entry === '') return 'is empty, which is where a value written into the list went missing'
  if (entry === '*' || entry.toLowerCase() === 'true') return everybody()
  if (/^[0-9]+$/.test(entry)) return `counts hops, which trusts by position rather than by who connected: ${ASK}`
  const slash = entry.indexOf('/')
  const address = slash === -1 ? entry : entry.slice(0, slash)
  const family = address.includes('%') ? 0 : isIP(address)
  const notAddress = `is not an IP address or a CIDR range -- an address, a slash and a prefix length: ${ASK}`
  if (family !== 4 && family !== 6) return notAddress
  if (slash === -1) return undefined
  const prefix = entry.slice(slash + 1)
  if (!PREFIX.test(prefix) || Number(prefix) > (family === 4 ? 32 : 128)) return notAddress
  if (Number(prefix) === 0) return everybody()
  if (bitsPast(bytesOf(address, family), Number(prefix))) {
    return 'has bits set past its prefix, as an interface address with its prefix does, so it names a whole network where one address was likely meant: write the one address alone, or the range by its first address'
  }
  return undefined
}

export type TrustedProxiesSetting = { ok: true; trustedProxies: string[] } | { ok: false; problem: string }

/**
 * `FORMANCY_REPORT_TRUSTED_PROXIES` as written: addresses and ranges
 * separated by commas, space around each ignored, each kept once. Unset or
 * blank trusts nothing. Any entry that is not one, an empty one included,
 * refuses the whole setting, named by its place and never quoted.
 */
export function trustedProxiesSetting(text: string | undefined): TrustedProxiesSetting {
  if (text === undefined || text.trim() === '') return { ok: true, trustedProxies: [] }
  const entries = text.split(',').map((entry) => entry.trim())
  for (const [index, entry] of entries.entries()) {
    const problem = entryProblem(entry)
    if (problem !== undefined) return { ok: false, problem: `${SETTING}: entry ${String(index + 1)} ${problem}.` }
  }
  const family = wholeFamily(entries)
  if (family !== undefined) return { ok: false, problem: `${SETTING}: its entries together ${everybody('trust', family)}.` }
  return { ok: true, trustedProxies: [...new Set(entries)] }
}

/** What is wrong with `trustedProxies` as an embedder passed it, by place, or `undefined`: the setting's rule, without trimming. */
export function trustedProxiesProblem(list: unknown): string | undefined {
  if (!Array.isArray(list)) return 'trustedProxies is not a list of addresses and ranges.'
  for (const [index, entry] of list.entries()) {
    const problem = entryProblem(entry)
    if (problem !== undefined) return `trustedProxies[${String(index)}] ${problem}.`
  }
  const family = wholeFamily(list as string[])
  return family === undefined ? undefined : `trustedProxies together ${everybody('trust', family)}.`
}

/**
 * The address a request is counted and logged by: the one Fastify derived,
 * when it is an IP address, and the peer's otherwise. A trusted proxy that
 * writes an address with its port, or forwards whatever the client typed,
 * would otherwise make a new rate-limit bucket per connection, or put the
 * client's text in the bucket's key and the log (formancy.ai-data 0071).
 *
 * Fastify derives its address from the peer's, which Node reads once and
 * keeps: one that is no IP address came from a trusted proxy, the peer,
 * whose address was read when it was trusted. A socket whose client went
 * before its address was read has none, and then neither has Fastify's.
 */
export function clientAddress(request: FastifyRequest): string {
  const derived = request.ip
  return isIP(derived) !== 0 ? derived : (request.socket.remoteAddress as string)
}
