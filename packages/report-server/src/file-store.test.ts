import { createHash } from 'node:crypto'
import { chmod, link, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import { DRAFT_FORMAT } from '@formancy/report-server-core'
import type { StoredImage, TemplateStore } from '@formancy/report-server-core'
import { assetDigest, emptyReport, isDigest } from '@formancy/report-spec'
import type { ReportDefinition } from '@formancy/report-spec'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { openFileTemplateStore, StoredRecordError, StoreFileSystemError } from './file-store.js'

/**
 * The file store (0049, as formancy.ai-data 0013): a tenant's drafts and
 * images in files under one root, each against a real directory made for
 * the case, since what is proved here -- a hard link deciding a race, a
 * name a case-folding volume would merge -- is the file system's and no
 * double's. This is the store a deployment runs; the use cases' suites run
 * against one in memory.
 */

let root: string
let store: TemplateStore

/** The store opened on `at`, which every case but the root's own expects to open. */
async function opened(at: string): Promise<TemplateStore> {
  const outcome = await openFileTemplateStore(at)
  if (!outcome.ok) throw new Error(outcome.problem)
  return outcome.store
}

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'formancy-report-store-'))
  store = await opened(root)
})

afterEach(async () => {
  // A case that took the root's permissions away gives them back, or the directory could not be removed.
  await chmod(root, 0o700).catch(() => undefined)
  await rm(root, { recursive: true, force: true })
})

const TENANT = 'acme'
const sha256 = (data: string | Uint8Array): string => createHash('sha256').update(data).digest('hex')
/** The layout, written out as the store's header states it, so that a store that kept its files elsewhere fails here. */
const tenantDirectory = (tenant: string): string => join(root, 'tenants', sha256(Buffer.from(tenant, 'utf8')))
const draftDirectory = (tenant: string, template: string): string => join(tenantDirectory(tenant), 'templates', template, 'draft')
const assetDirectory = (tenant: string): string => join(tenantDirectory(tenant), 'assets')
const report = (id: string, title: string): ReportDefinition => emptyReport(id, title, 'en')
const draft = (savedBy: string, saved: ReportDefinition) => ({ savedBy, report: saved })
/** Bytes and the digest that names them, as a report's asset names an image. */
const image = (text: string) => {
  const bytes = new TextEncoder().encode(text)
  return { bytes, digest: assetDigest(bytes) }
}

