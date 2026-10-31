/**
 * What the server's suites share, and only they import: the store each case
 * runs on and the servers made over it, the host whose tokens they present,
 * and a client on a socket that may never finish its request. Never
 * shipped: neither the package's entry nor its composition root reaches
 * it, which `composition.test.ts` holds.
 */
import { mkdtemp, rm } from 'node:fs/promises'
import { connect } from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { TemplateStore } from '@formancy/report-server-core'
import type { FastifyInstance } from 'fastify'
import { SignJWT } from 'jose'
import { afterEach, beforeEach } from 'vitest'
import { createReportServer } from './app.js'
import type { ReportServerOptions } from './app.js'
import { openFileTemplateStore } from './file-store.js'
import { createReportVerifier } from './identity.js'
import type { ReportVerifier } from './identity.js'

/** A case's store, and the servers it made over it. */
export interface EachCase {
  /** The file store on a directory made for this case, as the server runs on one; never one shared between cases. */
  readonly store: TemplateStore
  /** That directory. */
  readonly directory: string
  /** A server over this case's store, unless `options` gives another. */
  serve(options: Omit<ReportServerOptions, 'store'> & { store?: TemplateStore }): Promise<FastifyInstance>
}

/**
 * Gives every case of the suite that calls it a store of its own, under a
 * directory named from `prefix`. At the case's end every server `serve`
 * made is closed first, and only then is the directory removed: removed
 * first, a server still answering a request would write into a directory
 * that is going, and the next case could find what it left there.
 */
export function eachCase(prefix: string): EachCase {
  let opened: { store: TemplateStore; directory: string } | undefined
  const servers: FastifyInstance[] = []
  beforeEach(async () => {
    const directory = await mkdtemp(join(tmpdir(), prefix))
    const store = await openFileTemplateStore(directory)
    if (!store.ok) throw new Error(store.problem)
    opened = { store: store.store, directory }
  })
  afterEach(async () => {
    for (const server of servers.splice(0)) await server.close()
    if (opened !== undefined) await rm(opened.directory, { recursive: true, force: true })
    opened = undefined
  })
  const current = () => {
    if (opened === undefined) throw new Error('A case’s store is made before each case, and asked for inside one.')
    return opened
  }
  return {
    get store() {
      return current().store
    },
    get directory() {
      return current().directory
    },
    async serve(options) {
      const server = await createReportServer({ store: current().store, ...options })
      servers.push(server)
      return server
    },
  }
}

/**
 * The host this suite plays: its secret, this test's own and throwaway, the
 * issuer it signs as and the audience it signs for. The tenant is its `tid`
 * claim.
 */
export const HOST = { secret: 'a-throwaway-test-secret-of-at-least-32-bytes', issuer: 'https://host.example', audience: 'formancy-report' } as const

/** The verifier a deployment gives the server, over that host. */
export const hostVerifier = (): Promise<ReportVerifier> =>
  createReportVerifier({ key: { kind: 'secret', secret: HOST.secret }, issuer: HOST.issuer, audience: HOST.audience, tenantClaim: 'tid' })

/**
 * An HS256 token as that host signs one: subject u-1 of tenant acme, an
 * author, for five minutes, unless `claims` or `change` say otherwise.
 */
export const signed = (claims: Record<string, unknown> = {}, change: (jwt: SignJWT) => SignJWT = (jwt) => jwt): Promise<string> =>
  change(
    new SignJWT({ tid: 'acme', roles: ['report-authors'], ...claims })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuer(HOST.issuer)
      .setAudience(HOST.audience)
      .setSubject('u-1')
      .setExpirationTime('5m'),
  ).sign(new TextEncoder().encode(HOST.secret))

/**
 * Writes `text` to a server listening on `port`, as a client that may never
 * finish its request, and reads for up to `ms`: what came back, whether the
 * server closed the connection meanwhile, and the port the client sent from.
 */
export async function exchange(port: number, text: string | Uint8Array, ms = 1000): Promise<{ answer: string; closed: boolean; from: number | undefined }> {
  const socket = connect(port, '127.0.0.1')
  socket.on('error', () => {})
  let answer = ''
  let closed = false
  socket.on('data', (chunk: Buffer) => void (answer += chunk.toString('utf8')))
  const ended = new Promise<void>((resolve) => socket.once('close', () => resolve(void (closed = true))))
  await new Promise((resolve) => socket.once('connect', resolve))
  const from = socket.localPort
  socket.write(text)
  await Promise.race([ended, new Promise((resolve) => setTimeout(resolve, ms))])
  socket.destroy()
  return { answer, closed, from }
}
