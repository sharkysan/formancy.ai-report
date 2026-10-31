/**
 * From the settings to a server (0046): the identity key opened as the
 * settings name it, the audit key resolved, the store opened on its
 * directory, and the server made over it with the server's own log as the
 * audit trail's sink. Out of main.ts, which reads the environment and the
 * signals, so that every refusal at start and the key set read again on
 * SIGHUP are tested without starting a process.
 *
 * Nothing here reads configuration: the environment and the files a secret
 * reference names are reached through the `SecretSource` main.ts hands over
 * (data-identity's), and the key set file through data-identity's own read,
 * as Data's server opens it (formancy.ai-data 0059).
 */
import { openKeySetFile, readKeySet, resolveSecret } from '@formancy/data-identity'
import type { IdentityOptions, KeySetFile, OneKey, SecretSource } from '@formancy/data-identity'
import type { FastifyBaseLogger, FastifyInstance } from 'fastify'
import { createReportServer } from './app.js'
import type { ReportServerOptions } from './app.js'
import { AUDIT_KEY_MIN_BYTES, logAuditSink, shortAuditKey } from './audit.js'
import { openFileTemplateStore } from './file-store.js'
import { createReportVerifier } from './identity.js'
import { STORE_DIR_SETTING } from './settings.js'
import type { IdentityKeySource, ServerSettings } from './settings.js'

export type OpenedServer = { ok: true; app: FastifyInstance; keyFile: KeySetFile | undefined } | { ok: false; problem: string }

/** The one key a secret or a public key file names: the secret through resolveSecret, the PEM as the file's text. */
async function oneKey(source: Exclude<IdentityKeySource, { kind: 'key-set' }>, io: SecretSource): Promise<OneKey> {
  if (source.kind === 'secret') return { kind: 'secret', secret: await resolveSecret(source.reference, io) }
  let pem: string
  try {
    pem = await io.readFile(source.path)
  } catch {
    // Named by its setting; neither the path nor the error's own text is passed on.
    throw new Error('FORMANCY_REPORT_IDENTITY_PUBLIC_KEY_FILE cannot be read.')
  }
  return { kind: 'public-key', pem, algorithm: source.algorithm }
}

/**
 * Whether `auditKey` is the identity key: the secret, a public key's text,
 * or the key of any kid in an HS256 set, compared as the set compares two
 * of its own keys -- through a set that holds the audit key under every kid
 * -- so that no key is handed out of data-identity to compare it. The probe
 * is the set's own kids, each passed by its reader already, beside a key of
 * at least 32 bytes, so the reader has nothing new to refuse; were it to
 * refuse one, the server would not start, with its sentence. A public key
 * set holds no secret to compare. Checked at start; a key added to the set
 * on SIGHUP is not compared.
 */
function isIdentityKey(auditKey: string, key: IdentityOptions['key']): boolean {
  if (key.kind === 'secret') return auditKey === key.secret
  if (key.kind === 'public-key') return auditKey.trim() === key.pem.trim()
  const set = key.keys()
  if (set.algorithm !== 'HS256') return false
  const k = Buffer.from(auditKey, 'utf8').toString('base64url')
  const probe = readKeySet(JSON.stringify({ keys: set.kids.map((kid) => ({ kty: 'oct', kid, alg: 'HS256', k })) }), 'HS256')
  return set.compare(probe).replaced.length < set.kids.length
}

/** Why `auditKey` may not name who asked, or `undefined`. Neither sentence repeats it. */
function auditKeyProblem(auditKey: string, key: IdentityOptions['key']): string | undefined {
  if (shortAuditKey(auditKey)) {
    return `FORMANCY_REPORT_AUDIT_KEY is at least ${String(AUDIT_KEY_MIN_BYTES)} bytes: the trail names who asked by it, and a shorter key is found by trying keys against one tenant the reader knows.`
  }
  if (isIdentityKey(auditKey, key)) {
    return 'FORMANCY_REPORT_AUDIT_KEY is the identity key: a secret one would let whoever is given the audit key to read the trail sign tokens, and a public one is no secret. Give the trail a key of its own.'
  }
  return undefined
}

