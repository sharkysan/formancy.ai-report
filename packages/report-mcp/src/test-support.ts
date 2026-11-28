/**
 * What the suites share, and no module of the package: the quotation grown
 * to a size chosen to the byte, a starter's images as an agent passes
 * them, Report's server made in the suite's own process with the tokens a
 * host would sign for it, and a fetch that records each route it is asked.
 * Test files alone import it; every module is held to the specifiers its
 * list names in `composition.test.ts`, which no list names this in.
 */
import { createHmac } from 'node:crypto'
import { mkdtemp, rm } from 'node:fs/promises'
import type { AddressInfo } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { QUOTATION, STARTER_IMAGES } from '@formancy/report-corpus'
import { createReportServer, createReportVerifier, openFileTemplateStore } from '@formancy/report-server'
import { ROUTES } from '@formancy/report-server-core'
import type { Component, ReportDefinition } from '@formancy/report-spec'
import { expect } from 'vitest'

/** A report's size as report-spec states `MAX_REPORT_BYTES` is measured: the UTF-8 length of its JSON. */
export const bytesOf = (report: unknown): number => new TextEncoder().encode(JSON.stringify(report)).byteLength

/**
 * The quotation grown to exactly `bytes` bytes by texts of plain letters
 * at the end of its body, each within the text's own bound: a valid report
 * of a size chosen to the byte.
 */
export function quotationOf(bytes: number): ReportDefinition {
  const quotation = QUOTATION.report
  const text = (id: string, length: number): Component => ({ kind: 'text', id, content: [{ kind: 'text', text: 'x'.repeat(length) }] })
  const padded = (texts: readonly Component[]): ReportDefinition => ({
    ...quotation,
    regions: { ...quotation.regions, body: [...quotation.regions.body, ...texts] },
  })
  const texts: Component[] = []
  while (bytesOf(padded([...texts, text(`pad-${String(texts.length)}`, 9000)])) < bytes) texts.push(text(`pad-${String(texts.length)}`, 9000))
  const last = `pad-${String(texts.length)}`
  const short = bytes - bytesOf(padded([...texts, text(last, 0)]))
  const report = padded([...texts, text(last, short)])
  expect(bytesOf(report)).toBe(bytes)
  return report
}

/** An asset as an agent passes it to render_check: its id, its digest, its media type and its bytes in base64. */
export interface PassedAsset {
  readonly asset: string
  readonly digest: string
  readonly mediaType: string
  readonly base64: string
}

/** Every image a starter names, as an agent passes it. */
export const STARTER_ASSETS: readonly PassedAsset[] = STARTER_IMAGES.map(({ asset, digest, mediaType, bytes }) => ({
  asset,
  digest,
  mediaType,
  base64: Buffer.from(bytes).toString('base64'),
}))

/** The host a suite's tokens come from: its secret is this package's tests' own, and no host's. */
const HOST = { secret: 'report-mcp-suites-own-secret-of-at-least-32-bytes', issuer: 'https://login.example', audience: 'formancy-report' } as const

/** Who the suites' tokens name, unless a case says otherwise. */
export const SUBJECT = 'author-the-mcp-suite-names'

/** Report's server on a socket of its own, over a file store on a directory of its own, and how a host signs a token for it. */
export interface RunningServer {
  /** Its base URL, as report-client takes one. */
  readonly at: string
  /** An HS256 token as the host signs one: an author of acme for five minutes, unless `claims` say otherwise. */
  sign(claims?: Record<string, unknown>): string
  /** Closes the server, then removes its directory: removed first, a server still answering would write into a directory that is going. */
  close(): Promise<void>
}

const base64url = (text: string): string => Buffer.from(text).toString('base64url')

/** report-server, made in this process as report-client's suite makes it, with the roles a host maps: authors save, publishers read. */
export async function startReportServer(): Promise<RunningServer> {
  const directory = await mkdtemp(join(tmpdir(), 'formancy-report-mcp-'))
  const opened = await openFileTemplateStore(directory)
  if (!opened.ok) throw new Error(opened.problem)
  const verifyIdentity = await createReportVerifier({
    key: { kind: 'secret', secret: HOST.secret },
    issuer: HOST.issuer,
    audience: HOST.audience,
    tenantClaim: 'tid',
  })
  const server = await createReportServer({
    verifyIdentity,
    roles: { author: ['report-authors'], publisher: ['report-publishers'], admin: ['report-admins'] },
    store: opened.store,
  })
  await server.listen({ host: '127.0.0.1', port: 0 })
  return {
    at: `http://127.0.0.1:${String((server.server.address() as AddressInfo).port)}`,
    sign(claims = {}) {
      const now = Math.floor(Date.now() / 1000)
      const body = `${base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))}.${base64url(
        JSON.stringify({ iss: HOST.issuer, aud: HOST.audience, sub: SUBJECT, tid: 'acme', roles: ['report-authors'], iat: now, exp: now + 300, ...claims }),
      )}`
      return `${body}.${createHmac('sha256', HOST.secret).update(body).digest('base64url')}`
    },
    async close() {
      await server.close()
      await rm(directory, { recursive: true, force: true })
    },
  }
}

/** A request as the recording fetch saw it: its route by `ROUTES`' pattern, or its method and path where none is one, its headers and its body. */
export interface Asked {
  readonly route: string
  readonly headers: Readonly<Record<string, string>>
  readonly body: unknown
}

/** `method` and `path` as the route of `ROUTES` that answers them, by its pattern, or as themselves where none does. */
function routeOf(method: string, path: string): string {
  const route = Object.keys(ROUTES).find((key) => {
    const [answers, pattern] = key.split(' ') as [string, string]
    return answers === method && new RegExp(`^${pattern.replace(/:[a-z]+/g, '[^/]+')}$`).test(path)
  })
  return route ?? `${method} ${path}`
}

/**
 * A fetch that records each request -- its route, its headers and its
 * body -- and hands it on to `onward`, the global fetch unless a case
 * answers it itself: so that what the routes read is what was sent, and
 * what was answered is what they sent.
 */
export function recordingFetch(onward: typeof globalThis.fetch = (input, init) => globalThis.fetch(input, init)): {
  readonly fetch: typeof globalThis.fetch
  readonly asked: Asked[]
} {
  const asked: Asked[] = []
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input))
    asked.push({ route: routeOf(init?.method ?? 'GET', url.pathname), headers: { ...(init?.headers as Record<string, string> | undefined) }, body: init?.body })
    return onward(input, init)
  }
  return { fetch, asked }
}