describe('a draft', () => {
  // A store that wrote over the previous revision, numbered from anything
  // but one, or read back other than what it was given, would serve an
  // author a draft they never saved. The record on disk is its format, the
  // digest, who saved it and the report, the report's text in it exactly
  // the text its digest was taken of.
  test('saves 1, 2 and 3 in order, each read back as it was saved', async () => {
    const saves = [draft('u-1', report('invoice', 'One')), draft('u-2', report('invoice', 'Two')), draft('u-1', report('invoice', 'Three'))]
    expect(await store.newest(TENANT, 'invoice')).toBeUndefined()
    for (const [at, each] of saves.entries()) {
      expect(await store.save(TENANT, 'invoice', at === 0 ? null : at, each)).toEqual({ saved: true, revision: at + 1 })
      expect(await store.newest(TENANT, 'invoice')).toEqual({ revision: at + 1, ...each })
    }
    const text = await readFile(join(draftDirectory(TENANT, 'invoice'), '3.json'), 'utf8')
    const written = JSON.stringify(saves[2]?.report)
    expect(JSON.parse(text)).toEqual({ format: DRAFT_FORMAT, digest: sha256(written), savedBy: 'u-1', report: saves[2]?.report })
    expect(text).toContain(written)
  })

  // Two authors read revision 1 and both save. Without the comparison the
  // second would silently replace the first one's work; told which revision
  // stands, it can read that one first.
  test('a save from 1 after 2 is not written, and says 2 stands', async () => {
    expect(await store.save(TENANT, 'invoice', 1, draft('u-1', report('invoice', 'Nothing yet')))).toEqual({ saved: false, revision: null })
    await store.save(TENANT, 'invoice', null, draft('u-1', report('invoice', 'One')))
    await store.save(TENANT, 'invoice', 1, draft('u-2', report('invoice', 'Two')))
    expect(await store.save(TENANT, 'invoice', 1, draft('u-3', report('invoice', 'Stale')))).toEqual({ saved: false, revision: 2 })
    expect(await store.save(TENANT, 'invoice', null, draft('u-3', report('invoice', 'Created again')))).toEqual({ saved: false, revision: 2 })
    expect((await readdir(draftDirectory(TENANT, 'invoice'))).sort()).toEqual(['1.json', '2.json'])
    expect((await store.newest(TENANT, 'invoice'))?.report.title).toBe('Two')
  })

  // The case the comparison before the write cannot decide alone: every
  // racer reads revision 1 as the newest at once. The hard link decides,
  // and must decide exactly once -- twenty racers, one winner, the losers
  // told 2 stands, and no racer's temporary file left behind.
  test('of 20 concurrent saves from 1, exactly one wins, and no temporary file remains', async () => {
    await store.save(TENANT, 'invoice', null, draft('u-0', report('invoice', 'Base')))
    const racers = await Promise.all(Array.from({ length: 20 }, () => opened(root)))
    const outcomes = await Promise.all(racers.map((each, n) => each.save(TENANT, 'invoice', 1, draft(`u-${String(n + 1)}`, report('invoice', `Racer ${String(n + 1)}`)))))
    const winners = outcomes.flatMap((outcome, n) => (outcome.saved ? [n] : []))
    expect(winners).toHaveLength(1)
    expect(outcomes.filter((outcome) => !outcome.saved)).toEqual(Array.from({ length: 19 }, () => ({ saved: false, revision: 2 })))
    expect((await store.newest(TENANT, 'invoice'))?.report.title).toBe(`Racer ${String((winners[0] ?? -1) + 1)}`)
    expect((await readdir(draftDirectory(TENANT, 'invoice'))).sort()).toEqual(['1.json', '2.json'])
  })

  // The cost 0049 states, and the operator's procedure answers: a revision
  // is the newest file's number, so where that file disappears -- a backup
  // older than the newest save restored, the file removed by hand -- the
  // next save is given its number again, and a page still holding the old
  // revision 2 saves from it over another author's 2, unseen. Held here so
  // that the limitation is read again the day the store stops reusing a
  // number, or reuses one some other way: left standing, it would tell
  // operators of a hazard the store no longer has, or not of the one it has.
  test('a revision whose newest file is gone is issued again, and a save from the old one then wins', async () => {
    await store.save(TENANT, 'invoice', null, draft('u-1', report('invoice', 'One')))
    await store.save(TENANT, 'invoice', 1, draft('u-1', report('invoice', 'Two, open in a page')))
    await rm(join(draftDirectory(TENANT, 'invoice'), '2.json'))
    expect(await store.save(TENANT, 'invoice', 1, draft('u-2', report('invoice', 'Another two')))).toEqual({ saved: true, revision: 2 })
    expect(await store.save(TENANT, 'invoice', 2, draft('u-1', report('invoice', 'Three, over another two')))).toEqual({ saved: true, revision: 3 })
    expect((await store.newest(TENANT, 'invoice'))?.report.title).toBe('Three, over another two')
  })

  // `10.json` sorts before `9.json` as text. A store that
  // took the last name would serve revision 9 as the newest, and every save
  // from 11 would be refused as stale.
  test('after eleven saves, the newest is revision 11, and the list says 11', async () => {
    for (let from: number | null = null; from === null || from < 11; from = (from ?? 0) + 1) {
      await store.save(TENANT, 'invoice', from, draft('u-1', report('invoice', `Save ${String((from ?? 0) + 1)}`)))
    }
    expect(await store.newest(TENANT, 'invoice')).toMatchObject({ revision: 11, report: { title: 'Save 11' } })
    expect(await store.list(TENANT)).toEqual([{ template: 'invoice', revision: 11, title: 'Save 11' }])
  })

  // A crash between writing and linking leaves a temporary file, and a
  // directory can be made and never written to. Neither is a draft: listed,
  // it would be offered to an author and then fail to read. Nor is any name
  // the store never writes -- a zero-padded number, a note, the `.DS_Store`
  // macOS leaves beside a template's directories.
  test('a template directory holding only a temporary file, or nothing, is neither listed nor read', async () => {
    await store.save(TENANT, 'invoice', null, draft('u-1', report('invoice', 'Kept')))
    await mkdir(join(tenantDirectory(TENANT), 'templates', 'empty'), { recursive: true })
    await mkdir(draftDirectory(TENANT, 'crashed'), { recursive: true })
    await writeFile(join(draftDirectory(TENANT, 'crashed'), '.0f3c.tmp'), '{"format":1,"half')
    await writeFile(join(draftDirectory(TENANT, 'invoice'), '07.json'), '{}')
    await writeFile(join(draftDirectory(TENANT, 'invoice'), 'notes.txt'), 'hello')
    await writeFile(join(tenantDirectory(TENANT), 'templates', '.DS_Store'), '')
    expect(await store.list(TENANT)).toEqual([{ template: 'invoice', revision: 1, title: 'Kept' }])
    expect(await store.newest(TENANT, 'empty')).toBeUndefined()
    expect(await store.newest(TENANT, 'crashed')).toBeUndefined()
    expect(await store.newest(TENANT, 'invoice')).toMatchObject({ revision: 1 })
    // The leftover is not a revision either, so it does not stand in the way of the first save.
    expect(await store.save(TENANT, 'crashed', null, draft('u-1', report('crashed', 'First')))).toEqual({ saved: true, revision: 1 })
  })

  // A record changed by hand is no longer what the save validated, and one
  // of another format is not this release's to read (0046's fourth version
  // line). Serving either would be serving a guess; each is refused, naming
  // the file, so the operator can find it -- through the list as through a
  // read -- and a format number this release does not read named beside the
  // one it does, as 0004 names a version. The error says the file's path
  // inside its tenant's directory as well, which is what the server's log
  // names it by: the tenant's directory is the unkeyed hash of the claim,
  // reversed by trying a guessable tenant, so a log that took the absolute
  // path to say where the record is would say whose it is.
  test('a record edited by hand, of format 2 or not JSON, throws StoredRecordError naming the file', async () => {
    await store.save(TENANT, 'invoice', null, draft('u-1', report('invoice', 'Saved')))
    const file = join(draftDirectory(TENANT, 'invoice'), '1.json')
    const record = JSON.parse(await readFile(file, 'utf8')) as Record<string, unknown>
    const { savedBy: _, ...unsigned } = record
    const cases = [
      ['digest', JSON.stringify({ ...record, report: report('invoice', 'Edited') }), /does not hold what the SHA-256 written for it names/],
      ['format', JSON.stringify({ ...record, format: 2 }), /is a record of format 2, and this release reads format 1 alone/],
      ['format', JSON.stringify({ ...record, format: '1' }), /is not a draft record of format 1/],
      ['format', JSON.stringify(unsigned), /is not a draft record of format 1/],
      ['format', JSON.stringify([record]), /is not a draft record of format 1/],
      ['json', '{"format":1,', /is not JSON/],
    ] as const
    for (const [why, text, said] of cases) {
      await writeFile(file, text)
      for (const read of [() => store.newest(TENANT, 'invoice'), () => store.list(TENANT)]) {
        const error = await read().catch((caught: unknown) => caught)
        expect(error, `${why}: ${text}`).toBeInstanceOf(StoredRecordError)
        expect(error).toMatchObject({ file, why, withinTenant: 'templates/invoice/draft/1.json' })
        expect(join(tenantDirectory(TENANT), (error as StoredRecordError).withinTenant)).toBe(file)
        expect((error as Error).message).toContain(file)
        expect((error as Error).message).toMatch(said)
      }
    }
  })
})

