import { createHash, randomUUID } from 'node:crypto'
import { access, constants, link, mkdir, open, readdir, readFile, rm, stat } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'
import { DRAFT_FORMAT } from '@formancy/report-server-core'
import type { StoredDraft, StoredImage, TemplateStore, TemplateSummary } from '@formancy/report-server-core'
import { isDigest, isIdentifier } from '@formancy/report-spec'
import type { AssetMediaType, ReportDefinition } from '@formancy/report-spec'

/**
 * The template store on one directory, a volume in a container (0049): the
 * one implementation of report-server-core's port, as formancy.ai-data 0013
 * keeps Data's published versions. Under the root:
 *
 *     tenants/<SHA-256 of the tenant claim's UTF-8>/
 *       templates/<template>/draft/<revision>.json
 *       assets/<64 hex>.<png|jpg|svg>
 *
 * **Compare-and-swap by a hard link.** A file is written to a temporary name
 * in its directory, flushed, and linked to its final name. `link` fails when
 * the name exists, atomically, so of two saves that both read revision 3 as
 * the newest exactly one makes `4.json` and the other is told it lost; and a
 * final name appears only once its bytes are on disk. A crash leaves a
 * temporary file, which no read takes for a draft, since the store reads
 * only the names it writes. `link` is atomic on a local file system; over
 * NFS a client can be told the wrong outcome after a retransmission, which is
 * one reason a deployment runs one instance (0046).
 *
 * **A draft is served as it was saved.** A record holds the report as the
 * validator returned it, who saved it, and the SHA-256 of the report's JSON
 * text exactly as written there. A read checks the record's format, that it
 * parses, and that digest, and never validates the report again, so a later
 * report-spec that would refuse an old draft leaves it readable and a
 * migration's to meet. A record that fails a check is not served:
 * `StoredRecordError`, naming its file.
 *
 * **What names a file is checked here too.** The use cases refuse a template
 * id or a digest that is not one before the store is asked; the store checks
 * again before any file operation, so that no caller can make it name a path
 * outside a tenant's directory. A tenant is named by a hash, which any claim
 * becomes, and which a volume that folds case or normalisation cannot merge.
 *
 * **No error names the root.** A path under the root holds the tenant's
 * directory, the unkeyed hash of its claim, which a reader of a log
 * reverses for a tenant they can guess. So the file system's own errors,
 * whose messages name the absolute path, never leave the store:
 * `StoreFileSystemError` carries Node's code, what the store was doing and
 * the path inside the tenant's directory instead.
 */

/** What reading a stored file found wrong with it. */
export type StoredRecordFault = 'format' | 'digest' | 'json'

const FAULTS: Readonly<Record<StoredRecordFault, string>> = {
  format: `is not a draft record of format ${String(DRAFT_FORMAT)}`,
  digest: 'does not hold what the SHA-256 written for it names',
  json: 'is not JSON',
}

/** Where a stored file is: its absolute path, and its path inside its tenant's directory. */
export interface StoredFile {
  readonly file: string
  readonly withinTenant: string
}

/**
 * A file in the store that is not what the store wrote: edited by hand,
 * damaged, or of a format this release does not read. It is never served,
 * and is its own kind so that a route can tell it from a read that failed;
 * the server answers it as `internal`, and its log names the file. A record
 * of another format number is named with it, as 0004 names a version it
 * does not read (0046).
 *
 * `file` is the absolute path, which the message names, for an embedder
 * that reads the store itself. `withinTenant` is the file's path inside its
 * tenant's directory -- `templates/<id>/draft/<n>.json` or
 * `assets/<hex>.<ext>` -- which is what the server's log names: the
 * tenant's directory is the unkeyed SHA-256 of the claim, which anybody
 * reading a log reverses for a tenant they can guess.
 */
export class StoredRecordError extends Error {
  override name = 'StoredRecordError'
  readonly file: string
  readonly withinTenant: string
  readonly why: StoredRecordFault

  constructor(where: StoredFile, why: StoredRecordFault, format?: number) {
    const fault = format === undefined ? FAULTS[why] : `is a record of format ${String(format)}, and this release reads format ${String(DRAFT_FORMAT)} alone`
    super(`${where.file} ${fault}; a stored file is never edited by hand, and this one is not served (0049).`)
    this.file = where.file
    this.withinTenant = where.withinTenant
    this.why = why
  }
}

/** What the store was doing when the file system failed it. */
export type StoreOperation = 'list' | 'read' | 'write' | 'link' | 'remove'