/**
 * The server `settings` describe, or the one sentence main.ts prints before
 * it exits 1: a secret or a file that cannot be read, a secret under 32
 * bytes, a public key that does not import, a key set refused, an audit key
 * that cannot be resolved, is under 32 bytes or is the identity key, or a
 * store directory that does not open, whose sentence begins with the
 * setting (the file store says what is wrong with a root and names no
 * setting, being opened from code too). Each sentence is data-identity's,
 * the file store's or this file's, and none repeats a key, a secret, a
 * file's text or the store's path. `logger` is where the log goes: main.ts
 * gives standard output.
 */
export async function openReportServer(settings: ServerSettings, io: SecretSource, logger: NonNullable<ReportServerOptions['logger']>): Promise<OpenedServer> {
  try {
    let key: IdentityOptions['key']
    let keyFile: KeySetFile | undefined
    if (settings.key.kind === 'key-set') {
      keyFile = await openKeySetFile(settings.key.path, settings.key.algorithm)
      key = { kind: 'key-set', keys: keyFile.current }
    } else {
      key = await oneKey(settings.key, io)
    }
    const verifyIdentity = await createReportVerifier({
      key,
      issuer: settings.issuer,
      audience: settings.audience,
      tenantClaim: settings.tenantClaim,
      ...(settings.rolesClaim === undefined ? {} : { rolesClaim: settings.rolesClaim }),
    })
    const auditKey = settings.auditKey === undefined ? undefined : await resolveSecret(settings.auditKey, io)
    const auditRefused = auditKey === undefined ? undefined : auditKeyProblem(auditKey, key)
    if (auditRefused !== undefined) return { ok: false, problem: auditRefused }
    // Before the server is made, so that a volume that is not there stops
    // the process here, with its sentence, rather than at the first save.
    const store = await openFileTemplateStore(settings.storeDir)
    if (!store.ok) return { ok: false, problem: `${STORE_DIR_SETTING}: ${store.problem}` }
    // The server's own log is the trail, looked up when an event fires: the
    // server does not exist yet while its options are built, and an event
    // fires only for a request it answered, so never before `app` is.
    const app: FastifyInstance = await createReportServer({
      verifyIdentity,
      roles: settings.roles,
      store: store.store,
      audit: { sink: (event) => logAuditSink(app.log)(event), ...(auditKey === undefined ? {} : { key: auditKey }) },
      logger,
      rateLimit: settings.rateLimit,
      trustedProxies: settings.trustedProxies,
      origins: settings.origins,
    })
    return { ok: true, app, keyFile }
  } catch (error) {
    // Everything above throws an Error whose message is its sentence --
    // data-identity, Fastify and this package -- and a secret source that
    // fails is turned into one by resolveSecret and oneKey.
    return { ok: false, problem: (error as Error).message }
  }
}

/** Where a signal comes from: `process` in the server, an EventEmitter in a test. */
export interface SignalSource {
  on(signal: 'SIGHUP', listener: () => void): unknown
}

/**
 * Reads the key set file again on every SIGHUP and says what happened in
 * one line of the server's log, by kid and never by key: what was added,
 * removed and replaced; that nothing changed; or, at `error`, that nothing
 * was read and why, the set in force unchanged (formancy.ai-data 0059).
 * Installed whatever the setting, so a SIGHUP -- whose default is to end
 * the process -- never stops the server; with one key, it says so.
 */
export function readAgainOnSignal(signals: SignalSource, file: KeySetFile | undefined, log: FastifyBaseLogger): void {
  signals.on('SIGHUP', () => {
    if (file === undefined) {
      log.warn('SIGHUP: the identity key is not a key set file; nothing was read again')
      return
    }
    void file.readAgain().then((outcome) => {
      if (!outcome.read)
        log.error({ identityKeys: { kids: outcome.kids, problem: outcome.problem } }, 'identity keys not read again; the set in force is unchanged')
      else if (outcome.changed)
        log.info(
          { identityKeys: { kids: outcome.kids, added: outcome.added, removed: outcome.removed, replaced: outcome.replaced, leftOut: outcome.leftOut } },
          'identity keys read again',
        )
      else log.info({ identityKeys: { kids: outcome.kids, leftOut: outcome.leftOut } }, 'identity keys read again; nothing changed')
    })
  })
}