describe('the tenants', () => {
  // The use cases compare tenants as exact strings, and this
  // Mac's volume folds both case and Unicode normalisation: a directory
  // named after the claim would make Acme's drafts acme's, and one é the
  // other's. Each tenant saves the same template from nothing, and each
  // wins, sees only its own and holds its own image alone.
  test('Acme, acme, NFC é and NFD é are four tenants that cannot see each other', async () => {
    const tenants = ['Acme', 'acme', 'é', 'é']
    for (const tenant of tenants) {
      expect(await store.save(tenant, 'invoice', null, draft('u-1', report('invoice', `Of ${tenant}`)))).toEqual({ saved: true, revision: 1 })
    }
    const kept = image('the logo of Acme')
    await store.keepImage('Acme', kept.digest, { mediaType: 'image/png', bytes: kept.bytes })
    for (const tenant of tenants) {
      expect((await store.newest(tenant, 'invoice'))?.report.title).toBe(`Of ${tenant}`)
      expect(await store.list(tenant)).toEqual([{ template: 'invoice', revision: 1, title: `Of ${tenant}` }])
      expect(await store.imageKind(tenant, kept.digest)).toBe(tenant === 'Acme' ? 'image/png' : undefined)
    }
    expect(await readdir(join(root, 'tenants'))).toHaveLength(4)
  })

  // A string with a lone surrogate has no UTF-8 form: encoded, it becomes
  // U+FFFD, so `\uD800`, `\uDC00` and `�` would be one tenant's
  // directory. A claim like that is refused before it names one.
  test('a tenant that has no UTF-8 form throws before any file operation', async () => {
    for (const tenant of ['\ud800', 'acme\udc00']) {
      await expect(store.list(tenant)).rejects.toThrow(/UTF-8/)
      await expect(store.save(tenant, 'invoice', null, draft('u-1', report('invoice', 'Lone')))).rejects.toThrow(/UTF-8/)
    }
    expect(await readdir(root)).toEqual([])
  })
})