/**
 * The file system failed the store: a permission taken away, a volume full
 * or failing, the root gone. Node's own error is not handed on, since its
 * message names the absolute path and with it the tenant's directory; this
 * one carries Node's `code`, the `operation`, and `withinTenant`, the path
 * inside the tenant's directory, or `undefined` where what failed is the
 * root itself. The server answers it as `internal` and logs those three,
 * never a message or a stack (0049).
 */
export class StoreFileSystemError extends Error {
  override name = 'StoreFileSystemError'
  readonly code: string | undefined
  readonly operation: StoreOperation
  readonly withinTenant: string | undefined

  constructor(operation: StoreOperation, withinTenant: string | undefined, code: string | undefined) {
    super(
      withinTenant === undefined
        ? `The store's root is no longer a directory this process can reach (${String(code)}); nothing in it was read or written.`
        : `The store could not ${operation} ${withinTenant} in a tenant's directory (${String(code)}).`,
    )
    this.code = code
    this.operation = operation
    this.withinTenant = withinTenant
  }
}

/**
 * The extension each image kind is kept under. Every kind report-spec admits
 * as an image asset, and only those: a kind added there fails to compile
 * here until it has its own.
 */
const EXTENSIONS = Object.freeze({ 'image/png': 'png', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' } satisfies Record<AssetMediaType, string>)
const KINDS = Object.entries(EXTENSIONS) as [AssetMediaType, string][]

/** The names a draft is written under: a revision, a positive number with no leading zero. */
const REVISION_FILE = /^([1-9][0-9]*)\.json$/
/** What a report writes before a digest's 64 digits, which are the name its file is kept under. */
const DIGEST_PREFIX = 'sha256:'
/** A lone surrogate: a string holding one has no UTF-8 form. */
const LONE_SURROGATE = /\p{Cs}/u

/**
 * Opens the store on `root`, which must be an absolute path to a directory
 * this process can write, or says why not in a sentence about the root and
 * never the path. It names no setting and no variable: the store is opened
 * from code as well as from a container, and an embedder set none. The
 * server that reads its root from a setting says which (serve.ts). The
 * store's directories are made under the root as they are first written
 * to; the root itself is never made, so a volume that is not there is
 * found here, at start.
 */
export async function openFileTemplateStore(root: string): Promise<{ readonly ok: true; readonly store: TemplateStore } | { readonly ok: false; readonly problem: string }> {
  const refused = (why: string) => ({ ok: false, problem: `The store's root ${why}` }) as const
  if (!isAbsolute(root)) return refused('is not an absolute path; the store is named from the root, so that the directory a process starts in cannot move it.')
  const found = await stat(root).catch(() => undefined)
  if (found === undefined) return refused('names nothing this process can find; the store needs a directory that exists, and does not make one.')
  if (!found.isDirectory()) return refused('names something that is not a directory; the store needs one.')
  try {
    await access(root, constants.W_OK | constants.X_OK)
  } catch {
    return refused('names a directory this process cannot write to; the store needs one it can.')
  }
  return { ok: true, store: fileTemplateStore(root) }
}

function fileTemplateStore(root: string): TemplateStore {
  const tenantDirectory = (tenant: string): string => join(root, 'tenants', tenantName(tenant))
  const draftDirectory = (tenant: string, template: string): string => join(tenantDirectory(tenant), 'templates', templateName(template), 'draft')
  const assetDirectory = (tenant: string): string => join(tenantDirectory(tenant), 'assets')

  /** `path`'s place inside `tenant`'s directory: what an error may name, as the tenant's directory may not be. */
  const within = (tenant: string, path: string): string => relative(tenantDirectory(tenant), path)

  /** `error`, a failure of the file system at `path`, as the store's own (above). */
  const failed = (operation: StoreOperation, tenant: string, path: string, error: unknown): StoreFileSystemError =>
    // What node:fs/promises rejects with: a system error, whose code is a string.
    new StoreFileSystemError(operation, within(tenant, path), (error as NodeJS.ErrnoException).code)

  /** `run`, an operation of the file system on `path`, its failure the store's own. */
  async function attempt<T>(operation: StoreOperation, tenant: string, path: string, run: () => Promise<T>): Promise<T> {
    try {
      return await run()
    } catch (error) {
      throw failed(operation, tenant, path, error)
    }
  }

  /**
   * Called wherever something under the root is missing, since that means
   * two things: nothing written there yet, or the volume gone. The second
   * throws, so that a store whose directory disappeared is not read as an
   * empty one and a save does not make the root again where the volume was.
   */
  async function standing(operation: StoreOperation): Promise<void> {
    const found = await stat(root).catch((error: unknown) => {
      throw new StoreFileSystemError(operation, undefined, (error as NodeJS.ErrnoException).code)
    })
    if (!found.isDirectory()) throw new StoreFileSystemError(operation, undefined, 'ENOTDIR')
  }

  /** The names in `directory`, or none where it does not exist. */
  async function namesIn(tenant: string, directory: string): Promise<string[]> {
    try {
      return await readdir(directory)
    } catch (error) {
      if (!isCode(error, 'ENOENT') && !isCode(error, 'ENOTDIR')) throw failed('list', tenant, directory, error)
      await standing('list')
      return []
    }
  }

  /**
   * Writes `contents` to `name` in `directory` unless the name exists: to a
   * temporary file first, flushed, then linked. False where another write
   * made the name first. The temporary file is removed whatever happens.
   */
  async function written(tenant: string, directory: string, name: string, contents: string | Uint8Array): Promise<boolean> {
    await standing('write')
    await attempt('write', tenant, directory, () => mkdir(directory, { recursive: true }))
    const temporary = join(directory, `.${randomUUID()}.tmp`)
    try {
      const handle = await attempt('write', tenant, temporary, () => open(temporary, 'wx'))
      try {
        // On disk before it has a name: a revision that exists is whole.
        await attempt('write', tenant, temporary, async () => {
          await handle.writeFile(contents)
          await handle.sync()
        })
      } finally {
        await attempt('write', tenant, temporary, () => handle.close())
      }
      const final = join(directory, name)
      try {
        await link(temporary, final)
        return true
      } catch (error) {
        if (isCode(error, 'EEXIST')) return false
        throw failed('link', tenant, final, error)
      }
    } finally {
      await attempt('remove', tenant, temporary, () => rm(temporary, { force: true }))
    }
  }

  async function newestIn(tenant: string, directory: string): Promise<number | null> {
    return newestRevision(await namesIn(tenant, directory))
  }

  /** Where `file`, under `tenant`'s directory, is, for a `StoredRecordError` to name. */
  const stored = (tenant: string, file: string): StoredFile => ({ file, withinTenant: within(tenant, file) })

  async function readDraft(tenant: string, directory: string, revision: number): Promise<StoredDraft> {
    const file = join(directory, `${String(revision)}.json`)
    return { revision, ...recordIn(stored(tenant, file), await attempt('read', tenant, file, () => readFile(file, 'utf8'))) }
  }

  /** The file an image is kept in under `hex`, and the kind it was kept as; undefined where there is none. */
  async function imageFile(tenant: string, hex: string): Promise<{ file: string; mediaType: AssetMediaType } | undefined> {
    const directory = assetDirectory(tenant)
    for (const [mediaType, extension] of KINDS) {
      const file = join(directory, `${hex}.${extension}`)
      const found = await stat(file).catch((error: unknown) => {
        if (isCode(error, 'ENOENT') || isCode(error, 'ENOTDIR')) return undefined
        throw failed('read', tenant, file, error)
      })
      if (found !== undefined) return { file, mediaType }
    }
    await standing('read')
    return undefined
  }

  return {
    async list(tenant) {
      const templates = join(tenantDirectory(tenant), 'templates')
      const summaries: TemplateSummary[] = []
      // Only names a template id can be: `.DS_Store` and the like are none.
      for (const template of (await namesIn(tenant, templates)).filter(isIdentifier).sort(byCodeUnits)) {
        const directory = draftDirectory(tenant, template)
        const revision = await newestIn(tenant, directory)
        if (revision !== null) summaries.push({ template, revision, title: (await readDraft(tenant, directory, revision)).report.title })
      }
      return summaries
    },

    async newest(tenant, template) {
      const directory = draftDirectory(tenant, template)
      const revision = await newestIn(tenant, directory)
      return revision === null ? undefined : await readDraft(tenant, directory, revision)
    },

    async save(tenant, template, from, draft) {
      const directory = draftDirectory(tenant, template)
      const current = await newestIn(tenant, directory)
      if (current !== from) return { saved: false, revision: current }
      const revision = (current ?? 0) + 1
      if (!Number.isSafeInteger(revision)) throw new Error('The next revision of this template would not be a safe integer, so it was not written.')
      if (await written(tenant, directory, `${String(revision)}.json`, recordText(draft.savedBy, draft.report))) return { saved: true, revision }
      return { saved: false, revision: await newestIn(tenant, directory) }
    },

    async keepImage(tenant, digest, image) {
      const hex = digestName(digest)
      if (!Object.hasOwn(EXTENSIONS, image.mediaType)) throw new Error('The store keeps a PNG, a JPEG or an SVG, and was asked to keep another kind.')
      if (sha256(image.bytes) !== hex) throw new Error('The digest an image was to be kept under is not the SHA-256 of its bytes, so it was not kept.')
      if ((await imageFile(tenant, hex)) !== undefined) return
      // False only where a keep of the same digest linked it first: the same bytes, kept.
      await written(tenant, assetDirectory(tenant), `${hex}.${EXTENSIONS[image.mediaType]}`, image.bytes)
    },

    async readImage(tenant, digest) {
      const hex = digestName(digest)
      const kept = await imageFile(tenant, hex)
      if (kept === undefined) return undefined
      const bytes = await attempt('read', tenant, kept.file, () => readFile(kept.file))
      if (sha256(bytes) !== hex) throw new StoredRecordError(stored(tenant, kept.file), 'digest')
      return { mediaType: kept.mediaType, bytes } satisfies StoredImage
    },

    async hasImage(tenant, digest) {
      return (await imageFile(tenant, digestName(digest))) !== undefined
    },
  }
}

/**
 * A tenant's directory name: the SHA-256 of its claim's UTF-8, which every
 * claim a host sends has, lower-case and of one length. Not the claim, which
 * a volume that folds case or normalisation would merge with another; and
 * not the audit key's HMAC, which a rotated key would move.
 */
function tenantName(tenant: string): string {
  if (LONE_SURROGATE.test(tenant)) throw new Error('The tenant claim holds a lone surrogate, so it has no UTF-8 form to name its directory by; it was not used.')
  return sha256(tenant)
}

function templateName(template: string): string {
  if (!isIdentifier(template)) throw new Error('The store was asked for a template whose id is not a report id the format allows; the use cases refuse one before the store is asked.')
  return template
}

/** The name an image's file is kept under: its digest's 64 digits, once report-spec's `isDigest`, which the use cases judge by too, says it is one. */
function digestName(digest: string): string {
  if (!isDigest(digest)) throw new Error('The store was asked for an image by a digest that is not a SHA-256 as a report names one; the use cases refuse one before the store is asked.')
  return digest.slice(DIGEST_PREFIX.length)
}

/** The newest revision among `names`, or null where none is one. A number past the safe integers is a name the store never writes. */
function newestRevision(names: readonly string[]): number | null {
  let newest: number | null = null
  for (const name of names) {
    const revision = Number(REVISION_FILE.exec(name)?.[1])
    if (Number.isSafeInteger(revision) && (newest === null || revision > newest)) newest = revision
  }
  return newest
}

/**
 * A draft's record, as text: the report's JSON is written once, and its
 * digest is taken of exactly that text, which is the report's text in the
 * file. `JSON.stringify` writes the report the same way alone and inside the
 * record, so a reader that stringifies what it parsed has that text again.
 */
function recordText(savedBy: string, report: ReportDefinition): string {
  const text = JSON.stringify(report)
  return `{"format":${String(DRAFT_FORMAT)},"digest":"${sha256(text)}","savedBy":${JSON.stringify(savedBy)},"report":${text}}\n`
}

/** The draft `text` holds, checked: it parses, it is this format's record, and its report is what its digest names. */
function recordIn(where: StoredFile, text: string): Omit<StoredDraft, 'revision'> {
  let record: unknown
  try {
    record = JSON.parse(text)
  } catch {
    throw new StoredRecordError(where, 'json')
  }
  if (isRecord(record) && typeof record['format'] === 'number' && record['format'] !== DRAFT_FORMAT) throw new StoredRecordError(where, 'format', record['format'])
  if (!isRecord(record) || record['format'] !== DRAFT_FORMAT || typeof record['savedBy'] !== 'string' || !isRecord(record['report'])) throw new StoredRecordError(where, 'format')
  if (record['digest'] !== sha256(JSON.stringify(record['report']))) throw new StoredRecordError(where, 'digest')
  // Not validated again: the digest says it is the report the save validated (0049).
  return { savedBy: record['savedBy'], report: record['report'] as unknown as ReportDefinition }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function sha256(data: string | Uint8Array): string {
  return createHash('sha256').update(data).digest('hex')
}

/** A template id is lower-case ASCII, so its code units order it. */
function byCodeUnits(a: string, b: string): number {
  return Number(a > b) - Number(a < b)
}

function isCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code
}