describe('what names a file', () => {
  // A template id and a digest become names in a path. The use cases refuse
  // one that is not report-spec's before the store is asked; this is the
  // second line, so that a route that forgot could not climb out of the
  // tenant's directory with `../x`. With the root unreadable, any file
  // operation made first would fail otherwise than the check does.
  test('a template id that is not report-spec’s identifier, or a digest that is not a SHA-256, throws before any file operation', async () => {
    await chmod(root, 0o000)
    for (const template of ['../x', '..', '.', '', 'a/b', 'a\\b', '.hidden', 'Invoice', '-a', '1a', 'x'.repeat(65)]) {
      await expect(store.newest(TENANT, template), template).rejects.toThrow(/not a report id/)
      await expect(store.save(TENANT, template, null, draft('u-1', report('invoice', 'Out')))).rejects.toThrow(/not a report id/)
    }
    const kept = image('bytes')
    for (const digest of ['', kept.digest.slice('sha256:'.length), kept.digest.toUpperCase(), `${kept.digest}0`, 'sha256:../../x', `sha512:${'a'.repeat(64)}`]) {
      await expect(store.imageKind(TENANT, digest), digest).rejects.toThrow(/not a SHA-256/)
      await expect(store.readImage(TENANT, digest)).rejects.toThrow(/not a SHA-256/)
      await expect(store.keepImage(TENANT, digest, { mediaType: 'image/png', bytes: kept.bytes })).rejects.toThrow(/not a SHA-256/)
    }
    await chmod(root, 0o700)
    expect(await readdir(root)).toEqual([])
  })

  // The use cases let a digest through by report-spec's `isDigest`, and the
  // store names a file by it. Were the store's reading another, a digest a
  // report declares and a keep accepts could be one the store throws on,
  // and a save that declares it would be answered 500 rather than
  // asset-not-kept; so the store refuses exactly what `isDigest` refuses.
  test('a digest is refused exactly where report-spec’s isDigest refuses it, and read where it accepts it', async () => {
    const kept = image('bytes')
    const hex = kept.digest.slice('sha256:'.length)
    for (const digest of [kept.digest, `sha256:${'0'.repeat(64)}`, hex, `sha256:${hex.toUpperCase()}`, kept.digest.toUpperCase(), `SHA256:${hex}`, `${kept.digest}0`, `${kept.digest}\n`, kept.digest.slice(0, -1), 'sha256:../../x', `sha512:${hex}`, '']) {
      const read = await store.readImage(TENANT, digest).then(
        () => 'read',
        (error: unknown) => (error instanceof Error && /not a SHA-256/.test(error.message) ? 'refused' : String(error)),
      )
      expect(read, JSON.stringify(digest)).toBe(isDigest(digest) ? 'read' : 'refused')
    }
  })

  // A revision is a positive safe integer (the plan's constraint). A name
  // past the safe integers is one the store never wrote, and is no
  // revision; and the save after the largest safe one would be numbered by
  // a float that no longer counts, so it throws rather than write it.
  test('a revision past the safe integers is neither read nor written', async () => {
    await store.save(TENANT, 'invoice', null, draft('u-1', report('invoice', 'One')))
    const directory = draftDirectory(TENANT, 'invoice')
    await link(join(directory, '1.json'), join(directory, '99999999999999999999.json'))
    expect(await store.newest(TENANT, 'invoice')).toMatchObject({ revision: 1 })
    await link(join(directory, '1.json'), join(directory, `${String(Number.MAX_SAFE_INTEGER)}.json`))
    expect(await store.newest(TENANT, 'invoice')).toMatchObject({ revision: Number.MAX_SAFE_INTEGER })
    await expect(store.save(TENANT, 'invoice', Number.MAX_SAFE_INTEGER, draft('u-1', report('invoice', 'Past')))).rejects.toThrow(/safe integer/)
  })
})

describe('an image', () => {
  // A builder keeps an image again whenever a person adds it again (0033).
  // The second keep must leave the first file as it is, one file and no
  // leftover, and a read must give back the bytes and the kind they were
  // kept as, each kind under its own extension.
  test('kept twice under one digest leaves one file, and reads back its bytes and media type', async () => {
    const png = image('a png')
    expect(await store.imageKind(TENANT, png.digest)).toBeUndefined()
    expect(await store.readImage(TENANT, png.digest)).toBeUndefined()
    await store.keepImage(TENANT, png.digest, { mediaType: 'image/png', bytes: png.bytes })
    const file = join(assetDirectory(TENANT), `${png.digest.slice('sha256:'.length)}.png`)
    const first = await stat(file)
    await store.keepImage(TENANT, png.digest, { mediaType: 'image/png', bytes: png.bytes })
    expect((await stat(file)).ino).toBe(first.ino)
    expect(await readdir(assetDirectory(TENANT))).toEqual([`${png.digest.slice('sha256:'.length)}.png`])
    expect(await store.imageKind(TENANT, png.digest)).toBe('image/png')
    expect(await store.readImage(TENANT, png.digest)).toEqual({ mediaType: 'image/png', bytes: Buffer.from(png.bytes) })
    for (const [mediaType, extension] of [['image/jpeg', 'jpg'], ['image/svg+xml', 'svg']] as const) {
      const kept = image(`an image kept as ${mediaType}`)
      await store.keepImage(TENANT, kept.digest, { mediaType, bytes: kept.bytes })
      expect(await readdir(assetDirectory(TENANT))).toContain(`${kept.digest.slice('sha256:'.length)}.${extension}`)
      expect(await store.readImage(TENANT, kept.digest)).toEqual({ mediaType, bytes: Buffer.from(kept.bytes) })
    }
  })

  // A digest names the bytes a report pinned. Kept under the wrong one, an
  // image would be printed where another was approved; changed on disk, it
  // would be served under a digest that no longer names it. The keep throws
  // before it writes, and the read throws naming the file, and its path
  // inside the tenant's directory for a log that may not name the tenant's.
  test('is never kept or served under a digest that is not its bytes', async () => {
    const kept = image('the approved logo')
    const other = image('another logo')
    await expect(store.keepImage(TENANT, kept.digest, { mediaType: 'image/png', bytes: other.bytes })).rejects.toThrow(/not the SHA-256/)
    expect(await store.imageKind(TENANT, kept.digest)).toBeUndefined()
    await store.keepImage(TENANT, kept.digest, { mediaType: 'image/png', bytes: kept.bytes })
    const file = join(assetDirectory(TENANT), `${kept.digest.slice('sha256:'.length)}.png`)
    await writeFile(file, other.bytes)
    const error = await store.readImage(TENANT, kept.digest).catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(StoredRecordError)
    expect(error).toMatchObject({ file, why: 'digest', withinTenant: `assets/${kept.digest.slice('sha256:'.length)}.png` })
  })

  // A save asks the store what kind an image it declares was kept as, and
  // refuses it unless the kind is the one declared (0049): a store that
  // answered only whether some image is kept under the digest would let a
  // draft declare a kept PNG as an SVG, saved and never printable. Each
  // kind is answered by the extension it was kept under, and an image not
  // kept, or another tenant's, by nothing.
  test('answers the kind each image was kept as, and nothing where the tenant kept none', async () => {
    for (const mediaType of ['image/png', 'image/jpeg', 'image/svg+xml'] as const) {
      const kept = image(`kept as ${mediaType}`)
      expect(await store.imageKind(TENANT, kept.digest), mediaType).toBeUndefined()
      await store.keepImage(TENANT, kept.digest, { mediaType, bytes: kept.bytes })
      expect(await store.imageKind(TENANT, kept.digest), mediaType).toBe(mediaType)
      expect(await store.imageKind('other', kept.digest), mediaType).toBeUndefined()
    }
  })

  // Two tabs add the same logo at once, and both keeps find nothing kept
  // yet. The link decides again: one file, both keeps resolved, since each
  // kept the same bytes, and no temporary file left by the one that lost.
  test('kept by several at once leaves one file and no temporary one', async () => {
    const logo = image('a logo added in two tabs')
    const keepers = await Promise.all(Array.from({ length: 5 }, () => opened(root)))
    await Promise.all(keepers.map((each) => each.keepImage(TENANT, logo.digest, { mediaType: 'image/png', bytes: logo.bytes })))
    expect(await readdir(assetDirectory(TENANT))).toEqual([`${logo.digest.slice('sha256:'.length)}.png`])
  })

  // A kind the store has no extension for -- a font, which no store here
  // keeps (0049) -- would be written as `<hex>.undefined`, a name no read
  // finds. It throws before anything is written.
  test('of a kind the store has no name for is not kept', async () => {
    const font = image('a font')
    const mediaType = 'font/ttf' as StoredImage['mediaType']
    await expect(store.keepImage(TENANT, font.digest, { mediaType, bytes: font.bytes })).rejects.toThrow(/PNG, a JPEG or an SVG/)
    expect(await readdir(root)).toEqual([])
  })
})

describe('a directory the store cannot read', () => {
  // Only a name that is not there is read as nothing kept. Any other
  // failure -- here a directory this process may not read -- is thrown,
  // never answered as "no draft", "no templates" or "no image", which
  // would invite a save from nothing over drafts that exist. It is thrown
  // as the store's own error, with Node's code, what the store was doing
  // and the path inside the tenant's directory: Node's own error names the
  // absolute path, and with it the tenant's directory, the unkeyed hash of
  // the claim, which a log reverses for a tenant it can guess.
  test('throws the store’s own error, by Node’s code, the operation and the path inside the tenant, rather than reading as empty', async () => {
    await store.save(TENANT, 'invoice', null, draft('u-1', report('invoice', 'Kept')))
    const kept = image('a logo')
    await store.keepImage(TENANT, kept.digest, { mediaType: 'image/png', bytes: kept.bytes })
    await chmod(draftDirectory(TENANT, 'invoice'), 0o000)
    await chmod(assetDirectory(TENANT), 0o000)
    try {
      const failures = [
        [() => store.newest(TENANT, 'invoice'), { code: 'EACCES', operation: 'list', withinTenant: 'templates/invoice/draft' }],
        [() => store.list(TENANT), { code: 'EACCES', operation: 'list', withinTenant: 'templates/invoice/draft' }],
        [() => store.imageKind(TENANT, kept.digest), { code: 'EACCES', operation: 'read', withinTenant: `assets/${kept.digest.slice('sha256:'.length)}.png` }],
      ] as const
      for (const [asked, expected] of failures) {
        const error = await (asked as () => Promise<unknown>)().catch((caught: unknown) => caught)
        expect(error).toBeInstanceOf(StoreFileSystemError)
        expect(error).toMatchObject(expected)
        expect((error as Error).message).toContain('EACCES')
        expect((error as Error).message).not.toContain(root)
        expect((error as Error).message).not.toContain(sha256(TENANT))
      }
    } finally {
      await chmod(draftDirectory(TENANT, 'invoice'), 0o700)
      await chmod(assetDirectory(TENANT), 0o700)
    }
  })

  // A save into a template's directory this process may not write fails
  // writing its temporary file, and says that, not where the volume is.
  test('throws the store’s own error for a write it cannot make', async () => {
    await store.save(TENANT, 'invoice', null, draft('u-1', report('invoice', 'Kept')))
    await chmod(draftDirectory(TENANT, 'invoice'), 0o500)
    try {
      const error = await store.save(TENANT, 'invoice', 1, draft('u-1', report('invoice', 'Again'))).catch((caught: unknown) => caught)
      expect(error).toBeInstanceOf(StoreFileSystemError)
      expect(error).toMatchObject({ code: 'EACCES', operation: 'write' })
      expect((error as StoreFileSystemError).withinTenant).toMatch(/^templates\/invoice\/draft\/\.[0-9a-f-]+\.tmp$/)
      expect((error as Error).message).not.toContain(root)
    } finally {
      await chmod(draftDirectory(TENANT, 'invoice'), 0o700)
    }
    expect(await readdir(draftDirectory(TENANT, 'invoice'))).toEqual(['1.json'])
  })
})

describe('the root', () => {
  // A misconfigured volume found at start, in one sentence saying what is
  // wrong with the root, beats a server that answers every save with
  // `internal`. The store is opened from code as well as from a container,
  // so the sentence names no setting and no environment variable -- an
  // embedder set none, and one told to look at FORMANCY_REPORT_STORE_DIR
  // would look for a variable they never wrote; the server names its own
  // (serve.ts). It never quotes the path, which the operator set and can
  // read. The relative root names this case's own directory, which would
  // open: only its being relative refuses it, as the directory a process
  // starts in would otherwise decide where the drafts go.
  test('that is a file, relative, missing or not writable is refused, naming no setting', async () => {
    const file = join(root, 'a-file-not-a-directory')
    await writeFile(file, 'x')
    const locked = join(root, 'a-directory-not-writable')
    await mkdir(locked, { mode: 0o555 })
    const cases = [
      [file, /not a directory/],
      [relative(process.cwd(), root), /not an absolute path/],
      [join(root, 'a-directory-not-made'), /names nothing/],
      [locked, /cannot write/],
    ] as const
    for (const [at, why] of cases) {
      const outcome = await openFileTemplateStore(at)
      expect(outcome.ok, at).toBe(false)
      const problem = outcome.ok ? '' : outcome.problem
      expect(problem).toMatch(/^The store's root /)
      expect(problem).toMatch(why)
      expect(problem).not.toMatch(/FORMANCY_|environment|setting|variable/i)
      expect(problem).not.toContain(at)
    }
  })

  // A volume that goes away under a running server: read as an empty store
  // it would hide every draft behind "no draft", and a save would make the
  // root again where the volume was not, splitting the store in two.
  test('that is gone after it opened fails every call, and is not made again', async () => {
    await store.save(TENANT, 'invoice', null, draft('u-1', report('invoice', 'Kept')))
    await rm(root, { recursive: true })
    const kept = image('bytes')
    await expect(store.list(TENANT)).rejects.toThrow(/no longer a directory/)
    await expect(store.newest(TENANT, 'invoice')).rejects.toThrow(/no longer a directory/)
    await expect(store.save(TENANT, 'invoice', null, draft('u-1', report('invoice', 'Again')))).rejects.toThrow(/no longer a directory/)
    await expect(store.imageKind(TENANT, kept.digest)).rejects.toThrow(/no longer a directory/)
    await expect(store.readImage(TENANT, kept.digest)).rejects.toThrow(/no longer a directory/)
    await expect(store.keepImage(TENANT, kept.digest, { mediaType: 'image/png', bytes: kept.bytes })).rejects.toThrow(/no longer a directory/)
    await expect(stat(root)).rejects.toThrow(/ENOENT/)
    // The store's own error, naming no file: what is gone is the root.
    await expect(store.list(TENANT)).rejects.toMatchObject({ name: 'StoreFileSystemError', code: 'ENOENT', operation: 'list', withinTenant: undefined })
    await expect(store.save(TENANT, 'invoice', null, draft('u-1', report('invoice', 'Again')))).rejects.toMatchObject({ code: 'ENOENT', operation: 'list' })
    await expect(store.readImage(TENANT, kept.digest)).rejects.toMatchObject({ code: 'ENOENT', operation: 'read' })
  })

  // A root a volume left a file in place of is gone as much as a removed
  // one, and says so by the code Node gives a path that is no directory.
  test('that is a file after it opened fails every call as gone', async () => {
    await rm(root, { recursive: true })
    await writeFile(root, 'not a directory')
    try {
      await expect(store.list(TENANT)).rejects.toMatchObject({ code: 'ENOTDIR', operation: 'list', withinTenant: undefined })
      await expect(store.keepImage(TENANT, image('bytes').digest, { mediaType: 'image/png', bytes: image('bytes').bytes })).rejects.toMatchObject({ code: 'ENOTDIR', operation: 'read' })
    } finally {
      await rm(root)
      await mkdir(root)
    }
  })

  // The same rule for what a running store says: it is thrown into the
  // server's log as an `internal`, where the operator who reads it knows
  // the directory they mounted and an embedder knows none of our settings.
  test('that is gone after it opened says so without naming a setting', async () => {
    await rm(root, { recursive: true })
    const failure = await store.list(TENANT).catch((error: unknown) => error as Error)
    expect(failure).toBeInstanceOf(Error)
    expect((failure as Error).message).not.toMatch(/FORMANCY_|environment|setting|variable/i)
    expect((failure as Error).message).not.toContain(root)
  })
})

describe('the list', () => {
  // The list is how an author finds a template again: each one's newest
  // title, not its first, and in an order that does not depend on what the
  // volume's directory listing happens to return. A tenant with nothing
  // saved lists nothing rather than failing.
  test('gives each template’s newest report title, ordered by template id', async () => {
    expect(await store.list(TENANT)).toEqual([])
    for (const id of ['zeta', 'alpha-2', 'beta', 'alpha']) await store.save(TENANT, id, null, draft('u-1', report(id, `First of ${id}`)))
    await store.save(TENANT, 'beta', 1, draft('u-1', report('beta', 'Second of beta')))
    expect(await store.list(TENANT)).toEqual([
      { template: 'alpha', revision: 1, title: 'First of alpha' },
      { template: 'alpha-2', revision: 1, title: 'First of alpha-2' },
      { template: 'beta', revision: 2, title: 'Second of beta' },
      { template: 'zeta', revision: 1, title: 'First of zeta' },
    ])
  })
})
